/**
 * Each/list diffing benchmarks — measures {{#each}} list update performance.
 *
 * Tests the observe-sequence + DOM diffing at various operations.
 * Uses moderate list sizes (100 items) to avoid OOM with inline setup.
 */
import { bench, describe, beforeAll } from 'vitest';
import { setupEnvironment, makeTemplate, renderToDiv, reactive, generateRows } from './setup';

beforeAll(() => {
  setupEnvironment();
});

type Row = { _id: string; label: string };

function setupList(initialRows: Row[]) {
  const itemsVar = reactive.ReactiveVar(initialRows);
  const tmpl = makeTemplate(
    'bench_each_' + Math.random().toString(36).slice(2, 8),
    '{{#each items}}<div class="row" data-id="{{_id}}">{{label}}</div>{{/each}}',
  );
  tmpl.helpers({ items: () => itemsVar.get() });
  const div = renderToDiv(tmpl);
  return { itemsVar, div };
}

// ─── Create from empty ──────────────────────────────────────────────────────

describe('each — create rows from empty', () => {
  bench('create 50 rows', () => {
    const { itemsVar, div } = setupList([]);
    itemsVar.set(generateRows(50));
    reactive.flush();
    div.remove();
  });

  bench('create 100 rows', () => {
    const { itemsVar, div } = setupList([]);
    itemsVar.set(generateRows(100));
    reactive.flush();
    div.remove();
  });
});

// ─── Append ─────────────────────────────────────────────────────────────────

describe('each — append rows', () => {
  bench('append 1 row to 100', () => {
    const baseline = generateRows(100);
    const { itemsVar, div } = setupList(baseline);
    itemsVar.set([...baseline, { _id: '9999', label: 'New Item' }]);
    reactive.flush();
    div.remove();
  });

  bench('append 10 rows to 100', () => {
    const baseline = generateRows(100);
    const { itemsVar, div } = setupList(baseline);
    itemsVar.set([...baseline, ...generateRows(10, 2000)]);
    reactive.flush();
    div.remove();
  });
});

// ─── Prepend ────────────────────────────────────────────────────────────────

describe('each — prepend rows', () => {
  bench('prepend 1 row to 100', () => {
    const baseline = generateRows(100);
    const { itemsVar, div } = setupList(baseline);
    itemsVar.set([{ _id: '0', label: 'Prepended' }, ...baseline]);
    reactive.flush();
    div.remove();
  });

  bench('prepend 10 rows to 100', () => {
    const baseline = generateRows(100);
    const { itemsVar, div } = setupList(baseline);
    itemsVar.set([...generateRows(10, 5000), ...baseline]);
    reactive.flush();
    div.remove();
  });
});

// ─── Remove ─────────────────────────────────────────────────────────────────

describe('each — remove rows', () => {
  bench('remove 1 row from 100', () => {
    const baseline = generateRows(100);
    const { itemsVar, div } = setupList(baseline);
    itemsVar.set(baseline.filter((_, i) => i !== 50));
    reactive.flush();
    div.remove();
  });

  bench('remove 10 rows from 100', () => {
    const baseline = generateRows(100);
    const { itemsVar, div } = setupList(baseline);
    itemsVar.set(baseline.filter((_, i) => i % 10 !== 0));
    reactive.flush();
    div.remove();
  });

  bench('remove all rows', () => {
    const baseline = generateRows(100);
    const { itemsVar, div } = setupList(baseline);
    itemsVar.set([]);
    reactive.flush();
    div.remove();
  });
});

// ─── Swap ───────────────────────────────────────────────────────────────────

describe('each — swap rows', () => {
  bench('swap 2 rows in 100', () => {
    const baseline = generateRows(100);
    const { itemsVar, div } = setupList(baseline);
    const swapped = [...baseline];
    const temp = swapped[1]!;
    swapped[1] = swapped[98]!;
    swapped[98] = temp;
    itemsVar.set(swapped);
    reactive.flush();
    div.remove();
  });
});

// ─── Update every 10th row ──────────────────────────────────────────────────

describe('each — partial update', () => {
  bench('update every 10th row label in 100', () => {
    const baseline = generateRows(100);
    const { itemsVar, div } = setupList(baseline);
    const updated = baseline.map((row, i) =>
      i % 10 === 0 ? { ...row, label: row.label + ' !!!' } : row,
    );
    itemsVar.set(updated);
    reactive.flush();
    div.remove();
  });
});

// ─── Reverse ────────────────────────────────────────────────────────────────

describe('each — reverse', () => {
  bench('reverse 100 rows', () => {
    const baseline = generateRows(100);
    const { itemsVar, div } = setupList(baseline);
    itemsVar.set([...baseline].reverse());
    reactive.flush();
    div.remove();
  });
});
