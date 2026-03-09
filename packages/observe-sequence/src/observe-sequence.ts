/**
 * Reactive sequence observing.
 *
 * Observes arrays, cursors, and iterables reactively. Fires callbacks
 * when items are added, changed, removed, or moved. Framework-agnostic:
 * requires a `ReactiveSystem` to be set via `setReactiveSystem()`.
 */

import type {
  ReactiveSystem,
  ObserveHandle,
  StoreCursor,
  SequenceCallbacks,
  SeqEntry,
} from './types';
import { idStringify, idParse } from './id-utils';
import { diffQueryOrderedChanges } from './diff';

let _reactiveSystem: ReactiveSystem | null = null;
let _suppressWarnings = 0;
let _loggedWarnings = 0;

// Simple unique ID generator (replaces Meteor Random.id)
let _idCounter = 0;
const randomId = (): string =>
  '_seq_' + (++_idCounter).toString(36) + '_' + Date.now().toString(36);

const isArray = (val: unknown): val is unknown[] => val instanceof Array || Array.isArray(val);

const isIterable = (obj: unknown): obj is Iterable<unknown> =>
  typeof Symbol !== 'undefined' &&
  typeof Symbol.iterator !== 'undefined' &&
  obj instanceof Object &&
  typeof (obj as Record<symbol, unknown>)[Symbol.iterator] === 'function';

const isFunction = (fn: unknown): fn is (...args: unknown[]) => unknown => typeof fn === 'function';

const isStoreCursor = (cursor: unknown): cursor is StoreCursor =>
  cursor != null &&
  typeof cursor === 'object' &&
  isFunction((cursor as StoreCursor).observe) &&
  isFunction((cursor as StoreCursor).fetch);

const warn = (...args: unknown[]): void => {
  if (_suppressWarnings > 0) {
    _suppressWarnings--;
  } else {
    if (typeof console !== 'undefined' && console.warn) {
      console.warn(...args);
    }
    _loggedWarnings++;
  }
};

const badSequenceError = (sequence: unknown): Error =>
  new Error(
    '{{#each}} currently only accepts arrays, cursors, iterables or falsey values.' +
      sequenceGotValue(sequence),
  );

const sequenceGotValue = (sequence: unknown): string => {
  try {
    return ' Got ' + toDebugStr(sequence);
  } catch {
    return '';
  }
};

const toDebugStr = (value: unknown, maxLength = 150): string => {
  const type = typeof value;
  switch (type) {
    case 'undefined':
      return type;
    case 'number':
      return (value as number).toString();
    case 'string':
      return JSON.stringify(value);
    case 'object':
      if (value === null) return 'null';
      if (Array.isArray(value)) return 'Array [' + arrayToDebugStr(value, maxLength) + ']';
      if (Symbol.iterator in (value as object))
        return (
          (value as object).constructor.name +
          ' [' +
          arrayToDebugStr(Array.from(value as Iterable<unknown>), maxLength) +
          ']'
        );
      return (value as object).constructor.name + ' ' + ellipsis(JSON.stringify(value), maxLength);
    default:
      return type + ': ' + String(value);
  }
};

const ellipsis = (str: string, maxLength = 100): string =>
  str.length < maxLength ? str : str.slice(0, maxLength - 1) + '\u2026';

const arrayToDebugStr = (value: unknown[], maxLength: number): string => {
  let out = '';
  let sep = '';
  for (let i = 0; i < value.length; i++) {
    out += sep + toDebugStr(value[i], maxLength);
    if (out.length > maxLength) return out;
    sep = ', ';
  }
  return out;
};

/**
 * Diff two SeqEntry arrays, firing positional callbacks for add/remove/move/change.
 *
 * @internal
 */
