import type { VirtualKeyboardLayer, VirtualKeyboardLayout } from 'mathlive';
import {
  EXPRESSION_LAYOUTS,
  LIMIT_LAYOUTS,
  MATH_KEYBOARD_THEME_CSS,
  type MathKeyboardKind,
} from '../../keyboard/math-keyboard-layout';

/** Field kinds the loader knows: the shared keyboard kinds plus `sequence` (terms aₙ in n). */
export type MathFieldKind = MathKeyboardKind | 'sequence';

/** The expression keyboard with `n` in place of `y` on the variables layer, for sequence terms. */
export const SEQUENCE_LAYOUTS: VirtualKeyboardLayout[] = EXPRESSION_LAYOUTS.map((l) => {
  if (l.id !== 'calc-variables' || !('layers' in l)) return l;
  const layers = l.layers.map((layer) =>
    typeof layer === 'string'
      ? layer
      : ({
          ...layer,
          rows: layer.rows?.map((row) => row.map((k) => (k === 'y' ? 'n' : k))),
        } satisfies VirtualKeyboardLayer),
  );
  return { ...l, label: 'n x', tooltip: 'Index n, variables and constants', layers };
});

let loading: Promise<boolean> | null = null;
let ready = false;

function supported(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof document !== 'undefined' &&
    typeof ResizeObserver !== 'undefined' &&
    typeof customElements !== 'undefined'
  );
}

function injectTheme(): void {
  if (document.getElementById('math-keyboard-theme')) return;
  const style = document.createElement('style');
  style.id = 'math-keyboard-theme';
  style.textContent = MATH_KEYBOARD_THEME_CSS;
  document.head.appendChild(style);
}

/** Loads MathLive once (browser only). Resolves `false`, never rejects, when unavailable. */
export function loadMathlive(): Promise<boolean> {
  if (!supported()) return Promise.resolve(false);
  // MathLive's own font loader fetches all 20 KaTeX faces up front (~300 kB); this flag turns
  // it off, and the @font-face rules in math-input.css let the browser fetch only those used.
  document.documentElement.style.setProperty('--ML__static-fonts', '1');
  loading ??= import('mathlive')
    .then((m) => {
      m.MathfieldElement.soundsDirectory = null;
      injectTheme();
      window.mathVirtualKeyboard.layouts = EXPRESSION_LAYOUTS;
      ready = true;
      return true;
    })
    .catch(() => false);
  return loading;
}

export function isMathliveReady(): boolean {
  return ready;
}

export function showMathKeyboard(): void {
  if (ready) window.mathVirtualKeyboard.show({ animate: false });
}

export function hideMathKeyboard(): void {
  if (ready) window.mathVirtualKeyboard.hide({ animate: false });
}

/** Switches the global keyboard layout for the focused field's kind. */
export function setMathKeyboardKind(kind: MathFieldKind): void {
  if (ready) {
    window.mathVirtualKeyboard.layouts =
      kind === 'limit'
        ? LIMIT_LAYOUTS
        : kind === 'sequence'
          ? SEQUENCE_LAYOUTS
          : EXPRESSION_LAYOUTS;
  }
}

/** Subscribes to the global keyboard being shown/hidden (e.g. via its own close key). Returns an unsubscribe. */
export function onMathKeyboardVisibility(cb: (visible: boolean) => void): () => void {
  if (!ready) return () => undefined;
  const kb = window.mathVirtualKeyboard;
  const handler = () => cb(kb.visible);
  kb.addEventListener('virtual-keyboard-toggle', handler);
  return () => kb.removeEventListener('virtual-keyboard-toggle', handler);
}

/** Reports the on-screen height (px) the keyboard occupies, 0 while hidden, so the layout can
 *  reserve room instead of letting it cover the field being edited. Returns an unsubscribe. */
export function onMathKeyboardGeometry(cb: (height: number) => void): () => void {
  if (!ready) return () => undefined;
  const kb = window.mathVirtualKeyboard;
  const handler = () => cb(kb.visible ? Math.ceil(kb.boundingRect.height) : 0);
  kb.addEventListener('geometrychange', handler);
  kb.addEventListener('virtual-keyboard-toggle', handler);
  return () => {
    kb.removeEventListener('geometrychange', handler);
    kb.removeEventListener('virtual-keyboard-toggle', handler);
  };
}
