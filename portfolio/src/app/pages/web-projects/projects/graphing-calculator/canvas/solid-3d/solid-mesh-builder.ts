import { BufferGeometry, LatheGeometry, Vector2, Vector3 } from 'three';
import type {
  CrossSectionShape,
  IntegrationVariable,
  SolidPiece,
  SolidSpec,
} from '../../engine/solids/solid.types';
import { buildLoft } from './loft';

/**
 * Pure (no-DOM) builders for the "solids by integration" 3D mesh.
 *
 * Coordinate conventions (kept consistent with the existing revolution renderer):
 * - The 2D math plane (x, y) maps directly to world (X, Y); Z is the out-of-page dimension used
 *   to revolve curves around an axis, or to extrude cross-section shapes.
 * - Revolution ('disk-washer' and 'shell'): each `SolidPiece` becomes a closed profile in a
 *   (radius, height-along-axis) plane, revolved with `THREE.LatheGeometry`, then rotated so the
 *   axis line sits at its true world position (`y = k` horizontal, or `x = k` vertical).
 * - Cross-section: each sampled t produces a polygon standing on the base segment
 *   [lower(t), upper(t)] (in the math plane, z = 0) and rising into +Z; consecutive polygons are
 *   lofted into a closed mesh.
 */

export interface SolidMeshOptions {
  /** Segments around the axis of revolution (phi resolution). */
  radialSegments?: number;
  /** Sampling budget along t, distributed across pieces by piece length. */
  maxTotalSamples?: number;
}

const DEFAULT_RADIAL_SEGMENTS = 48;
const DEFAULT_MAX_TOTAL_SAMPLES = 4000;
const MIN_SAMPLES_PER_PIECE = 6;
const MAX_SAMPLES_PER_PIECE = 220;
const SEMICIRCLE_SEGMENTS = 16;

function isFiniteNum(x: number): boolean {
  return Number.isFinite(x);
}

function boundaryFn(
  spec: SolidSpec,
  index: number | null,
  baseline: number,
): (t: number) => number {
  if (index === null) return () => baseline;
  const fn = spec.curves[index]?.fn;
  return fn ?? (() => baseline);
}

function baselineFor(spec: SolidSpec): number {
  return spec.method === 'disk-washer' ? (spec.axis?.value ?? 0) : 0;
}

function samplesForPiece(pieceLength: number, totalLength: number, totalBudget: number): number {
  if (
    !isFiniteNum(pieceLength) ||
    pieceLength <= 0 ||
    !isFiniteNum(totalLength) ||
    totalLength <= 0
  ) {
    return MIN_SAMPLES_PER_PIECE;
  }
  const raw = Math.round((pieceLength / totalLength) * totalBudget);
  return Math.max(MIN_SAMPLES_PER_PIECE, Math.min(MAX_SAMPLES_PER_PIECE, raw));
}

function isValidPiece(piece: SolidPiece): boolean {
  return isFiniteNum(piece.a) && isFiniteNum(piece.b) && piece.b > piece.a;
}

/** Builds one revolution piece (disk-washer or shell) as a world-space geometry, or null if degenerate. */
function buildRevolutionPiece(
  spec: SolidSpec,
  piece: SolidPiece,
  samples: number,
  radialSegments: number,
): BufferGeometry | null {
  const axis = spec.axis;
  if (!axis || !isValidPiece(piece)) return null;

  const k = axis.value;
  const baseline = baselineFor(spec);
  const upperFn = boundaryFn(spec, piece.upperIndex, baseline);
  const lowerFn = boundaryFn(spec, piece.lowerIndex, baseline);
  const isShell = spec.method === 'shell';

  const toPoint = (t: number, value: number): Vector2 | null => {
    const r = isShell ? Math.abs(t - k) : Math.abs(value - k);
    const h = isShell ? value : t;
    if (!isFiniteNum(r) || !isFiniteNum(h)) return null;
    return new Vector2(r, h);
  };

  const n = Math.max(2, samples);
  const dt = (piece.b - piece.a) / n;
  const points: Vector2[] = [];

  for (let i = 0; i <= n; i++) {
    const t = piece.a + i * dt;
    const p = toPoint(t, upperFn(t));
    if (p) points.push(p);
  }
  for (let i = n; i >= 0; i--) {
    const t = piece.a + i * dt;
    const p = toPoint(t, lowerFn(t));
    if (p) points.push(p);
  }
  if (points.length < 3) return null;
  // close the profile loop so the revolved surface is watertight
  points.push(points[0].clone());

  const geometry = new LatheGeometry(points, Math.max(3, radialSegments));
  if (axis.orientation === 'horizontal') {
    geometry.rotateZ(-Math.PI / 2);
    geometry.translate(0, k, 0);
  } else {
    geometry.translate(k, 0, 0);
  }
  return geometry;
}

