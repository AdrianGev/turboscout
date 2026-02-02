import React, { useState } from 'react';
import TopNav from './components/TopNav';
import Home from './components/Home';
import Scout from './components/Scout';
import Analysis from './components/Analysis';
import './App.css';

function App() {
  const [activeTab, setActiveTab] = useState('Home');

  const handleLogoClick = () => {
    setActiveTab('Home');
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'Home':
        return <Home onNavigate={setActiveTab} />;
      case 'Scout':
        return <Scout />;
      case 'Analysis':
        return <Analysis />;
      case 'Settings':
        return (
          <div className="settings-page">
            <div className="settings-card">
              <h2>Settings</h2>
              <p>Settings panel coming soon...</p>
            </div>
          </div>
        );
      default:
        return <Home onNavigate={setActiveTab} />;
    }
  };

  return (
    <div className="App">
      <TopNav 
        activeTab={activeTab} 
        onTabChange={setActiveTab}
        onLogoClick={handleLogoClick}
      />
      <main className="main-content">
        {renderContent()}
      </main>
    </div>
  );
}

export default App;