
export const FONTS = [
  { label: 'Default',        value: 'system',      family: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", googleFont: null },
  { label: 'Inter',          value: 'inter',       family: "'Inter', sans-serif",           googleFont: 'Inter:wght@400;600;700;800' },
  { label: 'Space Grotesk',  value: 'space',       family: "'Space Grotesk', sans-serif",   googleFont: 'Space+Grotesk:wght@400;600;700;800' },
  { label: 'Syne',           value: 'syne',        family: "'Syne', sans-serif",             googleFont: 'Syne:wght@400;600;700;800' },
  { label: 'Outfit',         value: 'outfit',      family: "'Outfit', sans-serif",           googleFont: 'Outfit:wght@400;600;700;800' },
  { label: 'Exo 2',          value: 'exo2',        family: "'Exo 2', sans-serif",            googleFont: 'Exo+2:wght@400;600;700;800' },
  { label: 'Orbitron',       value: 'orbitron',    family: "'Orbitron', sans-serif",         googleFont: 'Orbitron:wght@400;600;700;900' },
  { label: 'Josefin Sans',   value: 'josefin',     family: "'Josefin Sans', sans-serif",     googleFont: 'Josefin+Sans:wght@400;600;700' },
  { label: 'DM Serif Display', value: 'dmserif',  family: "'DM Serif Display', serif",      googleFont: 'DM+Serif+Display' },
  { label: 'Bebas Neue',     value: 'bebas',       family: "'Bebas Neue', sans-serif",       googleFont: 'Bebas+Neue' },
  { label: 'Archivo Black',  value: 'archivo',     family: "'Archivo Black', sans-serif",    googleFont: 'Archivo+Black' },
];

export const PRESET_COLORS = [
  { label: 'Blue',    value: '#3b82f6' },
  { label: 'Indigo',  value: '#6366f1' },
  { label: 'Purple',  value: '#8b5cf6' },
  { label: 'Pink',    value: '#ec4899' },
  { label: 'Red',     value: '#ef4444' },
  { label: 'Orange',  value: '#f97316' },
  { label: 'Green',   value: '#10b981' },
  { label: 'Teal',    value: '#14b8a6' },
];

const hexToRgb = (hex) => {
  const h = hex.replace('#', '');
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
};

const rgbToHex = (r, g, b) =>
  '#' + [r, g, b]
    .map(v => Math.min(255, Math.max(0, Math.round(v))).toString(16).padStart(2, '0'))
    .join('');

const darken = (hex, amount = 0.18) => {
  const [r, g, b] = hexToRgb(hex);
  return rgbToHex(r * (1 - amount), g * (1 - amount), b * (1 - amount));
};

const lighten = (hex, amount = 0.88) => {
  const [r, g, b] = hexToRgb(hex);
  return rgbToHex(
    r + (255 - r) * amount,
    g + (255 - g) * amount,
    b + (255 - b) * amount,
  );
};

let fontLinkEl = null;

const loadGoogleFont = (googleFont) => {
  if (!fontLinkEl) {
    fontLinkEl = document.createElement('link');
    fontLinkEl.rel = 'stylesheet';
    document.head.appendChild(fontLinkEl);
  }
  if (googleFont) {
    fontLinkEl.href = `https://fonts.googleapis.com/css2?family=${googleFont}&display=swap`;
  } else {
    fontLinkEl.href = '';
  }
};

export const applyTheme = (color, fontValue) => {
  const root = document.documentElement;

  root.style.setProperty('--accent', color);
  root.style.setProperty('--accent-dark', darken(color));
  root.style.setProperty('--accent-light', lighten(color));

  document.body.style.background =
    `linear-gradient(135deg, ${darken(color, 0.25)} 0%, ${color} 50%, ${darken(color, 0.12)} 100%)`;

  const font = FONTS.find(f => f.value === fontValue) || FONTS[0];
  root.style.setProperty('--font-family', font.family);
  document.body.style.fontFamily = font.family;
  if (font.googleFont) loadGoogleFont(font.googleFont);
  else if (fontLinkEl) fontLinkEl.href = '';
};

export const saveTheme = (color, fontValue) => {
  localStorage.setItem('turboscout-accent', color);
  localStorage.setItem('turboscout-font', fontValue);
};

export const loadTheme = () => {
  const color = localStorage.getItem('turboscout-accent') || '#3b82f6';
  const fontValue = localStorage.getItem('turboscout-font') || 'system';
  applyTheme(color, fontValue);
  return { color, fontValue };
};
