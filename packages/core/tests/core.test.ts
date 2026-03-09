/**
 * Core package tests — ported from original Blaze view_tests.js and render_tests.js.
 *
 * Uses jsdom for DOM operations and SimpleReactiveSystem for reactivity.
 */
import { describe, test, expect, beforeEach } from 'vitest';
import { JSDOM } from 'jsdom';
import { HTML } from '@blaze-ng/htmljs';
import {
  View,
  DOMRange,
  SimpleReactiveSystem,
  setReactiveSystem,
  _getReactiveSystem,
  render,
  remove,
  toHTML,
  _materializeDOM,
  If,
  With,
  Each,
  Let,
  Unless,
  Template,
  TemplateInstance,
  isTemplate,
  registerHelper,
  deregisterHelper,
  _globalHelpers,
  getData,
  getView,
  _withCurrentView,
  currentView,
  DOMBackend,
  _expand,
  renderWithData,
} from '../src/index';
import { ObserveSequence } from '@blaze-ng/observe-sequence';

// ─── Helpers ─────────────────────────────────────────────────────────────────

let dom: JSDOM;
let document: Document;
let reactive: SimpleReactiveSystem;

/** Normalize HTML output for comparison. */
function canonicalizeHtml(html: string): string {
  return html
    .replace(/<!---->/g, '') // strip empty comments
    .replace(/<!--.*?-->/g, '<!---->') // strip comment contents
    .replace(/\s+/g, ' ') // collapse whitespace
    .replace(/> </g, '><') // remove space between tags
    .trim();
}

/** Render content into a div, returning the div. */
function materialize(content: unknown, parent: Element): void {
  let func = content;
  if (typeof content !== 'function') {
    func = () => content;
  }
  render(func, parent);
}

beforeEach(() => {
  dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
  document = dom.window.document;
  // Inject document globals for DOMBackend
  (globalThis as Record<string, unknown>).document = document;
  (globalThis as Record<string, unknown>).window = dom.window;
  (globalThis as Record<string, unknown>).Element = dom.window.Element;
  (globalThis as Record<string, unknown>).Node = dom.window.Node;
  (globalThis as Record<string, unknown>).MutationObserver = dom.window.MutationObserver;

  reactive = new SimpleReactiveSystem();
  setReactiveSystem(reactive);
  ObserveSequence.setReactiveSystem(reactive);
});

// ─── View Tests ──────────────────────────────────────────────────────────────

describe('view', () => {
  test('callbacks', () => {
    const R = reactive.ReactiveVar('foo');
    let buf = '';

    const v = new View('test', () => R.get());

    v.onViewCreated(() => {
      buf += 'c' + v.renderCount;
    });
    v._onViewRendered(() => {
      buf += 'r' + v.renderCount;
    });
    v.onViewReady(() => {
      buf += 'y' + v.renderCount;
    });
    v.onViewDestroyed(() => {
      buf += 'd' + v.renderCount;
    });

    expect(buf).toBe('');

    const div = document.createElement('DIV');
    expect(v.isRendered).toBe(false);
    expect(v._isAttached).toBe(false);
    expect(canonicalizeHtml(div.innerHTML)).toBe('');
    expect(() => v.firstNode()).toThrow(/View must be attached/);
    expect(() => v.lastNode()).toThrow(/View must be attached/);

    render(v, div);
    expect(buf).toBe('c0r1');
    expect(typeof v.firstNode().nodeType).toBe('number');
    expect(typeof v.lastNode().nodeType).toBe('number');
    expect(v.isRendered).toBe(true);
    expect(v._isAttached).toBe(true);
    expect(buf).toBe('c0r1');
    expect(canonicalizeHtml(div.innerHTML)).toBe('foo');

    reactive.flush();
    expect(buf).toBe('c0r1y1');

    R.set('bar');
    reactive.flush();
    expect(buf).toBe('c0r1y1r2y2');
    expect(canonicalizeHtml(div.innerHTML)).toBe('bar');

    remove(v);
    expect(buf).toBe('c0r1y1r2y2d2');
    expect(canonicalizeHtml(div.innerHTML)).toBe('');

    buf = '';
    R.set('baz');
    reactive.flush();
    expect(buf).toBe('');
  });

  test('destroy', () => {
    const v = new View('test', () => null);
    const range = new DOMRange([]);
    range.view = v;
    // simulate what Blaze.remove does
    const fakeViewObj = { _domrange: range } as unknown as View;
    Object.defineProperty(fakeViewObj, '_domrange', { value: range });
    expect(range.view!.isDestroyed).toBe(false);
    remove(fakeViewObj);
    expect(range.view!.isDestroyed).toBe(true);
  });

  test('attached error message', () => {
    expect(() =>
      DOMRange.prototype.containsElement.call(
        { attached: false, view: { name: 'Template.foo' } },
        undefined,
        '.class',
        'click',
      ),
    ).toThrow(/click event triggered with .class on foo/);
  });
});

