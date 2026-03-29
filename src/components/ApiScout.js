import React, { useState, useEffect, useMemo } from 'react';
import {
  fetchEventsByRegion,
  fetchEventMatches,
  fetchEventTeams,
  fetchEventRankings,
  fetchEventAlliances,
  fetchTeamMatchesYear,
  parseMatchesToTeamRecords,
  calculateOPR,
  calculateCarryRatios,
  calculatePointDeltas,
} from '../utils/tbaApi';
import './ApiScout.css';

const gaussianRandom = () => {
  const u1 = Math.random() + 1e-10;
  const u2 = Math.random();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
};

const getEventStatus = (event) => {
  if (!event?.start_date) return 'unknown';
  const today = new Date();
  const start = new Date(event.start_date + 'T00:00:00');
  const end = new Date(event.end_date + 'T23:59:59');
  if (today < start) return 'future';
  if (today > end) return 'past';
  return 'live';
};

const simulateDraftRun = (rankedTeams) => {
  const roleMap = new Map();
  const pickTimeMap = new Map();
  const allianceSeedMap = new Map();

  const numCaptains = Math.min(8, rankedTeams.length);
  let captainList = rankedTeams.slice(0, numCaptains).map(t => ({ ...t }));
  const poolQueue = rankedTeams.slice(numCaptains).map(t => ({ ...t }));
  const picked = new Set();

  const alliances = captainList.map((captain, i) => ({
    seed: i + 1,
    captain: { ...captain },
    pick1: null,
    pick2: null
  }));

  captainList.forEach((cap, i) => {
    roleMap.set(cap.teamKey, 'captain');
    pickTimeMap.set(cap.teamKey, -1);
    allianceSeedMap.set(cap.teamKey, i + 1);
  });

  const getAvailable = () => rankedTeams.filter(t => !picked.has(t.teamKey));
  let globalPick = 0;

  const handlePick = (alliance, round) => {
    picked.add(alliance.captain.teamKey);
    const available = getAvailable();
    if (available.length === 0) return;
    const best = [...available].sort((a, b) => b.strengthScore - a.strengthScore)[0];

    if (round === 1) alliance.pick1 = best;
    else alliance.pick2 = best;

    roleMap.set(best.teamKey, round === 1 ? 'pick1' : 'pick2');
    pickTimeMap.set(best.teamKey, globalPick++);
    allianceSeedMap.set(best.teamKey, alliance.seed);
    picked.add(best.teamKey);

    if (captainList.some(c => c.teamKey === best.teamKey)) {
      captainList = captainList.filter(c => c.teamKey !== best.teamKey);
      const next = poolQueue.find(t => !picked.has(t.teamKey) && !captainList.some(c => c.teamKey === t.teamKey));
      if (next) {
        captainList = [...captainList, { ...next }];
        roleMap.set(next.teamKey, 'captain');
        pickTimeMap.set(next.teamKey, -1);
        allianceSeedMap.set(next.teamKey, captainList.length);
      }
      alliances.forEach((a, idx) => { if (captainList[idx]) a.captain = captainList[idx]; });
    }
  };

  for (let i = 0; i < alliances.length; i++) handlePick(alliances[i], 1);
  for (let i = alliances.length - 1; i >= 0; i--) handlePick(alliances[i], 2);

  rankedTeams.forEach(t => {
    if (!roleMap.has(t.teamKey)) {
      roleMap.set(t.teamKey, 'notPicked');
      pickTimeMap.set(t.teamKey, Infinity);
    }
  });

  return { roleMap, pickTimeMap, allianceSeedMap };
};

const computeBaseRanked = (teamStats) => {
  const oprValues = teamStats.map(t => t.opr);
  const avgScoreValues = teamStats.map(t => t.avgScore);
  const minOPR = Math.min(...oprValues), maxOPR = Math.max(...oprValues);
  const minAvg = Math.min(...avgScoreValues), maxAvg = Math.max(...avgScoreValues);
  return teamStats.map(team => {
    const normOPR = maxOPR > minOPR ? (team.opr - minOPR) / (maxOPR - minOPR) : 0;
    const normAvg = maxAvg > minAvg ? (team.avgScore - minAvg) / (maxAvg - minAvg) : 0;
    return { ...team, strengthScore: 0.5 * normAvg + 0.5 * normOPR };
  });
};

const runAllianceMonteCarlo = (teamStats, targetKey, N = 300) => {
  const baseRanked = computeBaseRanked(teamStats);
  const n = baseRanked.length;
  const counts = { captain: 0, pick1: 0, pick2: 0, notPicked: 0 };
  const teamPickTimes = new Map();
  baseRanked.forEach(t => teamPickTimes.set(t.teamKey, []));

  const RANK_SIGMA = 1.5;
  const STRENGTH_NOISE = 0.08;

  for (let i = 0; i < N; i++) {
    const noisyTeams = baseRanked.map((t, idx) => {
      const baseRank = t.tbaRank === Infinity ? idx + n + 1 : t.tbaRank;
      return {
        ...t,
        _noisyRank: baseRank + gaussianRandom() * RANK_SIGMA,
        strengthScore: Math.max(0, Math.min(1, t.strengthScore + gaussianRandom() * STRENGTH_NOISE))
      };
    });
    const reordered = [...noisyTeams].sort((a, b) => a._noisyRank - b._noisyRank);
    const { roleMap, pickTimeMap } = simulateDraftRun(reordered);
    const role = roleMap.get(targetKey) || 'notPicked';
    counts[role]++;
    baseRanked.forEach(t => {
      const arr = teamPickTimes.get(t.teamKey);
      if (arr) arr.push(pickTimeMap.get(t.teamKey) ?? Infinity);
    });
  }

  const myActiveTimes = (teamPickTimes.get(targetKey) || []).filter(t => t !== Infinity);
  const adjusted = [...myActiveTimes].sort((a, b) => a - b).map(t => Math.max(0, t));
  const myMedianPickTime = adjusted.length > 0 ? adjusted[Math.floor(adjusted.length / 2)] : 4;

  const availabilityMap = new Map();
  teamPickTimes.forEach((times, teamKey) => {
    if (teamKey === targetKey) return;
    const avail = times.filter(t => t > myMedianPickTime).length;
    availabilityMap.set(teamKey, times.length > 0 ? (avail / times.length) * 100 : 50);
  });

  const FLOOR = 0.8;
  const raw = {
    captain:   Math.max(FLOOR, (counts.captain   / N) * 100),
    pick1:     Math.max(FLOOR, (counts.pick1     / N) * 100),
    pick2:     Math.max(FLOOR, (counts.pick2     / N) * 100),
    notPicked: Math.max(FLOOR, (counts.notPicked / N) * 100),
  };
  const total = raw.captain + raw.pick1 + raw.pick2 + raw.notPicked;

  return {
    captainPct:   (raw.captain   / total) * 100,
    pick1Pct:     (raw.pick1     / total) * 100,
    pick2Pct:     (raw.pick2     / total) * 100,
    notPickedPct: (raw.notPicked / total) * 100,
    availabilityMap
  };
};

