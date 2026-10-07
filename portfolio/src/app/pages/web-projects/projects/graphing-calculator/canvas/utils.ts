// Canvas 2D context does not support CSS variables; these utilities are for canvas rendering only.
// The implementations live in the engine (pure math) so engine modules never import from canvas/.
export { tryEval, findAxisCrossings } from '../engine/numeric-utils';
