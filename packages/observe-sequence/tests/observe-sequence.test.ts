import { describe, it, expect, beforeEach } from 'vitest';
import { ObserveSequence, idStringify, idParse, diffQueryOrderedChanges } from '../src/index';
import type { ReactiveSystem, Computation, SequenceCallbacks } from '../src/index';

// ---------------------------------------------------------------------------
// Simple synchronous reactive system for testing
// ---------------------------------------------------------------------------
class SimpleReactiveVar<T> {
  private _value: T;
  private _deps = new Set<() => void>();

  constructor(value: T) {
    this._value = value;
  }

  get(): T {
    if (currentDep) this._deps.add(currentDep);
    return this._value;
  }

  set(value: T): void {
    this._value = value;
    // Run deps synchronously
    const deps = [...this._deps];
    deps.forEach((fn) => fn());
  }
}

let currentDep: (() => void) | null = null;

const simpleReactiveSystem: ReactiveSystem = {
  autorun(fn: (computation: Computation) => void): Computation {
    let stopped = false;
    const computation: Computation = {
      stop() {
        stopped = true;
      },
    };

    const runComputation = () => {
      if (stopped) return;
      currentDep = runComputation;
      fn(computation);
      currentDep = null;
    };

    runComputation();
    return computation;
  },

  nonReactive<T>(fn: () => T): T {
    const prev = currentDep;
    currentDep = null;
    const result = fn();
    currentDep = prev;
    return result;
  },
};

// ---------------------------------------------------------------------------
// Logger helper for tracking callbacks
// ---------------------------------------------------------------------------
interface LogEntry {
  type: 'addedAt' | 'changedAt' | 'removedAt' | 'movedTo';
  id: unknown;
  item?: unknown;
  oldItem?: unknown;
  index?: number;
  fromIndex?: number;
  toIndex?: number;
  before?: unknown;
}

