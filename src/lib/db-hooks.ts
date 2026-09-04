import { useMemo } from 'react';
import { create } from 'zustand';

/**
 * Reactivity without a subscription layer.
 *
 * expo-sqlite's synchronous reads are sub-millisecond at this data scale, so
 * rather than wiring live queries we recompute on a global revision counter
 * that every mutation bumps. Predictable, dependency-free, and trivially
 * debuggable — and it satisfies the section 6.5 budget of one re-render per
 * tick because reads never happen on the timer path.
 */
type RevisionState = { rev: number; bump: () => void };

export const useRevision = create<RevisionState>((set) => ({
  rev: 0,
  bump: () => set((s) => ({ rev: s.rev + 1 })),
}));

/** Call after any write so dependent screens recompute. */
export function bumpRevision(): void {
  useRevision.getState().bump();
}

/**
 * Runs a synchronous SQLite read and re-runs it whenever data changes.
 * `deps` should contain any parameters the query closes over.
 */
export function useQuery<T>(run: () => T, deps: readonly unknown[] = []): T {
  const rev = useRevision((s) => s.rev);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(run, [rev, ...deps]);
}
