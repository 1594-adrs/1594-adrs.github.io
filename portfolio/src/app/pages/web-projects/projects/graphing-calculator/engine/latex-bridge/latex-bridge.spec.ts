import { evaluate } from '../evaluator';
import { parse } from '../parser';
import { latexToRaw, rawToLatex } from './latex-bridge';

// ---------------------------------------------------------------------------
// latexToRaw: table
// ---------------------------------------------------------------------------

type ToRawCase = [latex: string, raw: string, issues?: string[]];

const TO_RAW: ToRawCase[] = [
  // atoms and numbers
  ['', ''],
  ['12.5', '12.5'],
  ['.5+3', '.5+3'],
  ['1{,}5x', '1.5*x'],
  ['x', 'x'],
  ['\\pi', 'pi'],
  ['\\theta', 't'],
  ['\\exponentialE^{x}', 'e^x'],
  ['\\mathrm{e}^{x}', 'e^x'],
  ['e', 'e'],
  // multi-digit exponents (smartSuperscript off) and the continuation after them
  ['x^{10}', 'x^10'],
  ['x^{10}+1', 'x^10+1'],
  // infinity (limit point field)
  ['\\infty', 'inf'],
  ['-\\infty', '-inf'],
  ['∞', 'inf'],
  // function names typed or pasted as plain letters
  ['asin(x)', 'asin(x)'],
  ['abs(x)+1', 'abs(x)+1'],
  ['floor\\left(x\\right)', 'floor(x)'],
  ['min(x,2)', 'min(x,2)'],
  ['mod(x,3)', 'mod(x,3)'],
  ['sin(x)+cos(x)', 'sin(x)+cos(x)'],
  ['xmax(x,1)', 'x*max(x,1)'],
  ['sqrt(x)', 'sqrt(x)'],
  ['xy', 'x*y'],
  ['ex', 'e*x'],
  ['\\operatorname{\\mathrm{abs}}\\left(x\\right)', 'abs(x)'],
  ['\\operatorname{\\mathrm{min}}\\left(x,2\\right)', 'min(x,2)'],
  // implicit multiplication made explicit
  ['2x', '2*x'],
  ['xy', 'x*y'],
  ['2\\pi', '2*pi'],
  ['2\\pi x', '2*pi*x'],
  ['\\pi r', 'pi*r'],
  ['\\left(x+1\\right)\\left(x-1\\right)', '(x+1)*(x-1)'],
  ['x\\left(x+1\\right)', 'x*(x+1)'],
  ['3\\left(x+1\\right)', '3*(x+1)'],
  ['x\\sin x', 'x*sin(x)'],
  ['x\\,y\\ z~w', 'x*y*z*w'],
  ['{}x', 'x'],
  // operators
  ['x+y-z', 'x+y-z'],
  ['a\\cdot b', 'a*b'],
  ['a\\times b', 'a*b'],
  ['a\\div b', 'a/b'],
  ['a/b', 'a/b'],
  ['-x^2', '-x^2'],
  ['a-\\left(-b\\right)', 'a-(-b)'],
  ['2\\cdot-3', '2*(-3)'],
  ['x--y', 'x+y'],
  ['-\\left(a+b\\right)', '-(a+b)'],
  ['\\left(\\left(x\\right)\\right)', '((x))'],
  // fractions, roots, powers
  ['\\frac{a}{b}', '((a)/(b))'],
  ['\\frac{x+1}{2}', '((x+1)/(2))'],
  ['\\frac{1}{\\frac{1}{x}}', '((1)/((1)/(x)))'],
  ['\\frac{1}{2}x', '((1)/(2))*x'],
  ['\\sqrt{x+1}', 'sqrt(x+1)'],
  ['\\sqrt[3]{x}', 'root(3,x)'],
  ['\\sqrt[n]{x}', 'root(n,x)'],
  ['x^2', 'x^2'],
  ['x^{12}', 'x^12'],
  ['x^{n+1}', 'x^(n+1)'],
  ['x^{-1}', 'x^(-1)'],
  ['2^{3^{2}}', '2^(3^2)'],
  ['x^{\\frac{1}{3}}', 'x^((1)/(3))'],
  ['\\left(x+1\\right)^{2}', '(x+1)^2'],
  ['\\frac{x}{2}^2', '((x)/(2))^2'],
  // functions
  ['\\sin x', 'sin(x)'],
  ['\\sin 2x', 'sin(2*x)'],
  ['\\sin\\left(x\\right)', 'sin(x)'],
  ['\\sin 2x\\cos x', 'sin(2*x)*cos(x)'],
  ['\\sin x+1', 'sin(x)+1'],
  ['\\sin x=\\cos x', 'sin(x)=cos(x)'],
  ['\\sin\\left(x\\right)\\cos\\left(x\\right)', 'sin(x)*cos(x)'],
  ['\\sin^2 x', 'sin(x)^2'],
  ['\\sin^{2}\\left(x\\right)', 'sin(x)^2'],
  ['\\cos^{2}x+\\sin^{2}x', 'cos(x)^2+sin(x)^2'],
  ['\\sin\\left(x\\right)^2', 'sin(x)^2'],
  ['\\sin^{-1}x', 'asin(x)'],
  ['\\tan^{-1}\\left(x\\right)', 'atan(x)'],
  ['\\sec^{-1}x', 'sec(x)^(-1)'],
  ['\\left(\\sin^{2}\\left(x\\right)\\right)^{3}', '(sin(x)^2)^3'],
  ['\\ln x', 'ln(x)'],
  ['\\ln\\left(x+1\\right)', 'ln(x+1)'],
  ['\\log x', 'log(x)'],
  ['\\log_{2}x', 'logb(2,x)'],
  ['\\log_2 x', 'logb(2,x)'],
  ['\\log_{2}\\left(x+1\\right)', 'logb(2,x+1)'],
  ['\\exp\\left(-x\\right)', 'exp(-x)'],
  ['\\arcsin x', 'asin(x)'],
  ['\\sin\\left(\\sin x\\right)', 'sin(sin(x))'],
  ['\\left|x-1\\right|', 'abs(x-1)'],
  ['\\left\\vert x\\right\\vert', 'abs(x)'],
  ['|x|+|y|', 'abs(x)+abs(y)'],
  ['2|x|', '2*abs(x)'],
  ['\\lfloor x\\rfloor', 'floor(x)'],
  ['\\left\\lceil x+1\\right\\rceil', 'ceil(x+1)'],
  ['\\sin\\left|x\\right|', 'sin(abs(x))'],
  ['\\operatorname{abs}\\left(x\\right)', 'abs(x)'],
  ['\\mathrm{sign}\\left(x\\right)', 'sign(x)'],
  ['\\operatorname{round}\\left(x\\right)', 'round(x)'],
  ['\\operatorname{gamma}\\left(x\\right)', 'gamma(x)'],
  ['\\operatorname{mod}\\left(x,3\\right)', 'mod(x,3)'],
  ['\\operatorname{atan2}\\left(y,x\\right)', 'atan2(y,x)'],
  ['\\operatorname{root}\\left(3,x\\right)', 'root(3,x)'],
  ['\\operatorname{factorial}\\left(x\\right)', 'factorial(x)'],
  // factorial, combinatorics
  ['n!', 'factorial(n)'],
  ['5!', 'factorial(5)'],
  ['\\left(a+b\\right)!', 'factorial((a+b))'],
  ['n!+1', 'factorial(n)+1'],
  ['\\binom{n}{k}', 'ncr(n,k)'],
  ['\\operatorname{nCr}\\left(5,2\\right)', 'ncr(5,2)'],
  ['\\operatorname{nPr}\\left(5,2\\right)', 'npr(5,2)'],
  // relations and separators
  ['y\\le x', 'y<=x'],
  ['y\\leq x', 'y<=x'],
  ['y\\ge x', 'y>=x'],
  ['y\\geq x', 'y>=x'],
  ['x\\ne 1', 'x!=1'],
  ['x\\neq 1', 'x!=1'],
  ['x<=1', 'x<=1'],
  ['y>x', 'y>x'],
  ['y=x^2', 'y=x^2'],
  ['x^2+y^2=1', 'x^2+y^2=1'],
  ['x<-1', 'x<-1'],
  ['\\cos t,\\sin t', 'cos(t),sin(t)'],
  ['\\left(\\cos t,\\sin t\\right)', 'cos(t),sin(t)'],
  ['r=\\cos\\left(3\\theta\\right)', 'r=cos(3*t)'],
  ['r=1+\\sin\\theta', 'r=1+sin(t)'],
  ['\\operatorname{max}\\left(a,b\\right)', 'max(a,b)'],
  // scientific notation
  ['1E-3', '1E-3'],
  ['1\\mathrm{E}-3', '1E-3'],
  ['2.5E4x', '2.5E4*x'],
  ['3E+2', '3E+2'],
  // text kept verbatim
  ['\\mathrm{sin(}x)', 'sin(x)', ['Unbalanced parentheses']],
  ['\\mathrm{a\\_b}+1', 'a_b+1'],
  // issues
  ['\\placeholder{}', '', ['Incomplete expression']],
  ['\\frac{\\placeholder{}}{2}', '(()/(2))', ['Incomplete expression']],
  ['a\\placeholder[x]{}+1', 'a+1', ['Incomplete expression']],
  ['\\log_{\\placeholder{}}\\left(\\placeholder{}\\right)', 'logb(,)', ['Incomplete expression']],
  ['\\sqrt[\\placeholder{}]{x}', 'root(,x)', ['Incomplete expression']],
  ['\\sin', 'sin()', ['Incomplete expression']],
  ['\\differentialD x', 'x', ['Unsupported: \\differentialD']],
  ['\\int x', 'x', ['Unsupported: \\int']],
  ['\\alpha+1', '+1', ['Unsupported: \\alpha']],
  ['x_1', 'x', ['Unsupported: subscript']],
  ['x^{', 'x', ['Unbalanced braces']],
  [')', ')', ['Unbalanced parentheses']],
  ['\\left(x+1', '(x+1)', ['Unbalanced parentheses']],
  ['\\operatorname{foo}\\left(x\\right)', 'foo*(x)', ['Unsupported: \\operatorname{foo}']],
  ['1.2.3', '1.2.3', ['Invalid number: 1.2.3']],
];

