import React, { useState, useEffect, useRef, useCallback } from 'react';
import './Settings.css';
import { FONTS, PRESET_COLORS, applyTheme, saveTheme, loadTheme } from '../utils/theme';

const hsvToHex = (h, s, v) => {
  s /= 100; v /= 100;
  const f = (n) => {
    const k = (n + h / 60) % 6;
    const c = v - v * s * Math.max(0, Math.min(k, 4 - k, 1));
    return Math.round(c * 255).toString(16).padStart(2, '0');
  };
  return `#${f(5)}${f(3)}${f(1)}`;
};

const hexToHsv = (hex) => {
  const h = hex.replace('#', '');
  if (h.length !== 6) return [0, 0, 100];
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  const v = max;
  const s = max === 0 ? 0 : d / max;
  let hue = 0;
  if (d !== 0) {
    switch (max) {
      case r: hue = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: hue = ((b - r) / d + 2) / 6; break;
      default: hue = ((r - g) / d + 4) / 6;
    }
  }
  return [Math.round(hue * 360), Math.round(s * 100), Math.round(v * 100)];
};

const isValidHex = (v) => /^#[0-9a-fA-F]{6}$/.test(v);

const Settings = () => {
  const [darkMode, setDarkMode] = useState(false);
  const [showClearModal, setShowClearModal] = useState(false);
  const [accentColor, setAccentColor] = useState('#3b82f6');
  const [fontValue, setFontValue] = useState('system');
  const [showCustom, setShowCustom] = useState(false);
  const [hue, setHue] = useState(217);
  const [sat, setSat] = useState(75);
  const [val, setVal] = useState(88);
  const [hexInput, setHexInput] = useState('#3b82f6');

  const pickerRef = useRef(null);
  const isDragging = useRef(false);
  const hueRef = useRef(hue);
  const satRef = useRef(sat);
  const valRef = useRef(val);
  const fontRef = useRef(fontValue);
  hueRef.current = hue;
  satRef.current = sat;
  valRef.current = val;
  fontRef.current = fontValue;

  useEffect(() => {
    const savedDarkMode = localStorage.getItem('turboscout-dark-mode');
    if (savedDarkMode) {
      const isDarkMode = JSON.parse(savedDarkMode);
      setDarkMode(isDarkMode);
      if (isDarkMode) document.body.classList.add('dark-mode');
    }
    const { color, fontValue: fv } = loadTheme();
    setAccentColor(color);
    setHexInput(color);
    const [h, s, v] = hexToHsv(color);
    setHue(h); setSat(s); setVal(v);
    setFontValue(fv);
  }, []);

  const updateFromPos = useCallback((clientX, clientY) => {
    if (!pickerRef.current) return;
    const rect = pickerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
    const newSat = Math.round(x * 100);
    const newVal = Math.round((1 - y) * 100);
    setSat(newSat); setVal(newVal);
    const color = hsvToHex(hueRef.current, newSat, newVal);
    setAccentColor(color);
    setHexInput(color);
    applyTheme(color, fontRef.current);
    saveTheme(color, fontRef.current);
  }, []);

  useEffect(() => {
    const onMove = (e) => { if (isDragging.current) updateFromPos(e.clientX, e.clientY); };
    const onTouchMove = (e) => { if (isDragging.current && e.touches[0]) updateFromPos(e.touches[0].clientX, e.touches[0].clientY); };
    const onUp = () => { isDragging.current = false; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onUp);
    };
  }, [updateFromPos]);

  const applyDarkMode = (isDark) => {
    if (isDark) document.body.classList.add('dark-mode');
    else document.body.classList.remove('dark-mode');
  };

  const handleDarkModeToggle = () => {
    const next = !darkMode;
    setDarkMode(next);
    localStorage.setItem('turboscout-dark-mode', JSON.stringify(next));
    applyDarkMode(next);
  };

  const applyColor = (color) => {
    setAccentColor(color);
    setHexInput(color);
    const [h, s, v] = hexToHsv(color);
    setHue(h); setSat(s); setVal(v);
    applyTheme(color, fontRef.current);
    saveTheme(color, fontRef.current);
  };

  const handleHueSlider = (e) => {
    const h = Number(e.target.value);
    setHue(h);
    const color = hsvToHex(h, satRef.current, valRef.current);
    setAccentColor(color);
    setHexInput(color);
    applyTheme(color, fontRef.current);
    saveTheme(color, fontRef.current);
  };

  const handleHexInput = (e) => {
    const raw = e.target.value;
    setHexInput(raw);
    const full = raw.startsWith('#') ? raw : '#' + raw;
    if (isValidHex(full)) applyColor(full);
  };

  const handleFontChange = (fv) => {
    setFontValue(fv);
    applyTheme(accentColor, fv);
    saveTheme(accentColor, fv);
  };

  const isPreset = PRESET_COLORS.some((c) => c.value === accentColor);

  const pureHue = `hsl(${hue}, 100%, 50%)`;
  const indicatorLeft = `${sat}%`;
  const indicatorTop = `${100 - val}%`;

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
                <input type="checkbox" checked={darkMode} onChange={handleDarkModeToggle} />
                <span className="toggle-slider"></span>
              </label>
            </div>
          </div>
        </div>

        <div className="settings-section">
          <div className="setting-info" style={{ marginBottom: 16 }}>
            <h3>Accent Color</h3>
            <p>Change the app's primary color everywhere</p>
          </div>

          <div className="color-presets">
            {PRESET_COLORS.map(({ label, value }) => (
              <button
                key={value}
                className={`color-swatch${accentColor === value ? ' active' : ''}`}
                style={{ background: value }}
                title={label}
                onClick={() => { applyColor(value); setShowCustom(false); }}
              />
            ))}
            <button
              className={`color-custom-btn${showCustom || !isPreset ? ' active' : ''}`}
              onClick={() => setShowCustom((v) => !v)}
            >
              Custom
            </button>
          </div>

          {showCustom && (
            <div className="custom-color-panel">
              <div
                ref={pickerRef}
                className="color-picker-rect"
                style={{ background: pureHue }}
                onMouseDown={(e) => { isDragging.current = true; updateFromPos(e.clientX, e.clientY); }}
                onTouchStart={(e) => { isDragging.current = true; if (e.touches[0]) updateFromPos(e.touches[0].clientX, e.touches[0].clientY); }}
              >
                <div className="picker-white-overlay" />
                <div className="picker-black-overlay" />
                <div
                  className="picker-indicator"
                  style={{ left: indicatorLeft, top: indicatorTop }}
                />
              </div>

              <input
                type="range"
                min="0"
                max="360"
                value={hue}
                onChange={handleHueSlider}
                className="hue-slider"
              />

              <div className="color-bottom-row">
                <div className="color-preview-box" style={{ background: accentColor }} />
                <input
                  type="text"
                  className={`hex-input${!isValidHex(hexInput.startsWith('#') ? hexInput : '#' + hexInput) ? ' invalid' : ''}`}
                  value={hexInput}
                  onChange={handleHexInput}
                  maxLength={7}
                  spellCheck={false}
                  placeholder="#3b82f6"
                />
              </div>
            </div>
          )}
        </div>

        <div className="settings-section">
          <div className="setting-info" style={{ marginBottom: 16 }}>
            <h3>Font</h3>
            <p>Choose a typeface for the entire app</p>
          </div>
          <div className="font-grid">
            {FONTS.map(({ label, value, family }) => (
              <button
                key={value}
                className={`font-option${fontValue === value ? ' active' : ''}`}
                style={{ fontFamily: family }}
                onClick={() => handleFontChange(value)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="settings-section">
          <div className="setting-item">
            <div className="setting-info">
              <h3>Clear Cache</h3>
              <p>Clear all stored data and refresh the app</p>
            </div>
            <div className="setting-control">
              <button className="clear-cache-btn" onClick={() => setShowClearModal(true)}>
                Clear Cache
              </button>
            </div>
          </div>
        </div>
      </div>

      {showClearModal && (
        <div className="modal-overlay" onClick={() => setShowClearModal(false)}>
          <div className="clear-modal" onClick={(e) => e.stopPropagation()}>
            <div className="clear-modal-header"><h2>Clear Cache</h2></div>
            <div className="clear-modal-content">
              <p>Are you sure you want to clear all cached data?</p>
              <p>This will remove all stored settings, team data, and refresh the application.</p>
            </div>
            <div className="clear-modal-actions">
              <button className="btn secondary" onClick={() => setShowClearModal(false)}>Cancel</button>
              <button className="btn danger" onClick={() => { localStorage.clear(); window.location.reload(); }}>Clear Cache</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;
