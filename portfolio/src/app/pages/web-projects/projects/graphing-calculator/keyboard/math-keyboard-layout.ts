import type { VirtualKeyboardLayout } from 'mathlive';

/** Keyboard kinds: full expression editor vs. compact numeric one (limits, bounds). */
export type MathKeyboardKind = 'expression' | 'limit';

type Key = string | Record<string, unknown>;

const fn = (name: string): Key => ({
  latex: `\\${name}`,
  insert: `\\${name}\\left(#?\\right)`,
  class: 'small',
});

const op = (name: string): Key => ({
  latex: `\\operatorname{${name}}`,
  insert: `\\operatorname{${name}}\\left(#?\\right)`,
  class: 'small',
});

const op2 = (name: string): Key => ({
  latex: `\\operatorname{${name}}`,
  insert: `\\operatorname{${name}}\\left(#?,#?\\right)`,
  class: 'small',
});

const sym = (latex: string): Key => ({ latex, insert: latex });

const ACTIONS: Key[] = ['[left]', '[right]', '[backspace]'];

const NUMBERS: Key[][] = [
  ['[7]', '[8]', '[9]', sym('\\div'), '\\frac{#@}{#?}', '\\sqrt{#0}'],
  ['[4]', '[5]', '[6]', sym('\\times'), '[^]', { latex: 'x^2', insert: '#@^{2}' }],
  ['[1]', '[2]', '[3]', '[-]', '[(]', '[)]'],
  ['[0]', '[.]', '[+]', ...ACTIONS],
];

const FUNCTIONS: Key[][] = [
  [fn('sin'), fn('cos'), fn('tan'), fn('sec'), fn('csc'), fn('cot')],
  [fn('arcsin'), fn('arccos'), fn('arctan'), fn('sinh'), fn('cosh'), fn('tanh')],
  [
    fn('ln'),
    fn('log'),
    { latex: '\\log_{\\placeholder{}}', insert: '\\log_{#?}\\left(#?\\right)', class: 'small' },
    fn('exp'),
    { latex: '|x|', insert: '\\left|#0\\right|', class: 'small' },
    { latex: '\\sqrt[n]{x}', insert: '\\sqrt[#?]{#0}', class: 'small' },
  ],
  [
    { latex: '\\lfloor x\\rfloor', insert: '\\lfloor#0\\rfloor', class: 'small' },
    { latex: '\\lceil x\\rceil', insert: '\\lceil#0\\rceil', class: 'small' },
    op('round'),
    op('sign'),
    { latex: 'n!', insert: '#@!', class: 'small' },
    op2('nCr'),
  ],
  [op2('min'), op2('max'), op2('mod'), ...ACTIONS],
];

const VARIABLES: Key[][] = [
  ['x', 'y', 't', 'r', sym('\\theta'), sym('\\pi')],
  ['e', '=', '<', '>', sym('\\le'), sym('\\ge')],
  [',', '[(]', '[)]', ...ACTIONS],
];

const LIMIT: Key[][] = [
  ['[7]', '[8]', '[9]', sym('\\div'), '\\frac{#@}{#?}', '\\sqrt{#0}', '[backspace]'],
  ['[4]', '[5]', '[6]', sym('\\times'), '[^]', '[(]', '[)]'],
  ['[1]', '[2]', '[3]', '[-]', '[+]', sym('\\pi'), 'e'],
  ['[0]', '[.]', '[left]', '[right]'],
];

const layout = (
  id: string,
  label: string,
  tooltip: string,
  rows: Key[][],
): VirtualKeyboardLayout => ({
  id,
  label,
  tooltip,
  displayEditToolbar: false,
  layers: [{ rows: rows as never }],
});

export const EXPRESSION_LAYOUTS: VirtualKeyboardLayout[] = [
  layout('calc-numbers', '123', 'Numbers and operators', NUMBERS),
  layout('calc-functions', 'f(x)', 'Functions', FUNCTIONS),
  layout('calc-variables', 'x y', 'Variables and constants', VARIABLES),
];

export const LIMIT_LAYOUTS: VirtualKeyboardLayout[] = [
  layout('calc-limit', '123', 'Numbers', LIMIT),
];

/**
 * Inline shortcuts allowed while typing: only what the LaTeX bridge understands.
 * Assigned wholesale, which replaces MathLive's defaults (no `int`, `sum`, `lim`, `infty`...).
 */
export const SAFE_INLINE_SHORTCUTS: Record<string, string> = {
  sin: '\\sin',
  cos: '\\cos',
  tan: '\\tan',
  sec: '\\sec',
  csc: '\\csc',
  cot: '\\cot',
  arcsin: '\\arcsin',
  arccos: '\\arccos',
  arctan: '\\arctan',
  sinh: '\\sinh',
  cosh: '\\cosh',
  tanh: '\\tanh',
  ln: '\\ln',
  log: '\\log',
  exp: '\\exp',
  pi: '\\pi',
  theta: '\\theta',
  sqrt: '\\sqrt{#0}',
  '<=': '\\le',
  '>=': '\\ge',
};

/** MathLive keyboard theming, mapped to project CSS variables (injected once by the loader). */
export const MATH_KEYBOARD_THEME_CSS = `:root {
  --keyboard-zindex: var(--z-fixed);
  --keyboard-background: var(--color-bg-card);
  --keyboard-border: var(--color-border);
  --keyboard-accent-color: var(--color-primary);
  --keyboard-toolbar-background: var(--color-bg-dark);
  --keyboard-toolbar-background-hover: var(--color-glow-10);
  --keyboard-toolbar-background-selected: var(--color-glow-15);
  --keyboard-toolbar-text: var(--color-text-muted);
  --keyboard-toolbar-text-active: var(--color-primary);
  --keycap-background: var(--color-canvas-bg);
  --keycap-background-hover: var(--color-border);
  --keycap-background-active: var(--color-glow-20);
  --keycap-background-pressed: var(--color-glow-20);
  --keycap-border: var(--color-border-control);
  --keycap-border-bottom: var(--color-border-control);
  --keycap-text: var(--color-text);
  --keycap-text-hover: var(--color-primary);
  --keycap-text-active: var(--color-primary);
  --keycap-text-pressed: var(--color-primary);
  --keycap-secondary-background: var(--color-bg-dark);
  --keycap-secondary-background-hover: var(--color-border);
  --keycap-secondary-border: var(--color-border-control);
  --keycap-secondary-border-bottom: var(--color-border-control);
  --keycap-secondary-text: var(--color-text);
  --keycap-primary-background: var(--color-iris-dark);
  --keycap-primary-background-hover: var(--color-iris-green);
  --keycap-primary-text: var(--color-text);
  --variant-panel-background: var(--color-bg-card);
  --variant-keycap-text: var(--color-text);
  --variant-keycap-text-active: var(--color-bg-dark);
  --variant-keycap-background-active: var(--color-primary);
}`;