// ─── Render Tests ────────────────────────────────────────────────────────────

describe('render', () => {
  const P = HTML.P;
  const CharRef = HTML.CharRef;
  const DIV = HTML.DIV;
  const Comment = HTML.Comment;
  const BR = HTML.BR;
  const A = HTML.A;
  const UL = HTML.UL;
  const LI = HTML.LI;
  const SPAN = HTML.SPAN;
  const HR = HTML.HR;
  const TEXTAREA = HTML.TEXTAREA;
  const INPUT = HTML.INPUT;

  test('basic', () => {
    const run = (
      input: unknown,
      expectedInnerHTML: string,
      expectedHTML: string,
    ) => {
      const div = document.createElement('DIV');
      materialize(input, div);
      expect(canonicalizeHtml(div.innerHTML)).toBe(expectedInnerHTML);
      expect(toHTML(input)).toBe(expectedHTML);
    };

    run(P('Hello'), '<p>Hello</p>', '<p>Hello</p>');
    run([], '', '');
    run([null, null], '', '');

    // Character reference
    run(
      P(new CharRef({ html: '&zopf;', str: '\ud835\udd6b' })),
      '<p>\ud835\udd6b</p>',
      '<p>&zopf;</p>',
    );

    // Comment
    run(
      DIV(new Comment('Test')),
      '<div><!----></div>', // jsdom preserves comment node but strips text in canonicalize
      '<div><!--Test--></div>',
    );

    // Arrays
    run(
      [P('Hello'), P('World')],
      '<p>Hello</p><p>World</p>',
      '<p>Hello</p><p>World</p>',
    );

    // Nested structure
    run(
      DIV(
        { class: 'foo' },
        UL(
          LI(P(A({ href: '#one' }, 'One'))),
          LI(P('Two', BR(), 'Three')),
        ),
      ),
      '<div class="foo"><ul><li><p><a href="#one">One</a></p></li><li><p>Two<br>Three</p></li></ul></div>',
      '<div class="foo"><ul><li><p><a href="#one">One</a></p></li><li><p>Two<br>Three</p></li></ul></div>',
    );

    // Nully attributes
    run(
      BR({ x: null, y: [[], []], a: [['']] }),
      '<br a="">',
      '<br a="">',
    );
  });

  test('input - value', () => {
    const R = reactive.ReactiveVar('hello');
    const div = document.createElement('DIV');
    materialize(INPUT({ value: () => R.get() }), div);
    const inputEl = div.querySelector('input') as HTMLInputElement;
    expect(inputEl.value).toBe('hello');
    inputEl.value = 'goodbye';
    R.set('hola');
    reactive.flush();
    expect(inputEl.value).toBe('hola');
  });

  test('input - checked', () => {
    const R = reactive.ReactiveVar<string | null>(null);
    const div = document.createElement('DIV');
    materialize(
      INPUT({ type: 'checkbox', checked: () => R.get() }),
      div,
    );
    const inputEl = div.querySelector('input') as HTMLInputElement;
    expect(inputEl.checked).toBe(false);
    inputEl.checked = true;

    R.set('checked');
    reactive.flush();
    R.set(null);
    reactive.flush();
    expect(inputEl.checked).toBe(false);
  });

  test('textarea', () => {
    const run = (text: string, html: string) => {
      const div = document.createElement('DIV');
      const node = TEXTAREA({ value: text });
      materialize(node, div);

      let value = (div.querySelector('textarea') as HTMLTextAreaElement).value;
      value = value.replace(/\r\n/g, '\n');
      expect(value).toBe(text);
      expect(toHTML(node)).toBe(html);
    };

    run('Hello', '<textarea>Hello</textarea>');
    run('\nHello', '<textarea>\n\nHello</textarea>');
    run('</textarea>', '<textarea>&lt;/textarea></textarea>');
  });

  test('view isolation', () => {
    // Reactively change a text node
    const R = reactive.ReactiveVar('Hello');
    const test1 = () => P(new View('test', () => R.get()));

    expect(toHTML(test1())).toBe('<p>Hello</p>');

    const div = document.createElement('DIV');
    materialize(test1, div);
    expect(canonicalizeHtml(div.innerHTML)).toBe('<p>Hello</p>');

    R.set('World');
    reactive.flush();
    expect(canonicalizeHtml(div.innerHTML)).toBe('<p>World</p>');
  });

  test('view isolation - array', () => {
    // Reactively change an array of text nodes
    const R = reactive.ReactiveVar(['Hello', ' World']);
    const test1 = () => P(new View('test', () => R.get()));

    expect(toHTML(test1())).toBe('<p>Hello World</p>');

    const div = document.createElement('DIV');
    materialize(test1, div);
    expect(canonicalizeHtml(div.innerHTML)).toBe('<p>Hello World</p>');

    R.set(['Goodbye', ' World']);
    reactive.flush();
    expect(canonicalizeHtml(div.innerHTML)).toBe('<p>Goodbye World</p>');
  });

  test('SVG', () => {
    const fillColor = reactive.ReactiveVar('red');
    const classes = reactive.ReactiveVar('one two');

    const content = DIV(
      { class: 'container' },
      HTML.SVG(
        { width: 100, height: 100 },
        HTML.CIRCLE({
          cx: 50,
          cy: 50,
          r: 40,
          stroke: 'black',
          'stroke-width': 3,
          class: () => classes.get(),
          fill: () => fillColor.get(),
        }),
      ),
    );

    const div = document.createElement('DIV');
    materialize(content, div);

    const circle = div.querySelector('.container > svg > circle') as SVGCircleElement;
    expect(circle.getAttribute('fill')).toBe('red');
    expect(circle.className.baseVal).toBe('one two');

    fillColor.set('green');
    classes.set('two three');
    reactive.flush();
    expect(circle.getAttribute('fill')).toBe('green');
    expect(circle.className.baseVal).toBe('two three');

    expect(circle.nodeName).toBe('circle');
    expect(circle.namespaceURI).toBe('http://www.w3.org/2000/svg');
    expect(circle.parentNode!.namespaceURI).toBe('http://www.w3.org/2000/svg');
  });

  test('ui - attributes', () => {
    const amp = new HTML.CharRef({ html: '&amp;', str: '&' });
    expect(
      HTML.toHTML(SPAN({ title: ['M', amp, 'Ms'] }, 'M', amp, 'M candies')),
    ).toBe('<span title="M&amp;Ms">M&amp;M candies</span>');
  });
});

