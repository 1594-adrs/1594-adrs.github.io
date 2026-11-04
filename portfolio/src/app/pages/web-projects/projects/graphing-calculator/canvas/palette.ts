export type CanvasTheme = 'dark' | 'light';

export interface ScenePalette {
  background: number;
  gridCenter: number;
  grid: number;
  axes: [number, number, number];
  revolutionAxis: number;
  slice: string;
  ambient: { color: number; intensity: number };
  key: { color: number; intensity: number };
  rim: { color: number; intensity: number };
}

export interface CanvasPalette {
  theme: CanvasTheme;
  background: string;
  gridMinor: string;
  grid: string;
  axis: string;
  axisWidth: number;
  tickLabel: string;
  tickFont: string;
  muted: string;
  guide: string;
  ink: string;
  halo: string;
  labelBg: string;
  labelBorder: string;
  poi: string;
  poiActive: string;
  intersection: string;
  intersectionGuide: string;
  highlight: string;
  highlightMirror: string;
  revolutionAxisLine: string;
  revolutionAxisLabel: string;
  slopeField: string;
  seqTerm: string;
  seqPartial: string;
  seqSum: string;
  panelFill: string;
  panelStroke: string;
  panelStrokeDense: string;
  scene: ScenePalette;
  curve: (color: string) => string;
}

const HEX6 = /^#([0-9a-f]{6})$/i;

function channelLuminance(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

function luminance([r, g, b]: [number, number, number]): number {
  return 0.2126 * channelLuminance(r) + 0.7152 * channelLuminance(g) + 0.0722 * channelLuminance(b);
}

function parseHex(color: string): [number, number, number] | null {
  const m = HEX6.exec(color);
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function toHex([r, g, b]: [number, number, number]): string {
  return '#' + [r, g, b].map((c) => Math.round(c).toString(16).padStart(2, '0')).join('');
}

export function contrastOnWhite(color: string): number {
  const rgb = parseHex(color);
  if (!rgb) return NaN;
  return 1.05 / (luminance(rgb) + 0.05);
}

export function darkenForWhite(color: string, minContrast = 4.5): string {
  const rgb = parseHex(color);
  if (!rgb || contrastOnWhite(color) >= minContrast) return color.toLowerCase();
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    const candidate = rgb.map((c) => Math.floor(c * mid)) as [number, number, number];
    if (1.05 / (luminance(candidate) + 0.05) >= minContrast) lo = mid;
    else hi = mid;
  }
  return toHex(rgb.map((c) => Math.floor(c * lo)) as [number, number, number]);
}

const printCurveCache = new Map<string, string>();

function printCurve(color: string): string {
  let out = printCurveCache.get(color);
  if (out === undefined) {
    out = darkenForWhite(color);
    printCurveCache.set(color, out);
  }
  return out;
}

export const DARK_PALETTE: CanvasPalette = {
  theme: 'dark',
  background: '#0d0d15',
  gridMinor: '#131320',
  grid: '#1a1a2e',
  axis: '#333355',
  axisWidth: 1.5,
  tickLabel: '#666680',
  tickFont: '11px "JetBrains Mono", monospace',
  muted: '#666680',
  guide: '#80809a',
  ink: '#e0e0e0',
  halo: '#0a0a0f',
  labelBg: '#0a0a0f',
  labelBorder: '#333355',
  poi: '#8888aa',
  poiActive: '#ffffff',
  intersection: '#ffffff',
  intersectionGuide: '#ffffff40',
  highlight: '#ffcc00',
  highlightMirror: '#ffcc0080',
  revolutionAxisLine: '#ffaa0088',
  revolutionAxisLabel: '#ffaa00cc',
  slopeField: '#5a5a78',
  seqTerm: '#00e5ff',
  seqPartial: '#ffb300',
  seqSum: '#ff6bd6',
  panelFill: 'rgba(224, 224, 224, 0.12)',
  panelStroke: 'rgba(224, 224, 224, 0.85)',
  panelStrokeDense: 'rgba(224, 224, 224, 0.4)',
  scene: {
    background: 0x0d0d15,
    gridCenter: 0x333355,
    grid: 0x1a1a2e,
    axes: [0xff0000, 0x00ff00, 0x0000ff],
    revolutionAxis: 0xffffff,
    slice: '#ffcc00',
    ambient: { color: 0x404040, intensity: 0.6 },
    key: { color: 0xffffff, intensity: 1 },
    rim: { color: 0x00ff88, intensity: 0.4 },
  },
  curve: (color) => color,
};

export const LIGHT_PALETTE: CanvasPalette = {
  theme: 'light',
  background: '#ffffff',
  gridMinor: '#eceef2',
  grid: '#c9cdd4',
  axis: '#1d2129',
  axisWidth: 1.5,
  tickLabel: '#2b303b',
  tickFont: '600 12px "JetBrains Mono", monospace',
  muted: '#5c6270',
  guide: '#5c6270',
  ink: '#1d2129',
  halo: '#ffffff',
  labelBg: '#ffffff',
  labelBorder: '#9aa0ab',
  poi: '#5c6270',
  poiActive: '#1d2129',
  intersection: '#1d2129',
  intersectionGuide: '#1d212940',
  highlight: '#c84f00',
  highlightMirror: '#c84f0070',
  revolutionAxisLine: '#c84f00cc',
  revolutionAxisLabel: '#1d2129',
  slopeField: '#9aa0ab',
  seqTerm: printCurve('#00e5ff'),
  seqPartial: printCurve('#ffb300'),
  seqSum: printCurve('#ff6bd6'),
  panelFill: 'rgba(29, 33, 41, 0.08)',
  panelStroke: 'rgba(29, 33, 41, 0.85)',
  panelStrokeDense: 'rgba(29, 33, 41, 0.4)',
  scene: {
    background: 0xffffff,
    gridCenter: 0x9aa0ab,
    grid: 0xdadde3,
    axes: [0xb3261e, 0x1b7a3a, 0x1f4fd1],
    revolutionAxis: 0x1d2129,
    slice: '#ee8a3c',
    ambient: { color: 0xffffff, intensity: 0.9 },
    key: { color: 0xffffff, intensity: 1.1 },
    rim: { color: 0xffffff, intensity: 0.3 },
  },
  curve: printCurve,
};

export function paletteFor(theme: CanvasTheme): CanvasPalette {
  return theme === 'light' ? LIGHT_PALETTE : DARK_PALETTE;
}

let active: CanvasPalette = DARK_PALETTE;

export function canvasPalette(): CanvasPalette {
  return active;
}

export function setCanvasPalette(palette: CanvasPalette): void {
  active = palette;
}
