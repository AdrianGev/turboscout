import React, { useState, useEffect } from 'react';
import './Settings.css';

const Settings = () => {
  const [darkMode, setDarkMode] = useState(false);
  const [showClearModal, setShowClearModal] = useState(false);

  useEffect(() => {
    const savedDarkMode = localStorage.getItem('turboscout-dark-mode');
    if (savedDarkMode) {
      const isDarkMode = JSON.parse(savedDarkMode);
      setDarkMode(isDarkMode);
      applyDarkMode(isDarkMode);
    }
  }, []);

  const applyDarkMode = (isDark) => {
    if (isDark) {
      document.body.classList.add('dark-mode');
    } else {
      document.body.classList.remove('dark-mode');
    }
  };

  const handleDarkModeToggle = () => {
    const newDarkMode = !darkMode;
    setDarkMode(newDarkMode);
    localStorage.setItem('turboscout-dark-mode', JSON.stringify(newDarkMode));
    applyDarkMode(newDarkMode);
  };

  const handleClearCache = () => {
    setShowClearModal(true);
  };

  const handleConfirmClear = () => {
    localStorage.clear();
    window.location.reload();
  };

  const handleCancelClear = () => {
    setShowClearModal(false);
  };

  return (
    <div className="settings-page">
      <div className="settings-card">
        <h2>Settings</h2>
        
        <div className="settings-section">
          <div className="setting-item">
            <div className="setting-info">
              <h3>Dark Mode</h3>
              <p>Switch between light and dark themes</p>
            </div>
            <div className="setting-control">
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={darkMode}
                  onChange={handleDarkModeToggle}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>
          </div>
        </div>
        
        <div className="settings-section">
          <div className="setting-item">
            <div className="setting-info">
              <h3>Clear Cache</h3>
              <p>Clear all stored data and refresh the app</p>
            </div>
            <div className="setting-control">
              <button className="clear-cache-btn" onClick={handleClearCache}>
                Clear Cache
              </button>
            </div>
          </div>
        </div>
      </div>
      
      {showClearModal && (
        <div className="modal-overlay" onClick={handleCancelClear}>
          <div className="clear-modal" onClick={(e) => e.stopPropagation()}>
            <div className="clear-modal-header">
              <h2>Clear Cache</h2>
            </div>
            <div className="clear-modal-content">
              <p>Are you sure you want to clear all cached data?</p>
              <p>This will remove all stored settings, team data, and refresh the application.</p>
            </div>
            <div className="clear-modal-actions">
              <button className="btn secondary" onClick={handleCancelClear}>
                Cancel
              </button>
              <button className="btn danger" onClick={handleConfirmClear}>
                Clear Cache
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;
