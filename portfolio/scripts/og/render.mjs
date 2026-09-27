/**
 * Brand assets for 1594·ADRS.
 *
 *   node scripts/og/render.mjs            build the SVGs and render every PNG
 *   node scripts/og/render.mjs --svg-only only rebuild the SVGs
 *
 * The lettering is drawn from pixel bitmaps (same block feel as the hero's
 * ANSI Shadow monogram), so the SVGs don't depend on any font. PNGs are
 * screenshots of the HTML templates in this folder taken with headless Chrome
 * over the DevTools protocol (set CHROME_PATH if Chrome isn't in the default place).
 */
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const PUBLIC = resolve(HERE, '../../public');

const GREEN = '#00ff88';
const GREEN_DIM = '#0e6b43';
const BODY = '#0a0a0f';
const BODY_EDGE = '#12121a';

// 5×5 letters, 3×5 digits.
const GLYPHS = {
  A: ['.###.', '#...#', '#####', '#...#', '#...#'],
  D: ['####.', '#...#', '#...#', '#...#', '####.'],
  R: ['####.', '#...#', '####.', '#..#.', '#...#'],
  S: ['.####', '#....', '.###.', '....#', '####.'],
  1: ['.#.', '##.', '.#.', '.#.', '###'],
  5: ['###', '#..', '###', '..#', '###'],
  9: ['###', '#.#', '###', '..#', '###'],
  4: ['#.#', '#.#', '###', '..#', '..#'],
};

/** One path for a whole word: horizontal pixel runs, so scaled pixels never show seams. */
function wordPath(text, x0, y0, unit) {
  let d = '';
  let x = x0;
  for (const ch of text) {
    const rows = GLYPHS[ch];
    rows.forEach((row, r) => {
      for (let c = 0; c < row.length;) {
        if (row[c] !== '#') {
          c++;
          continue;
        }
        let end = c;
        while (row[end] === '#') end++;
        d += `M${fmt(x + c * unit)} ${fmt(y0 + r * unit)}h${fmt((end - c) * unit)}v${fmt(unit)}h${fmt(-(end - c) * unit)}z`;
        c = end;
      }
    });
    x += (rows[0].length + 1) * unit;
  }
  return d;
}

const wordWidth = (text, unit) =>
  [...text].reduce((w, ch) => w + GLYPHS[ch][0].length * unit, 0) + (text.length - 1) * unit;
const fmt = (n) => +n.toFixed(2);

/* ---------- full mark: 512×512 chip ---------- */

const CHIP = { x: 64, y: 64, size: 384, r: 36 };
const ADRS_U = 13;
const NUM_U = 10;

function chipPins() {
  // 4 pins per side, like a QFP package.
  const pins = [];
  const len = 26;
  const w = 16;
  const step = CHIP.size / 5;
  for (let i = 1; i <= 4; i++) {
    const p = CHIP.x + step * i - w / 2;
    pins.push(
      `M${fmt(p)} ${CHIP.y - len}h${w}v${len}h${-w}z`,
      `M${fmt(p)} ${CHIP.y + CHIP.size}h${w}v${len}h${-w}z`,
      `M${CHIP.x - len} ${fmt(p)}h${len}v${w}h${-len}z`,
      `M${CHIP.x + CHIP.size} ${fmt(p)}h${len}v${w}h${-len}z`,
    );
  }
  return pins.join('');
}

function markLayout() {
  const adrsW = wordWidth('ADRS', ADRS_U);
  const numW = wordWidth('1594', NUM_U);
  const left = 256 - adrsW / 2;
  const right = left + adrsW;
  const numH = 5 * NUM_U;
  const adrsH = 5 * ADRS_U;
  const gap = 40;
  const barGap = 30;
  const barH = 8;
  const total = numH + gap + adrsH + barGap + barH;
  const top = 256 - total / 2;
  return {
    left,
    right,
    numY: top,
    numW,
    adrsY: top + numH + gap,
    adrsH,
    barY: top + numH + gap + adrsH + barGap,
    barH,
    cursor: { x: right - 3 * NUM_U, y: top, w: 3 * NUM_U, h: numH },
  };
}

/** Chip body and the glowing text layer of the full mark. */
function markLayers(L) {
  const shadow = ADRS_U * 0.45;
  return {
    body: `<path d="${chipPins()}" fill="${GREEN}" opacity="0.55"/>
  <rect x="${CHIP.x}" y="${CHIP.y}" width="${CHIP.size}" height="${CHIP.size}" rx="${CHIP.r}" fill="url(#body)" stroke="${GREEN}" stroke-opacity="0.6" stroke-width="4"/>
  <circle cx="${CHIP.x + 30}" cy="${CHIP.y + CHIP.size - 30}" r="7" fill="${GREEN}" opacity="0.45"/>`,
    text: `<path d="${wordPath('1594', L.left, L.numY, NUM_U)}" fill="${GREEN}"/>
  <rect x="${L.cursor.x}" y="${L.cursor.y}" width="${L.cursor.w}" height="${L.cursor.h}" fill="${GREEN}" opacity="0.85"/>
  <path d="${wordPath('ADRS', L.left + shadow, L.adrsY + shadow, ADRS_U)}" fill="${GREEN_DIM}"/>
  <path d="${wordPath('ADRS', L.left, L.adrsY, ADRS_U)}" fill="${GREEN}"/>
  <rect x="${L.left}" y="${L.barY}" width="${fmt(L.right - L.left)}" height="${L.barH}" fill="${GREEN}" opacity="0.35"/>`,
  };
}