// ─── Builtins Tests ──────────────────────────────────────────────────────────

describe('builtins', () => {
  test('If - truthy/falsy', () => {
    const R = reactive.ReactiveVar(true);

    const view = If(
      () => R.get(),
      () => 'yes',
      () => 'no',
    );

    const div = document.createElement('DIV');
    render(view, div);
    expect(canonicalizeHtml(div.innerHTML)).toBe('yes');

    R.set(false);
    reactive.flush();
    expect(canonicalizeHtml(div.innerHTML)).toBe('no');

    R.set(true);
    reactive.flush();
    expect(canonicalizeHtml(div.innerHTML)).toBe('yes');
  });

  test('Unless', () => {
    const R = reactive.ReactiveVar(false);

    const view = Unless(
      () => R.get(),
      () => 'shown',
      () => 'hidden',
    );

    const div = document.createElement('DIV');
    render(view, div);
    expect(canonicalizeHtml(div.innerHTML)).toBe('shown');

    R.set(true);
    reactive.flush();
    expect(canonicalizeHtml(div.innerHTML)).toBe('hidden');
  });

  test('With - data context', () => {
    const R = reactive.ReactiveVar({ name: 'Alice' });

    const view = With(
      () => R.get(),
      () => {
        const data = getData() as { name: string };
        return data.name;
      },
    );

    const div = document.createElement('DIV');
    render(view, div);
    expect(canonicalizeHtml(div.innerHTML)).toBe('Alice');

    R.set({ name: 'Bob' });
    reactive.flush();
    expect(canonicalizeHtml(div.innerHTML)).toBe('Bob');
  });

  test('Let - lexical bindings', () => {
    const view = Let(
      { greeting: 'Hello', target: 'World' },
      () => {
        const v = currentView!;
        const g = (v._scopeBindings['greeting']?.get() as { value?: unknown } | undefined)?.value;
        const t = (v._scopeBindings['target']?.get() as { value?: unknown } | undefined)?.value;
        return `${g} ${t}`;
      },
    );

    const div = document.createElement('DIV');
    render(view, div);
    expect(canonicalizeHtml(div.innerHTML)).toBe('Hello World');
  });

  test('If with empty array is falsy', () => {
    const view = If(
      () => [],
      () => 'truthy',
      () => 'falsy',
    );

    expect(toHTML(view)).toBe('falsy');
  });
});

