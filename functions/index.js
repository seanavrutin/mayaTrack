const { onSchedule } = require('firebase-functions/v2/scheduler');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getMessaging } = require('firebase-admin/messaging');

initializeApp();

const db = getFirestore('maya-track-db');

function toMinutes(timeStr) {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

function getCurrentMinutes(timezone) {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: timezone,
  });
  const [h, m] = formatter.format(now).split(':').map(Number);
  return h * 60 + m;
}

function isInWindow(reminderMinutes, nowMinutes, windowSize) {
  const start = nowMinutes - windowSize + 1;
  if (start >= 0) {
    return reminderMinutes >= start && reminderMinutes <= nowMinutes;
  }
  // Wraps past midnight: e.g. now=5, window=15 → start=-9 → check 1431..1440 OR 0..5
  return reminderMinutes >= (start + 1440) || reminderMinutes <= nowMinutes;
}

function getTodayDateString(timezone) {
  return new Date().toLocaleDateString('en-CA', { timeZone: timezone });
}

exports.medicationReminder = onSchedule(
  {
    schedule: 'every 15 minutes',
    timeZone: 'Asia/Jerusalem',
    retryCount: 0,
  },
  async () => {
    const timezone = 'Asia/Jerusalem';
    const nowMinutes = getCurrentMinutes(timezone);
    const todayStr = getTodayDateString(timezone);

    const familiesSnap = await db.collection('families').get();

    for (const familyDoc of familiesSnap.docs) {
      try {
        const familyId = familyDoc.id;

        const tokensSnap = await db
          .collection('families').doc(familyId)
          .collection('fcmTokens').get();

        if (tokensSnap.empty) continue;

        const matchingTokens = tokensSnap.docs.filter((d) => {
          const data = d.data();
          if (!data.reminderTime) return false;
          return isInWindow(toMinutes(data.reminderTime), nowMinutes, 15);
        });

        if (matchingTokens.length === 0) continue;

        const kidsSnap = await db
          .collection('families').doc(familyId)
          .collection('kids').get();

        if (kidsSnap.empty) continue;

        const todayStart = `${todayStr}T00:00:00`;
        const todayEnd = `${todayStr}T23:59:59`;

        const medLogsSnap = await db
          .collection('families').doc(familyId)
          .collection('medicationLogs')
          .where('time', '>=', todayStart)
          .where('time', '<=', todayEnd)
          .get();

        const vitaminDSnap = await db
          .collection('families').doc(familyId)
          .collection('vitaminD')
          .where('time', '>=', todayStart)
          .where('time', '<=', todayEnd)
          .get();

        const todayLogs = medLogsSnap.docs.map((d) => d.data());
        const legacyLogs = vitaminDSnap.docs.map((d) => ({
          medicationName: 'ויטמין D',
          kidId: null,
          time: d.data().time,
        }));
        const allLogs = [...todayLogs, ...legacyLogs];

        const kidsWithMissing = [];
        for (const kidDoc of kidsSnap.docs) {
          const kid = kidDoc.data();
          const kidId = kidDoc.id;
          const meds = kid.medications || [];
          if (meds.length === 0) continue;

          const hasMissing = meds.some((m) => {
            const taken = allLogs.filter(
              (l) => l.medicationName === m.name && (l.kidId === kidId || !l.kidId)
            ).length;
            return taken < m.timesPerDay;
          });

          if (hasMissing) kidsWithMissing.push(kid.name);
        }

        if (kidsWithMissing.length === 0) continue;

        const tokens = matchingTokens.map((d) => d.data().token);

        const body = kidsWithMissing.length === 1
          ? `יש תרופות שלא ניתנו היום ל${kidsWithMissing[0]}`
          : `יש תרופות שלא ניתנו היום ל: ${kidsWithMissing.join(', ')}`;

        const message = {
          notification: {
            title: 'MayaTrack - תזכורת תרופות 💊',
            body,
          },
          tokens,
        };

        const response = await getMessaging().sendEachForMulticast(message);

        const tokensToRemove = [];
        response.responses.forEach((resp, idx) => {
          if (!resp.success && resp.error?.code === 'messaging/registration-token-not-registered') {
            tokensToRemove.push(tokens[idx]);
          }
        });

        for (const token of tokensToRemove) {
          await db
            .collection('families').doc(familyId)
            .collection('fcmTokens').doc(token)
            .delete();
        }
      } catch (err) {
        console.error(`Error processing family ${familyDoc.id}:`, err);
      }
    }
  }
);
