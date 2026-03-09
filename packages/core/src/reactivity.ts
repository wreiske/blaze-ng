/**
 * A simple in-memory reactive system for testing.
 *
 * This is not intended for production use. It provides a minimal
 * implementation of the ReactiveSystem interface sufficient for
 * unit testing the Blaze view engine without depending on Meteor Tracker.
 */
import type { ReactiveSystem, Computation, ReactiveVar, Dependency } from './types';

/** A minimal computation. */
class SimpleComputation implements Computation {
  firstRun = true;
  stopped = false;
  invalidated = false;

  private _fn: (c: Computation) => void;
  private _onInvalidateCbs: (() => void)[] = [];
  private _onStopCbs: (() => void)[] = [];
  private _system: SimpleReactiveSystem;

  constructor(fn: (c: Computation) => void, system: SimpleReactiveSystem) {
    this._fn = fn;
    this._system = system;
  }

  /** Run the computation function. */
  _run(): void {
    const prev = this._system._currentComputation;
    this._system._currentComputation = this;
    this.invalidated = false;
    try {
      this._fn(this);
    } finally {
      this._system._currentComputation = prev;
      this.firstRun = false;
    }
  }

  /** Invalidate this computation, scheduling a re-run. */
  invalidate(): void {
    if (this.stopped || this.invalidated) return;
    this.invalidated = true;
    for (const cb of this._onInvalidateCbs) cb();
    this._onInvalidateCbs = [];
    if (!this.stopped) {
      this._system._pendingComputations.add(this);
    }
  }

  stop(): void {
    if (this.stopped) return;
    this.stopped = true;
    this.invalidated = true;
    for (const cb of this._onInvalidateCbs) cb();
    this._onInvalidateCbs = [];
    for (const cb of this._onStopCbs) cb();
    this._onStopCbs = [];
    this._system._pendingComputations.delete(this);
  }

  onInvalidate(fn: () => void): void {
    if (this.invalidated) {
      fn();
    } else {
      this._onInvalidateCbs.push(fn);
    }
  }

  onStop(fn: () => void): void {
    if (this.stopped) {
      fn();
    } else {
      this._onStopCbs.push(fn);
    }
  }
}

/** A minimal reactive dependency. */
class SimpleDependency implements Dependency {
  private _dependents = new Set<SimpleComputation>();

  depend(): boolean {
    const comp = SimpleReactiveSystem._instance?._currentComputation as SimpleComputation | null;
    if (comp && !comp.stopped) {
      this._dependents.add(comp);
      comp.onStop(() => this._dependents.delete(comp));
      return true;
    }
    return false;
  }

  changed(): void {
    for (const comp of this._dependents) {
      comp.invalidate();
    }
  }

  hasDependents(): boolean {
    return this._dependents.size > 0;
  }
}

/** A minimal reactive variable. */
class SimpleReactiveVar<T> implements ReactiveVar<T> {
  private _value: T;
  private _dep = new SimpleDependency();
  private _equalsFn: (a: T, b: T) => boolean;

  constructor(initialValue: T, equalsFn?: (a: T, b: T) => boolean) {
    this._value = initialValue;
    this._equalsFn = equalsFn || ((a, b) => a === b);
  }

  get(): T {
    this._dep.depend();
    return this._value;
  }

  set(value: T): void {
    if (!this._equalsFn(this._value, value)) {
      this._value = value;
      this._dep.changed();
    }
  }
}

/**
 * A simple synchronous reactive system for testing Blaze views.
 *
 * Implements the `ReactiveSystem` interface with minimal overhead.
 * Flush is synchronous — call `flush()` to process all pending invalidations.
 *
 * @example
 * ```ts
 * const system = new SimpleReactiveSystem();
 * Blaze.setReactiveSystem(system);
 * ```
 */
export class SimpleReactiveSystem implements ReactiveSystem {
  /** @internal Singleton reference for SimpleDependency to access. */
  static _instance: SimpleReactiveSystem | null = null;

  /** @internal The current active computation, or null. */
  _currentComputation: Computation | null = null;

  /** @internal Set of computations that need re-running. */
  _pendingComputations = new Set<SimpleComputation>();

  /** @internal Callbacks to run after flush. */
  private _afterFlushCallbacks: (() => void)[] = [];

  /** @internal Whether we're currently flushing. */
  private _flushing = false;

  constructor() {
    SimpleReactiveSystem._instance = this;
  }

  autorun(fn: (computation: Computation) => void): Computation {
    const comp = new SimpleComputation(fn, this);
    comp._run();
    return comp;
  }

  nonReactive<T>(fn: () => T): T {
    const prev = this._currentComputation;
    this._currentComputation = null;
    try {
      return fn();
    } finally {
      this._currentComputation = prev;
    }
  }

  afterFlush(fn: () => void): void {
    this._afterFlushCallbacks.push(fn);
  }

  flush(): void {
    if (this._flushing) return;
    this._flushing = true;
    try {
      // Process pending computations until stable
      let iterations = 0;
      while (this._pendingComputations.size > 0 || this._afterFlushCallbacks.length > 0) {
        if (++iterations > 1000) {
          throw new Error('Reactive flush loop: exceeded 1000 iterations');
        }

        // Re-run pending computations
        const pending = [...this._pendingComputations];
        this._pendingComputations.clear();
        for (const comp of pending) {
          if (!comp.stopped) {
            comp._run();
          }
        }

        // Run afterFlush callbacks
        const callbacks = this._afterFlushCallbacks.splice(0);
        for (const cb of callbacks) {
          cb();
        }
      }
    } finally {
      this._flushing = false;
    }
  }

  get active(): boolean {
    return this._currentComputation !== null;
  }

  onInvalidate(fn: () => void): void {
    if (this._currentComputation) {
      this._currentComputation.onInvalidate(fn);
    }
  }

  ReactiveVar<T>(initialValue: T, equalsFn?: (a: T, b: T) => boolean): ReactiveVar<T> {
    return new SimpleReactiveVar(initialValue, equalsFn);
  }

  Dependency(): Dependency {
    return new SimpleDependency();
  }
}
