import { useRef, useEffect, useMemo, useState } from 'react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';

const BAR_SPACE = 55;
const CHART_HEIGHT = 260;
const CHART_MARGIN = { top: 16, right: 12, left: 4, bottom: 8 };
const AXIS_TICK = { fontSize: 11, fill: '#8b7a9e' };
const GRID_STROKE = '#ece4f7';

function ChartTooltip({ active, payload, label, unit }) {
  if (!active || !payload || !payload.length) return null;
  // When more than one series is present (e.g. combined pee+poop bars),
  // include each series name so the tooltip stays readable.
  const showName = payload.length > 1;
  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip-label">{label}</div>
      {payload.map((p, i) => (
        <div key={i} className="chart-tooltip-value">
          {showName && p.name ? `${p.name}: ` : ''}
          {p.value}
          {unit ? ` ${unit}` : ''}
        </div>
      ))}
    </div>
  );
}

function isTruthy(val) {
  if (typeof val === 'boolean') return val;
  if (typeof val === 'string') return val.toLowerCase() === 'true';
  return Boolean(val);
}

function toDateKey(isoString) {
  const d = new Date(isoString);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDateLabel(dateKey) {
  const [, m, d] = dateKey.split('-');
  return `${d}/${m}`;
}

function todayKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function parseDateKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function getDayRange(entries) {
  if (!entries.length) return [];
  const dates = entries.map((e) => toDateKey(e.time));
  const unique = [...new Set(dates)].sort();
  const start = parseDateKey(unique[0]);
  const end = parseDateKey(unique[unique.length - 1]);
  const days = [];
  const current = new Date(start);
  while (current <= end) {
    const y = current.getFullYear();
    const m = String(current.getMonth() + 1).padStart(2, '0');
    const d = String(current.getDate()).padStart(2, '0');
    days.push(`${y}-${m}-${d}`);
    current.setDate(current.getDate() + 1);
  }
  return days;
}

function computePeeData(diaperEntries) {
  const days = getDayRange(diaperEntries);
  const counts = {};
  days.forEach((d) => (counts[d] = 0));
  diaperEntries.forEach((e) => {
    if (isTruthy(e.pee)) {
      const key = toDateKey(e.time);
      if (key in counts) counts[key]++;
    }
  });
  return days.map((d) => ({ date: formatDateLabel(d), dateKey: d, count: counts[d] }));
}

function computePoopData(diaperEntries) {
  const days = getDayRange(diaperEntries);
  const counts = {};
  days.forEach((d) => (counts[d] = 0));
  diaperEntries.forEach((e) => {
    if (isTruthy(e.poop)) {
      const key = toDateKey(e.time);
      if (key in counts) counts[key]++;
    }
  });
  return days.map((d) => ({ date: formatDateLabel(d), dateKey: d, count: counts[d] }));
}

// Combined diaper dataset: pee + poop counts per day, rendered as two bars
// side-by-side. Used by the unified "טיטול" item in the side panel.
function computeDiaperData(diaperEntries) {
  const days = getDayRange(diaperEntries);
  const peeByDay = {};
  const poopByDay = {};
  days.forEach((d) => { peeByDay[d] = 0; poopByDay[d] = 0; });
  diaperEntries.forEach((e) => {
    const key = toDateKey(e.time);
    if (!(key in peeByDay)) return;
    if (isTruthy(e.pee)) peeByDay[key]++;
    if (isTruthy(e.poop)) poopByDay[key]++;
  });
  return days.map((d) => ({
    date: formatDateLabel(d),
    dateKey: d,
    pee: peeByDay[d],
    poop: poopByDay[d],
  }));
}

function computeFoodData(feedingEntries) {
  const days = getDayRange(feedingEntries);
  const counts = {};
  days.forEach((d) => (counts[d] = 0));
  feedingEntries.forEach((e) => {
    const key = toDateKey(e.time);
    if (key in counts) counts[key]++;
  });
  return days.map((d) => ({ date: formatDateLabel(d), dateKey: d, count: counts[d] }));
}

function computePumpingData(pumpingEntries) {
  const days = getDayRange(pumpingEntries);
  const dayData = {};
  days.forEach((d) => (dayData[d] = { totalMinutes: 0, sessions: 0 }));
  pumpingEntries.forEach((e) => {
    const key = toDateKey(e.time);
    if (!dayData[key]) return;
    dayData[key].totalMinutes += Number(e.durationMinutes) || 0;
    dayData[key].sessions++;
  });
  return days.map((d) => ({
    date: formatDateLabel(d),
    dateKey: d,
    minutes: dayData[d].totalMinutes,
    sessions: dayData[d].sessions,
  }));
}

// Builds an actogram dataset: one row per calendar day for a sliding window
// of `days` days ending `endOffsetDays` days before today (0 = window ends
// today). Each row carries the sleep segments that fall inside that day's
// [00:00, 24:00] window, with positions expressed as fractions of the day so
// a renderer can lay them out on a 24-hour strip. Sessions that cross
// midnight appear in both days' rows. Open sessions (no endTime) are treated
// as ending at `nowMs` and flagged so the renderer can style them.
function computeActogramData(sleepEntries, days, nowMs, endOffsetDays = 0) {
  const todayStart = new Date(nowMs);
  todayStart.setHours(0, 0, 0, 0);
  const windowEndAnchor = new Date(todayStart);
  windowEndAnchor.setDate(windowEndAnchor.getDate() - endOffsetDays);

  const rows = [];
  for (let i = days - 1; i >= 0; i--) {
    const dayStart = new Date(windowEndAnchor);
    dayStart.setDate(windowEndAnchor.getDate() - i);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);

    const segments = [];
    let totalMinutes = 0;

    for (const e of sleepEntries) {
      if (!e?.startTime) continue;
      const s = new Date(e.startTime);
      const en = e.endTime ? new Date(e.endTime) : new Date(nowMs);
      if (en <= s) continue;

      const segStartMs = Math.max(s.getTime(), dayStart.getTime());
      const segEndMs = Math.min(en.getTime(), dayEnd.getTime());
      if (segEndMs <= segStartMs) continue;

      const startFrac = (segStartMs - dayStart.getTime()) / 86_400_000;
      const endFrac = (segEndMs - dayStart.getTime()) / 86_400_000;
      const minutes = Math.round((segEndMs - segStartMs) / 60_000);
      totalMinutes += minutes;
      segments.push({
        startFrac,
        endFrac,
        startMs: segStartMs,
        endMs: segEndMs,
        minutes,
        // Mark the live tail of an open session so the renderer can pulse it.
        isOpen: !e.endTime && segEndMs === Math.min(en.getTime(), dayEnd.getTime()) && en.getTime() <= dayEnd.getTime(),
      });
    }

    segments.sort((a, b) => a.startFrac - b.startFrac);
    rows.push({ dayStart, segments, totalMinutes });
  }

  // Newest day on top.
  return rows.reverse();
}

