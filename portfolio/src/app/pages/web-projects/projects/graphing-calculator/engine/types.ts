// Types shared by engine modules that must NOT import from `../models`
// (engine is a leaf layer with no dependency on the app/component layer).
// `models/calculator.models.ts` re-exports these so other importers are
// unaffected.

export type ConicType = 'circle' | 'ellipse' | 'parabola' | 'hyperbola';
