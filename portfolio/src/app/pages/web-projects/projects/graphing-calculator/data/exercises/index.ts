import type { Exercise } from './exercise.types';

/**
 * Lazy registry of exercise chunks (`<source>/<chunk>.ts`, each `export default [...] satisfies
 * Exercise[]`). Dynamic imports keep every chunk out of the app bundle until something loads it.
 */
export const EXERCISE_CHUNKS: Record<string, () => Promise<Exercise[]>> = {
  'synthetic/smoke': () => import('./synthetic/smoke').then((m) => m.default),
};
