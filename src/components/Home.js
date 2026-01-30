import React from 'react';
import './Home.css';

const IslandTile = ({ title, subtitle, buttonText, onClick }) => (
  <div className="island-tile">
    <h3 className="tile-title">{title}</h3>
    <p className="tile-subtitle">{subtitle}</p>
    <button className="tile-button primary" onClick={onClick}>
      {buttonText}
    </button>
  </div>
);

const Home = ({ onNavigate }) => {
  return (
    <div className="home-page">
      <div className="island-card">
        <div className="island-header">
          <h2>Welcome to TurboScout</h2>
          <p className="island-subtitle">Your Ultimate FRC Scouting Assistant</p>
        </div>
        <div className="tiles-container">
          <IslandTile
            title="Scout Matches"
            subtitle="Record match data and team performance in real-time with our intuitive scouting form."
            buttonText="Start Scouting"
            onClick={() => onNavigate('Scout')}
          />
          <IslandTile
            title="Analysis"
            subtitle="Analyze team performance data with powerful visualization tools and statistics."
            buttonText="View Analysis"
            onClick={() => onNavigate('Analysis')}
          />
        </div>
      </div>
    </div>
  );
};

export default Home;
