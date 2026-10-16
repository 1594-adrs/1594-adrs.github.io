import type { Exercise, ExerciseOp } from './exercise.types';
import { runExercise, type ExerciseRunStatus } from './run-exercise';

let seq = 0;
function ex(curves: string[], op: ExerciseOp, values?: string[], extra: Partial<Exercise> = {}) {
  seq++;
  const exercise: Exercise = {
    id: `synthetic-spec-${seq}`,
    source: 'synthetic',
    section: 'spec',
    number: String(seq),
    curves,
    op,
    ...(values ? { expected: { values, from: 'derived' } } : {}),
    ...extra,
  };
  return exercise;
}

const I = (a: string, b: string): ExerciseOp => ({ kind: 'integral', a, b });

interface Case {
  name: string;
  exercise: Exercise;
  status: ExerciseRunStatus;
  feature?: string;
}

const cases: Case[] = [
  // integral
  { name: '∫_0^1 x^2 = 1/3', exercise: ex(['y = x^2'], I('0', '1'), ['1/3']), status: 'ok' },
  { name: '∫_0^1 1/x → inf', exercise: ex(['y = 1/x'], I('0', '1'), ['inf']), status: 'ok' },
  { name: '∫_0^1 -1/x → -inf', exercise: ex(['y = -1/x'], I('0', '1'), ['-inf']), status: 'ok' },
  {
    name: '∫_0^1 -1/x is not +inf',
    exercise: ex(['y = -1/x'], I('0', '1'), ['inf']),
    status: 'mismatch',
  },
  {
    name: 'dne accepts a divergent answer',
    exercise: ex(['y = 1/x'], I('-1', '1'), ['dne']),
    status: 'ok',
  },
  {
    name: 'inf rejects an undefined answer',
    exercise: ex(['y = sqrt(x)'], I('-2', '-1'), ['inf']),
    status: 'mismatch',
  },
  {
    name: '∫_1^inf 1/x',
    exercise: ex(['y = 1/x'], I('1', 'inf'), ['inf']),
    status: 'unsupported',
    feature: 'integral:infinite-bounds',
  },
  {
    name: '∫_-inf^0 e^x',
    exercise: ex(['y = e^x'], I('-inf', '0'), ['1']),
    status: 'unsupported',
    feature: 'integral:infinite-bounds',
  },
  {
    name: 'antiderivative with an infinite bound',
    exercise: ex(['y = 1/(1+x^2)'], { kind: 'antiderivative', a: '0', b: 'inf' }, undefined, {
      expected: { fn: 'atan(x)', from: 'book' },
    }),
    status: 'unsupported',
    feature: 'antiderivative:infinite-bounds',
  },
  {
    name: 'roots with an infinite bound',
    exercise: ex(['y = x'], { kind: 'roots', a: '-inf', b: '1' }, ['0']),
    status: 'unsupported',
    feature: 'roots:infinite-bounds',
  },
  {
    name: '∫ sqrt(x) on [-2,-1] → dne',
    exercise: ex(['y = sqrt(x)'], I('-2', '-1'), ['dne']),
    status: 'ok',
  },
  {
    name: 'rounded answer within tol',
    exercise: ex(['x^2'], I('0', '1'), undefined, {
      expected: { values: ['0.3333'], tol: 1e-3, from: 'book' },
    }),
    status: 'ok',
  },
  {
    name: 'rounded answer outside default tol',
    exercise: ex(['x^2'], I('0', '1'), ['0.3333']),
    status: 'mismatch',
  },
  { name: 'no expected → ran', exercise: ex(['y = x'], I('0', '2')), status: 'ran' },
  {
    name: 'integral of a polar curve',
    exercise: ex(['r = 1'], I('0', '1'), ['1']),
    status: 'unsupported',
    feature: 'integral:polar',
  },
  // antiderivative
  {
    name: 'antiderivative cos(x), F = sin(x)',
    exercise: ex(['y = cos(x)'], { kind: 'antiderivative', a: '0', b: '1' }, undefined, {
      expected: { fn: 'sin(x)', from: 'book' },
    }),
    status: 'ok',
  },
  {
    name: 'antiderivative with a wrong F',
    exercise: ex(['y = cos(x)'], { kind: 'antiderivative', a: '0', b: '1' }, undefined, {
      expected: { fn: 'cos(x)', from: 'book' },
    }),
    status: 'mismatch',
  },
  // area
  {
    name: 'area between x^2 and x = 1/6',
    exercise: ex(['y = x^2', 'y = x'], { kind: 'area', wrt: 'x' }, ['1/6']),
    status: 'ok',
  },
  {
    name: 'area between x^2 and x on [0,2] = 1',
    exercise: ex(['y = x^2', 'y = x'], { kind: 'area', wrt: 'x', a: '0', b: '2' }, ['1']),
    status: 'ok',
  },
  {
    name: 'area under 1 - x^2 = 4/3',
    exercise: ex(['y = 1 - x^2'], { kind: 'area', wrt: 'x' }, ['4/3']),
    status: 'ok',
  },
  {
    name: 'area w.r.t. y',
    exercise: ex(['x = y^2', 'x = 1'], { kind: 'area', wrt: 'y' }, ['4/3']),
    status: 'unsupported',
    feature: 'area:wrt-y',
  },
  {
    name: 'area with an infinite bound',
    exercise: ex(['y = 1/x^2'], { kind: 'area', wrt: 'x', a: '1', b: 'inf' }, ['1']),
    status: 'unsupported',
    feature: 'area:infinite-bounds',
  },
  // volume / surface
  {
    name: 'disk y = sqrt(x) on [0,4] about the x-axis = 8pi',
    exercise: ex(
      ['y = sqrt(x)'],
      {
        kind: 'volume',
        method: 'disk-washer',
        variable: 'x',
        a: '0',
        b: '4',
        axis: { orientation: 'horizontal', value: '0' },
      },
      ['8*pi'],
    ),
    status: 'ok',
  },
  {
    name: 'disk with axis omitted = x-axis',
    exercise: ex(
      ['y = sqrt(x)'],
      { kind: 'volume', method: 'disk-washer', variable: 'x', a: '0', b: '4' },
      ['8*pi'],
    ),
    status: 'ok',
  },
  {
    name: 'shells between x^2 and 2 - x on [0,1] about the y-axis = 5pi/6',
    exercise: ex(
      ['y = x^2', 'y = 2 - x'],
      {
        kind: 'volume',
        method: 'shell',
        variable: 'x',
        a: '0',
        b: '1',
        axis: { orientation: 'vertical', value: '0' },
      },
      ['5*pi/6'],
    ),
    status: 'ok',
  },
  {
    name: 'disk in y: x = sqrt(y) on [0,4] about the y-axis = 8pi',
    exercise: ex(
      ['x = sqrt(y)'],
      { kind: 'volume', method: 'disk-washer', variable: 'y', a: '0', b: '4' },
      ['8*pi'],
    ),
    status: 'ok',
  },
  {
    name: 'square cross-sections on 1 - x^2 = 16/15',
    exercise: ex(
      ['y = 1 - x^2'],
      { kind: 'volume', method: 'cross-section', variable: 'x', a: '-1', b: '1', shape: 'square' },
      ['16/15'],
    ),
    status: 'ok',
  },
  {
    name: 'sphere surface = 4pi',
    exercise: ex(
      ['y = sqrt(1 - x^2)'],
      { kind: 'surface', method: 'disk-washer', variable: 'x', a: '-1', b: '1' },
      undefined,
      {
        expected: { values: ['4*pi'], tol: 1e-3, from: 'derived' },
      },
    ),
    status: 'ok',
  },
  {
    name: 'surface of a cross-section solid',
    exercise: ex(
      ['y = x'],
      { kind: 'surface', method: 'cross-section', variable: 'x', a: '0', b: '1', shape: 'square' },
      ['1'],
    ),
    status: 'unsupported',
    feature: 'surface:cross-section',
  },
  {
    name: 'volume with an x = g(y) curve in variable x',
    exercise: ex(
      ['x = y^2'],
      { kind: 'volume', method: 'disk-washer', variable: 'x', a: '0', b: '1' },
      ['1'],
    ),
    status: 'unsupported',
    feature: 'volume:explicit-y',
  },
  {
    name: 'shell with the wrong axis orientation fails',
    exercise: ex(
      ['y = x'],
      {
        kind: 'volume',
        method: 'shell',
        variable: 'x',
        a: '0',
        b: '1',
        axis: { orientation: 'horizontal', value: '0' },
      },
      ['1'],
    ),
    status: 'mismatch',
  },
  // roots / extrema / intersections
  {
    name: 'roots of x^2 - 1',
    exercise: ex(['y = x^2 - 1'], { kind: 'roots', a: '-2', b: '2' }, ['1', '-1']),
    status: 'ok',
  },
  {
    name: 'roots: wrong count',
    exercise: ex(['y = x^2 - 1'], { kind: 'roots', a: '-2', b: '2' }, ['1']),
    status: 'mismatch',
  },
  {
    name: 'roots: values [] = none in [a, b]',
    exercise: ex(['y = x^2 + 1'], { kind: 'roots', a: '-2', b: '2' }, []),
    status: 'ok',
  },
  {
    name: 'washer with an explicit y = 0 curve = 8pi',
    exercise: ex(
      ['y = sqrt(x)', 'y = 0'],
      { kind: 'volume', method: 'disk-washer', variable: 'x', a: '0', b: '4' },
      ['8*pi'],
    ),
    status: 'ok',
  },
  {
    name: 'cone surface is total (lateral pi*sqrt(2) + base cap pi)',
    exercise: ex(
      ['y = x'],
      { kind: 'surface', method: 'disk-washer', variable: 'x', a: '0', b: '1' },
      ['pi*sqrt(2) + pi'],
    ),
    status: 'ok',
  },
  {
    name: 'ode with no curves',
    exercise: ex([], { kind: 'ode', f: 'x + y', x0: '0', y0: '1', xEnd: '1' }, ['1']),
    status: 'unsupported',
    feature: 'ode',
  },
  {
    name: 'series of a bare expression in n',
    exercise: ex(['1/n^2'], { kind: 'series', nStart: 1 }, ['pi^2/6']),
    status: 'unsupported',
    feature: 'series',
  },
  {
    name: 'extrema of x^3 - 3x',
    exercise: ex(['y = x^3 - 3x'], { kind: 'extrema', a: '-2', b: '2' }, ['-1', '1']),
    status: 'ok',
  },
  {
    name: 'intersections of x^2 and x',
    exercise: ex(['y = x^2', 'y = x'], { kind: 'intersections', a: '-1', b: '2' }, ['0', '1']),
    status: 'ok',
  },
  // graph
  {
    name: 'graph of every curve form',
    exercise: ex(
      ['y = x^2', 'x^2 + y^2 = 1', 'r = 1 + cos(t)', 'cos(t), sin(t)', 'x = y^2', 'y > x'],
      { kind: 'graph' },
    ),
    status: 'ok',
  },
  {
    name: 'graph that is never finite',
    exercise: ex(['y = sqrt(-1 - x^2)'], { kind: 'graph' }),
    status: 'mismatch',
  },
  // parse errors
  {
    name: 'unbalanced parenthesis',
    exercise: ex(['y = (x'], I('0', '1'), ['1']),
    status: 'parse-error',
  },
  {
    name: 'y on the right of y = f(x)',
    exercise: ex(['y = x*y'], I('0', '1'), ['1']),
    status: 'parse-error',
  },
  {
    name: 'unreadable answer',
    exercise: ex(['y = x'], I('0', '1'), ['1/']),
    status: 'parse-error',
  },
  { name: 'integral without curves', exercise: ex([], I('0', '1'), ['1']), status: 'parse-error' },
];

