import { describe, it, expect, afterEach, vi } from 'vitest';
import { Viewport } from './viewport';
import {
  drawFunction,
  drawExplicitY,
  drawParametric,
  drawPolar,
  drawAsymptote,
} from './graph-renderer';
import { drawGrid } from './grid-renderer';
import { drawImplicitCurve } from './implicit-renderer';
import { detectAsymptotes } from '../engine/asymptote-detector';
import { parse } from '../engine/parser';
import { compileExpression } from '../engine/evaluator';

/*
 * Rendering stress test at extreme viewports (zoom far out / far in, pan far in x and y).
 * Drives the real renderers with a recording 2D context and checks screen-space invariants.
 * Known bugs are registered with it.fails via the KNOWN table, so fixing one flips its test.
 */

type Pt = [number, number];
type Seg = [number, number, number, number];

interface Recording {
  ctx: CanvasRenderingContext2D;
  paths: Pt[][];
  texts: Array<{ text: string; x: number; y: number; align: string }>;
  ops: number;
}

function record(): Recording {
  const rec: Recording = {
    ctx: null as unknown as CanvasRenderingContext2D,
    paths: [],
    texts: [],
    ops: 0,
  };
  let cur: Pt[] | null = null;
  const state: Record<string | symbol, unknown> = { textAlign: 'start' };
  const methods: Record<string, unknown> = {
    beginPath: () => (cur = null),
    moveTo: (x: number, y: number) => {
      rec.ops++;
      cur = [[x, y]];
      rec.paths.push(cur);
    },
    lineTo: (x: number, y: number) => {
      rec.ops++;
      if (cur) cur.push([x, y]);
      else rec.paths.push((cur = [[x, y]]));
    },
    fillText: (text: string, x: number, y: number) =>
      rec.texts.push({ text: String(text), x, y, align: String(state['textAlign']) }),
    measureText: (t: string) => ({ width: t.length * 7 }),
  };
  // Every other canvas method (stroke, save, setLineDash, ...) is a no-op; property writes are kept.
  rec.ctx = new Proxy(state, {
    get: (t, k) =>
      typeof k === 'string' && k in methods ? methods[k] : k in t ? t[k] : () => undefined,
  }) as unknown as CanvasRenderingContext2D;
  return rec;
}

// ---------------------------------------------------------------- viewports

interface View {
  name: string;
  cx: number;
  cy: number;
  w: number;
  W: number;
  H: number;
}
const DESK = { W: 1200, H: 800 };
const PHONE = { W: 360, H: 500 };
const TALL = { W: 375, H: 812 }; // phone canvas with the sheet at peek, as in the app
const view = (name: string, cx: number, cy: number, w: number, c = DESK): View => ({
  name,
  cx,
  cy,
  w,
  ...c,
});
const vpOf = (v: View) => {
  const h = (v.w * v.H) / v.W; // equal x/y scale, like fitAspect
  return new Viewport(v.cx - v.w / 2, v.cx + v.w / 2, v.cy - h / 2, v.cy + h / 2);
};

const MATRIX: View[] = [
  view('default', 0, 0, 20),
  view('out1e3', 0, 0, 1e3),
  view('out1e6', 0, 0, 1e6),
  view('out1e12', 0, 0, 1e12),
  view('out1e15', 0, 0, 1e15),
  view('in1e-6', 0, 0, 1e-6),
  view('in1e-10', 0, 0, 1e-10),
  view('x+1e6', 1e6, 0, 20),
  view('x-1e6', -1e6, 0, 20),
  view('x1e9', 1e9, 0, 20),
  view('x1e12', 1e12, 0, 20),
  view('y+1e9', 0, 1e9, 20),
  view('y-1e9', 0, -1e9, 20),
  view('x1e6 in1e-6', 1e6, 0, 1e-6),
  view('x1e9 in1e-6', 1e9, 0, 1e-6),
  view('x1e9 out1e3', 1e9, 0, 1e3),
  view('phone default', 0, 0, 20, PHONE),
  view('phone x+1e6', 1e6, 0, 20, PHONE),
  view('phone in1e-6', 0, 0, 1e-6, PHONE),
  view('tall default', 0, 0, 20, TALL),
];
const pick = (...names: string[]) => MATRIX.filter((v) => names.includes(v.name));

