import { describe, it, expect, beforeEach } from 'vitest';
import { Viewport } from './viewport';

describe('Viewport', () => {
  let viewport: Viewport;

  beforeEach(() => {
    viewport = new Viewport();
  });

  describe('constructor', () => {
    it('should set default values', () => {
      expect(viewport.xMin).toBe(-10);
      expect(viewport.xMax).toBe(10);
      expect(viewport.yMin).toBe(-7);
      expect(viewport.yMax).toBe(7);
    });

    it('should accept custom values', () => {
      const v = new Viewport(-5, 5, -3, 3);
      expect(v.xMin).toBe(-5);
      expect(v.xMax).toBe(5);
      expect(v.yMin).toBe(-3);
      expect(v.yMax).toBe(3);
    });
  });

  describe('worldToScreen / screenToWorld roundtrip', () => {
    it('should return the same world coordinates after a roundtrip', () => {
      const width = 800;
      const height = 600;
      const wx = 3.5;
      const wy = -2.1;

      const [sx, sy] = viewport.worldToScreen(wx, wy, width, height);
      const [wx2, wy2] = viewport.screenToWorld(sx, sy, width, height);

      expect(wx2).toBeCloseTo(wx, 10);
      expect(wy2).toBeCloseTo(wy, 10);
    });

    it('should roundtrip at the corners', () => {
      const width = 1000;
      const height = 800;
      const corners = [
        [-10, 7],
        [10, 7],
        [-10, -7],
        [10, -7],
      ];

      for (const [wx, wy] of corners) {
        const [sx, sy] = viewport.worldToScreen(wx, wy, width, height);
        const [wx2, wy2] = viewport.screenToWorld(sx, sy, width, height);
        expect(wx2).toBeCloseTo(wx, 10);
        expect(wy2).toBeCloseTo(wy, 10);
      }
    });
  });

  describe('zoom', () => {
    it('zoom in should decrease the range', () => {
      const width = 800;
      const height = 600;
      const centerX = width / 2;
      const centerY = height / 2;

      viewport.zoom(2, centerX, centerY, width, height);

      expect(viewport.xMax - viewport.xMin).toBeLessThan(20);
      expect(viewport.yMax - viewport.yMin).toBeLessThan(14);
    });

    it('zoom out should increase the range', () => {
      const width = 800;
      const height = 600;
      const centerX = width / 2;
      const centerY = height / 2;

      viewport.zoom(0.5, centerX, centerY, width, height);

      expect(viewport.xMax - viewport.xMin).toBeGreaterThan(20);
      expect(viewport.yMax - viewport.yMin).toBeGreaterThan(14);
    });

    it('zoom clamp should not produce negative width for very large factor', () => {
      const width = 800;
      const height = 600;

      viewport.zoom(1e30, width / 2, height / 2, width, height);

      expect(viewport.xMax - viewport.xMin).toBeGreaterThanOrEqual(1e-10);
      expect(viewport.yMax - viewport.yMin).toBeGreaterThanOrEqual(1e-10);
    });
  });

  describe('pan', () => {
    it('should shift xMin and xMax', () => {
      const width = 800;
      const height = 600;
      const origXMin = viewport.xMin;
      const origXMax = viewport.xMax;

      viewport.pan(100, 0, width, height);

      expect(viewport.xMin).toBeLessThan(origXMin);
      expect(viewport.xMax).toBeLessThan(origXMax);
    });

    it('should shift yMin and yMax in opposite direction', () => {
      const width = 800;
      const height = 600;
      const origYMin = viewport.yMin;
      const origYMax = viewport.yMax;

      viewport.pan(0, 50, width, height);

      expect(viewport.yMin).toBeGreaterThan(origYMin);
      expect(viewport.yMax).toBeGreaterThan(origYMax);
    });

    it('should preserve the range after panning', () => {
      const width = 800;
      const height = 600;
      const rangeX = viewport.xMax - viewport.xMin;
      const rangeY = viewport.yMax - viewport.yMin;

      viewport.pan(100, 50, width, height);

      expect(viewport.xMax - viewport.xMin).toBeCloseTo(rangeX, 10);
      expect(viewport.yMax - viewport.yMin).toBeCloseTo(rangeY, 10);
    });
  });

  describe('reset', () => {
    it('should restore default values', () => {
      viewport.zoom(3, 400, 300, 800, 600);
      viewport.pan(50, 50, 800, 600);

      viewport.reset();

      expect(viewport.xMin).toBe(-10);
      expect(viewport.xMax).toBe(10);
      expect(viewport.yMin).toBe(-7);
      expect(viewport.yMax).toBe(7);
    });
  });
});
