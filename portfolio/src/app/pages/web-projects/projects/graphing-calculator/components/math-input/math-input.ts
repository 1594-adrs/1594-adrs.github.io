import {
  ChangeDetectionStrategy,
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
  DestroyRef,
  ElementRef,
  afterNextRender,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import type { MathfieldElement } from 'mathlive';
import { latexToRaw, rawToLatex } from '../../engine/latex-bridge/latex-bridge';
import { SAFE_INLINE_SHORTCUTS } from '../../keyboard/math-keyboard-layout';
import { loadMathlive, setMathKeyboardKind } from './mathlive-loader';

/** Keys that end a typed exponent (`x^10+1`): with smartSuperscript off, MathLive keeps them inside. */
const EXPONENT_TERMINATORS = new Set(['+', '-', '*', '/', '=', '<', '>', ',']);

/** Caret sits directly in a non-empty superscript. Uses MathLive's model (no public API for it). */
function inNonEmptySuperscript(mf: MathfieldElement): boolean {
  const model = (mf as unknown as { _mathfield?: { model?: { at(i: number): unknown } } })._mathfield
    ?.model;
  const atom = model?.at(mf.position) as { parentBranch?: unknown; type?: string } | undefined;
  return mf.selectionIsCollapsed && atom?.parentBranch === 'superscript' && atom.type !== 'first';
}

/** Placeholder is LaTeX in MathLive: wrap plain text safely. */
function placeholderLatex(text: string): string {
  return text ? `\\text{${text.replace(/[\\{}$&#%_^~]/g, ' ')}}` : '';
}

@Component({
  selector: 'app-math-input',
  templateUrl: './math-input.html',
  styleUrl: './math-input.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class MathInput {
  readonly value = input.required<string>();
  readonly kind = input<'expression' | 'limit'>('expression');
  readonly label = input.required<string>();
  readonly placeholder = input('');
  readonly invalid = input(false);
  readonly describedBy = input<string | null>(null);
  readonly inputId = input<string | null>(null);

  readonly valueChange = output<string>();
  readonly issuesChange = output<string[]>();
  readonly focused = output<void>();
  readonly blurred = output<void>();
  readonly keyDown = output<KeyboardEvent>();

  protected readonly mathReady = signal(false);

  private readonly mf = viewChild<ElementRef<MathfieldElement>>('mf');
  private readonly fallback = viewChild<ElementRef<HTMLInputElement>>('fallback');
  private readonly destroyRef = inject(DestroyRef);
  private lastRaw: string | null = null;
  private configured: MathfieldElement | null = null;
  private teardown: (() => void) | null = null;
  private destroyed = false;
  private pendingFocus = false;

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.destroyed = true;
      this.teardown?.();
    });

    afterNextRender(() => {
      void loadMathlive().then((ok) => {
        if (!ok || this.destroyed) return;
        this.pendingFocus = this.fallback()?.nativeElement === document.activeElement;
        this.mathReady.set(true);
      });
    });

    // Configure the <math-field> once it exists.
    effect(() => {
      const el = this.mf()?.nativeElement;
      if (!el || el === this.configured) return;
      untracked(() => this.configure(el));
    });

    // External value / placeholder changes.
    effect(() => {
      const el = this.mf()?.nativeElement;
      const raw = this.value();
      const ph = this.placeholder();
      if (!el) return;
      el.placeholder = placeholderLatex(ph);
      if (raw !== this.lastRaw) {
        this.lastRaw = raw;
        el.setValue(rawToLatex(raw), { silenceNotifications: true });
      }
    });
  }

  focus(): void {
    const mf = this.mf()?.nativeElement;
    if (mf) mf.focus();
    else this.fallback()?.nativeElement.focus();
  }

  protected onFallbackInput(event: Event): void {
    const raw = (event.target as HTMLInputElement).value;
    this.lastRaw = raw;
    this.valueChange.emit(raw);
    this.issuesChange.emit([]);
  }

  private configure(mf: MathfieldElement): void {
    this.teardown?.();
    this.configured = mf;
    mf.mathVirtualKeyboardPolicy = 'manual';
    mf.smartFence = true;
    mf.smartSuperscript = false; // digits stay in the exponent (`x^10`); operators leave it (onKey)
    mf.removeExtraneousParentheses = true;
    mf.menuItems = [];
    mf.inlineShortcuts = SAFE_INLINE_SHORTCUTS;
    mf.placeholder = placeholderLatex(this.placeholder());
    this.lastRaw = this.value();
    mf.setValue(rawToLatex(this.lastRaw), { silenceNotifications: true });

    const onInput = () => {
      const { raw, issues } = latexToRaw(mf.getValue('latex'));
      this.lastRaw = raw;
      this.valueChange.emit(raw);
      this.issuesChange.emit(issues);
    };
    const onFocus = () => {
      setMathKeyboardKind(this.kind());
      this.focused.emit();
    };
    const onBlur = () => this.blurred.emit();
    const onKey = (e: Event) => this.keyDown.emit(e as KeyboardEvent);
    const onExponentKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || !EXPONENT_TERMINATORS.has(e.key)) return;
      if (inNonEmptySuperscript(mf)) mf.executeCommand('moveAfterParent');
    };
    // Plain-text math (`sin(x)+cos(x)`, `x^(1/3)`) is not LaTeX: convert it with the raw bridge.
    const onPaste = (e: ClipboardEvent) => {
      const text = e.clipboardData?.getData('text/plain') ?? '';
      if (!text || text.includes('\\')) return;
      const latex = rawToLatex(text);
      if (!latex || latex.includes('\\mathrm{')) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      mf.insert(latex, { format: 'latex' });
      onInput();
    };

    mf.addEventListener('input', onInput);
    mf.addEventListener('focusin', onFocus);
    mf.addEventListener('focusout', onBlur);
    mf.addEventListener('keydown', onKey);
    mf.addEventListener('keydown', onExponentKey, true);
    mf.addEventListener('paste', onPaste, true);
    this.teardown = () => {
      mf.removeEventListener('input', onInput);
      mf.removeEventListener('focusin', onFocus);
      mf.removeEventListener('focusout', onBlur);
      mf.removeEventListener('keydown', onKey);
      mf.removeEventListener('keydown', onExponentKey, true);
      mf.removeEventListener('paste', onPaste, true);
    };

    if (this.pendingFocus) {
      this.pendingFocus = false;
      mf.focus();
    }
  }
}
