import React, { useState, useEffect, useCallback } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';
import './Analysis.css';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend
);

const Analysis = () => {
  const [csvUrl, setCsvUrl] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [teamStats, setTeamStats] = useState([]);
  const [analyzeList, setAnalyzeList] = useState([]);
  const [selectAllMode, setSelectAllMode] = useState('Chosen');
  const [chosenTeams, setChosenTeams] = useState([]);
  const [refreshTimer, setRefreshTimer] = useState(null);
  const [sortConfig, setSortConfig] = useState({ key: 'avgTotal', direction: 'desc' });

  useEffect(() => {
    const savedUrl = localStorage.getItem('turboscout-csv-url');
    if (savedUrl) {
      setCsvUrl(savedUrl);
      setIsConnected(true);
      fetchAndParseData(savedUrl);
    }
  }, []);

  const parseCSVData = (csvText) => {
    const lines = csvText.trim().split('\n');
    if (lines.length < 2) return { stats: [], rawTeamData: {} };

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

    const teamData = {};
    rows.forEach((row, index) => {
      const team = row['Team'];
      const matchNum = parseFloat(row['Match'] || row['match'] || index + 1);
      
      const totalScore = parseFloat(row['Total Score'] || row['total_score'] || row['Total_Score'] || 0);
      const autoScore = parseFloat(row['Auto Pts'] || row['auto_pts'] || row['Auto_Pts'] || 0);
      const teleScore = parseFloat(row['Teleop Pts'] || row['teleop_pts'] || row['Teleop_Pts'] || 0);
      const endgameScore = parseFloat(row['Endgame Pts'] || row['endgame_pts'] || row['Endgame_Pts'] || 0);
      
      const climbSuccess = (row['Endgame Climb'] || row['endgame_climb'] || '').toLowerCase().includes('success');
      const died = (row['Endgame Died'] || row['endgame_died'] || '').toLowerCase() === 'y';
      const autoWon = (row['Auto Won'] || row['auto_won'] || '').toLowerCase() === 'y';
      
      if (!team) return;

      if (!teamData[team]) {
        teamData[team] = {
          team,
          matches: [],
          totalScores: [],
          autoScores: [],
          teleScores: [],
          endgameScores: [],
          matchNumbers: [],
          climbSuccesses: [],
          deaths: [],
          autoWins: []
        };
      }

      teamData[team].matches.push(row);
      teamData[team].totalScores.push(totalScore);
      teamData[team].autoScores.push(autoScore);
      teamData[team].teleScores.push(teleScore);
      teamData[team].endgameScores.push(endgameScore);
      teamData[team].matchNumbers.push(matchNum);
      teamData[team].climbSuccesses.push(climbSuccess);
      teamData[team].deaths.push(died);
      teamData[team].autoWins.push(autoWon);
    });

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

      const climbSuccessRate = team.climbSuccesses.length ? 
        (team.climbSuccesses.filter(Boolean).length / team.climbSuccesses.length) * 100 : 0;
      const deathRate = team.deaths.length ? 
        (team.deaths.filter(Boolean).length / team.deaths.length) * 100 : 0;
      const autoWinRate = team.autoWins.length ? 
        (team.autoWins.filter(Boolean).length / team.autoWins.length) * 100 : 0;

      return {
        team: team.team,
        matches: team.matches.length,
        avgTotal: avg(totalScores),
        maxTotal: Math.max(...totalScores, 0),
        minTotal: Math.min(...totalScores, 0),
        stdDev: stdDev(totalScores),
        autoAvg: avg(autoScores),
        teleAvg: avg(teleScores),
        endgameAvg: avg(endgameScores),
        climbSuccessRate,
        deathRate,
        autoWinRate,
        rawData: team
      };
    });

    return { stats, rawTeamData: teamData };
  };

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
      
      const { stats, rawTeamData } = parseCSVData(csvText);
      console.log('Parsed stats:', stats);
      
      setTeamStats(stats);
      setLastUpdated(new Date());
      
      if (stats.length === 0) {
        setError('No valid team data found in CSV');
      } else {
        if (analyzeList.length === 0) {
          setAnalyzeList([stats[0].team]);
          setChosenTeams([stats[0].team]);
        }
      }
    } catch (err) {
      setError(`Error loading data: ${err.message}`);
      console.error('CSV fetch error:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleConnect = () => {
    if (!csvUrl.trim()) {
      setError('Please enter a CSV URL');
      return;
    }
    
    localStorage.setItem('turboscout-csv-url', csvUrl);
    setIsConnected(true);
    fetchAndParseData(csvUrl);
  };

  const handleRefresh = () => {
    if (csvUrl) {
      fetchAndParseData(csvUrl);
    }
  };

  const handleDisconnect = () => {
    localStorage.removeItem('turboscout-csv-url');
    setCsvUrl('');
    setIsConnected(false);
    setTeamStats([]);
    setAnalyzeList([]);
    setChosenTeams([]);
    setSelectAllMode('Chosen');
    setLastUpdated(null);
    setError('');
  };

  const toggleAnalyze = (team) => {
    setAnalyzeList(prev => {
      const newList = prev.includes(team) 
        ? prev.filter(t => t !== team)
        : [...prev, team];
      
      setChosenTeams(newList);
      if (selectAllMode !== 'Chosen') {
        setSelectAllMode('Chosen');
      }
      return newList;
    });
  };

  const handleSelectAllMode = () => {
    const modes = ['All', 'None', 'Chosen'];
    const currentIndex = modes.indexOf(selectAllMode);
    const nextMode = modes[(currentIndex + 1) % modes.length];
    
    setSelectAllMode(nextMode);
    
    if (nextMode === 'All') {
      setAnalyzeList(teamStats.map(team => team.team));
    } else if (nextMode === 'None') {
      setAnalyzeList([]);
    } else if (nextMode === 'Chosen') {
      setAnalyzeList(chosenTeams);
    }
  };

  const handleSort = (key) => {
    if (key === 'rank' || key === 'analyze') return;
    
    let direction = 'desc';
    if (sortConfig.key === key && sortConfig.direction === 'desc') {
      direction = 'asc';
    }
    setSortConfig({ key, direction });
  };

  const getSortedTeamStats = () => {
    const sortableStats = [...teamStats];
    if (sortConfig.key) {
      sortableStats.sort((a, b) => {
        const aVal = a[sortConfig.key];
        const bVal = b[sortConfig.key];
        
        if (typeof aVal === 'number' && typeof bVal === 'number') {
          return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
        }
        
        const aStr = String(aVal).toLowerCase();
        const bStr = String(bVal).toLowerCase();
        if (sortConfig.direction === 'asc') {
          return aStr < bStr ? -1 : aStr > bStr ? 1 : 0;
        } else {
          return aStr > bStr ? -1 : aStr < bStr ? 1 : 0;
        }
      });
    }
    return sortableStats;
  };

  const generateScoreOverTimeData = () => {
    if (!teamStats.length || !analyzeList.length) return null;
    
    const selectedTeams = teamStats.filter(team => analyzeList.includes(team.team));
    const colors = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4', '#f97316', '#84cc16', '#ec4899', '#14b8a6', '#f97316', '#6366f1'];
    
    const allMatches = new Set();
    selectedTeams.forEach(team => {
      team.rawData.matchNumbers.forEach(match => allMatches.add(match));
    });
    const sortedMatches = Array.from(allMatches).sort((a, b) => a - b);
    
    const datasets = selectedTeams.map((team, index) => {
      const rawData = team.rawData;
      
      const data = sortedMatches.map(matchNum => {
        const matchIndex = rawData.matchNumbers.findIndex(m => m === matchNum);
        return matchIndex !== -1 ? rawData.totalScores[matchIndex] : null;
      });
      
      return {
        label: `Team ${team.team}`,
        data: data,
        borderColor: colors[index],
        backgroundColor: colors[index] + '20',
        tension: 0.1,
        spanGaps: true
      };
    });
    
    return {
      labels: sortedMatches.map(m => `Match ${m}`),
      datasets,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            labels: {
              color: document.body.classList.contains('dark-mode') ? '#f1f5f9' : '#1f2937'
            }
          }
        },
        scales: {
          x: {
            title: {
              display: true,
              text: 'Match Number',
              color: document.body.classList.contains('dark-mode') ? '#f1f5f9' : '#1f2937'
            },
            ticks: {
              color: document.body.classList.contains('dark-mode') ? '#94a3b8' : '#6b7280'
            },
            grid: {
              color: document.body.classList.contains('dark-mode') ? '#475569' : '#e5e7eb'
            }
          },
          y: {
            title: {
              display: true,
              text: 'Total Score',
              color: document.body.classList.contains('dark-mode') ? '#f1f5f9' : '#1f2937'
            },
            ticks: {
              color: document.body.classList.contains('dark-mode') ? '#94a3b8' : '#6b7280'
            },
            grid: {
              color: document.body.classList.contains('dark-mode') ? '#475569' : '#e5e7eb'
            }
          }
        }
      }
    };
  };

  const generateContributionBreakdownData = () => {
    if (!teamStats.length || !analyzeList.length) return null;
    
    const selectedTeams = teamStats.filter(team => analyzeList.includes(team.team));
    
    return {
      labels: selectedTeams.map(team => `Team ${team.team}`),
      datasets: [
        {
          label: 'Auto Points',
          data: selectedTeams.map(team => team.autoAvg),
          backgroundColor: '#3b82f6',
        },
        {
          label: 'Teleop Points',
          data: selectedTeams.map(team => team.teleAvg),
          backgroundColor: '#10b981',
        },
        {
          label: 'Endgame Points',
          data: selectedTeams.map(team => team.endgameAvg),
          backgroundColor: '#f59e0b',
        }
      ],
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            labels: {
              color: document.body.classList.contains('dark-mode') ? '#f1f5f9' : '#1f2937'
            }
          }
        },
        scales: {
          x: {
            stacked: true,
            ticks: {
              color: document.body.classList.contains('dark-mode') ? '#94a3b8' : '#6b7280'
            },
            grid: {
              color: document.body.classList.contains('dark-mode') ? '#475569' : '#e5e7eb'
            }
          },
          y: {
            stacked: true,
            title: {
              display: true,
              text: 'Average Points',
              color: document.body.classList.contains('dark-mode') ? '#f1f5f9' : '#1f2937'
            },
            ticks: {
              color: document.body.classList.contains('dark-mode') ? '#94a3b8' : '#6b7280'
            },
            grid: {
              color: document.body.classList.contains('dark-mode') ? '#475569' : '#e5e7eb'
            }
          }
        }
      }
    };
  };

  const generateReliabilityData = () => {
    if (!teamStats.length || !analyzeList.length) return null;
    
    const selectedTeams = teamStats.filter(team => analyzeList.includes(team.team));
    
    return {
      labels: selectedTeams.map(team => `Team ${team.team}`),
      datasets: [
        {
          label: 'Climb Success %',
          data: selectedTeams.map(team => team.climbSuccessRate),
          backgroundColor: '#10b981',
        },
        {
          label: 'Auto Win %',
          data: selectedTeams.map(team => team.autoWinRate),
          backgroundColor: '#3b82f6',
        },
        {
          label: 'Death Rate %',
          data: selectedTeams.map(team => team.deathRate),
          backgroundColor: '#ef4444',
        }
      ],
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            labels: {
              color: document.body.classList.contains('dark-mode') ? '#f1f5f9' : '#1f2937'
            }
          }
        },
        scales: {
          x: {
            ticks: {
              color: document.body.classList.contains('dark-mode') ? '#94a3b8' : '#6b7280'
            },
            grid: {
              color: document.body.classList.contains('dark-mode') ? '#475569' : '#e5e7eb'
            }
          },
          y: {
            beginAtZero: true,
            max: 100,
            title: {
              display: true,
              text: 'Percentage (%)',
              color: document.body.classList.contains('dark-mode') ? '#f1f5f9' : '#1f2937'
            },
            ticks: {
              color: document.body.classList.contains('dark-mode') ? '#94a3b8' : '#6b7280'
            },
            grid: {
              color: document.body.classList.contains('dark-mode') ? '#475569' : '#e5e7eb'
            }
          }
        }
      }
    };
  };

  const generateConsistencyData = () => {
    if (!teamStats.length || !analyzeList.length) return null;
    
    const selectedTeams = teamStats.filter(team => analyzeList.includes(team.team));
    
    return {
      labels: selectedTeams.map(team => `Team ${team.team}`),
      datasets: [
        {
          label: 'Average Score',
          data: selectedTeams.map(team => team.avgTotal),
          backgroundColor: '#3b82f6',
        },
        {
          label: 'Standard Deviation',
          data: selectedTeams.map(team => team.stdDev),
          backgroundColor: '#ef4444',
        }
      ],
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            labels: {
              color: document.body.classList.contains('dark-mode') ? '#f1f5f9' : '#1f2937'
            }
          }
        },
        scales: {
          x: {
            ticks: {
              color: document.body.classList.contains('dark-mode') ? '#94a3b8' : '#6b7280'
            },
            grid: {
              color: document.body.classList.contains('dark-mode') ? '#475569' : '#e5e7eb'
            }
          },
          y: {
            title: {
              display: true,
              text: 'Points',
              color: document.body.classList.contains('dark-mode') ? '#f1f5f9' : '#1f2937'
            },
            ticks: {
              color: document.body.classList.contains('dark-mode') ? '#94a3b8' : '#6b7280'
            },
            grid: {
              color: document.body.classList.contains('dark-mode') ? '#475569' : '#e5e7eb'
            }
          }
        }
      }
    };
  };

  const getSortIcon = (columnKey) => {
    return '';
  };

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
        <div className="connection-bar">
          {isConnected ? (
            <div className="connection-status">
              <span className="status-indicator connected">Sheet connected!</span>
              {lastUpdated && (
                <span className="last-updated">Last updated {formatTime(lastUpdated)} (may take ~1 min to update)</span>
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

        {isConnected && teamStats.length > 0 ? (
          <div className="analysis-content">
            <div className="leaderboard-section">
              <div className="leaderboard-header">
                <h3>Team Leaderboard</h3>
                <div className="table-controls">
                  <button 
                    className="select-all-btn-header"
                    onClick={handleSelectAllMode}
                  >
                    {selectAllMode}
                  </button>
                </div>
              </div>
              <div className="table-container">
                <table className="leaderboard-table">
                  <thead>
                    <tr>
                      <th>Rank</th>
                      <th className="sortable" onClick={() => handleSort('team')}>Team{getSortIcon('team')}</th>
                      <th className="sortable" onClick={() => handleSort('matches')}>Matches{getSortIcon('matches')}</th>
                      <th className="sortable" onClick={() => handleSort('avgTotal')}>Avg Total{getSortIcon('avgTotal')}</th>
                      <th className="sortable" onClick={() => handleSort('maxTotal')}>Max{getSortIcon('maxTotal')}</th>
                      <th className="sortable" onClick={() => handleSort('minTotal')}>Min{getSortIcon('minTotal')}</th>
                      <th className="sortable" onClick={() => handleSort('stdDev')}>Std Dev{getSortIcon('stdDev')}</th>
                      <th className="sortable" onClick={() => handleSort('autoAvg')}>Auto Avg{getSortIcon('autoAvg')}</th>
                      <th className="sortable" onClick={() => handleSort('teleAvg')}>Tele Avg{getSortIcon('teleAvg')}</th>
                      <th className="sortable" onClick={() => handleSort('endgameAvg')}>Endgame Avg{getSortIcon('endgameAvg')}</th>
                      <th>Analyze</th>
                    </tr>
                  </thead>
                  <tbody>
                    {getSortedTeamStats().map((team, index) => (
                      <tr key={team.team} className={analyzeList.includes(team.team) ? 'analyzed' : ''}>
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
                            className={`analyze-btn ${analyzeList.includes(team.team) ? 'selected' : ''}`}
                            onClick={() => toggleAnalyze(team.team)}
                          >
                            {analyzeList.includes(team.team) ? '✓' : 'X'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className={`charts-section ${analyzeList.length > 5 ? 'stacked-layout' : 'grid-layout'}`}>
              <div className="chart-island">
                <h3>Score Over Time</h3>
                <div className={`chart-container ${analyzeList.length > 5 ? 'expanded-height' : ''}`}>
                  {generateScoreOverTimeData() && (
                    <Line data={generateScoreOverTimeData()} options={generateScoreOverTimeData().options} />
                  )}
                </div>
              </div>
              <div className="chart-island">
                <h3>Score Consistency</h3>
                <div className="chart-container">
                  {generateConsistencyData() && (
                    <Bar data={generateConsistencyData()} options={generateConsistencyData().options} />
                  )}
                </div>
              </div>
              <div className="chart-island">
                <h3>Contribution Breakdown</h3>
                <div className="chart-container">
                  {generateContributionBreakdownData() && (
                    <Bar data={generateContributionBreakdownData()} options={generateContributionBreakdownData().options} />
                  )}
                </div>
              </div>
              <div className="chart-island">
                <h3>Reliability Metrics</h3>
                <div className="chart-container">
                  {generateReliabilityData() && (
                    <Bar data={generateReliabilityData()} options={generateReliabilityData().options} />
                  )}
                </div>
              </div>
            </div>

          </div>
        ) : isConnected ? (
          <div className="no-data">
            <p>No data found. Make sure the sheet is published correctly and contains scouting data.</p>
          </div>
        ) : (
          <div className="welcome-message">
            <h3>Connect Your Google Sheet</h3>
            <p>Connect your existing scouting sheet to view team statistics and build your picklist.</p>
            <p>No setup required, just paste your published CSV link above.</p>
          </div>
        )}
      </div>

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