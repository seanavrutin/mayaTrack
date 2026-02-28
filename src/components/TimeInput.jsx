import { useState, useRef, useEffect, useCallback } from 'react';

function padTwo(n) {
  return String(n).padStart(2, '0');
}

function toDateStr(d) {
  return `${d.getFullYear()}-${padTwo(d.getMonth() + 1)}-${padTwo(d.getDate())}`;
}

function toHebrewDate(d) {
  const day = d.getDate();
  const month = d.toLocaleDateString('he-IL', { month: 'long' });
  const weekday = d.toLocaleDateString('he-IL', { weekday: 'long' });
  return `${weekday}, ${day} ${month}`;
}

export default function TimeInput({ value, onChange }) {
  const [editingTime, setEditingTime] = useState(false);
  const [editingDate, setEditingDate] = useState(false);
  const timeRef = useRef(null);
  const dateRef = useRef(null);
  const intervalRef = useRef(null);
  const timeoutRef = useRef(null);
  const repeatedRef = useRef(false);
  const valueRef = useRef(value);
  valueRef.current = value;

  const hours = value.getHours();
  const minutes = value.getMinutes();
  const timeStr = `${padTwo(hours)}:${padTwo(minutes)}`;
  const dateStr = toDateStr(value);

  useEffect(() => {
    if (editingTime && timeRef.current) timeRef.current.focus();
  }, [editingTime]);

  useEffect(() => {
    if (editingDate && dateRef.current) dateRef.current.showPicker?.();
  }, [editingDate]);

  const stopRepeat = useCallback(() => {
    clearTimeout(timeoutRef.current);
    clearInterval(intervalRef.current);
    timeoutRef.current = null;
    intervalRef.current = null;
  }, []);

  useEffect(() => stopRepeat, [stopRepeat]);

  const addMinutes = (delta) => {
    const d = new Date(valueRef.current);
    d.setMinutes(d.getMinutes() + delta);
    onChange(d);
  };

  const startRepeat = (delta) => {
    repeatedRef.current = false;
    stopRepeat();
    timeoutRef.current = setTimeout(() => {
      repeatedRef.current = true;
      intervalRef.current = setInterval(() => addMinutes(delta), 80);
    }, 400);
  };

  const handleClick = (delta) => {
    if (repeatedRef.current) return;
    addMinutes(delta);
  };

  const btnProps = (delta) => ({
    onPointerDown: () => startRepeat(delta),
    onPointerUp: stopRepeat,
    onPointerLeave: stopRepeat,
    onClick: () => handleClick(delta),
  });

  const handleTimeChange = (e) => {
    const [h, m] = e.target.value.split(':').map(Number);
    if (!isNaN(h) && !isNaN(m)) {
      const d = new Date(value);
      d.setHours(h, m, 0, 0);
      onChange(d);
    }
    setEditingTime(false);
  };

  const handleDateChange = (e) => {
    const [y, mo, da] = e.target.value.split('-').map(Number);
    if (!isNaN(y) && !isNaN(mo) && !isNaN(da)) {
      const d = new Date(value);
      d.setFullYear(y, mo - 1, da);
      onChange(d);
    }
    setEditingDate(false);
  };

  return (
    <div className="time-input">
      {/* Date row */}
      <div className="date-row">
        <label>📅 תאריך</label>
        {editingDate ? (
          <input
            ref={dateRef}
            className="date-input-field"
            type="date"
            defaultValue={dateStr}
            onChange={handleDateChange}
            onBlur={() => setEditingDate(false)}
          />
        ) : (
          <span className="date-display" onClick={() => setEditingDate(true)}>
            {toHebrewDate(value)}
          </span>
        )}
      </div>

      {/* Time row */}
      <label>🕐 שעה</label>
      <div className="stepper-controls">
        <button type="button" {...btnProps(-1)}>−</button>
        {editingTime ? (
          <input
            ref={timeRef}
            className="time-input-field"
            type="time"
            defaultValue={timeStr}
            onChange={handleTimeChange}
            onBlur={() => setEditingTime(false)}
          />
        ) : (
          <span className="time-display" onDoubleClick={() => setEditingTime(true)}>
            {timeStr}
          </span>
        )}
        <button type="button" {...btnProps(1)}>+</button>
      </div>
    </div>
  );
}
