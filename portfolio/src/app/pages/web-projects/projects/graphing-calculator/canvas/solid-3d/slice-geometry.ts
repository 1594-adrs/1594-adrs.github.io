import type { BufferGeometry } from 'three';
import type { SolidPiece, SolidSpec } from '../../engine/solids/solid.types';
import { buildPieceGeometry } from './solid-mesh-builder';

const SLICE_RADIAL_SEGMENTS = 48;
const SLICE_HALF_WIDTH_RATIO = 0.0025;
const MIN_HALF_WIDTH = 1e-6;

/**
 * Builds the representative slice at `t`:
 * - disk-washer: a thin disk/washer (a slab of the revolved solid, thickness along the axis).
 * - shell: a thin cylindrical shell (a slab of the revolved solid, thickness in radius).
 * - cross-section: a thin prism of the cross-section polygon at t.
 *
 * Reuses `buildPieceGeometry` with a tiny synthetic piece spanning [t - dt, t + dt]: for
 * disk-washer/shell that tiny t-range is exactly the "thin" dimension the contract asks for
 * (axial thickness when t maps to height, radial thickness when t maps to radius); for
 * cross-section it is simply two profiles apart, i.e. a thin prism.
 *
 * Returns null when t is outside [spec.a, spec.b], non-finite, or no piece contains it.
 */
export function buildSliceGeometry(
  spec: SolidSpec,
  pieces: SolidPiece[],
  t: number,
): BufferGeometry | null {
  if (!Number.isFinite(t)) return null;
  if (t < spec.a || t > spec.b) return null;

  const piece = pieces.find((p) => t >= p.a && t <= p.b);
  if (!piece) return null;

  const span = spec.b - spec.a;
  if (!Number.isFinite(span) || span <= 0) return null;

  const halfWidth = Math.max(span * SLICE_HALF_WIDTH_RATIO, MIN_HALF_WIDTH);
  let a = Math.max(piece.a, t - halfWidth);
  let b = Math.min(piece.b, t + halfWidth);
  if (b <= a) {
    // t sits exactly on a piece boundary; fall back to widening within the full domain
    a = Math.max(spec.a, t - halfWidth);
    b = Math.min(spec.b, t + halfWidth);
    if (b <= a) return null;
  }

  const syntheticPiece: SolidPiece = {
    a,
    b,
    upperIndex: piece.upperIndex,
    lowerIndex: piece.lowerIndex,
  };
  const samples = spec.method === 'cross-section' ? 2 : 4;
  return buildPieceGeometry(spec, syntheticPiece, samples, SLICE_RADIAL_SEGMENTS);
}
