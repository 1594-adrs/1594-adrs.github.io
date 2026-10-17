import { TestBed } from '@angular/core/testing';
import { latexToRaw } from '../../engine/latex-bridge/latex-bridge';
import {
  EXPRESSION_LAYOUTS,
  LIMIT_LAYOUTS,
  SAFE_INLINE_SHORTCUTS,
} from '../../keyboard/math-keyboard-layout';
import { MathInput } from './math-input';
import { SEQUENCE_LAYOUTS } from './mathlive-loader';

/*
 * The loader is NOT mocked: `vi.mock('./mathlive-loader')` is rejected by the Angular unit-test
 * runner (relative paths are not allowed) and `vi.spyOn` on the ESM namespace fails with
 * "Cannot redefine property". The real loader resolves `false` without importing 'mathlive'
 * when `ResizeObserver` is missing, which is the native-fallback path tested below.
 */

type Inputs = Partial<{
  value: string;
  label: string;
  kind: 'expression' | 'limit';
  placeholder: string;
  invalid: boolean;
  describedBy: string | null;
  inputId: string | null;
}>;

function create(inputs: Inputs = {}) {
  const fixture = TestBed.createComponent(MathInput);
  const merged = { value: 'x^2', label: 'Function', ...inputs };
  for (const [name, value] of Object.entries(merged)) {
    fixture.componentRef.setInput(name, value);
  }
  fixture.detectChanges();
  return fixture;
}

/** Lets the afterNextRender loader promise settle, then renders the resulting template. */
async function mount(inputs: Inputs = {}) {
  const fixture = create(inputs);
  await fixture.whenStable();
  fixture.detectChanges();
  return fixture;
}

function nativeInput(fixture: { nativeElement: HTMLElement }): HTMLInputElement {
  return fixture.nativeElement.querySelector('input.fb') as HTMLInputElement;
}

describe('MathInput', () => {
  beforeEach(() => {
    vi.stubGlobal('ResizeObserver', undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('without MathLive (native fallback)', () => {
    it('renders a native input, not a math-field, and shows the value', async () => {
      const fixture = await mount({ value: 'x^2' });

      expect(nativeInput(fixture)).not.toBeNull();
      expect(fixture.nativeElement.querySelector('math-field')).toBeNull();
      expect(nativeInput(fixture).value).toBe('x^2');
    });

    it('emits the typed raw text and an empty issue list on input', async () => {
      const fixture = await mount();
      const onValue = vi.fn();
      const onIssues = vi.fn();
      fixture.componentInstance.valueChange.subscribe(onValue);
      fixture.componentInstance.issuesChange.subscribe(onIssues);

      const input = nativeInput(fixture);
      input.value = '2x+1';
      input.dispatchEvent(new Event('input'));

      expect(onValue).toHaveBeenCalledWith('2x+1');
      expect(onIssues).toHaveBeenCalledWith([]);
    });

    it('emits focused, blurred and keyDown from the native input', async () => {
      const fixture = await mount();
      const onFocus = vi.fn();
      const onBlur = vi.fn();
      const onKey = vi.fn();
      fixture.componentInstance.focused.subscribe(onFocus);
      fixture.componentInstance.blurred.subscribe(onBlur);
      fixture.componentInstance.keyDown.subscribe(onKey);

      const input = nativeInput(fixture);
      input.dispatchEvent(new Event('focus'));
      input.dispatchEvent(new Event('blur'));
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));

      expect(onFocus).toHaveBeenCalledTimes(1);
      expect(onBlur).toHaveBeenCalledTimes(1);
      expect(onKey).toHaveBeenCalledWith(expect.objectContaining({ key: 'Enter' }));
    });

    it('marks the input invalid with the invalid class and aria-invalid', async () => {
      const fixture = await mount({ invalid: true });

      const input = nativeInput(fixture);
      expect(input.classList.contains('invalid')).toBe(true);
      expect(input.getAttribute('aria-invalid')).toBe('true');
    });

    it('sets aria-label from the label input', async () => {
      const fixture = await mount({ label: 'Lower limit' });

      expect(nativeInput(fixture).getAttribute('aria-label')).toBe('Lower limit');
    });

    it('sets the id from the inputId input', async () => {
      const fixture = await mount({ inputId: 'fn-input' });

      expect(nativeInput(fixture).id).toBe('fn-input');
    });

    it('sets aria-describedby from the describedBy input', async () => {
      const fixture = await mount({ describedBy: 'fn-help' });

      expect(nativeInput(fixture).getAttribute('aria-describedby')).toBe('fn-help');
    });

    it('sets the placeholder attribute on the native input', async () => {
      const fixture = await mount({ placeholder: 'e.g. x^2' });

      expect(nativeInput(fixture).getAttribute('placeholder')).toBe('e.g. x^2');
    });
  });
  // The <math-field> branch is not covered here: the loader cannot be mocked under the Angular
  // unit-test runner and jsdom cannot run MathLive. It is verified in a real browser.
});

describe('math keyboard and inline shortcuts', () => {
  type Layers = { layers: { rows: unknown[][] }[] };
  const keyLatex = (layouts: typeof LIMIT_LAYOUTS) =>
    layouts.flatMap((l) =>
      (l as unknown as Layers).layers.flatMap((layer) =>
        layer.rows
          .flat()
          .map((k) => (typeof k === 'string' ? k : (k as { insert?: string }).insert)),
      ),
    );

  it('limit keyboard has an infinity key that the bridge reads as `inf`', () => {
    expect(keyLatex(LIMIT_LAYOUTS)).toContain('\\infty');
    expect(latexToRaw('\\infty').raw).toBe('inf');
    expect(latexToRaw('-\\infty').raw).toBe('-inf');
  });

  it('both keyboards reach an alphabetic layer', () => {
    for (const layouts of [EXPRESSION_LAYOUTS, LIMIT_LAYOUTS]) {
      const keys = keyLatex(layouts);
      for (const c of 'abcdefghijklmnopqrstuvwxyz') expect(keys).toContain(c);
    }
  });

  it('sequence keyboard swaps y for n on the variables layer only', () => {
    const vars = (layouts: typeof LIMIT_LAYOUTS) =>
      keyLatex(layouts.filter((l) => l.id === 'calc-variables'));
    expect(vars(SEQUENCE_LAYOUTS)).toContain('n');
    expect(vars(SEQUENCE_LAYOUTS)).not.toContain('y');
    expect(vars(EXPRESSION_LAYOUTS)).toContain('y');
    SEQUENCE_LAYOUTS.forEach((l, i) => {
      if (l.id !== 'calc-variables') expect(l).toBe(EXPRESSION_LAYOUTS[i]);
    });
    expect(latexToRaw('\\frac{1}{n^2}').raw).toBe('((1)/(n^2))');
  });

  it('every typed function name becomes that function call', () => {
    const names = [
      'abs',
      'floor',
      'ceil',
      'round',
      'sign',
      'min',
      'max',
      'mod',
      'root',
      'sinh',
      'ln',
    ];
    for (const name of names) {
      const latex = `${SAFE_INLINE_SHORTCUTS[name]}\\left(x\\right)`;
      expect(latexToRaw(latex).raw, name).toBe(`${name}(x)`);
    }
    for (const [typed, fn] of [
      ['asin', 'asin'],
      ['acos', 'acos'],
      ['atan', 'atan'],
    ]) {
      expect(latexToRaw(`${SAFE_INLINE_SHORTCUTS[typed]}\\left(x\\right)`).raw).toBe(`${fn}(x)`);
    }
  });
});
