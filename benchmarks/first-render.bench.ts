/**
 * First-render benchmarks — measures template → DOM rendering speed.
 *
 * Tests initial rendering at various scales:
 * - Single element
 * - Small component (10 elements)
 * - Medium list (100 items)
 * - Large list (1,000 items)
 * - Deeply nested templates
 */
import { bench, describe, beforeAll } from 'vitest';
import {
  setupEnvironment,
  makeTemplate,
  renderToDiv,
  render,
  remove,
  reactive,
  toHTML,
  generateRows,
} from './setup';

beforeAll(() => {
  setupEnvironment();
});

// ─── Single element ──────────────────────────────────────────────────────────

describe('first render — single element', () => {
  bench('static div', () => {
    const tmpl = makeTemplate('bench_static', '<div>Hello World</div>');
    const div = renderToDiv(tmpl);
    div.remove();
  });

  bench('div with one interpolation', () => {
    const tmpl = makeTemplate('bench_interp', '<div>{{greeting}}</div>');
    tmpl.helpers({ greeting: 'Hello World' });
    const div = renderToDiv(tmpl);
    div.remove();
  });

  bench('div with multiple attributes', () => {
    const tmpl = makeTemplate(
      'bench_attrs',
      '<div class="{{cls}}" id="{{ident}}" title="{{tip}}" data-value="{{val}}">{{text}}</div>',
    );
    tmpl.helpers({
      cls: 'card active',
      ident: 'main-card',
      tip: 'A card',
      val: '42',
      text: 'Content here',
    });
    const div = renderToDiv(tmpl);
    div.remove();
  });
});

// ─── Small component ─────────────────────────────────────────────────────────

describe('first render — small component (10 elements)', () => {
  bench('card component with conditionals', () => {
    const tmpl = makeTemplate(
      'bench_card',
      `<div class="card">
        <h2>{{title}}</h2>
        {{#if showImage}}<img src="{{imageUrl}}">{{/if}}
        <p>{{description}}</p>
        {{#each tags}}<span class="tag">{{this}}</span>{{/each}}
        <footer>
          <span>{{author}}</span>
          <time>{{date}}</time>
        </footer>
      </div>`,
    );
    tmpl.helpers({
      title: 'My Card',
      showImage: true,
      imageUrl: '/img.png',
      description: 'A nice card',
      tags: ['typescript', 'blaze', 'benchmark'],
      author: 'Developer',
      date: '2026-03-09',
    });
    const div = renderToDiv(tmpl);
    div.remove();
  });
});

// ─── List rendering ──────────────────────────────────────────────────────────

describe('first render — list of items', () => {
  bench('10 items', () => {
    const tmpl = makeTemplate(
      'bench_list_10',
      '{{#each items}}<div class="row" data-id="{{_id}}">{{label}}</div>{{/each}}',
    );
    tmpl.helpers({ items: generateRows(10) });
    const div = renderToDiv(tmpl);
    div.remove();
  });

  bench('100 items', () => {
    const tmpl = makeTemplate(
      'bench_list_100',
      '{{#each items}}<div class="row" data-id="{{_id}}">{{label}}</div>{{/each}}',
    );
    tmpl.helpers({ items: generateRows(100) });
    const div = renderToDiv(tmpl);
    div.remove();
  });

  bench('1,000 items', () => {
    const tmpl = makeTemplate(
      'bench_list_1k',
      '{{#each items}}<div class="row" data-id="{{_id}}">{{label}}</div>{{/each}}',
    );
    tmpl.helpers({ items: generateRows(1000) });
    const div = renderToDiv(tmpl);
    div.remove();
  });

  bench('1,000 items with 3 columns', () => {
    const tmpl = makeTemplate(
      'bench_list_1k_cols',
      '{{#each items}}<tr><td>{{_id}}</td><td>{{label}}</td><td class="actions"><button>Edit</button></td></tr>{{/each}}',
    );
    tmpl.helpers({ items: generateRows(1000) });
    const div = renderToDiv(tmpl);
    div.remove();
  });
});

// ─── Nested templates ────────────────────────────────────────────────────────

describe('first render — nested templates', () => {
  bench('3 levels of template inclusion', () => {
    const leaf = makeTemplate('bench_leaf', '<span>{{val}}</span>');
    const mid = makeTemplate('bench_mid', '<div>{{> leaf}}</div>');
    mid.helpers({ leaf });
    const root = makeTemplate('bench_root', '<section>{{> mid}}</section>');
    root.helpers({ mid });

    const div = renderToDiv(root, { val: 'deep' });
    div.remove();
  });

  bench('each containing nested with and if', () => {
    const tmpl = makeTemplate(
      'bench_nested_each',
      `{{#each items}}
        {{#with this}}
          {{#if active}}
            <div class="active-item">{{label}}</div>
          {{else}}
            <div class="inactive-item">{{label}}</div>
          {{/if}}
        {{/with}}
      {{/each}}`,
    );
    const items = [];
    for (let i = 0; i < 100; i++) {
      items.push({ _id: String(i), label: `Item ${i}`, active: i % 2 === 0 });
    }
    tmpl.helpers({ items });
    const div = renderToDiv(tmpl);
    div.remove();
  });
});

// ─── toHTML (SSR) ────────────────────────────────────────────────────────────

describe('first render — toHTML (SSR)', () => {
  bench('toHTML simple', () => {
    const tmpl = makeTemplate('bench_tohtml_simple', '<div>{{greeting}}</div>');
    tmpl.helpers({ greeting: 'Hello SSR' });
    toHTML(tmpl);
  });

  bench('toHTML with 100-item list', () => {
    const tmpl = makeTemplate('bench_tohtml_list', '{{#each items}}<div>{{label}}</div>{{/each}}');
    tmpl.helpers({ items: generateRows(100) });
    toHTML(tmpl);
  });

  bench('toHTML with 1,000-item list', () => {
    const tmpl = makeTemplate('bench_tohtml_1k', '{{#each items}}<div>{{label}}</div>{{/each}}');
    tmpl.helpers({ items: generateRows(1000) });
    toHTML(tmpl);
  });
});
