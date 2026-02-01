import React, { useState, useEffect } from 'react';
import AlliancePositionGrid from './AlliancePositionGrid';
import StarRating from './StarRating';
import ChipSelect from './ChipSelect';
import CycleButton from './CycleButton';
import BigStepper from './BigStepper';
import ToggleButton from './ToggleButton';
import QRCode from 'qrcode';
import './Scout.css';

const Scout = () => {
  const [showQRModal, setShowQRModal] = useState(false);
  const [qrCodeDataURL, setQrCodeDataURL] = useState('');
  const [qrCodeMode, setQrCodeMode] = useState('data');
  const [formData, setFormData] = useState({
    initials: '',
    match: 1,
    team: '',
    position: null,
    increment: 4,
    auto: {
      fuel: 0,
      climb: 'No Climb',
      wonAuto: false,
      transitionShift: []
    },
    teleop: {
      shift1: { fuel: 0, defense: 0, defenseTags: [] },
      shift2: { fuel: 0, defense: 0, defenseTags: [] },
      shift3: { fuel: 0, defense: 0, defenseTags: [] },
      shift4: { fuel: 0, defense: 0, defenseTags: [] }
    },
    endgame: {
      climb: 'None',
      climbLevel: 'None',
      canDescend: false,
      died: false
    },
    keywords: []
  });

  const [activeShift, setActiveShift] = useState('shift1');

  useEffect(() => {
    const savedInitials = localStorage.getItem('scoutInitials');
    if (savedInitials) {
      setFormData(prev => ({ ...prev, initials: savedInitials }));
    }
  }, []);

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    if (field === 'initials') {
      localStorage.setItem('scoutInitials', value.toUpperCase());
    }
  };

  const handleNestedChange = (section, field, value) => {
    setFormData(prev => ({
      ...prev,
      [section]: { ...prev[section], [field]: value }
    }));
  };

  const handleShiftChange = (shift, field, value) => {
    setFormData(prev => ({
      ...prev,
      teleop: {
        ...prev.teleop,
        [shift]: { ...prev.teleop[shift], [field]: value }
      }
    }));
  };

  const handleClimbLevelChange = (newLevel) => {
    const targetLevel = formData.endgame.climbLevel === newLevel ? 'None' : newLevel;
    setFormData(prev => ({
      ...prev,
      endgame: {
        ...prev.endgame,
        climbLevel: targetLevel,
        climb: targetLevel !== 'None' ? 'Success' : prev.endgame.climb
      }
    }));
  };

  const getTotalFuel = () => {
    const { shift1, shift2, shift3, shift4 } = formData.teleop;
    return shift1.fuel + shift2.fuel + shift3.fuel + shift4.fuel;
  };

  const getTotalScore = () => {
    let score = 0;
    
    score += formData.auto.fuel * 2;
    if (formData.auto.climb === 'Climb' || formData.auto.climb === 'Pullup') score += 15;
    if (formData.auto.wonAuto) score += 4;
    
    score += getTotalFuel();
    
    if (formData.endgame.climbLevel === 'Level 1') score += 10;
    if (formData.endgame.climbLevel === 'Level 2') score += 20;
    if (formData.endgame.climbLevel === 'Level 3') score += 30;
    
    return score;
  };

  const getAutoScore = () => {
    let score = 0;
    score += formData.auto.fuel * 2;
    if (formData.auto.climb === 'Climb' || formData.auto.climb === 'Pullup') score += 15;
    if (formData.auto.wonAuto) score += 4;
    return score;
  };

  const getEndgameScore = () => {
    let score = 0;
    if (formData.endgame.climbLevel === 'Level 1') score += 10;
    if (formData.endgame.climbLevel === 'Level 2') score += 20;
    if (formData.endgame.climbLevel === 'Level 3') score += 30;
    return score;
  };

  const defenseTags = ['Aggressive', 'Smart driver', 'Feeds', 'Protected', 'Disruptive'];
  const keywordOptions = ['Fast', 'Reliable', 'Accurate', 'Strategic', 'Cooperative', 'Clutch'];

  const FIELDS = [
    'match',
    'team',
    'scouter',
    'position',
    'auto_fuel',
    'auto_climb',
    'auto_won',
    'auto_transition',
    'shift1_fuel',
    'shift1_defense',
    'shift1_defense_tags',
    'shift2_fuel',
    'shift2_defense',
    'shift2_defense_tags',
    'shift3_fuel',
    'shift3_defense',
    'shift3_defense_tags',
    'shift4_fuel',
    'shift4_defense',
    'shift4_defense_tags',
    'total_fuel',
    'endgame_climb',
    'endgame_climb_level',
    'endgame_descend',
    'endgame_died',
    'total_score',
    'keywords',
    'timestamp'
  ];

  const sanitize = (value) => {
    return String(value ?? '')
      .replace(/\t/g, ' ')
      .replace(/\r?\n/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  };

  const buildTSVHeaders = () => {
    const headers = {
      match: 'Match',
      team: 'Team',
      scouter: 'Scouter',
      position: 'Position',
      auto_fuel: 'Auto Fuel',
      auto_climb: 'Auto Climb',
      auto_won: 'Auto Won',
      auto_transition: 'Auto Transition',
      shift1_fuel: 'Shift 1 Fuel',
      shift1_defense: 'Shift 1 Defense',
      shift1_defense_tags: 'Shift 1 Defense Tags',
      shift2_fuel: 'Shift 2 Fuel',
      shift2_defense: 'Shift 2 Defense',
      shift2_defense_tags: 'Shift 2 Defense Tags',
      shift3_fuel: 'Shift 3 Fuel',
      shift3_defense: 'Shift 3 Defense',
      shift3_defense_tags: 'Shift 3 Defense Tags',
      shift4_fuel: 'Shift 4 Fuel',
      shift4_defense: 'Shift 4 Defense',
      shift4_defense_tags: 'Shift 4 Defense Tags',
      total_fuel: 'Total Fuel',
      endgame_climb: 'Endgame Climb',
      endgame_climb_level: 'Endgame Climb Level',
      endgame_descend: 'Endgame Descend',
      endgame_died: 'Endgame Died',
      total_score: 'Total Score',
      keywords: 'Keywords',
      timestamp: 'Timestamp'
    };

    const headerValues = FIELDS.map(key => sanitize(headers[key]));
    return headerValues.join('\t');
  };

  const buildTSV = (data) => {
    const row = {
      match: data.match,
      team: data.team,
      scouter: data.initials,
      position: data.position || '',
      auto_fuel: data.auto.fuel,
      auto_climb: data.auto.climb,
      auto_won: data.auto.wonAuto ? 'Y' : 'N',
      auto_transition: data.auto.transitionShift.join(','),
      shift1_fuel: data.teleop.shift1.fuel,
      shift1_defense: data.teleop.shift1.defense,
      shift1_defense_tags: data.teleop.shift1.defenseTags.join(','),
      shift2_fuel: data.teleop.shift2.fuel,
      shift2_defense: data.teleop.shift2.defense,
      shift2_defense_tags: data.teleop.shift2.defenseTags.join(','),
      shift3_fuel: data.teleop.shift3.fuel,
      shift3_defense: data.teleop.shift3.defense,
      shift3_defense_tags: data.teleop.shift3.defenseTags.join(','),
      shift4_fuel: data.teleop.shift4.fuel,
      shift4_defense: data.teleop.shift4.defense,
      shift4_defense_tags: data.teleop.shift4.defenseTags.join(','),
      total_fuel: getTotalFuel(),
      endgame_climb: data.endgame.climb,
      endgame_climb_level: data.endgame.climbLevel,
      endgame_descend: data.endgame.canDescend ? 'Y' : 'N',
      endgame_died: data.endgame.died ? 'Y' : 'N',
      total_score: getTotalScore(),
      keywords: data.keywords.join(','),
      timestamp: Date.now()
    };

    const values = FIELDS.map(key => sanitize(row[key]));
    return values.join('\t');
  };

  const generateQRData = () => {
    if (qrCodeMode === 'titles') {
      return buildTSVHeaders();
    }
    return buildTSV(formData);
  };

  const handleSubmit = async () => {
    try {
      const qrData = generateQRData();
      const dataURL = await QRCode.toDataURL(qrData, {
        errorCorrectionLevel: 'M',
        margin: 1,
        scale: 6,
        width: 300
      });
      
      setQrCodeDataURL(dataURL);
      setShowQRModal(true);
    } catch (error) {
      console.error('Error generating QR code:', error);
      alert('Error generating QR code. Please try again.');
    }
  };

  const handleQRModeToggle = async () => {
    const newMode = qrCodeMode === 'data' ? 'titles' : 'data';
    setQrCodeMode(newMode);
    
    try {
      const qrData = newMode === 'titles' ? buildTSVHeaders() : buildTSV(formData);
      const dataURL = await QRCode.toDataURL(qrData, {
        errorCorrectionLevel: 'M',
        margin: 1,
        scale: 6,
        width: 300
      });
      setQrCodeDataURL(dataURL);
    } catch (error) {
      console.error('Error regenerating QR code:', error);
    }
  };

  const handleClear = () => {
    setFormData(prev => ({
      ...prev,
      match: prev.match + 1,
      team: '',
      position: null,
      auto: { fuel: 0, climb: 'No Climb', wonAuto: false, transitionShift: [] },
      teleop: {
        shift1: { fuel: 0, defense: 0, defenseTags: [] },
        shift2: { fuel: 0, defense: 0, defenseTags: [] },
        shift3: { fuel: 0, defense: 0, defenseTags: [] },
        shift4: { fuel: 0, defense: 0, defenseTags: [] }
      },
      endgame: { climb: 'None', climbLevel: 'None', canDescend: false, died: false },
      keywords: []
    }));
  };

  return (
    <div className="scout-page">
      <div className="scout-card">
        <div className="setup-section">
          <h2 className="section-title">Setup</h2>
          <div className="scout-header-row">
            <div className="input-group">
              <label>Initials</label>
              <input
                type="text"
                value={formData.initials}
                onChange={(e) => handleInputChange('initials', e.target.value.toUpperCase())}
                maxLength={3}
                className="initials-input"
              />
            </div>
            <div className="input-group">
              <label>Match</label>
              <div className="match-stepper">
                <button 
                  onClick={() => handleInputChange('match', Math.max(1, formData.match - 1))}
                  className="stepper-btn"
                >
                  -
                </button>
                <input
                  type="text"
                  value={formData.match}
                  onChange={(e) => {
                    const value = parseInt(e.target.value.replace(/\D/g, '')) || 1;
                    handleInputChange('match', Math.max(1, value));
                  }}
                  className="match-input"
                />
                <button 
                  onClick={() => handleInputChange('match', formData.match + 1)}
                  className="stepper-btn"
                >
                  +
                </button>
              </div>
            </div>
            <div className="input-group">
              <label>Team</label>
              <input
                type="text"
                value={formData.team}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, '').slice(0, 5);
                  handleInputChange('team', value);
                }}
                className="team-input"
                placeholder="12345"
                maxLength={5}
              />
            </div>
            <div className="input-group">
              <label>Increment</label>
              <div className="match-stepper">
                <button 
                  onClick={() => handleInputChange('increment', Math.max(1, formData.increment - 1))}
                  className="stepper-btn"
                >
                  -
                </button>
                <input
                  type="text"
                  value={formData.increment}
                  onChange={(e) => {
                    const value = parseInt(e.target.value.replace(/\D/g, '')) || 1;
                    handleInputChange('increment', Math.max(1, value));
                  }}
                  className="match-input"
                />
                <button 
                  onClick={() => handleInputChange('increment', formData.increment + 1)}
                  className="stepper-btn"
                >
                  +
                </button>
              </div>
            </div>
          </div>

          <AlliancePositionGrid
            selectedPosition={formData.position}
            onPositionChange={(position) => handleInputChange('position', position)}
          />
        </div>

        <div className="auto-section">
          <h2 className="section-title">Auto</h2>
          <div className="section-grid">
            <div className="section-left">
              <BigStepper
                label="Fuel"
                value={formData.auto.fuel}
                onChange={(value) => handleNestedChange('auto', 'fuel', value)}
                increment={formData.increment}
              />
            </div>
            <div className="section-right">
              <div className="climb-won-auto-row">
                <div className="climb-section">
                  <CycleButton
                    label="Climb"
                    value={formData.auto.climb}
                    options={['No Climb', 'Climb', 'Pullup']}
                    onChange={(value) => handleNestedChange('auto', 'climb', value)}
                  />
                </div>
                <div className="won-auto-section">
                  <CycleButton
                    label="Won Auto?"
                    value={formData.auto.wonAuto ? 'Yes' : 'No'}
                    options={['No', 'Yes']}
                    onChange={(value) => handleNestedChange('auto', 'wonAuto', value === 'Yes')}
                  />
                </div>
              </div>
              <div className="transition-shift">
                <label>Transition Shift</label>
                <div className="transition-keywords-grid">
                  {['Hoarding', 'Scoring', 'Defense Prep', 'Other'].map((keyword) => (
                    <button
                      key={keyword}
                      className={`transition-keyword-btn ${formData.auto.transitionShift.includes(keyword) ? 'selected' : ''}`}
                      onClick={() => {
                        const currentKeywords = formData.auto.transitionShift;
                        const newKeywords = currentKeywords.includes(keyword)
                          ? currentKeywords.filter(k => k !== keyword)
                          : [...currentKeywords, keyword];
                        handleNestedChange('auto', 'transitionShift', newKeywords);
                      }}
                    >
                      {keyword}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="teleop-section">
          <h2 className="section-title">Teleop</h2>
          <div className="shift-tabs">
            {['shift1', 'shift2', 'shift3', 'shift4'].map((shift, index) => (
              <button
                key={shift}
                className={`shift-tab ${activeShift === shift ? 'active' : ''}`}
                onClick={() => setActiveShift(shift)}
              >
                Shift {index + 1}
              </button>
            ))}
          </div>
          <div className="shift-content">
            {(() => {
              const currentShift = formData.teleop[activeShift];
              const shiftNumber = parseInt(activeShift.replace('shift', ''));
              const isDefenseShift = formData.auto.wonAuto 
                ? (shiftNumber === 1 || shiftNumber === 3)
                : (shiftNumber === 2 || shiftNumber === 4);

              return (
                <div className="shift-content-wrapper">
                  {!isDefenseShift && (
                    <BigStepper
                      label="Fuel"
                      value={currentShift.fuel}
                      onChange={(value) => handleShiftChange(activeShift, 'fuel', value)}
                      increment={formData.increment}
                    />
                  )}
                  {isDefenseShift && (
                    <div className="defense-content">
                      <div className="defense-rating-section">
                        <h4 className="defense-title">Defense</h4>
                        <StarRating
                          value={currentShift.defense}
                          onChange={(value) => handleShiftChange(activeShift, 'defense', value)}
                        />
                      </div>
                      <div className="defense-tags-section">
                        <h4 className="defense-tags-title">Defense Tags</h4>
                        <ChipSelect
                          options={defenseTags}
                          selectedValues={currentShift.defenseTags}
                          onChange={(values) => handleShiftChange(activeShift, 'defenseTags', values)}
                          multiSelect={true}
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
          <div className="total-fuel">
            <h3>Total Fuel: {getTotalFuel()}</h3>
          </div>
        </div>

        <div className="endgame-section">
          <h2 className="section-title">Endgame</h2>
          <div className="endgame-content">
            <div className="endgame-climb-column">
              <span className="endgame-climb-label">Climb</span>
              <ChipSelect
                options={['None', 'Attempt', 'Success']}
                selectedValues={formData.endgame.climb}
                onChange={(value) => handleNestedChange('endgame', 'climb', value)}
              />
            </div>
            <div className="endgame-climb-levels">
              <span className="endgame-climb-label">Climb Levels</span>
              <div className="climb-level-toggles">
                <button
                  className={`endgame-toggle-btn ${formData.endgame.climbLevel === 'Level 1' ? 'selected' : ''}`}
                  onClick={() => handleClimbLevelChange('Level 1')}
                >
                  Level 1
                </button>
                <button
                  className={`endgame-toggle-btn ${formData.endgame.climbLevel === 'Level 2' ? 'selected' : ''}`}
                  onClick={() => handleClimbLevelChange('Level 2')}
                >
                  Level 2
                </button>
                <button
                  className={`endgame-toggle-btn ${formData.endgame.climbLevel === 'Level 3' ? 'selected' : ''}`}
                  onClick={() => handleClimbLevelChange('Level 3')}
                >
                  Level 3
                </button>
              </div>
            </div>
            <div className="endgame-toggles">
              <button
                className={`endgame-toggle-btn ${formData.endgame.canDescend ? 'selected' : ''}`}
                onClick={() => handleNestedChange('endgame', 'canDescend', !formData.endgame.canDescend)}
              >
                Can Descend
              </button>
              <button
                className={`endgame-toggle-btn ${formData.endgame.died ? 'selected' : ''}`}
                onClick={() => handleNestedChange('endgame', 'died', !formData.endgame.died)}
              >
                Died
              </button>
            </div>
          </div>
        </div>

        <div className="keywords-section">
          <h3 className="keywords-title">Keywords</h3>
          <ChipSelect
            options={keywordOptions}
            selectedValues={formData.keywords}
            onChange={(values) => handleInputChange('keywords', values)}
            multiSelect={true}
          />
        </div>

        <div className="total-score-section">
          <h2 className="section-title">Total Score</h2>
          <div className="total-score-content">
            <div className="score-breakdown">
              <div className="score-category">
                <span className="score-text">Auto: {getAutoScore()}</span>
              </div>
              <div className="score-category">
                <span className="score-text">Teleop: {getTotalFuel()}</span>
              </div>
              <div className="score-category">
                <span className="score-text">Endgame: {getEndgameScore()}</span>
              </div>
            </div>
            <div className="total-score-display">
              <span className="total-score-text">Total Score: {getTotalScore()}</span>
            </div>
          </div>
        </div>

        <div className="bottom-actions">
          <button className="btn secondary" onClick={handleClear}>
            Clear
          </button>
          <button className="btn primary" onClick={handleSubmit}>
            Submit
          </button>
        </div>
      </div>

      {showQRModal && (
        <div className="qr-modal-overlay" onClick={() => setShowQRModal(false)}>
          <div className="qr-modal" onClick={(e) => e.stopPropagation()}>
            <div className="qr-modal-header">
              <h2>Scout Data QR Code</h2>
              <button className="qr-modal-close" onClick={() => setShowQRModal(false)}>
                ×
              </button>
            </div>
            <div className="qr-modal-content">
              <div className="qr-mode-toggle">
                <button 
                  className={`qr-mode-btn ${qrCodeMode === 'data' ? 'active' : ''}`}
                  onClick={handleQRModeToggle}
                >
                  Data
                </button>
                <button 
                  className={`qr-mode-btn ${qrCodeMode === 'titles' ? 'active' : ''}`}
                  onClick={handleQRModeToggle}
                >
                  Title Names
                </button>
              </div>
              <img src={qrCodeDataURL} alt="Scout Data QR Code" className="qr-code-image" />
              <p>
                {qrCodeMode === 'data' 
                  ? 'Scan this QR code to paste scout data into Google Sheets'
                  : 'Scan this QR code to paste column headers into Google Sheets'
                }
              </p>
              <p><strong>
                {qrCodeMode === 'data' 
                  ? `Team: ${formData.team} | Match: ${formData.match} | Scout: ${formData.initials}`
                  : 'TSV Headers for Google Sheets Setup'
                }
              </strong></p>
            </div>
          </div>
        </div>
      )}
      
      <div className="version-info">
        <span className="version-text">v0.1.0 | Cache: v4</span>
      </div>
    </div>
  );
};

export default Scout;