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
  const num = parseFloat(trimmed);
  if (!isNaN(num)) return { value: num, invalid: false };
  try {
    return { value: evalConstantExpression(trimmed), invalid: false };
  } catch {
    return { value: null, invalid: true };
  }
}
