// Private catalog (docs/exercise-catalog/**/*.jsonl) → data/exercises/<source>/<chunk>.ts + index.ts.
// Only math fields are emitted; Thomas prose (`statement`, `prompt`, `note`) is dropped by construction.
// Usage (from portfolio/): node scripts/convert-exercise-catalog.mjs [repoRoot]. The catalog is gitignored.
import fs from 'node:fs';
import path from 'node:path';

const root = process.argv[2] ?? path.resolve(import.meta.dirname, '../..');
const catalog = path.join(root, 'docs/exercise-catalog');
const outDir = path.join(
  root,
  'portfolio/src/app/pages/web-projects/projects/graphing-calculator/data/exercises',
);
const SOURCES = ['thomas12', 'openstax1', 'openstax2', 'apex', 'synthetic'];
const OPS = new Set([
  'graph',
  'integral',
  'antiderivative',
  'area',
  'volume',
  'surface',
  'arc-length',
  'polar-area',
  'centroid',
  'roots',
  'extrema',
  'intersections',
  'derivative',
  'tangent',
  'limit',
  'newton',
  'riemann',
  'taylor',
  'ode',
  'sequence',
  'series',
]);
const SHAPES = new Set([
  'square',
  'rectangle',
  'equilateral-triangle',
  'right-isosceles-leg',
  'right-isosceles-hypotenuse',
  'semicircle',
  'circle',
]);
const OPEN = new Set(['openstax1', 'openstax2', 'apex']);

