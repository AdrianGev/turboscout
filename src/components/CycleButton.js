import React from 'react';
import './CycleButton.css';

const CycleButton = ({ label, value, options, onChange }) => {
  const handleClick = () => {
    const currentIndex = options.indexOf(value);
    const nextIndex = (currentIndex + 1) % options.length;
    onChange(options[nextIndex]);
  };

  return (
    <div className="cycle-button-container">
      <label className="cycle-label">{label}</label>
      <button
        className="cycle-btn"
        onClick={handleClick}
      >
        {value}
      </button>
    </div>
  );
};

export default CycleButton;
