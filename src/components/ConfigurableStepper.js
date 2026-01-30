import React from 'react';
import './ConfigurableStepper.css';

const ConfigurableStepper = ({ label, value, onChange, increment = 1, min = 0, max = 100 }) => {
  return (
    <div className="configurable-stepper">
      <label className="stepper-label">{label}</label>
      <div className="stepper-controls">
        <button
          className="stepper-btn large"
          onClick={() => onChange(Math.max(min, value - increment))}
          disabled={value <= min}
        >
          -{increment}
        </button>
        <span className="stepper-value">{value}</span>
        <button
          className="stepper-btn large"
          onClick={() => onChange(Math.min(max, value + increment))}
          disabled={value >= max}
        >
          +{increment}
        </button>
      </div>
    </div>
  );
};

export default ConfigurableStepper;