const STR_KEYS = [
  'a',
  'b',
  'wrt',
  'method',
  'variable',
  'shape',
  'x0',
  'side',
  'rule',
  'center',
  'f',
  'y0',
  'xEnd',
  'h',
];
const NUM_KEYS = ['heightRatio', 'steps', 'n', 'order', 'nStart', 'nMax'];
const droppedOpKeys = {};
// Transcription fixes found by the harness (kept here so re-extraction does not lose them).
const PATCHES = {
  // Book interval is [0, 2π): 2π itself is not listed as a root.
  'openstax1-1.3-161': (r) => (r.op.b = '2*pi - 0.001'),
  // Integrand transcribed in t; the integral is over x.
  'openstax2-1.2-95': (r) => (r.curves = r.curves.map((c) => c.replace(/\bt\b/g, 'x'))),
  // "for x > 0": only the lobe on [0, 1/2], not the symmetric one on [-1/2, 0].
  'openstax2-2.1-14': (r) => Object.assign(r.op, { a: '0', b: '0.5' }),
  // Test interval [1, 2] contains the pole of sec² at π/2.
  'thomas12-8.1-13': (r) => Object.assign(r.op, { a: '0', b: '1' }),
  // √(1−cos2x) = √2·|sin x| and ∫₀^π x|sin x| dx = π, so the answer is π√2 (transcribed √2).
  'thomas12-8.2-31': (r) => {
    r.uncertain = false; // the filter below drops `expected` from uncertain rows
    r.expected = { values: ['pi*sqrt(2)'], from: 'derived' };
  },
  // Test interval [0, 0.3] contains the pole of sec(2x+1)·tan(2x+1) at x = (π/2 − 1)/2.
  'thomas12-5.5-31': (r) => Object.assign(r.op, { a: '-0.5', b: '0' }),
  // op is roots of y″, which include the double zero at 0 (the book lists inflection points).
  'thomas12-4.4-110': (r) => (r.expected = { values: ['-3', '0', '2'], from: 'derived' }),
  // Judge spot-check: the region 0 ≤ r ≤ 2 − 2cos θ, not just its boundary (cartesian, as 11.3-13).
  'thomas12-11.4-27': (r) => (r.curves = ['(x^2+y^2+2*x)^2 <= 4*(x^2+y^2)']),
  // Test interval started at the removable singularity x = 0.
  'thomas12-8P-16': (r) => (r.op.a = '0.5'),
  // A power series' radius was transcribed as an unrelated sequence limit.
  'thomas12-10P-47': () => 'skip',
  // "Area enclosed by … , a ≤ x ≤ b": the transcription dropped the stated x-bounds.
  'thomas12-5.6-63': (r) => Object.assign(r.op, { a: '0', b: 'pi' }),
  'thomas12-5.6-64': (r) => Object.assign(r.op, { a: '-pi/3', b: 'pi/3' }),
  'thomas12-5.6-67': (r) => Object.assign(r.op, { a: '-pi/4', b: 'pi/4' }),
  'thomas12-5.6-70': (r) => Object.assign(r.op, { a: '-1', b: '1' }),
  'thomas12-5.6-74': (r) => Object.assign(r.op, { a: '0', b: 'pi/4' }),
  // Same for areas in y: the statement's y-bounds (or the line y = c / "x ≥ 0" that sets them).
  'thomas12-5.6-51': (r) => Object.assign(r.op, { a: '0', b: '3' }),
  'thomas12-5.6-61': (r) => Object.assign(r.op, { a: '-1', b: '1' }),
  'thomas12-5.6-68': (r) => Object.assign(r.op, { a: '-pi/4', b: 'pi/4' }),
  'thomas12-5.6-69': (r) => Object.assign(r.op, { a: '0', b: 'pi/2' }),
  'thomas12-5.6-76b': (r) => Object.assign(r.op, { a: '-1', b: '3' }),
  // Derived answers that contradict the statement: the triangle (0,0), (2,0), (1,1) has its
  // centroid at the vertex mean (1, 1/3); 2π∫₀² x²√(1+4x²) dx = 53.226 (82.82 is not it).
  'openstax2-2.6-286': (r) => (r.expected = { values: ['1', '1/3'], from: 'derived' }),
  'thomas12-6.4-2': (r) => (r.expected = { values: ['53.23'], tol: 0.005, from: 'derived' }),
  // The book truncates Simpson's (π/12)(2 + 4√2) = 2.004560 to 2.0045: one printed unit of tol.
  'thomas12-8.6-9IIa': (r) => (r.expected.tol = 5e-5),
  // Antiderivative test intervals that contain a pole of the integrand.
  'thomas12-7P-33': (r) => Object.assign(r.op, { a: '0', b: '0.5' }),
  'thomas12-7P-34': (r) => Object.assign(r.op, { a: '0', b: '0.1' }),
  'thomas12-8P-44': (r) => Object.assign(r.op, { a: '0', b: '0.4' }),
  'thomas12-8A-47': (r) => Object.assign(r.op, { a: '1', b: '2.5' }),
  // The answer is a polynomial approximation with |error| < 1E-3, not the exact antiderivative.
  ...Object.fromEntries(
    ['26', '27a', '27b', '28a', '28b'].map((n) => [
      `thomas12-10.10-${n}`,
      (r) => (r.expected.tol = 0.01),
    ]),
  ),
  // Parametric part (b) asks for d²y/dx²; the transcription left the default first derivative.
  ...Object.fromEntries(
    [...Array.from({ length: 14 }, (_, i) => `11.2-${i + 1}b`), '11P-9b', '11P-10b'].map((n) => [
      `thomas12-${n}`,
      (r) => (r.op.order = 2),
    ]),
  ),
  // d/dx acosh(sec x) = sec x·sign(tan x); the book's sec x holds only where tan x > 0.
  'thomas12-7.7-36': (r) => (r.expected.fn = 'sec(x)*sign(tan(x))'),
  // Δf = f(b) − f(a) for linearization error was modeled as ∫ f; no op fits.
  // Percent error 100·f′(x)dx/f(x) was modeled as f′(x0) (judge spot-check); no op fits either.
  ...Object.fromEntries(
    ['29a', '30a', '31a', '32a', '33a', '34a', '41b', '45a', '45b', '46a', '46b', '49'].map((n) => [
      `thomas12-3.9-${n}`,
      () => 'skip',
    ]),
  ),
  // Implicit tangents: the prompt gives the point "(x0, y0)" but only x0 was transcribed, and
  // F(x0, y) = 0 has several roots there.
  ...Object.fromEntries(
    [
      ['3.8-311', '1'],
      ['3.8-312', '1'],
      ['3.8-313', '-3'],
      ['3.8-314', '2'],
      ['3.9-356', '1'],
    ].map(([n, y0]) => [`openstax1-${n}`, (r) => (r.op.y0 = y0)]),
  ),
  // sin(1−x+x·ln x) solves the ODE only up to x ≈ 3.24 (1−y² must stay ≥ 0): check a value at 3.
  'openstax2-4.3-139': (r) => {
    r.op.xEnd = '3';
    r.expected = { values: ['sin(3*ln(3)-2)'], from: 'derived' };
  },
  // Extra seed a(2) overrides the recurrence order; a(1) = 1 alone gives the golden-ratio limit.
  'thomas12-10A-7': (r) => (r.curves = r.curves.filter((c) => c !== 'a(2) = 1')),
  // Degenerate a^n with a free parameter a.
  'thomas12-10.6-52': () => 'skip',
  // Inverse of sin at a = 0: the point is (0, 0), not another root of sin(y) = 0.
  'openstax1-3.7-267': (r) => (r.op.y0 = '0'),
  // Note "interval [2,5]": y0 = 27/10, the point the expected tangent passes through.
  'thomas12-7.1-65d': (r) => (r.op.y0 = '27/10'),
  // No x0 in the prompt; the transcribed −2 lands on the other critical point (N(−2) = 1 exactly).
  'openstax1-4.9-441': (r) => (r.op.x0 = '-0.5'),
  // q = ∛(2r − r²) (statement); the transcribed answer is the derivative of 3^(1/(2x − x²)).
  'thomas12-3.6-20': (r) => (r.expected = { fn: '(2 - 2*x)/(3*root(3, (2*x - x^2)^2))', from: 'derived' }),
  // The statement asks for dx/dy; the op computes dy/dx = 1/(dx/dy).
  'thomas12-3.7-51b': (r) => (r.expected.fn = `1/(${r.expected.fn})`),
  'thomas12-3.7-52b': (r) => (r.expected.fn = `1/(${r.expected.fn})`),
  // f(0) = 0 by definition in the statement; the transcription dropped the piecewise value.
  'thomas12-3A-16': (r) => (r.curves = ['y = if(abs(x) > 0, (1-cos(x))/x, 0)']),
  // The answer holds on the domain the statement states (|x| < π/2, 0 < u < 1, x > 1…): outside
  // it the expected fn is made undefined (+ 0·√(negative)) so it is not compared there.
  ...Object.fromEntries(
    [
      ['5.4-39', 'pi/2 - abs(x)'],
      ['7P-15', 'x*(1 - x)'],
      ['7P-23', 'x*(pi/2 - x)'],
      ['7.6-39', 'x - 1'],
      ['7P-21', 'x - 1'],
    ].map(([n, inside]) => [
      `thomas12-${n}`,
      (r) => (r.expected.fn = `${r.expected.fn} + 0*sqrt(${inside})`),
    ]),
  ),
  // Differentials: expected is df = f′(x0)·dx (note), not the f′(x0) the op returns.
  ...Object.fromEntries(
    ['29b', '30b', '31b', '32b', '33b', '34b', '41a', '42a', '42b', '43'].map((n) => [
      `thomas12-3.9-${n}`,
      (r) => delete r.expected,
    ]),
  ),
  // Expected holds the max error VALUE (or absolute extrema at the ends / union of two curves'
  // roots / a non-root of an undefined point), not what the op returns: keep the case, drop the answer.
  ...Object.fromEntries(
    // 11.5-* / 11P-49: the interval spans one lobe but the answer is the whole curve's area.
    [
      '3.9-55d',
      '3.9-56d',
      '3.9-57d',
      '3.9-58d',
      '3.4-27b',
      '4.2-15aiii',
      '4.3-11',
      '11.5-8',
      '11.5-13',
      '11.5-18',
      '11.5-19a',
      '11P-49',
    ].map((id) => [`thomas12-${id}`, (r) => delete r.expected]),
  ),
};
function cleanOp(op) {
  const out = { kind: op.kind };
  for (const [k, v] of Object.entries(op)) {
    if (k === 'kind' || v === undefined || v === null) continue;
    if (STR_KEYS.includes(k)) out[k] = String(v);
    else if (NUM_KEYS.includes(k)) out[k] = Number(v);
    else if (k === 'lateral' || k === 'normal') out[k] = Boolean(v);
    else if (k === 'axis') out.axis = { orientation: v.orientation, value: String(v.value) };
    else droppedOpKeys[k] = (droppedOpKeys[k] ?? 0) + 1;
  }
  return out;
}

