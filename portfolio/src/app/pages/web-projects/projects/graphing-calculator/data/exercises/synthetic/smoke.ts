import type { Exercise } from '../exercise.types';

/** Hand-written smoke set so the dataset harness always has data. */
export default [
  {
    id: 'synthetic-smoke-1',
    source: 'synthetic',
    section: 'smoke',
    number: '1',
    curves: ['y = x^2'],
    op: { kind: 'integral', a: '0', b: '1' },
    expected: { values: ['1/3'], from: 'derived' },
  },
  {
    id: 'synthetic-smoke-2',
    source: 'synthetic',
    section: 'smoke',
    number: '2',
    curves: ['y = x^2', 'y = x'],
    op: { kind: 'area', wrt: 'x' },
    expected: { values: ['1/6'], from: 'derived' },
  },
  {
    id: 'synthetic-smoke-3',
    source: 'synthetic',
    section: 'smoke',
    number: '3',
    curves: ['y = sqrt(x)'],
    op: {
      kind: 'volume',
      method: 'disk-washer',
      variable: 'x',
      a: '0',
      b: '4',
      axis: { orientation: 'horizontal', value: '0' },
    },
    expected: { values: ['8*pi'], from: 'derived' },
  },
  {
    id: 'synthetic-smoke-4',
    source: 'synthetic',
    section: 'smoke',
    number: '4',
    curves: ['y = x^2 - 1'],
    op: { kind: 'roots', a: '-2', b: '2' },
    expected: { values: ['-1', '1'], from: 'derived' },
  },
  {
    id: 'synthetic-smoke-5',
    source: 'synthetic',
    section: 'smoke',
    number: '5',
    curves: ['y = sin(x)'],
    op: { kind: 'derivative', x0: '0' },
    expected: { values: ['1'], from: 'derived' },
  },
] satisfies Exercise[];