const bodyGradient = `<linearGradient id="body" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="${BODY_EDGE}"/>
    <stop offset="1" stop-color="${BODY}"/>
  </linearGradient>`;

function logoSvg() {
  const L = markLayout();
  const { body, text } = markLayers(L);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" role="img" aria-label="1594·ADRS">
  <defs>
  ${bodyGradient}
  <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
    <feGaussianBlur stdDeviation="6" result="b"/>
    <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
  </filter>
  </defs>
  ${body}
  <g filter="url(#glow)">
  ${text}
  </g>
</svg>
`;
}

/* ---------- small mark: 32×32 favicon ---------- */

/** Mini chip with a pixel "A": text next to the A ("A▮", "A_") reads as "AI"/"A." at 16px. */
function faviconSvg() {
  const pins = [];
  for (const p of [10, 15, 20]) {
    pins.push(`M${p} 2h2v5h-2z`, `M${p} 25h2v5h-2z`, `M2 ${p}h5v2h-5z`, `M25 ${p}h5v2h-5z`);
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <path d="${pins.join('')}" fill="${GREEN}" opacity="0.7"/>
  <rect x="6" y="6" width="20" height="20" rx="4" fill="${BODY}" stroke="${GREEN}" stroke-width="2"/>
  <path d="${wordPath('A', 10.5, 10.5, 2.2)}" fill="${GREEN}"/>
</svg>
`;
}

/* ---------- PNG rendering ---------- */

const RENDERS = [
  { template: 'favicon-32.html', out: join(PUBLIC, 'favicon-32.png'), w: 32, h: 32 },
  { template: 'apple-touch-icon.html', out: join(PUBLIC, 'apple-touch-icon.png'), w: 180, h: 180 },
  { template: 'og-image.html', out: join(PUBLIC, 'og-image.png'), w: 1200, h: 630 },
];

async function renderPngs() {
  const chromePath = process.env.CHROME_PATH ?? defaultChrome();
  const port = 9400 + Math.floor(Math.random() * 400);
  const profile = mkdtempSync(join(tmpdir(), 'og-'));
  const chrome = spawn(chromePath, [
    '--headless=new',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profile}`,
    '--no-first-run',
    '--hide-scrollbars',
    'about:blank',
  ]);
  const exited = new Promise((res) => chrome.once('exit', res));
  let cdp;
  try {
    const page = await waitForPage(port);
    cdp = await connect(page.webSocketDebuggerUrl);
    await cdp.send('Page.enable');
    for (const r of RENDERS) {
      await cdp.send('Emulation.setDeviceMetricsOverride', {
        width: r.w,
        height: r.h,
        deviceScaleFactor: 1,
        mobile: false,
      });
      await cdp.send('Emulation.setDefaultBackgroundColorOverride', {
        color: { r: 0, g: 0, b: 0, a: 0 },
      });
      const loaded = cdp.once('Page.loadEventFired');
      await cdp.send('Page.navigate', { url: pathToFileURL(join(HERE, r.template)).href });
      await loaded;
      await cdp.send('Runtime.evaluate', {
        expression: 'document.fonts.ready',
        awaitPromise: true,
      });
      const shot = await cdp.send('Page.captureScreenshot', {
        format: 'png',
        clip: { x: 0, y: 0, width: r.w, height: r.h, scale: 1 },
      });
      writeFileSync(r.out, Buffer.from(shot.data, 'base64'));
      console.log('png', r.out);
    }
  } finally {
    // Close the browser itself (killing the launcher can leave child processes holding the profile).
    await cdp?.send('Browser.close').catch(() => {});
    cdp?.close();
    await Promise.race([exited, new Promise((res) => setTimeout(res, 5000))]);
    chrome.kill();
    try {
      rmSync(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
    } catch {
      console.warn('could not remove temporary Chrome profile', profile);
    }
  }
}

function defaultChrome() {
  if (process.platform === 'win32') return 'C:/Program Files/Google/Chrome/Application/chrome.exe';
  if (process.platform === 'darwin')
    return '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  return 'google-chrome';
}

async function waitForPage(port) {
  for (let i = 0; i < 50; i++) {
    try {
      const targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
      const page = targets.find((t) => t.type === 'page');
      if (page) return page;
    } catch {
      /* Chrome still starting */
    }
    await new Promise((res) => setTimeout(res, 200));
  }
  throw new Error('Chrome did not expose a DevTools page');
}

async function connect(url) {
  const ws = new WebSocket(url);
  await new Promise((res, rej) => {
    ws.addEventListener('open', res, { once: true });
    ws.addEventListener('error', rej, { once: true });
  });
  let id = 0;
  const pending = new Map();
  const listeners = new Map();
  ws.addEventListener('message', (e) => {
    const msg = JSON.parse(e.data);
    if (msg.id && pending.has(msg.id)) {
      const { res, rej } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? rej(new Error(msg.error.message)) : res(msg.result);
    } else if (msg.method && listeners.has(msg.method)) {
      listeners.get(msg.method)(msg.params);
      listeners.delete(msg.method);
    }
  });
  return {
    send: (method, params = {}) =>
      new Promise((res, rej) => {
        pending.set(++id, { res, rej });
        ws.send(JSON.stringify({ id, method, params }));
      }),
    once: (method) => new Promise((res) => listeners.set(method, res)),
    close: () => ws.close(),
  };
}

/* ---------- main ---------- */

writeFileSync(join(PUBLIC, 'logo.svg'), logoSvg());
writeFileSync(join(PUBLIC, 'favicon.svg'), faviconSvg());
console.log('svg public/logo.svg, public/favicon.svg');

if (!process.argv.includes('--svg-only')) await renderPngs();