function toPlane(variable: IntegrationVariable, along: number, u: number, z: number): Vector3 {
  return variable === 'x' ? new Vector3(along, u, z) : new Vector3(u, along, z);
}

/** Builds the cross-section polygon standing on [lower, upper] at t, or null if degenerate. */
function crossSectionPolygon(
  variable: IntegrationVariable,
  t: number,
  lowerVal: number,
  upperVal: number,
  shape: CrossSectionShape,
  heightRatio: number | undefined,
): Vector3[] | null {
  if (!isFiniteNum(t) || !isFiniteNum(lowerVal) || !isFiniteNum(upperVal)) return null;
  const s = upperVal - lowerVal;
  if (!isFiniteNum(s) || s <= 0) return null;
  const mid = (lowerVal + upperVal) / 2;
  const p = (u: number, z: number) => toPlane(variable, t, u, z);

  switch (shape) {
    case 'square':
      return [p(lowerVal, 0), p(upperVal, 0), p(upperVal, s), p(lowerVal, s)];
    case 'rectangle': {
      const h = (heightRatio && heightRatio > 0 ? heightRatio : 1) * s;
      return [p(lowerVal, 0), p(upperVal, 0), p(upperVal, h), p(lowerVal, h)];
    }
    case 'equilateral-triangle': {
      const h = (Math.sqrt(3) / 2) * s;
      return [p(lowerVal, 0), p(upperVal, 0), p(mid, h)];
    }
    case 'right-isosceles-leg':
      return [p(lowerVal, 0), p(upperVal, 0), p(lowerVal, s)];
    case 'right-isosceles-hypotenuse':
      return [p(lowerVal, 0), p(upperVal, 0), p(mid, s / 2)];
    case 'semicircle': {
      const r = s / 2;
      const pts: Vector3[] = [p(lowerVal, 0)];
      for (let i = 1; i < SEMICIRCLE_SEGMENTS; i++) {
        const angle = Math.PI - (Math.PI * i) / SEMICIRCLE_SEGMENTS;
        pts.push(p(mid + r * Math.cos(angle), r * Math.sin(angle)));
      }
      pts.push(p(upperVal, 0));
      return pts;
    }
    default:
      return null;
  }
}

function buildCrossSectionPiece(
  spec: SolidSpec,
  piece: SolidPiece,
  samples: number,
): BufferGeometry | null {
  const shape = spec.shape;
  if (!shape || !isValidPiece(piece)) return null;

  const upperFn = boundaryFn(spec, piece.upperIndex, 0);
  const lowerFn = boundaryFn(spec, piece.lowerIndex, 0);
  const n = Math.max(2, samples);
  const dt = (piece.b - piece.a) / n;

  const profiles: Vector3[][] = [];
  let expectedCount: number | null = null;
  for (let i = 0; i <= n; i++) {
    const t = piece.a + i * dt;
    const poly = crossSectionPolygon(
      spec.variable,
      t,
      lowerFn(t),
      upperFn(t),
      shape,
      spec.heightRatio,
    );
    if (!poly) continue;
    if (expectedCount === null) expectedCount = poly.length;
    if (poly.length !== expectedCount) continue;
    profiles.push(poly);
  }
  if (profiles.length < 2) return null;
  return buildLoft(profiles);
}

/**
 * Builds a single piece's geometry (revolution or cross-section, dispatched by `spec.method`),
 * already positioned in world space. Exported so `slice-geometry.ts` can reuse it for the
 * representative slice by feeding a tiny synthetic piece.
 */
export function buildPieceGeometry(
  spec: SolidSpec,
  piece: SolidPiece,
  samples: number,
  radialSegments = DEFAULT_RADIAL_SEGMENTS,
): BufferGeometry | null {
  if (!isValidPiece(piece)) return null;
  return spec.method === 'cross-section'
    ? buildCrossSectionPiece(spec, piece, samples)
    : buildRevolutionPiece(spec, piece, samples, radialSegments);
}

/** Builds the full solid: one geometry per valid piece (degenerate/unsampleable pieces are skipped). */
export function buildSolidGeometry(
  spec: SolidSpec,
  pieces: SolidPiece[],
  opts: SolidMeshOptions = {},
): BufferGeometry[] {
  const radialSegments = opts.radialSegments ?? DEFAULT_RADIAL_SEGMENTS;
  const totalBudget = opts.maxTotalSamples ?? DEFAULT_MAX_TOTAL_SAMPLES;

  const validPieces = pieces.filter(isValidPiece);
  const totalLength = validPieces.reduce((sum, piece) => sum + (piece.b - piece.a), 0);

  const geometries: BufferGeometry[] = [];
  for (const piece of validPieces) {
    const samples = samplesForPiece(piece.b - piece.a, totalLength, totalBudget);
    const geometry = buildPieceGeometry(spec, piece, samples, radialSegments);
    if (geometry) geometries.push(geometry);
  }
  return geometries;
}
