/**
 * Tests for @blaze-ng/meteor TrackerAdapter.
 *
 * Uses a mock Tracker and ReactiveVar to verify the adapter correctly
 * delegates to Meteor's reactive system.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createTrackerAdapter,
  type MeteorTracker,
  type MeteorComputation,
  type MeteorReactiveVarConstructor,
  type MeteorDependency,
} from '../src/index';
import type { ReactiveSystem } from '@blaze-ng/core';

/* -------------------------------------------------------------------------- */
/*  Mock Meteor Tracker                                                       */
/* -------------------------------------------------------------------------- */

function createMockTracker(): MeteorTracker {
  let _active = false;
  let _currentComputation: MeteorComputation | null = null;

  const mockComp: MeteorComputation = {
    stop: vi.fn(),
    onInvalidate: vi.fn(),
    onStop: vi.fn(),
    firstRun: true,
    stopped: false,
    invalidated: false,
  };

  const mockDep: MeteorDependency = {
    depend: vi.fn(() => true),
    changed: vi.fn(),
    hasDependents: vi.fn(() => false),
  };

  return {
    autorun: vi.fn((fn) => {
      _active = true;
      _currentComputation = mockComp;
      fn(mockComp);
      _active = false;
      _currentComputation = null;
      return mockComp;
    }),
    nonreactive: vi.fn((fn) => {
      const prevActive = _active;
      _active = false;
      const result = fn();
      _active = prevActive;
      return result;
    }),
    afterFlush: vi.fn(),
    flush: vi.fn(),
    get active() {
      return _active;
    },
    get currentComputation() {
      return _currentComputation;
    },
    Dependency: vi.fn(() => mockDep) as unknown as new () => MeteorDependency,
  };
}

function createMockReactiveVar(): MeteorReactiveVarConstructor {
  return vi.fn((initialValue, _equalsFn) => ({
    get: vi.fn(() => initialValue),
    set: vi.fn(),
  })) as unknown as MeteorReactiveVarConstructor;
}

/* -------------------------------------------------------------------------- */
/*  Tests                                                                     */
/* -------------------------------------------------------------------------- */

describe('TrackerAdapter', () => {
  let tracker: MeteorTracker;
  let ReactiveVarCtor: MeteorReactiveVarConstructor;
  let adapter: ReactiveSystem;

  beforeEach(() => {
    tracker = createMockTracker();
    ReactiveVarCtor = createMockReactiveVar();
    adapter = createTrackerAdapter(tracker, ReactiveVarCtor);
  });

  it('creates an adapter implementing ReactiveSystem', () => {
    expect(adapter).toBeDefined();
    expect(typeof adapter.autorun).toBe('function');
    expect(typeof adapter.nonReactive).toBe('function');
    expect(typeof adapter.afterFlush).toBe('function');
    expect(typeof adapter.flush).toBe('function');
    expect(typeof adapter.onInvalidate).toBe('function');
    expect(typeof adapter.ReactiveVar).toBe('function');
    expect(typeof adapter.Dependency).toBe('function');
  });

  describe('autorun', () => {
    it('delegates to Tracker.autorun', () => {
      const fn = vi.fn();
      const comp = adapter.autorun(fn);
      expect(tracker.autorun).toHaveBeenCalledWith(fn);
      expect(comp).toBeDefined();
      expect(typeof comp.stop).toBe('function');
    });

    it('returns a computation handle', () => {
      const comp = adapter.autorun(() => {});
      expect(comp.firstRun).toBe(true);
      expect(comp.stopped).toBe(false);
    });
  });

  describe('nonReactive', () => {
    it('delegates to Tracker.nonreactive', () => {
      const result = adapter.nonReactive(() => 42);
      expect(tracker.nonreactive).toHaveBeenCalled();
      expect(result).toBe(42);
    });
  });

  describe('afterFlush', () => {
    it('delegates to Tracker.afterFlush', () => {
      const fn = vi.fn();
      adapter.afterFlush(fn);
      expect(tracker.afterFlush).toHaveBeenCalledWith(fn);
    });
  });

  describe('flush', () => {
    it('delegates to Tracker.flush', () => {
      adapter.flush();
      expect(tracker.flush).toHaveBeenCalled();
    });
  });

  describe('active', () => {
    it('reflects Tracker.active state', () => {
      // Outside an autorun, should be false
      expect(adapter.active).toBe(false);
    });
  });

  describe('onInvalidate', () => {
    it('is a no-op when no computation is active', () => {
      // Should not throw
      adapter.onInvalidate(() => {});
    });
  });

  describe('ReactiveVar', () => {
    it('creates a reactive variable via constructor', () => {
      const rv = adapter.ReactiveVar(10);
      expect(ReactiveVarCtor).toHaveBeenCalledWith(10, undefined);
      expect(rv.get()).toBe(10);
    });

    it('passes equalsFn to constructor', () => {
      const eq = (a: number, b: number) => a === b;
      adapter.ReactiveVar(5, eq);
      expect(ReactiveVarCtor).toHaveBeenCalledWith(5, eq);
    });
  });

  describe('Dependency', () => {
    it('creates a dependency via Tracker.Dependency', () => {
      const dep = adapter.Dependency();
      expect(tracker.Dependency).toHaveBeenCalled();
      expect(typeof dep.depend).toBe('function');
      expect(typeof dep.changed).toBe('function');
      expect(typeof dep.hasDependents).toBe('function');
    });
  });
});
