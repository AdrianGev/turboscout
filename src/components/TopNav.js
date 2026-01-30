import React from 'react';
import './TopNav.css';

const TopNav = ({ activeTab, onTabChange, onLogoClick }) => {
  const tabs = ['Home', 'Scout', 'Analysis', 'Settings'];

  return (
    <div className="top-nav">
      <div className="nav-container">
        <div className="nav-left">
          <div className="logo-section" onClick={onLogoClick}>
            <div className="logo-icon">
              <i className="bi bi-robot me-2"></i>
            </div>
            <span className="wordmark">TurboScout</span>
          </div>
        </div>
        <div className="nav-center">
          {tabs.map(tab => (
            <button
              key={tab}
              className={`nav-tab ${activeTab === tab ? 'active' : ''}`}
              onClick={() => onTabChange(tab)}
            >
              {tab}
            </button>
          ))}
        </div>
        <div className="nav-right">
          {/* Removed dropdowns - clean interface */}
        </div>
      </div>
    </div>
  );
};

export default TopNav;