const files = [];
for (const dir of ['thomas12', 'open']) {
  const d = path.join(catalog, dir);
  if (!fs.existsSync(d)) continue;
  for (const f of fs.readdirSync(d).sort()) if (f.endsWith('.jsonl')) files.push(path.join(d, f));
}

const skipped = {};
const skip = (why) => (skipped[why] = (skipped[why] ?? 0) + 1);
const chunks = new Map(); // 'thomas12/ch06' → Exercise[]
const seen = new Set();
let total = 0;

for (const file of files) {
  for (const [i, line] of fs.readFileSync(file, 'utf8').split(/\r?\n/).entries()) {
    if (!line.trim()) continue;
    total++;
    let r;
    try {
      r = JSON.parse(line);
    } catch {
      console.warn(`bad json ${path.basename(file)}:${i + 1}`);
      skip('bad-json');
      continue;
    }
    if (r.calculable === false) {
      skip(`not-calculable:${r.reason ?? '?'}`);
      continue;
    }
    if (!SOURCES.includes(r.source) || !r.id?.startsWith(`${r.source}-`)) {
      skip('bad-source');
      continue;
    }
    if (!Array.isArray(r.curves) || !r.curves.every((c) => typeof c === 'string')) {
      skip('bad-curves');
      continue;
    }
    if (!r.op || !OPS.has(r.op.kind)) {
      skip('bad-op');
      continue;
    }
    // Vol 1 ch5 is the same text and numbering as Vol 2 ch1.
    if (r.source === 'openstax1' && /^5\./.test(r.section)) {
      skip('dup:openstax1-ch5');
      continue;
    }
    // Variable density changes the quantity; the contract has no field for it.
    if (r.density) {
      skip('density');
      continue;
    }
    if (seen.has(r.id)) {
      skip('dup-id');
      continue;
    }
    seen.add(r.id);
    // A cross-section given by its area A(x) is just ∫ A.
    if (r.op.shape === 'custom') {
      if (!r.op.areaFn) {
        skip('custom-shape-without-areaFn');
        continue;
      }
      r.curves = [`y = ${r.op.areaFn}`];
      r.op = { kind: 'integral', a: r.op.a, b: r.op.b };
    }
    if (PATCHES[r.id]?.(r) === 'skip') {
      skip('patched-out');
      continue;
    }
    // Textbooks ask for the lateral surface; the calculator's surface is the closed solid's total.
    if (r.op.kind === 'surface' && r.source !== 'synthetic') r.op.lateral = true;
    if (r.op.shape && !SHAPES.has(r.op.shape)) {
      skip(`unknown-shape:${r.op.shape}`);
      continue;
    }

    const ex = {
      id: r.id,
      source: r.source,
      section: String(r.section),
      number: String(r.number),
      curves: r.curves,
      ...(r.paramRange && { paramRange: { a: String(r.paramRange.a), b: String(r.paramRange.b) } }),
      op: cleanOp(r.op),
    };
    // An `uncertain` book value failed the transcriber's numeric check: keep the case, drop the answer.
    const e = r.expected;
    if (e && !r.uncertain && (e.values?.length || e.fn)) {
      ex.expected = {
        ...(e.values?.length && { values: e.values.map(String) }),
        ...(e.fn && { fn: e.fn }),
        ...(typeof e.tol === 'number' && { tol: e.tol }),
        from: e.from === 'book' ? 'book' : 'derived',
      };
    }
    if (OPEN.has(r.source)) {
      if (r.prompt) ex.prompt = r.prompt;
      if (r.license) ex.license = r.license;
    }
    if (r.source === 'thomas12' && (ex.prompt || ex.statement))
      throw new Error(`prose leak ${r.id}`);

    const ch = /^(\d+)/.exec(ex.section)?.[1];
    const chunk =
      r.source === 'synthetic' ? 'synthetic/edge' : `${r.source}/ch${ch.padStart(2, '0')}`;
    if (!chunks.has(chunk)) chunks.set(chunk, []);
    chunks.get(chunk).push(ex);
  }
}