function createLogger(): { log: LogEntry[]; callbacks: SequenceCallbacks } {
  const log: LogEntry[] = [];
  const callbacks: SequenceCallbacks = {
    addedAt(id, item, index, before) {
      log.push({ type: 'addedAt', id, item, index, before });
    },
    changedAt(id, newItem, oldItem, index) {
      log.push({ type: 'changedAt', id, item: newItem, oldItem, index });
    },
    removedAt(id, item, index) {
      log.push({ type: 'removedAt', id, item, index });
    },
    movedTo(id, item, fromIndex, toIndex, before) {
      log.push({ type: 'movedTo', id, item, fromIndex, toIndex, before });
    },
  };
  return { log, callbacks };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('observe-sequence - idStringify/idParse', () => {
  it('should round-trip string IDs', () => {
    expect(idParse(idStringify('hello'))).toBe('hello');
    expect(idParse(idStringify(''))).toBe('');
    expect(idParse(idStringify('-prefixed'))).toBe('-prefixed');
  });

  it('should round-trip numeric IDs', () => {
    expect(idParse(idStringify(42))).toBe(42);
    expect(idParse(idStringify(0))).toBe(0);
    expect(idParse(idStringify(-1))).toBe(-1);
  });

  it('should round-trip boolean IDs', () => {
    expect(idParse(idStringify(true))).toBe(true);
    expect(idParse(idStringify(false))).toBe(false);
  });

  it('should round-trip null and undefined', () => {
    expect(idParse(idStringify(null))).toBe(null);
    expect(idParse(idStringify(undefined))).toBe(undefined);
  });
});

describe('observe-sequence - diffQueryOrderedChanges', () => {
  it('should detect additions', () => {
    const added: unknown[] = [];
    diffQueryOrderedChanges([], [{ _id: 'a' }, { _id: 'b' }], {
      addedBefore(id, _fields, before) {
        added.push({ id, before });
      },
    });
    expect(added).toEqual([
      { id: 'a', before: null },
      { id: 'b', before: null },
    ]);
  });

  it('should detect removals', () => {
    const removed: unknown[] = [];
    diffQueryOrderedChanges([{ _id: 'a' }, { _id: 'b' }], [], {
      removed(id) {
        removed.push(id);
      },
    });
    expect(removed).toEqual(['a', 'b']);
  });

  it('should detect moves', () => {
    const moves: unknown[] = [];
    diffQueryOrderedChanges([{ _id: 'a' }, { _id: 'b' }], [{ _id: 'b' }, { _id: 'a' }], {
      movedBefore(id, before) {
        moves.push({ id, before });
      },
    });
    expect(moves.length).toBeGreaterThan(0);
  });
});

describe('observe-sequence - ObserveSequence.observe', () => {
  beforeEach(() => {
    ObserveSequence.setReactiveSystem(simpleReactiveSystem);
  });

  it('should throw without reactive system', () => {
    ObserveSequence.setReactiveSystem(null as unknown as ReactiveSystem);
    const { callbacks } = createLogger();
    expect(() => {
      ObserveSequence.observe(() => [1, 2, 3], callbacks);
    }).toThrow(/No reactive system/);
  });

  it('should observe initial array', () => {
    const { log, callbacks } = createLogger();
    const handle = ObserveSequence.observe(() => [1, 2, 3], callbacks);

    // Should fire addedAt for each item
    const additions = log.filter((e) => e.type === 'addedAt');
    expect(additions).toHaveLength(3);
    expect(additions[0]!.item).toBe(1);
    expect(additions[1]!.item).toBe(2);
    expect(additions[2]!.item).toBe(3);

    handle.stop();
  });

  it('should observe null/falsey as empty', () => {
    const { log, callbacks } = createLogger();
    const handle = ObserveSequence.observe(() => null, callbacks);
    expect(log).toHaveLength(0);
    handle.stop();
  });

  it('should observe string arrays with "-" prefix IDs', () => {
    const { log, callbacks } = createLogger();
    const handle = ObserveSequence.observe(() => ['a', 'b', 'c'], callbacks);

    const additions = log.filter((e) => e.type === 'addedAt');
    expect(additions).toHaveLength(3);
    expect(additions[0]!.item).toBe('a');
    expect(additions[0]!.id).toBe('-a');

    handle.stop();
  });

  it('should observe objects with _id', () => {
    const items = [
      { _id: 'x', name: 'X' },
      { _id: 'y', name: 'Y' },
    ];
    const { log, callbacks } = createLogger();
    const handle = ObserveSequence.observe(() => items, callbacks);

    const additions = log.filter((e) => e.type === 'addedAt');
    expect(additions).toHaveLength(2);
    expect(additions[0]!.id).toBe('x');
    expect(additions[1]!.id).toBe('y');

    handle.stop();
  });

  it('should handle reactive changes', () => {
    const rv = new SimpleReactiveVar<number[]>([1, 2, 3]);
    const { log, callbacks } = createLogger();

    const handle = ObserveSequence.observe(() => rv.get(), callbacks);

    // Initial state
    expect(log.filter((e) => e.type === 'addedAt')).toHaveLength(3);

    // Change the sequence
    log.length = 0;
    rv.set([1, 2, 3, 4]);

    // Should fire addedAt for the new item
    const newAdditions = log.filter((e) => e.type === 'addedAt');
    expect(newAdditions).toHaveLength(1);
    expect(newAdditions[0]!.item).toBe(4);

    handle.stop();
  });

  it('should handle removals on reactive update', () => {
    const rv = new SimpleReactiveVar<number[]>([1, 2, 3]);
    const { log, callbacks } = createLogger();

    const handle = ObserveSequence.observe(() => rv.get(), callbacks);
    log.length = 0;

    rv.set([1, 3]);

    const removals = log.filter((e) => e.type === 'removedAt');
    expect(removals).toHaveLength(1);
    expect(removals[0]!.item).toBe(2);

    handle.stop();
  });

  it('should handle iterables', () => {
    const set = new Set([10, 20, 30]);
    const { log, callbacks } = createLogger();
    const handle = ObserveSequence.observe(() => set, callbacks);

    const additions = log.filter((e) => e.type === 'addedAt');
    expect(additions).toHaveLength(3);

    handle.stop();
  });
});

describe('observe-sequence - ObserveSequence.fetch', () => {
  it('should fetch from null', () => {
    expect(ObserveSequence.fetch(null)).toEqual([]);
  });

  it('should fetch from array', () => {
    expect(ObserveSequence.fetch([1, 2, 3])).toEqual([1, 2, 3]);
  });

  it('should fetch from iterable', () => {
    const set = new Set([1, 2, 3]);
    expect(ObserveSequence.fetch(set)).toEqual([1, 2, 3]);
  });

  it('should fetch from cursor-like', () => {
    const cursor = {
      observe: () => ({ stop() {} }),
      fetch: () => [{ _id: '1' }, { _id: '2' }],
    };
    expect(ObserveSequence.fetch(cursor)).toEqual([{ _id: '1' }, { _id: '2' }]);
  });
});
