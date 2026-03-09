/**
 * Ordered sequence diff algorithm.
 *
 * Finds the Longest Common Subsequence (LCS) between two ordered arrays
 * of documents (by _id) and reports additions, removals, and moves.
 * Port of Meteor's DiffSequence.diffQueryOrderedChanges.
 */

import type { DiffCallbacks } from './types';

interface DocWithId {
  _id: unknown;
}

const hasOwn = Object.prototype.hasOwnProperty;

/**
 * Diff two ordered arrays of `{_id}` documents and fire observer callbacks.
 *
 * Uses LCS to determine the minimum set of add/remove/move operations
 * required to transform oldResults into newResults.
 *
 * @param oldResults - The previous ordered array.
 * @param newResults - The new ordered array.
 * @param observer - Callbacks for add/remove/move/change.
 */
export function diffQueryOrderedChanges(
  oldResults: DocWithId[],
  newResults: DocWithId[],
  observer: DiffCallbacks,
): void {
  const newPresenceOfId: Record<string, boolean> = {};
  newResults.forEach((doc) => {
    const key = String(doc._id);
    if (newPresenceOfId[key]) {
      throw new Error('Duplicate _id in new_results: ' + doc._id);
    }
    newPresenceOfId[key] = true;
  });

  const oldIndexOfId: Record<string, number> = {};
  for (let i = 0; i < oldResults.length; i++) {
    oldIndexOfId[String(oldResults[i]!._id)] = i;
  }

  // Find LCS — items that are in both old and new, in the same relative order
  const unmoved: number[] = [];
  let maxSeqLen = 0;
  const seqEnds = new Array<number>(newResults.length);
  const ptrs = new Array<number>(newResults.length);

  const oldIdxSeq = (iNew: number): number => oldIndexOfId[String(newResults[iNew]!._id)]!;

  for (let i = 0; i < newResults.length; i++) {
    if (oldIndexOfId[String(newResults[i]!._id)] !== undefined) {
      let j = maxSeqLen;
      while (j > 0) {
        if (oldIdxSeq(seqEnds[j - 1]!) < oldIdxSeq(i)) break;
        j--;
      }

      ptrs[i] = j === 0 ? -1 : seqEnds[j - 1]!;
      seqEnds[j] = i;
      if (j + 1 > maxSeqLen) maxSeqLen = j + 1;
    }
  }

  if (maxSeqLen > 0) {
    let idx: number = seqEnds[maxSeqLen - 1]!;
    while (idx >= 0) {
      unmoved.push(idx);
      idx = ptrs[idx]!;
    }
    unmoved.reverse();
  }

  // Process groups of moved/added items between unmoved items
  const processGroup = (startOfGroup: number, endOfGroup: number): void => {
    const groupId = endOfGroup < newResults.length ? newResults[endOfGroup]!._id : null;

    for (let i = startOfGroup; i < endOfGroup; i++) {
      const newDoc = newResults[i]!;
      if (!hasOwn.call(oldIndexOfId, String(newDoc._id))) {
        // New item — added
        observer.addedBefore?.(newDoc._id, {}, groupId);
      } else {
        // Existing item moved from different position
        observer.movedBefore?.(newDoc._id, groupId);
      }
    }
  };

  let startOfGroup = 0;
  unmoved.forEach((endOfGroup) => {
    if (startOfGroup < endOfGroup) processGroup(startOfGroup, endOfGroup);
    startOfGroup = endOfGroup + 1;
  });
  processGroup(startOfGroup, newResults.length);

  // Process removals
  oldResults.forEach((oldDoc) => {
    if (!newPresenceOfId[String(oldDoc._id)]) {
      observer.removed?.(oldDoc._id);
    }
  });
}
