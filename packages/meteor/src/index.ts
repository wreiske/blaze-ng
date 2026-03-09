/**
 * @blaze-ng/meteor — Meteor Tracker adapter for Blaze-NG.
 *
 * Bridges Meteor's `Tracker` reactive system to the `ReactiveSystem`
 * interface expected by `@blaze-ng/core`. Import this package once in
 * your Meteor app to wire up Tracker as the reactive backend.
 *
 * @example
 * ```ts
 * import { Tracker } from 'meteor/tracker';
 * import { ReactiveVar } from 'meteor/reactive-var';
 * import { createTrackerAdapter } from '@blaze-ng/meteor';
 * import { setReactiveSystem } from '@blaze-ng/core';
 *
 * const adapter = createTrackerAdapter(Tracker, ReactiveVar);
 * setReactiveSystem(adapter);
 * ```
 */

import type {
  ReactiveSystem,
  Computation,
  ReactiveVar,
  Dependency,
} from '@blaze-ng/core';

/* -------------------------------------------------------------------------- */
/*  Meteor type stubs (avoid hard dependency on @types/meteor)                */
/* -------------------------------------------------------------------------- */

/** Minimal shape of Meteor's `Tracker` we rely on. */
export interface MeteorTracker {
  autorun(fn: (c: MeteorComputation) => void): MeteorComputation;
  nonreactive<T>(fn: () => T): T;
  afterFlush(fn: () => void): void;
  flush(): void;
  active: boolean;
  currentComputation: MeteorComputation | null;
  Dependency: new () => MeteorDependency;
}

/** Minimal shape of a Tracker.Computation. */
export interface MeteorComputation {
  stop(): void;
  onInvalidate(fn: () => void): void;
  onStop(fn: () => void): void;
  firstRun: boolean;
  stopped: boolean;
  invalidated: boolean;
}

/** Minimal shape of Tracker.Dependency. */
export interface MeteorDependency {
  depend(): boolean;
  changed(): void;
  hasDependents(): boolean;
}

/** Constructor shape for Meteor ReactiveVar. */
export interface MeteorReactiveVarConstructor {
  new <T>(initialValue: T, equalsFn?: (a: T, b: T) => boolean): MeteorReactiveVarInstance<T>;
}

/** Minimal shape of a Meteor ReactiveVar instance. */
export interface MeteorReactiveVarInstance<T> {
  get(): T;
  set(value: T): void;
}

/* -------------------------------------------------------------------------- */
/*  TrackerAdapter                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Adapts Meteor Tracker + ReactiveVar to the Blaze-NG ReactiveSystem interface.
 *
 * This class wraps Meteor's Tracker and ReactiveVar packages, translating
 * their APIs to the framework-agnostic interface that `@blaze-ng/core` expects.
 */
class TrackerAdapter implements ReactiveSystem {
  private _tracker: MeteorTracker;
  private _ReactiveVarCtor: MeteorReactiveVarConstructor;

  /**
   * @param tracker - The Meteor `Tracker` object.
   * @param ReactiveVarCtor - The Meteor `ReactiveVar` constructor.
   */
  constructor(tracker: MeteorTracker, ReactiveVarCtor: MeteorReactiveVarConstructor) {
    this._tracker = tracker;
    this._ReactiveVarCtor = ReactiveVarCtor;
  }

  /**
   * Run a function reactively via Tracker.autorun.
   *
   * @param fn - The reactive function to run.
   * @returns A computation handle that can be stopped.
   */
  autorun(fn: (computation: Computation) => void): Computation {
    return this._tracker.autorun(fn as (c: MeteorComputation) => void);
  }

  /**
   * Run a function without reactive tracking via Tracker.nonreactive.
   *
   * @param fn - The function to execute non-reactively.
   * @returns The return value of fn.
   */
  nonReactive<T>(fn: () => T): T {
    return this._tracker.nonreactive(fn);
  }

  /**
   * Schedule a callback after the current Tracker flush.
   *
   * @param fn - The callback to run after flush.
   */
  afterFlush(fn: () => void): void {
    this._tracker.afterFlush(fn);
  }

  /**
   * Immediately process pending Tracker invalidations.
   */
  flush(): void {
    this._tracker.flush();
  }

  /** Whether a reactive computation is currently active. */
  get active(): boolean {
    return this._tracker.active;
  }

  /**
   * Register an onInvalidate callback on the current Tracker computation.
   *
   * @param fn - The callback to run on invalidation.
   */
  onInvalidate(fn: () => void): void {
    const comp = this._tracker.currentComputation;
    if (comp) {
      comp.onInvalidate(fn);
    }
  }

  /**
   * Create a new Meteor ReactiveVar.
   *
   * @param initialValue - The initial value.
   * @param equalsFn - Optional custom equality function.
   * @returns A new ReactiveVar instance.
   */
  ReactiveVar<T>(initialValue: T, equalsFn?: (a: T, b: T) => boolean): ReactiveVar<T> {
    return new this._ReactiveVarCtor(initialValue, equalsFn);
  }

  /**
   * Create a new Tracker.Dependency.
   *
   * @returns A new Dependency instance.
   */
  Dependency(): Dependency {
    return new this._tracker.Dependency();
  }
}

/* -------------------------------------------------------------------------- */
/*  Factory function                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Create a TrackerAdapter and optionally register it as the reactive system.
 *
 * @param tracker - The Meteor `Tracker` object (from `meteor/tracker`).
 * @param ReactiveVarCtor - The Meteor `ReactiveVar` constructor (from `meteor/reactive-var`).
 * @returns A ReactiveSystem backed by Meteor Tracker.
 *
 * @example
 * ```ts
 * import { Tracker } from 'meteor/tracker';
 * import { ReactiveVar } from 'meteor/reactive-var';
 * import { createTrackerAdapter } from '@blaze-ng/meteor';
 * import { setReactiveSystem } from '@blaze-ng/core';
 *
 * setReactiveSystem(createTrackerAdapter(Tracker, ReactiveVar));
 * ```
 */
export function createTrackerAdapter(
  tracker: MeteorTracker,
  ReactiveVarCtor: MeteorReactiveVarConstructor,
): ReactiveSystem {
  return new TrackerAdapter(tracker, ReactiveVarCtor);
}

export type { ReactiveSystem, Computation, ReactiveVar, Dependency };
