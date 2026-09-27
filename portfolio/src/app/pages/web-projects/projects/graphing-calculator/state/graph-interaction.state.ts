import { Injectable, signal } from '@angular/core';
import type { PointOfInterest } from '../engine/critical-points';

export interface PinnedPoint extends PointOfInterest {
  id: string;
}

function pointId(p: PointOfInterest): string {
  return `${p.x.toFixed(6)}:${p.y.toFixed(6)}`;
}

/** Signal state for the "points of interest" overlay (toggle, computed points,
 *  pinned labels, and the keyboard-cycle cursor) shared between the graphing
 *  calculator component and the canvas render loop. */
@Injectable()
export class GraphInteractionState {
  showPointsOfInterest = signal(true);
  pointsOfInterest = signal<PointOfInterest[]>([]);
  pinnedPoints = signal<PinnedPoint[]>([]);
  activeIndex = signal<number | null>(null);

  toggle(): void {
    this.showPointsOfInterest.update((v) => !v);
    if (!this.showPointsOfInterest()) {
      this.activeIndex.set(null);
    }
  }

  setPoints(points: PointOfInterest[]): void {
    this.pointsOfInterest.set(points);
    const active = this.activeIndex();
    if (active !== null && active >= points.length) {
      this.activeIndex.set(points.length > 0 ? 0 : null);
    }
  }

  togglePin(p: PointOfInterest): void {
    const id = pointId(p);
    this.pinnedPoints.update((pts) => {
      const existing = pts.findIndex((pt) => pt.id === id);
      if (existing >= 0) return pts.filter((_, i) => i !== existing);
      return [...pts, { ...p, id }];
    });
  }

  clearPinned(): void {
    this.pinnedPoints.set([]);
  }

  /** Advances the keyboard-cycle cursor to the next point of interest, wrapping
   *  around, and returns it (or null when there are none). */
  cycleNext(): { point: PointOfInterest; index: number; total: number } | null {
    const points = this.pointsOfInterest();
    if (points.length === 0) {
      this.activeIndex.set(null);
      return null;
    }
    const current = this.activeIndex();
    const next = current === null ? 0 : (current + 1) % points.length;
    this.activeIndex.set(next);
    return { point: points[next], index: next, total: points.length };
  }
}
