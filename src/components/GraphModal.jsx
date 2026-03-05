import { useRef, useEffect, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';

const BAR_SPACE = 55;
const CHART_HEIGHT = 250;
const CHART_MARGIN = { top: 10, right: 10, left: 0, bottom: 5 };

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
  const dayData = {};
  days.forEach((d) => (dayData[d] = { formula: 0, breast: 0, meals: 0 }));
  feedingEntries.forEach((e) => {
    const key = toDateKey(e.time);
    if (!dayData[key]) return;
    const f = Number(e.formula) || 0;
    const b = Number(e.pumpedMilk) || 0;
    if (f > 0 || b > 0) {
      dayData[key].formula += f;
      dayData[key].breast += b;
      dayData[key].meals++;
    }
  });
  return days.map((d) => {
    const { formula, breast, meals } = dayData[d];
    const total = formula + breast;
    const avgPerMeal = meals > 0 ? total / meals : 0;
    const formulaPct = total > 0 ? formula / total : 0;
    const breastPct = total > 0 ? breast / total : 0;
    return {
      date: formatDateLabel(d),
      dateKey: d,
      formulaPart: Math.round(avgPerMeal * formulaPct),
      breastPart: Math.round(avgPerMeal * breastPct),
      meals,
    };
  });
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

function FoodTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const formula = payload.find((p) => p.dataKey === 'formulaPart')?.value ?? 0;
  const breast = payload.find((p) => p.dataKey === 'breastPart')?.value ?? 0;
  const meals = payload[0]?.payload?.meals ?? 0;
  return (
    <div className="graph-tooltip">
      <p className="graph-tooltip-label">{label}</p>
      <p>{meals} ארוחות</p>
      <p>ממוצע לארוחה: {formula + breast} מ״ל</p>
      {formula > 0 && <p style={{ color: '#f06292' }}>תמ״ל: {formula} מ״ל</p>}
      {breast > 0 && <p style={{ color: '#7c5cbf' }}>חלב אם: {breast} מ״ל</p>}
    </div>
  );
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
        const totalMeals = completed.reduce((s, x) => s + x.meals, 0);
        const totalDays = completed.length;
        const avgMeals = totalDays > 0 ? (totalMeals / totalDays).toFixed(1) : 0;
        let totalFormula = 0, totalBreast = 0;
        feedingEntries.forEach((e) => {
          if (toDateKey(e.time) === today) return;
          totalFormula += Number(e.formula) || 0;
          totalBreast += Number(e.pumpedMilk) || 0;
        });
        const totalMl = totalFormula + totalBreast;
        const formulaPct = totalMl > 0 ? Math.round((totalFormula / totalMl) * 100) : 0;
        const breastPct = totalMl > 0 ? 100 - formulaPct : 0;
        let summaryText;
        if (totalDays === 0) {
          summaryText = 'אין נתונים (ימים שלמים)';
        } else {
          summaryText = `ממוצע: ${avgMeals} ארוחות ביום`;
          if (totalMl > 0) {
            summaryText += `\nתמ״ל ${formulaPct}% | חלב אם ${breastPct}%`;
          }
        }
        return {
          data: d,
          title: '🍼 גרף אוכל',
          summary: summaryText,
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
    switch (type) {
      case 'pee':
        return (
          <BarChart width={chartWidth} height={CHART_HEIGHT} data={data} margin={CHART_MARGIN}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 12 }} />
            <YAxis allowDecimals={false} tick={{ fontSize: 12 }} width={35} />
            <Tooltip formatter={(val) => [`${val}`, 'פיפי']} />
            <Bar dataKey="count" fill="#f9a825" radius={[4, 4, 0, 0]} />
          </BarChart>
        );
      case 'poop':
        return (
          <BarChart width={chartWidth} height={CHART_HEIGHT} data={data} margin={CHART_MARGIN}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 12 }} />
            <YAxis allowDecimals={false} tick={{ fontSize: 12 }} width={35} />
            <Tooltip formatter={(val) => [`${val}`, 'קקי']} />
            <Bar dataKey="count" fill="#8d6e63" radius={[4, 4, 0, 0]} />
          </BarChart>
        );
      case 'food':
        return (
          <BarChart width={chartWidth} height={CHART_HEIGHT} data={data} margin={CHART_MARGIN}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 12 }} />
            <YAxis unit=" מ״ל" tick={{ fontSize: 11 }} width={50} />
            <Tooltip content={<FoodTooltip />} />
            <Bar dataKey="formulaPart" stackId="food" fill="#f06292" />
            <Bar dataKey="breastPart" stackId="food" fill="#7c5cbf" radius={[4, 4, 0, 0]} />
          </BarChart>
        );
      case 'pumping':
        return (
          <BarChart width={chartWidth} height={CHART_HEIGHT} data={data} margin={CHART_MARGIN}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 12 }} />
            <YAxis unit="׳" allowDecimals={false} tick={{ fontSize: 12 }} width={40} />
            <Tooltip formatter={(val) => [`${val} דקות`, 'שאיבה']} />
            <Bar dataKey="minutes" fill="#66bb6a" radius={[4, 4, 0, 0]} />
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
              {type === 'food' && (
                <div className="graph-legend">
                  <span className="legend-item">
                    <span className="legend-dot" style={{ background: '#f06292' }} />
                    תמ״ל
                  </span>
                  <span className="legend-item">
                    <span className="legend-dot" style={{ background: '#7c5cbf' }} />
                    חלב אם
                  </span>
                </div>
              )}
              <p className="graph-summary">{summary}</p>
            </>
          )}
        </div>
      </div>
    </>
  );
}