// Parser: scientific notation needs uppercase E (lowercase e is Euler's number).
const lit = (c: number) => `(${String(c).toUpperCase()})`;
function compile(src: string) {
  const ast = parse(src);
  const c = compileExpression(ast);
  return { ast, fx: (x: number) => c(x, 0), fy: (y: number) => c(0, y), fxy: c };
}

// ---------------------------------------------------------------- screen frame

/** u = screen px along the independent axis, v = screen px along the dependent one. */
interface Frame {
  N: number;
  M: number;
  indepAt(u: number): number;
  toU(w: number): number;
  toV(w: number): number;
  uv(p: Pt): Pt;
}
function frameOf(vp: Viewport, W: number, H: number, axis: 'x' | 'y'): Frame {
  const sx = (x: number) => ((x - vp.xMin) / (vp.xMax - vp.xMin)) * W;
  const sy = (y: number) => H - ((y - vp.yMin) / (vp.yMax - vp.yMin)) * H;
  return axis === 'x'
    ? {
        N: W,
        M: H,
        indepAt: (u) => vp.xMin + (u / W) * (vp.xMax - vp.xMin),
        toU: sx,
        toV: sy,
        uv: (p) => p,
      }
    : {
        N: H,
        M: W,
        indepAt: (u) => vp.yMax - (u / H) * (vp.yMax - vp.yMin),
        toU: sy,
        toV: sx,
        uv: ([x, y]) => [y, x],
      };
}
function segmentsOf(rec: Recording, fr: Frame): Seg[] {
  const out: Seg[] = [];
  for (const p of rec.paths)
    for (let i = 1; i < p.length; i++) {
      const [u0, v0] = fr.uv(p[i - 1]);
      const [u1, v1] = fr.uv(p[i]);
      out.push([u0, v0, u1, v1]);
    }
  return out;
}

// ---------------------------------------------------------------- invariants (return problems)

function finiteCoords(rec: Recording): string[] {
  const bad = rec.paths.flat().filter(([x, y]) => !Number.isFinite(x) || !Number.isFinite(y));
  return bad.length ? [`${bad.length} non-finite points`] : [];
}

function boundedCoords(rec: Recording, W: number, H: number): string[] {
  // Canvas backends store path coordinates as float32: past 2^24 px they lose whole-pixel precision.
  const m = 2 ** 24;
  let n = 0;
  let worst = 0;
  for (const [x, y] of rec.paths.flat()) {
    const out = Math.max(-m - x, x - W - m, -m - y, y - H - m);
    if (out > 0) {
      n++;
      worst = Math.max(worst, Math.abs(x), Math.abs(y));
    }
  }
  return n ? [`${n} points beyond 2^24 px, worst |coord| ${worst.toExponential(2)}px`] : [];
}

function noPoleBridge(segs: Seg[], fr: Frame, poles: number[]): string[] {
  const out: string[] = [];
  for (const p of poles) {
    const pu = fr.toU(p);
    const n = segs.filter(
      ([u0, v0, u1, v1]) => (u0 - pu) * (u1 - pu) < 0 && Math.abs(v1 - v0) > fr.M / 2,
    ).length;
    if (n) out.push(`${n} segments bridge the pole at ${p}`);
  }
  return out;
}