function diffArray<T>(
  lastSeqArray: SeqEntry<T>[],
  seqArray: SeqEntry<T>[],
  callbacks: SequenceCallbacks<T>,
): void {
  const oldIdObjects: { _id: unknown }[] = [];
  const newIdObjects: { _id: unknown }[] = [];
  const posOld: Record<string, number> = {};
  const posNew: Record<string, number> = {};
  const posCur: Record<string, number> = {};
  let lengthCur = lastSeqArray.length;

  seqArray.forEach((doc, i) => {
    newIdObjects.push({ _id: doc._id });
    posNew[idStringify(doc._id)] = i;
  });
  lastSeqArray.forEach((doc, i) => {
    oldIdObjects.push({ _id: doc._id });
    posOld[idStringify(doc._id)] = i;
    posCur[idStringify(doc._id)] = i;
  });

  diffQueryOrderedChanges(oldIdObjects, newIdObjects, {
    addedBefore(id, _doc, before) {
      const position = before != null ? posCur[idStringify(before)]! : lengthCur;

      if (before != null) {
        for (const [curId, pos] of Object.entries(posCur)) {
          if (pos >= position) posCur[curId] = pos + 1;
        }
      }

      lengthCur++;
      posCur[idStringify(id)] = position;

      callbacks.addedAt(id, seqArray[posNew[idStringify(id)]!]!.item, position, before);
    },
    movedBefore(id, before) {
      if (id === before) return;

      const oldPosition = posCur[idStringify(id)]!;
      let newPosition = before != null ? posCur[idStringify(before)]! : lengthCur;

      if (newPosition > oldPosition) newPosition--;

      for (const [curId, elCurPosition] of Object.entries(posCur)) {
        if (oldPosition < elCurPosition && elCurPosition < newPosition) {
          posCur[curId] = elCurPosition - 1;
        } else if (newPosition <= elCurPosition && elCurPosition < oldPosition) {
          posCur[curId] = elCurPosition + 1;
        }
      }

      posCur[idStringify(id)] = newPosition;

      callbacks.movedTo(
        id,
        seqArray[posNew[idStringify(id)]!]!.item,
        oldPosition,
        newPosition,
        before,
      );
    },
    removed(id) {
      const prevPosition = posCur[idStringify(id)]!;

      for (const [curId, pos] of Object.entries(posCur)) {
        if (pos >= prevPosition) posCur[curId] = pos - 1;
      }

      delete posCur[idStringify(id)];
      lengthCur--;

      callbacks.removedAt(id, lastSeqArray[posOld[idStringify(id)]!]!.item, prevPosition);
    },
  });

  // Check for changes in existing items
  for (const [idString, pos] of Object.entries(posNew)) {
    const id = idParse(idString);

    if (Object.prototype.hasOwnProperty.call(posOld, idString)) {
      const newItem = seqArray[pos]!.item;
      const oldItem = lastSeqArray[posOld[idString]!]!.item;

      if (typeof newItem === 'object' || newItem !== oldItem) {
        callbacks.changedAt(id, newItem, oldItem, pos);
      }
    }
  }
}

function seqChangedToArray<T>(
  _lastSeqArray: SeqEntry<T>[],
  array: T[],
  _callbacks: SequenceCallbacks<T>,
): SeqEntry<T>[] {
  const idsUsed: Record<string, boolean> = {};

  return array.map((item, index) => {
    let id: unknown;
    if (typeof item === 'string') {
      id = '-' + item;
    } else if (
      typeof item === 'number' ||
      typeof item === 'boolean' ||
      item === undefined ||
      item === null
    ) {
      id = item;
    } else if (typeof item === 'object') {
      id =
        item && '_id' in (item as Record<string, unknown>)
          ? (item as Record<string, unknown>)._id
          : index;
    } else {
      throw new Error("{{#each}} doesn't support arrays with elements of type " + typeof item);
    }

    const idString = idStringify(id);
    if (idsUsed[idString]) {
      if (item && typeof item === 'object' && '_id' in (item as Record<string, unknown>)) {
        warn('duplicate id ' + id + ' in', array);
      }
      id = randomId();
    } else {
      idsUsed[idString] = true;
    }

    return { _id: id, item };
  });
}