// ─── Template Tests ──────────────────────────────────────────────────────────

describe('template', () => {
  test('basic template creation', () => {
    const tmpl = new Template('test_basic', () => HTML.P('Hello'));
    expect(tmpl.viewName).toBe('test_basic');
    expect(isTemplate(tmpl)).toBe(true);
    expect(isTemplate({})).toBe(false);
  });

  test('template helpers', () => {
    const tmpl = new Template('test_helpers', function (this: View) {
      const helper = this.lookup('greeting');
      return HTML.P(typeof helper === 'function' ? helper() : String(helper));
    });
    tmpl.helpers({ greeting: () => 'Hi there' });

    const html = toHTML(tmpl);
    expect(html).toBe('<p>Hi there</p>');
  });

  test('template lifecycle callbacks', () => {
    const buf: string[] = [];
    const tmpl = new Template('test_lifecycle', () => HTML.P('content'));

    tmpl.onCreated(function (this: TemplateInstance) {
      buf.push('created');
    });
    tmpl.onDestroyed(function (this: TemplateInstance) {
      buf.push('destroyed');
    });

    const div = document.createElement('DIV');
    const view = render(tmpl, div);
    expect(buf).toContain('created');
    expect(canonicalizeHtml(div.innerHTML)).toBe('<p>content</p>');

    remove(view);
    expect(buf).toContain('destroyed');
  });

  test('global helpers', () => {
    registerHelper('testGlobal', () => 'global_value');
    expect(typeof _globalHelpers['testGlobal']).toBe('function');
    deregisterHelper('testGlobal');
    expect(_globalHelpers['testGlobal']).toBeUndefined();
  });
});

// ─── DOMRange Tests ──────────────────────────────────────────────────────────