/** At a finite jump wider than 3 px on screen, no segment may draw the riser between the sides. */
function noJumpBridge(segs: Seg[], fr: Frame, f: (w: number) => number, jumps: number[]): string[] {
  const out: string[] = [];
  const onScreen = (a: number, b: number) =>
    Math.min(fr.M, Math.max(a, b)) - Math.max(0, Math.min(a, b));
  for (const j of jumps) {
    const pu = fr.toU(j);
    const gap = onScreen(fr.toV(f(fr.indepAt(pu - 1))), fr.toV(f(fr.indepAt(pu + 1))));
    if (!(gap > 3)) continue;
    const n = segs.filter(
      ([u0, v0, u1, v1]) =>
        Math.min(u0, u1) - 1 <= pu && pu <= Math.max(u0, u1) + 1 && onScreen(v0, v1) > gap / 2,
    ).length;
    if (n) out.push(`${n} segments draw a riser across the jump at ${j} (${gap.toFixed(0)} px)`);
  }
  return out;
}

/**
 * Next to a visible pole, on each side where the function diverges beyond an edge (at 0.5 px from
 * the pole) and is visible somewhere on that side, a drawn path between the pole column and the
 * column where the true curve enters the canvas must reach within 3 px of that edge (beyond counts).
 */
function poleReach(rec: Recording, fr: Frame, f: (w: number) => number, poles: number[]): string[] {
  const out: string[] = [];
  const pus = poles.map((p) => fr.toU(p));
  for (const pu of pus) {
    if (pu < 3 || pu > fr.N - 3) continue;
    for (const s of [-1, 1]) {
      const others = pus.filter((q) => s * (q - pu) > 0).map((q) => Math.abs(q - pu) / 2);
      const extent = Math.min(s > 0 ? fr.N - pu : pu, ...others);
      if (extent < 1) continue;
      const vNear = fr.toV(f(fr.indepAt(pu + s * 0.5)));
      if (Number.isNaN(vNear) || (vNear >= 0 && vNear <= fr.M)) continue;
      const low = vNear < 0;
      let enter = NaN; // px from the pole where the true curve first enters the canvas
      for (let k = 0; k < 200 && Number.isNaN(enter); k++) {
        const d = 0.5 * Math.pow(extent / 0.5, k / 199);
        const v = fr.toV(f(fr.indepAt(pu + s * d)));
        if (v >= 0 && v <= fr.M) enter = d;
      }
      if (Number.isNaN(enter)) continue;
      let best = low ? Infinity : -Infinity;
      for (const path of rec.paths) {
        const pts = path.map(fr.uv);
        if (!pts.some(([, v]) => v >= 0 && v <= fr.M)) continue;
        for (let i = 1; i < pts.length; i++) {
          const [u0, v0] = pts[i - 1];
          const [u1, v1] = pts[i];
          const d0 = s * (u0 - pu);
          const d1 = s * (u1 - pu);
          if (d0 < 0 || d1 < 0 || Math.min(d0, d1) > enter + 1) continue;
          best = low ? Math.min(best, v0, v1) : Math.max(best, v0, v1);
        }
      }
      const ok = low ? best <= 3 : best >= fr.M - 3;
      if (!ok)
        out.push(
          `pole u=${pu.toFixed(1)} side ${s > 0 ? '+' : '-'}: reaches v=${best.toFixed(0)}, needs ${low ? '<=3' : `>=${fr.M - 3}`}`,
        );
    }
  }
  return out;
}