describe('latexToRaw', () => {
  it.each(TO_RAW)('%j -> %j', (latex, raw, issues) => {
    const result = latexToRaw(latex);
    expect(result.raw).toBe(raw);
    expect(result.issues).toEqual(issues ?? []);
  });

  it('has at least 40 table cases', () => {
    expect(TO_RAW.length).toBeGreaterThanOrEqual(40);
  });

  it('deduplicates repeated issues', () => {
    expect(latexToRaw('\\alpha+\\alpha').issues).toEqual(['Unsupported: \\alpha']);
  });

  it('produces output the parser accepts for well-formed input', () => {
    for (const [latex, raw, issues] of TO_RAW) {
      if (issues || raw === '' || /^[^=<>!,]*(?:[=<>,]|!=).*$/.test(raw)) continue;
      expect(() => parse(latexToRaw(latex).raw), latex).not.toThrow();
    }
  });
});

/** Every key of the virtual keyboard layout (`keyboard/math-keyboard-layout.ts`) as inserted. */
describe('latexToRaw: virtual keyboard insertions', () => {
  const KEYS: [string, string][] = [
    ['\\div', ''], // bare operator keys leave an empty operand
    ['a\\div b', 'a/b'],
    ['a\\times b', 'a*b'],
    ['a\\cdot b', 'a*b'],
    ['\\frac{1}{2}', '((1)/(2))'],
    ['\\sqrt{4}', 'sqrt(4)'],
    ['\\sqrt[3]{8}', 'root(3,8)'],
    ['\\left|x\\right|', 'abs(x)'],
    ['\\lfloor x\\rfloor', 'floor(x)'],
    ['\\lfloor x \\rfloor', 'floor(x)'],
    ['\\lceil x\\rceil', 'ceil(x)'],
    ['\\left\\lfloor x\\right\\rfloor', 'floor(x)'],
    ['\\left\\lceil x\\right\\rceil', 'ceil(x)'],
    ['\\log_{2}\\left(8\\right)', 'logb(2,8)'],
    ['\\exp\\left(1\\right)', 'exp(1)'],
    ['\\ln\\left(x\\right)', 'ln(x)'],
    ['\\log\\left(x\\right)', 'log(x)'],
    ['\\operatorname{round}\\left(x\\right)', 'round(x)'],
    ['\\operatorname{sign}\\left(x\\right)', 'sign(x)'],
    ['\\operatorname{nCr}\\left(5,2\\right)', 'ncr(5,2)'],
    ['\\operatorname{min}\\left(a,b\\right)', 'min(a,b)'],
    ['\\operatorname{max}\\left(a,b\\right)', 'max(a,b)'],
    ['\\operatorname{mod}\\left(a,b\\right)', 'mod(a,b)'],
    ['n!', 'factorial(n)'],
    ['\\left(a+b\\right)!', 'factorial((a+b))'],
    ['\\arcsin\\left(x\\right)', 'asin(x)'],
    ['\\arccos\\left(x\\right)', 'acos(x)'],
    ['\\arctan\\left(x\\right)', 'atan(x)'],
    ['\\sinh\\left(x\\right)', 'sinh(x)'],
    ['\\cosh\\left(x\\right)', 'cosh(x)'],
    ['\\tanh\\left(x\\right)', 'tanh(x)'],
    ['\\coth\\left(x\\right)', 'coth(x)'],
    ['\\operatorname{sech}\\left(x\\right)', 'sech(x)'],
    ['\\operatorname{csch}x', 'csch(x)'],
    ['\\operatorname{asinh}\\left(x\\right)', 'asinh(x)'],
    ['\\operatorname{arcosh}\\left(x\\right)', 'acosh(x)'],
    ['\\operatorname{atanh}\\left(x\\right)', 'atanh(x)'],
    ['\\operatorname{cbrt}\\left(x\\right)', 'cbrt(x)'],
    ['\\sinh^{-1}x', 'asinh(x)'],
    ['\\cosh^{-1}\\left(x\\right)', 'acosh(x)'],
    ['\\tanh^{-1}x', 'atanh(x)'],
    ['\\left(t,t^2\\right)', 't,t^2'],
    ['\\sec\\left(x\\right)', 'sec(x)'],
    ['\\csc\\left(x\\right)', 'csc(x)'],
    ['\\cot\\left(x\\right)', 'cot(x)'],
    ['\\theta', 't'],
    ['\\pi', 'pi'],
    ['x\\le y', 'x<=y'],
    ['x\\ge y', 'x>=y'],
    ['x=y', 'x=y'],
    ['x<y', 'x<y'],
    ['x>y', 'x>y'],
    ['x,y', 'x,y'],
    ['x^2', 'x^2'],
    ['x^{2}', 'x^2'],
    ['\\frac{x^{2}}{3}', '((x^2)/(3))'],
  ];

  it.each(KEYS.filter(([, raw]) => raw !== ''))('%j -> %j', (latex, raw) => {
    const result = latexToRaw(latex);
    expect(result.raw).toBe(raw);
    expect(result.issues).toEqual([]);
  });

  it('keeps an operator key pressed on an empty field harmless', () => {
    expect(() => latexToRaw('\\div')).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// rawToLatex: table
// ---------------------------------------------------------------------------

const TO_LATEX: [raw: string, latex: string][] = [
  ['', ''],
  ['   ', ''],
  ['x', 'x'],
  ['x^2', 'x^{2}'],
  ['x^10', 'x^{10}'],
  ['inf', '\\infty'],
  ['-inf', '-\\infty'],
  ['2x+1', '2x+1'],
  ['2*3', '2\\cdot3'],
  ['x*2', 'x\\cdot2'],
  ['pi*x', '\\pi x'],
  ['2pi', '2\\pi'],
  ['π', '\\pi'],
  ['theta', '\\theta'],
  ['e^x', 'e^{x}'],
  ['(x+1)(x-1)', '\\left(x+1\\right)\\left(x-1\\right)'],
  ['x(x+1)', 'x\\left(x+1\\right)'],
  ['2*(1/2)', '2\\cdot\\frac{1}{2}'],
  ['x/2*y', '\\frac{x}{2}y'],
  ['1/x', '\\frac{1}{x}'],
  ['(x+1)/(x-1)', '\\frac{x+1}{x-1}'],
  ['x/2/3', '\\frac{\\frac{x}{2}}{3}'],
  ['(x/2)^2', '\\left(\\frac{x}{2}\\right)^{2}'],
  ['-x^2', '-x^{2}'],
  ['(-2)^2', '\\left(-2\\right)^{2}'],
  ['2^-x', '2^{-x}'],
  ['x^2^3', 'x^{2^{3}}'],
  ['(x^2)^3', '\\left(x^{2}\\right)^{3}'],
  ['x^(1/3)', 'x^{\\frac{1}{3}}'],
  ['x-(y-z)', 'x-\\left(y-z\\right)'],
  ['x+-1', 'x-1'],
  ['x--1', 'x-\\left(-1\\right)'],
  ['2*(-x)', '2\\left(-x\\right)'],
  ['-(a+b)', '-\\left(a+b\\right)'],
  ['sin(x)', '\\sin\\left(x\\right)'],
  ['sin(x)^2', '\\sin^{2}\\left(x\\right)'],
  ['sin^2(x)', '\\sin^{2}\\left(x\\right)'],
  ['sin(x)^-1', '\\left(\\sin\\left(x\\right)\\right)^{-1}'],
  ['(sin(x))^2', '\\sin^{2}\\left(x\\right)'],
  ['(sin(x))^-1', '\\left(\\sin\\left(x\\right)\\right)^{-1}'],
  ['(abs(x))^2', '\\left|x\\right|^{2}'],
  ['(sin^2(x))^3', '\\left(\\sin^{2}\\left(x\\right)\\right)^{3}'],
  ['asin(x)', '\\arcsin\\left(x\\right)'],
  ['ln(x)^2', '\\ln\\left(x\\right)^{2}'],
  ['exp(-x^2)', '\\exp\\left(-x^{2}\\right)'],
  ['sqrt(x)', '\\sqrt{x}'],
  ['root(3,x)', '\\sqrt[3]{x}'],
  ['coth(x)', '\\coth\\left(x\\right)'],
  ['cbrt(x)', '\\operatorname{cbrt}\\left(x\\right)'],
  ['(cos(t),sin(t))', '\\left(\\cos\\left(t\\right),\\sin\\left(t\\right)\\right)'],
  ['logb(2,x)', '\\log_{2}\\left(x\\right)'],
  ['abs(x-1)', '\\left|x-1\\right|'],
  ['floor(x)', '\\left\\lfloor x\\right\\rfloor'],
  ['ceil(x)', '\\left\\lceil x\\right\\rceil'],
  ['factorial(5)', '5!'],
  ['factorial(x+1)', '\\left(x+1\\right)!'],
  ['ncr(5,2)', '\\binom{5}{2}'],
  ['npr(5,2)', '\\operatorname{npr}\\left(5,2\\right)'],
  ['min(x,2)', '\\operatorname{min}\\left(x,2\\right)'],
  ['atan2(y,x)', '\\operatorname{atan2}\\left(y,x\\right)'],
  ['round(x)', '\\operatorname{round}\\left(x\\right)'],
  ['1E-3', '0.001'],
  ['1E-7', '10^{-7}'],
  ['2.5E-7', '2.5\\cdot10^{-7}'],
  ['1E21', '10^{21}'],
  ['y>=x^2', 'y\\ge x^{2}'],
  ['y<=x', 'y\\le x'],
  ['y>x', 'y>x'],
  ['x!=1', 'x\\ne 1'],
  ['x^2+y^2=1', 'x^{2}+y^{2}=1'],
  ['y=sin(x)', 'y=\\sin\\left(x\\right)'],
  ['x=y^2', 'x=y^{2}'],
  ['cos(t),sin(t)', '\\cos\\left(t\\right),\\sin\\left(t\\right)'],
  ['r=cos(3*theta)', 'r=\\cos\\left(3\\theta\\right)'],
  ['max(1,2)<x', '\\operatorname{max}\\left(1,2\\right)<x'],
  // unparseable: kept as escaped text
  ['sin(', '\\mathrm{sin(}'],
  ['sin(x', '\\mathrm{sin(x}'],
  ['2+', '\\mathrm{2+}'],
  ['y=sin(', 'y=\\mathrm{sin(}'],
  ['y=', 'y='],
  ['a_b', '\\mathrm{a\\_b}'],
  ['x#', '\\mathrm{x\\#}'],
  ['{x}', '\\mathrm{\\{x\\}}'],
  ['1 2', '\\mathrm{1\\ 2}'],
  ['foo(x)', '\\mathrm{foo}x'],
];

describe('rawToLatex', () => {
  it.each(TO_LATEX)('%j -> %j', (raw, latex) => {
    expect(rawToLatex(raw)).toBe(latex);
  });

  it('has at least 40 table cases', () => {
    expect(TO_LATEX.length).toBeGreaterThanOrEqual(40);
  });
});

// ---------------------------------------------------------------------------
// Round-trip property: evaluate(latexToRaw(rawToLatex(s))) ~ evaluate(s)
// ---------------------------------------------------------------------------

const CORPUS: string[] = [
  // explicit y = f(x)
  'x',
  'x^2',
  '2x+1',
  '-x^2+3',
  '(x+1)(x-1)',
  'x(x+1)',
  'x^3-2x',
  '1/x',
  '(x+1)/(x-1)',
  'x/2/3',
  '2*3*x',
  'x*2',
  'sqrt(x)',
  'sqrt(x^2+1)',
  'root(3,x)',
  'logb(2,x)',
  'abs(x-1)',
  'floor(x)+ceil(x)',
  'round(x)+sign(x)',
  'gamma(x)',
  'factorial(x)',
  'factorial(x+1)',
  'ncr(5,2)+x',
  'npr(5,2)*x',
  'min(x,2)+max(x,1)',
  'mod(x,3)',
  'atan2(x,2)',
  'sin(x)',
  'sin(x)^2',
  'sin^2(x)+cos^2(x)',
  'sin(x)^-1',
  '(sin(x))^3',
  '(sin^2(x))^3',
  'cos(2*x)+sin(x/2)',
  'tan(x)+sec(x)+csc(x)+cot(x)',
  'sinh(x)+cosh(x)+tanh(x)',
  'cbrt(x)+asinh(x)+acosh(x+3)+atanh(x/9)+sech(x)+csch(x)+coth(x)',
  'asin(x/3)+acos(x/3)+atan(x)',
  'ln(x)+log(x)',
  'exp(-x^2)',
  'e^x',
  '2^x',
  '2^-x',
  'x^2^3',
  '(x^2)^3',
  'x^(1/3)',
  '(x/2)^2',
  '(-x)^2',
  '3*pi*x',
  'sin(pi*x)',
  '2pi',
  '1E-3*x',
  '2.5E4*x',
  '123456789012345678901234*x',
  '0.0000001*x',
  'x+-1',
  'x--1',
  'x-(y-z)',
  'x-(1+x)',
  '2*(-x)',
  '-(x+1)*3',
  'sin(x)*cos(x)',
  'x*sin(x)',
  '2sin(x)cos(x)',
  // y = ... prefix
  'y=sin(x)',
  'y=x^2-4',
  // implicit and inequalities
  'x^2+y^2=1',
  'x*y=1',
  'x^2/4+y^2/9=1',
  'x^2+y^2=sqrt(x^2+y^2)',
  'y>x',
  'y<=x^2',
  'x^2+y^2>=1',
  'y<sin(x)+1',
  'x!=y',
  // explicit x = g(y)
  'x=y^2',
  'x=sin(y)+2',
  // parametric
  'cos(t),sin(t)',
  't^2,t^3',
  '2cos(t),3sin(t)',
  't,t^2',
  'x=cos(t),y=sin(t)',
  // polar
  'r=cos(3*t)',
  'r=1+sin(t)',
  'r=2*t',
  'r=t^2',
  'r=2/(1+cos(t))',
];

const POINTS: Record<string, number>[] = [
  { x: -2.3, y: 0.7, t: -1.1, theta: 0.4, r: 1.3 },
  { x: 0.5, y: -1.9, t: 0.9, theta: 2.2, r: 0.4 },
  { x: 1.7, y: 2.4, t: 2.6, theta: -0.8, r: 2.1 },
  { x: 3.1, y: -0.3, t: -2.7, theta: 1.3, r: -0.6 },
  { x: 4, y: 2, t: 3, theta: 5, r: 3 },
];

/** Depth-0 split at `<= >= != == < > = ,` (the same separators the bridge uses). */
function splitTop(raw: string): { parts: string[]; ops: string[] } {
  const parts: string[] = [];
  const ops: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if ('([{'.includes(ch)) depth++;
    else if (')]}'.includes(ch)) depth--;
    else if (depth === 0) {
      const two = raw.slice(i, i + 2);
      let op = '';
      if (['<=', '>=', '!=', '=='].includes(two)) op = two;
      else if ('<>=,'.includes(ch)) op = ch;
      if (op) {
        parts.push(raw.slice(start, i));
        ops.push(op === '==' ? '=' : op);
        i += op.length - 1;
        start = i + 1;
      }
    }
  }
  parts.push(raw.slice(start));
  return { parts: parts.map((p) => p.trim()), ops };
}

function value(part: string, vars: Record<string, number>): number | 'error' {
  if (part === '') return NaN;
  try {
    return evaluate(parse(part), vars);
  } catch {
    return 'error';
  }
}

function same(a: number | 'error', b: number | 'error'): boolean {
  if (a === 'error' || b === 'error') return a === b;
  if (Number.isNaN(a) || Number.isNaN(b)) return Number.isNaN(a) && Number.isNaN(b);
  if (a === b) return true;
  return Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));
}

function braceBalance(latex: string): { braces: number; lefts: number; rights: number } {
  let braces = 0;
  let minBraces = 0;
  for (let i = 0; i < latex.length; i++) {
    if (latex[i] === '\\') {
      i++;
      continue;
    }
    if (latex[i] === '{') braces++;
    else if (latex[i] === '}') braces--;
    minBraces = Math.min(minBraces, braces);
  }
  return {
    braces: minBraces < 0 ? -1 : braces,
    lefts: (latex.match(/\\left(?![a-zA-Z])/g) ?? []).length,
    rights: (latex.match(/\\right(?![a-zA-Z])/g) ?? []).length,
  };
}

describe('round trip: latexToRaw(rawToLatex(s)) evaluates like s', () => {
  it('has at least 40 corpus entries covering every mode', () => {
    expect(CORPUS.length).toBeGreaterThanOrEqual(40);
  });

  it.each(CORPUS)('%s', (s) => {
    const latex = rawToLatex(s);
    const back = latexToRaw(latex);
    expect(back.issues, `${s} -> ${latex}`).toEqual([]);

    const original = splitTop(s);
    const restored = splitTop(back.raw);
    expect(restored.ops, `${s} -> ${back.raw}`).toEqual(original.ops);
    expect(restored.parts.length).toBe(original.parts.length);

    for (const vars of POINTS) {
      original.parts.forEach((part, i) => {
        const a = value(part, vars);
        const b = value(restored.parts[i], vars);
        expect(
          same(a, b),
          `${s} -> ${latex} -> ${back.raw} @ ${JSON.stringify(vars)}: ${a} vs ${b}`,
        ).toBe(true);
      });
    }
  });

  it.each(CORPUS)('balanced braces and \\left/\\right: %s', (s) => {
    const latex = rawToLatex(s);
    const { braces, lefts, rights } = braceBalance(latex);
    expect(braces, latex).toBe(0);
    expect(lefts, latex).toBe(rights);
  });

  it('raw -> latex -> raw is a fixed point after one round', () => {
    for (const s of CORPUS.filter((c) => !/\d{15}/.test(c))) {
      const once = latexToRaw(rawToLatex(s)).raw;
      expect(latexToRaw(rawToLatex(once)).raw, s).toBe(once);
    }
  });

  it('keeps unparseable text through the round trip', () => {
    for (const s of ['sin(', 'y=sin(', '2+', 'a_b+3']) {
      const back = latexToRaw(rawToLatex(s)).raw;
      expect(back.replace(/\s/g, '')).toBe(s.replace(/\s/g, ''));
    }
  });
});

// ---------------------------------------------------------------------------
// Robustness
// ---------------------------------------------------------------------------

describe('never throws', () => {
  const LATEX_PIECES = [
    '\\frac',
    '{',
    '}',
    '\\left',
    '\\right',
    '(',
    ')',
    '[',
    ']',
    '|',
    '^',
    '_',
    'x',
    '2',
    '\\sqrt',
    '\\sin',
    '\\log',
    '\\operatorname',
    '\\placeholder',
    '!',
    ',',
    '=',
    '<',
    '\\le',
    '\\lfloor',
    '\\rfloor',
    '\\binom',
    '\\mathrm',
    '\\',
    '+',
    '-',
    '\\cdot',
    '.',
    'E',
    '\\pi',
  ];
  const RAW_PIECES = [
    'sin',
    '(',
    ')',
    'x',
    '2',
    '+',
    '-',
    '*',
    '/',
    '^',
    ',',
    '=',
    '<',
    '>',
    '!',
    'pi',
    'E',
    '.',
    '{',
    '_',
    '$',
    ' ',
  ];

  function random(pieces: string[], seed: number): string {
    let state = seed;
    let out = '';
    for (let n = 0; n < 25; n++) {
      state = (state * 1103515245 + 12345) & 0x7fffffff;
      out += pieces[state % pieces.length];
    }
    return out;
  }

  it('latexToRaw on 500 random token soups', () => {
    for (let seed = 1; seed <= 500; seed++) {
      const input = random(LATEX_PIECES, seed);
      const result = latexToRaw(input);
      expect(typeof result.raw, input).toBe('string');
      expect(Array.isArray(result.issues), input).toBe(true);
    }
  });

  it('rawToLatex on 500 random token soups', () => {
    for (let seed = 1; seed <= 500; seed++) {
      const input = random(RAW_PIECES, seed);
      expect(typeof rawToLatex(input), input).toBe('string');
    }
  });

  it('survives very deep nesting', () => {
    const deep = '\\left('.repeat(2000) + 'x' + '\\right)'.repeat(2000);
    expect(() => latexToRaw(deep)).not.toThrow();
    expect(() => rawToLatex('('.repeat(2000) + 'x' + ')'.repeat(2000))).not.toThrow();
  });

  it('tolerates non-string input', () => {
    expect(latexToRaw(undefined as unknown as string)).toEqual({ raw: '', issues: [] });
    expect(rawToLatex(undefined as unknown as string)).toBe('');
  });
});

describe('piecewise: cases <-> if()', () => {
  it.each<[string, string]>([
    [String.raw`\begin{cases}-1 & x<0\\ 1 & \text{otherwise}\end{cases}`, 'if(x<0,-1,1)'],
    [
      String.raw`\begin{cases}x^2, & \text{if } 0\le x<1\\ 2-x, & 1\le x\le 2\end{cases}`,
      'if(0<=x<1,x^2,if(1<=x<=2,2-x))',
    ],
    [String.raw`y=\begin{cases}x & x=0\\[3pt] 2 & \end{cases}`, 'y=if(x==0,x,2)'],
    [String.raw`\begin{dcases}1 & x\ne 2\\ 0 & \text{else}\end{dcases}`, 'if(x!=2,1,0)'],
    [String.raw`2\begin{cases}x & x>0\\ 0 & \text{otherwise}\end{cases}`, '2*if(x>0,x,0)'],
    // What MathLive emits when `if(x<0,-1,1)` is typed on a physical keyboard.
    [String.raw`if\left(x<0,-1,1\right)`, 'if(x<0,-1,1)'],
    [String.raw`y=if\left(0\le x<1,x,0\right)`, 'y=if(0<=x<1,x,0)'],
  ])('%s -> %s', (latex, raw) => {
    expect(latexToRaw(latex)).toEqual({ raw, issues: [] });
  });

  it('flags unsupported environments and a missing end', () => {
    expect(latexToRaw(String.raw`\begin{matrix}1\end{matrix}`).issues).toContain(
      'Unsupported: \\begin{matrix}',
    );
    expect(latexToRaw(String.raw`\begin{cases}1 & x<0`).issues).toContain('Missing \\end{cases}');
  });

  it.each<[string, string]>([
    ['if(x<0, -1, 1)', String.raw`\begin{cases}-1 & x<0\\ 1 & \text{otherwise}\end{cases}`],
    ['if(x<0, -x, if(x<1, x^2))', String.raw`\begin{cases}-x & x<0\\ x^{2} & x<1\end{cases}`],
    ['if(0<=x<1, x, 0)', String.raw`\begin{cases}x & 0\le x<1\\ 0 & \text{otherwise}\end{cases}`],
  ])('rawToLatex %s', (raw, latex) => {
    expect(rawToLatex(raw)).toBe(latex);
  });

  it.each([
    'y = if(x<0, -1, 1)',
    'y = if(x < 0, -x, if(x < 1, x^2, 1))',
    'y = if(0 <= x < 1, x^2, if(1 <= x <= 2, 2 - x))',
    'y = if(x == 2, 4, 3/(x-2))',
    'y = 2*if(x != 0, sin(x)/x, 1)^2',
  ])('round trip latex -> raw -> latex: %s', (raw) => {
    const latex = rawToLatex(raw);
    const back = latexToRaw(latex);
    expect(back.issues).toEqual([]);
    expect(rawToLatex(back.raw)).toBe(latex);
    const rhs = (s: string) => parse(s.replace(/^y\s*=\s*/, ''));
    for (const x of [-1.5, -0.5, 0, 0.5, 1, 1.5, 2, 3]) {
      const want = evaluate(rhs(raw), { x });
      const got = evaluate(rhs(back.raw), { x });
      if (Number.isNaN(want)) expect(got).toBeNaN();
      else expect(got).toBeCloseTo(want, 12);
    }
  });
});