// The catalog is gitignored: without it `files` is empty and the cleanup below would wipe every chunk.
if (!files.length) {
  console.error(`No .jsonl files under ${catalog}; refusing to delete the generated chunks.`);
  process.exit(1);
}

// Remove previously generated chunks (all but the hand-written smoke set).
for (const s of SOURCES) {
  const d = path.join(outDir, s);
  if (!fs.existsSync(d)) continue;
  for (const f of fs.readdirSync(d))
    if (f.endsWith('.ts') && f !== 'smoke.ts') fs.rmSync(path.join(d, f));
}

const header =
  '// Generated from the private exercise catalog by scripts/convert-exercise-catalog.mjs; do not edit by hand.\n';
for (const [chunk, list] of chunks) {
  const file = path.join(outDir, `${chunk}.ts`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const body = list.map((ex) => `  ${JSON.stringify(ex)},`).join('\n');
  fs.writeFileSync(
    file,
    `${header}import type { Exercise } from '../exercise.types';\n\nexport default [\n${body}\n] satisfies Exercise[];\n`,
  );
}

const names = ['synthetic/smoke', ...[...chunks.keys()].sort()];
fs.writeFileSync(
  path.join(outDir, 'index.ts'),
  `import type { Exercise } from './exercise.types';

/**
 * Lazy registry of exercise chunks (\`<source>/<chunk>.ts\`, each \`export default [...] satisfies
 * Exercise[]\`). Dynamic imports keep every chunk out of the app bundle until something loads it.
 * Every entry except \`synthetic/smoke\` is generated from the private catalog.
 */
export const EXERCISE_CHUNKS: Record<string, () => Promise<Exercise[]>> = {
${names.map((n) => `  '${n}': () => import('./${n}').then((m) => m.default),`).join('\n')}
};
`,
);

const emitted = [...chunks.values()].reduce((n, l) => n + l.length, 0);
console.log(`records ${total} → emitted ${emitted} in ${chunks.size} chunks`);
if (Object.keys(droppedOpKeys).length) console.log('dropped op keys', droppedOpKeys);
for (const [k, n] of Object.entries(skipped).sort((a, b) => b[1] - a[1]))
  console.log(`  skip ${k}: ${n}`);