/** The drawn curve covers at least 80 % of the screen columns (and rows, for continuous curves) the true curve visits. */
function coverage(
  segs: Seg[],
  fr: Frame,
  f: (w: number) => number,
  poles: number[],
  continuous: boolean,
): string[] {
  const pus = poles.map((p) => fr.toU(p));
  const expCols = new Uint8Array(fr.N);
  const expRows = new Uint8Array(fr.M);
  for (let u = 0; u < fr.N; u++) {
    if (pus.some((q) => Math.abs(q - u - 0.5) <= 1.5)) continue;
    const a = fr.toV(f(fr.indepAt(u)));
    const b = fr.toV(f(fr.indepAt(u + 1)));
    if (!Number.isFinite(a) || !Number.isFinite(b)) continue;
    const lo = Math.min(a, b);
    const hi = Math.max(a, b);
    if (hi < 0 || lo > fr.M) continue;
    // A discontinuous curve may jump across the band inside a column without being visible there.
    if (!continuous && !((a >= 0 && a <= fr.M) || (b >= 0 && b <= fr.M))) continue;
    expCols[u] = 1;
    for (let r = Math.max(0, Math.floor(lo)); r <= Math.min(fr.M - 1, Math.floor(hi)); r++)
      expRows[r] = 1;
  }
  const cols = new Uint8Array(fr.N);
  const rows = new Uint8Array(fr.M);
  for (const [u0, v0, u1, v1] of segs) {
    const [ua, ub, va, vb] = [
      Math.min(u0, u1),
      Math.max(u0, u1),
      Math.min(v0, v1),
      Math.max(v0, v1),
    ];
    if (![ua, ub, va, vb].every(Number.isFinite) || ub < 0 || ua > fr.N || vb < 0 || va > fr.M)
      continue;
    for (let u = Math.max(0, Math.floor(ua)); u <= Math.min(fr.N - 1, Math.floor(ub)); u++)
      cols[u] = 1;
    for (let r = Math.max(0, Math.floor(va)); r <= Math.min(fr.M - 1, Math.floor(vb)); r++)
      rows[r] = 1;
  }
  const sum = (a: Uint8Array) => a.reduce((s, x) => s + x, 0);
  const out: string[] = [];
  const [ec, er, dc, dr] = [sum(expCols), sum(expRows), sum(cols), sum(rows)];
  if (ec >= 10 && dc < 0.8 * ec) out.push(`draws ${dc} distinct columns, expected ~${ec}`);
  if (continuous && er >= 10 && dr < 0.8 * er)
    out.push(`draws ${dr} distinct rows, expected ~${er}`);
  return out;
}

function budget(rec: Recording, ms: number): string[] {
  const out: string[] = [];
  if (rec.ops > 60_000) out.push(`${rec.ops} path ops`);
  if (ms > 250) out.push(`${ms.toFixed(0)} ms`);
  return out;
}

// ---------------------------------------------------------------- known bugs

// Still-open bugs, as { 'test name': 'reason' }: each runs as it.fails until fixed. None open.
const KNOWN: Record<string, string> = {};

const registered = new Set<string>();
function check(name: string, problems: () => string[]): void {
  registered.add(name);
  const bug = KNOWN[name];
  const body = () => {
    const p = problems();
    expect(p, p.join(' ; ')).toEqual([]);
  };
  if (bug) it.fails(`${name} — ${bug}`, body);
  else it(name, body);
}

// ---------------------------------------------------------------- y = f(x)

interface FnCase {
  label: string;
  src: (v: View) => string;
  poles?: (vp: Viewport, W: number) => number[];
  odd?: boolean;
  continuous?: boolean;
  jumps?: (vp: Viewport) => number[];
}
const at = (p: number) => (vp: Viewport) => (p > vp.xMin && p < vp.xMax ? [p] : []);
const poleOfShift = (v: View) => v.cx + 0.1 * v.w;
function tanPoles(vp: Viewport, W: number): number[] {
  if ((Math.PI / (vp.xMax - vp.xMin)) * W < 20) return []; // poles closer than 20 px: not resolvable
  const out: number[] = [];
  for (let k = Math.ceil(vp.xMin / Math.PI - 0.5); (k + 0.5) * Math.PI < vp.xMax; k++)
    out.push((k + 0.5) * Math.PI);
  return out;
}

