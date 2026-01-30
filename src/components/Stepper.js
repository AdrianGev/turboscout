import React from 'react';
import './Stepper.css';

const Stepper = ({ label, value, onChange, min = 0, max = 10 }) => {
  return (
    <div className="stepper">
      <label className="stepper-label">{label}</label>
      <div className="stepper-controls">
        <button
          className="stepper-btn"
          onClick={() => onChange(Math.max(min, value - 1))}
          disabled={value <= min}
        >
          -
        </button>
        <span className="stepper-value">{value}</span>
        <button
          className="stepper-btn"
          onClick={() => onChange(Math.min(max, value + 1))}
          disabled={value >= max}
        >
          +
        </button>
      </div>
    </div>
  );
};

export default Stepper;
