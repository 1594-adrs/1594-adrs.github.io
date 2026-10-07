/**
 * Bridge between MathLive's LaTeX and the calculator's plain-text syntax
 * (the `raw` string the parser/evaluator understand). Pure: no DOM, no Angular.
 */
export { latexToRaw } from './latex-to-raw';
export type { LatexToRawResult } from './latex-to-raw';
export { rawToLatex } from './raw-to-latex';
