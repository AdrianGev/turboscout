import React from 'react';
import './StarRating.css';

const StarRating = ({ label, value, onChange, max = 5 }) => {
  return (
    <div className="star-rating">
      <label className="star-label">{label}</label>
      <div className="stars">
        {[...Array(max)].map((_, index) => (
          <button
            key={index}
            className={`star ${index < value ? 'filled' : ''}`}
            onClick={() => onChange(index + 1)}
          >
            ★
          </button>
        ))}
      </div>
    </div>
  );
};

export default StarRating;
