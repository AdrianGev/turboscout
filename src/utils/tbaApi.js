const TBA_BASE_URL = 'https://www.thebluealliance.com/api/v3';

const getTBAApiKey = () => {
  return localStorage.getItem('turboscout-tba-api-key') || process.env.REACT_APP_TBA_API_KEY || '';
};

export const setTBAApiKey = (apiKey) => {
  localStorage.setItem('turboscout-tba-api-key', apiKey);
};

const fetchTBA = async (endpoint) => {
  const apiKey = getTBAApiKey();
  
  console.log('TBA API Debug:', {
    endpoint,
    hasApiKey: !!apiKey,
    apiKeyLength: apiKey ? apiKey.length : 0,
    apiKeyStart: apiKey ? apiKey.substring(0, 8) + '...' : 'none',
    envVar: process.env.REACT_APP_TBA_API_KEY ? 'found' : 'not found'
  });
  
  if (!apiKey) {
    throw new Error('TBA API key not configured');
  }

  const response = await fetch(`${TBA_BASE_URL}${endpoint}`, {
    headers: {
      'X-TBA-Auth-Key': apiKey,
    },
  });

  if (!response.ok) {
    throw new Error(`TBA API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
};

const getCurrentYear = () => new Date().getFullYear();

export const fetchEvents = async (year = getCurrentYear()) => {
  return fetchTBA(`/events/${year}`);
};

export const fetchDistricts = async (year = getCurrentYear()) => {
  return fetchTBA(`/districts/${year}`);
};

export const fetchEventsByRegion = async (year = getCurrentYear()) => {
  const [events, districts] = await Promise.all([
    fetchEvents(year),
    fetchDistricts(year)
  ]);
  
  const districtMap = {};
  districts.forEach(district => {
    districtMap[district.key] = district.display_name;
  });
  
  const regions = {};
  
  events.forEach(event => {
    let regionName;
    
    if (event.district && event.district.key && districtMap[event.district.key]) {
      regionName = districtMap[event.district.key];
    } else if (event.country && event.country !== 'USA') {
      regionName = `FIRST ${event.country}`;
    } else {
      return;
    }
    
    if (!regions[regionName]) {
      regions[regionName] = [];
    }
    regions[regionName].push(event);
  });

  return regions;
};

export const fetchEventMatches = async (eventKey) => {
  return fetchTBA(`/event/${eventKey}/matches`);
};

export const fetchEventTeams = async (eventKey) => {
  return fetchTBA(`/event/${eventKey}/teams`);
};

export const fetchEventRankings = async (eventKey) => {
  return fetchTBA(`/event/${eventKey}/rankings`);
};

export const fetchTeamMatchesYear = async (teamKey, year) => {
  try {
    return await fetchTBA(`/team/${teamKey}/matches/${year}`);
  } catch (error) {
    return [];
  }
};

export const fetchEventAlliances = async (eventKey) => {
  try {
    return await fetchTBA(`/event/${eventKey}/alliances`);
  } catch (error) {
    return null;
  }
};

export const fetchEventOPRs = async (eventKey) => {
  try {
    return fetchTBA(`/event/${eventKey}/oprs`);
  } catch (error) {
    return null;
  }
};

export const parseMatchesToTeamRecords = (matches) => {
  const teamRecords = new Map();

  matches.forEach(match => {
    if (match.comp_level === 'qm' && match.alliances && match.score_breakdown) {
      const redAlliance = match.alliances.red;
      const blueAlliance = match.alliances.blue;
      
      if (redAlliance.score >= 0 && blueAlliance.score >= 0) {
        redAlliance.team_keys.forEach(teamKey => {
          const teamNumber = teamKey.replace('frc', '');
          if (!teamRecords.has(teamNumber)) {
            teamRecords.set(teamNumber, []);
          }
          
          teamRecords.get(teamNumber).push({
            teamKey: teamNumber,
            matchKey: match.key,
            alliance: 'red',
            allianceScore: redAlliance.score,
            opponentScore: blueAlliance.score,
            win: redAlliance.score > blueAlliance.score,
            teammates: redAlliance.team_keys.filter(tk => tk !== teamKey).map(tk => tk.replace('frc', ''))
          });
        });

        blueAlliance.team_keys.forEach(teamKey => {
          const teamNumber = teamKey.replace('frc', '');
          if (!teamRecords.has(teamNumber)) {
            teamRecords.set(teamNumber, []);
          }
          
          teamRecords.get(teamNumber).push({
            teamKey: teamNumber,
            matchKey: match.key,
            alliance: 'blue',
            allianceScore: blueAlliance.score,
            opponentScore: redAlliance.score,
            win: blueAlliance.score > redAlliance.score,
            teammates: blueAlliance.team_keys.filter(tk => tk !== teamKey).map(tk => tk.replace('frc', ''))
          });
        });
      }
    }
  });

  return teamRecords;
};

export const calculateOPR = (teamRecords) => {
  const teams = Array.from(teamRecords.keys());
  const teamIndexMap = new Map();
  teams.forEach((team, index) => {
    teamIndexMap.set(team, index);
  });

  const matches = [];
  const scores = [];

  teamRecords.forEach((records, teamKey) => {
    records.forEach(record => {
      const matchAllianceKey = `${record.matchKey}_${record.alliance}`;
      const existingMatch = matches.find(m => m.key === matchAllianceKey);
      
      if (!existingMatch) {
        const matchRow = new Array(teams.length).fill(0);
        
        [record.teamKey, ...record.teammates].forEach(teammate => {
          const index = teamIndexMap.get(teammate);
          if (index !== undefined) {
            matchRow[index] = 1;
          }
        });
        
        matches.push({
          key: matchAllianceKey,
          coefficients: matchRow
        });
        scores.push(record.allianceScore);
      }
    });
  });

  if (matches.length === 0 || teams.length === 0) {
    return new Map();
  }

  const A = matches.map(match => match.coefficients);
  const b = scores;

  try {
    const opr = solveLinearSystem(A, b);
    
    const oprMap = new Map();
    teams.forEach((team, index) => {
      oprMap.set(team, opr[index] || 0);
    });
    
    return oprMap;
  } catch (error) {
    console.error('Error calculating OPR:', error);
    return new Map();
  }
};

const solveLinearSystem = (A, b) => {
  const m = A.length;
  const n = A[0].length;
  
  const AT = [];
  for (let j = 0; j < n; j++) {
    AT[j] = [];
    for (let i = 0; i < m; i++) {
      AT[j][i] = A[i][j];
    }
  }
  
  const ATA = [];
  for (let i = 0; i < n; i++) {
    ATA[i] = [];
    for (let j = 0; j < n; j++) {
      let sum = 0;
      for (let k = 0; k < m; k++) {
        sum += AT[i][k] * A[k][j];
      }
      ATA[i][j] = sum;
    }
  }
  
  const ATb = [];
  for (let i = 0; i < n; i++) {
    let sum = 0;
    for (let j = 0; j < m; j++) {
      sum += AT[i][j] * b[j];
    }
    ATb[i] = sum;
  }
  
  return gaussianElimination(ATA, ATb);
};

const gaussianElimination = (A, b) => {
  const n = A.length;
  const augmented = A.map((row, i) => [...row, b[i]]);
  
  for (let i = 0; i < n; i++) {
    let maxRow = i;
    for (let k = i + 1; k < n; k++) {
      if (Math.abs(augmented[k][i]) > Math.abs(augmented[maxRow][i])) {
        maxRow = k;
      }
    }
    
    [augmented[i], augmented[maxRow]] = [augmented[maxRow], augmented[i]];
    
    for (let k = i + 1; k < n; k++) {
      if (Math.abs(augmented[i][i]) < 1e-10) continue;
      
      const factor = augmented[k][i] / augmented[i][i];
      for (let j = i; j <= n; j++) {
        augmented[k][j] -= factor * augmented[i][j];
      }
    }
  }
  
  const x = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    x[i] = augmented[i][n];
    for (let j = i + 1; j < n; j++) {
      x[i] -= augmented[i][j] * x[j];
    }
    if (Math.abs(augmented[i][i]) > 1e-10) {
      x[i] /= augmented[i][i];
    }
  }
  
  return x;
};

export const calculateCarryRatios = (teamRecords, oprMap) => {
  const carryRatios = new Map();
  
  teamRecords.forEach((records, teamKey) => {
    const teamOPR = oprMap.get(teamKey) || 0;
    
    let totalTeammateOPR = 0;
    let matchCount = 0;
    
    records.forEach(record => {
      const teammateOPRs = record.teammates.map(teammate => oprMap.get(teammate) || 0);
      const avgTeammateOPR = teammateOPRs.length > 0 ? 
        teammateOPRs.reduce((sum, opr) => sum + opr, 0) / teammateOPRs.length : 0;
      
      totalTeammateOPR += avgTeammateOPR;
      matchCount++;
    });
    
    const avgTeammateOPR = matchCount > 0 ? totalTeammateOPR / matchCount : 0;
    const carryRatio = avgTeammateOPR > 0 ? teamOPR / avgTeammateOPR : 1;
    
    carryRatios.set(teamKey, carryRatio);
  });
  
  return carryRatios;
};

export const calculatePointDeltas = (teamRecords) => {
  const pointDeltas = new Map();
  const allMatches = [];
  
  teamRecords.forEach(records => {
    records.forEach(record => {
      const matchKey = `${record.matchKey}_${record.alliance}`;
      if (!allMatches.find(m => m.key === matchKey)) {
        allMatches.push({
          key: matchKey,
          teams: [record.teamKey, ...record.teammates],
          score: record.allianceScore
        });
      }
    });
  });
  
  teamRecords.forEach((records, teamKey) => {
    const matchesWith = allMatches.filter(match => match.teams.includes(teamKey));
    const avgScoreWith = matchesWith.length > 0 ? 
      matchesWith.reduce((sum, match) => sum + match.score, 0) / matchesWith.length : 0;
    
    const matchesWithout = allMatches.filter(match => !match.teams.includes(teamKey));
    const avgScoreWithout = matchesWithout.length > 0 ? 
      matchesWithout.reduce((sum, match) => sum + match.score, 0) / matchesWithout.length : 0;
    
    pointDeltas.set(teamKey, avgScoreWith - avgScoreWithout);
  });
  
  return pointDeltas;
};

export const generateAllianceSuggestions = (yourTeam, selectedPartner, oprMap, carryRatios, teamRecords) => {
  const yourOPR = oprMap.get(yourTeam) || 0;
  const partnerOPR = selectedPartner ? (oprMap.get(selectedPartner) || 0) : 0;
  
  const suggestions = [];
  
  oprMap.forEach((opr, teamKey) => {
    if (teamKey === yourTeam || teamKey === selectedPartner) return;
    
    const predictedScore = yourOPR + partnerOPR + opr;
    const carryRatio = carryRatios.get(teamKey) || 1;
    const records = teamRecords.get(teamKey) || [];
    
    const scores = records.map(r => r.allianceScore);
    const avgScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
    const variance = scores.length > 1 ? 
      scores.reduce((sum, score) => sum + Math.pow(score - avgScore, 2), 0) / scores.length : 0;
    const stdDev = Math.sqrt(variance);
    const consistency = avgScore > 0 ? Math.max(0, 100 - (stdDev / avgScore) * 100) : 50;
    
    const riskAdjustedScore = predictedScore - (stdDev * 0.5);
    
    suggestions.push({
      teamKey,
      opr,
      predictedScore,
      riskAdjustedScore,
      carryRatio,
      consistency,
      matchCount: records.length,
      label: getCarryLabel(carryRatio)
    });
  });
  
  suggestions.sort((a, b) => b.riskAdjustedScore - a.riskAdjustedScore);
  
  return suggestions.slice(0, 20);
};

const getCarryLabel = (ratio) => {
  if (ratio > 1.2) return 'Carrier';
  if (ratio < 0.8) return 'Carried';
  return 'Balanced';
};
