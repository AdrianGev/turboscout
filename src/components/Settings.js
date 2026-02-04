import React, { useState, useEffect } from 'react';
import './Settings.css';

const Settings = () => {
  const [darkMode, setDarkMode] = useState(false);

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
              <h3>More Settings</h3>
              <p>Additional settings coming soon...</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
