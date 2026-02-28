import { useState, useRef, useEffect, useCallback } from 'react';

export default function NumberStepper({ value, onChange, step = 1, min = 0, label, unit }) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(String(value));
  const inputRef = useRef(null);
  const intervalRef = useRef(null);
  const timeoutRef = useRef(null);
  const repeatedRef = useRef(false);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.select();
    }
  }, [editing]);

  const stopRepeat = useCallback(() => {
    clearTimeout(timeoutRef.current);
    clearInterval(intervalRef.current);
    timeoutRef.current = null;
    intervalRef.current = null;
  }, []);

  useEffect(() => stopRepeat, [stopRepeat]);

  const startRepeat = (delta) => {
    repeatedRef.current = false;
    stopRepeat();
    timeoutRef.current = setTimeout(() => {
      repeatedRef.current = true;
      intervalRef.current = setInterval(() => {
        onChange((prev) => Math.max(min, prev + delta));
      }, 80);
    }, 400);
  };

  const handleClick = (delta) => {
    if (repeatedRef.current) return;
    onChange(Math.max(min, value + delta));
  };

  const handleDoubleClick = () => {
    setEditValue(String(value));
    setEditing(true);
  };

  const commitEdit = () => {
    const num = Number(editValue);
    if (!isNaN(num)) {
      onChange(Math.max(min, num));
    }
    setEditing(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') commitEdit();
    else if (e.key === 'Escape') setEditing(false);
  };

  const btnProps = (delta) => ({
    onPointerDown: () => startRepeat(delta),
    onPointerUp: stopRepeat,
    onPointerLeave: stopRepeat,
    onClick: () => handleClick(delta),
  });

  return (
    <div className="number-stepper">
      {label && <label>{label}</label>}
      <div className="stepper-controls">
        <button type="button" {...btnProps(-step)}>−</button>
        {editing ? (
          <input
            ref={inputRef}
            className="stepper-input"
            type="number"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={handleKeyDown}
          />
        ) : (
          <span className="stepper-value" onDoubleClick={handleDoubleClick}>
            {value}{unit ? ` ${unit}` : ''}
          </span>
        )}
        <button type="button" {...btnProps(step)}>+</button>
      </div>
    </div>
  );
}
