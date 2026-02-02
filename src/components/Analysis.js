import React, { useState, useEffect, useCallback } from 'react';
import './Analysis.css';

const Analysis = () => {
  const [csvUrl, setCsvUrl] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [teamStats, setTeamStats] = useState([]);
  const [picklist, setPicklist] = useState([]);
  const [refreshTimer, setRefreshTimer] = useState(null);

  // Load saved CSV URL from localStorage on mount
  useEffect(() => {
    const savedUrl = localStorage.getItem('turboscout-csv-url');
    if (savedUrl) {
      setCsvUrl(savedUrl);
      setIsConnected(true);
      fetchAndParseData(savedUrl);
    }
  }, []);

  // Parse CSV data and calculate stats
  const parseCSVData = (csvText) => {
    const lines = csvText.trim().split('\n');
    if (lines.length < 2) return [];

    // Proper CSV parsing that handles quoted fields
    const parseCSVLine = (line) => {
      const result = [];
      let current = '';
      let inQuotes = false;
      
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          result.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      result.push(current.trim());
      return result;
    };

    const headers = parseCSVLine(lines[0]);
    console.log('CSV Headers:', headers);
    
    const rows = lines.slice(1).map(line => {
      const values = parseCSVLine(line);
      const row = {};
      headers.forEach((header, index) => {
        row[header] = values[index] || '';
      });
      return row;
    });

    console.log('First row data:', rows[0]);

    // Debug: Show all available columns
    console.log('Available columns:', Object.keys(rows[0] || {}));
    
    // Group by team and calculate stats
    const teamData = {};
    rows.forEach((row, index) => {
      const team = row['Team'];
      
      // Try different possible column names and log what we find
      const totalScore = parseFloat(row['Total Score'] || row['total_score'] || row['Total_Score'] || 0);
      const autoScore = parseFloat(row['Auto Pts'] || row['auto_pts'] || row['Auto_Pts'] || 0);
      const teleScore = parseFloat(row['Teleop Pts'] || row['teleop_pts'] || row['Teleop_Pts'] || 0);
      const endgameScore = parseFloat(row['Endgame Pts'] || row['endgame_pts'] || row['Endgame_Pts'] || 0);
      
      if (index < 3) { // Only log first 3 rows to avoid spam
        console.log(`Row ${index} - Team ${team}:`);
        console.log('  Raw row data:', row);
        console.log(`  Parsed - Total=${totalScore}, Auto=${autoScore}, Tele=${teleScore}, End=${endgameScore}`);
      }

      if (!team) return;

      if (!teamData[team]) {
        teamData[team] = {
          team,
          matches: [],
          totalScores: [],
          autoScores: [],
          teleScores: [],
          endgameScores: []
        };
      }

      teamData[team].matches.push(row);
      teamData[team].totalScores.push(totalScore);
      teamData[team].autoScores.push(autoScore);
      teamData[team].teleScores.push(teleScore);
      teamData[team].endgameScores.push(endgameScore);
    });

    // Calculate statistics for each team
    const stats = Object.values(teamData).map(team => {
      const totalScores = team.totalScores.filter(s => !isNaN(s) && s >= 0);
      const autoScores = team.autoScores.filter(s => !isNaN(s) && s >= 0);
      const teleScores = team.teleScores.filter(s => !isNaN(s) && s >= 0);
      const endgameScores = team.endgameScores.filter(s => !isNaN(s) && s >= 0);

      const avg = arr => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
      const stdDev = arr => {
        if (arr.length < 2) return 0;
        const mean = avg(arr);
        const variance = arr.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / arr.length;
        return Math.sqrt(variance);
      };

      return {
        team: team.team,
        matches: team.matches.length,
        avgTotal: avg(totalScores),
        maxTotal: Math.max(...totalScores, 0),
        minTotal: Math.min(...totalScores, 0),
        stdDev: stdDev(totalScores),
        autoAvg: avg(autoScores),
        teleAvg: avg(teleScores),
        endgameAvg: avg(endgameScores)
      };
    });

    // Sort by average total score descending
    return stats.sort((a, b) => b.avgTotal - a.avgTotal);
  };

  // Fetch and parse CSV data
  const fetchAndParseData = useCallback(async (url) => {
    if (!url) {
      console.log('No URL provided to fetchAndParseData');
      return;
    }
    
    console.log('Fetching data from URL:', url);
    setIsLoading(true);
    setError('');
    
    try {
      const response = await fetch(url);
      console.log('Fetch response status:', response.status);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch data: ${response.status} ${response.statusText}`);
      }
      
      const csvText = await response.text();
      console.log('CSV text length:', csvText.length);
      console.log('First 200 chars of CSV:', csvText.substring(0, 200));
      
      const stats = parseCSVData(csvText);
      console.log('Parsed stats:', stats);
      
      setTeamStats(stats);
      setLastUpdated(new Date());
      
      if (stats.length === 0) {
        setError('No valid team data found in CSV');
      }
    } catch (err) {
      setError(`Error loading data: ${err.message}`);
      console.error('CSV fetch error:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Connect to CSV URL
  const handleConnect = () => {
    if (!csvUrl.trim()) {
      setError('Please enter a CSV URL');
      return;
    }
    
    localStorage.setItem('turboscout-csv-url', csvUrl);
    setIsConnected(true);
    fetchAndParseData(csvUrl);
  };

  // Refresh data
  const handleRefresh = () => {
    if (csvUrl) {
      fetchAndParseData(csvUrl);
    }
  };

  // Disconnect
  const handleDisconnect = () => {
    localStorage.removeItem('turboscout-csv-url');
    setCsvUrl('');
    setIsConnected(false);
    setTeamStats([]);
    setLastUpdated(null);
    setError('');
  };

  // Toggle team in picklist
  const togglePicklist = (team) => {
    setPicklist(prev => {
      if (prev.includes(team)) {
        return prev.filter(t => t !== team);
      } else {
        return [...prev, team];
      }
    });
  };

  // Format time
  const formatTime = (date) => {
    if (!date) return '';
    return date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
  };

  return (
    <div className="analysis-page">
      <div className="analysis-card">
        {/* Connection Bar */}
        <div className="connection-bar">
          {isConnected ? (
            <div className="connection-status">
              <span className="status-indicator connected">Sheet connected!</span>
              {lastUpdated && (
                <span className="last-updated">Last updated {formatTime(lastUpdated)}</span>
              )}
              <button className="refresh-btn" onClick={handleRefresh} disabled={isLoading}>
                {isLoading ? 'Loading...' : 'Refresh'}
              </button>
              <button className="disconnect-btn" onClick={handleDisconnect}>
                Disconnect
              </button>
            </div>
          ) : (
            <div className="connection-setup">
              <input
                type="text"
                value={csvUrl}
                onChange={(e) => setCsvUrl(e.target.value)}
                placeholder="Paste your published sheet link"
                className="csv-input"
              />
              <button className="connect-btn" onClick={handleConnect}>
                Connect
              </button>
            </div>
          )}
          <button className="help-btn" onClick={() => setShowHelpModal(true)}>
             How do I do this?
          </button>
        </div>

        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        {/* Main Content */}
        {isConnected && teamStats.length > 0 ? (
          <div className="analysis-content">
            {/* Leaderboard Table */}
            <div className="leaderboard-section">
              <h3>Team Leaderboard</h3>
              <div className="table-container">
                <table className="leaderboard-table">
                  <thead>
                    <tr>
                      <th>Rank</th>
                      <th>Team</th>
                      <th>Matches</th>
                      <th>Avg Total</th>
                      <th>Max</th>
                      <th>Min</th>
                      <th>Std Dev</th>
                      <th>Auto Avg</th>
                      <th>Tele Avg</th>
                      <th>Endgame Avg</th>
                      <th>Picklist</th>
                    </tr>
                  </thead>
                  <tbody>
                    {teamStats.map((team, index) => (
                      <tr key={team.team} className={picklist.includes(team.team) ? 'picklisted' : ''}>
                        <td>{index + 1}</td>
                        <td className="team-cell">{team.team}</td>
                        <td>{team.matches}</td>
                        <td>{team.avgTotal.toFixed(1)}</td>
                        <td>{team.maxTotal}</td>
                        <td>{team.minTotal}</td>
                        <td>{team.stdDev.toFixed(1)}</td>
                        <td>{team.autoAvg.toFixed(1)}</td>
                        <td>{team.teleAvg.toFixed(1)}</td>
                        <td>{team.endgameAvg.toFixed(1)}</td>
                        <td>
                          <button 
                            className={`star-btn ${picklist.includes(team.team) ? 'starred' : ''}`}
                            onClick={() => togglePicklist(team.team)}
                          >
                            ⭐
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Picklist Section */}
            {picklist.length > 0 && (
              <div className="picklist-section">
                <h3>Picklist ({picklist.length} teams)</h3>
                <div className="picklist-teams">
                  {picklist.map((team, index) => (
                    <div key={team} className="picklist-item">
                      <span className="picklist-rank">{index + 1}.</span>
                      <span className="picklist-team">{team}</span>
                      <button 
                        className="remove-btn"
                        onClick={() => togglePicklist(team)}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : isConnected ? (
          <div className="no-data">
            <p>No data found. Make sure your sheet is published correctly and contains scouting data.</p>
          </div>
        ) : (
          <div className="welcome-message">
            <h3>Connect Your Google Sheet</h3>
            <p>Connect your existing scouting sheet to view team statistics and build your picklist.</p>
            <p>No setup required - just paste your published CSV link above.</p>
          </div>
        )}
      </div>

      {/* Help Modal */}
      {showHelpModal && (
        <div className="help-modal-overlay" onClick={() => setShowHelpModal(false)}>
          <div className="help-modal" onClick={(e) => e.stopPropagation()}>
            <div className="help-modal-header">
              <h2>Connect your Google Sheet</h2>
              <button className="help-modal-close" onClick={() => setShowHelpModal(false)}>
                ×
              </button>
            </div>
            <div className="help-modal-content">
              <div className="help-steps">
                <div className="help-step">
                  <strong>1.</strong> Use the same sheet you scan QR codes into
                </div>
                <div className="help-step">
                  <strong>2.</strong> In Google Sheets → File → Share → Publish to web (if it's greyed out, you need to use a Google account over 13, or one that isn't managed by parent/guardian or school)
                </div>
                <div className="help-step">
                  <strong>3.</strong> Choose your data tab (not Entire Document) → Choose CSV (not Web Page) → Publish + Copy link in the box
                </div>
                <div className="help-step">
                  <strong>4.</strong> Paste the link here
                </div>
                <div className="help-step">
                  <strong>5.</strong> Done. Wait 90 seconds for the Google Sheets to send data to TurboScout (refresh the page if you want)
                </div>
              </div>
              <div className="help-troubleshooting">
                <h4>Troubleshooting</h4>
                <ul>
                  <li><strong>Stats not updating</strong> → hit Refresh</li>
                  <li><strong>Offline</strong> → scouting still works, analyze updates later</li>
                  <li><strong>Wrong data</strong> → check you published the correct tab</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Analysis;