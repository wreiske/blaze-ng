/**
 * A minimal computation handle returned by a reactive system.
 *
 * This extends the base `Computation` from observe-sequence with
 * additional properties needed by the Blaze view engine.
 */
export interface Computation {
  /** Stop this computation from re-running. */
  stop(): void;
  /** Register a callback for when this computation is invalidated. */
  onInvalidate(fn: () => void): void;
  /** Register a callback for when this computation is stopped. */
  onStop(fn: () => void): void;
  /** Whether this is the first run of the computation. */
  firstRun: boolean;
  /** Whether this computation has been stopped. */
  stopped: boolean;
  /** Whether this computation has been invalidated. */
  invalidated: boolean;
}

/**
 * A reactive variable that holds a value and triggers reactive updates
 * when the value changes.
 */
export interface ReactiveVar<T> {
  /** Get the current value, establishing a reactive dependency. */
  get(): T;
  /** Set the value, triggering reactive dependents if changed. */
  set(value: T): void;
}

/**
 * A binding represents the state of a reactive value:
 * - `undefined` → pending (async, not yet resolved)
 * - `{ error }` → rejected
 * - `{ value }` → resolved
 */
export type Binding =
  | undefined
  | { error: unknown; value?: never }
  | { value: unknown; error?: never };

/**
 * A reactive dependency that can be depended upon and changed.
 */
export interface Dependency {
  /** Register the current computation as a dependent. */
  depend(): boolean;
  /** Invalidate all dependent computations. */
  changed(): void;
  /** Whether any computations depend on this. */
  hasDependents(): boolean;
}

/**
 * Abstraction over a reactive system (e.g. Meteor Tracker, Solid signals).
 *
 * This decouples the Blaze view engine from any specific reactive runtime.
 * Provide an implementation via `Blaze.setReactiveSystem()`.
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

  /**
   * Schedule a callback to run after the current reactive flush completes.
   *
   * @param fn - The callback to run after flush.
   */
  afterFlush(fn: () => void): void;

  /**
   * Immediately process all pending reactive invalidations.
   */
  flush(): void;

  /**
   * Whether we are currently inside a reactive computation.
   */
  readonly active: boolean;

  /**
   * Register a callback on the current computation for when it is invalidated.
   * No-op if there is no active computation.
   *
   * @param fn - The callback to run on invalidation.
   */
  onInvalidate(fn: () => void): void;

  /**
   * Create a new ReactiveVar with an initial value.
   *
   * @param initialValue - The initial value.
   * @param equalsFn - Optional custom equality function.
   * @returns A new ReactiveVar instance.
   */
  ReactiveVar<T>(initialValue: T, equalsFn?: (a: T, b: T) => boolean): ReactiveVar<T>;

  /**
   * Create a new Dependency instance.
   *
   * @returns A new Dependency instance.
   */
  Dependency(): Dependency;
}
