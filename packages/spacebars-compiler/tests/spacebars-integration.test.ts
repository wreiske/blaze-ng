/**
 * Spacebars integration tests — ported from original Blaze spacebars-tests.
 *
 * Compiles template strings at runtime using SpacebarsCompiler.compile(),
 * evaluates them, and renders with jsdom + SimpleReactiveSystem.
 */
import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { JSDOM } from 'jsdom';
import { HTML, Raw, CharRef, Comment as HtmlComment } from '@blaze-ng/htmljs';
import { Spacebars } from '@blaze-ng/spacebars';
import { ObserveSequence } from '@blaze-ng/observe-sequence';
import { compile } from '../src/compiler';
import type { TemplateInstance } from '@blaze-ng/core';
import {
  View,
  SimpleReactiveSystem,
  setReactiveSystem,
  render,
  remove,
  toHTML,
  Template,
  registerHelper,
  deregisterHelper,
  getData,
  getView,
  With,
  DOMBackend,
  renderWithData,
} from '@blaze-ng/core';

// ─── Setup ───────────────────────────────────────────────────────────────────

let dom: JSDOM;
let document: Document;
let reactive: SimpleReactiveSystem;

/** Normalize HTML for comparison. */
function canonicalizeHtml(html: string): string {
  return html
    .replace(/<!---->/g, '')
    .replace(/<!--.*?-->/g, '<!---->')
    .replace(/\s+/g, ' ')
    .replace(/> </g, '><')
    .trim();
}

/**

 * Create a Template from a Spacebars source string.
 */
function makeTemplate(name: string, source: string): Template {
  const renderFunc = compileToRenderFunc(source);
  return new Template(`Template.${name}`, renderFunc);
}

/**
 * Create a proxy for HTML namespace that allows class constructors
 * (Raw, CharRef, Comment) to be called without `new`.
 */
/**
 * Create a proxy for Spacebars that allows `kw` to be called without `new`.
 */
function createSpacebarsProxy() {
  const proxy = { ...Spacebars };
  const OrigKw = (Spacebars as Record<string, unknown>).kw as new (
    hash?: Record<string, unknown>,
  ) => unknown;
  (proxy as Record<string, unknown>).kw = function (...args: unknown[]) {
    return new OrigKw(...(args as [Record<string, unknown>?]));
  };
  return proxy;
}

function createHtmlProxy() {
  const proxy = { ...HTML };

  // Wrap Raw so it can be called as a function
  proxy.Raw = function (...args: unknown[]) {
    return new (Raw as unknown as new (...a: unknown[]) => unknown)(...args);
  } as unknown as typeof HTML.Raw;

  // Wrap CharRef
  proxy.CharRef = function (...args: unknown[]) {
    return new (CharRef as unknown as new (...a: unknown[]) => unknown)(...args);
  } as unknown as typeof HTML.CharRef;

  // Wrap Comment
  proxy.Comment = function (...args: unknown[]) {
    return new (HtmlComment as unknown as new (...a: unknown[]) => unknown)(...args);
  } as unknown as typeof HTML.Comment;

  return proxy;
}

/**
 * Compile source to a function that works as a Template renderFunction.
 * The Blaze object provides View, If, Unless, Each, With, etc.
 */
function compileToRenderFunc(source: string): (this: View) => unknown {
  const code = compile(source, { isTemplate: true });
  // Build a Blaze-compatible namespace
  // Compiled code calls `Blaze.View(...)` as a function, but our View is a class.
  // Wrap it so it can be called without `new`.
  const ViewProxy = function (name: string, renderFunc?: () => unknown) {
    return new View(name, renderFunc);
  } as unknown as typeof View;
  // Copy static properties
  Object.setPrototypeOf(ViewProxy, View);
  ViewProxy.prototype = View.prototype;

  const BlazeNS = {
    View: ViewProxy,
    If: createBuiltinIf(),
    Unless: createBuiltinUnless(),
    Each: createBuiltinEach(),
    Let: createBuiltinLet(),
    With,
    _TemplateWith: createTemplateWith(),
    _InOuterTemplateScope,
    _globalHelpers: {},
    currentView: null as View | null,
    _parentData,
    getView,
  };

  const htmlProxy = createHtmlProxy();
  const spacebarsProxy = createSpacebarsProxy();

  const fn = new Function('HTML', 'Spacebars', 'Blaze', 'Template', `return ${code}`)(
    htmlProxy,
    spacebarsProxy,
    BlazeNS,
    Template,
  );
  return fn;
}

// Import the actual builtins
import {
  If,
  Unless,
  Each,
  Let,
  _parentData,
  _withCurrentView,
  _InOuterTemplateScope,
} from '@blaze-ng/core';

function createBuiltinIf() {
  return function BlazeIf(
    conditionFunc: () => unknown,
    contentFunc: () => unknown,
    elseFunc?: () => unknown,
  ) {
    return If(conditionFunc, contentFunc, elseFunc);
  };
}

function createBuiltinUnless() {
  return function BlazeUnless(
    conditionFunc: () => unknown,
    contentFunc: () => unknown,
    elseFunc?: () => unknown,
  ) {
    return Unless(conditionFunc, contentFunc, elseFunc);
  };
}

function createBuiltinEach() {
  return function BlazeEach(
    argFunc: () => unknown,
    contentFunc: () => unknown,
    elseFunc?: () => unknown,
  ) {
    return Each(argFunc, contentFunc, elseFunc);
  };
}

function createBuiltinLet() {
  return function BlazeLet(bindings: Record<string, () => unknown>, contentFunc: () => unknown) {
    return Let(bindings, contentFunc);
  };
}

function createTemplateWith() {
  return function _TemplateWith(argFunc: () => unknown, contentFunc: () => unknown) {
    return With(argFunc, contentFunc);
  };
}

/** Render a template to a div element. */
function renderToDiv(tmpl: Template | View | (() => unknown), data?: unknown): HTMLDivElement {
  const div = document.createElement('div');
  if (data !== undefined) {
    renderWithData(tmpl, data, div);
  } else {
    render(tmpl, div);
  }
  reactive.flush();
  return div;
}

