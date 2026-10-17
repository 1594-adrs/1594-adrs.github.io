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
    name: 'rounded answer outside its printed digits',
    exercise: ex(['x^2'], I('0', '1'), ['0.3330']),
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
    name: 'ode y′ = x + y, y(0) = 1 at x = 1 (y = 2eˣ − x − 1)',
    exercise: ex([], { kind: 'ode', f: 'x + y', x0: '0', y0: '1', xEnd: '1' }, ['2*e - 2']),
    status: 'ok',
  },
  {
    name: 'ode solution compared as a function',
    exercise: ex([], { kind: 'ode', f: 'x + y', x0: '0', y0: '1' }, undefined, {
      expected: { fn: '2*e^x - x - 1', from: 'derived' },
    }),
    status: 'ok',
  },
  {
    name: 'euler y′ = y, h = 0.5 from y(0) = 1 to x = 1 (1.5²)',
    exercise: ex(
      [],
      { kind: 'ode', f: 'y', x0: '0', y0: '1', xEnd: '1', method: 'euler', h: '0.5' },
      ['2.25'],
    ),
    status: 'ok',
  },
  {
    name: 'series of a bare expression in n',
    exercise: ex(['1/n^2'], { kind: 'series', nStart: 1 }, ['pi^2/6']),
    status: 'ok',
  },
  {
    name: 'partial sum S_4 of n^2',
    exercise: ex(['n^2'], { kind: 'series', nStart: 1, nMax: 4 }, ['30']),
    status: 'ok',
  },
  {
    name: 'power series in x compared as a function',
    exercise: ex(['x^n'], { kind: 'series', nStart: 0 }, undefined, {
      expected: { fn: '1/(1 - x)', from: 'derived' },
    }),
    status: 'ok',
  },
  {
    name: 'fibonacci terms from a second-order recurrence',
    exercise: ex(
      ['a(1) = 1', 'a(2) = 1', 'a(n+2) = a(n+1) + a(n)'],
      { kind: 'sequence', nStart: 1, nMax: 6 },
      ['1', '1', '2', '3', '5', '8'],
    ),
    status: 'ok',
  },
  {
    name: 'sequence limit (1 + 1/n)^n',
    exercise: ex(['(1 + 1/n)^n'], { kind: 'sequence', nStart: 1 }, ['e']),
    status: 'ok',
  },
  {
    name: 'recurrence with a(n) on the left is malformed',
    exercise: ex(['a(1) = 1', 'a(n) = a(n) + 1'], { kind: 'sequence' }, ['1']),
    status: 'parse-error',
  },
  {
    name: 'taylor of sin at 0, order 3',
    exercise: ex(['y = sin(x)'], { kind: 'taylor', center: '0', order: 3 }, undefined, {
      expected: { fn: 'x - x^3/6', from: 'derived' },
    }),
    status: 'ok',
  },
  {
    name: 'ode wrong value is a mismatch',
    exercise: ex([], { kind: 'ode', f: 'x + y', x0: '0', y0: '1', xEnd: '1' }, ['2*e - 1']),
    status: 'mismatch',
  },
  {
    name: 'series wrong sum is a mismatch',
    exercise: ex(['1/n^2'], { kind: 'series', nStart: 1 }, ['pi^2/5']),
    status: 'mismatch',
  },
  {
    name: 'taylor wrong coefficient is a mismatch',
    exercise: ex(['y = sin(x)'], { kind: 'taylor', center: '0', order: 3 }, undefined, {
      expected: { fn: 'x - x^3/5', from: 'derived' },
    }),
    status: 'mismatch',
  },
  {
    name: 'taylor extra high-order term is a mismatch',
    exercise: ex(['y = sin(x)'], { kind: 'taylor', center: '0', order: 3 }, undefined, {
      expected: { fn: 'x - x^3/6 + x^5/120', from: 'derived' },
    }),
    status: 'mismatch',
  },
  {
    name: 'sequence terms in reversed order are a mismatch',
    exercise: ex(
      ['a(1) = 1', 'a(2) = 1', 'a(n+2) = a(n+1) + a(n)'],
      { kind: 'sequence', nStart: 1, nMax: 6 },
      ['8', '5', '3', '2', '1', '1'],
    ),
    status: 'mismatch',
  },
  {
    name: 'fn answer on a sequence is not compared',
    exercise: ex(['1/n'], { kind: 'sequence', nStart: 1 }, undefined, {
      expected: { fn: '1/n', from: 'derived' },
    }),
    status: 'unsupported',
    feature: 'sequence:fn-answer',
  },
  {
    name: 'more seeds than the recurrence order is malformed',
    exercise: ex(['a(1) = 1', 'a(2) = 1', 'a(n+1) = a(n)'], { kind: 'sequence' }, ['1']),
    status: 'parse-error',
  },
  {
    name: 'series with a narrow interval of convergence (ln 3, ln 5)',
    exercise: ex(['(e^x - 4)^n'], { kind: 'series', nStart: 0 }, undefined, {
      expected: { fn: '1/(5 - e^x)', from: 'derived' },
    }),
    status: 'ok',
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
    name: 'y on the right of y = f(x) is an implicit-curve gap',
    exercise: ex(['y = x*y'], I('0', '1'), ['1']),
    status: 'unsupported',
    feature: 'syntax:y-equals-implicit',
  },
  {
    name: 'unreadable answer',
    exercise: ex(['y = x'], I('0', '1'), ['1/']),
    status: 'parse-error',
  },
  { name: 'integral without curves', exercise: ex([], I('0', '1'), ['1']), status: 'parse-error' },
];

