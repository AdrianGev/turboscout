import React from 'react';
import './ChipSelect.css';

const ChipSelect = ({ label, options, selectedValues, onChange, multiSelect = false }) => {
  const handleChipClick = (value) => {
    if (multiSelect) {
      const newValues = selectedValues.includes(value)
        ? selectedValues.filter(v => v !== value)
        : [...selectedValues, value];
      onChange(newValues);
    } else {
      onChange(selectedValues === value ? null : value);
    }
  };

  return (
    <div className="chip-select">
      {label && <label className="chip-label">{label}</label>}
      <div className="chips-container">
        {options.map(option => (
          <button
            key={option}
            className={`chip ${
              multiSelect 
                ? selectedValues.includes(option) ? 'selected' : ''
                : selectedValues === option ? 'selected' : ''
            }`}
            onClick={() => handleChipClick(option)}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
};

export default ChipSelect;
