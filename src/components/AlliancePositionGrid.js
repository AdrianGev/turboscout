import React from 'react';
import './AlliancePositionGrid.css';

const AlliancePositionGrid = ({ selectedPosition, onPositionChange }) => {
  const bluePositions = ['B1', 'B2', 'B3'];
  const redPositions = ['R1', 'R2', 'R3'];

  return (
    <div className="alliance-position-grid">
      <div className="alliance-group">
        <h4 className="alliance-header blue">Blue</h4>
        <div className="position-buttons">
          {bluePositions.map(position => (
            <button
              key={position}
              className={`position-btn ${selectedPosition === position ? 'selected' : ''}`}
              onClick={() => onPositionChange(position)}
            >
              {position}
            </button>
          ))}
        </div>
      </div>
      <div className="alliance-group">
        <h4 className="alliance-header red">Red</h4>
        <div className="position-buttons">
          {redPositions.map(position => (
            <button
              key={position}
              className={`position-btn ${selectedPosition === position ? 'selected' : ''}`}
              onClick={() => onPositionChange(position)}
            >
              {position}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AlliancePositionGrid;
