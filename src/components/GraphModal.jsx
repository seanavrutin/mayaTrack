import { useRef, useEffect, useMemo, useState } from 'react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import {
  computeSleepDayWindows,
  computeSleepDayRow,
  SLEEP_PERIOD_DAY,
  SLEEP_PERIOD_NIGHT,
} from '../utils/sleep';

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

// Builds one actogram row for a sleep-day window (wake → next wake). Kept as a
// thin wrapper so GraphView can stay readable; the window math lives in sleep.js.
function computeActogramData(sleepEntries, nowMs, offsetDays = 0) {
  const windows = computeSleepDayWindows(sleepEntries, nowMs);
  if (!windows.length) return [];
  const idx = Math.min(offsetDays, windows.length - 1);
  const window = windows[idx];
  if (!window) return [];
  return [computeSleepDayRow(sleepEntries, window, nowMs)];
}

function formatDurationHM(minutes) {
  const h = Math.floor(minutes / 60);
  const r = minutes % 60;
  if (h === 0) return `${r} דק׳`;
  if (r === 0) return `${h} שע׳`;
  return `${h} שע׳ ${r} דק׳`;
}

// Decimal hours for the totals strip, where three durations share one row and
// equal widths make them easier to compare at a glance.
function formatHoursDecimal(minutes) {
  return `${(minutes / 60).toFixed(1)} שע׳`;
}

const WEEKDAYS_HE = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'];

// Shared layout constants for the single-day actogram so the scroll-to-now
// effect can compute the same coordinates the chart renders at. HOUR_H is
// deliberately generous (1px ≈ 1.2 minutes) so every band has room for its
// duration label inside, even short naps; the chart vertical-scrolls.
const SLEEP_HEADER_H = 16;
const SLEEP_HOUR_H = 50;