describe('DOMRange', () => {
  test('basic construction', () => {
    const text = document.createTextNode('hello');
    const range = new DOMRange([text]);
    expect(range.members.length).toBe(1);
    expect(range.members[0]).toBe(text);
  });

  test('attach and detach', () => {
    const div = document.createElement('DIV');
    const text = document.createTextNode('hello');
    const range = new DOMRange([text]);
    range.attach(div);
    expect(div.innerHTML).toBe('hello');
    expect(range.attached).toBe(true);

    range.detach();
    expect(div.innerHTML).toBe('');
    expect(range.attached).toBe(false);
  });

  test('add and remove members', () => {
    const div = document.createElement('DIV');
    const text1 = document.createTextNode('a');
    const text2 = document.createTextNode('b');
    const range = new DOMRange([text1]);
    range.attach(div);
    expect(div.textContent).toBe('a');

    range.addMember(text2, 1);
    expect(div.textContent).toBe('ab');
    expect(range.members.length).toBe(2);

    range.removeMember(0);
    expect(div.textContent).toBe('b');
    expect(range.members.length).toBe(1);
  });
});

// ─── Reactivity Tests ────────────────────────────────────────────────────────

describe('SimpleReactiveSystem', () => {
  test('ReactiveVar get/set', () => {
    const v = reactive.ReactiveVar(10);
    expect(v.get()).toBe(10);
    v.set(20);
    expect(v.get()).toBe(20);
  });

  test('autorun tracks dependencies', () => {
    const v = reactive.ReactiveVar('a');
    const results: string[] = [];

    reactive.autorun(() => {
      results.push(v.get());
    });

    expect(results).toEqual(['a']);

    v.set('b');
    reactive.flush();
    expect(results).toEqual(['a', 'b']);

    v.set('c');
    reactive.flush();
    expect(results).toEqual(['a', 'b', 'c']);
  });

  test('autorun stop', () => {
    const v = reactive.ReactiveVar(0);
    let runCount = 0;

    const comp = reactive.autorun(() => {
      v.get();
      runCount++;
    });

    expect(runCount).toBe(1);

    v.set(1);
    reactive.flush();
    expect(runCount).toBe(2);

    comp.stop();
    v.set(2);
    reactive.flush();
    expect(runCount).toBe(2); // should NOT have re-run
  });

  test('nonReactive', () => {
    const v = reactive.ReactiveVar('x');
    let runs = 0;

    reactive.autorun(() => {
      reactive.nonReactive(() => {
        v.get(); // should NOT create a dependency
      });
      runs++;
    });

    expect(runs).toBe(1);
    v.set('y');
    reactive.flush();
    expect(runs).toBe(1); // should NOT re-run
  });

  test('afterFlush', () => {
    const order: string[] = [];

    const v = reactive.ReactiveVar(1);
    reactive.autorun(() => {
      v.get();
      order.push('autorun');
    });

    reactive.afterFlush(() => {
      order.push('afterFlush');
    });

    v.set(2);
    expect(order).toEqual(['autorun']); // not flushed yet
    reactive.flush();
    expect(order).toEqual(['autorun', 'autorun', 'afterFlush']);
  });
});

// ─── toHTML Tests ────────────────────────────────────────────────────────────

describe('toHTML', () => {
  test('simple content', () => {
    expect(toHTML('Hello')).toBe('Hello');
    expect(toHTML(HTML.P('World'))).toBe('<p>World</p>');
    expect(toHTML([HTML.P('A'), HTML.P('B')])).toBe('<p>A</p><p>B</p>');
  });

  test('View renders to HTML', () => {
    const v = new View('test', () => HTML.DIV('content'));
    expect(toHTML(v)).toBe('<div>content</div>');
  });

  test('null and undefined throw', () => {
    expect(() => toHTML(null)).toThrow("Can't render null");
    expect(() => toHTML(undefined)).toThrow("Can't render undefined");
  });
});

// ─── View GC / cleanup tests ────────────────────────────────────────────────

