/**
 * Pure detection of a function-row's curve mode from its raw text.
 *
 * Kept independent from `models/calculator.models` (no import) so this stays a
 * leaf engine module; `DetectedCurveMode` is structurally identical to the
 * app-level `CurveMode` and can be assigned to it directly.
 */
export type DetectedCurveMode = 'explicit' | 'explicit-y' | 'implicit' | 'parametric' | 'polar';

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
  const trimmed = unwrapParametricPair(raw).trim();

  if (/^r\s*=/i.test(trimmed)) return 'polar';
  if (/[<>]=?/.test(trimmed)) return 'implicit';
  if (hasTopLevelComma(trimmed)) return 'parametric';

  const xEqualsMatch = /^x\s*=\s*(.*)$/i.exec(trimmed);
  if (xEqualsMatch) {
    const rhs = xEqualsMatch[1];
    if (!containsVariable(rhs, 'x') && containsVariable(rhs, 'y')) return 'explicit-y';
  }

  if (/[=]/.test(trimmed) && !/^[yY]\s*=/.test(trimmed)) return 'implicit';
  return 'explicit';
}
