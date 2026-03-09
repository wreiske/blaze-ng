/**
 * Attribute update benchmarks — measures reactive attribute manipulation.
 *
 * Tests how quickly reactive attribute changes propagate to the DOM:
 * - Class attribute toggle
 * - Style property update
 * - Data attribute update
 * - Multiple attribute object replacement
 * - Dynamic class with conditionals
 */
import { bench, describe, beforeAll } from 'vitest';
import { setupEnvironment, makeTemplate, renderToDiv, reactive } from './setup';

beforeAll(() => {
  setupEnvironment();
});

// ─── Class attribute toggle ──────────────────────────────────────────────────

describe('attributes — class toggle', () => {
  bench('toggle class on/off', () => {
    const activeVar = reactive.ReactiveVar(false);
    const tmpl = makeTemplate(
      'bench_attr_class',
      '<div class="item {{#if active}}active{{/if}}">Content</div>',
    );
    tmpl.helpers({ active: () => activeVar.get() });
    const div = renderToDiv(tmpl);

    activeVar.set(true);
    reactive.flush();
    activeVar.set(false);
    reactive.flush();

    div.remove();
  });
});

// ─── Style property update ──────────────────────────────────────────────────

describe('attributes — style update', () => {
  bench('update style color', () => {
    const colorVar = reactive.ReactiveVar('red');
    const tmpl = makeTemplate(
      'bench_attr_style',
      '<div style="color: {{color}}; font-size: 14px;">Styled</div>',
    );
    tmpl.helpers({ color: () => colorVar.get() });
    const div = renderToDiv(tmpl);

    colorVar.set('blue');
    reactive.flush();
    colorVar.set('red');
    reactive.flush();

    div.remove();
  });
});

// ─── Data attribute update ──────────────────────────────────────────────────

describe('attributes — data attribute', () => {
  bench('update data-value attribute', () => {
    const valVar = reactive.ReactiveVar('initial');
    const tmpl = makeTemplate(
      'bench_attr_data',
      '<div data-value="{{val}}" data-type="bench">Content</div>',
    );
    tmpl.helpers({ val: () => valVar.get() });
    const div = renderToDiv(tmpl);

    valVar.set('updated');
    reactive.flush();
    valVar.set('initial');
    reactive.flush();

    div.remove();
  });
});

// ─── Multiple attributes ────────────────────────────────────────────────────

describe('attributes — multiple attributes', () => {
  bench('update 3 attributes then flush', () => {
    const clsVar = reactive.ReactiveVar('card');
    const titleVar = reactive.ReactiveVar('My Card');
    const idVar = reactive.ReactiveVar('card-1');
    const tmpl = makeTemplate(
      'bench_attr_multi',
      '<div class="{{cls}}" title="{{title}}" id="{{ident}}">Content</div>',
    );
    tmpl.helpers({
      cls: () => clsVar.get(),
      title: () => titleVar.get(),
      ident: () => idVar.get(),
    });
    const div = renderToDiv(tmpl);

    clsVar.set('card active');
    titleVar.set('Updated Card');
    idVar.set('card-2');
    reactive.flush();
    clsVar.set('card');
    titleVar.set('My Card');
    idVar.set('card-1');
    reactive.flush();

    div.remove();
  });
});

// ─── Attributes on many elements ────────────────────────────────────────────

describe('attributes — update class on many elements', () => {
  bench('toggle class on 100 elements', () => {
    const activeVar = reactive.ReactiveVar(false);
    const rows = [];
    for (let i = 0; i < 100; i++) {
      rows.push('<div class="row {{#if active}}highlighted{{/if}}">Row ' + i + '</div>');
    }
    const tmpl = makeTemplate('bench_attr_many', rows.join('\n'));
    tmpl.helpers({ active: () => activeVar.get() });
    const div = renderToDiv(tmpl);

    activeVar.set(true);
    reactive.flush();
    activeVar.set(false);
    reactive.flush();

    div.remove();
  });
});
