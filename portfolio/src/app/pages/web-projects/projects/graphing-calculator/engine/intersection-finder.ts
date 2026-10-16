import { findAxisCrossings, safeEval } from './numeric-utils';

export interface IntersectionPoint {
  x: number;
  y: number;
  functionIndices: number[];
}

/**
 * Pairwise intersections of the curves on [a, b]: the zeros of each pair's difference, found by
 * findAxisCrossings (sign changes, tangencies, close pairs, high-multiplicity crossings, domain
 * edges, coincident curves -> none). A point where several pairs meet is reported once.
 */
export function findIntersections(
  functions: Array<(x: number) => number>,
  a: number,
  b: number,
  steps = 200,
): IntersectionPoint[] {
  const h = (b - a) / steps;
  const intersections: IntersectionPoint[] = [];

  for (let fi = 0; fi < functions.length; fi++) {
    for (let fj = fi + 1; fj < functions.length; fj++) {
      const fnI = functions[fi];
      const fnJ = functions[fj];
      // The difference divided by the curves' magnitude (positive: same zeros and signs) makes the
      // root residual test relative: a pole jump (tan(x) vs 1) stays near 1 and is rejected, while a
      // crossing of large-valued curves (x^3 vs 1e12) is kept.
      const diff = (x: number): number => {
        const yi = fnI(x);
        const yj = fnJ(x);
        return (yi - yj) / Math.max(1, Math.abs(yi), Math.abs(yj));
      };
      // Merge only into earlier pairs' points: two crossings of one pair stay apart however close.
      const earlier = intersections.length;
      for (const x of findAxisCrossings(diff, a, b, 0, steps)) {
        const y = safeEval(fnI, x);
        if (y === null) continue;
        const existing = intersections.find(
          (q, k) => k < earlier && Math.abs(q.x - x) < Math.abs(h) * 2,
        );
        if (existing) {
          if (!existing.functionIndices.includes(fi)) existing.functionIndices.push(fi);
          if (!existing.functionIndices.includes(fj)) existing.functionIndices.push(fj);
        } else {
          intersections.push({ x, y, functionIndices: [fi, fj] });
        }
      }
    }
  }

  intersections.sort((p, q) => p.x - q.x);
  return intersections;
}