const unsupportedOps: ExerciseOp[] = [
  { kind: 'arc-length', a: '0', b: '1' },
  { kind: 'polar-area', a: '0', b: '1' },
  { kind: 'centroid', a: '0', b: '1' },
  { kind: 'derivative', x0: '1' },
  { kind: 'tangent', x0: '1' },
  { kind: 'limit', x0: '0' },
  { kind: 'newton', x0: '1' },
  { kind: 'riemann', rule: 'left', n: 4, a: '0', b: '1' },
  { kind: 'taylor', center: '0', order: 3 },
  { kind: 'ode', f: 'x + y', x0: '0', y0: '1' },
  { kind: 'sequence' },
  { kind: 'series' },
];
for (const op of unsupportedOps) {
  cases.push({
    name: `op ${op.kind}`,
    exercise: ex(['y = x'], op, ['1']),
    status: 'unsupported',
    feature: op.kind,
  });
}

const plannedSyntax: Array<[string, string]> = [
  ['y = if(x < 0, -x, x)', 'syntax:if'],
  ['y = asinh(x)', 'syntax:asinh'],
  ['y = acosh(x)', 'syntax:acosh'],
  ['y = atanh(x)', 'syntax:atanh'],
  ['y = cbrt(x)', 'syntax:cbrt'],
  ['y = 1/n', 'syntax:n'],
  ['y = a*x^2', 'syntax:a'],
  ['y = sin(k*x)', 'syntax:k'],
  ['(cos(t), sin(t))', 'syntax:parametric-parens'],
];
for (const [curve, feature] of plannedSyntax) {
  cases.push({
    name: `syntax ${curve}`,
    exercise: ex([curve], I('0', '1'), ['1']),
    status: 'unsupported',
    feature,
  });
}

describe('runExercise', () => {
  it.each(cases)('$name → $status', ({ exercise, status, feature }) => {
    const run = runExercise(exercise);
    expect(run.status, JSON.stringify(run)).toBe(status);
    if (feature) expect(run.feature).toBe(feature);
  });

  it('reports got and expected numbers', () => {
    const run = runExercise(ex(['y = x^2'], I('0', '1'), ['1/3']));
    expect(run.got?.[0]).toBeCloseTo(1 / 3, 10);
    expect(run.expected).toEqual([1 / 3]);
    expect(runExercise(ex(['y = 1/x'], I('0', '1'), ['inf'])).got).toEqual([Infinity]);
    expect(runExercise(ex(['y = sqrt(x)'], I('-2', '-1'))).got).toEqual([NaN]);
  });

  it('never throws on malformed input', () => {
    const bad = { ...ex(['y = x'], I('0', '1')), op: { kind: 'nope' } } as unknown as Exercise;
    expect(runExercise(bad).status).toBe('unsupported');
    const noBounds = {
      ...ex(['y = x'], I('0', '1')),
      op: { kind: 'integral' },
    } as unknown as Exercise;
    expect(() => runExercise(noBounds)).not.toThrow();
  });
});
