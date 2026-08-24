export interface KeyDef {
  label: string;
  insert?: string;
  action?: 'backspace' | 'left' | 'right' | 'clear';
  width?: number;
  category: 'function' | 'operator' | 'constant' | 'special';
}

export const KEYBOARD_ROWS: KeyDef[][] = [
  [
    { label: 'sin', insert: 'sin(', category: 'function' },
    { label: 'cos', insert: 'cos(', category: 'function' },
    { label: 'tan', insert: 'tan(', category: 'function' },
    { label: 'sec', insert: 'sec(', category: 'function' },
    { label: 'csc', insert: 'csc(', category: 'function' },
    { label: 'cot', insert: 'cot(', category: 'function' },
  ],
  [
    { label: 'sin⁻¹', insert: 'asin(', category: 'function' },
    { label: 'cos⁻¹', insert: 'acos(', category: 'function' },
    { label: 'tan⁻¹', insert: 'atan(', category: 'function' },
    { label: 'sinh', insert: 'sinh(', category: 'function' },
    { label: 'cosh', insert: 'cosh(', category: 'function' },
    { label: 'tanh', insert: 'tanh(', category: 'function' },
  ],
  [
    { label: 'ln', insert: 'ln(', category: 'function' },
    { label: 'log', insert: 'log(', category: 'function' },
    { label: '√', insert: 'sqrt(', category: 'function' },
    { label: 'x²', insert: '^2', category: 'operator' },
    { label: 'xⁿ', insert: '^(', category: 'operator' },
    { label: '|x|', insert: 'abs(', category: 'function' },
  ],
  [
    { label: 'π', insert: 'pi', category: 'constant' },
    { label: 'e', insert: 'e', category: 'constant' },
    { label: 'floor', insert: 'floor(', category: 'function' },
    { label: 'ceil', insert: 'ceil(', category: 'function' },
    { label: 'mod', insert: 'mod(', category: 'function' },
    { label: 'sign', insert: 'sign(', category: 'function' },
  ],
  [
    { label: '(', insert: '(', category: 'operator' },
    { label: ')', insert: ')', category: 'operator' },
    { label: '+', insert: '+', category: 'operator' },
    { label: '−', insert: '-', category: 'operator' },
    { label: '×', insert: '*', category: 'operator' },
    { label: '÷', insert: '/', category: 'operator' },
  ],
  [
    { label: '^', insert: '^', category: 'operator' },
    { label: ',', insert: ',', category: 'operator' },
    { label: 'min', insert: 'min(', category: 'function' },
    { label: 'max', insert: 'max(', category: 'function' },
    { label: '←', action: 'left', category: 'special' },
    { label: '→', action: 'right', category: 'special' },
    { label: '⌫', action: 'backspace', category: 'special' },
  ],
];
