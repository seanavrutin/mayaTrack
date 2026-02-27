import { useState, useRef, useEffect } from 'react';

export default function NumberStepper({ value, onChange, step = 1, min = 0, label, unit }) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(String(value));
  const inputRef = useRef(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.select();
    }
  }, [editing]);

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

  return (
    <div className="number-stepper">
      {label && <label>{label}</label>}
      <div className="stepper-controls">
        <button type="button" onClick={() => onChange(Math.max(min, value - step))}>−</button>
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
        <button type="button" onClick={() => onChange(value + step)}>+</button>
      </div>
    </div>
  );
}