const allianceWinProb = (oprA, oprB, scale) => 1 / (1 + Math.exp(-(oprA - oprB) / scale));

const simulatePlayoffBracket = (alliances8, mySeed, scale) => {
  const wp = (a, b) => allianceWinProb(a, b, scale);
  const oprMap = new Map(alliances8.map(a => [a.seed, a.totalOPR]));
  const qfPairs = [[1, 8], [4, 5], [2, 7], [3, 6]];
  const myQFPairIdx = qfPairs.findIndex(p => p.includes(mySeed));
  if (myQFPairIdx === -1) return 0;
  const myOPR = oprMap.get(mySeed) || 0;
  const myQFOppSeed = qfPairs[myQFPairIdx].find(s => s !== mySeed);
  if (Math.random() >= wp(myOPR, oprMap.get(myQFOppSeed) || 0)) return 0;
  let wins = 1;
  const sfPairMap = { 0: 1, 1: 0, 2: 3, 3: 2 };
  const adjIdx = sfPairMap[myQFPairIdx];
  const [a1, a2] = qfPairs[adjIdx];
  const sfOppSeed = Math.random() < wp(oprMap.get(a1) || 0, oprMap.get(a2) || 0) ? a1 : a2;
  if (Math.random() >= wp(myOPR, oprMap.get(sfOppSeed) || 0)) return wins;
  wins++;
  const otherIdxs = [0, 1, 2, 3].filter(i => i !== myQFPairIdx && i !== adjIdx);
  const fCandidates = otherIdxs.map(idx => {
    const [b1, b2] = qfPairs[idx];
    return Math.random() < wp(oprMap.get(b1) || 0, oprMap.get(b2) || 0) ? b1 : b2;
  });
  let fOppSeed = fCandidates[0];
  if (fCandidates.length === 2)
    fOppSeed = Math.random() < wp(oprMap.get(fCandidates[0]) || 0, oprMap.get(fCandidates[1]) || 0)
      ? fCandidates[0] : fCandidates[1];
  if (Math.random() >= wp(myOPR, oprMap.get(fOppSeed) || 0)) return wins;
  return wins + 1;
};

const predictPlayoffWins = (alliances8, mySeed, N = 500) => {
  if (!mySeed || !alliances8 || alliances8.length < 2) return null;

  const avgOPR = alliances8.reduce((s, a) => s + a.totalOPR, 0) / alliances8.length;
  const scale = Math.max(20, avgOPR * 0.4);

  let totalWins = 0, championships = 0;
  for (let i = 0; i < N; i++) {
    const w = simulatePlayoffBracket(alliances8, mySeed, scale);
    totalWins += w;
    if (w === 3) championships++;
  }
  return { expectedWins: totalWins / N, championPct: (championships / N) * 100, maxWins: 3 };
};

