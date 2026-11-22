/**
 * Where an exercise added mid-workout can go.
 *
 * Adding used to append silently, which is right only when the new exercise
 * belongs at the end. Usually it doesn't: the calf raise that just came to
 * mind goes next, or before the finisher. So the person is offered the slots
 * that make sense after the exercise they're on, named by their neighbours.
 *
 * Pure, so the rules are tested directly (tests/placement.test.mjs).
 */

export type PlacementKey = 'next' | 'second-last' | 'last';

export type PlacementSlot = {
  key: PlacementKey;
  /** Insert before the exercise at this index; `names.length` means at the end. */
  index: number;
  label: string;
  hint: string;
};

/**
 * The distinct places a new exercise can go, after the current one, in the
 * order Next, Second to last, Last. Slots that would land in the same place
 * are merged into the earlier one. A single slot means there is nothing to
 * ask: the caller inserts there directly.
 *
 * @param names        exercise names in session order
 * @param currentIndex the exercise being worked on, or -1 when there is none
 */
export function placementSlots(names: readonly string[], currentIndex: number): PlacementSlot[] {
  const count = names.length;
  const after = Math.max(-1, Math.min(currentIndex, count - 1));
  if (count === 0 || after < 0) {
    return [{ key: 'last', index: count, label: 'Add', hint: 'It becomes the first exercise' }];
  }

  const current = names[after];
  const final = names[count - 1];
  const nextIndex = after + 1;
  const slots: PlacementSlot[] = [];

  if (nextIndex >= count) {
    // The current exercise is the last one: next and last are the same place.
    return [{ key: 'next', index: count, label: 'Next', hint: `After ${current}, at the end` }];
  }

  slots.push({
    key: 'next',
    index: nextIndex,
    label: 'Next',
    hint: `Right after ${current}, before ${names[nextIndex]}`,
  });

  const secondLast = count - 1;
  if (secondLast > nextIndex) {
    slots.push({ key: 'second-last', index: secondLast, label: 'Second to last', hint: `Before ${final}` });
  }

  slots.push({ key: 'last', index: count, label: 'Last', hint: `After ${final}` });
  return slots;
}
