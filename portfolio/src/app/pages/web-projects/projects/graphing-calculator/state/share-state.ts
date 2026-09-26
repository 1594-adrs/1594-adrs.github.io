import type { OverlapMode } from '../models/calculator.models';
import type { CrossSectionShape, SolidMethod } from '../engine/solids/solid.types';

/** Current on-the-wire share format. Bumping this invalidates old links, which are then
 *  ignored (not partially restored). */
export const SHARE_STATE_VERSION = 1;

export interface ShareFunction {
  raw: string;
  color: string;
  visible: boolean;
}

export interface ShareViewport {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
}

export interface ShareIntegralTool {
  fnIndex: number;
  a: number;
  b: number;
}

export interface ShareAreaTool {
  functionIndices: number[];
  a: number;
  b: number;
  overlapMode: OverlapMode;
}

export interface ShareSolidTool {
  method: SolidMethod;
  curveIndices: number[];
  a: string;
  b: string;
  axisValue: string;
  shape: CrossSectionShape;
  heightRatio: string;
}

export interface ShareTool {
  active: 'integral' | 'solid' | 'area' | null;
  integral?: ShareIntegralTool;
  area?: ShareAreaTool;
  solid?: ShareSolidTool;
}

export interface ShareState {
  v: number;
  functions: ShareFunction[];
  viewport: ShareViewport;
  tool: ShareTool;
}

function toBase64Url(json: string): string {
  const bytes = new TextEncoder().encode(json);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(encoded: string): string {
  const b64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
  const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

/** Serializes app state to a base64url string suitable for `location.hash` (without the
 *  leading `#s=`). Never throws. */
export function serializeShareState(state: ShareState): string {
  return toBase64Url(JSON.stringify(state));
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

function isValidShareFunction(f: unknown): f is ShareFunction {
  if (!f || typeof f !== 'object') return false;
  const rec = f as Record<string, unknown>;
  return (
    typeof rec['raw'] === 'string' &&
    typeof rec['color'] === 'string' &&
    typeof rec['visible'] === 'boolean'
  );
}

function isValidViewport(v: unknown): v is ShareViewport {
  if (!v || typeof v !== 'object') return false;
  const rec = v as Record<string, unknown>;
  return (
    isFiniteNumber(rec['xMin']) &&
    isFiniteNumber(rec['xMax']) &&
    isFiniteNumber(rec['yMin']) &&
    isFiniteNumber(rec['yMax'])
  );
}

function isValidTool(t: unknown): t is ShareTool {
  if (!t || typeof t !== 'object') return false;
  const rec = t as Record<string, unknown>;
  const active = rec['active'];
  if (active !== null && active !== 'integral' && active !== 'solid' && active !== 'area') {
    return false;
  }
  return true;
}

/** Validates the decoded object's shape (not deep-validating every optional tool field) and
 *  its version. Returns null on any parse or validation failure, so a bad/foreign link is
 *  ignored rather than partially applied. */
export function parseShareState(encoded: string): ShareState | null {
  try {
    const json = fromBase64Url(encoded);
    const parsed: unknown = JSON.parse(json);
    if (!parsed || typeof parsed !== 'object') return null;
    const rec = parsed as Record<string, unknown>;
    if (rec['v'] !== SHARE_STATE_VERSION) return null;
    if (!Array.isArray(rec['functions']) || !rec['functions'].every(isValidShareFunction)) {
      return null;
    }
    if (!isValidViewport(rec['viewport'])) return null;
    if (!isValidTool(rec['tool'])) return null;
    return rec as unknown as ShareState;
  } catch {
    return null;
  }
}

/** Builds the `#s=...` hash fragment (including the leading `#`) for `state`. */
export function buildShareHash(state: ShareState): string {
  return `#s=${serializeShareState(state)}`;
}

/** Extracts the encoded payload from a `location.hash`-shaped string, or null if it doesn't
 *  contain a `#s=` share fragment. */
export function extractShareFragment(hash: string): string | null {
  const match = /#s=([^&]+)/.exec(hash);
  return match ? match[1] : null;
}
