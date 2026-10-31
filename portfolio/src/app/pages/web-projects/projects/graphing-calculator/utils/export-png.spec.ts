import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { downloadCanvasAsPng } from './export-png';

function mockCanvas(blob: Blob | null) {
  const toBlob = vi.fn((cb: BlobCallback, _type?: string) => cb(blob));
  return { canvas: { toBlob } as unknown as HTMLCanvasElement, toBlob };
}

describe('downloadCanvasAsPng', () => {
  let createObjectURL: ReturnType<typeof vi.fn>;
  let revokeObjectURL: ReturnType<typeof vi.fn>;
  let click: ReturnType<typeof vi.spyOn>;
  const original = { createObjectURL: URL.createObjectURL, revokeObjectURL: URL.revokeObjectURL };

  beforeEach(() => {
    vi.useFakeTimers();
    createObjectURL = vi.fn(() => 'blob:graph');
    revokeObjectURL = vi.fn();
    Object.assign(URL, { createObjectURL, revokeObjectURL });
    click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    click.mockRestore();
    Object.assign(URL, original);
  });

  it('encodes the canvas as PNG and clicks a download link with the file name', () => {
    const { canvas, toBlob } = mockCanvas(new Blob(['png'], { type: 'image/png' }));
    let anchor: HTMLAnchorElement | null = null;
    click.mockImplementation(function (this: HTMLAnchorElement) {
      anchor = this;
    });
    downloadCanvasAsPng(canvas, 'graph.png');
    expect(toBlob).toHaveBeenCalledWith(expect.any(Function), 'image/png');
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(anchor).not.toBeNull();
    expect(anchor!.download).toBe('graph.png');
    expect(anchor!.href).toBe('blob:graph');
    expect(anchor!.isConnected).toBe(false);
  });

  it('revokes the object URL only after the click has been handled', () => {
    const { canvas } = mockCanvas(new Blob(['png']));
    downloadCanvasAsPng(canvas, 'graph.png');
    expect(revokeObjectURL).not.toHaveBeenCalled();
    vi.runAllTimers();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:graph');
  });

  it('does nothing when the canvas cannot be encoded', () => {
    const { canvas } = mockCanvas(null);
    downloadCanvasAsPng(canvas, 'graph.png');
    expect(createObjectURL).not.toHaveBeenCalled();
    expect(click).not.toHaveBeenCalled();
  });
});