describe('view garbage collection', () => {
  test('destroying a view stops its autorun', () => {
    const R = reactive.ReactiveVar('Hello');
    let runCount = 0;

    const v = new View('gc-test', () => {
      runCount++;
      return HTML.P(R.get());
    });

    const div = document.createElement('div');
    render(v, div);
    expect(runCount).toBe(1);
    expect(canonicalizeHtml(div.innerHTML)).toBe('<p>Hello</p>');

    R.set('World');
    reactive.flush();
    expect(runCount).toBe(2);
    expect(canonicalizeHtml(div.innerHTML)).toBe('<p>World</p>');

    // Remove the view — autoruns should stop
    remove(v);

    const prevCount = runCount;
    R.set('After');
    reactive.flush();
    // Should not re-run after removal
    expect(runCount).toBe(prevCount);
  });

  test('nested views are cleaned up on parent removal', () => {
    const R = reactive.ReactiveVar('inner');
    let innerRuns = 0;

    const outerView = new View('outer', () => {
      return HTML.DIV(new View('inner', () => {
        innerRuns++;
        return R.get();
      }));
    });

    const div = document.createElement('div');
    render(outerView, div);
    expect(innerRuns).toBe(1);

    R.set('updated');
    reactive.flush();
    expect(innerRuns).toBe(2);

    remove(outerView);

    const prevRuns = innerRuns;
    R.set('after-remove');
    reactive.flush();
    expect(innerRuns).toBe(prevRuns);
  });
});

// ─── Reactive Attribute Tests ────────────────────────────────────────────────

describe('reactive attributes', () => {
  test('dynamic class attribute updates', () => {
    const R = reactive.ReactiveVar('foo');

    const spanFunc = () =>
      HTML.SPAN(
        { class: () => new View('attr', () => R.get()) },
        'text',
      );

    const div = document.createElement('div');
    render(spanFunc, div);
    const span = div.querySelector('span');
    expect(span).toBeTruthy();
    expect(span!.getAttribute('class')).toBe('foo');

    R.set('bar');
    reactive.flush();
    expect(span!.getAttribute('class')).toBe('bar');
  });

  test('nully attributes are removed', () => {
    const R = reactive.ReactiveVar<string | null>('value');

    const spanFunc = () =>
      HTML.SPAN(
        { id: () => new View('attr', () => R.get()) },
        'text',
      );

    const div = document.createElement('div');
    render(spanFunc, div);
    const span = div.querySelector('span');
    expect(span!.getAttribute('id')).toBe('value');

    R.set(null);
    reactive.flush();
    // null attribute should be removed
    expect(span!.hasAttribute('id')).toBe(false);
  });

  test('dynamic data- attribute', () => {
    const R = reactive.ReactiveVar('initial');

    const spanFunc = () =>
      HTML.SPAN(
        { 'data-info': () => new View('attr', () => R.get()) },
        'text',
      );

    const div = document.createElement('div');
    render(spanFunc, div);
    const span = div.querySelector('span');
    expect(span).toBeTruthy();
    expect(span!.getAttribute('data-info')).toBe('initial');

    R.set('updated');
    reactive.flush();
    expect(span!.getAttribute('data-info')).toBe('updated');
  });
});

// ─── Template Lifecycle Tests ────────────────────────────────────────────────

describe('template lifecycle', () => {
  test('created/rendered/destroyed callbacks fire in order', () => {
    const buf: string[] = [];

    const tmpl = new Template('lifecycle-test', () => HTML.DIV('hello'));
    tmpl.onCreated(function (this: TemplateInstance) {
      buf.push('created');
    });
    tmpl.onRendered(function (this: TemplateInstance) {
      buf.push('rendered');
    });
    tmpl.onDestroyed(function (this: TemplateInstance) {
      buf.push('destroyed');
    });

    const div = document.createElement('div');
    const view = render(tmpl, div);
    reactive.flush();

    expect(buf).toContain('created');
    // rendered fires after flush
    expect(buf).toContain('rendered');

    remove(view);
    expect(buf).toContain('destroyed');
  });

  test('Template.instance() available in lifecycle callbacks', () => {
    let captured: TemplateInstance | null = null;

    const tmpl = new Template('instance-test', () => HTML.SPAN('test'));
    tmpl.onCreated(function (this: TemplateInstance) {
      captured = Template.instance();
    });

    const div = document.createElement('div');
    const view = render(tmpl, div);
    reactive.flush();

    expect(captured).toBeInstanceOf(TemplateInstance);
    remove(view);
  });

  test('template helpers are accessible', () => {
    const tmpl = new Template('helper-test', function (this: View) {
      const helper = this.lookup('greeting');
      const val = typeof helper === 'function' ? helper() : helper;
      return HTML.SPAN(val as string);
    });

    tmpl.helpers({
      greeting: () => 'Hello World',
    });

    const div = document.createElement('div');
    const view = render(tmpl, div);
    expect(canonicalizeHtml(div.innerHTML)).toContain('Hello World');
    remove(view);
  });

  test('template events fire', () => {
    let clicked = false;

    const tmpl = new Template('event-test', () =>
      HTML.BUTTON({ class: 'btn' }, 'Click me'),
    );

    tmpl.events({
      'click .btn': () => {
        clicked = true;
      },
    });

    const div = document.createElement('div');
    document.body.appendChild(div);
    const view = render(tmpl, div);
    reactive.flush();

    const btn = div.querySelector('.btn');
    expect(btn).toBeTruthy();

    const clickEvent = new dom.window.Event('click', { bubbles: true });
    btn!.dispatchEvent(clickEvent);

    expect(clicked).toBe(true);

    remove(view);
    div.remove();
  });
});

