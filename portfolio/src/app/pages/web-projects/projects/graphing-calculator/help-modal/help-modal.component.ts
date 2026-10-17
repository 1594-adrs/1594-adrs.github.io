import {
  Component,
  ChangeDetectionStrategy,
  output,
  ElementRef,
  inject,
  AfterViewInit,
  viewChild,
} from '@angular/core';

@Component({
  selector: 'app-help-modal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(document:keydown.escape)': 'onEscapeKey()',
    '(document:keydown.tab)': 'onTabKey($event)',
  },
  template: `
    <div
      class="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      (click)="close.emit()"
    >
      <div
        class="modal-content"
        aria-labelledby="modal-title"
        (click)="$event.stopPropagation()"
        #modalContent
      >
        <button class="modal-close" (click)="close.emit()" aria-label="Close help" autofocus>
          &times;
        </button>
        <h2 class="modal-title" id="modal-title">&gt; help</h2>

        <div class="help-section">
          <h3>KEYBOARD SHORTCUTS (canvas)</h3>
          <div class="help-grid">
            <span class="key-hint">+/-</span><span>Zoom in/out</span>
            <span class="key-hint">←→↑↓</span><span>Pan view</span> <span class="key-hint">R</span
            ><span>Reset view</span> <span class="key-hint">P</span
            ><span>Cycle points of interest</span> <span class="key-hint">T</span
            ><span>Tangent line at the trace point</span> <span class="key-hint">N</span
            ><span>Normal line at the trace point</span>
          </div>
          <p class="help-note">
            Hover a curve to trace it. The tangent and normal buttons next to the canvas do the same
            as T and N, and are disabled when no visible curve supports them (implicit curves do
            not).
          </p>
        </div>

        <div class="help-section">
          <h3>TOUCH (canvas)</h3>
          <div class="help-grid">
            <span class="key-hint">Hold</span><span>Trace the nearest curve</span>
            <span class="key-hint">Drag</span><span>Pan the graph</span>
            <span class="key-hint">Pinch</span><span>Zoom in/out</span>
          </div>
          <p class="help-note">
            The traced point (and its tangent) stays after you lift the finger. Tap elsewhere to
            move it, or switch the tangent off to clear it.
          </p>
        </div>

        <div class="help-section">
          <h3>DERIVATIVE f′</h3>
          <p class="help-note">
            The f′ button on a y = f(x) row plots its symbolic derivative as a dashed curve and
            shows the formula under the row. Trig functions need RAD mode; other row types show the
            reason when you tap the button.
          </p>
        </div>

        <div class="help-section">
          <h3>CALCULUS TAB</h3>
          <div class="help-grid">
            <span class="key-hint">Limit</span><span>Numeric limit of a y = f(x) row</span>
            <span class="key-hint">side</span
            ><span>Both sides, from the left or from the right</span>
            <span class="key-hint">inf, -inf</span><span>Limits at ±infinity (also ∞)</span>
            <span class="key-hint">Newton</span
            ><span>Iterates from x₀; "steps" empty runs until convergence</span>
          </div>
          <p class="help-note">
            Limits accept pi/2, -3, e^2. "Does not exist" says whether f is undefined there or which
            one-sided limit fails. Newton steps: whole number from 1 to 50.
          </p>
        </div>

        <div class="help-section">
          <h3>FUNCTION INPUT</h3>
          <div class="help-grid">
            <span class="key-hint">x</span><span>Variable</span> <span class="key-hint">pi, π</span
            ><span>Pi constant (3.14159...)</span> <span class="key-hint">e</span
            ><span>Euler's number (2.71828...)</span> <span class="key-hint">sin/cos/tan</span
            ><span>Trigonometric functions</span> <span class="key-hint">asin/acos/atan</span
            ><span>Inverse trig</span> <span class="key-hint">sec/csc/cot</span
            ><span>Reciprocal trig</span> <span class="key-hint">sinh/cosh/tanh</span
            ><span>Hyperbolic</span> <span class="key-hint">asinh/acosh/atanh</span
            ><span>Inverse hyperbolic</span> <span class="key-hint">sech/csch/coth</span
            ><span>Reciprocal hyperbolic</span> <span class="key-hint">cbrt</span
            ><span>Cube root</span> <span class="key-hint">log</span><span>Logarithm base 10</span>
            <span class="key-hint">ln</span><span>Natural logarithm</span>
            <span class="key-hint">sqrt</span><span>Square root</span>
            <span class="key-hint">abs</span><span>Absolute value</span>
            <span class="key-hint">floor/ceil/round</span><span>Rounding</span>
            <span class="key-hint">sign</span><span>Sign function</span>
            <span class="key-hint">min/max</span><span>Minimum/Maximum (2 args)</span>
            <span class="key-hint">mod</span><span>Modulo (2 args)</span>
            <span class="key-hint">^</span><span>Power (e.g. x^2)</span>
            <span class="key-hint">()</span><span>Grouping</span>
          </div>
          <p class="help-note">
            x = g(y): switch a row's mode to "x" to plot a curve as x in terms of y (e.g. x=y^2);
            integral/area/solid tools don't support these rows yet.
          </p>
        </div>

        <div class="help-section">
          <h3>TOOLS</h3>
          <div class="help-grid">
            <span class="key-hint">∫ integral</span><span>Compute definite integral</span>
            <span class="key-hint">↻ solid_rev_nfn</span
            ><span>Solid of revolution (1+ functions, manual limits)</span>
            <span class="key-hint">▲ area_nfn</span
            ><span>Area between n curves (manual limits)</span>
          </div>
          <p class="help-note">Limits accept expressions: pi, e/2, sqrt(2), 2*pi</p>
          <p class="help-note">solid_rev_nfn: 1 function → disc method; 2+ → washer method</p>
          <p class="help-note">
            overlap mode: "only where ALL overlap" excludes crossings of non-selected functions
          </p>
        </div>

        <div class="help-section">
          <h3>3D VIEW (Solids)</h3>
          <div class="help-grid">
            <span class="key-hint">Left drag</span><span>Rotate</span>
            <span class="key-hint">Scroll</span><span>Zoom</span>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .modal-backdrop {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.7);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
      }
      .modal-content {
        background: var(--color-bg-card, #0a0a0f);
        border: 1px solid var(--color-border, #333355);
        max-width: 500px;
        width: 90%;
        max-height: 80vh;
        overflow-y: auto;
        padding: 1.5rem;
        position: relative;
        font-family: var(--font-family, monospace);
      }
      .modal-close {
        position: absolute;
        top: 0.5rem;
        right: 0.8rem;
        background: none;
        border: none;
        color: var(--color-text-muted, #666680);
        font-size: 1.2rem;
        cursor: pointer;
      }
      .modal-close:hover {
        color: var(--color-text, #ffffff);
      }
      .modal-close:focus-visible {
        outline: 2px solid var(--color-primary, #00ff88);
        outline-offset: 2px;
      }
      .modal-title {
        font-family: var(--font-family-display, monospace);
        font-size: var(--font-size-sm, 0.8rem);
        color: var(--color-primary, #00ff88);
        letter-spacing: var(--letter-spacing-terminal, 0.05em);
        margin-bottom: 1rem;
      }
      .help-section {
        margin-bottom: 1rem;
      }
      .help-section h3 {
        font-size: 0.65rem;
        color: var(--color-text-muted, #666680);
        letter-spacing: var(--letter-spacing-terminal, 0.05em);
        margin-bottom: 0.5rem;
        text-transform: uppercase;
      }
      .help-grid {
        display: grid;
        grid-template-columns: auto 1fr;
        gap: 0.3rem 1rem;
        font-size: 0.7rem;
      }
      .key-hint {
        color: var(--color-primary, #00ff88);
        font-family: var(--font-family-display, monospace);
      }
      .help-note {
        font-size: 0.65rem;
        color: var(--color-text-muted, #666680);
        margin-top: 0.5rem;
        font-style: italic;
      }
    `,
  ],
})
export class HelpModalComponent implements AfterViewInit {
  close = output<void>();

  private modalContent = viewChild<ElementRef<HTMLElement>>('modalContent');
  private el = inject(ElementRef);

  ngAfterViewInit(): void {
    const modal = this.modalContent()?.nativeElement;
    if (modal) {
      const closeBtn = modal.querySelector('.modal-close') as HTMLElement | null;
      closeBtn?.focus();
    }
  }

  onEscapeKey(): void {
    this.close.emit();
  }

  onTabKey(event: Event): void {
    const keyboardEvent = event as KeyboardEvent;
    const modal = this.el.nativeElement.querySelector('.modal-content') as HTMLElement | null;
    if (!modal) return;
    const focusable = modal.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (keyboardEvent.shiftKey) {
      if (document.activeElement === first) {
        keyboardEvent.preventDefault();
        last.focus();
      }
    } else {
      if (document.activeElement === last) {
        keyboardEvent.preventDefault();
        first.focus();
      }
    }
  }
}
