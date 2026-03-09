/**
 * @blaze-ng/observe-sequence — Reactive sequence observation for Blaze-NG.
 *
 * Observes arrays, cursors (Mongo-style), and iterables reactively.
 * Fires positional callbacks when items are added, changed, removed, or moved.
 * Framework-agnostic: supply a ReactiveSystem via `setReactiveSystem()`.
 *
 * @example
 * ```ts
 * import { ObserveSequence } from '@blaze-ng/observe-sequence';
 *
 * ObserveSequence.setReactiveSystem(myTracker);
 * const handle = ObserveSequence.observe(() => myArray, {
 *   addedAt(id, item, index, before) { ... },
 *   changedAt(id, item, oldItem, index) { ... },
 *   removedAt(id, item, index) { ... },
 *   movedTo(id, item, from, to, before) { ... },
 * });
 * handle.stop();
 * ```
 */

// Types
export type {
  ReactiveSystem,
  Computation,
  ObserveHandle,
  StoreCursor,
  CursorCallbacks,
  SequenceCallbacks,
  SeqEntry,
  DiffCallbacks,
} from './types';

// ID utilities
export { idStringify, idParse } from './id-utils';

// Diff algorithm
export { diffQueryOrderedChanges } from './diff';

// Main API
export { ObserveSequence } from './observe-sequence';
