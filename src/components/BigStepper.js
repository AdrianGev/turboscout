import React from 'react';
import './BigStepper.css';

const BigStepper = ({ label, value, onChange, increment = 1, min = 0, max = 1000 }) => {
  return (
    <div className="big-stepper">
      <label className="big-stepper-label">{label}</label>
      <div className="big-stepper-value">{value}</div>
      <div className="big-stepper-controls">
        <div className="main-button-group">
          <button
            className="big-stepper-btn minus"
            onClick={() => onChange(Math.max(min, value - increment))}
            disabled={value <= min}
          >
            -{increment}
          </button>
          <div className="small-buttons-row">
            <button
              className="small-stepper-btn minus"
              onClick={() => onChange(Math.max(min, value - 1))}
              disabled={value <= min}
            >
              -1
            </button>
            <button
              className="small-stepper-btn minus"
              onClick={() => onChange(Math.max(min, value - 2))}
              disabled={value <= min + 1}
            >
              -2
            </button>
          </div>
        </div>
        <div className="main-button-group">
          <button
            className="big-stepper-btn plus"
            onClick={() => onChange(Math.min(max, value + increment))}
            disabled={value >= max}
          >
            +{increment}
          </button>
          <div className="small-buttons-row">
            <button
              className="small-stepper-btn plus"
              onClick={() => onChange(Math.min(max, value + 1))}
              disabled={value >= max}
            >
              +1
            </button>
            <button
              className="small-stepper-btn plus"
              onClick={() => onChange(Math.min(max, value + 2))}
              disabled={value >= max - 1}
            >
              +2
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BigStepper;