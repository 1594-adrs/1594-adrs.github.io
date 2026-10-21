import type { Exercise } from './exercise.types';

/**
 * Lazy registry of exercise chunks (`<source>/<chunk>.ts`, each `export default [...] satisfies
 * Exercise[]`). Dynamic imports keep every chunk out of the app bundle until something loads it.
 * Every entry except `synthetic/smoke` is generated from the private catalog.
 */
export const EXERCISE_CHUNKS: Record<string, () => Promise<Exercise[]>> = {
  'synthetic/smoke': () => import('./synthetic/smoke').then((m) => m.default),
  'apex/ch07': () => import('./apex/ch07').then((m) => m.default),
  'apex/ch09': () => import('./apex/ch09').then((m) => m.default),
  'openstax1/ch01': () => import('./openstax1/ch01').then((m) => m.default),
  'openstax1/ch02': () => import('./openstax1/ch02').then((m) => m.default),
  'openstax1/ch03': () => import('./openstax1/ch03').then((m) => m.default),
  'openstax1/ch04': () => import('./openstax1/ch04').then((m) => m.default),
  'openstax1/ch06': () => import('./openstax1/ch06').then((m) => m.default),
  'openstax2/ch01': () => import('./openstax2/ch01').then((m) => m.default),
  'openstax2/ch02': () => import('./openstax2/ch02').then((m) => m.default),
  'openstax2/ch03': () => import('./openstax2/ch03').then((m) => m.default),
  'openstax2/ch04': () => import('./openstax2/ch04').then((m) => m.default),
  'openstax2/ch05': () => import('./openstax2/ch05').then((m) => m.default),
  'openstax2/ch06': () => import('./openstax2/ch06').then((m) => m.default),
  'openstax2/ch07': () => import('./openstax2/ch07').then((m) => m.default),
  'synthetic/edge': () => import('./synthetic/edge').then((m) => m.default),
  'thomas12/ch01': () => import('./thomas12/ch01').then((m) => m.default),
  'thomas12/ch02': () => import('./thomas12/ch02').then((m) => m.default),
  'thomas12/ch03': () => import('./thomas12/ch03').then((m) => m.default),
  'thomas12/ch04': () => import('./thomas12/ch04').then((m) => m.default),
  'thomas12/ch05': () => import('./thomas12/ch05').then((m) => m.default),
  'thomas12/ch06': () => import('./thomas12/ch06').then((m) => m.default),
  'thomas12/ch07': () => import('./thomas12/ch07').then((m) => m.default),
  'thomas12/ch08': () => import('./thomas12/ch08').then((m) => m.default),
  'thomas12/ch09': () => import('./thomas12/ch09').then((m) => m.default),
  'thomas12/ch10': () => import('./thomas12/ch10').then((m) => m.default),
  'thomas12/ch11': () => import('./thomas12/ch11').then((m) => m.default),
};
