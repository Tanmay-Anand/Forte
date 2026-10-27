import { create } from 'zustand';

/**
 * Measured height of everything PillNav floats over the bottom of a tab
 * screen: UpdateBar and ResumeBar when they show, the pill itself, and the
 * bottom safe-area padding beneath it.
 *
 * Screens pad their scroll content by this so the last rows are never hidden
 * behind the overlay. It is measured (onLayout in PillNav) rather than added
 * up from constants, so a bar appearing, a font-size change or a gesture-bar
 * inset is accounted for automatically. 0 until the first layout; Screen falls
 * back to NAV.clearance until then.
 */
type NavOverlayState = { height: number; setHeight: (height: number) => void };

export const useNavOverlay = create<NavOverlayState>((set) => ({
  height: 0,
  // Ignore sub-pixel layout jitter so screens do not re-render for nothing.
  setHeight: (height) => set((s) => (Math.abs(s.height - height) < 1 ? s : { height })),
}));