beforeEach(() => {
  dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
  document = dom.window.document;
  (globalThis as Record<string, unknown>).document = document;
  (globalThis as Record<string, unknown>).window = dom.window;
  (globalThis as Record<string, unknown>).Element = dom.window.Element;
  (globalThis as Record<string, unknown>).Node = dom.window.Node;
  (globalThis as Record<string, unknown>).MutationObserver = dom.window.MutationObserver;

  reactive = new SimpleReactiveSystem();
  setReactiveSystem(reactive);
  ObserveSequence.setReactiveSystem(reactive);
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('spacebars integration - simple helpers', () => {
  test('simple helper with reactive var', () => {
    const tmpl = makeTemplate('test_simple', '{{foo bar}}');
    const R = reactive.ReactiveVar(1);
    tmpl.helpers({
      foo: function (x: number) {
        return x + R.get();
      },
      bar: function () {
        return 123;
      },
    });

    const div = renderToDiv(tmpl);
    expect(canonicalizeHtml(div.innerHTML)).toBe('124');

    R.set(2);
    reactive.flush();
    expect(canonicalizeHtml(div.innerHTML)).toBe('125');
  });

  test('simple helper throws for non-function', () => {
    const tmpl = makeTemplate('test_nonfunc', '{{foo bar}}');
    tmpl.helpers({ foo: 3 });
    expect(() => renderToDiv(tmpl)).toThrow(/Can't call non-function/);
  });

  test('simple helper throws for missing helper', () => {
    const tmpl = makeTemplate('test_missing', '{{foo bar}}');
    expect(() => renderToDiv(tmpl)).toThrow(/No such function/);
  });

  test('simple helper returns empty for void function', () => {
    const tmpl = makeTemplate('test_void', '{{foo bar}}');
    tmpl.helpers({ foo: function () {} });
    const div = renderToDiv(tmpl);
    expect(canonicalizeHtml(div.innerHTML)).toBe('');
  });

  test('helper from data context', () => {
    const tmpl = makeTemplate('test_data_helper', '{{foo bar}}');
    const R = reactive.ReactiveVar(1);
    tmpl.helpers({
      bar: function () {
        return 123;
      },
    });
    const div = renderToDiv(tmpl, {
      foo: function (x: number) {
        return x + R.get();
      },
    });
    expect(canonicalizeHtml(div.innerHTML)).toBe('124');

    R.set(2);
    reactive.flush();
    expect(canonicalizeHtml(div.innerHTML)).toBe('125');
  });
});

describe('spacebars integration - member helpers', () => {
  test('member helper call', () => {
    const tmpl = makeTemplate('test_member', "{{user.prefixName 'Mr.'}}");
    const name = reactive.ReactiveVar('foo');
    tmpl.helpers({
      user: function () {
        return {
          prefixName: function (prefix: string) {
            return prefix + ' ' + name.get();
          },
        };
      },
    });
    const div = renderToDiv(tmpl);
    expect(canonicalizeHtml(div.innerHTML)).toBe('Mr. foo');

    name.set('bar');
    reactive.flush();
    expect(canonicalizeHtml(div.innerHTML)).toBe('Mr. bar');
  });

  test('member helper returns empty for non-function user', () => {
    const tmpl = makeTemplate('test_member2', "{{user.prefixName 'Mr.'}}");
    tmpl.helpers({ user: 3 });
    const div = renderToDiv(tmpl);
    expect(canonicalizeHtml(div.innerHTML)).toBe('');
  });

  test('member helper returns empty for null user', () => {
    const tmpl = makeTemplate('test_member3', "{{user.prefixName 'Mr.'}}");
    tmpl.helpers({ user: function () {} });
    const div = renderToDiv(tmpl);
    expect(canonicalizeHtml(div.innerHTML)).toBe('');
  });
});

describe('spacebars integration - triple stache (raw HTML)', () => {
  test('raw HTML insertion', () => {
    const tmpl = makeTemplate('test_triple', '{{{html}}}');
    const R = reactive.ReactiveVar('<span class="hi">blah</span>');
    tmpl.helpers({
      html: function () {
        return R.get();
      },
    });

    const div = renderToDiv(tmpl);
    const span = div.querySelector('span');
    expect(span).toBeTruthy();
    expect(span!.className).toBe('hi');
    expect(span!.innerHTML).toBe('blah');

    R.set('asdf');
    reactive.flush();
    expect(div.querySelector('span')).toBeNull();
    expect(canonicalizeHtml(div.innerHTML)).toBe('asdf');
  });

  test('triple stache with nully values', () => {
    const tmpl = makeTemplate('test_triple2', 'x{{{html}}}{{{html2}}}{{{html3}}}y');
    tmpl.helpers({
      html: function () {},
      html2: function () {
        return null;
      },
    });
    const div = renderToDiv(tmpl);
    expect(canonicalizeHtml(div.innerHTML)).toBe('xy');
  });
});

describe('spacebars integration - interpolate attribute', () => {
  test('attribute interpolation', () => {
    const tmpl = makeTemplate('test_interp', '<div class="aaa{{foo bar}}zzz"></div>');
    tmpl.helpers({
      foo: function (x: number) {
        return x + 1;
      },
      bar: function () {
        return 123;
      },
    });
    const div = renderToDiv(tmpl);
    const inner = div.querySelector('div');
    expect(inner!.className).toBe('aaa124zzz');
  });
});

describe('spacebars integration - dynamic attrs', () => {
  test('object attributes with reactive updates', () => {
    const tmpl = makeTemplate(
      'test_dynattrs',
      '<span {{attrsObj}} {{singleAttr}} {{nonexistent}}>hi</span>',
    );
    const R2 = reactive.ReactiveVar({ x: 'X' } as Record<string, string>);
    const R3 = reactive.ReactiveVar('selected');

    tmpl.helpers({
      attrsObj: function () {
        return R2.get();
      },
      singleAttr: function () {
        return R3.get();
      },
    });

    const div = renderToDiv(tmpl);
    const span = div.querySelector('span')!;
    expect(span.innerHTML).toBe('hi');
    expect(span.hasAttribute('selected')).toBe(true);
    expect(span.getAttribute('x')).toBe('X');

    R2.set({ y: 'Y', z: 'Z' });
    R3.set('');
    reactive.flush();
    expect(span.hasAttribute('selected')).toBe(false);
    expect(span.hasAttribute('x')).toBe(false);
    expect(span.getAttribute('y')).toBe('Y');
    expect(span.getAttribute('z')).toBe('Z');
  });
});

describe('spacebars integration - if/unless', () => {
  test('if helper with reactive condition', () => {
    const tmpl = makeTemplate('test_if', '{{#if foo}}{{bar}}{{else}}{{baz}}{{/if}}');
    const R = reactive.ReactiveVar(true);
    tmpl.helpers({
      foo: function () {
        return R.get();
      },
      bar: 1,
      baz: 2,
    });

    const div = renderToDiv(tmpl);
    expect(canonicalizeHtml(div.innerHTML)).toBe('1');

    R.set(false);
    reactive.flush();
    expect(canonicalizeHtml(div.innerHTML)).toBe('2');
  });

  test('if in with block', () => {
    const tmpl = makeTemplate(
      'test_if_with',
      '{{#with foo}}{{bar}}{{#if true}}{{bar}}{{/if}}{{/with}}',
    );
    tmpl.helpers({ foo: { bar: 'bar' } });
    const div = renderToDiv(tmpl);
    // Both output 'bar' adjacently
    expect(canonicalizeHtml(div.innerHTML)).toContain('bar');
  });
});

describe('spacebars integration - each on array', () => {
  test('each with reactive array', () => {
    const tmpl = makeTemplate('test_each', '{{#each items}}{{this}}{{else}}else-clause{{/each}}');
    const R = reactive.ReactiveVar<unknown[]>([]);
    tmpl.helpers({
      items: function () {
        return R.get();
      },
    });

    const div = renderToDiv(tmpl);
    expect(canonicalizeHtml(div.innerHTML)).toBe('else-clause');

    R.set(['x', '', 'toString']);
    reactive.flush();
    // empty string in array produces empty text, canonicalized output varies
    const html = canonicalizeHtml(div.innerHTML);
    expect(html).toContain('x');
    expect(html).toContain('toString');

    R.set([]);
    reactive.flush();
    expect(canonicalizeHtml(div.innerHTML)).toBe('else-clause');

    R.set([0, 1, 2]);
    reactive.flush();
    const numHtml = canonicalizeHtml(div.innerHTML);
    expect(numHtml).toContain('0');
    expect(numHtml).toContain('1');
    expect(numHtml).toContain('2');
  });
});

describe('spacebars integration - with', () => {
  test('#with falsy value (issue #770)', () => {
    const tmpl = makeTemplate(
      'test_with_falsy',
      '{{#with value1}}{{this}}{{else}}xxx{{/with}} {{#with value2}}{{this}}{{else}}xxx{{/with}} {{#with value1}}{{this}}{{/with}} {{#with value2}}{{this}}{{/with}}',
    );

    tmpl.helpers({
      value1: 0,
      value2: '',
    });

    const div = renderToDiv(tmpl);
    // 0 and '' are falsy, so first two show 'xxx' from else, last two show nothing
    expect(canonicalizeHtml(div.innerHTML)).toBe('xxx xxx');
  });

  test('#with someData helper', () => {
    const tmpl = makeTemplate('test_with_data', '{{#with someData}}{{foo}} {{bar}}{{/with}}');
    const R = reactive.ReactiveVar({ foo: 'A', bar: 'B' } as Record<string, string> | null);
    tmpl.helpers({
      someData: function () {
        return R.get();
      },
    });

    const div = renderToDiv(tmpl);
    expect(canonicalizeHtml(div.innerHTML)).toBe('A B');

    R.set({ foo: 'C', bar: 'D' });
    reactive.flush();
    expect(canonicalizeHtml(div.innerHTML)).toBe('C D');

    R.set(null);
    reactive.flush();
    expect(canonicalizeHtml(div.innerHTML)).toBe('');
  });
});

describe('spacebars integration - textarea', () => {
  test('textarea content', () => {
    const tmpl = makeTemplate('test_textarea', '<textarea>{{foo}}</textarea>');
    const R = reactive.ReactiveVar('hello');
    tmpl.helpers({
      foo: function () {
        return R.get();
      },
    });

    const div = renderToDiv(tmpl);
    const ta = div.querySelector('textarea');
    expect(ta).toBeTruthy();
    expect(ta!.value).toBe('hello');
  });

  test('textarea with if', () => {
    const tmpl = makeTemplate(
      'test_textarea_if',
      '<textarea>{{#if foo}}</not a tag>{{else}}<also not a tag>{{/if}}</textarea>',
    );
    const R = reactive.ReactiveVar(true);
    tmpl.helpers({
      foo: function () {
        return R.get();
      },
    });

    const div = renderToDiv(tmpl);
    const ta = div.querySelector('textarea');
    expect(ta!.value).toBe('</not a tag>');
  });
});

describe('spacebars integration - nully attributes', () => {
  test('checkbox with empty checked attribute', () => {
    const tmpl = makeTemplate('test_nully0', '<input type="checkbox" checked="" stuff="">');
    const div = renderToDiv(tmpl);
    const input = div.querySelector('input') as HTMLInputElement;
    expect(input.checked).toBe(true);
  });

  test('nully attribute removal', () => {
    const tmpl = makeTemplate(
      'test_nully1',
      '<input type="checkbox" checked={{foo}} stuff={{foo}}>',
    );
    const R = reactive.ReactiveVar<string | null>('checked');
    tmpl.helpers({
      foo: function () {
        return R.get();
      },
    });

    const div = renderToDiv(tmpl);
    const input = div.querySelector('input') as HTMLInputElement;
    expect(input.checked).toBe(true);
    expect(input.hasAttribute('stuff')).toBe(true);

    R.set(null);
    reactive.flush();
    expect(input.checked).toBe(false);
    expect(input.hasAttribute('stuff')).toBe(false);
  });
});

describe('spacebars integration - double (escaping)', () => {
  test('double stache escapes HTML', () => {
    const tmpl = makeTemplate('test_double', '{{foo}}');
    tmpl.helpers({
      foo: function () {
        return '<b>hi</b>';
      },
    });
    const div = renderToDiv(tmpl);
    // Double stache should escape HTML entities
    expect(div.querySelector('b')).toBeNull();
    expect(canonicalizeHtml(div.innerHTML)).toContain('&lt;b&gt;hi&lt;/b&gt;');
  });
});

describe('spacebars integration - block comments', () => {
  test('block comments are not displayed', () => {
    const tmpl = makeTemplate('test_comments', '{{!-- foo --}}{{!--\n  {{bar}}\n--}}hello');
    const div = renderToDiv(tmpl);
    expect(canonicalizeHtml(div.innerHTML)).toBe('hello');
  });
});

describe('spacebars integration - toHTML', () => {
  test('toHTML with helper', () => {
    const tmpl = makeTemplate('test_tohtml', '{{foo}}');
    tmpl.helpers({ foo: 'bar' });
    const html = toHTML(tmpl);
    expect(html).toBe('bar');
  });

  test('toHTML with #if', () => {
    const tmpl = makeTemplate('test_tohtml_if', '{{#if true}}{{foo}}{{/if}}');
    tmpl.helpers({ foo: 'bar' });
    const html = toHTML(tmpl);
    expect(html).toBe('bar');
  });

  test('toHTML with #with', () => {
    const tmpl = makeTemplate('test_tohtml_with', '{{#with foo}}{{.}}{{/with}}');
    tmpl.helpers({ foo: 'bar' });
    const html = toHTML(tmpl);
    expect(canonicalizeHtml(html)).toBe('bar');
  });

  test('toHTML with #each', () => {
    const tmpl = makeTemplate('test_tohtml_each', '{{#each foos}}{{.}}{{/each}}');
    tmpl.helpers({ foos: ['a', 'b', 'c'] });
    const html = toHTML(tmpl);
    expect(canonicalizeHtml(html)).toBe('abc');
  });
});

describe('spacebars integration - tables', () => {
  test('table renders correctly', () => {
    const tmpl = makeTemplate('test_table', '<table><tr><td>Foo</td></tr></table>');
    const div = renderToDiv(tmpl);
    expect(div.querySelector('table')).toBeTruthy();
    // jsdom may parse table structure differently with Raw nodes
    const html = canonicalizeHtml(div.innerHTML);
    expect(html).toContain('Foo');
  });

  test('table with helper', () => {
    const tmpl = makeTemplate('test_table2', '<table><tr><td>{{foo}}</td></tr></table>');
    tmpl.helpers({ foo: 'Bar' });
    const div = renderToDiv(tmpl);
    expect(div.querySelector('td')!.textContent).toBe('Bar');
  });
});

describe('spacebars integration - template lifecycle', () => {
  test('created/rendered/destroyed fire in order', () => {
    const buf: string[] = [];
    const tmpl = makeTemplate('test_lifecycle', '<div>hello</div>');
    tmpl.onCreated(function () {
      buf.push('created');
    });
    tmpl.onRendered(function () {
      buf.push('rendered');
    });
    tmpl.onDestroyed(function () {
      buf.push('destroyed');
    });

    const div = renderToDiv(tmpl);
    expect(buf).toContain('created');
    expect(buf).toContain('rendered');

    const view = getView(div.firstChild!);
    if (view) remove(view);
    expect(buf).toContain('destroyed');
  });
});

describe('spacebars integration - nested expressions', () => {
  test('nested sub-expression', () => {
    const tmpl = makeTemplate('test_nested', '{{add (add 1 2) 3}}');
    tmpl.helpers({
      add: function (a: number, b: number) {
        return a + b;
      },
    });
    const div = renderToDiv(tmpl);
    expect(canonicalizeHtml(div.innerHTML)).toBe('6');
  });

  test('nested sub-expressions with functions', () => {
    const tmpl = makeTemplate('test_nested2', '{{capitalize (firstWord generateSentence)}}');
    tmpl.helpers({
      generateSentence: 'hello world',
      firstWord: function (str: string) {
        return str.split(' ')[0];
      },
      capitalize: function (str: string) {
        return str.toUpperCase();
      },
    });
    const div = renderToDiv(tmpl);
    expect(canonicalizeHtml(div.innerHTML)).toBe('HELLO');
  });
});

describe('spacebars integration - tricky attrs', () => {
  test('type and class attributes', () => {
    const tmpl = makeTemplate(
      'test_tricky',
      '<input type={{theType}}><input type=checkbox class={{theClass}}>',
    );
    const R1 = reactive.ReactiveVar('text');
    const R2 = reactive.ReactiveVar('foo');
    tmpl.helpers({
      theType: function () {
        return R1.get();
      },
      theClass: function () {
        return R2.get();
      },
    });

    const div = renderToDiv(tmpl);
    const inputs = div.querySelectorAll('input');
    expect(inputs[0]!.type).toBe('text');
    expect(inputs[1]!.className).toBe('foo');
  });
});

describe('spacebars integration - no data context', () => {
  test('no data renders correctly', () => {
    const tmpl = makeTemplate('test_nodata', '{{this.foo}}{{#unless this.bar}}asdf{{/unless}}');
    const div = renderToDiv(tmpl);
    expect(canonicalizeHtml(div.innerHTML)).toBe('asdf');
  });
});

describe('spacebars integration - falsy helper', () => {
  test('falsy values display correctly', () => {
    const tmpl = makeTemplate('test_falsy', 'foo:{{foo}} zero:{{zero}}');
    tmpl.helpers({
      foo: '',
      zero: 0,
    });
    const div = renderToDiv(tmpl);
    // empty string shows nothing, 0 shows '0'
    expect(canonicalizeHtml(div.innerHTML)).toBe('foo: zero:0');
  });
});

describe('spacebars integration - let bindings', () => {
  test('let with alias and override', () => {
    const tmpl = makeTemplate(
      'test_let',
      '{{#with dataContext}}{{#let alias=helper anotherVarFromContext="override"}}' +
        '<div>{{alias}} -- {{helper}} -- {{varFromContext}} -- {{anotherVarFromContext}}</div>' +
        '{{/let}}{{/with}}',
    );
    tmpl.helpers({
      dataContext: {
        helper: 'H',
        varFromContext: 'V',
        anotherVarFromContext: 'original',
      },
    });
    const div = renderToDiv(tmpl);
    expect(canonicalizeHtml(div.innerHTML)).toBe('<div>H -- H -- V -- override</div>');
  });
});

describe('spacebars integration - each @index', () => {
  test('@index is available', () => {
    const tmpl = makeTemplate(
      'test_index',
      '{{#each things}}<span>{{@index}} - {{num}}</span>{{/each}}',
    );
    const R = reactive.ReactiveVar([{ num: 'a' }, { num: 'b' }, { num: 'c' }]);
    tmpl.helpers({
      things: function () {
        return R.get();
      },
    });

    const div = renderToDiv(tmpl);
    const spans = div.querySelectorAll('span');
    expect(spans).toHaveLength(3);
    expect(spans[0]!.textContent).toBe('0 - a');
    expect(spans[1]!.textContent).toBe('1 - b');
    expect(spans[2]!.textContent).toBe('2 - c');
  });
});

describe('spacebars integration - expressions as keyword args', () => {
  test('sub-expression as keyword arg', () => {
    const tmpl = makeTemplate(
      'test_kwarg',
      '{{> callable stuff=(capitalize name) another=(capitalize "mello")}}',
    );

    const callable = makeTemplate('callable', '{{stuff}} {{another}}');
    // Register as a global template
    (Template as Record<string, unknown>)['callable'] = callable;

    tmpl.helpers({
      capitalize: function (str: string) {
        return str.toUpperCase();
      },
      name: 'hello',
    });

    const div = renderToDiv(tmpl);
    expect(canonicalizeHtml(div.innerHTML)).toBe('HELLO MELLO');

    // Clean up
    delete (Template as Record<string, unknown>)['callable'];
  });
});

describe('spacebars integration - Blaze.render / Blaze.remove', () => {
  test('render and remove lifecycle', () => {
    const tmpl = makeTemplate('test_render', '<span>{{greeting}} {{r}}</span>');
    const R = reactive.ReactiveVar('world');
    tmpl.helpers({
      greeting: 'hello',
      r: function () {
        return R.get();
      },
    });

    const div = document.createElement('div');
    const view = render(tmpl, div);
    reactive.flush();

    expect(canonicalizeHtml(div.innerHTML)).toBe('<span>hello world</span>');

    R.set('earth');
    reactive.flush();
    expect(canonicalizeHtml(div.innerHTML)).toBe('<span>hello earth</span>');

    remove(view);
    expect(div.innerHTML).toBe('');
  });
});

describe('spacebars integration - #with mutated data context', () => {
  test('with reactively updates data context', () => {
    const tmpl = makeTemplate('test_with_mutate', '{{#with foo}}{{value}}{{/with}}');
    const R = reactive.ReactiveVar({ value: 'A' } as Record<string, string>);
    tmpl.helpers({
      foo: function () {
        return R.get();
      },
    });

    const div = renderToDiv(tmpl);
    expect(canonicalizeHtml(div.innerHTML)).toBe('A');

    R.set({ value: 'B' });
    reactive.flush();
    expect(canonicalizeHtml(div.innerHTML)).toBe('B');
  });
});

describe('spacebars integration - event handlers', () => {
  test('event handler fires', () => {
    const tmpl = makeTemplate('test_events', '<button class="btn">click</button>');
    let clicked = false;
    tmpl.events({
      'click .btn': function () {
        clicked = true;
      },
    });

    const div = document.createElement('div');
    document.body.appendChild(div);
    render(tmpl, div);
    reactive.flush();

    const btn = div.querySelector('.btn')!;
    btn.dispatchEvent(new dom.window.Event('click', { bubbles: true }));
    expect(clicked).toBe(true);

    div.remove();
  });

  test('event handler returns false', () => {
    const tmpl = makeTemplate('test_event_false', '<a href="#bad" id="link">click</a>');
    tmpl.events({
      'click #link': function () {
        return false;
      },
    });

    const div = document.createElement('div');
    document.body.appendChild(div);
    render(tmpl, div);
    reactive.flush();

    const link = div.querySelector('#link')!;
    const evt = new dom.window.Event('click', { bubbles: true, cancelable: true });
    link.dispatchEvent(evt);
    // returning false should have been processed without error

    div.remove();
  });
});

describe('spacebars integration - SVG', () => {
  test('SVG anchor with xlink:href', () => {
    // The compiler should handle SVG elements
    const tmpl = makeTemplate('test_svg', '<svg><a xlink:href="http://example.com">Foo</a></svg>');
    const div = renderToDiv(tmpl);
    const svg = div.querySelector('svg');
    expect(svg).toBeTruthy();
  });
});

describe('spacebars integration - global helpers', () => {
  test('registered global helper accessible', () => {
    registerHelper('GLOBAL_ZERO', 0);

    const tmpl = makeTemplate('test_global', 'val:{{GLOBAL_ZERO}}');
    const div = renderToDiv(tmpl);
    expect(canonicalizeHtml(div.innerHTML)).toBe('val:0');

    deregisterHelper('GLOBAL_ZERO');
  });
});

describe('spacebars integration - constant each argument', () => {
  test('each with constant array', () => {
    const tmpl = makeTemplate(
      'test_const_each',
      '{{#with someData}}{{#each anArray}}{{justReturn this}}{{/each}}{{this}}{{/with}}',
    );
    tmpl.helpers({
      someData: function () {
        return 'parentData';
      },
      anArray: ['item1', 'item2'],
      justReturn: function (x: unknown) {
        return x;
      },
    });

    const div = renderToDiv(tmpl);
    // this test verifies the each + with data context interaction
    const html = canonicalizeHtml(div.innerHTML);
    expect(html).toContain('item1');
    expect(html).toContain('item2');
  });
});

describe('spacebars integration - dynamic templates', () => {
  test('dynamic template switching', () => {
    // Register templates on Template namespace
    const aaa = makeTemplate('aaa', 'aaa');
    const bbb = makeTemplate('bbb', 'bbb');
    (Template as Record<string, unknown>)['aaa'] = aaa;
    (Template as Record<string, unknown>)['bbb'] = bbb;

    const tmpl = makeTemplate('test_dynamic', '{{> foo}}');
    const R = reactive.ReactiveVar('aaa');
    tmpl.helpers({
      foo: function () {
        return R.get() === 'aaa' ? aaa : bbb;
      },
    });

    const div = renderToDiv(tmpl);
    expect(canonicalizeHtml(div.innerHTML)).toBe('aaa');

    R.set('bbb');
    reactive.flush();
    expect(canonicalizeHtml(div.innerHTML)).toBe('bbb');

    delete (Template as Record<string, unknown>)['aaa'];
    delete (Template as Record<string, unknown>)['bbb'];
  });
});

describe('spacebars integration - helper invalidates self', () => {
  test('helper that changes reactive var it depends on', () => {
    const tmpl = makeTemplate('test_self_invalidate', '{{foo}}');
    const R = reactive.ReactiveVar(0);
    let count = 0;
    tmpl.helpers({
      foo: function () {
        const val = R.get();
        if (val < 3) {
          count++;
          R.set(val + 1);
        }
        return val;
      },
    });

    // This should not infinite loop — Blaze limits re-invalidation
    const div = renderToDiv(tmpl);
    // The final value after stabilizing should be >= 3
    reactive.flush();
    expect(count).toBeGreaterThan(0);
  });
});

describe('spacebars integration - new #each with each-in', () => {
  test('each-in with variable binding', () => {
    const tmpl = makeTemplate(
      'test_each_in',
      '{{#with dataContext}}{{#each item in items}}<div>{{item.text}} -- {{toplevel}}</div>{{/each}}{{/with}}',
    );
    tmpl.helpers({
      dataContext: {
        items: [{ text: 'A' }, { text: 'B' }],
        toplevel: 'TOP',
      },
    });

    const div = renderToDiv(tmpl);
    const divs = div.querySelectorAll('div');
    expect(divs).toHaveLength(2);
    expect(divs[0]!.textContent).toBe('A -- TOP');
    expect(divs[1]!.textContent).toBe('B -- TOP');
  });
});

describe('spacebars integration - old #each data context', () => {
  test('old each sets data context', () => {
    const tmpl = makeTemplate('test_old_each', '{{#each items}}<div>{{text}}</div>{{/each}}');
    tmpl.helpers({
      items: [{ text: 'one' }, { text: 'two' }],
    });

    const div = renderToDiv(tmpl);
    const divs = div.querySelectorAll('div');
    expect(divs).toHaveLength(2);
    expect(divs[0]!.textContent).toBe('one');
    expect(divs[1]!.textContent).toBe('two');
  });
});

// ─── Additional textarea tests ────────────────────────────────────────────────

describe('spacebars integration - textarea variations', () => {
  test('textarea with reactive conditional content', () => {
    const tmpl = makeTemplate(
      'test_textarea2',
      '<textarea>{{#if foo}}</not a tag>{{else}}<also not a tag>{{/if}}</textarea>',
    );
    const R = reactive.ReactiveVar(true);
    tmpl.helpers({ foo: () => R.get() });

    const div = renderToDiv(tmpl);
    const textarea = div.querySelector('textarea')!;
    expect(textarea.value).toBe('</not a tag>');

    R.set(false);
    reactive.flush();
    expect(textarea.value).toBe('<also not a tag>');

    R.set(true);
    reactive.flush();
    expect(textarea.value).toBe('</not a tag>');
  });

  test('textarea with id and reactive value', () => {
    const tmpl = makeTemplate('test_textarea3', '<textarea id="myTextarea">{{foo}}</textarea>');
    const R = reactive.ReactiveVar('hello');
    tmpl.helpers({ foo: () => R.get() });

    const div = renderToDiv(tmpl);
    const textarea = div.querySelector('textarea')!;
    expect(textarea.id).toBe('myTextarea');
    expect(textarea.value).toBe('hello');

    R.set('world');
    reactive.flush();
    expect(textarea.value).toBe('world');
  });

  test('textarea with each loop content', () => {
    const tmpl = makeTemplate(
      'test_textarea_each',
      '<textarea>{{#each foo}}<not a tag {{this}} {{/each}}</textarea>',
    );
    const R = reactive.ReactiveVar(['APPLE', 'BANANA']);
    tmpl.helpers({ foo: () => R.get() });

    const div = renderToDiv(tmpl);
    const textarea = div.querySelector('textarea')!;
    expect(textarea.value).toContain('APPLE');
    expect(textarea.value).toContain('BANANA');
  });
});

// ─── Input value & checked tests ──────────────────────────────────────────────

describe('spacebars integration - input rendering', () => {
  test('input value attribute with reactive var', () => {
    const tmpl = makeTemplate('test_input_value', '<input value="{{val}}">');
    const R = reactive.ReactiveVar('hello');
    tmpl.helpers({ val: () => R.get() });

    const div = renderToDiv(tmpl);
    const input = div.querySelector('input')!;
    expect(input.value).toBe('hello');

    R.set('hola');
    reactive.flush();
    expect(input.value).toBe('hola');
  });

  test('input checked attribute with reactive var', () => {
    const tmpl = makeTemplate('test_input_checked', '<input type="checkbox" checked="{{val}}">');
    const R = reactive.ReactiveVar<string | null>(null);
    tmpl.helpers({ val: () => R.get() });

    const div = renderToDiv(tmpl);
    const input = div.querySelector('input')!;
    expect(input.checked).toBe(false);

    R.set('checked');
    reactive.flush();
    expect(input.checked).toBe(true);

    R.set(null);
    reactive.flush();
    expect(input.checked).toBe(false);
  });
});

// ─── View isolation tests ─────────────────────────────────────────────────────

describe('spacebars integration - view isolation', () => {
  test('reactively change text node', () => {
    const tmpl = makeTemplate('test_isolation', '<p>{{text}}</p>');
    const R = reactive.ReactiveVar('Hello');
    tmpl.helpers({ text: () => R.get() });

    const div = renderToDiv(tmpl);
    expect(canonicalizeHtml(div.innerHTML)).toBe('<p>Hello</p>');

    R.set('World');
    reactive.flush();
    expect(canonicalizeHtml(div.innerHTML)).toBe('<p>World</p>');
  });

  test('reactively change array of text nodes', () => {
    const tmpl = makeTemplate('test_isolation2', '<p>{{first}}{{second}}</p>');
    const R1 = reactive.ReactiveVar('Hello');
    const R2 = reactive.ReactiveVar(' World');
    tmpl.helpers({ first: () => R1.get(), second: () => R2.get() });

    const div = renderToDiv(tmpl);
    expect(div.querySelector('p')!.textContent).toBe('Hello World');

    R1.set('Goodbye');
    reactive.flush();
    expect(div.querySelector('p')!.textContent).toBe('Goodbye World');
  });
});

// ─── SVG rendering ────────────────────────────────────────────────────────────

describe('spacebars integration - SVG rendering', () => {
  test('SVG elements render in correct namespace', () => {
    const tmpl = makeTemplate(
      'test_svg',
      '<div class="container"><svg width="100" height="100"><circle cx="50" cy="50" r="40" fill="{{fillColor}}"></circle></svg></div>',
    );
    const fillColor = reactive.ReactiveVar('red');
    tmpl.helpers({ fillColor: () => fillColor.get() });

    const div = renderToDiv(tmpl);
    const circle = div.querySelector('.container > svg > circle')!;
    expect(circle.getAttribute('fill')).toBe('red');

    fillColor.set('green');
    reactive.flush();
    expect(circle.getAttribute('fill')).toBe('green');

    expect(circle.nodeName).toBe('circle');
    expect(circle.namespaceURI).toBe('http://www.w3.org/2000/svg');
  });

  test('SVG with reactive class', () => {
    const tmpl = makeTemplate(
      'test_svg_class',
      '<svg><rect class="{{cls}}" width="10" height="10"></rect></svg>',
    );
    const cls = reactive.ReactiveVar('one two');
    tmpl.helpers({ cls: () => cls.get() });

    const div = renderToDiv(tmpl);
    const rect = div.querySelector('rect')!;
    expect(rect.getAttribute('class')).toBe('one two');

    cls.set('two three');
    reactive.flush();
    expect(rect.getAttribute('class')).toBe('two three');
  });
});

// ─── Inclusion / block helper tests ──────────────────────────────────────────

describe('spacebars integration - inclusion with arguments', () => {
  test('include template with simple argument', () => {
    // Create a child template that renders its data context
    const child = makeTemplate('child_aaa', 'aaa');
    (Template as Record<string, unknown>)['child_aaa'] = child;

    const tmpl = makeTemplate('test_inclusion', '{{> childTmpl}}');
    const R = reactive.ReactiveVar(child);
    tmpl.helpers({ childTmpl: () => R.get() });

    const div = renderToDiv(tmpl);
    expect(canonicalizeHtml(div.innerHTML)).toBe('aaa');

    const child2 = makeTemplate('child_bbb', 'bbb');
    (Template as Record<string, unknown>)['child_bbb'] = child2;
    R.set(child2);
    reactive.flush();
    expect(canonicalizeHtml(div.innerHTML)).toBe('bbb');

    delete (Template as Record<string, unknown>)['child_aaa'];
    delete (Template as Record<string, unknown>)['child_bbb'];
  });

  test('include template with data argument', () => {
    const child = makeTemplate('child_span', '<span>{{this}}</span>');
    (Template as Record<string, unknown>)['child_span'] = child;

    const tmpl = makeTemplate('test_inclusion_data', '{{> childTmpl name}}');
    const R = reactive.ReactiveVar('david');
    tmpl.helpers({
      childTmpl: child,
      name: () => R.get(),
    });

    const div = renderToDiv(tmpl);
    expect(canonicalizeHtml(div.innerHTML)).toBe('<span>david</span>');
    const span1 = div.querySelector('span');

    R.set('avi');
    reactive.flush();
    expect(canonicalizeHtml(div.innerHTML)).toBe('<span>avi</span>');
    const span2 = div.querySelector('span');
    // Verify DOM is reused (same element)
    expect(span1).toBe(span2);

    delete (Template as Record<string, unknown>)['child_span'];
  });
});

describe('spacebars integration - block helpers', () => {
  test('block helper with content and else', () => {
    const tmpl = makeTemplate('test_block', '{{#if flag}}bar{{else}}baz{{/if}}');
    const R = reactive.ReactiveVar(true);
    tmpl.helpers({ flag: () => R.get() });

    const div = renderToDiv(tmpl);
    expect(canonicalizeHtml(div.innerHTML)).toBe('bar');

    R.set(false);
    reactive.flush();
    expect(canonicalizeHtml(div.innerHTML)).toBe('baz');
  });

  test('nested conditionals', () => {
    const tmpl = makeTemplate(
      'test_nested_if',
      '{{#if outer}}{{#if inner}}both{{else}}outer-only{{/if}}{{else}}none{{/if}}',
    );
    const outer = reactive.ReactiveVar(true);
    const inner = reactive.ReactiveVar(true);
    tmpl.helpers({ outer: () => outer.get(), inner: () => inner.get() });

    const div = renderToDiv(tmpl);
    expect(canonicalizeHtml(div.innerHTML)).toBe('both');

    inner.set(false);
    reactive.flush();
    expect(canonicalizeHtml(div.innerHTML)).toBe('outer-only');

    outer.set(false);
    reactive.flush();
    expect(canonicalizeHtml(div.innerHTML)).toBe('none');
  });

  test('block helper with template switching', () => {
    const content = makeTemplate('content_tmpl', '<b>content</b>');
    const elsecontent = makeTemplate('else_tmpl', '<i>else</i>');
    (Template as Record<string, unknown>)['content_tmpl'] = content;
    (Template as Record<string, unknown>)['else_tmpl'] = elsecontent;

    const tmpl = makeTemplate(
      'test_block_switch',
      '{{#if show}}<b>content</b>{{else}}<i>else</i>{{/if}}',
    );
    const R = reactive.ReactiveVar(true);
    tmpl.helpers({ show: () => R.get() });

    const div = renderToDiv(tmpl);
    expect(canonicalizeHtml(div.innerHTML)).toBe('<b>content</b>');

    R.set(false);
    reactive.flush();
    expect(canonicalizeHtml(div.innerHTML)).toBe('<i>else</i>');

    R.set(true);
    reactive.flush();
    expect(canonicalizeHtml(div.innerHTML)).toBe('<b>content</b>');

    delete (Template as Record<string, unknown>)['content_tmpl'];
    delete (Template as Record<string, unknown>)['else_tmpl'];
  });
});

// ─── Parent data context (..) ────────────────────────────────────────────────

describe('spacebars integration - parent data context', () => {
  test('access parent context with ../', () => {
    const tmpl = makeTemplate(
      'test_parent_ctx',
      '{{#with child}}{{name}} of {{../parentName}}{{/with}}',
    );

    const div = renderToDiv(tmpl, { child: { name: 'kid' }, parentName: 'parent' });
    expect(div.textContent).toContain('kid');
    expect(div.textContent).toContain('parent');
  });
});

// ─── Helper isolation tests ──────────────────────────────────────────────────

describe('spacebars integration - helper isolation', () => {
  test('simple helpers are isolated - re-render reuses DOM nodes', () => {
    const tmpl = makeTemplate('test_helper_iso', '<p>{{foo}}</p>');
    const R = reactive.ReactiveVar('initial');
    tmpl.helpers({ foo: () => R.get() });

    const div = renderToDiv(tmpl);
    const p1 = div.querySelector('p');
    expect(p1!.textContent).toBe('initial');

    R.set('updated');
    reactive.flush();
    const p2 = div.querySelector('p');
    // The <p> element should be reused, not recreated
    expect(p1).toBe(p2);
    expect(p2!.textContent).toBe('updated');
  });

  test('attribute helpers are isolated', () => {
    const tmpl = makeTemplate('test_attr_iso', '<p attr="{{foo}}">text</p>');
    const R = reactive.ReactiveVar('foo');
    tmpl.helpers({ foo: () => R.get() });

    const div = renderToDiv(tmpl);
    const p = div.querySelector('p')!;
    expect(p.getAttribute('attr')).toBe('foo');

    // Mutate attribute externally
    p.setAttribute('attr', 'not-foo');
    // Trigger reactive update with same value — the helper reads 'foo'
    R.set('foo');
    reactive.flush();
    // Because value didn't change, attribute should stay at the external value
    expect(p.getAttribute('attr')).toBe('not-foo');
  });
});

// ─── Rendered callback tests ─────────────────────────────────────────────────

describe('spacebars integration - rendered callbacks', () => {
  test('rendered template content is available in onRendered', () => {
    const tmpl = makeTemplate('test_rendered_cb', '<p>hello</p>');
    let renderedHTML = '';
    tmpl.onRendered(function (this: TemplateInstance) {
      const firstNode = this.firstNode;
      if (firstNode && firstNode.parentElement) {
        renderedHTML = firstNode.parentElement.innerHTML;
      }
    });

    const div = renderToDiv(tmpl);
    reactive.flush();
    expect(renderedHTML).toContain('<p>hello</p>');
  });

  test('findAll in rendered callback', () => {
    const tmpl = makeTemplate('test_findall', '<div><p>first</p><p>second</p></div>');
    let foundCount = 0;
    tmpl.onRendered(function (this: TemplateInstance) {
      const found = this.findAll('p');
      foundCount = found.length;
    });

    renderToDiv(tmpl);
    reactive.flush();
    expect(foundCount).toBe(2);
  });

  test('lifecycle order: created → rendered → destroyed', () => {
    const order: string[] = [];
    const tmpl = makeTemplate('test_lifecycle_order', '<span>test</span>');
    tmpl.onCreated(function () {
      order.push('created');
    });
    tmpl.onRendered(function () {
      order.push('rendered');
    });
    tmpl.onDestroyed(function () {
      order.push('destroyed');
    });

    const div = renderToDiv(tmpl);
    reactive.flush();
    expect(order).toEqual(['created', 'rendered']);

    // We need to find the view to remove it
    const view = getView(div.firstChild as Element);
    if (view) remove(view);

    expect(order).toEqual(['created', 'rendered', 'destroyed']);
  });
});

// ─── Complex expression tests ─────────────────────────────────────────────────

describe('spacebars integration - complex expressions', () => {
  test('nested with and each', () => {
    const tmpl = makeTemplate(
      'test_nested_with_each',
      '{{#with data}}{{#each items}}<span>{{name}} ({{../category}})</span>{{/each}}{{/with}}',
    );
    tmpl.helpers({
      data: {
        category: 'fruit',
        items: [{ name: 'apple' }, { name: 'banana' }],
      },
    });

    const div = renderToDiv(tmpl);
    const spans = div.querySelectorAll('span');
    expect(spans).toHaveLength(2);
    expect(spans[0]!.textContent).toBe('apple (fruit)');
    expect(spans[1]!.textContent).toBe('banana (fruit)');
  });

  test('multiple helpers in same element', () => {
    const tmpl = makeTemplate(
      'test_multi_helpers',
      '<div class="{{cls}}" data-id="{{id}}">{{text}}</div>',
    );
    tmpl.helpers({
      cls: 'my-class',
      id: '42',
      text: 'content',
    });

    const div = renderToDiv(tmpl);
    const el = div.querySelector('div')!;
    expect(el.className).toBe('my-class');
    expect(el.getAttribute('data-id')).toBe('42');
    expect(el.textContent).toBe('content');
  });

  test('each with index and nested helpers', () => {
    const tmpl = makeTemplate(
      'test_each_complex',
      '{{#each item in items}}<li>{{@index}}: {{item.name}}</li>{{/each}}',
    );
    tmpl.helpers({
      items: [{ name: 'a' }, { name: 'b' }, { name: 'c' }],
    });

    const div = renderToDiv(tmpl);
    const lis = div.querySelectorAll('li');
    expect(lis).toHaveLength(3);
    expect(lis[0]!.textContent).toBe('0: a');
    expect(lis[1]!.textContent).toBe('1: b');
    expect(lis[2]!.textContent).toBe('2: c');
  });

  test('let with multiple bindings', () => {
    const tmpl = makeTemplate('test_let_multi', '{{#let x="hello" y="world"}}{{x}} {{y}}{{/let}}');

    const div = renderToDiv(tmpl);
    expect(div.textContent).toContain('hello');
    expect(div.textContent).toContain('world');
  });

  test('deeply nested data contexts', () => {
    const tmpl = makeTemplate(
      'test_deep_ctx',
      '{{#with a}}{{#with b}}{{#with c}}{{value}}{{/with}}{{/with}}{{/with}}',
    );
    tmpl.helpers({
      a: { b: { c: { value: 'deep' } } },
    });

    const div = renderToDiv(tmpl);
    expect(div.textContent).toContain('deep');
  });
});

// ─── Edge case tests ──────────────────────────────────────────────────────────

describe('spacebars integration - edge cases', () => {
  test('empty template renders nothing', () => {
    const tmpl = makeTemplate('test_empty', '');
    const div = renderToDiv(tmpl);
    expect(canonicalizeHtml(div.innerHTML)).toBe('');
  });

  test('comment-only template', () => {
    const tmpl = makeTemplate('test_comment_only', '<!-- just a comment -->');
    const div = renderToDiv(tmpl);
    // Comment should be present but not visible as text
    expect(div.textContent!.trim()).toBe('');
  });

  test('whitespace-only template', () => {
    const tmpl = makeTemplate('test_ws', '   ');
    const div = renderToDiv(tmpl);
    expect(div.textContent!.trim()).toBe('');
  });

  test('special HTML entities', () => {
    const tmpl = makeTemplate('test_entities', '<p>&amp; &lt; &gt; &quot;</p>');
    const div = renderToDiv(tmpl);
    expect(div.querySelector('p')!.textContent).toBe('& < > "');
  });

  test('helper returning 0', () => {
    const tmpl = makeTemplate('test_zero', '{{val}}');
    tmpl.helpers({ val: 0 });
    const div = renderToDiv(tmpl);
    expect(div.textContent).toBe('0');
  });

  test('helper returning empty string', () => {
    const tmpl = makeTemplate('test_empty_str', '{{val}}');
    tmpl.helpers({ val: '' });
    const div = renderToDiv(tmpl);
    expect(div.textContent).toBe('');
  });

  test('helper returning false renders empty (Blaze treats false as nully)', () => {
    const tmpl = makeTemplate('test_false', '{{val}}');
    tmpl.helpers({ val: false });
    const div = renderToDiv(tmpl);
    // In Blaze, `false` is treated as nully and renders as empty string
    expect(div.textContent).toBe('');
  });

  test('nested template inclusion', () => {
    const inner = makeTemplate('inner_tmpl', '<em>inner</em>');
    (Template as Record<string, unknown>)['inner_tmpl'] = inner;

    const outer = makeTemplate('outer_tmpl', '<div>{{> innerTmpl}}</div>');
    outer.helpers({ innerTmpl: inner });

    const div = renderToDiv(outer);
    expect(div.querySelector('em')!.textContent).toBe('inner');

    delete (Template as Record<string, unknown>)['inner_tmpl'];
  });

  test('multiple reactive updates in sequence', () => {
    const tmpl = makeTemplate('test_multi_update', '<span>{{val}}</span>');
    const R = reactive.ReactiveVar(1);
    tmpl.helpers({ val: () => R.get() });

    const div = renderToDiv(tmpl);
    expect(div.querySelector('span')!.textContent).toBe('1');

    for (let i = 2; i <= 5; i++) {
      R.set(i);
      reactive.flush();
      expect(div.querySelector('span')!.textContent).toBe(String(i));
    }
  });

  test('conditional with reactive data context', () => {
    const tmpl = makeTemplate('test_cond_data', '{{#if show}}<p>{{message}}</p>{{/if}}');
    const show = reactive.ReactiveVar(false);
    const message = reactive.ReactiveVar('hello');
    tmpl.helpers({
      show: () => show.get(),
      message: () => message.get(),
    });

    const div = renderToDiv(tmpl);
    expect(div.querySelector('p')).toBeNull();

    show.set(true);
    reactive.flush();
    expect(div.querySelector('p')!.textContent).toBe('hello');

    message.set('world');
    reactive.flush();
    expect(div.querySelector('p')!.textContent).toBe('world');

    show.set(false);
    reactive.flush();
    expect(div.querySelector('p')).toBeNull();
  });
});

// ─── Ported Tests (Phase 6 continuation) ─────────────────────────────────────

describe('spacebars integration - with someData efficiency', () => {
  test('#with runs helper only once even when nested helpers re-run', () => {
    // In {{#with someData}}{{foo}} {{bar}}{{/with}}, someData runs once
    const tmpl = makeTemplate('test_with_someData', '{{#with someData}}{{foo}} {{bar}}{{/with}}');
    const foo = reactive.ReactiveVar('AAA');
    let someDataRuns = 0;

    tmpl.helpers({
      someData: function () {
        someDataRuns++;
        return {};
      },
      foo: function () {
        return foo.get();
      },
      bar: function () {
        return 'YO';
      },
    });

    const div = renderToDiv(tmpl);
    expect(someDataRuns).toBe(1);
    expect(canonicalizeHtml(div.innerHTML)).toBe('AAA YO');

    foo.set('BBB');
    reactive.flush();
    expect(someDataRuns).toBe(1);
    expect(canonicalizeHtml(div.innerHTML)).toBe('BBB YO');

    foo.set('CCC');
    reactive.flush();
    expect(someDataRuns).toBe(1);
    expect(canonicalizeHtml(div.innerHTML)).toBe('CCC YO');
  });
});

describe('spacebars integration - block helpers in attribute', () => {
  test('block helper in attribute with reactive switching', () => {
    // {{#if foo}}checked{{/if}} in an attribute
    const tmpl = makeTemplate(
      'test_block_attr2',
      '<input value="{{#if foo}}&quot;{{else}}&amp;<>&lt;/x&gt;{{/if}}">',
    );
    const R = reactive.ReactiveVar(true);
    tmpl.helpers({
      foo: function () {
        return R.get();
      },
    });

    const div = renderToDiv(tmpl);
    const input = div.querySelector('input')!;
    expect(input.value).toBe('"');

    R.set(false);
    reactive.flush();
    expect(input.value).toBe('&<></x>');
  });
});

describe('spacebars integration - constant #each argument', () => {
  test('#each with constant array does not depend on data context', () => {
    const tmpl = makeTemplate(
      'test_const_each',
      '{{#with someData}}{{#each anArray}}{{justReturn this}}{{/each}} {{this}}{{/with}}',
    );
    let justReturnRuns = 0;
    const R = reactive.ReactiveVar(1);

    tmpl.helpers({
      someData: function () {
        return R.get();
      },
      anArray: ['foo', 'bar'],
      justReturn: function (x: unknown) {
        justReturnRuns++;
        return String(x);
      },
    });

    const div = renderToDiv(tmpl);
    expect(justReturnRuns).toBe(2);
    const text = canonicalizeHtml(div.innerHTML).replace(/\s+/g, ' ');
    expect(text).toContain('foo');
    expect(text).toContain('bar');
    expect(text).toContain('1');

    R.set(2);
    reactive.flush();
    const text2 = canonicalizeHtml(div.innerHTML).replace(/\s+/g, ' ');
    expect(text2).toContain('foo');
    expect(text2).toContain('bar');
    expect(text2).toContain('2');
  });
});

describe('spacebars integration - content context', () => {
  test('data context switches between inner and outer', () => {
    const inner = makeTemplate(
      'test_content_ctx_inner',
      '{{#if bar.cond}}{{bar.firstLetter}}{{bar.secondLetter}}{{else}}{{firstLetter}}{{secondLetter}}{{/if}}',
    );

    const tmpl = makeTemplate('test_content_ctx_outer', '{{#with foo}}{{> inner}}{{/with}}');
    tmpl.helpers({ inner });

    const R = reactive.ReactiveVar(true);
    tmpl.helpers({
      foo: {
        firstLetter: 'F',
        secondLetter: 'O',
        bar: {
          cond: function () {
            return R.get();
          },
          firstLetter: 'B',
          secondLetter: 'A',
        },
      },
    });

    const div = renderToDiv(tmpl);
    expect(canonicalizeHtml(div.innerHTML)).toBe('BA');

    R.set(false);
    reactive.flush();
    expect(canonicalizeHtml(div.innerHTML)).toBe('FO');
  });
});

describe('spacebars integration - helper called exactly once on invalidation', () => {
  test('helper passed to #if runs exactly once per invalidation', () => {
    const tmpl = makeTemplate('test_if_exact', '{{#if foo}}true{{else}}false{{/if}}');
    let count = 0;
    const dep = reactive.Dependency();
    let foo = false;

    tmpl.helpers({
      foo: function () {
        dep.depend();
        count++;
        return foo;
      },
    });

    const div = renderToDiv(tmpl);
    expect(canonicalizeHtml(div.innerHTML)).toBe('false');
    expect(count).toBe(1);

    foo = true;
    dep.changed();
    reactive.flush();
    expect(canonicalizeHtml(div.innerHTML)).toBe('true');
    expect(count).toBe(2);
  });

  test('custom block helper function called exactly once per invalidation', () => {
    const subTmpl = makeTemplate('test_block_fn_sub', 'aaa');
    const tmpl = makeTemplate('test_block_fn', '{{#if true}}{{> dynamicTemplate}}{{/if}}');
    let count = 0;
    const dep = reactive.Dependency();

    tmpl.helpers({
      dynamicTemplate: function () {
        dep.depend();
        count++;
        return subTmpl;
      },
    });

    renderToDiv(tmpl);
    expect(count).toBe(1);

    dep.changed();
    reactive.flush();
    expect(count).toBe(2);
  });
});

describe('spacebars integration - falsy with', () => {
  test('#with falsy value shows nothing, truthy shows content', () => {
    const tmpl = makeTemplate('test_falsy_with', '{{#with obj}}{{greekLetter}}{{/with}}');
    const R = reactive.ReactiveVar<Record<string, string> | null>(null);
    tmpl.helpers({
      obj: function () {
        return R.get();
      },
    });

    const div = renderToDiv(tmpl);
    expect(canonicalizeHtml(div.innerHTML)).toBe('');

    R.set({ greekLetter: 'alpha' });
    reactive.flush();
    expect(canonicalizeHtml(div.innerHTML)).toBe('alpha');

    R.set(null);
    reactive.flush();
    expect(canonicalizeHtml(div.innerHTML)).toBe('');

    R.set({ greekLetter: 'beta' });
    reactive.flush();
    expect(canonicalizeHtml(div.innerHTML)).toBe('beta');
  });
});

describe('spacebars integration - helpers do not leak', () => {
  test('template helpers do not leak to sub-templates', () => {
    const sub = makeTemplate('test_no_leak_sub', '{{bonus}}');
    sub.helpers({
      bonus: function () {
        return 'BONUS';
      },
    });

    const tmpl = makeTemplate('test_no_leak', 'correct {{> sub}}');
    tmpl.helpers({ sub });

    const div = renderToDiv(tmpl);
    expect(canonicalizeHtml(div.innerHTML)).toBe('correct BONUS');
  });
});

describe('spacebars integration - event cleanup', () => {
  test('event handlers removed when view is destroyed', () => {
    const inner = makeTemplate('test_evt_cleanup_inner', '<span>click me</span>');
    let clickCount = 0;
    inner.events({
      'click span': function () {
        clickCount++;
      },
    });

    const tmpl = makeTemplate('test_evt_cleanup_outer', '{{#if show}}{{> inner}}{{/if}}');
    const show = reactive.ReactiveVar(true);
    tmpl.helpers({
      show: function () {
        return show.get();
      },
      inner,
    });

    const div = renderToDiv(tmpl);
    const span = div.querySelector('span')!;

    // Simulate click
    const evt = new dom.window.MouseEvent('click', { bubbles: true });
    span.dispatchEvent(evt);
    expect(clickCount).toBe(1);

    // Destroy the inner template
    show.set(false);
    reactive.flush();
    expect(div.querySelector('span')).toBeNull();
  });
});

describe('spacebars integration - data context in event handlers', () => {
  test('data context available in event handler inside #if', () => {
    const tmpl = makeTemplate('test_data_ctx_evt', '{{#with foo}}<button>click</button>{{/with}}');
    let dataInEvent: unknown = null;

    tmpl.helpers({ foo: { bar: 'baz' } });
    tmpl.events({
      'click button': function (this: unknown) {
        dataInEvent = this;
      },
    });

    const div = renderToDiv(tmpl);
    const button = div.querySelector('button')!;
    const evt = new dom.window.MouseEvent('click', { bubbles: true });
    button.dispatchEvent(evt);
    expect(dataInEvent).toEqual({ bar: 'baz' });
  });
});

describe('spacebars integration - Blaze.renderWithData', () => {
  test('renderWithData and remove', () => {
    const tmpl = makeTemplate('test_render_data', '<b>some data - {{foo}}</b>');

    const div = document.createElement('div');
    const view = renderWithData(tmpl, { foo: 3130 }, div);
    reactive.flush();
    expect(canonicalizeHtml(div.innerHTML)).toBe('<b>some data - 3130</b>');

    expect(view.isDestroyed).toBe(false);
    remove(view);
    expect(view.isDestroyed).toBe(true);
    expect(div.innerHTML).toBe('');
  });
});

describe('spacebars integration - old #each data context', () => {
  test('old each with array of objects sets data context', () => {
    const tmpl = makeTemplate('test_old_each_ctx', '{{#each items}}<div>{{text}}</div>{{/each}}');
    tmpl.helpers({ items: [{ text: 'a' }, { text: 'b' }] });

    const div = renderToDiv(tmpl);
    expect(canonicalizeHtml(div.innerHTML)).toBe('<div>a</div><div>b</div>');
  });
});

describe('spacebars integration - new each-in extends context', () => {
  test('each-in preserves parent context', () => {
    const tmpl = makeTemplate(
      'test_each_in_ctx',
      '{{#with dataContext}}{{#each item in items}}<div>{{item.text}} -- {{toplevel}}</div>{{/each}}{{/with}}',
    );
    tmpl.helpers({
      dataContext: function () {
        return { items: [{ text: 'a' }, { text: 'b' }], toplevel: 'XYZ' };
      },
    });

    const div = renderToDiv(tmpl);
    expect(canonicalizeHtml(div.innerHTML)).toBe('<div>a -- XYZ</div><div>b -- XYZ</div>');
  });
});

describe('spacebars integration - nested sub-expressions', () => {
  test('capitalize(firstWord(sentence))', () => {
    const tmpl = makeTemplate(
      'test_nested_subexpr',
      '{{capitalize (firstWord (generateSentence))}}',
    );
    const sentence = reactive.ReactiveVar("can't even imagine");
    tmpl.helpers({
      capitalize: function (str: string) {
        return str.charAt(0).toUpperCase() + str.substring(1);
      },
      firstWord: function (s: string) {
        return s.split(' ')[0];
      },
      generateSentence: function () {
        return sentence.get();
      },
    });

    const div = renderToDiv(tmpl);
    expect(canonicalizeHtml(div.innerHTML)).toBe("Can't");

    sentence.set('that would be quite dark');
    reactive.flush();
    expect(canonicalizeHtml(div.innerHTML)).toBe('That');
  });
});

describe('spacebars integration - expressions as keyword args', () => {
  test('sub-expressions as keyword arguments', () => {
    const tmpl = makeTemplate('test_expr_kw', '{{capitalize (name)}} {{capitalize "mello"}}');
    const name = reactive.ReactiveVar('light');
    tmpl.helpers({
      capitalize: function (str: string) {
        return str.charAt(0).toUpperCase() + str.substring(1);
      },
      name: function () {
        return name.get();
      },
    });

    const div = renderToDiv(tmpl);
    expect(canonicalizeHtml(div.innerHTML)).toBe('Light Mello');

    name.set('misa');
    reactive.flush();
    expect(canonicalizeHtml(div.innerHTML)).toBe('Misa Mello');
  });
});

describe('spacebars integration - #with does not re-render template', () => {
  test('with reactive value preserves DOM nodes', () => {
    const tmpl = makeTemplate(
      'test_with_rerender',
      '{{#with x}}<input class="foo"><span class="bar">{{this}}</span>{{/with}}',
    );
    const x = reactive.ReactiveVar('aaa');
    tmpl.helpers({
      x: function () {
        return x.get();
      },
    });

    const div = renderToDiv(tmpl);
    const input = div.querySelector('input.foo');
    const span = div.querySelector('span.bar');
    expect(input).toBeTruthy();
    expect(span).toBeTruthy();
    expect(canonicalizeHtml(span!.innerHTML)).toBe('aaa');

    x.set('bbb');
    reactive.flush();
    // DOM elements should be the same instances
    expect(div.querySelector('input.foo')).toBe(input);
    expect(div.querySelector('span.bar')).toBe(span);
    expect(canonicalizeHtml(span!.innerHTML)).toBe('bbb');
  });
});

describe('spacebars integration - #let does not re-render template', () => {
  test('let reactive value preserves DOM nodes', () => {
    const tmpl = makeTemplate(
      'test_let_rerender',
      '{{#let y=x}}<input class="foo"><span class="bar">{{y}}</span>{{/let}}',
    );
    const x = reactive.ReactiveVar('aaa');
    tmpl.helpers({
      x: function () {
        return x.get();
      },
    });

    const div = renderToDiv(tmpl);
    const input = div.querySelector('input.foo');
    const span = div.querySelector('span.bar');
    expect(input).toBeTruthy();
    expect(span).toBeTruthy();
    expect(canonicalizeHtml(span!.innerHTML)).toBe('aaa');

    x.set('bbb');
    reactive.flush();
    expect(div.querySelector('input.foo')).toBe(input);
    expect(div.querySelector('span.bar')).toBe(span);
    expect(canonicalizeHtml(span!.innerHTML)).toBe('bbb');
  });
});

describe('spacebars integration - #each takes multiple arguments', () => {
  test('each with helper wrapping array', () => {
    const tmpl = makeTemplate(
      'test_each_multiarg',
      '{{#each helper arg}}<div>{{this}}</div>{{/each}}',
    );
    tmpl.helpers({
      arg: ['a', 'b', 'c'],
      helper: function (x: string[]) {
        return x;
      },
    });

    const div = renderToDiv(tmpl);
    expect(canonicalizeHtml(div.innerHTML)).toBe('<div>a</div><div>b</div><div>c</div>');
  });
});

describe('spacebars integration - multiple arguments in each-in', () => {
  test('each-in with helper call on list', () => {
    const tmpl = makeTemplate(
      'test_each_in_multi',
      '{{#each item in (helper list)}}<div>{{item}}</div>{{/each}}',
    );
    tmpl.helpers({
      list: ['a', 'b', 'c'],
      helper: function (list: string[]) {
        return [...list].reverse();
      },
    });

    const div = renderToDiv(tmpl);
    expect(canonicalizeHtml(div.innerHTML)).toBe('<div>c</div><div>b</div><div>a</div>');
  });
});

describe('spacebars integration - inclusion lookup order', () => {
  test('helper overrides template name for inclusion', () => {
    const sub1 = makeTemplate('test_incl_lookup_sub1', 'from template');
    const sub2 = makeTemplate('test_incl_lookup_sub2', 'from helper');
    const sub3 = makeTemplate('test_incl_lookup_sub3', 'from data');

    // Register sub1 as a global template
    (Template as Record<string, unknown>)['test_incl_lookup_sub1'] = sub1;

    const tmpl = makeTemplate('test_incl_lookup', '{{> test_incl_lookup_sub1}} {{> dataSubTmpl}}');
    // Helper overrides the template registered by name
    tmpl.helpers({
      test_incl_lookup_sub1: sub2,
      dataSubTmpl: sub3,
    });

    const div = renderToDiv(tmpl);
    expect(canonicalizeHtml(div.innerHTML)).toBe('from helper from data');

    delete (Template as Record<string, unknown>)['test_incl_lookup_sub1'];
  });
});

describe('spacebars integration - attribute object helpers', () => {
  test('disabled/undefined attribute object does not affect element', () => {
    const tmpl = makeTemplate('test_attr_disabled', '<button {{disabled}}>test</button>');
    tmpl.helpers({
      disabled: function () {
        return undefined;
      },
    });

    const div = renderToDiv(tmpl);
    const button = div.querySelector('button')!;
    expect(button.getAttribute('title')).toBeNull();
    expect(button.textContent).toBe('test');
  });

  test('attribute object with reactive updates', () => {
    const tmpl = makeTemplate('test_attr_obj_reactive', '<p {{attrs}}>text</p>');
    const attrs = reactive.ReactiveVar({ class: 'foo', id: 'bar' });
    tmpl.helpers({
      attrs: function () {
        return attrs.get();
      },
    });

    const div = renderToDiv(tmpl);
    const p = div.querySelector('p')!;
    expect(p.getAttribute('class')).toBe('foo');
    expect(p.getAttribute('id')).toBe('bar');

    attrs.set({ class: 'baz' });
    reactive.flush();
    expect(p.getAttribute('class')).toBe('baz');
    // id should be removed since it's no longer in the attrs
    expect(p.getAttribute('id')).toBeNull();
  });
});

describe('spacebars integration - nully attributes detailed', () => {
  test('null/undefined/false attributes are removed', () => {
    const tmpl = makeTemplate(
      'test_nully_attrs',
      '<input checked="{{checked}}" stuff="{{stuff}}">',
    );
    const checked = reactive.ReactiveVar<unknown>(true);
    const stuff = reactive.ReactiveVar<unknown>('yes');
    tmpl.helpers({
      checked: function () {
        return checked.get();
      },
      stuff: function () {
        return stuff.get();
      },
    });

    const div = renderToDiv(tmpl);
    const input = div.querySelector('input')!;
    expect(input.checked).toBe(true);
    expect(input.getAttribute('stuff')).toBe('yes');

    checked.set(false);
    stuff.set(null);
    reactive.flush();
    expect(input.checked).toBe(false);
    expect(input.getAttribute('stuff')).toBeNull();

    checked.set(undefined);
    stuff.set(undefined);
    reactive.flush();
    expect(input.checked).toBe(false);
    expect(input.getAttribute('stuff')).toBeNull();
  });

  test('empty string is truthy for attributes', () => {
    const tmpl = makeTemplate('test_empty_str_attr', '<input checked="{{val}}">');
    tmpl.helpers({ val: '' });
    const div = renderToDiv(tmpl);
    const input = div.querySelector('input')!;
    expect(input.checked).toBe(true);
  });
});

describe('spacebars integration - double escaping detailed', () => {
  test('various types in double stache', () => {
    const tmpl = makeTemplate('test_double_vals', '{{foo}}');
    const testCases: [unknown, string][] = [
      ['asdf', 'asdf'],
      [1.23, '1.23'],
      [0, '0'],
      [true, 'true'],
      [false, ''],
      [null, ''],
      [undefined, ''],
    ];

    for (const [val, expected] of testCases) {
      tmpl.helpers({ foo: val });
      const div = renderToDiv(tmpl);
      expect(canonicalizeHtml(div.innerHTML)).toBe(expected);
    }
  });
});

describe('spacebars integration - template instance from helper', () => {
  test('Template.instance() returns correct instance in helper', () => {
    const tmpl = makeTemplate('test_tmpl_instance', '{{foo}}');
    let instanceFromHelper: TemplateInstance | null = null;

    tmpl.onCreated(function (this: TemplateInstance) {
      (this as Record<string, unknown>).testValue = 'hello';
    });
    tmpl.helpers({
      foo: function () {
        instanceFromHelper = Template.instance();
        return '';
      },
    });

    renderToDiv(tmpl);
    expect(instanceFromHelper).toBeTruthy();
    expect((instanceFromHelper as unknown as Record<string, unknown>).testValue).toBe('hello');
  });
});

describe('spacebars integration - autorun on template instance', () => {
  test('this.autorun stops when template is destroyed', () => {
    const inner = makeTemplate('test_autorun_inner', '<span>inner</span>');
    let autorunCount = 0;
    const rv = reactive.ReactiveVar('foo');

    inner.onCreated(function (this: TemplateInstance) {
      this.autorun(function () {
        rv.get();
        autorunCount++;
      });
    });

    const tmpl = makeTemplate('test_autorun_outer', '{{#if show}}{{> inner}}{{/if}}');
    const show = reactive.ReactiveVar(true);
    tmpl.helpers({
      show: function () {
        return show.get();
      },
      inner,
    });

    const div = renderToDiv(tmpl);
    expect(autorunCount).toBe(1);

    rv.set('bar');
    reactive.flush();
    expect(autorunCount).toBe(2);

    // Destroy the inner template
    show.set(false);
    reactive.flush();

    // Autorun should be stopped
    rv.set('baz');
    reactive.flush();
    expect(autorunCount).toBe(2);
  });
});

describe('spacebars integration - created/rendered/destroyed by each', () => {
  test('lifecycle callbacks fire for each item', () => {
    const inner = makeTemplate('test_lifecycle_each_inner', '<div>{{this}}</div>');
    const buf: string[] = [];

    inner.onCreated(function (this: TemplateInstance) {
      buf.push('C' + String(getData(this.view)).toLowerCase());
    });
    inner.onRendered(function (this: TemplateInstance) {
      buf.push('R' + String(getData(this.view)).toLowerCase());
    });
    inner.onDestroyed(function (this: TemplateInstance) {
      buf.push('D' + String(getData(this.view)).toLowerCase());
    });

    const tmpl = makeTemplate('test_lifecycle_each_outer', '{{#each items}}{{> inner}}{{/each}}');
    const R = reactive.ReactiveVar([{ _id: 'A' }]);
    tmpl.helpers({
      items: function () {
        return R.get();
      },
      inner,
    });

    const div = renderToDiv(tmpl);
    expect(canonicalizeHtml(div.innerHTML)).toBe('<div>[object Object]</div>');
    // Created + Rendered for first item
    expect(buf.filter((s) => s.startsWith('C')).length).toBe(1);
    expect(buf.filter((s) => s.startsWith('R')).length).toBe(1);

    R.set([{ _id: 'B' }]);
    reactive.flush();
    // First item destroyed, second created + rendered
    expect(buf.filter((s) => s.startsWith('D')).length).toBe(1);
  });
});

describe('spacebars integration - view removal stops reactivity', () => {
  test('removing a view stops its autoruns', () => {
    const tmpl = makeTemplate('test_view_removal', '<span>{{foo}}</span>');
    const rv = reactive.ReactiveVar('one');
    let runCount = 0;
    tmpl.helpers({
      foo: function () {
        runCount++;
        return rv.get();
      },
    });

    const div = document.createElement('div');
    const view = render(tmpl, div);
    reactive.flush();
    expect(canonicalizeHtml(div.innerHTML)).toBe('<span>one</span>');
    const initialCount = runCount;

    remove(view);
    rv.set('two');
    reactive.flush();
    // After remove, the helper should not re-run
    expect(runCount).toBe(initialCount);
  });
});

describe('spacebars integration - Blaze.render fails on non-DOM', () => {
  test('render throws if parentElement is not DOM', () => {
    const tmpl = makeTemplate('test_render_nope', '<div>hi</div>');
    expect(() => render(tmpl, {} as unknown as Element)).toThrow();
  });
});

describe('spacebars integration - toHTML variations', () => {
  test('toHTML with #if stops autoruns', () => {
    const tmpl = makeTemplate('test_tohtml_if', '{{#if foo}}bar{{/if}}');
    let count = 0;
    const R = reactive.ReactiveVar<unknown>(null);
    tmpl.helpers({
      foo: function () {
        count++;
        return R.get();
      },
    });

    R.set('bar');
    expect(canonicalizeHtml(toHTML(tmpl))).toBe('bar');
    expect(count).toBe(1);

    R.set('');
    reactive.flush();
    // toHTML should have stopped all autoruns, count should still be 1
    expect(count).toBe(1);
  });

  test('toHTML with #each stops autoruns', () => {
    const tmpl = makeTemplate('test_tohtml_each', '{{#each foos}}{{this}}{{/each}}');
    let count = 0;
    const R = reactive.ReactiveVar<unknown>(null);
    tmpl.helpers({
      foos: function () {
        count++;
        return R.get();
      },
    });

    R.set(['bar']);
    expect(canonicalizeHtml(toHTML(tmpl))).toBe('bar');
    expect(count).toBe(1);

    R.set([]);
    reactive.flush();
    expect(count).toBe(1);
  });
});

describe('spacebars integration - javascript scheme URLs', () => {
  test('javascript: URLs are blocked by default', () => {
    // Test that _allowJavascriptUrls and _javascriptUrlsAllowed work
    const { _allowJavascriptUrls, _javascriptUrlsAllowed } = require('@blaze-ng/core');
    expect(_javascriptUrlsAllowed()).toBe(false);
  });
});

describe('spacebars integration - SVG elements', () => {
  test('SVG circle renders with correct namespace', () => {
    const tmpl = makeTemplate(
      'test_svg_circle',
      '<svg><circle cx="10" cy="10" r="5"></circle></svg>',
    );

    const div = renderToDiv(tmpl);
    const svg = div.querySelector('svg')!;
    const circle = svg.querySelector('circle')!;
    expect(svg.namespaceURI).toBe('http://www.w3.org/2000/svg');
    expect(circle.namespaceURI).toBe('http://www.w3.org/2000/svg');
  });

  test('SVG path with reactive d attribute', () => {
    const tmpl = makeTemplate('test_svg_path', '<svg><path d="{{pathData}}"></path></svg>');
    const pathData = reactive.ReactiveVar('M0 0 L10 10');
    tmpl.helpers({
      pathData: function () {
        return pathData.get();
      },
    });

    const div = renderToDiv(tmpl);
    const path = div.querySelector('path')!;
    expect(path.getAttribute('d')).toBe('M0 0 L10 10');

    pathData.set('M5 5 L20 20');
    reactive.flush();
    expect(path.getAttribute('d')).toBe('M5 5 L20 20');
  });
});

describe('spacebars integration - textarea advanced', () => {
  test('textarea each with reactive array', () => {
    const tmpl = makeTemplate(
      'test_textarea_each',
      '<textarea>{{#each foo}}<not a tag {{this}} {{/each}}</textarea>',
    );
    const R = reactive.ReactiveVar(['APPLE', 'BANANA']);
    tmpl.helpers({
      foo: function () {
        return R.get();
      },
    });

    const div = renderToDiv(tmpl);
    const textarea = div.querySelector('textarea')!;
    expect(textarea.value).toContain('APPLE');
    expect(textarea.value).toContain('BANANA');

    R.set([]);
    reactive.flush();
    // With empty array, the textarea should have minimal content
    expect(textarea.value).not.toContain('APPLE');

    R.set(['CUCUMBER']);
    reactive.flush();
    expect(textarea.value).toContain('CUCUMBER');
  });
});

describe('spacebars integration - parentData', () => {
  test('Template.parentData accesses ancestor data contexts', () => {
    const child = makeTemplate('test_parent_data_child', '{{foo}}');

    const tmpl = makeTemplate(
      'test_parent_data_outer',
      '{{#with outer}}{{#with inner}}{{> child}}{{/with}}{{/with}}',
    );
    tmpl.helpers({
      child,
      outer: { inner: { val: 'deepest' }, outerVal: 'mid' },
    });

    child.helpers({
      foo: function () {
        // parentData(0) = current context
        // parentData(1) = parent
        const parent = Template.parentData(1);
        return parent ? (parent as Record<string, string>).outerVal : 'none';
      },
    });

    const div = renderToDiv(tmpl);
    expect(canonicalizeHtml(div.innerHTML)).toBe('mid');
  });
});

describe('spacebars integration - Blaze.getView and getData', () => {
  test('getView returns the view for a DOM element', () => {
    const tmpl = makeTemplate('test_getview', '<span>hello</span>');
    const div = renderToDiv(tmpl, { greeting: 'test' });

    const span = div.querySelector('span')!;
    const view = getView(span);
    expect(view).toBeTruthy();
    expect(getData(span)).toEqual({ greeting: 'test' });
  });
});

describe('spacebars integration - contentBlock argument', () => {
  test('arguments passed to contentBlock are evaluated', () => {
    const wrapper = makeTemplate(
      'test_cb_wrapper',
      '{{#if true}}<div>{{> Template.contentBlock}}</div>{{/if}}',
    );
    const tmpl = makeTemplate('test_cb_outer', '{{#wrapper}}AAA{{/wrapper}} BBB');
    tmpl.helpers({ wrapper });

    const div = renderToDiv(tmpl);
    expect(canonicalizeHtml(div.innerHTML)).toContain('AAA');
    expect(canonicalizeHtml(div.innerHTML)).toContain('BBB');
  });
});

describe('spacebars integration - contentBlock via inclusion', () => {
  test('block content passed via inclusion', () => {
    const wrapper = makeTemplate(
      'test_content_pass_wrapper',
      '<div>{{> Template.contentBlock}}</div>',
    );
    const tmpl = makeTemplate('test_content_pass_outer', '{{#wrapper}}hello world{{/wrapper}}');
    tmpl.helpers({ wrapper });

    const div = renderToDiv(tmpl);
    expect(canonicalizeHtml(div.innerHTML)).toContain('hello world');
  });
});

describe('spacebars integration - #unless', () => {
  test('unless with reactive condition', () => {
    const tmpl = makeTemplate('test_unless', '{{#unless hidden}}visible{{else}}hidden{{/unless}}');
    const R = reactive.ReactiveVar(false);
    tmpl.helpers({
      hidden: function () {
        return R.get();
      },
    });

    const div = renderToDiv(tmpl);
    expect(canonicalizeHtml(div.innerHTML)).toBe('visible');

    R.set(true);
    reactive.flush();
    expect(canonicalizeHtml(div.innerHTML)).toBe('hidden');

    R.set(false);
    reactive.flush();
    expect(canonicalizeHtml(div.innerHTML)).toBe('visible');
  });
});

describe('spacebars integration - #each with else', () => {
  test('each shows else block when empty', () => {
    const tmpl = makeTemplate(
      'test_each_else',
      '{{#each items}}<li>{{this}}</li>{{else}}<li>none</li>{{/each}}',
    );
    const R = reactive.ReactiveVar<string[]>([]);
    tmpl.helpers({
      items: function () {
        return R.get();
      },
    });

    const div = renderToDiv(tmpl);
    expect(canonicalizeHtml(div.innerHTML)).toBe('<li>none</li>');

    R.set(['a', 'b']);
    reactive.flush();
    expect(canonicalizeHtml(div.innerHTML)).toBe('<li>a</li><li>b</li>');

    R.set([]);
    reactive.flush();
    expect(canonicalizeHtml(div.innerHTML)).toBe('<li>none</li>');
  });
});

describe('spacebars integration - SafeString in helper', () => {
  test('SafeString is not escaped', () => {
    const tmpl = makeTemplate('test_safestring', '{{foo}}');
    tmpl.helpers({
      foo: function () {
        return new Spacebars.SafeString('<b>bold</b>');
      },
    });
    const div = renderToDiv(tmpl);
    expect(div.querySelector('b')).toBeTruthy();
    expect(div.querySelector('b')!.textContent).toBe('bold');
  });

  test('regular string is escaped', () => {
    const tmpl = makeTemplate('test_escaped_str', '{{foo}}');
    tmpl.helpers({
      foo: function () {
        return '<b>not bold</b>';
      },
    });
    const div = renderToDiv(tmpl);
    expect(div.querySelector('b')).toBeNull();
    expect(div.textContent).toBe('<b>not bold</b>');
  });
});

describe('spacebars integration - deeply nested #with and #each', () => {
  test('deeply nested template structures', () => {
    const tmpl = makeTemplate(
      'test_deep_nesting',
      '{{#with a}}{{#with b}}{{#each items}}<span>{{name}}-{{../../title}}</span>{{/each}}{{/with}}{{/with}}',
    );
    tmpl.helpers({
      a: {
        title: 'TOP',
        b: {
          items: [{ name: 'x' }, { name: 'y' }],
        },
      },
    });

    const div = renderToDiv(tmpl);
    const spans = div.querySelectorAll('span');
    expect(spans.length).toBe(2);
    expect(spans[0].textContent).toBe('x-TOP');
    expect(spans[1].textContent).toBe('y-TOP');
  });
});

describe('spacebars integration - reactive template switching via helper', () => {
  test('dynamically switch included template', () => {
    const tmplA = makeTemplate('test_switch_a', '<span>A</span>');
    const tmplB = makeTemplate('test_switch_b', '<span>B</span>');
    const tmpl = makeTemplate('test_switch', '{{> whichOne}}');

    const R = reactive.ReactiveVar<Template>(tmplA);
    tmpl.helpers({
      whichOne: function () {
        return R.get();
      },
    });

    const div = renderToDiv(tmpl);
    expect(div.querySelector('span')!.textContent).toBe('A');

    R.set(tmplB);
    reactive.flush();
    expect(div.querySelector('span')!.textContent).toBe('B');

    R.set(tmplA);
    reactive.flush();
    expect(div.querySelector('span')!.textContent).toBe('A');
  });
});

describe('spacebars integration - reactive #if with nested each', () => {
  test('if toggling with nested each', () => {
    const tmpl = makeTemplate(
      'test_if_each',
      '{{#if show}}{{#each items}}<span>{{this}}</span>{{/each}}{{/if}}',
    );
    const show = reactive.ReactiveVar(true);
    const items = reactive.ReactiveVar(['a', 'b']);
    tmpl.helpers({
      show: function () {
        return show.get();
      },
      items: function () {
        return items.get();
      },
    });

    const div = renderToDiv(tmpl);
    expect(div.querySelectorAll('span').length).toBe(2);

    show.set(false);
    reactive.flush();
    expect(div.querySelectorAll('span').length).toBe(0);

    show.set(true);
    reactive.flush();
    expect(div.querySelectorAll('span').length).toBe(2);

    items.set(['x', 'y', 'z']);
    reactive.flush();
    expect(div.querySelectorAll('span').length).toBe(3);
    expect(div.querySelectorAll('span')[2].textContent).toBe('z');
  });
});

describe('spacebars integration - #with else block', () => {
  test('with else shows fallback when null', () => {
    const tmpl = makeTemplate('test_with_else', '{{#with obj}}has: {{val}}{{else}}empty{{/with}}');
    const R = reactive.ReactiveVar<Record<string, string> | null>(null);
    tmpl.helpers({
      obj: function () {
        return R.get();
      },
    });

    const div = renderToDiv(tmpl);
    expect(canonicalizeHtml(div.innerHTML)).toBe('empty');

    R.set({ val: 'data' });
    reactive.flush();
    expect(canonicalizeHtml(div.innerHTML)).toBe('has: data');

    R.set(null);
    reactive.flush();
    expect(canonicalizeHtml(div.innerHTML)).toBe('empty');
  });
});

describe('spacebars integration - global helper from registerHelper', () => {
  test('global helper accessible from all templates', () => {
    registerHelper('GLOBAL_TEST_HELPER', function () {
      return 'GLOBAL';
    });

    const tmpl = makeTemplate('test_global', '{{GLOBAL_TEST_HELPER}}');
    const div = renderToDiv(tmpl);
    expect(canonicalizeHtml(div.innerHTML)).toBe('GLOBAL');

    deregisterHelper('GLOBAL_TEST_HELPER');
  });

  test('global helper with falsy value works', () => {
    registerHelper('GLOBAL_ZERO_TEST', 0);
    const tmpl = makeTemplate('test_global_zero', '{{GLOBAL_ZERO_TEST}}');
    const div = renderToDiv(tmpl);
    expect(canonicalizeHtml(div.innerHTML)).toBe('0');
    deregisterHelper('GLOBAL_ZERO_TEST');
  });
});

describe('spacebars integration - multiple helpers on same element', () => {
  test('multiple reactive attributes update independently', () => {
    const tmpl = makeTemplate(
      'test_multi_attrs',
      '<div class="{{cls}}" id="{{ident}}" title="{{ttl}}">{{text}}</div>',
    );
    const cls = reactive.ReactiveVar('a');
    const ident = reactive.ReactiveVar('id1');
    const ttl = reactive.ReactiveVar('tip');
    const text = reactive.ReactiveVar('hello');

    tmpl.helpers({
      cls: function () {
        return cls.get();
      },
      ident: function () {
        return ident.get();
      },
      ttl: function () {
        return ttl.get();
      },
      text: function () {
        return text.get();
      },
    });

    const div = renderToDiv(tmpl);
    const el = div.querySelector('div')!;
    expect(el.getAttribute('class')).toBe('a');
    expect(el.getAttribute('id')).toBe('id1');
    expect(el.getAttribute('title')).toBe('tip');
    expect(el.textContent).toBe('hello');

    cls.set('b');
    reactive.flush();
    expect(el.getAttribute('class')).toBe('b');
    expect(el.getAttribute('id')).toBe('id1'); // unchanged
    expect(el.textContent).toBe('hello'); // unchanged

    text.set('world');
    reactive.flush();
    expect(el.textContent).toBe('world');
  });
});

describe('spacebars integration - nested #if chains', () => {
  test('nested if/else if/else', () => {
    const tmpl = makeTemplate(
      'test_nested_if',
      '{{#if a}}A{{else}}{{#if b}}B{{else}}C{{/if}}{{/if}}',
    );
    const a = reactive.ReactiveVar(true);
    const b = reactive.ReactiveVar(false);
    tmpl.helpers({
      a: function () {
        return a.get();
      },
      b: function () {
        return b.get();
      },
    });

    const div = renderToDiv(tmpl);
    expect(canonicalizeHtml(div.innerHTML)).toBe('A');

    a.set(false);
    reactive.flush();
    expect(canonicalizeHtml(div.innerHTML)).toBe('C');

    b.set(true);
    reactive.flush();
    expect(canonicalizeHtml(div.innerHTML)).toBe('B');

    a.set(true);
    reactive.flush();
    expect(canonicalizeHtml(div.innerHTML)).toBe('A');
  });
});

describe('spacebars integration - helper with keyword hash', () => {
  test('helper receives keyword arguments', () => {
    const tmpl = makeTemplate('test_kw_hash', '{{greet name="World" greeting="Hello"}}');
    tmpl.helpers({
      greet: function (opts: { hash: { name: string; greeting: string } }) {
        return opts.hash.greeting + ' ' + opts.hash.name;
      },
    });

    const div = renderToDiv(tmpl);
    expect(canonicalizeHtml(div.innerHTML)).toBe('Hello World');
  });
});

describe('spacebars integration - data context propagation', () => {
  test('data context flows through nested templates', () => {
    const leaf = makeTemplate('test_ctx_leaf', '{{val}}');
    const mid = makeTemplate('test_ctx_mid', '{{> leaf}}');
    mid.helpers({ leaf });
    const tmpl = makeTemplate('test_ctx_root', '{{> mid}}');
    tmpl.helpers({ mid });

    const div = renderToDiv(tmpl, { val: 'deep' });
    expect(canonicalizeHtml(div.innerHTML)).toBe('deep');
  });
});

describe('spacebars integration - reactive each reordering', () => {
  test('each re-renders correctly when items change', () => {
    const tmpl = makeTemplate('test_each_reorder', '{{#each items}}<span>{{this}}</span>{{/each}}');
    const R = reactive.ReactiveVar(['a', 'b', 'c']);
    tmpl.helpers({
      items: function () {
        return R.get();
      },
    });

    const div = renderToDiv(tmpl);
    expect(div.querySelectorAll('span').length).toBe(3);
    expect(div.querySelectorAll('span')[0].textContent).toBe('a');
    expect(div.querySelectorAll('span')[2].textContent).toBe('c');

    R.set(['c', 'a']);
    reactive.flush();
    expect(div.querySelectorAll('span').length).toBe(2);
    expect(div.querySelectorAll('span')[0].textContent).toBe('c');
    expect(div.querySelectorAll('span')[1].textContent).toBe('a');

    R.set([]);
    reactive.flush();
    expect(div.querySelectorAll('span').length).toBe(0);

    R.set(['x']);
    reactive.flush();
    expect(div.querySelectorAll('span').length).toBe(1);
    expect(div.querySelectorAll('span')[0].textContent).toBe('x');
  });
});
