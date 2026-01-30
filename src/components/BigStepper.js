import React from 'react';
import './BigStepper.css';

const BigStepper = ({ label, value, onChange, increment = 1, min = 0, max = 100 }) => {
  return (
    <div className="big-stepper">
      <label className="big-stepper-label">{label}</label>
      <div className="big-stepper-value">{value}</div>
      <div className="big-stepper-controls">
        <button
          className="big-stepper-btn minus"
          onClick={() => onChange(Math.max(min, value - increment))}
          disabled={value <= min}
        >
          -{increment}
        </button>
        <button
          className="big-stepper-btn plus"
          onClick={() => onChange(Math.min(max, value + increment))}
          disabled={value >= max}
        >
          +{increment}
        </button>
      </div>
    </div>
  );
};

export default BigStepper;