const FN_CASES: FnCase[] = [
  { label: 'tan(x)', src: () => 'tan(x)', poles: tanPoles, odd: true },
  { label: '1/x', src: () => '1/x', poles: at(0), odd: true },
  { label: '1/(x-c)', src: (v) => `1/(x-${lit(poleOfShift(v))})`, odd: true },
  { label: '1/x^2', src: () => '1/x^2', poles: at(0) },
  { label: 'ln|x|', src: () => 'ln(abs(x))', poles: at(0) },
  { label: 'cbrt(x)', src: () => 'cbrt(x)', continuous: true },
  { label: 'sqrt(x)', src: () => 'sqrt(x)', continuous: true },
  { label: 'sin(1/x)', src: () => 'sin(1/x)' },
  { label: 'floor(x)', src: () => 'floor(x)' },
  { label: 'exp(x)', src: () => 'exp(x)', continuous: true },
  { label: 'x', src: () => 'x', continuous: true },
  { label: '1000x', src: () => '1000*x', continuous: true },
  { label: 'jump if(x<0,-1,1)', src: () => 'if(x<0,-1,1)', jumps: at(0) },
  {
    label: 'jump+pole if(x<1,1/x,x+5)',
    src: () => 'if(x<1,1/x,x+5)',
    poles: at(0),
    odd: true,
    jumps: at(1),
  },
];

/** Views centred on the curve itself far from the origin: (c, f(c)). */
const FOLLOW: Array<[string, string, number, number]> = [];
for (const s of ['x', 'floor(x)', 'cbrt(x)', 'sqrt(x)', 'ln(x)', 'sin(x)+x'])
  for (const [c, w] of [
    [1e6, 20],
    [1e6, 1e-3],
    [1e9, 20],
    [1e12, 20],
  ])
    FOLLOW.push([s, `follow ${s} @${c.toExponential()} w${w}`, c, w]);

function runFn(
  label: string,
  src: string,
  v: View,
  fc: Omit<FnCase, 'label' | 'src'>,
  poleOverride?: number,
) {
  const vp = vpOf(v);
  const { ast, fx } = compile(src);
  const rec = record();
  const t0 = performance.now();
  drawFunction(rec.ctx, vp, fx, '#fff', v.W, v.H, ast);
  const ms = performance.now() - t0;
  const fr = frameOf(vp, v.W, v.H, 'x');
  const segs = segmentsOf(rec, fr);
  const poles = poleOverride !== undefined ? at(poleOverride)(vp) : (fc.poles?.(vp, v.W) ?? []);
  const key = `${label}@${v.name}`;
  check(`${key} finite`, () => finiteCoords(rec));
  check(`${key} bounded`, () => boundedCoords(rec, v.W, v.H));
  if (fc.odd && poles.length) check(`${key} no pole bridge`, () => noPoleBridge(segs, fr, poles));
  if (poles.length) check(`${key} reaches edges at poles`, () => poleReach(rec, fr, fx, poles));
  const jumps = fc.jumps?.(vp) ?? [];
  if (jumps.length) check(`${key} no jump bridge`, () => noJumpBridge(segs, fr, fx, jumps));
  check(`${key} coverage`, () => coverage(segs, fr, fx, poles, !!fc.continuous));
  check(`${key} budget`, () => budget(rec, ms));
}

describe('viewport stress: y = f(x)', () => {
  for (const fc of FN_CASES)
    describe(fc.label, () => {
      for (const v of MATRIX)
        runFn(fc.label, fc.src(v), v, fc, fc.label === '1/(x-c)' ? poleOfShift(v) : undefined);
    });
  describe('follow the curve far from the origin', () => {
    for (const [s, name, c, w] of FOLLOW) {
      const cy = compile(s).fx(c);
      runFn(s, s, view(name, c, cy, w), { continuous: s !== 'floor(x)' });
    }
    for (const k of [1e5, 1e7, 1e9])
      runFn('const', lit(k), view(`y=${k.toExponential()}`, 0, k, 20), { continuous: true });
    runFn('300x', '300*x', view('phone default', 0, 0, 20, PHONE), { continuous: true });
  });
});

// ---------------------------------------------------------------- x = g(y), parametric, polar

