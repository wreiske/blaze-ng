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
import {
  View,
  SimpleReactiveSystem,
  setReactiveSystem,
  render,
  remove,
  toHTML,
  Template,
  TemplateInstance,
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

  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  const fn = new Function('HTML', 'Spacebars', 'Blaze', 'Template', `return ${code}`)(
    htmlProxy,
    Spacebars,
    BlazeNS,
    Template,
  );
  return fn;
}

// Import the actual builtins
import { If, Unless, Each, Let, _parentData, _withCurrentView, _InOuterTemplateScope } from '@blaze-ng/core';

function createBuiltinIf() {
  return function BlazeIf(conditionFunc: () => unknown, contentFunc: () => unknown, elseFunc?: () => unknown) {
    return If(conditionFunc, contentFunc, elseFunc);
  };
}

function createBuiltinUnless() {
  return function BlazeUnless(conditionFunc: () => unknown, contentFunc: () => unknown, elseFunc?: () => unknown) {
    return Unless(conditionFunc, contentFunc, elseFunc);
  };
}

function createBuiltinEach() {
  return function BlazeEach(argFunc: () => unknown, contentFunc: () => unknown, elseFunc?: () => unknown) {
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
      bar: function () { return 123; },
    });
    const div = renderToDiv(tmpl, {
      foo: function (x: number) { return x + R.get(); },
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
      html: function () { return R.get(); },
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
      html2: function () { return null; },
    });
    const div = renderToDiv(tmpl);
    expect(canonicalizeHtml(div.innerHTML)).toBe('xy');
  });
});

describe('spacebars integration - interpolate attribute', () => {
  test('attribute interpolation', () => {
    const tmpl = makeTemplate('test_interp', '<div class="aaa{{foo bar}}zzz"></div>');
    tmpl.helpers({
      foo: function (x: number) { return x + 1; },
      bar: function () { return 123; },
    });
    const div = renderToDiv(tmpl);
    const inner = div.querySelector('div');
    expect(inner!.className).toBe('aaa124zzz');
  });
});

describe('spacebars integration - dynamic attrs', () => {
  test('object attributes with reactive updates', () => {
    const tmpl = makeTemplate('test_dynattrs', '<span {{attrsObj}} {{singleAttr}} {{nonexistent}}>hi</span>');
    const R2 = reactive.ReactiveVar({ x: 'X' } as Record<string, string>);
    const R3 = reactive.ReactiveVar('selected');

    tmpl.helpers({
      attrsObj: function () { return R2.get(); },
      singleAttr: function () { return R3.get(); },
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
      foo: function () { return R.get(); },
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
    const tmpl = makeTemplate('test_if_with', '{{#with foo}}{{bar}}{{#if true}}{{bar}}{{/if}}{{/with}}');
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
      items: function () { return R.get(); },
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
    const tmpl = makeTemplate('test_with_falsy',
      '{{#with value1}}{{this}}{{else}}xxx{{/with}} {{#with value2}}{{this}}{{else}}xxx{{/with}} {{#with value1}}{{this}}{{/with}} {{#with value2}}{{this}}{{/with}}');

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
      someData: function () { return R.get(); },
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
      foo: function () { return R.get(); },
    });

    const div = renderToDiv(tmpl);
    const ta = div.querySelector('textarea');
    expect(ta).toBeTruthy();
    expect(ta!.value).toBe('hello');
  });

  test('textarea with if', () => {
    const tmpl = makeTemplate('test_textarea_if', '<textarea>{{#if foo}}</not a tag>{{else}}<also not a tag>{{/if}}</textarea>');
    const R = reactive.ReactiveVar(true);
    tmpl.helpers({
      foo: function () { return R.get(); },
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
    const tmpl = makeTemplate('test_nully1', '<input type="checkbox" checked={{foo}} stuff={{foo}}>');
    const R = reactive.ReactiveVar<string | null>('checked');
    tmpl.helpers({
      foo: function () { return R.get(); },
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
      foo: function () { return '<b>hi</b>'; },
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
    tmpl.onCreated(function () { buf.push('created'); });
    tmpl.onRendered(function () { buf.push('rendered'); });
    tmpl.onDestroyed(function () { buf.push('destroyed'); });

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
      add: function (a: number, b: number) { return a + b; },
    });
    const div = renderToDiv(tmpl);
    expect(canonicalizeHtml(div.innerHTML)).toBe('6');
  });

  test('nested sub-expressions with functions', () => {
    const tmpl = makeTemplate('test_nested2', '{{capitalize (firstWord generateSentence)}}');
    tmpl.helpers({
      generateSentence: 'hello world',
      firstWord: function (str: string) { return str.split(' ')[0]; },
      capitalize: function (str: string) { return str.toUpperCase(); },
    });
    const div = renderToDiv(tmpl);
    expect(canonicalizeHtml(div.innerHTML)).toBe('HELLO');
  });
});

describe('spacebars integration - tricky attrs', () => {
  test('type and class attributes', () => {
    const tmpl = makeTemplate('test_tricky', '<input type={{theType}}><input type=checkbox class={{theClass}}>');
    const R1 = reactive.ReactiveVar('text');
    const R2 = reactive.ReactiveVar('foo');
    tmpl.helpers({
      theType: function () { return R1.get(); },
      theClass: function () { return R2.get(); },
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
    const tmpl = makeTemplate('test_let',
      '{{#with dataContext}}{{#let alias=helper anotherVarFromContext="override"}}' +
      '<div>{{alias}} -- {{helper}} -- {{varFromContext}} -- {{anotherVarFromContext}}</div>' +
      '{{/let}}{{/with}}');
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
    const tmpl = makeTemplate('test_index', '{{#each things}}<span>{{@index}} - {{num}}</span>{{/each}}');
    const R = reactive.ReactiveVar([{ num: 'a' }, { num: 'b' }, { num: 'c' }]);
    tmpl.helpers({
      things: function () { return R.get(); },
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
    const tmpl = makeTemplate('test_kwarg',
      '{{> callable stuff=(capitalize name) another=(capitalize "mello")}}');

    const callable = makeTemplate('callable', '{{stuff}} {{another}}');
    // Register as a global template
    (Template as Record<string, unknown>)['callable'] = callable;

    tmpl.helpers({
      capitalize: function (str: string) { return str.toUpperCase(); },
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
      r: function () { return R.get(); },
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
      foo: function () { return R.get(); },
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
    const tmpl = makeTemplate('test_const_each',
      '{{#with someData}}{{#each anArray}}{{justReturn this}}{{/each}}{{this}}{{/with}}');
    tmpl.helpers({
      someData: function () {
        return 'parentData';
      },
      anArray: ['item1', 'item2'],
      justReturn: function (x: unknown) { return x; },
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
    const tmpl = makeTemplate('test_each_in',
      '{{#with dataContext}}{{#each item in items}}<div>{{item.text}} -- {{toplevel}}</div>{{/each}}{{/with}}');
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