const ApiScout = () => {
  const [regions, setRegions] = useState({});
  const [selectedRegion, setSelectedRegion] = useState('');
  const [selectedEvent, setSelectedEvent] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [error, setError] = useState('');
  const [eventData, setEventData] = useState(null);
  const [analysisMode, setAnalysisMode] = useState('overview');
  const [scoreboardMode, setScoreboardMode] = useState('live');
  const [allianceAnalysisTeam, setAllianceAnalysisTeam] = useState('');
  const [matchSearch, setMatchSearch] = useState('');
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const [tooltipContent, setTooltipContent] = useState('');

  useEffect(() => { loadRegions(); }, []);

  const loadRegions = async () => {
    try {
      setLoading(true);
      setError('');
      setRegions(await fetchEventsByRegion());
    } catch (err) {
      setError(`Failed to load regions: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const loadEventData = async () => {
    if (!selectedEvent) return;
    try {
      setLoading(true);
      setLoadingMessage('');
      setError('');

      const eventObj = regions[selectedRegion]?.find(e => e.key === selectedEvent);
      const eventStatus = getEventStatus(eventObj);
      const year = parseInt(selectedEvent.substring(0, 4)) || new Date().getFullYear();

      const [matches, teams, rankingsData, alliancesData] = await Promise.all([
        fetchEventMatches(selectedEvent),
        fetchEventTeams(selectedEvent),
        fetchEventRankings(selectedEvent).catch(() => null),
        fetchEventAlliances(selectedEvent).catch(() => null)
      ]);

      let teamRecords, oprMap, carryRatios, pointDeltas, rankMap, pastDataInfo = null;

      const hasMatchData = matches.some(m => m.comp_level === 'qm' && m.alliances?.red?.score >= 0);
      const needsPastData = eventStatus === 'future' || (eventStatus === 'live' && !hasMatchData);

      if (needsPastData) {
        const teamKeys = teams.map(t => `frc${t.team_number}`);
        const BATCH = 10;
        const allPastMatches = [];

        for (let i = 0; i < teamKeys.length; i += BATCH) {
          const batch = teamKeys.slice(i, i + BATCH);
          setLoadingMessage(`Fetching past data: ${i}/${teamKeys.length} teams…`);
          const results = await Promise.all(batch.map(k => fetchTeamMatchesYear(k, year).catch(() => [])));
          results.forEach(ms => allPastMatches.push(...ms));
        }
        setLoadingMessage('');

        const seen = new Set();
        const pastQuals = allPastMatches.filter(m => {
          if (seen.has(m.key)) return false;
          seen.add(m.key);
          return (
            m.comp_level === 'qm' &&
            m.event_key !== selectedEvent &&
            m.alliances?.red?.score >= 0 &&
            m.alliances?.blue?.score >= 0 &&
            m.score_breakdown != null
          );
        });

        const pastEventKeys = new Set(pastQuals.map(m => m.event_key));

        const registeredKeys = new Set(teams.map(t => String(t.team_number)));

        const allTeamRecords = parseMatchesToTeamRecords(pastQuals);
        const allOprMap = calculateOPR(allTeamRecords);
        const allCarryRatios = calculateCarryRatios(allTeamRecords, allOprMap);
        const allPointDeltas = calculatePointDeltas(allTeamRecords);

        teamRecords = new Map([...allTeamRecords].filter(([k]) => registeredKeys.has(k)));
        oprMap      = new Map([...allOprMap].filter(([k]) => registeredKeys.has(k)));
        carryRatios = new Map([...allCarryRatios].filter(([k]) => registeredKeys.has(k)));
        pointDeltas = new Map([...allPointDeltas].filter(([k]) => registeredKeys.has(k)));

        rankMap = new Map();
        pastDataInfo = { matchCount: pastQuals.length, eventCount: pastEventKeys.size };
      } else {
        teamRecords = parseMatchesToTeamRecords(matches);
        oprMap = calculateOPR(teamRecords);
        carryRatios = calculateCarryRatios(teamRecords, oprMap);
        pointDeltas = calculatePointDeltas(teamRecords);
        rankMap = new Map();
        rankingsData?.rankings?.forEach(r => rankMap.set(r.team_key.replace('frc', ''), r.rank));
      }

      const actualAlliances = (alliancesData?.length > 0 && alliancesData[0]?.picks?.length > 0)
        ? alliancesData : null;

      setEventData({
        event: eventObj,
        eventStatus,
        matches,
        teams,
        teamRecords,
        oprMap,
        carryRatios,
        pointDeltas,
        rankMap,
        actualAlliances,
        pastDataInfo
      });

      setScoreboardMode(rankMap.size > 0 ? 'live' : 'predicted');
      setAnalysisMode('overview');
    } catch (err) {
      setError(`Failed to load event data: ${err.message}`);
    } finally {
      setLoading(false);
      setLoadingMessage('');
    }
  };

  const getCarryLabel = (ratio) => {
    if (ratio > 1.2) return 'Carrier';
    if (ratio < 0.8) return 'Carried';
    return 'Balanced';
  };

  const getCarryColor = (ratio) => {
    if (ratio > 1.2) return '#10b981';
    if (ratio < 0.8) return '#ef4444';
    return '#6b7280';
  };

  const handleTooltipMouseEnter = (event, content) => {
    const rect = event.target.getBoundingClientRect();
    setTooltipPosition({ x: rect.left + rect.width / 2, y: rect.bottom + 10 });
    setTooltipContent(content);
    setShowTooltip(true);
  };
  const handleTooltipMouseLeave = () => setShowTooltip(false);

  const teamStats = useMemo(() => {
    if (!eventData) return [];
    const stats = [];
    const processedKeys = new Set();

    eventData.teamRecords.forEach((records, teamKey) => {
      processedKeys.add(teamKey);
      const opr = eventData.oprMap.get(teamKey) || 0;
      const carryRatio = eventData.carryRatios.get(teamKey) || 1;
      const pointDelta = eventData.pointDeltas.get(teamKey) || 0;
      const scores = records.map(r => r.allianceScore);
      const avgScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
      const variance = scores.length > 1
        ? scores.reduce((sum, s) => sum + Math.pow(s - avgScore, 2), 0) / scores.length : 0;
      const stdDev = Math.sqrt(variance);
      const wins = records.filter(r => r.win).length;
      const losses = records.filter(r => !r.win).length;
      const winRate = records.length > 0 ? (wins / records.length) * 100 : 0;
      const totalRP = records.reduce((sum, r) => sum + (r.rankingPoints || 0), 0);
      const avgRP = records.length > 0 ? totalRP / records.length : 0;
      stats.push({
        teamKey, teamNumber: parseInt(teamKey),
        tbaRank: eventData.rankMap.get(teamKey) ?? Infinity,
        opr, carryRatio, pointDelta, avgScore,
        maxScore: Math.max(...scores, 0),
        minScore: Math.min(...scores, Infinity) === Infinity ? 0 : Math.min(...scores),
        stdDev, consistency: avgScore > 0 ? Math.max(0, 100 - (stdDev / avgScore) * 100) : 50,
        matchCount: records.length, winRate, wins, losses, totalRP, avgRP,
        record: `${wins}-${losses}`,
        carryLabel: getCarryLabel(carryRatio),
        qualScore: (wins * 1000) + avgRP,
        noData: false
      });
    });

    if (eventData.pastDataInfo) {
      eventData.teams?.forEach(team => {
        const key = String(team.team_number);
        if (!processedKeys.has(key)) {
          stats.push({
            teamKey: key, teamNumber: team.team_number, tbaRank: Infinity,
            opr: 0, carryRatio: 1, pointDelta: 0, avgScore: 0, maxScore: 0, minScore: 0,
            stdDev: 0, consistency: 50, matchCount: 0, winRate: 0, wins: 0, losses: 0,
            totalRP: 0, avgRP: 0, record: '—', carryLabel: 'Unknown', qualScore: 0, noData: true
          });
        }
      });
    }

    return stats.sort((a, b) => {
      if (a.tbaRank === Infinity && b.tbaRank === Infinity) return b.opr - a.opr;
      if (a.tbaRank === Infinity) return 1;
      if (b.tbaRank === Infinity) return -1;
      return a.tbaRank - b.tbaRank;
    });
  }, [eventData]);

  const matchesWithPredictions = useMemo(() => {
    if (!eventData) return [];
    return eventData.matches
      .filter(m => m.comp_level === 'qm' || m.comp_level === 'sf' || m.comp_level === 'f')
      .sort((a, b) => {
        const levelOrder = { qm: 0, sf: 1, f: 2 };
        const la = levelOrder[a.comp_level] ?? 3;
        const lb = levelOrder[b.comp_level] ?? 3;
        if (la !== lb) return la - lb;
        return a.match_number - b.match_number;
      })
      .map(m => {
        const redTeams = (m.alliances?.red?.team_keys || []).map(k => k.replace('frc', ''));
        const blueTeams = (m.alliances?.blue?.team_keys || []).map(k => k.replace('frc', ''));
        const actualRed = m.alliances?.red?.score ?? -1;
        const actualBlue = m.alliances?.blue?.score ?? -1;
        const isPlayed = actualRed >= 0 && actualBlue >= 0;
        const predRed = Math.round(redTeams.reduce((s, k) => s + (eventData.oprMap.get(k) || 0), 0));
        const predBlue = Math.round(blueTeams.reduce((s, k) => s + (eventData.oprMap.get(k) || 0), 0));
        const levelLabel = m.comp_level === 'qm' ? `QM ${m.match_number}`
          : m.comp_level === 'sf' ? `SF ${m.set_number}-${m.match_number}`
          : `F ${m.set_number}-${m.match_number}`;
        return { key: m.key, levelLabel, redTeams, blueTeams, isPlayed, actualRed, actualBlue, predRed, predBlue };
      });
  }, [eventData]);

  const predictedRankings = useMemo(() => {
    if (!teamStats.length) return [];

    const qualMatches = matchesWithPredictions.filter(m => m.levelLabel.startsWith('QM'));
    if (qualMatches.length > 0) {
      const simMap = new Map();
      teamStats.forEach(t => simMap.set(t.teamKey, { wins: 0, losses: 0, totalScore: 0, count: 0 }));

      qualMatches.forEach(m => {
        const redScore = m.isPlayed ? m.actualRed : m.predRed;
        const blueScore = m.isPlayed ? m.actualBlue : m.predBlue;
        const redWon = redScore > blueScore;
        const blueWon = blueScore > redScore;

        m.redTeams.forEach(k => {
          const s = simMap.get(k);
          if (!s) return;
          s.count++; s.totalScore += redScore;
          if (redWon) s.wins++; else if (blueWon) s.losses++;
        });
        m.blueTeams.forEach(k => {
          const s = simMap.get(k);
          if (!s) return;
          s.count++; s.totalScore += blueScore;
          if (blueWon) s.wins++; else if (redWon) s.losses++;
        });
      });

      return [...teamStats]
        .map(t => {
          const sim = simMap.get(t.teamKey);
          if (!sim || sim.count === 0) return { ...t };
          return {
            ...t,
            winRate: (sim.wins / sim.count) * 100,
            avgScore: sim.totalScore / sim.count,
            record: `${sim.wins}-${sim.losses}`,
            wins: sim.wins, losses: sim.losses, matchCount: sim.count,
          };
        })
        .sort((a, b) => b.wins !== a.wins ? b.wins - a.wins : b.avgScore - a.avgScore)
        .map((t, i) => ({ ...t, predictedRank: i + 1 }));
    }

    return [...teamStats]
      .sort((a, b) => b.wins !== a.wins ? b.wins - a.wins : b.avgScore - a.avgScore)
      .map((t, i) => ({ ...t, predictedRank: i + 1 }));
  }, [teamStats, matchesWithPredictions]);

  const allianceSelectionSimulation = useMemo(() => {
    if (!eventData) return null;
    const allTeams = [...teamStats];
    const oprValues = allTeams.map(t => t.opr);
    const avgScoreValues = allTeams.map(t => t.avgScore);
    const minOPR = Math.min(...oprValues), maxOPR = Math.max(...oprValues);
    const minAvg = Math.min(...avgScoreValues), maxAvg = Math.max(...avgScoreValues);

    const rankedTeams = allTeams.map((team, index) => {
      const nOPR = maxOPR > minOPR ? (team.opr - minOPR) / (maxOPR - minOPR) : 0;
      const nAvg = maxAvg > minAvg ? (team.avgScore - minAvg) / (maxAvg - minAvg) : 0;
      return { ...team, normalizedOPR: nOPR, normalizedAvgScore: nAvg, strengthScore: 0.5 * nAvg + 0.5 * nOPR, rank: index + 1 };
    });

    const initialCaptainCount = Math.min(8, rankedTeams.length);
    let captainList = rankedTeams.slice(0, initialCaptainCount);
    const poolQueue = rankedTeams.slice(initialCaptainCount);
    const picked = new Set();

    const alliances = captainList.map((captain, index) => ({
      captain, pick1: null, pick2: null,
      strengthScore: captain.strengthScore, totalOPR: captain.opr,
      predictedScore: 0, allianceNumber: index + 1, captainSeed: index + 1
    }));

    const getAvailable = () => rankedTeams.filter(t => !picked.has(t.teamKey));
    const handlePick = (alliance, round) => {
      picked.add(alliance.captain.teamKey);
      const available = getAvailable();
      if (available.length === 0) return;
      const best = [...available].sort((a, b) => b.strengthScore - a.strengthScore)[0];
      if (round === 1) alliance.pick1 = best; else alliance.pick2 = best;
      alliance.strengthScore += best.strengthScore;
      alliance.totalOPR += best.opr;
      picked.add(best.teamKey);
      if (captainList.some(c => c.teamKey === best.teamKey)) {
        captainList = captainList.filter(c => c.teamKey !== best.teamKey);
        const next = poolQueue.find(t => !picked.has(t.teamKey) && !captainList.some(c => c.teamKey === t.teamKey));
        if (next) captainList.push(next);
        alliances.forEach((a, i) => { if (captainList[i]) a.captain = captainList[i]; });
      }
    };

    for (let i = 0; i < alliances.length; i++) handlePick(alliances[i], 1);
    for (let i = alliances.length - 1; i >= 0; i--) handlePick(alliances[i], 2);
    alliances.forEach(a => { a.predictedScore = a.totalOPR; });
    return { alliances, backupTeams: rankedTeams.filter(t => !picked.has(t.teamKey)) };
  }, [eventData, teamStats]);

  const allianceAnalysisData = useMemo(() => {
    if (!eventData || !allianceAnalysisTeam || !allianceSelectionSimulation) return null;
    const targetKey = allianceAnalysisTeam;
    const usingRealData = !!eventData.actualAlliances;

    let alliances8;
    if (usingRealData) {
      alliances8 = eventData.actualAlliances.map((a, i) => {
        const keys = (a.picks || []).map(p => p.replace('frc', ''));
        const getStats = k => teamStats.find(t => t.teamKey === k);
        return {
          seed: i + 1,
          captain: getStats(keys[0]), pick1: getStats(keys[1]), pick2: getStats(keys[2]),
          totalOPR: keys.reduce((sum, k) => sum + (eventData.oprMap.get(k) || 0), 0)
        };
      });
    } else {
      alliances8 = allianceSelectionSimulation.alliances.map(a => ({
        seed: a.allianceNumber, captain: a.captain, pick1: a.pick1, pick2: a.pick2, totalOPR: a.totalOPR
      }));
    }

    let myAlliance = null, myRole = null;
    for (const a of alliances8) {
      if (a.captain?.teamKey === targetKey) { myAlliance = a; myRole = 'captain'; break; }
      if (a.pick1?.teamKey === targetKey) { myAlliance = a; myRole = 'pick1'; break; }
      if (a.pick2?.teamKey === targetKey) { myAlliance = a; myRole = 'pick2'; break; }
    }

    const { captainPct, pick1Pct, pick2Pct, notPickedPct, availabilityMap } =
      runAllianceMonteCarlo(teamStats, targetKey, 250);

    const allianceMembers = new Set(myAlliance
      ? [myAlliance.captain?.teamKey, myAlliance.pick1?.teamKey, myAlliance.pick2?.teamKey].filter(Boolean)
      : []);

    const candidates = teamStats
      .filter(t => t.teamKey !== targetKey && !allianceMembers.has(t.teamKey))
      .map(t => ({ ...t, availability: availabilityMap.get(t.teamKey) ?? 50 }))
      .sort((a, b) => b.opr - a.opr)
      .slice(0, 25);

    let reachTargets = candidates.filter(t => t.availability < 45).slice(0, 5);
    let safetyPicks = candidates.filter(t => t.availability >= 55).slice(0, 5);
    if (reachTargets.length === 0) reachTargets = candidates.slice(0, 3);
    if (safetyPicks.length === 0) safetyPicks = candidates.slice(-3);

    return {
      usingRealData, alliances8, myAlliance, myRole,
      captainPct, pick1Pct, pick2Pct, notPickedPct,
      reachTargets, safetyPicks,
      playoffPrediction: myAlliance ? predictPlayoffWins(alliances8, myAlliance.seed, 500) : null
    };
  }, [eventData, allianceAnalysisTeam, teamStats, allianceSelectionSimulation]);

  const hasLiveRankings = (eventData?.rankMap?.size || 0) > 0;
  const displayRows = scoreboardMode === 'live' ? teamStats : predictedRankings;

  return (
    <div className="api-scout">
      <div className="api-scout-header">
        <h2>API-Scout</h2>
        <p>Analyze any FRC competition using TBA data</p>
      </div>

      <div className="event-selector">
        <div className="selector-row">
          <div className="region-select">
            <label>Region:</label>
            <select value={selectedRegion} onChange={(e) => { setSelectedRegion(e.target.value); setSelectedEvent(''); setEventData(null); }} disabled={loading}>
              <option value="">Select Region</option>
              {Object.keys(regions).sort().map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div className="event-select">
            <label>Event:</label>
            <select value={selectedEvent} onChange={(e) => setSelectedEvent(e.target.value)} disabled={!selectedRegion || loading}>
              <option value="">Select Event</option>
              {selectedRegion && regions[selectedRegion]?.map(ev => (
                <option key={ev.key} value={ev.key}>{ev.name} ({ev.start_date})</option>
              ))}
            </select>
          </div>
          <button className="load-btn" onClick={loadEventData} disabled={!selectedEvent || loading}>
            {loading ? (loadingMessage || 'Loading…') : 'Analyze Event'}
          </button>
        </div>
        {loading && loadingMessage && (
          <div className="fetch-progress-bar">
            <div className="fetch-progress-inner" />
          </div>
        )}
      </div>

      {error && <div className="error-message">{error}</div>}

      {eventData && (
        <div className="analysis-content">
          {eventData.pastDataInfo && (
            <div className="event-status-bar future">
              Predictive — Based on {eventData.pastDataInfo.matchCount} qual matches
              from {eventData.pastDataInfo.eventCount} prior events
              {eventData.eventStatus === 'live' ? ' (quals not yet started)' : ` (no live data yet for ${eventData.event?.name})`}
            </div>
          )}
          {eventData.eventStatus === 'live' && !eventData.pastDataInfo && (
            <div className="event-status-bar live">
              Live — {eventData.event?.name} is currently in progress
            </div>
          )}

          <div className="analysis-tabs">
            <button className={`tab ${analysisMode === 'overview' ? 'active' : ''}`} onClick={() => setAnalysisMode('overview')}>Team Overview</button>
            <button className={`tab ${analysisMode === 'alliance-analysis' ? 'active' : ''}`} onClick={() => setAnalysisMode('alliance-analysis')}>Alliance Analysis</button>
            <button className={`tab ${analysisMode === 'alliance-predictor' ? 'active' : ''}`} onClick={() => setAnalysisMode('alliance-predictor')}>Alliance Predictor</button>
            <button className={`tab ${analysisMode === 'matches' ? 'active' : ''}`} onClick={() => setAnalysisMode('matches')}>Matches</button>
          </div>

          {analysisMode === 'overview' && (
            <div className="overview-content">
              <div className="event-info">
                <h3>{eventData.event?.name}</h3>
                <p>
                  {eventData.pastDataInfo
                    ? `${teamStats.length} registered teams • ${eventData.pastDataInfo.matchCount} past matches analyzed`
                    : `${eventData.matches.length} matches analyzed • ${teamStats.length} teams`
                  }
                </p>
              </div>

              <div className="scoreboard-toggle-wrap">
                <button
                  className={`scoreboard-toggle-btn ${scoreboardMode === 'predicted' ? 'active' : ''}`}
                  onClick={() => setScoreboardMode('predicted')}
                >
                  Predicted Scoreboard
                </button>
                {hasLiveRankings && (
                  <button
                    className={`scoreboard-toggle-btn ${scoreboardMode === 'live' ? 'active' : ''}`}
                    onClick={() => setScoreboardMode('live')}
                  >
                    Live Scoreboard
                  </button>
                )}
              </div>

              <div className="team-rankings">
                <div className="rankings-table">
                  <div className="table-header">
                    <span>Rank</span>
                    <span>Team</span>
                    <span className="opr-header">
                      OPR
                      <span className="tooltip-trigger"
                        onMouseEnter={(e) => handleTooltipMouseEnter(e, "Offensive Power Rating — statistical measure of a team's average point contribution")}
                        onMouseLeave={handleTooltipMouseLeave}>?</span>
                    </span>
                    <span>Carry Status</span>
                    <span className="avg-score-header">
                      Avg Score
                      <span className="tooltip-trigger"
                        onMouseEnter={(e) => handleTooltipMouseEnter(e, "Average alliance total score for matches this team played")}
                        onMouseLeave={handleTooltipMouseLeave}>?</span>
                    </span>
                    <span>Consistency</span>
                    <span>Win %</span>
                  </div>
                  {displayRows.map((team) => (
                    <div key={team.teamKey} className={`table-row${team.noData ? ' no-data-row' : ''}`}>
                      <span className="rank">
                        #{scoreboardMode === 'live'
                          ? (team.tbaRank === Infinity ? '?' : team.tbaRank)
                          : team.predictedRank}
                      </span>
                      <span className="team-number">{team.teamNumber}</span>
                      <span className="opr">{team.noData ? '—' : team.opr.toFixed(1)}</span>
                      <span className="carry-status" style={{ color: team.noData ? '#9ca3af' : getCarryColor(team.carryRatio) }}>
                        {team.carryLabel}
                      </span>
                      <span className="avg-score">{team.noData ? '—' : team.avgScore.toFixed(1)}</span>
                      <span className="consistency">{team.noData ? '—' : `${team.consistency.toFixed(1)}%`}</span>
                      <span className="matches">{team.noData ? '—' : `${team.winRate.toFixed(1)}% (${team.record})`}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {analysisMode === 'alliance-analysis' && (
            <div className="alliance-analysis-content">
              <div className="team-selector centered">
                <label>Select Team:</label>
                <select value={allianceAnalysisTeam} onChange={e => setAllianceAnalysisTeam(e.target.value)}>
                  <option value="">Choose your team</option>
                  {teamStats.map(team => (
                    <option key={team.teamKey} value={team.teamKey}>Team {team.teamNumber}</option>
                  ))}
                </select>
              </div>

              {allianceAnalysisTeam && allianceAnalysisData && (() => {
                const { usingRealData, myAlliance, myRole, captainPct, pick1Pct, pick2Pct, notPickedPct, reachTargets, safetyPicks, playoffPrediction } = allianceAnalysisData;
                const myTeamNumber = teamStats.find(t => t.teamKey === allianceAnalysisTeam)?.teamNumber;
                return (
                  <>
                    <div className={`data-source-banner ${usingRealData ? 'real' : 'predicted'}`}>
                      {usingRealData ? 'Alliance selection data is published — showing actual alliances'
                        : 'Alliance selection not yet published — using predicted alliances'}
                    </div>

                    {myAlliance ? (
                      <div className="aa-your-alliance">
                        <h4>Your Alliance — Seed {myAlliance.seed}</h4>
                        <div className="aa-alliance-card">
                          <div className={`aa-role-badge aa-role-${myRole}`}>
                            {myRole === 'captain' ? 'You are Captain' : myRole === 'pick1' ? 'You are 1st Pick' : 'You are 2nd Pick'}
                          </div>
                          <div className="alliance-teams">
                            {myAlliance.captain && (
                              <div className={`team-slot captain${myAlliance.captain.teamKey === allianceAnalysisTeam ? ' highlighted' : ''}`}>
                                <span className="role">Captain</span>
                                <span className="team-number">{myAlliance.captain.teamNumber}</span>
                                <span className="team-stats">{myAlliance.captain.record} • OPR: {myAlliance.captain.opr.toFixed(1)}</span>
                              </div>
                            )}
                            {myAlliance.pick1 && (
                              <div className={`team-slot pick1${myAlliance.pick1.teamKey === allianceAnalysisTeam ? ' highlighted' : ''}`}>
                                <span className="role">1st Pick</span>
                                <span className="team-number">{myAlliance.pick1.teamNumber}</span>
                                <span className="team-stats">{myAlliance.pick1.record} • OPR: {myAlliance.pick1.opr.toFixed(1)}</span>
                              </div>
                            )}
                            {myAlliance.pick2 && (
                              <div className={`team-slot pick2${myAlliance.pick2.teamKey === allianceAnalysisTeam ? ' highlighted' : ''}`}>
                                <span className="role">2nd Pick</span>
                                <span className="team-number">{myAlliance.pick2.teamNumber}</span>
                                <span className="team-stats">{myAlliance.pick2.record} • OPR: {myAlliance.pick2.opr.toFixed(1)}</span>
                              </div>
                            )}
                          </div>
                          <div className="aa-alliance-opr">Alliance Total OPR: <strong>{myAlliance.totalOPR.toFixed(1)}</strong></div>
                        </div>
                      </div>
                    ) : (
                      <div className="aa-not-on-alliance">Team {myTeamNumber} is not on a predicted playoff alliance.</div>
                    )}

                    <div className="aa-pick-pcts">
                      <h4>Selection Likelihood — Team {myTeamNumber}</h4>
                      <div className="aa-pct-grid">
                        {[
                          { pct: captainPct, label: 'Captain', color: '#1d4ed8' },
                          { pct: pick1Pct, label: '1st Pick', color: '#3b82f6' },
                          { pct: pick2Pct, label: '2nd Pick', color: '#60a5fa' },
                          { pct: notPickedPct, label: 'Not Picked', color: '#93c5fd' },
                        ].map(({ pct, label, color }) => (
                          <div key={label} className="aa-pct-card">
                            <div className="aa-pct-value" style={{ color }}>{pct.toFixed(1)}%</div>
                            <div className="aa-pct-label">{label}</div>
                            <div className="aa-pct-bar-track">
                              <div className="aa-pct-bar-fill" style={{ width: `${pct}%`, background: color }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="aa-reach-safety">
                      <div className="aa-reach-col">
                        <h4>Reach Targets</h4>
                        <p className="aa-col-desc">High-value teams often unavailable at your pick</p>
                        {reachTargets.length === 0 ? <p className="aa-empty">No clear reach targets</p>
                          : reachTargets.map(team => (
                            <div key={team.teamKey} className="aa-pick-card aa-reach">
                              <div className="aa-pick-team">Team {team.teamNumber}</div>
                              <div className="aa-pick-stats">
                                <span>OPR: {team.opr.toFixed(1)}</span>
                                <span className="aa-avail low">Available {team.availability.toFixed(0)}%</span>
                              </div>
                            </div>
                          ))}
                      </div>
                      <div className="aa-safety-col">
                        <h4>Safety Picks</h4>
                        <p className="aa-col-desc">Reliable quality teams likely still available</p>
                        {safetyPicks.length === 0 ? <p className="aa-empty">No clear safety picks</p>
                          : safetyPicks.map(team => (
                            <div key={team.teamKey} className="aa-pick-card aa-safety">
                              <div className="aa-pick-team">Team {team.teamNumber}</div>
                              <div className="aa-pick-stats">
                                <span>OPR: {team.opr.toFixed(1)}</span>
                                <span className="aa-avail high">Available {team.availability.toFixed(0)}%</span>
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>

                    {playoffPrediction && (
                      <div className="aa-playoff">
                        <h4>Playoff Win Prediction</h4>
                        {!usingRealData && <p className="aa-col-desc">Based on predicted alliance matchups</p>}
                        <div className="aa-playoff-stats">
                          <div className="aa-playoff-stat">
                            <div className="aa-playoff-val">{playoffPrediction.expectedWins.toFixed(1)}</div>
                            <div className="aa-playoff-label">Expected Wins</div>
                            <div className="aa-playoff-sub">out of {playoffPrediction.maxWins}</div>
                          </div>
                          <div className="aa-playoff-stat">
                            <div className="aa-playoff-val" style={{ color: '#3b82f6' }}>{playoffPrediction.championPct.toFixed(1)}%</div>
                            <div className="aa-playoff-label">Champion Probability</div>
                          </div>
                        </div>
                        <div className="aa-wins-track">
                          <div className="aa-wins-fill" style={{ width: `${(playoffPrediction.expectedWins / playoffPrediction.maxWins) * 100}%` }} />
                        </div>
                        <div className="aa-wins-labels">
                          <span>0 wins</span><span>QF</span><span>SF</span><span>Champions</span>
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          )}

          {analysisMode === 'alliance-predictor' && allianceSelectionSimulation && (
            <div className="alliance-predictor">
              <h3>Alliance Selection Predictor</h3>
              <p className="predictor-description">
                Simulates FRC alliance selection: top 8 ranked teams are captains, snake draft (1→8, then 8→1),
                picks weighted 50% avg score + 50% OPR. If a top-8 team is picked, the next ranked team is promoted.
              </p>
              <div className="predicted-alliances">
                <h4>Predicted Playoff Alliances</h4>
                <div className="alliances-grid">
                  {allianceSelectionSimulation.alliances.map((alliance, index) => (
                    <div key={index} className="alliance-card">
                      <div className="alliance-header">
                        <h5>Alliance {alliance.allianceNumber}</h5>
                        <div className="alliance-stats">
                          <span className="total-opr">Total OPR: {alliance.totalOPR.toFixed(1)}</span>
                          <span className="predicted-score">Predicted: {alliance.predictedScore.toFixed(1)}</span>
                        </div>
                      </div>
                      <div className="alliance-teams">
                        <div className="team-slot captain">
                          <span className="role">Captain #{alliance.captain.rank}</span>
                          <span className="team-number">{alliance.captain.teamNumber}</span>
                          <span className="team-stats">{alliance.captain.record} • OPR: {alliance.captain.opr.toFixed(1)}</span>
                        </div>
                        {alliance.pick1 && (
                          <div className="team-slot pick1">
                            <span className="role">1st Pick #{alliance.pick1.rank}</span>
                            <span className="team-number">{alliance.pick1.teamNumber}</span>
                            <span className="team-stats">{alliance.pick1.record} • OPR: {alliance.pick1.opr.toFixed(1)}</span>
                          </div>
                        )}
                        {alliance.pick2 && (
                          <div className="team-slot pick2">
                            <span className="role">2nd Pick #{alliance.pick2.rank}</span>
                            <span className="team-number">{alliance.pick2.teamNumber}</span>
                            <span className="team-stats">{alliance.pick2.record} • OPR: {alliance.pick2.opr.toFixed(1)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              {allianceSelectionSimulation.backupTeams.length > 0 && (
                <div className="backup-teams">
                  <h4>Backup Teams</h4>
                  <p>Available as replacements if alliance teams have robot issues:</p>
                  <div className="backup-list">
                    {allianceSelectionSimulation.backupTeams.slice(0, 10).map(team => (
                      <span key={team.teamKey} className="backup-team">{team.teamNumber} ({team.opr.toFixed(1)})</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {analysisMode === 'matches' && (() => {
            const searchKey = matchSearch.trim();
            const filteredMatches = searchKey
              ? matchesWithPredictions.filter(m =>
                  m.redTeams.includes(searchKey) || m.blueTeams.includes(searchKey))
              : matchesWithPredictions;
            return (
              <div className="matches-content">
                <div className="event-info">
                  <h3>{eventData.event?.name}</h3>
                  <p>
                    {matchesWithPredictions.length === 0
                      ? 'Match schedule not yet published — check back closer to the event'
                      : `${matchesWithPredictions.filter(m => m.isPlayed).length} played · ${matchesWithPredictions.filter(m => !m.isPlayed).length} predicted`
                    }
                  </p>
                </div>

                {matchesWithPredictions.length > 0 && (
                  <div className="match-search-wrap">
                    <input
                      type="text"
                      className="match-search-input"
                      placeholder="Filter by team number…"
                      value={matchSearch}
                      onChange={e => setMatchSearch(e.target.value.replace(/\D/g, ''))}
                    />
                    {searchKey && (
                      <button className="match-search-clear" onClick={() => setMatchSearch('')}>✕</button>
                    )}
                  </div>
                )}

                {matchesWithPredictions.length === 0 ? (
                  <div className="matches-empty">
                    <p>No match data available yet for this event.</p>
                    {eventData.eventStatus === 'future' && (
                      <p>Predicted scores will appear here once the match schedule is published.</p>
                    )}
                  </div>
                ) : filteredMatches.length === 0 ? (
                  <div className="matches-empty">
                    <p>No matches found for team {searchKey}.</p>
                  </div>
                ) : (
                  <div className="match-list">
                    {filteredMatches.map(m => {
                      const redWon = m.isPlayed && m.actualRed > m.actualBlue;
                      const blueWon = m.isPlayed && m.actualBlue > m.actualRed;
                      return (
                        <div key={m.key} className={`match-row${m.isPlayed ? '' : ' match-predicted'}`}>
                          <span className="match-label">{m.levelLabel}</span>
                          <div className="match-alliance red-alliance">
                            {m.redTeams.map(t => (
                              <span key={t} className={`match-team${t === searchKey ? ' match-team-highlight' : ''}`}>{t}</span>
                            ))}
                          </div>
                          <div className="match-scores">
                            <span className={`match-score red-score${redWon ? ' winner' : m.isPlayed ? ' loser' : ' pred'}`}>
                              {m.isPlayed ? m.actualRed : `~${m.predRed}`}
                            </span>
                            <span className="match-sep">—</span>
                            <span className={`match-score blue-score${blueWon ? ' winner' : m.isPlayed ? ' loser' : ' pred'}`}>
                              {m.isPlayed ? m.actualBlue : `~${m.predBlue}`}
                            </span>
                          </div>
                          <div className="match-alliance blue-alliance">
                            {m.blueTeams.map(t => (
                              <span key={t} className={`match-team${t === searchKey ? ' match-team-highlight' : ''}`}>{t}</span>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {showTooltip && (
        <div className="floating-tooltip" style={{
          position: 'fixed', left: tooltipPosition.x, top: tooltipPosition.y,
          transform: 'translateX(-50%)', zIndex: 10000, backgroundColor: '#1f2937',
          color: 'white', padding: '12px', borderRadius: '8px', fontSize: '13px',
          maxWidth: '300px', boxShadow: '0 4px 12px rgba(0,0,0,0.3)', pointerEvents: 'none'
        }}>
          {tooltipContent}
        </div>
      )}
    </div>
  );
};

export default ApiScout;
