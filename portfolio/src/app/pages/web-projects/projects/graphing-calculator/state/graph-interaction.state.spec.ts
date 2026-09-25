import { describe, it, expect, beforeEach } from 'vitest';
import { GraphInteractionState } from './graph-interaction.state';

describe('GraphInteractionState', () => {
  let state: GraphInteractionState;

  beforeEach(() => {
    state = new GraphInteractionState();
  });

  it('defaults points of interest to visible', () => {
    expect(state.showPointsOfInterest()).toBe(true);
  });

  it('toggles points of interest and clears the active cursor when hidden', () => {
    state.setPoints([{ x: 0, y: 0, label: 'root of f1' }]);
    state.cycleNext();
    expect(state.activeIndex()).toBe(0);
    state.toggle();
    expect(state.showPointsOfInterest()).toBe(false);
    expect(state.activeIndex()).toBeNull();
  });

  it('pins and unpins a point (toggle)', () => {
    const p = { x: 1, y: 2, label: 'root of f1' };
    expect(state.isPinned(p)).toBe(false);
    state.togglePin(p);
    expect(state.isPinned(p)).toBe(true);
    expect(state.pinnedPoints().length).toBe(1);
    state.togglePin(p);
    expect(state.isPinned(p)).toBe(false);
  });

  it('clears all pinned points', () => {
    state.togglePin({ x: 1, y: 2, label: 'a' });
    state.togglePin({ x: 3, y: 4, label: 'b' });
    expect(state.pinnedPoints().length).toBe(2);
    state.clearPinned();
    expect(state.pinnedPoints().length).toBe(0);
  });

  it('cycles through points of interest, wrapping around', () => {
    state.setPoints([
      { x: 0, y: 0, label: 'a' },
      { x: 1, y: 1, label: 'b' },
    ]);
    const first = state.cycleNext();
    expect(first?.index).toBe(0);
    const second = state.cycleNext();
    expect(second?.index).toBe(1);
    const wrapped = state.cycleNext();
    expect(wrapped?.index).toBe(0);
  });

  it('returns null from cycleNext when there are no points', () => {
    expect(state.cycleNext()).toBeNull();
  });
});
