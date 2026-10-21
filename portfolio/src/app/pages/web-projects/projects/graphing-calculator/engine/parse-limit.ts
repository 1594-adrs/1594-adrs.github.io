import { evalConstantExpression } from './evaluator';

/**
 * Result of parsing a bound/limit expression (e.g. "pi", "2*e", "-3.5").
 * `invalid` is true only for a non-empty string that failed to parse/evaluate;
 * an empty string parses to `{ value: null, invalid: false }` (no value, no error).
 */
export interface ParsedLimit {
  value: number | null;
  invalid: boolean;
}

/** Parses a limit/bound expression: try a plain float first, then a constant expression. */
export function parseLimitText(raw: string): ParsedLimit {
  const trimmed = raw.trim();
  if (!trimmed) return { value: null, invalid: false };
  // Strict: parseFloat would read `2*pi` as 2 and `1/3` as 1.
  const num = Number(trimmed);
  // Number() also reads Infinity, 1E999 and 0x/0b/0o literals, which the expression grammar rejects.
  if (Number.isFinite(num) && !/[xXbBoO]/.test(trimmed)) return { value: num, invalid: false };
  try {
    return { value: evalConstantExpression(trimmed), invalid: false };
  } catch {
    return { value: null, invalid: true };
  }
}
