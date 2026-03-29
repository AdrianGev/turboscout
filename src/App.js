import React, { useState, useEffect } from 'react';
import TopNav from './components/TopNav';
import Home from './components/Home';
import Scout from './components/Scout';
import Analysis from './components/Analysis';
import Predict from './components/Predict';
import Stash from './components/Stash';
import Settings from './components/Settings';
import { loadTheme } from './utils/theme';
import './App.css';

function App() {
  const [activeTab, setActiveTab] = useState('Home');

  useEffect(() => {
    loadTheme();
  }, []);

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
      case 'Predict':
        return <Predict />;
      case 'Stash':
        return <Stash />;
      case 'Settings':
        return <Settings />;
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