describe('viewport stress: x = g(y)', () => {
  const views = [
    ...pick('default', 'out1e3', 'out1e6', 'in1e-6', 'y+1e9', 'y-1e9', 'phone default'),
    view('in1e-3', 0, 0, 1e-3),
  ];
  const cases: Array<{
    label: string;
    src: (v: View, h: number) => string;
    pole?: (v: View, h: number) => number;
    continuous?: boolean;
  }> = [
    {
      label: 'x=1/(y-c)',
      src: (v, h) => `1/(y-${lit(v.cy + 0.1 * h)})`,
      pole: (v, h) => v.cy + 0.1 * h,
    },
    { label: 'x=1000y', src: () => '1000*y', continuous: true },
    { label: 'x=cbrt(y)', src: () => 'cbrt(y)', continuous: true },
    { label: 'x=exp(y)', src: () => 'exp(y)', continuous: true },
  ];
  for (const c of cases)
    describe(c.label, () => {
      for (const v of views) {
        const vp = vpOf(v);
        const h = vp.yMax - vp.yMin;
        const { fy } = compile(c.src(v, h));
        const rec = record();
        const t0 = performance.now();
        drawExplicitY(rec.ctx, vp, fy, '#fff', v.W, v.H);
        const ms = performance.now() - t0;
        const fr = frameOf(vp, v.W, v.H, 'y');
        const segs = segmentsOf(rec, fr);
        const p = c.pole?.(v, h);
        const poles = p !== undefined && p > vp.yMin && p < vp.yMax ? [p] : [];
        const key = `${c.label}@${v.name}`;
        check(`${key} finite`, () => finiteCoords(rec));
        check(`${key} bounded`, () => boundedCoords(rec, v.W, v.H));
        if (poles.length) {
          check(`${key} no pole bridge`, () => noPoleBridge(segs, fr, poles));
          check(`${key} reaches edges at poles`, () => poleReach(rec, fr, fy, poles));
        }
        check(`${key} coverage`, () => coverage(segs, fr, fy, poles, !!c.continuous));
        check(`${key} budget`, () => budget(rec, ms));
      }
    });
});

describe('viewport stress: parametric and polar', () => {
  const views = pick('default', 'out1e3', 'out1e6', 'phone default');
  for (const v of views) {
    const vp = vpOf(v);
    // (1/t, t): the parametric twin of x = 1/y, horizontal asymptote y = 0 (x -> +-inf).
    {
      const rec = record();
      const t0 = performance.now();
      drawParametric(
        rec.ctx,
        vp,
        (t) => 1 / t,
        (t) => t,
        -10,
        10,
        '#fff',
        v.W,
        v.H,
      );
      const ms = performance.now() - t0;
      const fr = frameOf(vp, v.W, v.H, 'y');
      const segs = segmentsOf(rec, fr);
      const g = (y: number) => 1 / y;
      const key = `(1/t,t)@${v.name}`;
      check(`${key} finite`, () => finiteCoords(rec));
      check(`${key} bounded`, () => boundedCoords(rec, v.W, v.H));
      check(`${key} no pole bridge`, () => noPoleBridge(segs, fr, [0]));
      check(`${key} reaches edges at poles`, () => poleReach(rec, fr, g, [0]));
      check(`${key} budget`, () => budget(rec, ms));
    }
    // r = sec(theta): the vertical line x = 1, r -> inf; it should span the full height.
    {
      const rec = record();
      const t0 = performance.now();
      drawPolar(rec.ctx, vp, (t) => 1 / Math.cos(t), 0, 2 * Math.PI, '#fff', v.W, v.H);
      const ms = performance.now() - t0;
      const fr = frameOf(vp, v.W, v.H, 'y');
      const key = `r=sec@${v.name}`;
      check(`${key} finite`, () => finiteCoords(rec));
      check(`${key} bounded`, () => boundedCoords(rec, v.W, v.H));
      check(`${key} coverage`, () => coverage(segmentsOf(rec, fr), fr, () => 1, [], true));
      check(`${key} budget`, () => budget(rec, ms));
    }
    // r = 1/theta: spiral with horizontal asymptote y = 1 as x -> +inf; it should reach the right edge.
    {
      const rec = record();
      drawPolar(rec.ctx, vp, (t) => 1 / t, 0, 2 * Math.PI, '#fff', v.W, v.H);
      const key = `r=1/theta@${v.name}`;
      check(`${key} finite`, () => finiteCoords(rec));
      check(`${key} bounded`, () => boundedCoords(rec, v.W, v.H));
      check(`${key} reaches the right edge`, () => {
        const xs = rec.paths
          .filter((p) => p.length > 1)
          .flat()
          .map(([x]) => x);
        const right = Math.max(...xs);
        return right >= v.W - 3 ? [] : [`stops at x=${right.toFixed(0)}px`];
      });
    }
  }
});

