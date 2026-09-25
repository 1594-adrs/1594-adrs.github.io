import { integrateAdaptive } from '../quadrature';
import { computePieces, sliceArea } from './solid-integrand';
import { buildTerms } from './solid-formula';
import { recognizeExact } from './solid-exact';
import { computeSurfaceArea } from './solid-surface';
import type { SolidIssue, SolidIssueCode, SolidResult, SolidSpec } from './solid.types';

export { computePieces, sliceArea } from './solid-integrand';
export { buildTerms } from './solid-formula';
export { recognizeExact } from './solid-exact';
export { computeSurfaceArea } from './solid-surface';
export type * from './solid.types';

/** Up to 4 significant figures, snapping a numerically-negligible value to '0' (an adaptive
 *  quadrature's reported "bad point" is often only accurate to within a fraction of the
 *  panel width it was found in, e.g. -1.862645149230957e-9 instead of exactly 0). */
function formatAt(at: number): string {
  if (Math.abs(at) < 1e-6) return '0';
  return String(Number(at.toPrecision(4)));
}

function issueMessage(
  code: 'divergent' | 'undefined-domain',
  variable: string,
  at?: number,
): string {
  const where =
    at !== undefined && Number.isFinite(at) ? ` near ${variable} = ${formatAt(at)}` : '';
  return code === 'divergent'
    ? `The integral diverges${where} (a non-integrable singularity).`
    : `The integrand is undefined${where} (outside its real domain).`;
}

/**
 * Computes a solid-of-revolution / cross-section volume from a structurally
 * valid SolidSpec: splits the domain into pieces, builds the closed-form
 * terms, and integrates each piece's slice-area function adaptively. Never
 * throws - any unexpected failure comes back as a null volume with an issue
 * instead. Input validation (missing axis/shape, bad bounds, ...) is not
 * this module's job; issues here are computation-time only, i.e. surfaced by
 * the quadrature itself (divergence, undefined domain).
 */
export function computeSolid(spec: SolidSpec): SolidResult {
  try {
    const pieces = computePieces(spec);

    // Defence in depth: with a structurally valid, non-empty curve selection this shouldn't
    // happen (computePieces always returns at least one piece), but a volume of 0 must never
    // come from summing zero pieces - that would silently hide a real computation failure.
    if (spec.curves.length > 0 && pieces.length === 0) {
      return {
        volume: null,
        errorEstimate: 0,
        exact: null,
        terms: [],
        pieces: [],
        sliceArea: () => NaN,
        issues: [
          {
            code: 'undefined-domain',
            severity: 'error',
            message: 'The solid could not be computed (no valid region).',
          },
        ],
        surfaceArea: null,
        surfaceExact: null,
      };
    }

    const area = sliceArea(spec, pieces);
    const terms = buildTerms(spec, pieces);

    let volume = 0;
    let errorEstimate = 0;
    const issues: SolidIssue[] = [];
    let failed = false;

    const axisValue = spec.axis?.value;

    for (const piece of pieces) {
      const breakpoints: number[] = [];
      if (axisValue !== undefined && axisValue > piece.a && axisValue < piece.b) {
        breakpoints.push(axisValue);
      }

      // A tighter-than-default tolerance: the stated accuracy requirement is
      // a loose ~1e-7 relative error, but recognizeExact needs the volume to
      // be accurate to ~1e-9 relative to reliably recognise closed forms
      // (e.g. an endpoint singularity like ln(x) converges slowly enough
      // that the 1e-8 default leaves too much slack for that).
      const result = integrateAdaptive(area, piece.a, piece.b, {
        tol: 1e-11,
        maxEvals: 20000,
        ...(breakpoints.length > 0 ? { breakpoints } : {}),
      });
      errorEstimate += result.error;
      volume += result.value;

      if (result.status !== 'ok') {
        failed = true;
        const code: SolidIssueCode =
          result.status === 'divergent' ? 'divergent' : 'undefined-domain';
        issues.push({
          code,
          severity: 'error',
          message: issueMessage(code, spec.variable, result.badPoint),
          at: result.badPoint,
        });
      }
    }

    const surfaceArea = failed ? null : computeSurfaceArea(spec, pieces);

    return {
      volume: failed ? null : volume,
      errorEstimate,
      exact: failed ? null : recognizeExact(volume),
      terms,
      pieces,
      sliceArea: area,
      issues,
      surfaceArea,
      surfaceExact: surfaceArea === null ? null : recognizeExact(surfaceArea),
    };
  } catch {
    return {
      volume: null,
      errorEstimate: 0,
      exact: null,
      terms: [],
      pieces: [],
      sliceArea: () => NaN,
      issues: [
        {
          code: 'undefined-domain',
          severity: 'error',
          message: 'The solid could not be computed (unexpected error).',
        },
      ],
      surfaceArea: null,
      surfaceExact: null,
    };
  }
}