// Extended integration (F7): one ok and one mismatch per op, plus the honest gaps.
const lateral = {
  kind: 'surface',
  method: 'disk-washer',
  variable: 'x',
  axis: { orientation: 'horizontal', value: '0' },
  lateral: true,
} as const;
cases.push(
  {
    name: 'arc length of y = x on [0, 1] = sqrt(2)',
    exercise: ex(['y = x'], { kind: 'arc-length', a: '0', b: '1' }, ['sqrt(2)']),
    status: 'ok',
  },
  {
    name: 'arc length of y = x is not 1',
    exercise: ex(['y = x'], { kind: 'arc-length', a: '0', b: '1' }, ['1']),
    status: 'mismatch',
  },
  {
    name: 'arc length of a polar cardioid = 8',
    exercise: ex(['r = 1 + cos(t)'], { kind: 'arc-length', a: '0', b: '2*pi' }, ['8']),
    status: 'ok',
  },
  {
    name: 'arc length of a function with no symbolic derivative is a gap',
    exercise: ex(['y = gamma(x)'], { kind: 'arc-length', a: '1', b: '2' }, ['1']),
    status: 'unsupported',
    feature: 'arc-length:derivative',
  },
  {
    name: 'riemann left sum of x on [0, 1], n = 4 = 3/8',
    exercise: ex(['y = x'], { kind: 'riemann', rule: 'left', n: 4, a: '0', b: '1' }, ['3/8']),
    status: 'ok',
  },
  {
    name: 'riemann right sum is not the left sum',
    exercise: ex(['y = x'], { kind: 'riemann', rule: 'right', n: 4, a: '0', b: '1' }, ['3/8']),
    status: 'mismatch',
  },
  {
    name: 'simpson with an odd n is malformed',
    exercise: ex(['y = x'], { kind: 'riemann', rule: 'simpson', n: 3, a: '0', b: '1' }, ['1']),
    status: 'parse-error',
  },
  {
    name: 'centroid of the triangle under y = x on [0, 1]',
    exercise: ex(['y = x', 'y = 0'], { kind: 'centroid', a: '0', b: '1' }, ['2/3', '1/3']),
    status: 'ok',
  },
  {
    name: 'centroid coordinates are an ordered pair (swapped is wrong)',
    exercise: ex(['y = x', 'y = 0'], { kind: 'centroid', a: '0', b: '1' }, ['1/3', '2/3']),
    status: 'mismatch',
  },
  {
    name: 'centroid in y between x = y and x = y^2',
    exercise: ex(['x = y', 'x = y^2'], { kind: 'centroid', a: '0', b: '1' }, ['2/5', '1/2']),
    status: 'ok',
  },
  {
    name: 'centroid with only x̄ printed compares x̄',
    exercise: ex(['y = x'], { kind: 'centroid', a: '0', b: '1' }, ['2/3']),
    status: 'ok',
  },
  {
    name: 'polar area of r = 2 over [0, 2pi] = 4pi',
    exercise: ex(['r = 2'], { kind: 'polar-area', a: '0', b: '2*pi' }, ['4*pi']),
    status: 'ok',
  },
  {
    name: 'polar area between r = 2 and r = 1 is not 4pi',
    exercise: ex(['r = 2', 'r = 1'], { kind: 'polar-area', a: '0', b: '2*pi' }, ['4*pi']),
    status: 'mismatch',
  },
  {
    name: 'polar area of a non-polar row',
    exercise: ex(['y = x'], { kind: 'polar-area', a: '0', b: '1' }, ['1']),
    status: 'unsupported',
    feature: 'polar-area:explicit',
  },
  {
    name: 'polar area with an inner loop and another curve is a gap',
    exercise: ex(['r = 1 + 2*sin(t)', 'r = 4'], { kind: 'polar-area', a: '0', b: '2*pi' }, ['1']),
    status: 'unsupported',
    feature: 'polar-area:not-star-shaped',
  },
  {
    name: 'lateral surface of y = x about the x-axis = pi*sqrt(2) (no cap)',
    exercise: ex(['y = x'], { ...lateral, a: '0', b: '1' }, ['pi*sqrt(2)']),
    status: 'ok',
  },
  {
    name: 'lateral surface does not add the cap',
    exercise: ex(['y = x'], { ...lateral, a: '0', b: '1' }, ['pi*sqrt(2) + pi']),
    status: 'mismatch',
  },
  {
    name: 'lateral surface of a parametric circle (sphere 4pi)',
    exercise: ex(['cos(t), sin(t)'], { ...lateral, a: '0', b: 'pi' }, ['4*pi']),
    status: 'ok',
  },
  {
    name: 'area w.r.t. y between x = y^2 and x = 1 = 4/3',
    exercise: ex(['x = y^2', 'x = 1'], { kind: 'area', wrt: 'y' }, ['4/3']),
    status: 'ok',
  },
  {
    name: 'area w.r.t. y is not the area w.r.t. x',
    exercise: ex(['x = y^2', 'x = 1'], { kind: 'area', wrt: 'y' }, ['2/3']),
    status: 'mismatch',
  },
  {
    name: 'area w.r.t. y of a two-branch conic is a gap',
    exercise: ex(['x = 2', 'y^2 = 1 + x^2'], { kind: 'area', wrt: 'y' }, ['1']),
    status: 'unsupported',
    feature: 'area:implicit',
  },
);

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
  ['y = int(sqrt(t), t, 0, x)', 'syntax:int'],
];

