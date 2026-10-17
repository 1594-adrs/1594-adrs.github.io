import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { GraphingCalculatorComponent } from './graphing-calculator.component';
import { evalExpression } from './engine/evaluator';
import { buildShareHash, extractShareFragment, parseShareState } from './state/share-state';
import { MAX_CURVE_ROWS, MAX_SLIDER_ROWS } from './models/calculator.models';
import { FUNCTION_COLORS } from './utils/color';

describe('GraphingCalculatorComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GraphingCalculatorComponent],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  afterEach(() => {
    window.location.hash = '';
  });

  it('restores functions/viewport from an initial #s= share hash on load', () => {
    window.location.hash = buildShareHash({
      v: 1,
      functions: [{ raw: 'x^2-1', color: '#ff6b35', visible: true }],
      viewport: { xMin: -5, xMax: 5, yMin: -5, yMax: 5 },
      tool: { active: null },
    });

    const fixture = TestBed.createComponent(GraphingCalculatorComponent);
    fixture.detectChanges();
    const comp = fixture.componentInstance;

    expect(comp.functions().length).toBe(1);
    expect(comp.functions()[0].raw).toBe('x^2-1');
    expect(comp.functions()[0].color).toBe('#ff6b35');
    // The shared region is fully visible (widened to keep x/y units equal on this
    // canvas's aspect ratio), centred where the sharer left it.
    const v = comp.viewport;
    expect(v.xMin).toBeLessThanOrEqual(-5);
    expect(v.xMax).toBeGreaterThanOrEqual(5);
    expect(v.yMin).toBeLessThanOrEqual(-5);
    expect(v.yMax).toBeGreaterThanOrEqual(5);
    expect((v.xMin + v.xMax) / 2).toBeCloseTo(0, 9);
    expect(Math.min(v.xMax - v.xMin, v.yMax - v.yMin)).toBeCloseTo(10, 9);
    // The fragment is applied once and dropped from the URL.
    expect(window.location.hash).toBe('');
  });

  it('ignores an invalid initial #s= share hash and shows a non-blocking notice', () => {
    window.location.hash = '#s=not-valid-base64!!!';

    const fixture = TestBed.createComponent(GraphingCalculatorComponent);
    fixture.detectChanges();
    const comp = fixture.componentInstance;

    expect(comp.functions().length).toBe(1);
    expect(comp.functions()[0].raw).toBe('sin(x)');
    expect(comp.shareNotice()).toContain('Ignored an invalid share link');
  });

  it('ignores a crafted link with a 1e16 viewport and keeps the default state', () => {
    window.location.hash = buildShareHash({
      v: 1,
      functions: [{ raw: 'x', color: '#ff6b35', visible: true }],
      viewport: { xMin: 1e16, xMax: 1e16 + 4, yMin: -1, yMax: 1 },
      tool: { active: null },
    });
    const fixture = TestBed.createComponent(GraphingCalculatorComponent);
    fixture.detectChanges();
    const comp = fixture.componentInstance;
    expect(comp.functions()[0].raw).toBe('sin(x)');
    expect(comp.viewport.xMax).toBeLessThan(1e3);
    expect(comp.shareNotice()).toContain('Ignored an invalid share link');
    expect(window.location.hash).toBe('');
  });

  it('drops a malformed solid tool but still restores functions and binds the app', () => {
    window.location.hash = buildShareHash({
      v: 1,
      functions: [{ raw: 'x^2', color: 'url(https://evil/x.gif)', visible: true }],
      viewport: { xMin: -5, xMax: 5, yMin: -5, yMax: 5 },
      tool: {
        active: 'solid',
        solid: { method: 'shell', curveIndices: 'nope', a: 1 },
      },
    } as never);
    const fixture = TestBed.createComponent(GraphingCalculatorComponent);
    fixture.detectChanges();
    const comp = fixture.componentInstance;
    expect(comp.functions()[0].raw).toBe('x^2');
    expect(comp.functions()[0].color).toBe('#00ff88');
    expect(comp.showSolidTool()).toBe(false);
    expect(window.location.hash).toBe('');
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(GraphingCalculatorComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should have one default function', () => {
    const fixture = TestBed.createComponent(GraphingCalculatorComponent);
    expect(fixture.componentInstance.functions().length).toBe(1);
  });

  it('should add a function', () => {
    const fixture = TestBed.createComponent(GraphingCalculatorComponent);
    const comp = fixture.componentInstance;
    comp.addFunction();
    expect(comp.functions().length).toBe(2);
  });

  it('caps curve rows at 10; slider rows do not count and have their own cap of 10', () => {
    const fixture = TestBed.createComponent(GraphingCalculatorComponent);
    const comp = fixture.componentInstance;
    for (let i = 0; i < 12; i++) comp.addFunction();
    expect(comp.functions().length).toBe(MAX_CURVE_ROWS);
    // Turning a row into a slider frees a curve slot.
    comp.updateExpression(1, 'a = 1');
    expect(comp.functions()[1].mode).toBe('slider');
    comp.addFunction();
    expect(comp.functions().length).toBe(MAX_CURVE_ROWS + 1);
    comp.addFunction();
    expect(comp.functions().length).toBe(MAX_CURVE_ROWS + 1);
    // Slider chips ignore the curve cap and stop at the slider cap.
    const names = 'bcdefghijk';
    for (const n of names) comp.paramSliders.addSlider(n);
    const sliders = comp.functions().filter((f) => f.mode === 'slider').length;
    expect(sliders).toBe(MAX_SLIDER_ROWS);
    expect(comp.paramSliders.addSlider('z')).toBe(false);
  });

  it('assigns palette colours 6-10 to new rows', () => {
    const comp = TestBed.createComponent(GraphingCalculatorComponent).componentInstance;
    for (let i = 0; i < 9; i++) comp.addFunction();
    expect(comp.functions().map((f) => f.color)).toEqual(FUNCTION_COLORS);
    expect(new Set(FUNCTION_COLORS).size).toBe(10);
  });

  it('should remove a function', () => {
    const fixture = TestBed.createComponent(GraphingCalculatorComponent);
    const comp = fixture.componentInstance;
    comp.addFunction();
    expect(comp.functions().length).toBe(2);
    comp.removeFunction(0);
    expect(comp.functions().length).toBe(1);
  });

  it('should toggle visibility', () => {
    const fixture = TestBed.createComponent(GraphingCalculatorComponent);
    const comp = fixture.componentInstance;
    expect(comp.functions()[0].visible).toBe(true);
    comp.toggleVisibility(0);
    expect(comp.functions()[0].visible).toBe(false);
  });

  it('should activate integral mode', () => {
    const fixture = TestBed.createComponent(GraphingCalculatorComponent);
    const comp = fixture.componentInstance;
    expect(comp.activeIntegral()).toBeNull();
    comp.activateIntegral();
    expect(comp.activeIntegral()).not.toBeNull();
  });

  it('should activate solid mode', () => {
    const fixture = TestBed.createComponent(GraphingCalculatorComponent);
    const comp = fixture.componentInstance;
    expect(comp.showSolidTool()).toBe(false);
    comp.toggleSolidTool();
    expect(comp.showSolidTool()).toBe(true);
  });

  it('should update a function expression color', () => {
    const fixture = TestBed.createComponent(GraphingCalculatorComponent);
    const comp = fixture.componentInstance;
    const original = comp.functions()[0].color;
    comp.updateColor(0, '#123456');
    expect(comp.functions()[0].color).toBe('#123456');
    expect(comp.functions()[0].color).not.toBe(original);
  });

  it('should render canvas element', () => {
    const fixture = TestBed.createComponent(GraphingCalculatorComponent);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('canvas')).toBeTruthy();
  });

  it('should render the expressions panel', () => {
    const fixture = TestBed.createComponent(GraphingCalculatorComponent);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.panel')).toBeTruthy();
  });

  it('should produce a single curve adapter for an implicit conic', () => {
    const fixture = TestBed.createComponent(GraphingCalculatorComponent);
    const comp = fixture.componentInstance;
    comp.addFunction();
    comp.updateExpression(1, 'x^2+y^2-4=0');
    comp.toggleSolidTool();
    comp.solidToolState.toggleCurve(1);
    comp.solidToolState.setA('-2');
    comp.solidToolState.setB('2');
    const spec = comp.solidToolState.spec();
    expect(spec).not.toBeNull();
    expect(spec!.curves.length).toBe(1);
    expect(spec!.curves[0].fn(0)).toBeCloseTo(2, 5);
    expect(spec!.curves[0].fn(2)).toBeCloseTo(0, 5);
  });

  it('should compute a solid result for a single conic curve', () => {
    const fixture = TestBed.createComponent(GraphingCalculatorComponent);
    const comp = fixture.componentInstance;
    comp.addFunction();
    comp.updateExpression(1, 'x^2+y^2-4=0');
    comp.toggleSolidTool();
    comp.solidToolState.toggleCurve(1);
    comp.solidToolState.setA('-2');
    comp.solidToolState.setB('2');
    const result = comp.solidToolState.result();
    expect(result).not.toBeNull();
    expect(result!.pieces.length).toBeGreaterThan(0);
  });

  it('keeps the same 2D canvas element across a 3D → 2D round trip', () => {
    const fixture = TestBed.createComponent(GraphingCalculatorComponent);
    const comp = fixture.componentInstance;
    fixture.detectChanges();
    comp.addFunction();
    comp.updateExpression(1, 'x^2+y^2-4=0');
    comp.toggleSolidTool();
    comp.solidToolState.toggleCurve(1);
    comp.solidToolState.setA('-2');
    comp.solidToolState.setB('2');
    fixture.detectChanges();
    expect(comp.hasSolidResult()).toBe(true);
    const before = comp.canvasRef()?.nativeElement;
    expect(before).toBeTruthy();

    comp.show3DSolid.set(true);
    fixture.detectChanges();
    comp.show3DSolid.set(false);
    fixture.detectChanges();

    const after = comp.canvasRef()?.nativeElement;
    expect(after).toBe(before);
    expect(after!.isConnected).toBe(true);
  });

  it('pans the 2D view with a mouse drag on the canvas', () => {
    const fixture = TestBed.createComponent(GraphingCalculatorComponent);
    const comp = fixture.componentInstance;
    fixture.detectChanges();
    const canvas = comp.canvasRef()!.nativeElement;
    const xMin = comp.viewport.xMin;

    const mouse = (type: string, x: number, y: number) =>
      canvas.dispatchEvent(
        new MouseEvent(type, { clientX: x, clientY: y, button: 0, bubbles: true }),
      );
    mouse('mousedown', 100, 100);
    mouse('mousemove', 100, 100);
    mouse('mousemove', 160, 100);
    mouse('mouseup', 160, 100);

    expect(comp.viewport.xMin).toBeLessThan(xMin);
  });

  describe('detectMode', () => {
    it('should detect cos(t),sin(t) as parametric', () => {
      const fixture = TestBed.createComponent(GraphingCalculatorComponent);
      expect((fixture.componentInstance as any).detectMode('cos(t),sin(t)')).toBe('parametric');
    });

    it('should detect t,t^2 as parametric', () => {
      const fixture = TestBed.createComponent(GraphingCalculatorComponent);
      expect((fixture.componentInstance as any).detectMode('t,t^2')).toBe('parametric');
    });

    it('should detect x=cos(t),y=sin(t) as parametric', () => {
      const fixture = TestBed.createComponent(GraphingCalculatorComponent);
      expect((fixture.componentInstance as any).detectMode('x=cos(t),y=sin(t)')).toBe('parametric');
    });

    it('should NOT detect x*y=t as parametric', () => {
      const fixture = TestBed.createComponent(GraphingCalculatorComponent);
      expect((fixture.componentInstance as any).detectMode('x*y=t')).not.toBe('parametric');
    });

    it('should NOT detect x=y*t as parametric', () => {
      const fixture = TestBed.createComponent(GraphingCalculatorComponent);
      expect((fixture.componentInstance as any).detectMode('x=y*t')).not.toBe('parametric');
    });

    it('should NOT detect sin(x)+cos(t) as parametric', () => {
      const fixture = TestBed.createComponent(GraphingCalculatorComponent);
      expect((fixture.componentInstance as any).detectMode('sin(x)+cos(t)')).not.toBe('parametric');
    });

    it('should detect min(x,1)+t as explicit (comma inside parens)', () => {
      const fixture = TestBed.createComponent(GraphingCalculatorComponent);
      expect((fixture.componentInstance as any).detectMode('min(x,1)+t')).toBe('explicit');
    });

    it('should detect x^2+y^2=1 as implicit', () => {
      const fixture = TestBed.createComponent(GraphingCalculatorComponent);
      expect((fixture.componentInstance as any).detectMode('x^2+y^2=1')).toBe('implicit');
    });

    it('should detect y=x^2 as explicit', () => {
      const fixture = TestBed.createComponent(GraphingCalculatorComponent);
      expect((fixture.componentInstance as any).detectMode('y=x^2')).toBe('explicit');
    });

    it('should detect x=y^2 as explicit-y', () => {
      const fixture = TestBed.createComponent(GraphingCalculatorComponent);
      expect((fixture.componentInstance as any).detectMode('x=y^2')).toBe('explicit-y');
    });

    it('should keep x=y^2+x as implicit (rhs references x)', () => {
      const fixture = TestBed.createComponent(GraphingCalculatorComponent);
      expect((fixture.componentInstance as any).detectMode('x=y^2+x')).toBe('implicit');
    });

    it('should keep a bare x=3 as implicit', () => {
      const fixture = TestBed.createComponent(GraphingCalculatorComponent);
      expect((fixture.componentInstance as any).detectMode('x=3')).toBe('implicit');
    });
  });

  describe('explicit-y mode', () => {
    it('parses x=y^2 with an ast evaluable in y', () => {
      const fixture = TestBed.createComponent(GraphingCalculatorComponent);
      const comp = fixture.componentInstance;
      comp.updateExpression(0, 'x=y^2');
      const fn = comp.functions()[0];
      expect(fn.mode).toBe('explicit-y');
      expect(fn.ast).not.toBeNull();
      expect(fn.error).toBeNull();
    });

    it('is excluded from canUseWithTools', () => {
      const fixture = TestBed.createComponent(GraphingCalculatorComponent);
      const comp = fixture.componentInstance;
      comp.updateExpression(0, 'x=y^2');
      expect(comp.canUseWithTools(comp.functions()[0])).toBe(false);
    });

    it('is excluded from evalResults', () => {
      const fixture = TestBed.createComponent(GraphingCalculatorComponent);
      const comp = fixture.componentInstance;
      comp.updateExpression(0, 'x=y^2');
      comp.evalPoint.set('1');
      expect(comp.evalResults().length).toBe(0);
    });
  });

  describe('inline expression errors', () => {
    it('sets a parse error message and clears the ast', () => {
      const fixture = TestBed.createComponent(GraphingCalculatorComponent);
      const comp = fixture.componentInstance;
      comp.updateExpression(0, 'sin(x');
      expect(comp.functions()[0].ast).toBeNull();
      expect(comp.functions()[0].error).toBeTruthy();
    });

    it('clears the error once the expression becomes valid again', () => {
      const fixture = TestBed.createComponent(GraphingCalculatorComponent);
      const comp = fixture.componentInstance;
      comp.updateExpression(0, 'sni(x)');
      expect(comp.functions()[0].error).toBeTruthy();
      comp.updateExpression(0, 'sin(x)');
      expect(comp.functions()[0].error).toBeNull();
      expect(comp.functions()[0].ast).not.toBeNull();
    });

    it('maps an unknown identifier followed by "(" to "Unknown function or variable"', () => {
      const fixture = TestBed.createComponent(GraphingCalculatorComponent);
      const comp = fixture.componentInstance;
      comp.updateExpression(0, 'sni(x)');
      expect(comp.functions()[0].error).toBe("Unknown function or variable 'sni'");
    });

    it('starts with no error for the default row', () => {
      const fixture = TestBed.createComponent(GraphingCalculatorComponent);
      const comp = fixture.componentInstance;
      expect(comp.functions()[0].error).toBeNull();
    });
  });

  describe('keyboard-accessible row reordering', () => {
    it('moveFunctionDown/moveFunctionUp reorder rows through the same path as drag-and-drop', () => {
      const fixture = TestBed.createComponent(GraphingCalculatorComponent);
      const comp = fixture.componentInstance;
      comp.updateExpression(0, 'sin(x)');
      comp.addFunction();
      comp.updateExpression(1, 'cos(x)');
      expect(comp.functions().map((f) => f.raw)).toEqual(['sin(x)', 'cos(x)']);

      comp.moveFunctionDown(0);
      expect(comp.functions().map((f) => f.raw)).toEqual(['cos(x)', 'sin(x)']);
      expect(comp.moveAnnouncement()).toContain('Moved');

      comp.moveFunctionUp(1);
      expect(comp.functions().map((f) => f.raw)).toEqual(['sin(x)', 'cos(x)']);
    });

    it('calls solidToolState.handleFunctionMoved, same as drag-and-drop', () => {
      const fixture = TestBed.createComponent(GraphingCalculatorComponent);
      const comp = fixture.componentInstance;
      comp.addFunction();
      const spy = vi.spyOn(comp.solidToolState, 'handleFunctionMoved');
      comp.moveFunctionDown(0);
      expect(spy).toHaveBeenCalledWith(0, 1);
    });

    it('does not move past the first or last row', () => {
      const fixture = TestBed.createComponent(GraphingCalculatorComponent);
      const comp = fixture.componentInstance;
      expect(comp.canMoveFunctionUp(0)).toBe(false);
      expect(comp.canMoveFunctionDown(0)).toBe(false);
      comp.moveFunctionUp(0);
      expect(comp.functions().length).toBe(1);
    });

    it('Alt+ArrowDown on the row input triggers the same reorder', () => {
      const fixture = TestBed.createComponent(GraphingCalculatorComponent);
      const comp = fixture.componentInstance;
      comp.addFunction();
      comp.updateExpression(0, 'sin(x)');
      comp.updateExpression(1, 'cos(x)');
      const event = new KeyboardEvent('keydown', { key: 'ArrowDown', altKey: true });
      const preventSpy = vi.spyOn(event, 'preventDefault');
      comp.onFnInputKeyDown(0, event);
      expect(preventSpy).toHaveBeenCalled();
      expect(comp.functions().map((f) => f.raw)).toEqual(['cos(x)', 'sin(x)']);
    });

    it('ignores arrow keys without Alt', () => {
      const fixture = TestBed.createComponent(GraphingCalculatorComponent);
      const comp = fixture.componentInstance;
      comp.addFunction();
      const event = new KeyboardEvent('keydown', { key: 'ArrowDown', altKey: false });
      comp.onFnInputKeyDown(0, event);
      expect(comp.functions().map((f) => f.raw)).toEqual(['sin(x)', '']);
    });
  });

  describe('canvas accessible description', () => {
    it('describes visible functions', () => {
      const fixture = TestBed.createComponent(GraphingCalculatorComponent);
      const comp = fixture.componentInstance;
      comp.updateExpression(0, 'x^2');
      expect(comp.canvasDescription()).toContain('y = x^2');
    });

    it('omits hidden functions', () => {
      const fixture = TestBed.createComponent(GraphingCalculatorComponent);
      const comp = fixture.componentInstance;
      comp.updateExpression(0, 'x^2');
      comp.toggleVisibility(0);
      expect(comp.canvasDescription()).toContain('No functions plotted');
    });

    it('reflects the active solid tool', () => {
      const fixture = TestBed.createComponent(GraphingCalculatorComponent);
      const comp = fixture.componentInstance;
      comp.toggleSolidTool();
      expect(comp.canvasDescription()).toContain('Solid of revolution tool active');
    });

    it('updates reactively when a function changes', () => {
      const fixture = TestBed.createComponent(GraphingCalculatorComponent);
      const comp = fixture.componentInstance;
      expect(comp.canvasDescription()).toContain('y = sin(x)');
      comp.updateExpression(0, 'cos(x)');
      expect(comp.canvasDescription()).toContain('y = cos(x)');
    });
  });

  describe('help modal focus return', () => {
    it('returns focus to the help button after onHelpClose', () => {
      const fixture = TestBed.createComponent(GraphingCalculatorComponent);
      const comp = fixture.componentInstance;
      fixture.detectChanges();
      comp.showHelp.set(true);
      fixture.detectChanges();

      const helpButton = comp.helpBtn();
      const focusSpy = helpButton ? vi.spyOn(helpButton.nativeElement, 'focus') : null;

      comp.onHelpClose();

      expect(comp.showHelp()).toBe(false);
      if (focusSpy) expect(focusSpy).toHaveBeenCalled();
    });
  });

  describe('points of interest toggle', () => {
    it('hides points from click-to-pin when toggled off', () => {
      const fixture = TestBed.createComponent(GraphingCalculatorComponent);
      const comp = fixture.componentInstance;
      fixture.detectChanges();

      // Default canvas size in jsdom is 300x150; with the default viewport
      // (-10..10, -7..7) the point (0, -1) lands at screen (150, ~85.7).
      comp.interactionState.setPoints([{ x: 0, y: -1, label: 'min of f1' }]);
      const click = new MouseEvent('click', { clientX: 150, clientY: 86 });

      expect(comp.interactionState.showPointsOfInterest()).toBe(true);
      comp.onCanvasClick(click);
      expect(comp.interactionState.pinnedPoints().length).toBe(1);

      comp.interactionState.clearPinned();
      comp.togglePointsOfInterest();
      expect(comp.interactionState.showPointsOfInterest()).toBe(false);

      comp.onCanvasClick(click);
      expect(comp.interactionState.pinnedPoints().length).toBe(0);
    });
  });

  describe('reactive canvas redraw', () => {
    it('schedules a render when the solid tool state changes (e.g. axis value)', async () => {
      const fixture = TestBed.createComponent(GraphingCalculatorComponent);
      const comp = fixture.componentInstance;
      fixture.detectChanges();
      await fixture.whenStable();

      comp.addFunction();
      comp.updateExpression(1, 'x^2+y^2-4=0');
      comp.toggleSolidTool();
      comp.solidToolState.toggleCurve(1);
      comp.solidToolState.setA('-2');
      comp.solidToolState.setB('2');
      fixture.detectChanges();
      await fixture.whenStable();

      const rafSpy = vi.spyOn(globalThis, 'requestAnimationFrame');
      (comp as any).renderRequested = false;
      rafSpy.mockClear();

      comp.solidToolState.setAxisValue('1');
      fixture.detectChanges();
      await fixture.whenStable();

      expect(rafSpy).toHaveBeenCalled();
    });

    it('schedules a render and invalidates points of interest when a function changes', async () => {
      const fixture = TestBed.createComponent(GraphingCalculatorComponent);
      const comp = fixture.componentInstance;
      fixture.detectChanges();
      await fixture.whenStable();

      const spy = vi.spyOn(comp.interactionState, 'setPoints');
      comp.updateExpression(0, 'x^2-1');
      fixture.detectChanges();
      await fixture.whenStable();

      expect(spy).toHaveBeenCalled();
    });

    it('clears stale points of interest after replacing the function that produced them', async () => {
      const fixture = TestBed.createComponent(GraphingCalculatorComponent);
      const comp = fixture.componentInstance;
      fixture.detectChanges();
      await fixture.whenStable();

      comp.updateExpression(0, 'sin(x)');
      fixture.detectChanges();
      await fixture.whenStable();
      const withSin = comp.interactionState.pointsOfInterest();
      expect(withSin.length).toBeGreaterThan(0);

      comp.updateExpression(0, 'sqrt(1-x^2)');
      fixture.detectChanges();
      await fixture.whenStable();

      const afterReplace = comp.interactionState.pointsOfInterest();
      // sin(x) has a root near x = pi (~3.14) within the default viewport; that
      // should not still be reported once the function is sqrt(1-x^2), whose
      // domain (and every one of its critical points) is confined to [-1, 1].
      expect(afterReplace.some((p) => Math.abs(p.x - Math.PI) < 0.1)).toBe(false);
      expect(afterReplace.every((p) => Math.abs(p.x) < 1.01)).toBe(true);
    });
  });

  describe('piecewise rows (if) keep their top-level split points', () => {
    it.each<[string, string, string | undefined]>([
      ['y = if(x<0, -x, x)', 'explicit', undefined],
      ['if(x != 2, 3/(x-2), 4)', 'explicit', undefined],
      ['y < if(x<0, 1, 2)', 'implicit', '<'],
      ['(if(t<0, t, 0), t)', 'parametric', undefined],
      ['r = if(t<pi, 1, 2)', 'polar', undefined],
      ['1 < x^2+y^2 < 4', 'implicit', '>'],
    ])('%s', (raw, mode, op) => {
      const comp = TestBed.createComponent(GraphingCalculatorComponent).componentInstance;
      comp.updateExpression(0, raw);
      const fn = comp.functions()[0];
      expect(fn.error).toBeNull();
      expect(fn.mode).toBe(mode);
      expect(fn.inequalityOp).toBe(op);
      expect(mode === 'parametric' ? fn.paramX && fn.paramY : fn.ast).toBeTruthy();
    });
  });
  describe('free parameters (sliders)', () => {
    function setup(...rows: string[]) {
      const comp = TestBed.createComponent(GraphingCalculatorComponent).componentInstance;
      rows.forEach((raw, i) => {
        if (i > 0) comp.addFunction();
        comp.updateExpression(i, raw);
      });
      return comp;
    }

    it('y = a*x^2 with a = 2 evaluates to 2x², and moving a updates it', () => {
      const comp = setup('y = a*x^2', 'a = 2');
      const fn = () => comp.functions()[0];
      expect(fn().error).toBeNull();
      expect(evalExpression(fn().ast!, 3)).toBe(18);
      comp.paramSliders.setSliderValue(1, -0.5);
      comp.paramSliders.flush();
      expect(comp.functions()[1].raw).toBe('a = -0.5');
      expect(evalExpression(fn().ast!, 2)).toBe(-2);
      expect(comp.paramSliders.sliders()[1]).toEqual({
        name: 'a',
        value: -0.5,
        min: -10,
        max: 10,
        step: 0.1,
      });
    });

    it('a row without its slider gets missingParams and an add-slider error', () => {
      const comp = setup('y = a*x + b');
      expect(comp.functions()[0].missingParams).toEqual(['a', 'b']);
      expect(comp.functions()[0].error).toBe('Add sliders for a, b');
      expect(comp.functions()[0].ast).toBeNull();
      expect(comp.paramSliders.addSlider('a')).toBe(true);
      expect(comp.functions()[1].raw).toBe('a = 1');
      expect(comp.paramSliders.missing()[0]).toEqual(['b']);
      expect(comp.paramSliders.addSlider('a')).toBe(false);
    });

    it('a slider row is never drawn nor offered by the tools', () => {
      const comp = setup('a = 1', 'y = a*x');
      const slider = comp.functions()[0];
      expect(slider.mode).toBe('slider');
      expect(slider.ast).toBeNull();
      expect(comp.canUseWithTools(slider)).toBe(false);
      expect(comp.derivatives()[0].applicable).toBe(false);
      expect(comp.solidToolState.curveOptions().map((o) => o.index)).toEqual([1]);
      expect(comp.canvasDescription()).not.toContain('a = 1');
      comp.activateIntegral();
      expect(comp.activeIntegral()?.fnIndex).toBe(1);
      comp.activateIntegral();
      comp.activateMultiArea();
      expect(comp.activeMultiArea()?.functionIndices).toEqual([1]);
      comp.toggleMultiAreaFunction(0);
      expect(comp.activeMultiArea()?.functionIndices).toEqual([1]);
    });

    it('a second definition is an error and the first one wins', () => {
      const comp = setup('a = 2', 'a = 3', 'y = a');
      expect(comp.functions()[1].error).toBe('a is already defined');
      expect(evalExpression(comp.functions()[2].ast!, 0)).toBe(2);
      comp.removeFunction(0);
      expect(comp.functions()[0].error).toBeNull();
      expect(evalExpression(comp.functions()[1].ast!, 0)).toBe(3);
    });

    it('a typed value outside the range widens it; bounds edits clamp the value', () => {
      const comp = setup('k = 25');
      expect(comp.functions()[0].slider).toEqual({ min: -10, max: 25, step: 0.1 });
      expect(comp.paramSliders.setSliderBounds(0, { min: 5, max: 3 })).toBe(false);
      expect(comp.paramSliders.setSliderBounds(0, { max: 20, step: 0.5 })).toBe(true);
      expect(comp.functions()[0].raw).toBe('k = 20');
    });

    it('slider bounds round-trip through a share link', () => {
      window.location.hash = buildShareHash({
        v: 2,
        functions: [
          { raw: 'y = a*x', color: '#00ff88', visible: true },
          { raw: 'a = 3', color: '#ff6b35', visible: true, slider: { min: 0, max: 5, step: 0.5 } },
        ],
        viewport: { xMin: -5, xMax: 5, yMin: -5, yMax: 5 },
        tool: { active: null },
      });
      const fixture = TestBed.createComponent(GraphingCalculatorComponent);
      fixture.detectChanges();
      const comp = fixture.componentInstance;
      expect(evalExpression(comp.functions()[0].ast!, 2)).toBe(6);
      expect(comp.functions()[1].slider).toEqual({ min: 0, max: 5, step: 0.5 });
      const shared = (comp as unknown as { buildShareState(): unknown }).buildShareState();
      const parsed = parseShareState(extractShareFragment(buildShareHash(shared as never))!);
      expect(parsed?.functions[1].slider).toEqual({ min: 0, max: 5, step: 0.5 });
      expect(parsed?.functions[0].slider).toBeUndefined();
    });
  });
});