function formatDurationHM(minutes) {
  const h = Math.floor(minutes / 60);
  const r = minutes % 60;
  if (h === 0) return `${r} דק׳`;
  if (r === 0) return `${h} שע׳`;
  return `${h} שע׳ ${r} דק׳`;
}

const WEEKDAYS_HE = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'];

// Shared layout constants for the single-day actogram so the scroll-to-now
// effect can compute the same coordinates the chart renders at. HOUR_H is
// deliberately generous (1px ≈ 1.2 minutes) so every band has room for its
// duration label inside, even short naps; the chart vertical-scrolls.
const SLEEP_HEADER_H = 16;
const SLEEP_HOUR_H = 50;
const SLEEP_HOURS_H = 24 * SLEEP_HOUR_H;

function SleepActogramChart({ row, nowMs }) {
  // Single-day vertical view. Hours run top→bottom along the left axis,
  // a wide central column holds the sleep bands, and each band carries the
  // duration written inside it. The axis intentionally shows ONLY the
  // start/end times of actual sleep sessions — no generic clock labels —
  // so it reads as a sleep log, not a 24h ruler. Faint dotted gridlines
  // every 3 hours stay in the background for visual orientation.
  const TIME_AXIS_W = 56;
  const DAY_W = 268;
  const VIEW_W = TIME_AXIS_W + DAY_W + 18;

  const HEADER_H = SLEEP_HEADER_H;
  const HOUR_H = SLEEP_HOUR_H;
  const HOURS_H = SLEEP_HOURS_H;
  const FOOTER_H = 16;
  const VIEW_H = HEADER_H + HOURS_H + FOOTER_H;

  const fmtTime = (ms) => {
    const d = new Date(ms);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  const todayStart = new Date(nowMs);
  todayStart.setHours(0, 0, 0, 0);
  const isToday = row.dayStart.getTime() === todayStart.getTime();

  // Build axis transitions from actual session edges. Edges that land
  // exactly at the day boundary (00:00 / 24:00) come from cross-midnight
  // clipping, not real transitions, so suppress them.
  const transitions = [];
  for (const seg of row.segments) {
    if (seg.startFrac > 0.0001) {
      transitions.push({ ms: seg.startMs, frac: seg.startFrac, kind: 'start' });
    }
    if (seg.endFrac < 0.9999) {
      transitions.push({ ms: seg.endMs, frac: seg.endFrac, kind: 'end' });
    }
  }
  transitions.sort((a, b) => a.frac - b.frac);

  // Force-space labels so close-together transitions don't render on top
  // of each other. We track the real Y separately so we can draw a small
  // leader line from the drifted label back to its true position.
  const MIN_LABEL_GAP = 14;
  const labels = [];
  let prevY = -Infinity;
  for (const t of transitions) {
    const realY = HEADER_H + t.frac * HOURS_H;
    const y = realY < prevY + MIN_LABEL_GAP ? prevY + MIN_LABEL_GAP : realY;
    labels.push({ ...t, realY, y });
    prevY = y;
  }

  return (
    <svg
      className="sleep-actogram"
      width={VIEW_W}
      height={VIEW_H}
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      role="img"
      aria-label="גרף שינה — יום בודד"
    >
      <defs>
        <linearGradient id="grad-sleep-v" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#9575cd" stopOpacity={0.95} />
          <stop offset="100%" stopColor="#7e57c2" stopOpacity={0.95} />
        </linearGradient>
      </defs>

      {/* Faint hour gridlines (no labels) every 3 hours for orientation */}
      {[0, 3, 6, 9, 12, 15, 18, 21, 24].map((h) => {
        const y = HEADER_H + h * HOUR_H;
        return (
          <line
            key={h}
            x1={TIME_AXIS_W}
            y1={y}
            x2={TIME_AXIS_W + DAY_W}
            y2={y}
            className="sleep-actogram-grid"
          />
        );
      })}

      {/* Day column background */}
      <rect
        x={TIME_AXIS_W}
        y={HEADER_H}
        width={DAY_W}
        height={HOURS_H}
        rx="8"
        className={`sleep-actogram-track ${isToday ? 'today' : ''}`}
      />

      {/* Empty-day message */}
      {row.segments.length === 0 && (
        <text
          x={TIME_AXIS_W + DAY_W / 2}
          y={HEADER_H + HOURS_H / 2 + 4}
          textAnchor="middle"
          className="sleep-day-empty"
        >
          אין נתוני שינה ביום זה
        </text>
      )}

      {/* Sleep bands with the duration written inside */}
      {row.segments.map((seg, j) => {
        const segY = HEADER_H + seg.startFrac * HOURS_H;
        const segH = Math.max((seg.endFrac - seg.startFrac) * HOURS_H, 4);
        // Use a smaller font for short bands so the label still fits inside
        // (avoids clipping by the scroll container if we put it outside).
        const fitsLarge = segH >= 24;
        const fitsSmall = segH >= 14;
        // Only animate ZZZs on bands tall enough that the float distance
        // stays comfortably inside; tiny naps just get the duration label.
        const showZzz = segH >= 50;
        // Three CSS delay classes give bands different rhythms so the
        // animations don't all pulse in sync across the chart.
        const delayClass = ['zzz-d1', 'zzz-d2', 'zzz-d3'][j % 3];
        const delayClass2 = ['zzz-d1', 'zzz-d2', 'zzz-d3'][(j + 2) % 3];
        return (
          <g key={`seg-${j}`}>
            <rect
              x={TIME_AXIS_W + 4}
              y={segY}
              width={DAY_W - 8}
              height={segH}
              rx="6"
              fill="url(#grad-sleep-v)"
              className={seg.isOpen ? 'sleep-actogram-seg open' : 'sleep-actogram-seg'}
            >
              <title>
                {`${fmtTime(seg.startMs)} → ${fmtTime(seg.endMs)} · ${formatDurationHM(seg.minutes)}`}
              </title>
            </rect>

            {/* Floating ZZZ — purely decorative; signals "this is sleep" */}
            {showZzz && (
              <g pointerEvents="none">
                <text
                  className={`sleep-zzz sleep-zzz-sm ${delayClass}`}
                  x={TIME_AXIS_W + 26}
                  y={segY + segH - 12}
                >
                  z
                </text>
                <text
                  className={`sleep-zzz sleep-zzz-lg ${delayClass2}`}
                  x={TIME_AXIS_W + DAY_W - 28}
                  y={segY + segH - 14}
                >
                  Z
                </text>
              </g>
            )}

            {fitsLarge && (
              <text
                x={TIME_AXIS_W + DAY_W / 2}
                y={segY + segH / 2 + 5}
                textAnchor="middle"
                className="sleep-day-duration"
                pointerEvents="none"
              >
                {formatDurationHM(seg.minutes)}
              </text>
            )}
            {!fitsLarge && fitsSmall && (
              <text
                x={TIME_AXIS_W + DAY_W / 2}
                y={segY + segH / 2 + 4}
                textAnchor="middle"
                className="sleep-day-duration small"
                pointerEvents="none"
              >
                {formatDurationHM(seg.minutes)}
              </text>
            )}
          </g>
        );
      })}

      {/* Awake-duration labels — every gap between consecutive sleep bands
          gets labelled, even short wakings (e.g. a 13-min stir). Layout
          adapts to the gap height:
          - large gap (≥ 28 px)  → centered italic label, regular size
          - medium gap (16–28)   → centered italic label, compact size
          - tiny gap (< 16 px)   → label sits in a small backdrop pill so
                                   it stays legible while overlapping the
                                   adjacent band edges. */}
      {row.segments.slice(0, -1).map((prev, i) => {
        const next = row.segments[i + 1];
        const gapH = (next.startFrac - prev.endFrac) * HOURS_H;
        const gapMinutes = Math.round((next.startMs - prev.endMs) / 60_000);
        if (gapMinutes <= 0) return null;
        const gapMidY = HEADER_H + ((prev.endFrac + next.startFrac) / 2) * HOURS_H;
        const text = `ערה · ${formatDurationHM(gapMinutes)}`;

        if (gapH < 16) {
          return (
            <g key={`awake-${i}`} pointerEvents="none">
              <rect
                x={TIME_AXIS_W + 16}
                y={gapMidY - 8}
                width={DAY_W - 32}
                height={16}
                rx="4"
                className="sleep-day-awake-pill"
              />
              <text
                x={TIME_AXIS_W + DAY_W / 2}
                y={gapMidY + 4}
                textAnchor="middle"
                className="sleep-day-awake compact"
              >
                {text}
              </text>
            </g>
          );
        }

        const sizeClass = gapH < 28 ? 'compact' : '';
        return (
          <text
            key={`awake-${i}`}
            x={TIME_AXIS_W + DAY_W / 2}
            y={gapMidY + 4}
            textAnchor="middle"
            className={`sleep-day-awake ${sizeClass}`}
            pointerEvents="none"
          >
            {text}
          </text>
        );
      })}

      {/* Time-axis labels: only the times sleep starts/ends */}
      {labels.map((lbl, i) => (
        <g key={`tx-${i}`}>
          <line
            x1={TIME_AXIS_W - 4}
            y1={lbl.realY}
            x2={TIME_AXIS_W}
            y2={lbl.realY}
            className="sleep-day-tick"
          />
          {lbl.y !== lbl.realY && (
            <line
              x1={TIME_AXIS_W - 4}
              y1={lbl.realY}
              x2={TIME_AXIS_W - 10}
              y2={lbl.y}
              className="sleep-day-tick-leader"
            />
          )}
          <text
            x={TIME_AXIS_W - 10}
            y={lbl.y + 4}
            textAnchor="end"
            className={`sleep-day-time ${lbl.kind}`}
          >
            {fmtTime(lbl.ms)}
          </text>
        </g>
      ))}

      {/* "Now" indicator on today */}
      {isToday && (() => {
        const nowFrac = (nowMs - todayStart.getTime()) / 86_400_000;
        const ny = HEADER_H + nowFrac * HOURS_H;
        return (
          <g>
            <line
              x1={TIME_AXIS_W - 4}
              y1={ny}
              x2={TIME_AXIS_W + DAY_W + 4}
              y2={ny}
              className="sleep-actogram-now"
            />
            <circle
              cx={TIME_AXIS_W + DAY_W + 4}
              cy={ny}
              r="3.5"
              className="sleep-actogram-now-dot"
            />
          </g>
        );
      })()}
    </svg>
  );
}

// Renders just the chart content (no modal chrome). The parent — currently
// `DetailModal` in SidePanel — provides the surrounding overlay, header and
// close button so a single modal can house both the table and the graph view.
export default function GraphView({
  type,
  diaperEntries = [],
  feedingEntries = [],
  pumpingEntries = [],
  sleepEntries = [],
}) {
  const scrollRef = useRef(null);
  // Snapshot "now" once when the modal opens. The actogram only needs a
  // stable reference for the "now" marker and for the open-session tail;
  // a live-ticking clock isn't useful here and would re-run the memo every
  // second. Using a useState initializer satisfies the purity rule too.
  const [nowMs] = useState(() => Date.now());
  // How many days to slide the actogram view back from today. 0 = today.
  // Steps by 1 day at a time via the ‹/› nav buttons.
  const [actogramOffsetDays, setActogramOffsetDays] = useState(0);

  // `title` is still returned by the memo for parity with other consumers
  // (and to keep this file self-documenting), but the parent modal renders
  // the header now, so we don't pull it out here.
  const { data, summary, actogramNowMs, actogramDayLabel, actogramDayTotal } = useMemo(() => {
    switch (type) {
      case 'pee': {
        const d = computePeeData(diaperEntries);
        const today = todayKey();
        const completed = d.filter((x) => x.dateKey !== today);
        const totalPees = completed.reduce((s, x) => s + x.count, 0);
        const totalDays = completed.length;
        const allDaysHavePees = totalDays > 0 && completed.every((x) => x.count > 0);
        let summaryText;
        if (totalDays === 0) {
          summaryText = 'אין נתונים (ימים שלמים)';
        } else if (allDaysHavePees) {
          summaryText = `ממוצע: ${(totalPees / totalDays).toFixed(1)} פיפי ביום`;
        } else {
          summaryText = `ממוצע: ${((totalPees / totalDays) * 7).toFixed(1)} פיפי בשבוע`;
        }
        return { data: d, title: '💧 גרף פיפי', summary: summaryText };
      }
      case 'poop': {
        const d = computePoopData(diaperEntries);
        const today = todayKey();
        const completed = d.filter((x) => x.dateKey !== today);
        const totalPoops = completed.reduce((s, x) => s + x.count, 0);
        const totalDays = completed.length;
        const allDaysHavePoops = totalDays > 0 && completed.every((x) => x.count > 0);
        let summaryText;
        if (totalDays === 0) {
          summaryText = 'אין נתונים (ימים שלמים)';
        } else if (allDaysHavePoops) {
          summaryText = `ממוצע: ${(totalPoops / totalDays).toFixed(1)} קקי ביום`;
        } else {
          summaryText = `ממוצע: ${((totalPoops / totalDays) * 7).toFixed(1)} קקי בשבוע`;
        }
        return { data: d, title: '💩 גרף קקי', summary: summaryText };
      }
      case 'diaper': {
        const d = computeDiaperData(diaperEntries);
        const today = todayKey();
        const completed = d.filter((x) => x.dateKey !== today);
        const totalPee = completed.reduce((s, x) => s + x.pee, 0);
        const totalPoop = completed.reduce((s, x) => s + x.poop, 0);
        const totalDays = completed.length;
        let summaryText;
        if (totalDays === 0) {
          summaryText = 'אין נתונים (ימים שלמים)';
        } else {
          const avgPee = (totalPee / totalDays).toFixed(1);
          const avgPoop = (totalPoop / totalDays).toFixed(1);
          summaryText = `ממוצע: ${avgPee} פיפי · ${avgPoop} קקי ביום`;
        }
        return { data: d, title: '🚼 גרף טיטול', summary: summaryText };
      }
      case 'food': {
        const d = computeFoodData(feedingEntries);
        const today = todayKey();
        const completed = d.filter((x) => x.dateKey !== today);
        const totalFeedings = completed.reduce((s, x) => s + x.count, 0);
        const totalDays = completed.length;
        const avg = totalDays > 0 ? (totalFeedings / totalDays).toFixed(1) : 0;
        return {
          data: d,
          title: '🍼 גרף האכלות',
          summary: totalDays > 0 ? `ממוצע: ${avg} האכלות ביום` : 'אין נתונים (ימים שלמים)',
        };
      }
      case 'pumping': {
        const d = computePumpingData(pumpingEntries);
        const today = todayKey();
        const completed = d.filter((x) => x.dateKey !== today);
        const totalSessions = completed.reduce((s, x) => s + x.sessions, 0);
        const totalDays = completed.length;
        const avgSessions = totalDays > 0 ? (totalSessions / totalDays).toFixed(1) : 0;
        return {
          data: d,
          title: '🧴 גרף שאיבה',
          summary: totalDays > 0 ? `ממוצע: ${avgSessions} שאיבות ביום` : 'אין נתונים (ימים שלמים)',
        };
      }
      case 'sleep': {
        if (!sleepEntries.length) {
          return { data: [], title: '😴 גרף שינה', summary: '' };
        }
        // Always exactly one day. `computeActogramData` returns an array of
        // 1 row pre-clipped to that day's window, with cross-midnight
        // sessions already split correctly.
        const rows = computeActogramData(sleepEntries, 1, nowMs, actogramOffsetDays);
        const day = rows[0];

        const fmtDate = (d) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
        const dayLabel = `יום ${WEEKDAYS_HE[day.dayStart.getDay()]}׳ ${fmtDate(day.dayStart)}`;

        // Summary now reflects the selected day, since that's what's on
        // screen. Multi-day averages aren't useful when only one day shows.
        const numSessions = day.segments.length;
        const longestMin = numSessions > 0
          ? Math.max(...day.segments.map((s) => s.minutes))
          : 0;
        let summary;
        if (numSessions === 0) {
          summary = 'אין נתוני שינה ביום זה';
        } else {
          const sessionsLabel = numSessions === 1 ? 'נמנום' : 'נמנומים';
          const parts = [
            `סה״כ ${formatDurationHM(day.totalMinutes)}`,
            `${numSessions} ${sessionsLabel}`,
          ];
          if (numSessions > 1) {
            parts.push(`הארוך ${formatDurationHM(longestMin)}`);
          }
          summary = parts.join(' · ');
        }

        return {
          data: rows,
          title: '😴 גרף שינה',
          summary,
          actogramNowMs: nowMs,
          actogramDayLabel: dayLabel,
          // Total sleep for the displayed day (00:00–24:00, midnight-clipped).
          // null when nothing was logged that day — the renderer then hides
          // the chip so an empty value never appears.
          actogramDayTotal: numSessions > 0 ? formatDurationHM(day.totalMinutes) : null,
        };
      }
      default:
        return { data: [], title: '', summary: '' };
    }
  }, [type, diaperEntries, feedingEntries, pumpingEntries, sleepEntries, nowMs, actogramOffsetDays]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    requestAnimationFrame(() => {
      if (type === 'sleep') {
        // Scroll vertically so the current hour-of-day lands roughly in
        // the middle of the visible area — works the same for any day
        // since the y axis is hour-of-day, not calendar date.
        const todayMs0 = new Date(nowMs).setHours(0, 0, 0, 0);
        const nowFrac = (nowMs - todayMs0) / 86_400_000;
        const target = SLEEP_HEADER_H + nowFrac * SLEEP_HOURS_H - el.clientHeight / 2;
        el.scrollTop = Math.max(0, target);
      } else {
        el.scrollLeft = el.scrollWidth;
      }
    });
  }, [data, type, nowMs]);

  const chartWidth = Math.max(data.length * BAR_SPACE, 300);

  const renderChart = () => {
    const cursorStyle = { fill: 'rgba(124, 92, 191, 0.08)' };
    switch (type) {
      case 'pee':
        return (
          <BarChart width={chartWidth} height={CHART_HEIGHT} data={data} margin={CHART_MARGIN}>
            <defs>
              <linearGradient id="grad-pee" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ffc107" stopOpacity={0.95} />
                <stop offset="100%" stopColor="#f9a825" stopOpacity={0.85} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={GRID_STROKE} />
            <XAxis dataKey="date" tick={AXIS_TICK} tickLine={false} axisLine={{ stroke: GRID_STROKE }} />
            <YAxis allowDecimals={false} tick={AXIS_TICK} tickLine={false} axisLine={false} width={32} />
            <Tooltip cursor={cursorStyle} content={<ChartTooltip unit="פיפי" />} />
            <Bar dataKey="count" fill="url(#grad-pee)" radius={[8, 8, 0, 0]} maxBarSize={36} />
          </BarChart>
        );
      case 'poop':
        return (
          <BarChart width={chartWidth} height={CHART_HEIGHT} data={data} margin={CHART_MARGIN}>
            <defs>
              <linearGradient id="grad-poop" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#a98274" stopOpacity={0.95} />
                <stop offset="100%" stopColor="#8d6e63" stopOpacity={0.85} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={GRID_STROKE} />
            <XAxis dataKey="date" tick={AXIS_TICK} tickLine={false} axisLine={{ stroke: GRID_STROKE }} />
            <YAxis allowDecimals={false} tick={AXIS_TICK} tickLine={false} axisLine={false} width={32} />
            <Tooltip cursor={cursorStyle} content={<ChartTooltip unit="קקי" />} />
            <Bar dataKey="count" fill="url(#grad-poop)" radius={[8, 8, 0, 0]} maxBarSize={36} />
          </BarChart>
        );
      case 'diaper':
        return (
          <BarChart width={chartWidth} height={CHART_HEIGHT} data={data} margin={CHART_MARGIN}>
            <defs>
              <linearGradient id="grad-pee-d" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ffc107" stopOpacity={0.95} />
                <stop offset="100%" stopColor="#f9a825" stopOpacity={0.85} />
              </linearGradient>
              <linearGradient id="grad-poop-d" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#a98274" stopOpacity={0.95} />
                <stop offset="100%" stopColor="#8d6e63" stopOpacity={0.85} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={GRID_STROKE} />
            <XAxis dataKey="date" tick={AXIS_TICK} tickLine={false} axisLine={{ stroke: GRID_STROKE }} />
            <YAxis allowDecimals={false} tick={AXIS_TICK} tickLine={false} axisLine={false} width={32} />
            <Tooltip cursor={cursorStyle} content={<ChartTooltip />} />
            <Bar dataKey="pee" name="💧 פיפי" fill="url(#grad-pee-d)" radius={[8, 8, 0, 0]} maxBarSize={26} />
            <Bar dataKey="poop" name="💩 קקי" fill="url(#grad-poop-d)" radius={[8, 8, 0, 0]} maxBarSize={26} />
          </BarChart>
        );
      case 'food':
        return (
          <LineChart width={chartWidth} height={CHART_HEIGHT} data={data} margin={CHART_MARGIN}>
            <defs>
              <linearGradient id="grad-food" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#7c5cbf" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#7c5cbf" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={GRID_STROKE} />
            <XAxis dataKey="date" tick={AXIS_TICK} tickLine={false} axisLine={{ stroke: GRID_STROKE }} />
            <YAxis allowDecimals={false} tick={AXIS_TICK} tickLine={false} axisLine={false} width={32} />
            <Tooltip cursor={{ stroke: '#7c5cbf', strokeWidth: 1, strokeDasharray: '3 3' }} content={<ChartTooltip unit="האכלות" />} />
            <Line
              type="monotone"
              dataKey="count"
              stroke="#7c5cbf"
              strokeWidth={2.5}
              fill="url(#grad-food)"
              dot={{ r: 4, fill: '#fff', stroke: '#7c5cbf', strokeWidth: 2 }}
              activeDot={{ r: 6, fill: '#7c5cbf', stroke: '#fff', strokeWidth: 2 }}
            />
          </LineChart>
        );
      case 'pumping':
        return (
          <BarChart width={chartWidth} height={CHART_HEIGHT} data={data} margin={CHART_MARGIN}>
            <defs>
              <linearGradient id="grad-pumping" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#81c784" stopOpacity={0.95} />
                <stop offset="100%" stopColor="#66bb6a" stopOpacity={0.85} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={GRID_STROKE} />
            <XAxis dataKey="date" tick={AXIS_TICK} tickLine={false} axisLine={{ stroke: GRID_STROKE }} />
            <YAxis unit="׳" allowDecimals={false} tick={AXIS_TICK} tickLine={false} axisLine={false} width={36} />
            <Tooltip cursor={cursorStyle} content={<ChartTooltip unit="דקות" />} />
            <Bar dataKey="minutes" fill="url(#grad-pumping)" radius={[8, 8, 0, 0]} maxBarSize={36} />
          </BarChart>
        );
      case 'sleep':
        return <SleepActogramChart row={data[0]} nowMs={actogramNowMs} />;
      default:
        return null;
    }
  };

  if (data.length === 0) {
    return <p className="no-data">אין נתונים עדיין</p>;
  }

  return (
    <div className="graph-view">
      {type === 'sleep' && (
        <div className="actogram-nav">
          <button
            type="button"
            className="actogram-nav-btn"
            onClick={() => setActogramOffsetDays((o) => o + 1)}
            aria-label="יום קודם"
          >
            ‹
          </button>
          <div className="actogram-nav-info">
            <span className="actogram-nav-range">{actogramDayLabel}</span>
            {actogramDayTotal && (
              <span className="actogram-nav-total">
                <span className="actogram-nav-total-label">סה״כ שינה</span>
                <span className="actogram-nav-total-value">{actogramDayTotal}</span>
              </span>
            )}
          </div>
          <button
            type="button"
            className="actogram-nav-btn"
            onClick={() => setActogramOffsetDays((o) => Math.max(0, o - 1))}
            disabled={actogramOffsetDays === 0}
            aria-label="יום הבא"
          >
            ›
          </button>
        </div>
      )}
      <div
        className={`graph-scroll-container ${type === 'sleep' ? 'graph-scroll-container--vertical' : ''}`}
        ref={scrollRef}
      >
        {renderChart()}
      </div>
      <div className="graph-summary">
        <span className="graph-summary-pill">{summary}</span>
      </div>
    </div>
  );
}