// ---------------------------------------------------------------- implicit

describe('viewport stress: implicit curves', () => {
  afterEach(() => vi.unstubAllGlobals());
  const run = (label: string, src: string, v: View, line?: boolean) => {
    vi.stubGlobal('Path2D', undefined);
    const vp = vpOf(v);
    const { fxy } = compile(src);
    const rec = record();
    const t0 = performance.now();
    drawImplicitCurve(rec.ctx, vp, fxy, '#fff', v.W, v.H);
    const ms = performance.now() - t0;
    vi.unstubAllGlobals();
    const key = `${label}@${v.name}`;
    check(`${key} finite`, () => finiteCoords(rec));
    check(`${key} bounded`, () => boundedCoords(rec, v.W, v.H));
    check(`${key} budget`, () => budget(rec, ms));
    if (line) {
      const fr = frameOf(vp, v.W, v.H, 'x');
      check(`${key} coverage`, () => coverage(segmentsOf(rec, fr), fr, (x) => x, [], true));
    }
  };
  for (const v of MATRIX) run('xy=1', 'x*y-1', v);
  for (const c of [1e6, 1e9])
    run('y=x', 'y-x', view(`follow @${c.toExponential()}`, c, c, 20), true);

  check('a pan smaller than 1e-6 at deep zoom moves the contour', () => {
    vi.stubGlobal('Path2D', undefined);
    const fn = (x: number) => x - 0.25; // vertical line x = 0.25
    const v = view('', 0.25, 0, 1e-6);
    const a = record();
    drawImplicitCurve(a.ctx, vpOf(v), fn, '#fff', v.W, v.H);
    const b = record();
    drawImplicitCurve(b.ctx, vpOf({ ...v, cx: 0.25 + 2e-7 }), fn, '#fff', v.W, v.H);
    const meanX = (r: Recording) =>
      r.paths.flat().reduce((s, [x]) => s + x, 0) / r.paths.flat().length;
    const moved = meanX(a) - meanX(b); // expected 0.2 * W = 240 px
    return Math.abs(moved - 0.2 * v.W) < 5
      ? []
      : [`contour moved ${moved.toFixed(1)}px, expected 240`];
  });
});

// ---------------------------------------------------------------- grid and asymptote overlays

describe('viewport stress: grid', () => {
  for (const v of MATRIX) {
    const rec = record();
    const t0 = performance.now();
    drawGrid(rec.ctx, vpOf(v), v.W, v.H);
    const ms = performance.now() - t0;
    const key = `grid@${v.name}`;
    check(`${key} finite`, () => finiteCoords(rec));
    check(`${key} bounded`, () => boundedCoords(rec, v.W, v.H));
    check(`${key} budget`, () =>
      rec.ops > 2000 || ms > 100 ? [`${rec.ops} ops, ${ms.toFixed(0)} ms`] : [],
    );
    check(`${key} labels distinct and few`, () => {
      const out: string[] = [];
      // x labels are centred, y labels use left/right alignment: count duplicates per axis.
      for (const axis of ['x', 'y']) {
        const labels = rec.texts
          .filter((t) => (t.align === 'center') === (axis === 'x'))
          .map((t) => t.text);
        const dups = labels.length - new Set(labels).size;
        if (labels.length > 40) out.push(`${labels.length} ${axis} labels`);
        if (dups) out.push(`${dups} repeated ${axis} labels (${labels.slice(0, 3).join(', ')})`);
      }
      return out;
    });
  }
});

