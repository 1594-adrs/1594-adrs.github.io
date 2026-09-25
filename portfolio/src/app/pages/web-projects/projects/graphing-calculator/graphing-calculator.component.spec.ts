import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { GraphingCalculatorComponent } from './graphing-calculator.component';
import { buildShareHash } from './state/share-state';

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
    expect(comp.viewport.xMin).toBe(-5);
    expect(comp.viewport.xMax).toBe(5);
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

  it('should not exceed 5 functions', () => {
    const fixture = TestBed.createComponent(GraphingCalculatorComponent);
    const comp = fixture.componentInstance;
    for (let i = 0; i < 5; i++) comp.addFunction();
    expect(comp.functions().length).toBe(5);
    comp.addFunction();
    expect(comp.functions().length).toBe(5);
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

  it('should render sidebar', () => {
    const fixture = TestBed.createComponent(GraphingCalculatorComponent);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.sidebar')).toBeTruthy();
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
});
