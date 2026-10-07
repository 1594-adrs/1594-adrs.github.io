import type { OverlapMode } from '../models/calculator.models';
import { FUNCTION_COLORS } from '../utils/color';
import type { CrossSectionShape, SolidMethod } from '../engine/solids/solid.types';

/** Current on-the-wire share format. Bumping this invalidates old links, which are then
 *  ignored (not partially restored). */
export const SHARE_STATE_VERSION = 1;

interface ShareFunction {
  raw: string;
  color: string;
  visible: boolean;
}

interface ShareViewport {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
}

interface ShareIntegralTool {
  fnIndex: number;
  a: number;
  b: number;
}

interface ShareAreaTool {
  functionIndices: number[];
  a: number;
  b: number;
  overlapMode: OverlapMode;
}

interface ShareSolidTool {
  method: SolidMethod;
  curveIndices: number[];
  a: string;
  b: string;
  axisValue: string;
  shape: CrossSectionShape;
  heightRatio: string;
}

interface ShareTool {
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

const MAX_FUNCTIONS = 5;
const MAX_RAW_LENGTH = 500;
const MAX_VIEWPORT_ABS = 1e9;
const MIN_RELATIVE_WIDTH = 1e-9;
const MAX_TOOL_BOUND = 1e6;
const MAX_BOUND_TEXT_LENGTH = 100;
const MAX_CURVES = 5;
const COLOR_RE = /^#[0-9a-fA-F]{6}$/;
const METHODS: readonly string[] = ['disk-washer', 'shell', 'cross-section'];
const SHAPES: readonly string[] = [
  'square',
  'rectangle',
  'equilateral-triangle',
  'right-isosceles-leg',
  'right-isosceles-hypotenuse',
  'semicircle',
];
const OVERLAP_MODES: readonly string[] = ['pairwise', 'all'];

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

/** Returns a sanitized function row, or null when the shape is wrong or `raw` is too long.
 *  An invalid `color` is replaced by the palette color for its slot. */
function sanitizeFunction(f: unknown, index: number): ShareFunction | null {
  if (!isRecord(f)) return null;
  const { raw, color, visible } = f;
  if (typeof raw !== 'string' || raw.length > MAX_RAW_LENGTH) return null;
  if (typeof visible !== 'boolean') return null;
  const safeColor =
    typeof color === 'string' && COLOR_RE.test(color)
      ? color
      : FUNCTION_COLORS[index % FUNCTION_COLORS.length];
  return { raw, color: safeColor, visible };
}

function isValidViewport(v: unknown): v is ShareViewport {
  if (!isRecord(v)) return false;
  const { xMin, xMax, yMin, yMax } = v;
  if (!isFiniteNumber(xMin) || !isFiniteNumber(xMax)) return false;
  if (!isFiniteNumber(yMin) || !isFiniteNumber(yMax)) return false;
  const validAxis = (lo: number, hi: number): boolean => {
    if (lo >= hi) return false;
    if (Math.abs(lo) > MAX_VIEWPORT_ABS || Math.abs(hi) > MAX_VIEWPORT_ABS) return false;
    const magnitude = Math.max(Math.abs(lo), Math.abs(hi));
    return hi - lo >= magnitude * MIN_RELATIVE_WIDTH;
  };
  return validAxis(xMin, xMax) && validAxis(yMin, yMax);
}

function isBoundNumber(v: unknown): v is number {
  return isFiniteNumber(v) && Math.abs(v) <= MAX_TOOL_BOUND;
}

function isBoundText(v: unknown): v is string {
  return typeof v === 'string' && v.length <= MAX_BOUND_TEXT_LENGTH;
}

function isIndexArray(v: unknown, min: number, max: number): v is number[] {
  if (!Array.isArray(v) || v.length < min || v.length > max) return false;
  const seen = new Set<number>();
  for (const i of v) {
    if (!Number.isInteger(i) || i < 0 || i >= MAX_CURVES || seen.has(i)) return false;
    seen.add(i);
  }
  return true;
}

function sanitizeIntegral(t: unknown): ShareIntegralTool | null {
  if (!isRecord(t)) return null;
  const { fnIndex, a, b } = t;
  if (!Number.isInteger(fnIndex) || (fnIndex as number) < 0 || (fnIndex as number) >= MAX_CURVES) {
    return null;
  }
  if (!isBoundNumber(a) || !isBoundNumber(b)) return null;
  return { fnIndex: fnIndex as number, a, b };
}

function sanitizeArea(t: unknown): ShareAreaTool | null {
  if (!isRecord(t)) return null;
  const { functionIndices, a, b, overlapMode } = t;
  if (!isIndexArray(functionIndices, 1, MAX_CURVES)) return null;
  if (!isBoundNumber(a) || !isBoundNumber(b)) return null;
  if (typeof overlapMode !== 'string' || !OVERLAP_MODES.includes(overlapMode)) return null;
  return { functionIndices, a, b, overlapMode: overlapMode as OverlapMode };
}

function sanitizeSolid(t: unknown): ShareSolidTool | null {
  if (!isRecord(t)) return null;
  const { method, curveIndices, a, b, axisValue, shape, heightRatio } = t;
  if (typeof method !== 'string' || !METHODS.includes(method)) return null;
  if (typeof shape !== 'string' || !SHAPES.includes(shape)) return null;
  if (!isIndexArray(curveIndices, 0, MAX_CURVES)) return null;
  if (!isBoundText(a) || !isBoundText(b) || !isBoundText(axisValue) || !isBoundText(heightRatio)) {
    return null;
  }
  return {
    method: method as SolidMethod,
    curveIndices,
    a,
    b,
    axisValue,
    shape: shape as CrossSectionShape,
    heightRatio,
  };
}

/** Returns a tool whose body is validated; an invalid body is dropped (active -> null)
 *  rather than failing the whole link. Null only when the envelope itself is malformed. */
function sanitizeTool(t: unknown): ShareTool | null {
  if (!isRecord(t)) return null;
  const active = t['active'];
  if (active !== null && active !== 'integral' && active !== 'solid' && active !== 'area') {
    return null;
  }
  const tool: ShareTool = { active };
  if (active === 'integral') {
    const integral = sanitizeIntegral(t['integral']);
    if (integral) tool.integral = integral;
    else tool.active = null;
  } else if (active === 'area') {
    const area = sanitizeArea(t['area']);
    if (area) tool.area = area;
    else tool.active = null;
  } else if (active === 'solid') {
    const solid = sanitizeSolid(t['solid']);
    if (solid) tool.solid = solid;
    else tool.active = null;
  }
  return tool;
}

/** Strictly validates and sanitizes the decoded object and its version. Returns a freshly
 *  built state (unknown fields dropped), or null on any parse or validation failure, so a
 *  bad/foreign link is ignored rather than partially applied. A malformed tool body only
 *  drops the tool. */
export function parseShareState(encoded: string): ShareState | null {
  try {
    const json = fromBase64Url(encoded);
    const parsed: unknown = JSON.parse(json);
    if (!isRecord(parsed)) return null;
    if (parsed['v'] !== SHARE_STATE_VERSION) return null;
    const rawFunctions = parsed['functions'];
    if (!Array.isArray(rawFunctions) || rawFunctions.length > MAX_FUNCTIONS) return null;
    const functions: ShareFunction[] = [];
    for (let i = 0; i < rawFunctions.length; i++) {
      const fn = sanitizeFunction(rawFunctions[i], i);
      if (!fn) return null;
      functions.push(fn);
    }
    const viewport = parsed['viewport'];
    if (!isValidViewport(viewport)) return null;
    const tool = sanitizeTool(parsed['tool']);
    if (!tool) return null;
    return {
      v: SHARE_STATE_VERSION,
      functions,
      viewport: {
        xMin: viewport.xMin,
        xMax: viewport.xMax,
        yMin: viewport.yMin,
        yMax: viewport.yMax,
      },
      tool,
    };
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