// differential ops and limits
const fnAnswer = (fn: string) => ({ expected: { fn, from: 'derived' as const } });
cases.push(
  {
    name: "f'(-8) of root(3, x) = 1/12",
    exercise: ex(['y = root(3, x)'], { kind: 'derivative', x0: '-8' }, ['1/12']),
    status: 'ok',
  },
  {
    name: "f' of |x|/x at 0 does not exist",
    exercise: ex(['y = abs(x)/x'], { kind: 'derivative', x0: '0' }, ['dne']),
    status: 'ok',
  },
  {
    name: 'derivative formula compared on samples',
    exercise: ex(['y = x^x'], { kind: 'derivative' }, undefined, fnAnswer('x^x*(ln(x) + 1)')),
    status: 'ok',
  },
  {
    name: 'a wrong derivative formula is a mismatch',
    exercise: ex(['y = x^x'], { kind: 'derivative' }, undefined, fnAnswer('x^x*ln(x)')),
    status: 'mismatch',
  },
  {
    name: 'implicit tangent line at (3, -4)',
    exercise: ex(
      ['x^2 + y^2 = 25'],
      { kind: 'tangent', x0: '3', y0: '-4' },
      undefined,
      fnAnswer('3/4*x - 25/4'),
    ),
    status: 'ok',
  },
  {
    name: 'implicit normal line at (3, -4)',
    exercise: ex(
      ['x^2 + y^2 = 25'],
      { kind: 'tangent', x0: '3', y0: '-4', normal: true },
      undefined,
      fnAnswer('-4/3*x'),
    ),
    status: 'ok',
  },
  {
    name: 'newton x^2 - 2 from 1, 3 steps',
    exercise: ex(['y = x^2 - 2'], { kind: 'newton', x0: '1', steps: 3 }, ['577/408']),
    status: 'ok',
  },
  {
    name: 'one-sided limit of 1/x at 0',
    exercise: ex(['y = 1/x'], { kind: 'limit', x0: '0', side: '-' }, ['-inf']),
    status: 'ok',
  },
  {
    name: 'limit of sin(x)/x at 0',
    exercise: ex(['y = sin(x)/x'], { kind: 'limit', x0: '0' }, ['1']),
    status: 'ok',
  },
);

const disk = { method: 'disk-washer', variable: 'x', a: '0', b: '1' } as const;
cases.push(
  {
    name: 'circular cross-sections are a planned gap',
    exercise: ex(['y = x'], { kind: 'volume', ...disk, method: 'cross-section', shape: 'circle' }),
    status: 'unsupported',
    feature: 'volume:shape-circle',
  },
  {
    name: 'a printed 3-decimal answer is good to ±0.0005',
    exercise: ex(['y = x^2'], I('0', '1'), ['0.333']),
    status: 'ok',
  },
  {
    name: 'a printed decimal does not loosen past its digits',
    exercise: ex(['y = x^2'], I('0', '1'), ['0.334']),
    status: 'mismatch',
  },
  {
    name: 'an extremum at 0 passes with the absolute floor',
    exercise: ex(['y = x^2 - 2*x^3'], { kind: 'extrema', a: '-1', b: '1' }, ['0', '1/3']),
    status: 'ok',
  },
  {
    name: 'extrema exclude f′ = 0 at the interval ends',
    exercise: ex(['y = sin(x)'], { kind: 'extrema', a: '-pi/2', b: '5*pi/6' }, ['pi/2']),
    status: 'ok',
  },
);
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
