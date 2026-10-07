import { Injectable, Signal, computed, signal } from '@angular/core';

/** Mobile bottom-sheet snap position. Desktop ignores this (fixed sidebar). */
export type SheetSnap = 'peek' | 'half' | 'full';

/** Fraction of the canvas height the bottom sheet covers at each snap. Mirrors the `.panel.snap-*`
 *  heights in the component CSS; `full` is capped at half because the user is then editing
 *  expressions and the plot only needs to stay roughly centred in what remains. */
export const SHEET_COVER_FRACTION: Record<SheetSnap, number> = {
  peek: 0.16,
  half: 0.5,
  full: 0.5,
};

/** Which tool panel is open in the tab bar. 'none' means the "Graph" tab (no panel). */
export type ToolTab = 'none' | 'integral' | 'area' | 'solids' | 'conics';

/**
 * UI-only layout state for the mobile bottom sheet and the tool tab bar.
 * Not persisted across sessions and unrelated to graph/math state.
 */
@Injectable()
export class UiLayoutState {
  sheetSnap = signal<SheetSnap>('peek');

  /** Live sheet height (px) while the handle is being dragged; 0 when not dragging. */
  dragOffsetPx = signal(0);
  dragging = signal(false);

  /** Small "keyboard shortcuts" popover, separate from the full help modal. */
  showShortcuts = signal(false);

  /** Derived from the calculator's own tool signals — set once via `connect()`, used only
   *  to highlight the active tab (tab clicks still call the calculator's existing
   *  activate/toggle methods, which remain the single source of truth). */
  activeTool: Signal<ToolTab> = computed(() => 'none');

  connect(
    activeIntegral: Signal<unknown>,
    showSolidTool: Signal<boolean>,
    activeMultiArea: Signal<unknown>,
    showConicAssistant: Signal<boolean>,
  ): void {
    this.activeTool = computed<ToolTab>(() => {
      if (activeIntegral()) return 'integral';
      if (showSolidTool()) return 'solids';
      if (activeMultiArea()) return 'area';
      if (showConicAssistant()) return 'conics';
      return 'none';
    });
  }

  /** Covered fraction of the canvas by the sheet (0..1), ignoring whether the layout is mobile. */
  sheetCoverFraction = computed(() => SHEET_COVER_FRACTION[this.sheetSnap()]);

  cycleSheet(): void {
    this.sheetSnap.update((s) => (s === 'peek' ? 'half' : s === 'half' ? 'full' : 'peek'));
  }

  setSheet(snap: SheetSnap): void {
    this.sheetSnap.set(snap);
  }
}
