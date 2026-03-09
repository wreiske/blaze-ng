/**
 * Reactive-update benchmarks — measures reactive DOM update speed.
 *
 * Tests how quickly the system propagates changes:
 * - Single reactive variable update
 * - Multiple simultaneous variable updates
 * - Conditional (#if) switching
 * - Nested reactive dependencies
 * - Rapid sequential updates (batched flush)
 */
import { bench, describe, beforeAll } from 'vitest';
import { setupEnvironment, makeTemplate, renderToDiv, reactive } from './setup';

beforeAll(() => {
  setupEnvironment();
});

// ─── Single value update ─────────────────────────────────────────────────────

describe('reactive update — single value', () => {
  bench('update text content', () => {
    const nameVar = reactive.ReactiveVar('Alice');
    const tmpl = makeTemplate('bench_rv_single', '<span>{{name}}</span>');
    tmpl.helpers({ name: () => nameVar.get() });
    const div = renderToDiv(tmpl);

    nameVar.set('Bob');
    reactive.flush();
    nameVar.set('Alice');
    reactive.flush();

    div.remove();
  });
});

// ─── Multiple simultaneous updates ──────────────────────────────────────────

describe('reactive update — multiple values', () => {
  bench('update 3 values then flush', () => {
    const firstVar = reactive.ReactiveVar('Alice');
    const lastVar = reactive.ReactiveVar('Smith');
    const ageVar = reactive.ReactiveVar(30);
    const tmpl = makeTemplate('bench_rv_multi', '<div>{{first}} {{last}}, age {{age}}</div>');
    tmpl.helpers({
      first: () => firstVar.get(),
      last: () => lastVar.get(),
      age: () => ageVar.get(),
    });
    const div = renderToDiv(tmpl);

    firstVar.set('Bob');
    lastVar.set('Jones');
    ageVar.set(25);
    reactive.flush();
    firstVar.set('Alice');
    lastVar.set('Smith');
    ageVar.set(30);
    reactive.flush();

    div.remove();
  });
});

// ─── Conditional switching ──────────────────────────────────────────────────

describe('reactive update — conditional (#if)', () => {
  bench('toggle #if condition', () => {
    const showVar = reactive.ReactiveVar(true);
    const tmpl = makeTemplate(
      'bench_rv_if',
      '{{#if show}}<div class="content">Visible</div>{{else}}<div class="placeholder">Hidden</div>{{/if}}',
    );
    tmpl.helpers({ show: () => showVar.get() });
    const div = renderToDiv(tmpl);

    showVar.set(false);
    reactive.flush();
    showVar.set(true);
    reactive.flush();

    div.remove();
  });
});

// ─── Nested reactive dependencies ───────────────────────────────────────────

describe('reactive update — nested dependencies', () => {
  bench('update outer dependency', () => {
    const outerVar = reactive.ReactiveVar('outer');
    const innerVar = reactive.ReactiveVar('inner');
    const tmpl = makeTemplate(
      'bench_rv_nested',
      '<div>{{outerVal}} — {{#if show}}<span>{{innerVal}}</span>{{/if}}</div>',
    );
    tmpl.helpers({
      outerVal: () => outerVar.get(),
      innerVal: () => innerVar.get(),
      show: true,
    });
    const div = renderToDiv(tmpl);

    outerVar.set('changed-outer');
    reactive.flush();
    outerVar.set('outer');
    reactive.flush();

    div.remove();
  });

  bench('update inner dependency', () => {
    const outerVar = reactive.ReactiveVar('outer');
    const innerVar = reactive.ReactiveVar('inner');
    const tmpl = makeTemplate(
      'bench_rv_nested2',
      '<div>{{outerVal}} — {{#if show}}<span>{{innerVal}}</span>{{/if}}</div>',
    );
    tmpl.helpers({
      outerVal: () => outerVar.get(),
      innerVal: () => innerVar.get(),
      show: true,
    });
    const div = renderToDiv(tmpl);

    innerVar.set('changed-inner');
    reactive.flush();
    innerVar.set('inner');
    reactive.flush();

    div.remove();
  });

  bench('update both simultaneously', () => {
    const outerVar = reactive.ReactiveVar('outer');
    const innerVar = reactive.ReactiveVar('inner');
    const tmpl = makeTemplate(
      'bench_rv_nested3',
      '<div>{{outerVal}} — {{#if show}}<span>{{innerVal}}</span>{{/if}}</div>',
    );
    tmpl.helpers({
      outerVal: () => outerVar.get(),
      innerVal: () => innerVar.get(),
      show: true,
    });
    const div = renderToDiv(tmpl);

    outerVar.set('new-outer');
    innerVar.set('new-inner');
    reactive.flush();
    outerVar.set('outer');
    innerVar.set('inner');
    reactive.flush();

    div.remove();
  });
});

// ─── Rapid sequential updates (batched) ─────────────────────────────────────

describe('reactive update — rapid sequential (single flush)', () => {
  bench('10 updates, single flush', () => {
    const counterVar = reactive.ReactiveVar(0);
    const tmpl = makeTemplate('bench_rv_rapid10', '<span>{{count}}</span>');
    tmpl.helpers({ count: () => counterVar.get() });
    const div = renderToDiv(tmpl);

    for (let i = 1; i <= 10; i++) {
      counterVar.set(i);
    }
    reactive.flush();

    div.remove();
  });

  bench('100 updates, single flush', () => {
    const counterVar = reactive.ReactiveVar(0);
    const tmpl = makeTemplate('bench_rv_rapid100', '<span>{{count}}</span>');
    tmpl.helpers({ count: () => counterVar.get() });
    const div = renderToDiv(tmpl);

    for (let i = 1; i <= 100; i++) {
      counterVar.set(i);
    }
    reactive.flush();

    div.remove();
  });
});
