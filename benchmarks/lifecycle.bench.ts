/**
 * Template lifecycle benchmarks — measures create/destroy cycle overhead.
 *
 * Tests:
 * - Simple template create and destroy
 * - Nested template create and destroy
 * - onCreated / onRendered / onDestroyed callback overhead
 * - Rapid create/destroy cycling
 */
import { bench, describe, beforeAll, beforeEach, afterEach } from 'vitest';
import { setupEnvironment, makeTemplate, render, remove, reactive, document, View } from './setup';

beforeAll(() => {
  setupEnvironment();
});

// ─── Simple create/destroy ──────────────────────────────────────────────────

describe('lifecycle — simple create/destroy', () => {
  bench('create and destroy simple template', () => {
    const tmpl = makeTemplate('bench_lc_simple', '<div>Hello</div>');
    const div = document.createElement('div');
    const view = render(tmpl, div);
    reactive.flush();
    remove(view, div);
    reactive.flush();
  });

  bench('create and destroy template with helpers', () => {
    const tmpl = makeTemplate('bench_lc_helpers', '<div>{{a}} {{b}} {{c}}</div>');
    tmpl.helpers({ a: 1, b: 2, c: 3 });
    const div = document.createElement('div');
    const view = render(tmpl, div);
    reactive.flush();
    remove(view, div);
    reactive.flush();
  });
});

// ─── Nested template create/destroy ─────────────────────────────────────────

describe('lifecycle — nested template create/destroy', () => {
  bench('create/destroy 2-level nesting', () => {
    const child = makeTemplate('bench_lc_child', '<span>Child</span>');
    const parent = makeTemplate('bench_lc_parent', '<div>{{> child}}</div>');
    parent.helpers({ child });

    const div = document.createElement('div');
    const view = render(parent, div);
    reactive.flush();
    remove(view, div);
    reactive.flush();
  });

  bench('create/destroy 3-level nesting', () => {
    const leaf = makeTemplate('bench_lc_leaf', '<em>Leaf</em>');
    const middle = makeTemplate('bench_lc_mid', '<span>{{> leaf}}</span>');
    middle.helpers({ leaf });
    const root = makeTemplate('bench_lc_root', '<div>{{> middle}}</div>');
    root.helpers({ middle });

    const div = document.createElement('div');
    const view = render(root, div);
    reactive.flush();
    remove(view, div);
    reactive.flush();
  });
});

// ─── Lifecycle callbacks overhead ───────────────────────────────────────────

describe('lifecycle — callback overhead', () => {
  bench('template with 0 callbacks', () => {
    const tmpl = makeTemplate('bench_lc_nocb', '<div>No callbacks</div>');
    const div = document.createElement('div');
    const view = render(tmpl, div);
    reactive.flush();
    remove(view, div);
    reactive.flush();
  });

  bench('template with onCreated', () => {
    const tmpl = makeTemplate('bench_lc_created', '<div>With onCreated</div>');
    tmpl.onCreated(function () {
      // Callback overhead test — minimal work
      void 0;
    });
    const div = document.createElement('div');
    const view = render(tmpl, div);
    reactive.flush();
    remove(view, div);
    reactive.flush();
  });

  bench('template with onCreated + onRendered + onDestroyed', () => {
    const tmpl = makeTemplate('bench_lc_allcb', '<div>All callbacks</div>');
    tmpl.onCreated(function () {
      void 0;
    });
    tmpl.onRendered(function () {
      void 0;
    });
    tmpl.onDestroyed(function () {
      void 0;
    });
    const div = document.createElement('div');
    const view = render(tmpl, div);
    reactive.flush();
    remove(view, div);
    reactive.flush();
  });

  bench('template with 5 onCreated callbacks', () => {
    const tmpl = makeTemplate('bench_lc_5cb', '<div>5 callbacks</div>');
    for (let i = 0; i < 5; i++) {
      tmpl.onCreated(function () {
        void 0;
      });
    }
    const div = document.createElement('div');
    const view = render(tmpl, div);
    reactive.flush();
    remove(view, div);
    reactive.flush();
  });
});

// ─── Rapid cycling ──────────────────────────────────────────────────────────

describe('lifecycle — rapid create/destroy cycling', () => {
  bench('10 cycles of create/destroy', () => {
    const tmpl = makeTemplate('bench_lc_cycle', '<div class="item">{{name}}</div>');
    tmpl.helpers({ name: 'test' });

    for (let i = 0; i < 10; i++) {
      const div = document.createElement('div');
      const view = render(tmpl, div);
      reactive.flush();
      remove(view, div);
      reactive.flush();
    }
  });

  bench('50 cycles of create/destroy', () => {
    const tmpl = makeTemplate('bench_lc_cycle50', '<div class="item">{{name}}</div>');
    tmpl.helpers({ name: 'test' });

    for (let i = 0; i < 50; i++) {
      const div = document.createElement('div');
      const view = render(tmpl, div);
      reactive.flush();
      remove(view, div);
      reactive.flush();
    }
  });
});