function SleepActogramChart({ row, nowMs }) {
  // Single sleep-day vertical view. The strip spans wake→next-wake (day + its
  // night), not a fixed calendar 24h. Hours run top→bottom; day naps and night
  // sleep use different band colors.
  const TIME_AXIS_W = 56;
  const DAY_W = 268;
  const VIEW_W = TIME_AXIS_W + DAY_W + 18;

  const HEADER_H = SLEEP_HEADER_H;
  const HOUR_H = SLEEP_HOUR_H;
  const hoursSpan = Math.max(row.durationMs / 3_600_000, 1);
  const HOURS_H = hoursSpan * HOUR_H;
  const FOOTER_H = 16;
  const VIEW_H = HEADER_H + HOURS_H + FOOTER_H;

  const fmtTime = (ms) => {
    const d = new Date(ms);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  const isCurrent = Boolean(row.isCurrent);

  // Build axis transitions from actual session edges. Edges that land
  // exactly at the window boundary come from clipping, not real transitions.
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

  // The two wakes that bracket this sleep-day. They're window boundaries rather
  // than segment edges, so they need their own labels. Only shown when the edge
  // is a real wake — otherwise it's just the midnight fallback.
  const wakeMarkers = [];
  if (row.startsAtWake) {
    wakeMarkers.push({ ms: row.startMs, frac: 0, kind: 'wake-open' });
  }
  if (row.endsAtWake) {
    wakeMarkers.push({ ms: row.endMs, frac: 1, kind: 'wake-close' });
  }

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

  // Awake stretches: the gaps between consecutive sleep bands, plus the opening
  // stretch from the start of the day to the first sleep, which has no band
  // before it to pair with.
  const awakeGaps = [];
  if (row.segments.length) {
    const first = row.segments[0];
    if (first.startFrac > 0.0001) {
      awakeGaps.push({
        fromFrac: 0,
        toFrac: first.startFrac,
        minutes: Math.round((first.startMs - row.startMs) / 60_000),
      });
    }
    for (let i = 0; i < row.segments.length - 1; i++) {
      const prev = row.segments[i];
      const next = row.segments[i + 1];
      awakeGaps.push({
        fromFrac: prev.endFrac,
        toFrac: next.startFrac,
        minutes: Math.round((next.startMs - prev.endMs) / 60_000),
      });
    }
  }

  // Faint gridlines every ~3 wall-clock hours within the window.
  const gridFracs = [];
  {
    const cursor = new Date(row.startMs);
    cursor.setMinutes(0, 0, 0);
    cursor.setHours(cursor.getHours() + 1);
    while (cursor.getTime() < row.endMs) {
      const h = cursor.getHours();
      if (h % 3 === 0) {
        const frac = (cursor.getTime() - row.startMs) / row.durationMs;
        if (frac > 0.01 && frac < 0.99) gridFracs.push(frac);
      }
      cursor.setHours(cursor.getHours() + 1);
    }
  }

  return (
    <svg
      className="sleep-actogram"
      width={VIEW_W}
      height={VIEW_H}
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      role="img"
      aria-label="גרף שינה — יום ולילה"
    >
      <defs>
        <linearGradient id="grad-sleep-night-v" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#9575cd" stopOpacity={0.95} />
          <stop offset="100%" stopColor="#7e57c2" stopOpacity={0.95} />
        </linearGradient>
        <linearGradient id="grad-sleep-day-v" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#64b5f6" stopOpacity={0.92} />
          <stop offset="100%" stopColor="#42a5f5" stopOpacity={0.92} />
        </linearGradient>
        {/* Never marked day or night — shown neutral rather than assumed */}
        <linearGradient id="grad-sleep-unmarked-v" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#b0a8bf" stopOpacity={0.85} />
          <stop offset="100%" stopColor="#968da8" stopOpacity={0.85} />
        </linearGradient>
      </defs>

      {gridFracs.map((frac, i) => {
        const y = HEADER_H + frac * HOURS_H;
        return (
          <line
            key={`g-${i}`}
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
        className={`sleep-actogram-track ${isCurrent ? 'today' : ''}`}
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
        const fitsLarge = segH >= 24;
        const fitsSmall = segH >= 14;
        const showZzz = segH >= 50;
        const delayClass = ['zzz-d1', 'zzz-d2', 'zzz-d3'][j % 3];
        const delayClass2 = ['zzz-d1', 'zzz-d2', 'zzz-d3'][(j + 2) % 3];
        const periodLabel = seg.period === SLEEP_PERIOD_DAY
          ? 'יום'
          : seg.period === SLEEP_PERIOD_NIGHT ? 'לילה' : 'לא סומן';
        const fill = seg.period === SLEEP_PERIOD_DAY
          ? 'url(#grad-sleep-day-v)'
          : seg.period === SLEEP_PERIOD_NIGHT
            ? 'url(#grad-sleep-night-v)'
            : 'url(#grad-sleep-unmarked-v)';
        return (
          <g key={`seg-${j}`}>
            <rect
              x={TIME_AXIS_W + 4}
              y={segY}
              width={DAY_W - 8}
              height={segH}
              rx="6"
              fill={fill}
              className={seg.isOpen ? 'sleep-actogram-seg open' : 'sleep-actogram-seg'}
            >
              <title>
                {`${periodLabel} · ${fmtTime(seg.startMs)} → ${fmtTime(seg.endMs)} · ${formatDurationHM(seg.minutes)}`}
              </title>
            </rect>

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

      {/* Awake-duration labels in the gaps around the sleep bands */}
      {awakeGaps.map((gap, i) => {
        const gapH = (gap.toFrac - gap.fromFrac) * HOURS_H;
        if (gap.minutes <= 0) return null;
        const gapMidY = HEADER_H + ((gap.fromFrac + gap.toFrac) / 2) * HOURS_H;
        const text = `ערה · ${formatDurationHM(gap.minutes)}`;

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

      {/* The wakes that open and close this sleep-day */}
      {wakeMarkers.map((marker) => {
        const y = HEADER_H + marker.frac * HOURS_H;
        const isOpen = marker.kind === 'wake-open';
        return (
          <g key={marker.kind} pointerEvents="none">
            <line
              x1={TIME_AXIS_W - 6}
              y1={y}
              x2={TIME_AXIS_W + DAY_W + 4}
              y2={y}
              className="sleep-actogram-wake-line"
            />
            <text
              x={TIME_AXIS_W - 10}
              y={isOpen ? y + 12 : y - 5}
              textAnchor="end"
              className="sleep-day-time wake"
            >
              {fmtTime(marker.ms)}
            </text>
            <text
              x={TIME_AXIS_W + DAY_W}
              y={isOpen ? y + 13 : y - 5}
              textAnchor="end"
              className="sleep-day-wake-label"
            >
              {isOpen ? '☀️ התעוררה' : '☀️ התעוררה למחרת'}
            </text>
          </g>
        );
      })}

      {/* "Now" indicator on the current sleep-day */}
      {isCurrent && (() => {
        const nowFrac = (nowMs - row.startMs) / row.durationMs;
        if (nowFrac < 0 || nowFrac > 1) return null;
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
  const {
    data,
    summary,
    actogramNowMs,
    actogramDayLabel,
    actogramDayTotal,
    actogramNightTotal,
    actogramDaytimeTotal,
    actogramWindowCount,
  } = useMemo(() => {
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
          return { data: [], title: '😴 גרף שינה', summary: '', actogramWindowCount: 0 };
        }
        // One sleep-day at a time: wake → next wake (daytime + its night).
        const windows = computeSleepDayWindows(sleepEntries, nowMs);
        const rows = computeActogramData(sleepEntries, nowMs, actogramOffsetDays);
        const day = rows[0];
        if (!day) {
          return { data: [], title: '😴 גרף שינה', summary: '', actogramWindowCount: windows.length };
        }

        const fmtDate = (d) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
        const labelDate = day.labelDate instanceof Date ? day.labelDate : new Date(day.startMs);
        const dayLabel = `יום ${WEEKDAYS_HE[labelDate.getDay()]}׳ ${fmtDate(labelDate)}`;
        const hasSleep = day.segments.length > 0;

        return {
          data: rows,
          title: '😴 גרף שינה',
          summary: '',
          actogramNowMs: nowMs,
          actogramDayLabel: dayLabel,
          actogramDayTotal: hasSleep ? formatHoursDecimal(day.totalMinutes) : null,
          actogramNightTotal: hasSleep ? formatHoursDecimal(day.nightMinutes) : null,
          actogramDaytimeTotal: hasSleep ? formatHoursDecimal(day.dayMinutes) : null,
          actogramWindowCount: windows.length,
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
      if (type === 'sleep' && data[0]) {
        const row = data[0];
        // A finished day reads from its opening wake, so start at the top.
        if (!row.isCurrent) {
          el.scrollTop = 0;
          return;
        }
        // On today, centre "now" but never hide the opening wake above it.
        const hoursH = Math.max(row.durationMs / 3_600_000, 1) * SLEEP_HOUR_H;
        const nowFrac = Math.min(1, Math.max(0, (nowMs - row.startMs) / row.durationMs));
        const target = SLEEP_HEADER_H + nowFrac * hoursH - el.clientHeight / 2;
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
            onClick={() => setActogramOffsetDays((o) => Math.min(o + 1, Math.max(0, (actogramWindowCount || 1) - 1)))}
            disabled={actogramOffsetDays >= Math.max(0, (actogramWindowCount || 1) - 1)}
            aria-label="יום קודם"
          >
            ‹
          </button>
          <div className="actogram-nav-info">
            <span className="actogram-nav-range">{actogramDayLabel}</span>
            {actogramDayTotal && (
              <div className="actogram-totals">
                <div className="actogram-total" title="סה״כ שינת יום">
                  <span className="actogram-total-label" role="img" aria-label="שינת יום">☀️</span>
                  <span className="actogram-total-value">{actogramDaytimeTotal}</span>
                </div>
                <div className="actogram-total" title="סה״כ שינת לילה">
                  <span className="actogram-total-label" role="img" aria-label="שינת לילה">🌙</span>
                  <span className="actogram-total-value">{actogramNightTotal}</span>
                </div>
                <div className="actogram-total main" title="סה״כ שינה">
                  <span className="actogram-total-label">סה״כ</span>
                  <span className="actogram-total-value">{actogramDayTotal}</span>
                </div>
              </div>
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
      {type !== 'sleep' && (
        <div className="graph-summary">
          <span className="graph-summary-pill">{summary}</span>
        </div>
      )}
    </div>
  );
}
