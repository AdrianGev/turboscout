import React from 'react';
import './ToggleButton.css';

const ToggleButton = ({ label, value, onChange }) => {
  return (
    <div className="toggle-button-container">
      <label className="toggle-label">{label}</label>
      <button
        className={`toggle-btn ${value ? 'active' : ''}`}
        onClick={() => onChange(!value)}
      >
        {value ? '✓' : ''}
      </button>
    </div>
  );
};

export default ToggleButton;
