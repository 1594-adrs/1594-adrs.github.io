export interface KeyDef {
  label: string;
  insert?: string;
  action?: 'backspace' | 'left' | 'right' | 'clear';
  width?: number;
  category: 'function' | 'operator' | 'constant' | 'special';
  preview?: string;
}

export interface KeyboardTab {
  name: string;
  icon: string;
  rows: KeyDef[][];
}

export const KEYBOARD_TABS: KeyboardTab[] = [
  {
    name: 'Numbers',
    icon: '#',
    rows: [
      [
        { label: '7', insert: '7', category: 'operator' },
        { label: '8', insert: '8', category: 'operator' },
        { label: '9', insert: '9', category: 'operator' },
        { label: '÷', insert: '/', category: 'operator' },
      ],
      [
        { label: '4', insert: '4', category: 'operator' },
        { label: '5', insert: '5', category: 'operator' },
        { label: '6', insert: '6', category: 'operator' },
        { label: '×', insert: '*', category: 'operator' },
      ],
      [
        { label: '1', insert: '1', category: 'operator' },
        { label: '2', insert: '2', category: 'operator' },
        { label: '3', insert: '3', category: 'operator' },
        { label: '−', insert: '-', category: 'operator' },
      ],
      [
        { label: '0', insert: '0', category: 'operator' },
        { label: '.', insert: '.', category: 'operator' },
        { label: 'π', insert: 'pi', category: 'constant' },
        { label: '+', insert: '+', category: 'operator' },
      ],
      [
        { label: '(', insert: '(', category: 'operator' },
        { label: ')', insert: ')', category: 'operator' },
        { label: '^', insert: '^', category: 'operator', preview: 'x²' },
        { label: 'e', insert: 'e', category: 'constant' },
      ],
    ],
  },
  {
    name: 'Trig',
    icon: '∠',
    rows: [
      [
        { label: 'sin', insert: 'sin(', category: 'function' },
        { label: 'cos', insert: 'cos(', category: 'function' },
        { label: 'tan', insert: 'tan(', category: 'function' },
      ],
      [
        { label: 'sin⁻¹', insert: 'asin(', category: 'function' },
        { label: 'cos⁻¹', insert: 'acos(', category: 'function' },
        { label: 'tan⁻¹', insert: 'atan(', category: 'function' },
      ],
      [
        { label: 'sec', insert: 'sec(', category: 'function' },
        { label: 'csc', insert: 'csc(', category: 'function' },
        { label: 'cot', insert: 'cot(', category: 'function' },
      ],
      [
        { label: 'sinh', insert: 'sinh(', category: 'function' },
        { label: 'cosh', insert: 'cosh(', category: 'function' },
        { label: 'tanh', insert: 'tanh(', category: 'function' },
      ],
    ],
  },
  {
    name: 'Functions',
    icon: 'ƒ',
    rows: [
      [
        { label: '√', insert: 'sqrt(', category: 'function', preview: '√x' },
        { label: 'x²', insert: '^2', category: 'operator', preview: 'x²' },
        { label: 'xⁿ', insert: '^(', category: 'operator' },
        { label: '|x|', insert: 'abs(', category: 'function' },
      ],
      [
        { label: 'ln', insert: 'ln(', category: 'function' },
        { label: 'log', insert: 'log(', category: 'function' },
        { label: 'exp', insert: 'exp(', category: 'function' },
        { label: 'mod', insert: 'mod(', category: 'function' },
      ],
      [
        { label: 'n!', insert: 'factorial(', category: 'function' },
        { label: '√ⁿ', insert: 'root(', category: 'function' },
        { label: 'log_b', insert: 'logb(', category: 'function' },
        { label: 'sign', insert: 'sign(', category: 'function' },
      ],
      [
        { label: 'floor', insert: 'floor(', category: 'function' },
        { label: 'ceil', insert: 'ceil(', category: 'function' },
        { label: 'nPr', insert: 'npr(', category: 'function' },
        { label: 'nCr', insert: 'ncr(', category: 'function' },
      ],
    ],
  },
  {
    name: 'Symbols',
    icon: 'Σ',
    rows: [
      [
        { label: 'θ', insert: 'theta', category: 'constant' },
        { label: 'α', insert: 'alpha', category: 'constant' },
        { label: 'β', insert: 'beta', category: 'constant' },
        { label: 'γ', insert: 'gamma', category: 'constant' },
      ],
      [
        { label: '<', insert: '<', category: 'operator' },
        { label: '>', insert: '>', category: 'operator' },
        { label: '≤', insert: '<=', category: 'operator' },
        { label: '≥', insert: '>=', category: 'operator' },
      ],
      [
        { label: '=', insert: '=', category: 'operator' },
        { label: '≠', insert: '!=', category: 'operator' },
        { label: ',', insert: ',', category: 'operator' },
        { label: 'π', insert: 'pi', category: 'constant' },
      ],
    ],
  },
  {
    name: 'Calculus',
    icon: '∫',
    rows: [
      [
        { label: 'dx', insert: 'x', category: 'operator' },
        { label: 'dt', insert: 't', category: 'operator' },
        { label: 'dy', insert: 'y', category: 'operator' },
        { label: '=', insert: '=', category: 'operator' },
      ],
      [
        { label: '+', insert: '+', category: 'operator' },
        { label: '−', insert: '-', category: 'operator' },
        { label: '×', insert: '*', category: 'operator' },
        { label: '÷', insert: '/', category: 'operator' },
      ],
      [
        { label: '(', insert: '(', category: 'operator' },
        { label: ')', insert: ')', category: 'operator' },
        { label: '^', insert: '^', category: 'operator' },
        { label: ',', insert: ',', category: 'operator' },
      ],
      [
        { label: '←', action: 'left', category: 'special' },
        { label: '→', action: 'right', category: 'special' },
        { label: '⌫', action: 'backspace', category: 'special' },
        { label: 'CLR', action: 'clear', category: 'special' },
      ],
    ],
  },
];

export const KEYBOARD_ROWS = KEYBOARD_TABS[0].rows;
