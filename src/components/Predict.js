import React, { useState, useEffect } from 'react';
import './Predict.css';

const Predict = () => {
  const [redAlliance, setRedAlliance] = useState(() => {
    const saved = localStorage.getItem('turboscout-predict-red-alliance');
    return saved ? JSON.parse(saved) : ['', '', ''];
  });
  const [blueAlliance, setBlueAlliance] = useState(() => {
    const saved = localStorage.getItem('turboscout-predict-blue-alliance');
    return saved ? JSON.parse(saved) : ['', '', ''];
  });
  const [teamStats, setTeamStats] = useState([]);
  const [prediction, setPrediction] = useState(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const savedUrl = localStorage.getItem('turboscout-csv-url');
    if (savedUrl) {
      setIsConnected(true);
      fetchTeamData(savedUrl);
    }
  }, []);

  const fetchTeamData = async (url) => {
    try {
      const response = await fetch(url);
      if (!response.ok) return;
      
      const csvText = await response.text();
      const { stats } = parseCSVData(csvText);
      setTeamStats(stats);
    } catch (err) {
      console.error('Error fetching team data:', err);
    }
  };

  const parseCSVData = (csvText) => {
    const lines = csvText.trim().split('\n');
    if (lines.length < 2) return { stats: [] };

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
          totalScores: [],
          autoScores: [],
          teleScores: [],
          endgameScores: [],
          climbSuccesses: [],
          deaths: [],
          autoWins: []
        };
      }

      teamData[team].totalScores.push(totalScore);
      teamData[team].autoScores.push(autoScore);
      teamData[team].teleScores.push(teleScore);
      teamData[team].endgameScores.push(endgameScore);
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
        matches: totalScores.length,
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
        consistency: totalScores.length > 1 ? Math.min(100, Math.max(0, (1 / (1 + (stdDev(totalScores) / Math.max(avg(totalScores), 1)))) * 100)) : 50
      };
    });

    return { stats };
  };

  const handleAllianceChange = (alliance, index, value) => {
    if (alliance === 'red') {
      const newRed = [...redAlliance];
      newRed[index] = value;
      setRedAlliance(newRed);
      localStorage.setItem('turboscout-predict-red-alliance', JSON.stringify(newRed));
    } else {
      const newBlue = [...blueAlliance];
      newBlue[index] = value;
      setBlueAlliance(newBlue);
      localStorage.setItem('turboscout-predict-blue-alliance', JSON.stringify(newBlue));
    }
  };

  const getTeamStats = (teamNumber) => {
    return teamStats.find(team => team.team === teamNumber) || null;
  };

  const calculateAllianceStats = (alliance) => {
    const teams = alliance.filter(team => team.trim() !== '').map(team => getTeamStats(team.trim())).filter(Boolean);
    
    if (teams.length === 0) return null;

    const totalAvg = teams.reduce((sum, team) => sum + (team.avgTotal || 0), 0);
    const autoAvg = teams.reduce((sum, team) => sum + (team.autoAvg || 0), 0);
    const teleAvg = teams.reduce((sum, team) => sum + (team.teleAvg || 0), 0);
    const endgameAvg = teams.reduce((sum, team) => sum + (team.endgameAvg || 0), 0);
    const validConsistencies = teams.filter(team => !isNaN(team.consistency)).map(team => team.consistency);
    const avgConsistency = validConsistencies.length > 0 ? validConsistencies.reduce((sum, c) => sum + c, 0) / validConsistencies.length : NaN;
    const validClimbRates = teams.filter(team => !isNaN(team.climbSuccessRate)).map(team => team.climbSuccessRate);
    const avgClimbRate = validClimbRates.length > 0 ? validClimbRates.reduce((sum, c) => sum + c, 0) / validClimbRates.length : 0;
    
    const validDeathRates = teams.filter(team => !isNaN(team.deathRate)).map(team => team.deathRate);
    const avgDeathRate = validDeathRates.length > 0 ? validDeathRates.reduce((sum, d) => sum + d, 0) / validDeathRates.length : 0;
    
    const validAutoWinRates = teams.filter(team => !isNaN(team.autoWinRate)).map(team => team.autoWinRate);
    const avgAutoWinRate = validAutoWinRates.length > 0 ? validAutoWinRates.reduce((sum, a) => sum + a, 0) / validAutoWinRates.length : 0;

    const calculateTeamScore = (team) => {
      const baseScore = team.avgTotal || 0;
      const climbBonus = (team.climbSuccessRate || 0) * 0.1;
      const reliabilityBonus = (100 - (team.deathRate || 0)) * 0.05;
      return baseScore + climbBonus + reliabilityBonus;
    };

    const mvp = teams.reduce((best, team) => {
      return calculateTeamScore(team) > calculateTeamScore(best) ? team : best;
    });

    const weakest = teams.reduce((worst, team) => {
      return calculateTeamScore(team) < calculateTeamScore(worst) ? team : worst;
    });

    return {
      teams,
      totalAvg,
      autoAvg,
      teleAvg,
      endgameAvg,
      avgConsistency,
      avgClimbRate,
      avgDeathRate,
      avgAutoWinRate,
      mvp,
      weakest
    };
  };

  const generateExplainingFactors = (allianceStats, color) => {
    const factors = [];
    
    if (allianceStats.totalAvg > 80) {
      factors.push(`High scoring alliance with ${allianceStats.totalAvg.toFixed(1)} avg points`);
    } else if (allianceStats.totalAvg < 40) {
      factors.push(`Low scoring alliance with only ${allianceStats.totalAvg.toFixed(1)} avg points`);
    }
    
    if (allianceStats.avgConsistency > 80) {
      factors.push(`Very consistent performance reduces risk of bad matches`);
    } else if (allianceStats.avgConsistency < 60) {
      factors.push(`Inconsistent performance creates unpredictable outcomes`);
    }
    
    if (allianceStats.avgClimbRate > 70) {
      factors.push(`Strong endgame with ${allianceStats.avgClimbRate.toFixed(0)}% climb success`);
    } else if (allianceStats.avgClimbRate < 30) {
      factors.push(`Weak endgame with only ${allianceStats.avgClimbRate.toFixed(0)}% climb success`);
    }
    
    if (allianceStats.avgDeathRate > 20) {
      const worstRobot = allianceStats.teams.reduce((worst, team) => 
        team.deathRate > worst.deathRate ? team : worst
      );
      factors.push(`Team ${worstRobot.team} has ${worstRobot.deathRate.toFixed(0)}% breakdown rate - major reliability risk`);
    } else if (allianceStats.avgDeathRate < 5) {
      factors.push(`Very reliable robots with low breakdown rates across alliance`);
    } else {
      const problematicRobots = allianceStats.teams.filter(team => team.deathRate > 15);
      if (problematicRobots.length > 0) {
        const robotList = problematicRobots.map(team => `Team ${team.team} (${team.deathRate.toFixed(0)}%)`).join(', ');
        factors.push(`Reliability concerns: ${robotList}`);
      }
    }
    
    if (allianceStats.avgAutoWinRate > 60) {
      factors.push(`Strong autonomous gives early match advantage`);
    } else if (allianceStats.avgAutoWinRate < 30) {
      factors.push(`Weak autonomous puts alliance behind early`);
    }
    
    const mvpScore = allianceStats.mvp.avgTotal;
    if (mvpScore > 90) {
      factors.push(`Team ${allianceStats.mvp.team} is a powerhouse carry (${mvpScore.toFixed(1)} avg)`);
    } else if (mvpScore > 70) {
      factors.push(`Team ${allianceStats.mvp.team} provides solid leadership`);
    }
    
    const weakestScore = allianceStats.weakest.avgTotal;
    if (weakestScore < 30) {
      factors.push(`Team ${allianceStats.weakest.team} is a significant liability (${weakestScore.toFixed(1)} avg)`);
    } else if (weakestScore < 50) {
      factors.push(`Team ${allianceStats.weakest.team} may struggle to contribute effectively`);
    }
    
    return factors;
  };

  const calculatePrediction = () => {
    const redStats = calculateAllianceStats(redAlliance);
    const blueStats = calculateAllianceStats(blueAlliance);

    if (!redStats || !blueStats) {
      setPrediction(null);
      return;
    }

    const calculateAllianceScore = (stats) => {
      const predictedScore = stats.totalAvg || 0;
      const deathRate = isNaN(stats.avgDeathRate) ? 0 : stats.avgDeathRate;
      const climbRate = isNaN(stats.avgClimbRate) ? 0 : stats.avgClimbRate;
      
      const reliability = Math.max(0, 100 - deathRate);
      const reliabilityMultiplier = Math.pow(reliability / 100, 0.3);
      const climbMultiplier = Math.pow(climbRate / 100, 0.1);
      
      const adjustedScore = predictedScore * reliabilityMultiplier * climbMultiplier;
      
      return {
        predictedScore: predictedScore,
        adjustedScore: Math.max(0, adjustedScore),
        baseScore: predictedScore,
        reliability,
        deathRate,
        climbRate
      };
    };
    
    const redResult = calculateAllianceScore(redStats);
    const blueResult = calculateAllianceScore(blueStats);
    
    const totalScore = redResult.predictedScore + blueResult.predictedScore;
    const redWinChance = totalScore > 0 ? (redResult.predictedScore / totalScore) * 100 : 50;
    const blueWinChance = 100 - redWinChance;

    setPrediction({
      red: {
        ...redStats,
        winChance: redWinChance,
        loseChance: 100 - redWinChance,
        predictedScore: redResult.predictedScore,
        factors: generateExplainingFactors(redStats, 'red')
      },
      blue: {
        ...blueStats,
        winChance: blueWinChance,
        loseChance: 100 - blueWinChance,
        predictedScore: blueResult.predictedScore,
        factors: generateExplainingFactors(blueStats, 'blue')
      }
    });
  };

  const clearAlliances = () => {
    setRedAlliance(['', '', '']);
    setBlueAlliance(['', '', '']);
    setPrediction(null);
    localStorage.removeItem('turboscout-predict-red-alliance');
    localStorage.removeItem('turboscout-predict-blue-alliance');
  };

  if (!isConnected) {
    return (
      <div className="predict-page">
        <div className="predict-card">
          <div className="no-connection">
            <h3>Connect Your Data First</h3>
            <p>Please connect your scouting data in the Analysis tab before using match predictions.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="predict-page">
      <div className="predict-card">
        <div className="predict-header">
          <h2>Match Prediction</h2>
          <p>Enter team numbers to predict match outcomes. *Data-based but not 100% accurate</p>
        </div>

        <div className="alliances-input">
          <div className="alliance-section red-alliance">
            <h3>Red Alliance</h3>
            <div className="team-inputs">
              {redAlliance.map((team, index) => (
                <input
                  key={index}
                  type="text"
                  placeholder={`Team ${index + 1}`}
                  value={team}
                  onChange={(e) => handleAllianceChange('red', index, e.target.value)}
                  className="team-input"
                />
              ))}
            </div>
          </div>

          <div className="alliance-section blue-alliance">
            <h3>Blue Alliance</h3>
            <div className="team-inputs">
              {blueAlliance.map((team, index) => (
                <input
                  key={index}
                  type="text"
                  placeholder={`Team ${index + 1}`}
                  value={team}
                  onChange={(e) => handleAllianceChange('blue', index, e.target.value)}
                  className="team-input"
                />
              ))}
            </div>
          </div>
        </div>

        <div className="predict-controls">
          <button className="predict-btn" onClick={calculatePrediction}>
            Predict Match
          </button>
          <button className="clear-btn" onClick={clearAlliances}>
            Clear All
          </button>
        </div>

        {prediction && (
          <div className="prediction-results">
            <div className="win-chances">
              <div className="alliance-result red-result">
                <h3>Red Alliance</h3>
                <div className="win-probability">
                  <div className="probability-value">{prediction.red.winChance.toFixed(1)}%</div>
                  <div className="probability-label">Win Chance</div>
                </div>
                <div className="predicted-score">
                  <div className="score-value">{prediction.red.predictedScore.toFixed(1)}</div>
                  <div className="score-label">Predicted Score</div>
                </div>
                <div className="alliance-stats">
                  <div className="stat">
                    <span className="stat-label">Avg Score:</span>
                    <span className="stat-value">{prediction.red.totalAvg.toFixed(1)}</span>
                  </div>
                  <div className="stat">
                    <span className="stat-label">Consistency:</span>
                    <span className="stat-value">{prediction.red.avgConsistency.toFixed(1)}%</span>
                  </div>
                </div>
                <div className="team-roles">
                  <div className="mvp">
                    <span className="role-label">MVP:</span>
                    <span className="team-number">Team {prediction.red.mvp.team}</span>
                  </div>
                  <div className="weakest">
                    <span className="role-label">Weak Point:</span>
                    <span className="team-number">Team {prediction.red.weakest.team}</span>
                  </div>
                </div>
              </div>

              <div className="alliance-result blue-result">
                <h3>Blue Alliance</h3>
                <div className="win-probability">
                  <div className="probability-value">{prediction.blue.winChance.toFixed(1)}%</div>
                  <div className="probability-label">Win Chance</div>
                </div>
                <div className="predicted-score">
                  <div className="score-value">{prediction.blue.predictedScore.toFixed(1)}</div>
                  <div className="score-label">Predicted Score</div>
                </div>
                <div className="alliance-stats">
                  <div className="stat">
                    <span className="stat-label">Avg Score:</span>
                    <span className="stat-value">{prediction.blue.totalAvg.toFixed(1)}</span>
                  </div>
                  <div className="stat">
                    <span className="stat-label">Consistency:</span>
                    <span className="stat-value">{prediction.blue.avgConsistency.toFixed(1)}%</span>
                  </div>
                </div>
                <div className="team-roles">
                  <div className="mvp">
                    <span className="role-label">MVP:</span>
                    <span className="team-number">Team {prediction.blue.mvp.team}</span>
                  </div>
                  <div className="weakest">
                    <span className="role-label">Weak Point:</span>
                    <span className="team-number">Team {prediction.blue.weakest.team}</span>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="team-stats-summary">
              <h3>Individual Team Stats</h3>
              <div className="alliances-stats">
                <div className="alliance-team-stats red-alliance-stats">
                  <h4>Red Alliance Teams</h4>
                  {prediction.red.teams.map((team, index) => (
                    <div key={index} className="team-stat-card">
                      <div className="team-stat-header">Team {team.team}</div>
                      <div className="team-stat-grid">
                        <div className="stat-item">
                          <span className="stat-label">Avg Score:</span>
                          <span className="stat-value">{(team.avgTotal || 0).toFixed(1)}</span>
                        </div>
                        <div className="stat-item">
                          <span className="stat-label">Avg Auto:</span>
                          <span className="stat-value">{(team.autoAvg || 0).toFixed(1)}</span>
                        </div>
                        <div className="stat-item">
                          <span className="stat-label">Climb Rate:</span>
                          <span className="stat-value">{(team.climbSuccessRate || 0).toFixed(1)}%</span>
                        </div>
                        <div className="stat-item">
                          <span className="stat-label">Death Rate:</span>
                          <span className="stat-value">{(team.deathRate || 0).toFixed(1)}%</span>
                        </div>
                        <div className="stat-item">
                          <span className="stat-label">Avg Teleop:</span>
                          <span className="stat-value">{(team.teleAvg || 0).toFixed(1)}</span>
                        </div>
                        <div className="stat-item">
                          <span className="stat-label">Max Score:</span>
                          <span className="stat-value">{(team.maxTotal || 0).toFixed(1)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                
                <div className="alliance-team-stats blue-alliance-stats">
                  <h4>Blue Alliance Teams</h4>
                  {prediction.blue.teams.map((team, index) => (
                    <div key={index} className="team-stat-card">
                      <div className="team-stat-header">Team {team.team}</div>
                      <div className="team-stat-grid">
                        <div className="stat-item">
                          <span className="stat-label">Avg Score:</span>
                          <span className="stat-value">{(team.avgTotal || 0).toFixed(1)}</span>
                        </div>
                        <div className="stat-item">
                          <span className="stat-label">Avg Auto:</span>
                          <span className="stat-value">{(team.autoAvg || 0).toFixed(1)}</span>
                        </div>
                        <div className="stat-item">
                          <span className="stat-label">Climb Rate:</span>
                          <span className="stat-value">{(team.climbSuccessRate || 0).toFixed(1)}%</span>
                        </div>
                        <div className="stat-item">
                          <span className="stat-label">Death Rate:</span>
                          <span className="stat-value">{(team.deathRate || 0).toFixed(1)}%</span>
                        </div>
                        <div className="stat-item">
                          <span className="stat-label">Avg Teleop:</span>
                          <span className="stat-value">{(team.teleAvg || 0).toFixed(1)}</span>
                        </div>
                        <div className="stat-item">
                          <span className="stat-label">Max Score:</span>
                          <span className="stat-value">{(team.maxTotal || 0).toFixed(1)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            
            <div className="explaining-factors">
              <h3>Why These Predictions?</h3>
              <div className="factors-grid">
                <div className="alliance-factors red-factors">
                  <h4>Red Alliance Strengths & Weaknesses</h4>
                  <ul className="factors-list">
                    {prediction.red.factors.map((factor, index) => (
                      <li key={index} className="factor-item">{factor}</li>
                    ))}
                  </ul>
                </div>
                
                <div className="alliance-factors blue-factors">
                  <h4>Blue Alliance Strengths & Weaknesses</h4>
                  <ul className="factors-list">
                    {prediction.blue.factors.map((factor, index) => (
                      <li key={index} className="factor-item">{factor}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Predict;