describe('viewport stress: grid label spacing', () => {
  for (const v of [view('tall x1e12', 1e12, 0, 20, TALL), view('tall out1e12', 0, 0, 1e12, TALL)])
    check(`grid@${v.name} x labels do not overlap`, () => {
      const rec = record();
      drawGrid(rec.ctx, vpOf(v), v.W, v.H);
      // Same width model as the recording ctx: 7 px per character, centred on x.
      const boxes = rec.texts
        .filter((t) => t.align === 'center')
        .map((t) => [t.x - (t.text.length * 7) / 2, t.x + (t.text.length * 7) / 2] as const);
      const out: string[] = [];
      if (boxes.length < 2) out.push(`only ${boxes.length} x labels`);
      for (let i = 1; i < boxes.length; i++)
        if (boxes[i][0] < boxes[i - 1][1]) out.push(`labels ${i - 1} and ${i} overlap`);
      return out;
    });
});

describe('viewport stress: asymptote overlays', () => {
  const overlay = (src: string, v: View) => {
    const vp = vpOf(v);
    const { ast, fx } = compile(src);
    const asy = detectAsymptotes(fx, vp.xMin, vp.xMax, ast);
    const rec = record();
    for (const a of asy) drawAsymptote(rec.ctx, vp, a, v.W, v.H);
    return { vp, asy, rec };
  };
  for (const v of pick(
    'default',
    'out1e3',
    'x+1e6',
    'x-1e6',
    'x1e9',
    'x1e12',
    'x1e9 out1e3',
    'x1e6 in1e-6',
    'in1e-6',
  ))
    check(`1/(x-c)@${v.name} exactly one vertical asymptote at c`, () => {
      const c = poleOfShift(v);
      const { vp, asy } = overlay(`1/(x-${lit(c)})`, v);
      const px = (x: number) => vp.worldToScreen(x, 0, v.W, v.H)[0];
      const vert = asy.filter((a) => a.type === 'vertical').map((a) => px(a.value));
      const ok = vert.length === 1 && Math.abs(vert[0] - px(c)) < 1;
      return ok
        ? []
        : [
            `vertical asymptotes at px ${vert.map((x) => x.toFixed(1)).join(', ')}; pole at ${px(c).toFixed(1)}`,
          ];
    });
  for (const v of pick('default', 'x+1e6', 'x1e9', 'phone default'))
    check(`tan(x)@${v.name} one vertical asymptote per pole`, () => {
      const { vp, asy } = overlay('tan(x)', v);
      const want = tanPoles(vp, v.W).length;
      const got = asy.filter((a) => a.type === 'vertical').length;
      return got === want ? [] : [`${got} vertical asymptotes for ${want} poles`];
    });
  for (const v of pick('default', 'out1e3', 'out1e15'))
    check(`1/x@${v.name} asymptote labels`, () => {
      const { rec } = overlay('1/x', v);
      const labels = rec.texts.map((t) => t.text);
      const ok = labels.length === 2 && labels.includes('x = 0') && labels.includes('y = 0');
      return ok ? [] : [`labels: ${labels.join(' | ')}`];
    });
});

// ---------------------------------------------------------------- viewport model

describe('viewport stress: zoom limits', () => {
  check('zoom-in at x = 1e9 stops while ~1000 doubles still span the width', () => {
    const vp = new Viewport(1e9 - 10, 1e9 + 10, -7, 7);
    for (let i = 0; i < 40; i++) vp.zoom(2, 600, 400, 1200, 800);
    const ulp = 2 ** (Math.floor(Math.log2(1e9)) - 52);
    const n = (vp.xMax - vp.xMin) / ulp;
    return n >= 1000
      ? []
      : [`width ${(vp.xMax - vp.xMin).toExponential(2)} spans only ${n.toFixed(0)} doubles`];
  });
});

describe('viewport stress: KNOWN table', () => {
  it('has no stale entries', () => {
    expect(Object.keys(KNOWN).filter((k) => !registered.has(k))).toEqual([]);
  });
});