function seqChangedToCursor<T>(
  _lastSeqArray: SeqEntry<T>[],
  cursor: StoreCursor<T>,
  callbacks: SequenceCallbacks<T>,
): [SeqEntry<T>[], ObserveHandle] {
  let initial = true;
  const seqArray: SeqEntry<T>[] = [];

  const observeHandle = cursor.observe({
    addedAt(document: T, atIndex: number, before: string | null) {
      if (initial) {
        if (before !== null) {
          throw new Error('Expected initial data from observe in order');
        }
        seqArray.push({ _id: (document as Record<string, unknown>)._id, item: document });
      } else {
        callbacks.addedAt((document as Record<string, unknown>)._id, document, atIndex, before);
      }
    },
    changedAt(newDocument: T, oldDocument: T, atIndex: number) {
      callbacks.changedAt(
        (newDocument as Record<string, unknown>)._id,
        newDocument,
        oldDocument,
        atIndex,
      );
    },
    removedAt(oldDocument: T, atIndex: number) {
      callbacks.removedAt((oldDocument as Record<string, unknown>)._id, oldDocument, atIndex);
    },
    movedTo(document: T, fromIndex: number, toIndex: number, before: string | null) {
      callbacks.movedTo(
        (document as Record<string, unknown>)._id,
        document,
        fromIndex,
        toIndex,
        before,
      );
    },
  });
  initial = false;

  return [seqArray, observeHandle];
}

/**
 * Public API for observing reactive sequences.
 */
export const ObserveSequence = {
  _suppressWarnings: {
    get: () => _suppressWarnings,
    set: (v: number) => {
      _suppressWarnings = v;
    },
  },
  _loggedWarnings: {
    get: () => _loggedWarnings,
    set: (v: number) => {
      _loggedWarnings = v;
    },
  },

  /**
   * Set the reactive system used for autorun/nonReactive.
   *
   * Must be called before `observe()`. In a Meteor app, pass a Tracker adapter.
   * For testing, use a simple synchronous implementation.
   *
   * @param system - The reactive system implementation.
   */
  setReactiveSystem(system: ReactiveSystem): void {
    _reactiveSystem = system;
  },

  /**
   * Observe a reactive sequence function, firing callbacks on changes.
   *
   * @param sequenceFunc - A function returning an array, cursor, iterable, or falsey value.
   * @param callbacks - Callbacks for addedAt, changedAt, removedAt, movedTo.
   * @returns A handle with a `stop()` method.
   * @throws If no reactive system has been set.
   */
  observe<T>(
    sequenceFunc: () => T[] | StoreCursor<T> | Iterable<T> | null | undefined,
    callbacks: SequenceCallbacks<T>,
  ): ObserveHandle {
    if (!_reactiveSystem) {
      throw new Error('ObserveSequence: No reactive system set. Call setReactiveSystem() first.');
    }

    const rs = _reactiveSystem;
    let lastSeq: unknown = null;
    let activeObserveHandle: ObserveHandle | null = null;
    let lastSeqArray: SeqEntry<T>[] = [];

    const computation = rs.autorun(() => {
      const seq = sequenceFunc();

      rs.nonReactive(() => {
        let seqArray: SeqEntry<T>[];

        if (activeObserveHandle) {
          lastSeqArray = (lastSeq as StoreCursor<T>).fetch().map((doc) => ({
            _id: (doc as Record<string, unknown>)._id,
            item: doc,
          }));
          activeObserveHandle.stop();
          activeObserveHandle = null;
        }

        if (!seq) {
          seqArray = [];
        } else if (isArray(seq)) {
          seqArray = seqChangedToArray(lastSeqArray, seq as T[], callbacks);
        } else if (isStoreCursor(seq)) {
          const result = seqChangedToCursor(lastSeqArray, seq as StoreCursor<T>, callbacks);
          seqArray = result[0];
          activeObserveHandle = result[1];
        } else if (isIterable(seq)) {
          const array = Array.from(seq) as T[];
          seqArray = seqChangedToArray(lastSeqArray, array, callbacks);
        } else {
          throw badSequenceError(seq);
        }

        diffArray(lastSeqArray, seqArray, callbacks);
        lastSeq = seq;
        lastSeqArray = seqArray;
      });
    });

    return {
      stop() {
        computation.stop();
        if (activeObserveHandle) activeObserveHandle.stop();
      },
    };
  },

  /**
   * Synchronously fetch items from any supported sequence type.
   *
   * @param seq - An array, cursor, iterable, or falsey value.
   * @returns An array of items.
   */
  fetch<T>(seq: T[] | StoreCursor<T> | Iterable<T> | null | undefined): T[] {
    if (!seq) return [];
    if (isArray(seq)) return seq as T[];
    if (isStoreCursor(seq)) return (seq as StoreCursor<T>).fetch();
    if (isIterable(seq)) return Array.from(seq) as T[];
    throw badSequenceError(seq);
  },
};
