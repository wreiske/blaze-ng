/**
 * WASM diff benchmarks — measures sequence diffing performance.
 *
 * The diff function uses a JS fallback for small lists and WASM
 * for larger lists (when loaded). This benchmark measures both paths
 * at various list sizes:
 * - 10, 100, 1,000, 5,000 items
 * - Various diff scenarios: append, remove, shuffle, full replace
 */
import { bench, describe, beforeAll } from 'vitest';
import { diff } from '@blaze-ng/wasm';

type Item = { id: string; name: string };

function generateItems(count: number, prefix = ''): Item[] {
  const items: Item[] = [];
  for (let i = 0; i < count; i++) {
    items.push({ id: `${prefix}${i}`, name: `Item ${prefix}${i}` });
  }
  return items;
}

const diffOptions = {
  getId: (item: Item) => item.id,
  getFields: (item: Item) => item.name,
};

beforeAll(() => {
  // WASM may not be loaded — that's fine, JS fallback will be benchmarked
});

// ─── Identical lists (no changes) ───────────────────────────────────────────

describe('diff — identical (no ops)', () => {
  const small = generateItems(100);
  const medium = generateItems(1000);
  const large = generateItems(5000);

  bench('100 identical items', () => {
    diff(small, small, diffOptions);
  });

  bench('1,000 identical items', () => {
    diff(medium, medium, diffOptions);
  });

  bench('5,000 identical items', () => {
    diff(large, large, diffOptions);
  });
});

// ─── Append items ───────────────────────────────────────────────────────────

describe('diff — append items', () => {
  const base100 = generateItems(100);
  const appended110 = [...base100, ...generateItems(10, 'new_')];

  const base1000 = generateItems(1000);
  const appended1100 = [...base1000, ...generateItems(100, 'new_')];

  bench('append 10 to 100', () => {
    diff(base100, appended110, diffOptions);
  });

  bench('append 100 to 1000', () => {
    diff(base1000, appended1100, diffOptions);
  });
});

// ─── Remove items ───────────────────────────────────────────────────────────

describe('diff — remove items', () => {
  const full100 = generateItems(100);
  const removed90 = full100.slice(0, 90);

  const full1000 = generateItems(1000);
  const removed900 = full1000.slice(0, 900);

  bench('remove 10 from 100', () => {
    diff(full100, removed90, diffOptions);
  });

  bench('remove 100 from 1000', () => {
    diff(full1000, removed900, diffOptions);
  });
});

// ─── Shuffle (move operations) ──────────────────────────────────────────────

describe('diff — shuffle (reorder)', () => {
  const items100 = generateItems(100);
  // Deterministic "shuffle" — reverse every other chunk of 10
  const shuffled100 = [...items100];
  for (let i = 0; i < shuffled100.length; i += 20) {
    const chunk = shuffled100.slice(i, i + 10).reverse();
    for (let j = 0; j < chunk.length && i + j < shuffled100.length; j++) {
      shuffled100[i + j] = chunk[j]!;
    }
  }

  const items1000 = generateItems(1000);
  const shuffled1000 = [...items1000];
  for (let i = 0; i < shuffled1000.length; i += 20) {
    const chunk = shuffled1000.slice(i, i + 10).reverse();
    for (let j = 0; j < chunk.length && i + j < shuffled1000.length; j++) {
      shuffled1000[i + j] = chunk[j]!;
    }
  }

  bench('shuffle 100 items', () => {
    diff(items100, shuffled100, diffOptions);
  });

  bench('shuffle 1,000 items', () => {
    diff(items1000, shuffled1000, diffOptions);
  });
});

// ─── Full replace ───────────────────────────────────────────────────────────

describe('diff — full replace (worst case)', () => {
  const old100 = generateItems(100, 'old_');
  const new100 = generateItems(100, 'new_');

  const old1000 = generateItems(1000, 'old_');
  const new1000 = generateItems(1000, 'new_');

  bench('replace all 100 items', () => {
    diff(old100, new100, diffOptions);
  });

  bench('replace all 1,000 items', () => {
    diff(old1000, new1000, diffOptions);
  });
});

// ─── Mixed operations ───────────────────────────────────────────────────────

describe('diff — mixed operations', () => {
  const base = generateItems(1000);
  // Remove first 50, add 50 new at end, modify 50 names, shuffle middle
  const mixed = [
    ...base
      .slice(50, 500)
      .map((item, i) => (i % 10 === 0 ? { ...item, name: item.name + ' (modified)' } : item)),
    ...base.slice(500),
    ...generateItems(50, 'added_'),
  ];

  bench('mixed ops on 1,000 items (remove+add+change)', () => {
    diff(base, mixed, diffOptions);
  });
});
