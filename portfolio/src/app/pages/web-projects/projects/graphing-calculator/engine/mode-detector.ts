/**
 * Pure detection of a function-row's curve mode from its raw text.
 *
 * Kept independent from `models/calculator.models` (no import) so this stays a
 * leaf engine module; `DetectedCurveMode` is structurally identical to the
 * app-level `CurveMode` and can be assigned to it directly.
 */
export type DetectedCurveMode =
  'explicit' | 'explicit-y' | 'implicit' | 'parametric' | 'polar' | 'slider';

/** Names bound by the evaluator / mode detection; never free parameters. X, Y, R are included
 *  because `x =`, `y =`, `r =` rows are detected case-insensitively. */
const RESERVED_NAMES = new Set(['x', 'X', 'y', 'Y', 't', 'r', 'R', 'e', 'θ', 'theta', 'pi', 'π']);

/** A free parameter (slider) name: any single letter the evaluator does not bind. */
export function isParamName(name: string): boolean {
  return /^[A-Za-z]$/.test(name) && !RESERVED_NAMES.has(name);
}

/** Whether `text` mentions a curve variable (x, y, t, r, theta), using the parser's split rule:
 *  a letter run made only of x/y/t is implicit multiplication (`2xt`). */
function mentionsCurveVariable(text: string): boolean {
  for (const [run] of text.matchAll(/[A-Za-z_][A-Za-z0-9_]*/g)) {
    if (/^[xyt]+$/.test(run) || run === 'r' || run === 'theta') return true;
  }
  return false;
}

/**
 * The parameter a slider row defines (`a = 2` -> 'a'), else null. A slider row is
 * `<param> = <rhs>` with a single top-level `=` and an rhs free of curve variables.
 * shortcut: the RHS must be constant, so `b = 2a` is not supported; upgrade when someone asks.
 * (`b = 2a` still reads as a slider row; its value is reported as invalid.)
 */
export function sliderName(raw: string): string | null {
  const m = /^\s*([A-Za-z])\s*=(.*)$/s.exec(raw);
  if (!m || !isParamName(m[1])) return null;
  const rhs = m[2];
  if (!rhs.trim() || /[=<>,!]/.test(maskNested(rhs)) || mentionsCurveVariable(rhs)) return null;
  return m[1];
}

function hasTopLevelComma(raw: string): boolean {
  let depth = 0;
  let commaCount = 0;
  for (const ch of raw) {
    if (ch === '(' || ch === '[' || ch === '{') depth++;
    else if (ch === ')' || ch === ']' || ch === '}') depth--;
    else if (ch === ',' && depth === 0) commaCount++;
  }
  return commaCount === 1;
}

/**
 * `(f(t), g(t))` -> `f(t), g(t)`: the Desmos-style pair, when one `(…)` spans the whole text and
 * holds exactly one top-level comma. Anything else is returned unchanged (`(a),(b)` is not a pair).
 */
export function unwrapParametricPair(raw: string): string {
  const t = raw.trim();
  if (t[0] !== '(' || t[t.length - 1] !== ')') return raw;
  let depth = 0;
  for (let i = 0; i < t.length; i++) {
    if (t[i] === '(') depth++;
    else if (t[i] === ')' && --depth === 0 && i < t.length - 1) return raw;
  }
  const inner = t.slice(1, -1);
  return hasTopLevelComma(inner) ? inner : raw;
}

/**
 * `raw` with everything inside brackets blanked to spaces (same length, brackets kept), so a
 * relation or `=` search only sees the top level: `y = if(x<0, 1, 2)` is not an inequality.
 * Match on the mask, then slice `raw` with the same indices.
 */
export function maskNested(raw: string): string {
  let depth = 0;
  let out = '';
  for (const ch of raw) {
    if (ch === ')' || ch === ']' || ch === '}') depth = Math.max(0, depth - 1);
    out += depth > 0 ? ' '.repeat(ch.length) : ch;
    if (ch === '(' || ch === '[' || ch === '{') depth++;
  }
  return out;
}

/** Whether `name` appears in `expr` as a standalone identifier (not e.g. the 'x' inside 'exp'). */
function containsVariable(expr: string, name: string): boolean {
  const re = new RegExp(`(?<![A-Za-z0-9_])${name}(?![A-Za-z0-9_])`);
  return re.test(expr);
}

/**
 * Detects the curve mode from raw input text.
 *
 * `x = g(y)` (explicit-y) is only picked when the right-hand side does not
 * reference `x` and does reference `y` — so `x = y^2 + x` still falls through
 * to implicit (self-referential), and a bare `x = 3` keeps today's behavior
 * of being treated as an implicit vertical line.
 */
export function detectCurveMode(raw: string): DetectedCurveMode {
  if (sliderName(raw)) return 'slider';
  const trimmed = unwrapParametricPair(raw).trim();

  if (/^r\s*=/i.test(trimmed)) return 'polar';
  const top = maskNested(trimmed);
  if (/[<>]/.test(top)) return 'implicit';
  if (hasTopLevelComma(trimmed)) return 'parametric';

  const xEqualsMatch = /^x\s*=\s*(.*)$/i.exec(trimmed);
  if (xEqualsMatch) {
    const rhs = xEqualsMatch[1];
    if (!containsVariable(rhs, 'x') && containsVariable(rhs, 'y')) return 'explicit-y';
  }

  if (/=/.test(top) && !/^[yY]\s*=/.test(trimmed)) return 'implicit';
  return 'explicit';
}
