import {
  EXPRESSION_LAYOUTS,
  LIMIT_LAYOUTS,
  MATH_KEYBOARD_THEME_CSS,
  type MathKeyboardKind,
} from '../../keyboard/math-keyboard-layout';

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
  loading ??= import('mathlive')
    .then((m) => {
      m.MathfieldElement.fontsDirectory = new URL('assets/mathlive/fonts', document.baseURI).href;
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
export function setMathKeyboardKind(kind: MathKeyboardKind): void {
  if (ready) {
    window.mathVirtualKeyboard.layouts = kind === 'limit' ? LIMIT_LAYOUTS : EXPRESSION_LAYOUTS;
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
