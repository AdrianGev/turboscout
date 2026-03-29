import React, { useState, useEffect, useCallback } from 'react';
import QRCode from 'qrcode';
import './Stash.css';

const STORAGE_KEY = 'turboscout-stash';

const positionLabel = (pos) => {
  if (!pos) return '—';
  if (pos.startsWith('B')) return `Blue ${pos[1]}`;
  if (pos.startsWith('R')) return `Red ${pos[1]}`;
  return pos;
};

const Stash = () => {
  const [entries, setEntries] = useState([]);
  const [showExport, setShowExport] = useState(false);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [qrDataURL, setQrDataURL] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try { setEntries(JSON.parse(saved)); } catch (e) {}
    }
  }, []);

  const deleteEntry = (id) => {
    const updated = entries.filter(e => e.id !== id);
    setEntries(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  };

  const confirmClearAll = () => {
    setEntries([]);
    localStorage.removeItem(STORAGE_KEY);
    setShowClearConfirm(false);
  };

  const generateQR = useCallback(async (tsvRow) => {
    if (!tsvRow) return;
    try {
      const url = await QRCode.toDataURL(tsvRow, {
        errorCorrectionLevel: 'M',
        margin: 1,
        scale: 6,
        width: 300
      });
      setQrDataURL(url);
    } catch (e) {
      console.error('QR generation error', e);
    }
  }, []);

  useEffect(() => {
    if (showExport && entries.length > 0) {
      generateQR(entries[currentIdx]?.tsvRow);
    }
  }, [showExport, currentIdx, entries, generateQR]);

  useEffect(() => {
    if (!showExport || !isPlaying || entries.length <= 1) return;
    const timer = setInterval(() => {
      setCurrentIdx(i => (i + 1) % entries.length);
    }, 7000);
    return () => clearInterval(timer);
  }, [showExport, isPlaying, entries.length]);

  const openExport = () => {
    setCurrentIdx(0);
    setIsPlaying(false);
    setShowExport(true);
  };

  const prev = () => setCurrentIdx(i => (i - 1 + entries.length) % entries.length);
  const next = () => setCurrentIdx(i => (i + 1) % entries.length);

  return (
    <div className="stash-page">
      <div className="stash-card">
      <div className="stash-header">
        <div className="stash-title-row">
          <div>
            <h2>Stash</h2>
            <p className="stash-subtitle">
              {entries.length === 0
                ? 'No saved entries yet'
                : `${entries.length} saved ${entries.length === 1 ? 'entry' : 'entries'}`}
            </p>
          </div>
          {entries.length > 0 && (
            <div className="stash-header-actions">
              <button className="stash-export-btn" onClick={openExport}>
                Export Data
              </button>
              <button className="stash-clear-btn" onClick={() => setShowClearConfirm(true)}>
                Clear All
              </button>
            </div>
          )}
        </div>
      </div>

      {entries.length === 0 ? (
        <div className="stash-empty">
          <p>Sorry, no data here pal. Try saving some maybe?</p>
          <p className="stash-empty-hint">Hit <strong>Save Data</strong> in the Scout submit modal to store entries here.</p>
        </div>
      ) : (
        <div className="stash-list">
          {entries.map((entry) => {
            const isBlue = String(entry.position).startsWith('B');
            const isRed = String(entry.position).startsWith('R');
            return (
              <div key={entry.id} className="stash-entry">
                <div className="stash-entry-body">
                  <span className="stash-match-num">M{entry.matchNumber}</span>
                  <span className="stash-team-num">Team {entry.team || '?'}</span>
                  <span className={`stash-position ${isBlue ? 'blue' : isRed ? 'red' : ''}`}>
                    {positionLabel(entry.position)}
                  </span>
                  <span className="stash-score">{entry.totalScore} pts</span>
                </div>
                <button className="stash-delete-btn" onClick={() => deleteEntry(entry.id)} title="Remove">
                  ✕
                </button>
              </div>
            );
          })}
        </div>
      )}

      </div>

      {showExport && (
        <div className="stash-modal-overlay" onClick={() => setShowExport(false)}>
          <div className="stash-modal" onClick={(e) => e.stopPropagation()}>
            <div className="stash-modal-header">
              <h2>Export Data</h2>
              <button className="stash-modal-close" onClick={() => setShowExport(false)}>×</button>
            </div>
            <div className="stash-modal-body">
              <div className="stash-qr-counter">
                {currentIdx + 1} / {entries.length}
              </div>
              {qrDataURL
                ? <img src={qrDataURL} alt="Scout Data QR Code" className="stash-qr-img" />
                : <div className="stash-qr-placeholder">Generating…</div>
              }
              <div className="stash-qr-info">
                <strong>
                  Match {entries[currentIdx]?.matchNumber}
                  {' · '}Team {entries[currentIdx]?.team || '?'}
                  {' · '}{positionLabel(entries[currentIdx]?.position)}
                  {' · '}{entries[currentIdx]?.totalScore} pts
                </strong>
              </div>
              <div className="stash-qr-controls">
                <button className="stash-nav-btn" onClick={prev} disabled={entries.length <= 1}>‹</button>
                <button className="stash-play-btn" onClick={() => setIsPlaying(p => !p)}>
                  {isPlaying ? '⏸' : '▶'}
                </button>
                <button className="stash-nav-btn" onClick={next} disabled={entries.length <= 1}>›</button>
              </div>
              <p className="stash-qr-hint">
                Auto-advances every 7 s · Scan each QR to paste a row into Sheets
              </p>
            </div>
          </div>
        </div>
      )}

      {showClearConfirm && (
        <div className="stash-modal-overlay" onClick={() => setShowClearConfirm(false)}>
          <div className="stash-confirm-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Clear all stash data?</h3>
            <p>This will permanently delete all {entries.length} saved {entries.length === 1 ? 'entry' : 'entries'}.</p>
            <div className="stash-confirm-actions">
              <button className="stash-cancel-btn" onClick={() => setShowClearConfirm(false)}>Cancel</button>
              <button className="stash-confirm-delete-btn" onClick={confirmClearAll}>Delete All</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Stash;
