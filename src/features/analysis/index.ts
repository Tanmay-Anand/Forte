/**
 * Training analysis — numbers first, interpretation second.
 *
 * Everything here is deterministic and runs offline. Claude, when used, is
 * handed these results in a brief (brief.ts) and asked to explain them; it is
 * never asked to calculate. See docs/AI_TRAINER_PLAN.md, Part 5.
 */
export * from './types.ts';
export * from './history.ts';
export * from './compare.ts';
export * from './findings.ts';
export * from './brief.ts';
export * from './body.ts';
export * from './targets.ts';
export * from './balance.ts';
export * from './lab-reply.ts';
export * from './muscles.ts';
export * from './body-regions.ts';
