/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck — vitest resolve aliases handle these imports at runtime
/**
 * Comparative toHTML benchmarks — Original Blaze vs Blaze-NG.
 *
 * Measures HTMLjs tree → HTML string rendering speed using identical
 * AST structures built with each engine's HTML constructors.
 */
import { bench, describe } from 'vitest';
import { HTML as HTML_NG, toHTML as toHTML_NG } from '@blaze-ng/htmljs';
import { HTML as HTML_OG } from 'meteor/htmljs';

// ─── Build equivalent AST trees for each engine ─────────────────────────────

function buildSimpleTree(HTML) {
  return HTML.DIV({ class: 'greeting' }, 'Hello, world!');
}

function buildMediumTree(HTML) {
  return HTML.DIV(
    { class: 'card', id: 'main' },
    HTML.H2('Title'),
    HTML.P({ class: 'body' }, 'Some content here'),
    HTML.UL(HTML.LI('Item 1'), HTML.LI('Item 2'), HTML.LI('Item 3')),
    HTML.FOOTER(HTML.A({ href: '/link' }, 'Read more')),
  );
}

function buildLargeTree(HTML, rowCount) {
  const rows = [];
  for (let i = 0; i < rowCount; i++) {
    rows.push(
      HTML.TR(
        HTML.TD({ class: 'name' }, `Name ${i}`),
        HTML.TD({ class: 'value' }, `${i * 100}`),
        HTML.TD(HTML.SPAN({ class: 'badge' }, 'active')),
      ),
    );
  }
  return HTML.TABLE(
    { class: 'data-table' },
    HTML.THEAD(HTML.TR(HTML.TH('Name'), HTML.TH('Value'), HTML.TH('Status'))),
    HTML.TBODY(...rows),
  );
}

function buildDeepTree(HTML, depth) {
  let node = HTML.SPAN('leaf');
  for (let i = 0; i < depth; i++) {
    node = HTML.DIV({ class: `level-${i}` }, node);
  }
  return node;
}

// Pre-build trees outside of bench iterations for fair comparison
const ogSimple = buildSimpleTree(HTML_OG);
const ngSimple = buildSimpleTree(HTML_NG);
const ogMedium = buildMediumTree(HTML_OG);
const ngMedium = buildMediumTree(HTML_NG);
const ogLarge = buildLargeTree(HTML_OG, 100);
const ngLarge = buildLargeTree(HTML_NG, 100);
const ogDeep = buildDeepTree(HTML_OG, 50);
const ngDeep = buildDeepTree(HTML_NG, 50);

// ─── toHTML benchmarks ───────────────────────────────────────────────────────

describe('toHTML — simple element', () => {
  bench('Original Blaze', () => {
    HTML_OG.toHTML(ogSimple);
  });

  bench('Blaze-NG', () => {
    toHTML_NG(ngSimple);
  });
});

describe('toHTML — medium tree (nested elements)', () => {
  bench('Original Blaze', () => {
    HTML_OG.toHTML(ogMedium);
  });

  bench('Blaze-NG', () => {
    toHTML_NG(ngMedium);
  });
});

describe('toHTML — large table (100 rows)', () => {
  bench('Original Blaze', () => {
    HTML_OG.toHTML(ogLarge);
  });

  bench('Blaze-NG', () => {
    toHTML_NG(ngLarge);
  });
});

describe('toHTML — deeply nested (50 levels)', () => {
  bench('Original Blaze', () => {
    HTML_OG.toHTML(ogDeep);
  });

  bench('Blaze-NG', () => {
    toHTML_NG(ngDeep);
  });
});

// ─── Tree construction + toHTML (end-to-end) ─────────────────────────────────

describe('tree construction + toHTML — medium', () => {
  bench('Original Blaze', () => {
    const tree = buildMediumTree(HTML_OG);
    HTML_OG.toHTML(tree);
  });

  bench('Blaze-NG', () => {
    const tree = buildMediumTree(HTML_NG);
    toHTML_NG(tree);
  });
});

describe('tree construction + toHTML — large (100 rows)', () => {
  bench('Original Blaze', () => {
    const tree = buildLargeTree(HTML_OG, 100);
    HTML_OG.toHTML(tree);
  });

  bench('Blaze-NG', () => {
    const tree = buildLargeTree(HTML_NG, 100);
    toHTML_NG(tree);
  });
});
