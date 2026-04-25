import { useRef, useEffect, useMemo } from 'react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';

const BAR_SPACE = 55;
const CHART_HEIGHT = 260;
const CHART_MARGIN = { top: 16, right: 12, left: 4, bottom: 8 };
const AXIS_TICK = { fontSize: 11, fill: '#8b7a9e' };
const GRID_STROKE = '#ece4f7';

function ChartTooltip({ active, payload, label, unit }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip-label">{label}</div>
      <div className="chart-tooltip-value">
        {payload[0].value}
        {unit ? ` ${unit}` : ''}
      </div>
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

export default function GraphModal({
  type,
  diaperEntries = [],
  feedingEntries = [],
  pumpingEntries = [],
  onClose,
}) {
  const scrollRef = useRef(null);

  const { data, title, summary } = useMemo(() => {
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
      default:
        return { data: [], title: '', summary: '' };
    }
  }, [type, diaperEntries, feedingEntries, pumpingEntries]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) {
      requestAnimationFrame(() => {
        el.scrollLeft = el.scrollWidth;
      });
    }
  }, [data]);

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
      default:
        return null;
    }
  };

  return (
    <>
      <div className="modal-overlay" onClick={onClose} />
      <div className="modal graph-modal">
        <div className="modal-header">
          <h2>{title}</h2>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          {data.length === 0 ? (
            <p className="no-data">אין נתונים עדיין</p>
          ) : (
            <>
              <div className="graph-scroll-container" ref={scrollRef}>
                {renderChart()}
              </div>
              <div className="graph-summary">
                <span className="graph-summary-pill">{summary}</span>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