// ─── Each Builtin Tests ─────────────────────────────────────────────────────

describe('Each builtin', () => {
  test('renders array items', () => {
    const items = reactive.ReactiveVar([1, 2, 3]);

    const view = Each(
      () => items.get(),
      () => HTML.LI(String(getData())),
    );

    const div = document.createElement('div');
    render(view, div);
    expect(div.querySelectorAll('li')).toHaveLength(3);
  });

  test('updates when array changes', () => {
    const items = reactive.ReactiveVar(['a', 'b']);

    const view = Each(
      () => items.get(),
      () => HTML.LI(String(getData())),
    );

    const div = document.createElement('div');
    render(view, div);
    expect(div.querySelectorAll('li')).toHaveLength(2);

    items.set(['a', 'b', 'c']);
    reactive.flush();
    expect(div.querySelectorAll('li')).toHaveLength(3);
  });

  test('renders else block when empty', () => {
    const items = reactive.ReactiveVar<string[]>([]);

    const view = Each(
      () => items.get(),
      () => HTML.LI(String(getData())),
      () => HTML.P('empty'),
    );

    const div = document.createElement('div');
    render(view, div);
    expect(div.querySelector('p')?.textContent).toBe('empty');

    items.set(['x']);
    reactive.flush();
    expect(div.querySelector('li')).toBeTruthy();
    expect(div.querySelector('p')).toBeFalsy();
  });
});

// ─── Global Helper Tests ────────────────────────────────────────────────────

describe('global helpers', () => {
  test('registerHelper and deregisterHelper', () => {
    registerHelper('testGlobal', () => 'globalValue');
    expect('testGlobal' in (_globalHelpers as Record<string, unknown>)).toBe(true);

    deregisterHelper('testGlobal');
    expect('testGlobal' in (_globalHelpers as Record<string, unknown>)).toBe(false);
  });

  test('registered helper is accessible in template', () => {
    registerHelper('myGlobal', () => 'global-result');

    const tmpl = new Template('global-test', function (this: View) {
      const helper = this.lookup('myGlobal');
      const val = typeof helper === 'function' ? helper() : helper;
      return HTML.SPAN(val as string);
    });

    const div = document.createElement('div');
    const view = render(tmpl, div);
    expect(canonicalizeHtml(div.innerHTML)).toContain('global-result');

    remove(view);
    deregisterHelper('myGlobal');
  });
});

// ─── renderWithData Tests ────────────────────────────────────────────────────

describe('renderWithData', () => {
  test('provides data context to template', () => {
    let capturedData: unknown = null;

    const tmpl = new Template('data-test', function () {
      capturedData = getData();
      return HTML.SPAN('test');
    });

    const div = document.createElement('div');
    const view = renderWithData(tmpl, { name: 'Alice', age: 30 }, div);
    reactive.flush();

    expect(capturedData).toEqual({ name: 'Alice', age: 30 });
    remove(view);
  });
});
