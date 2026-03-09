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

// ---------------------------------------------------------------------------
// Array transition tests (ported from original observe_sequence_tests.js)
// ---------------------------------------------------------------------------

describe('observe-sequence - array transitions', () => {
  beforeEach(() => {
    ObserveSequence.setReactiveSystem(simpleReactiveSystem);
  });

  it('array to other array (replace item)', () => {
    const rv = new SimpleReactiveVar([{ _id: '13', foo: 1 }, { _id: '37', bar: 2 }]);
    const { log, callbacks } = createLogger();

    const handle = ObserveSequence.observe(() => rv.get(), callbacks);

    // Initial adds
    expect(log.filter((e) => e.type === 'addedAt')).toHaveLength(2);
    log.length = 0;

    rv.set([{ _id: '13', foo: 1 }, { _id: '38', bar: 2 }]);

    const removals = log.filter((e) => e.type === 'removedAt');
    const additions = log.filter((e) => e.type === 'addedAt');
    expect(removals).toHaveLength(1);
    expect(removals[0]!.id).toBe('37');
    expect(additions).toHaveLength(1);
    expect(additions[0]!.id).toBe('38');

    handle.stop();
  });

  it('array to other array, strings', () => {
    const rv = new SimpleReactiveVar(['A', 'B']);
    const { log, callbacks } = createLogger();

    const handle = ObserveSequence.observe(() => rv.get(), callbacks);
    expect(log.filter((e) => e.type === 'addedAt')).toHaveLength(2);
    log.length = 0;

    rv.set(['B', 'C']);

    const removals = log.filter((e) => e.type === 'removedAt');
    const additions = log.filter((e) => e.type === 'addedAt');
    expect(removals).toHaveLength(1);
    expect(removals[0]!.item).toBe('A');
    expect(additions).toHaveLength(1);
    expect(additions[0]!.item).toBe('C');

    handle.stop();
  });

  it('array with null values (bug #7850)', () => {
    const { log, callbacks } = createLogger();
    const handle = ObserveSequence.observe(() => [1, null], callbacks);

    const adds = log.filter((e) => e.type === 'addedAt');
    expect(adds).toHaveLength(2);
    expect(adds[0]!.item).toBe(1);
    expect(adds[1]!.item).toBe(null);

    handle.stop();
  });

  it('array to other array, objects without ids', () => {
    const rv = new SimpleReactiveVar([{ foo: 1 }, { bar: 2 }]);
    const { log, callbacks } = createLogger();

    const handle = ObserveSequence.observe(() => rv.get(), callbacks);
    expect(log.filter((e) => e.type === 'addedAt')).toHaveLength(2);
    log.length = 0;

    rv.set([{ foo: 2 }]);

    const removals = log.filter((e) => e.type === 'removedAt');
    const changes = log.filter((e) => e.type === 'changedAt');
    expect(removals).toHaveLength(1);
    expect(changes).toHaveLength(1);

    handle.stop();
  });

  it('array to other array, changes', () => {
    const rv = new SimpleReactiveVar([
      { _id: '13', foo: 1 },
      { _id: '37', bar: 2 },
      { _id: '42', baz: 42 },
    ]);
    const { log, callbacks } = createLogger();

    const handle = ObserveSequence.observe(() => rv.get(), callbacks);
    expect(log.filter((e) => e.type === 'addedAt')).toHaveLength(3);
    log.length = 0;

    rv.set([
      { _id: '13', foo: 1 },
      { _id: '38', bar: 2 },
      { _id: '42', baz: 43 },
    ]);

    const removals = log.filter((e) => e.type === 'removedAt');
    const additions = log.filter((e) => e.type === 'addedAt');
    expect(removals).toHaveLength(1);
    expect(removals[0]!.id).toBe('37');
    expect(additions).toHaveLength(1);
    expect(additions[0]!.id).toBe('38');

    handle.stop();
  });

  it('array to other array, movedTo', () => {
    const rv = new SimpleReactiveVar([
      { _id: '13', foo: 1 },
      { _id: '37', bar: 2 },
      { _id: '42', baz: 42 },
      { _id: '43', baz: 43 },
    ]);
    const { log, callbacks } = createLogger();

    const handle = ObserveSequence.observe(() => rv.get(), callbacks);
    expect(log.filter((e) => e.type === 'addedAt')).toHaveLength(4);
    log.length = 0;

    // Reverse first and last, keep middle
    rv.set([
      { _id: '43', baz: 43 },
      { _id: '37', bar: 2 },
      { _id: '42', baz: 42 },
      { _id: '13', foo: 1 },
    ]);

    const moves = log.filter((e) => e.type === 'movedTo');
    expect(moves.length).toBeGreaterThan(0);

    handle.stop();
  });

  it('array to other array, movedTo the end', () => {
    const rv = new SimpleReactiveVar([
      { _id: '0' },
      { _id: '1' },
      { _id: '2' },
      { _id: '3' },
    ]);
    const { log, callbacks } = createLogger();

    const handle = ObserveSequence.observe(() => rv.get(), callbacks);
    log.length = 0;

    rv.set([
      { _id: '0' },
      { _id: '2' },
      { _id: '3' },
      { _id: '1' },
    ]);

    const moves = log.filter((e) => e.type === 'movedTo');
    expect(moves).toHaveLength(1);
    expect(moves[0]!.id).toBe('1');

    handle.stop();
  });

  it('array to other array, movedTo later position #2845', () => {
    const rv = new SimpleReactiveVar([
      { _id: '0' },
      { _id: '1' },
      { _id: '2' },
      { _id: '3' },
    ]);
    const { log, callbacks } = createLogger();

    const handle = ObserveSequence.observe(() => rv.get(), callbacks);
    log.length = 0;

    rv.set([
      { _id: '1' },
      { _id: '2' },
      { _id: '0' },
      { _id: '3' },
    ]);

    const moves = log.filter((e) => e.type === 'movedTo');
    expect(moves).toHaveLength(1);
    expect(moves[0]!.id).toBe('0');

    handle.stop();
  });

  it('array to other array, movedTo earlier position', () => {
    const rv = new SimpleReactiveVar([
      { _id: '0' },
      { _id: '1' },
      { _id: '2' },
      { _id: '3' },
      { _id: '4' },
    ]);
    const { log, callbacks } = createLogger();

    const handle = ObserveSequence.observe(() => rv.get(), callbacks);
    log.length = 0;

    rv.set([
      { _id: '0' },
      { _id: '4' },
      { _id: '1' },
      { _id: '2' },
      { _id: '3' },
    ]);

    const moves = log.filter((e) => e.type === 'movedTo');
    expect(moves).toHaveLength(1);
    expect(moves[0]!.id).toBe('4');

    handle.stop();
  });

  it('array to null', () => {
    const rv = new SimpleReactiveVar<unknown[] | null>([
      { _id: '13', foo: 1 },
      { _id: '37', bar: 2 },
    ]);
    const { log, callbacks } = createLogger();

    const handle = ObserveSequence.observe(() => rv.get(), callbacks);
    expect(log.filter((e) => e.type === 'addedAt')).toHaveLength(2);
    log.length = 0;

    rv.set(null);

    const removals = log.filter((e) => e.type === 'removedAt');
    expect(removals).toHaveLength(2);

    handle.stop();
  });

  it('number arrays with duplicates', () => {
    const rv = new SimpleReactiveVar([1, 1, 2]);
    const { log, callbacks } = createLogger();

    const handle = ObserveSequence.observe(() => rv.get(), callbacks);
    expect(log.filter((e) => e.type === 'addedAt')).toHaveLength(3);
    log.length = 0;

    rv.set([1, 3, 2, 3]);

    // Should remove one 1, add two 3s (or equivalent)
    const removals = log.filter((e) => e.type === 'removedAt');
    const additions = log.filter((e) => e.type === 'addedAt');
    expect(removals.length).toBeGreaterThanOrEqual(1);
    expect(additions.length).toBeGreaterThanOrEqual(1);

    handle.stop();
  });

  it('_id:0 correctly handled, no duplicate ids #4049', () => {
    const rv = new SimpleReactiveVar([{ _id: 0 }, { _id: 1 }, { _id: 2 }]);
    const { log, callbacks } = createLogger();

    const handle = ObserveSequence.observe(() => rv.get(), callbacks);

    const adds = log.filter((e) => e.type === 'addedAt');
    expect(adds).toHaveLength(3);
    // _id: 0 should be treated as a valid id, not as index
    expect(adds[0]!.id).toBe(0);

    log.length = 0;

    rv.set([{ _id: 1 }, { _id: 2 }, { _id: 0 }]);

    const moves = log.filter((e) => e.type === 'movedTo');
    expect(moves.length).toBeGreaterThan(0);
    // The moved item should be id 0
    expect(moves.some((m) => m.id === 0)).toBe(true);

    handle.stop();
  });

  it('cursor-like to array transition', () => {
    let useCursor = true;
    const arrayData = [{ _id: '13', foo: 1 }, { _id: '38', bar: 2 }];
    const cursorData = [{ _id: '13', foo: 1 }, { _id: '37', bar: 2 }];

    const cursor = {
      observe(cbs: Record<string, (...args: unknown[]) => void>) {
        cursorData.forEach((item, i) => {
          cbs.addedAt?.(item, i, null);
        });
        return { stop() {} };
      },
      fetch: () => [...cursorData],
    };

    const rv = new SimpleReactiveVar<unknown>(cursor);
    const { log, callbacks } = createLogger();

    const handle = ObserveSequence.observe(() => rv.get(), callbacks);
    expect(log.filter((e) => e.type === 'addedAt')).toHaveLength(2);
    log.length = 0;

    // Switch from cursor to array
    rv.set(arrayData);

    const removals = log.filter((e) => e.type === 'removedAt');
    const additions = log.filter((e) => e.type === 'addedAt');
    // Should remove id 37 and add id 38
    expect(removals.some((r) => r.id === '37')).toBe(true);
    expect(additions.some((a) => a.id === '38')).toBe(true);

    handle.stop();
  });

  it('empty iterable types', () => {
    const { log: mapLog, callbacks: mapCb } = createLogger();
    const h1 = ObserveSequence.observe(() => new Map(), mapCb);
    expect(mapLog).toHaveLength(0);
    h1.stop();

    const { log: setLog, callbacks: setCb } = createLogger();
    const h2 = ObserveSequence.observe(() => new Set(), setCb);
    expect(setLog).toHaveLength(0);
    h2.stop();
  });

  it('Set iterable with items', () => {
    const { log, callbacks } = createLogger();
    const handle = ObserveSequence.observe(
      () => new Set([{ foo: 1 }, { bar: 2 }]),
      callbacks,
    );

    const adds = log.filter((e) => e.type === 'addedAt');
    expect(adds).toHaveLength(2);
    handle.stop();
  });

  it('duplicate _id arrays with warning', () => {
    const { log, callbacks } = createLogger();
    const handle = ObserveSequence.observe(
      () => [
        { _id: '13', foo: 1 },
        { _id: '13', foo: 2 },
      ],
      callbacks,
    );

    const adds = log.filter((e) => e.type === 'addedAt');
    expect(adds).toHaveLength(2);
    // First should use the actual _id
    expect(adds[0]!.id).toBe('13');
    // Second should get a different id (to avoid collision)
    expect(adds[1]!.id).not.toBe('13');

    handle.stop();
  });
});
