/**
 * Types and interfaces for @blaze-ng/observe-sequence.
 */

/** Minimal computation handle returned by a reactive system. */
export interface Computation {
  stop(): void;
}

/**
 * Abstraction over a reactive system (e.g. Meteor Tracker, Solid signals).
 *
 * This decouples observe-sequence from any specific reactive runtime.
 * Provide an implementation via `ObserveSequence.setReactiveSystem()`.
 */
export interface ReactiveSystem {
  /**
   * Run a function that re-executes whenever its reactive dependencies change.
   *
   * @param fn - The reactive function to run.
   * @returns A computation handle that can be stopped.
   */
  autorun(fn: (computation: Computation) => void): Computation;

  /**
   * Run a function without establishing reactive dependencies.
   *
   * @param fn - The function to execute non-reactively.
   * @returns The return value of fn.
   */
  nonReactive<T>(fn: () => T): T;
}

/** Observer handle returned by cursor.observe(). */
export interface ObserveHandle {
  stop(): void;
}

/** The minimal interface a "cursor" must implement to be observable. */
export interface StoreCursor<T = unknown> {
  observe(callbacks: CursorCallbacks<T>): ObserveHandle;
  fetch(): T[];
}

/** Callbacks passed to cursor.observe(). */
export interface CursorCallbacks<T = unknown> {
  addedAt?(document: T, atIndex: number, before: string | null): void;
  changedAt?(newDocument: T, oldDocument: T, atIndex: number): void;
  removedAt?(oldDocument: T, atIndex: number): void;
  movedTo?(document: T, fromIndex: number, toIndex: number, before: string | null): void;
}

/** Callbacks fired by ObserveSequence.observe(). */
export interface SequenceCallbacks<T = unknown> {
  addedAt(id: unknown, item: T, index: number, before: unknown): void;
  changedAt(id: unknown, newItem: T, oldItem: T, index: number): void;
  removedAt(id: unknown, item: T, index: number): void;
  movedTo(id: unknown, item: T, fromIndex: number, toIndex: number, before: unknown): void;
}

/** Internal representation: an item with its derived _id. */
export interface SeqEntry<T = unknown> {
  _id: unknown;
  item: T;
}

/** Callbacks for the ordered diff algorithm. */
export interface DiffCallbacks {
  addedBefore?(id: unknown, fields: Record<string, unknown>, beforeId: unknown): void;
  movedBefore?(id: unknown, beforeId: unknown): void;
  removed?(id: unknown): void;
  changed?(id: unknown, fields: Record<string, unknown>): void;
}
