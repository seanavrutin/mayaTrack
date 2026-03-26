import { getToken, deleteToken } from 'firebase/messaging';
import { messagingPromise } from './firebase';
import { saveFcmToken, removeFcmToken, updateFcmTokenTime, updateUserReminderSettings } from './firebaseApi';

const VAPID_KEY = 'BHF8oNER1e8zb9-dXbuDirWSdAWL0wXtEqpCciZ7jXGCguvakQ0h7QoaxRSXGAEZajAsRRy5vfhLi3RiWqNGZlA';

let cachedToken = null;

export async function isMessagingSupported() {
  const messaging = await messagingPromise;
  return messaging !== null;
}

async function getFcmToken() {
  const messaging = await messagingPromise;
  if (!messaging) return null;
  const token = await getToken(messaging, { vapidKey: VAPID_KEY });
  cachedToken = token;
  return token;
}

export async function enableNotifications(familyId, userId, reminderTime) {
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return { success: false, reason: 'denied' };

  try {
    const token = await getFcmToken();
    if (!token) return { success: false, reason: 'unsupported' };

    await saveFcmToken(familyId, token, userId, reminderTime);
    await updateUserReminderSettings(userId, { reminderEnabled: true, reminderTime });
    return { success: true, token };
  } catch (err) {
    console.error('FCM token error:', err);
    return { success: false, reason: 'error' };
  }
}

export async function disableNotifications(familyId, userId) {
  const messaging = await messagingPromise;
  if (!messaging) return;

  try {
    const token = cachedToken || await getFcmToken();
    if (token) {
      await removeFcmToken(familyId, token);
      await deleteToken(messaging);
      cachedToken = null;
    }
    await updateUserReminderSettings(userId, { reminderEnabled: false });
  } catch (err) {
    console.error('FCM disable error:', err);
  }
}

export async function updateReminderTime(familyId, userId, reminderTime) {
  try {
    const token = cachedToken || await getFcmToken();
    if (token) {
      await updateFcmTokenTime(familyId, token, reminderTime);
    }
    await updateUserReminderSettings(userId, { reminderTime });
  } catch (err) {
    console.error('Update reminder time error:', err);
  }
}
