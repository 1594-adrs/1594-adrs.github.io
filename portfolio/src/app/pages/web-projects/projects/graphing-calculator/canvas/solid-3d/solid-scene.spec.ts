import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BoxGeometry, Color, type Scene, type WebGLRenderer } from 'three';

// jsdom has no WebGL: inject a recording fake renderer; every other three.js class stays real.
const fake = { instances: [] as FakeRenderer[] };

class FakeRenderer {
  domElement: HTMLCanvasElement;
  localClippingEnabled = false;
  dispose = vi.fn();
  forceContextLoss = vi.fn();
  render = vi.fn();
  setPixelRatio = vi.fn();
  setSize = vi.fn();
  constructor(canvas: HTMLCanvasElement) {
    this.domElement = canvas;
    fake.instances.push(this);
  }
}

const createFake = (canvas: HTMLCanvasElement) =>
  new FakeRenderer(canvas) as unknown as WebGLRenderer;

import { SolidScene } from './solid-scene';
import { LIGHT_PALETTE } from '../palette';

describe('SolidScene.dispose', () => {
  let canvas: HTMLCanvasElement;
  let host: HTMLDivElement;

  beforeEach(() => {
    fake.instances.length = 0;
    host = document.createElement('div');
    canvas = document.createElement('canvas');
    canvas.width = 300;
    canvas.height = 200;
    host.appendChild(canvas);
  });

  it('loses the WebGL context and detaches the canvas', () => {
    const scene = new SolidScene(canvas, createFake);
    scene.dispose();
    const [renderer] = fake.instances;
    expect(renderer.dispose).toHaveBeenCalledTimes(1);
    expect(renderer.forceContextLoss).toHaveBeenCalledTimes(1);
    expect(canvas.isConnected).toBe(false);
    expect(host.contains(canvas)).toBe(false);
  });

  it('disposes the geometry of pieces, slice and axis line', () => {
    const scene = new SolidScene(canvas, createFake);
    const piece = new BoxGeometry();
    const slice = new BoxGeometry();
    const pieceSpy = vi.spyOn(piece, 'dispose');
    const sliceSpy = vi.spyOn(slice, 'dispose');
    scene.updateSolidPieces([piece], '#00ff88');
    scene.updateSliceMesh(slice, '#ffcc00');
    scene.updateAxisLine({ orientation: 'horizontal', value: 0 });
    scene.dispose();
    expect(pieceSpy).toHaveBeenCalledTimes(1);
    expect(sliceSpy).toHaveBeenCalledTimes(1);
  });

  it('is idempotent and stops rendering afterwards', () => {
    const scene = new SolidScene(canvas, createFake);
    scene.dispose();
    scene.dispose();
    scene.render();
    const [renderer] = fake.instances;
    expect(renderer.forceContextLoss).toHaveBeenCalledTimes(1);
    expect(renderer.render).not.toHaveBeenCalled();
  });
});

describe('SolidScene.setPalette', () => {
  it('repaints the background and disposes the replaced grid', () => {
    fake.instances.length = 0;
    const canvas = document.createElement('canvas');
    canvas.width = 300;
    canvas.height = 200;
    const scene = new SolidScene(canvas, createFake);
    const inner = scene as unknown as { scene: Scene; grid: { geometry: BoxGeometry } };
    const oldGrid = inner.grid.geometry;
    const disposeSpy = vi.spyOn(oldGrid, 'dispose');
    scene.setPalette(LIGHT_PALETTE.scene);
    expect((inner.scene.background as Color).getHex()).toBe(0xffffff);
    expect(disposeSpy).toHaveBeenCalledTimes(1);
    expect(inner.grid.geometry).not.toBe(oldGrid);
  });
});
