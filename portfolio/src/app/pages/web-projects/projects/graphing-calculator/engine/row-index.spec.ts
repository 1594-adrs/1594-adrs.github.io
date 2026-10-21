import { describe, it, expect } from 'vitest';
import { remapIndex } from './row-index';

describe('remapIndex', () => {
  it('shifts rows after a removed one and reports the removed row as null', () => {
    expect(remapIndex(0, { remove: 0 })).toBeNull();
    expect(remapIndex(1, { remove: 0 })).toBe(0);
    expect(remapIndex(2, { remove: 1 })).toBe(1);
    expect(remapIndex(0, { remove: 1 })).toBe(0);
  });

  it('follows a row moved down and up', () => {
    // [a b c d]: move 0 -> 2 gives [b c a d]
    expect([0, 1, 2, 3].map((i) => remapIndex(i, { from: 0, to: 2 }))).toEqual([2, 0, 1, 3]);
    // move 3 -> 1 gives [a d b c]
    expect([0, 1, 2, 3].map((i) => remapIndex(i, { from: 3, to: 1 }))).toEqual([0, 2, 3, 1]);
  });

  it('is the identity for a no-op move', () => {
    expect([0, 1, 2].map((i) => remapIndex(i, { from: 1, to: 1 }))).toEqual([0, 1, 2]);
  });
});
