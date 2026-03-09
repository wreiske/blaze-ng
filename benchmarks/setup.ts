/**
 * Shared benchmark setup for Blaze-NG performance benchmarks.
 *
 * Provides JSDOM environment, reactive system initialization,
 * and template compilation helpers used across all benchmark suites.
 */
import { JSDOM } from 'jsdom';
import { HTML, Raw, CharRef, Comment as HtmlComment } from '@blaze-ng/htmljs';
import { Spacebars } from '@blaze-ng/spacebars';
import { ObserveSequence } from '@blaze-ng/observe-sequence';
import { compile } from '@blaze-ng/spacebars-compiler';
import { SimpleReactiveSystem } from '@blaze-ng/core/testing';
import {
  View,
  setReactiveSystem,
  render,
  remove,
  toHTML,
  toHTMLWithData,
  Template,
  registerHelper,
  deregisterHelper,
  renderWithData,
  With,
  If,
  Unless,
  Each,
  Let,
  _parentData,
  _InOuterTemplateScope,
  getView,
} from '@blaze-ng/core';

export {
  render,
  remove,
  toHTML,
  toHTMLWithData,
  Template,
  registerHelper,
  deregisterHelper,
  renderWithData,
  View,
};

export let dom: JSDOM;
export let document: Document;
export let reactive: SimpleReactiveSystem;

/**
 * Initialize the JSDOM environment and reactive system.
 * Must be called before any benchmark that touches the DOM.
 */
export function setupEnvironment(): void {
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
}

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

/**
 * Create a proxy for HTML namespace that allows class constructors
 * to be called without `new`.
 */
function createHtmlProxy() {
  const proxy = { ...HTML };
  proxy.Raw = function (...args: unknown[]) {
    return new (Raw as unknown as new (...a: unknown[]) => unknown)(...args);
  } as unknown as typeof HTML.Raw;
  proxy.CharRef = function (...args: unknown[]) {
    return new (CharRef as unknown as new (...a: unknown[]) => unknown)(...args);
  } as unknown as typeof HTML.CharRef;
  proxy.Comment = function (...args: unknown[]) {
    return new (HtmlComment as unknown as new (...a: unknown[]) => unknown)(...args);
  } as unknown as typeof HTML.Comment;
  return proxy;
}

/**
 * Compile a Spacebars source string to a render function.
 * @param source - The Spacebars template source.
 * @returns A function suitable for `new Template(name, renderFunc)`.
 */
export function compileToRenderFunc(source: string): (this: View) => unknown {
  const code = compile(source, { isTemplate: true });
  const ViewProxy = function (name: string, renderFunc?: () => unknown) {
    return new View(name, renderFunc);
  } as unknown as typeof View;
  Object.setPrototypeOf(ViewProxy, View);
  ViewProxy.prototype = View.prototype;

  const BlazeNS = {
    View: ViewProxy,
    If: (cond: () => unknown, content: () => unknown, elseContent?: () => unknown) =>
      If(cond, content, elseContent),
    Unless: (cond: () => unknown, content: () => unknown, elseContent?: () => unknown) =>
      Unless(cond, content, elseContent),
    Each: (arg: () => unknown, content: () => unknown, elseContent?: () => unknown) =>
      Each(arg, content, elseContent),
    Let: (bindings: Record<string, () => unknown>, content: () => unknown) =>
      Let(bindings, content),
    With,
    _TemplateWith: (arg: () => unknown, content: () => unknown) => With(arg, content),
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

/**
 * Create a Template from a Spacebars source string.
 * @param name - Template name.
 * @param source - Spacebars template source.
 * @returns A compiled Template instance.
 */
export function makeTemplate(name: string, source: string): Template {
  const renderFunc = compileToRenderFunc(source);
  return new Template(`Template.${name}`, renderFunc);
}

/**
 * Render a template into a new div, flushing reactivity.
 * @param tmpl - Template or View to render.
 * @param data - Optional data context.
 * @returns The container div.
 */
export function renderToDiv(
  tmpl: Template | View | (() => unknown),
  data?: unknown,
): HTMLDivElement {
  const div = document.createElement('div');
  if (data !== undefined) {
    renderWithData(tmpl, data, div);
  } else {
    render(tmpl, div);
  }
  reactive.flush();
  return div;
}

/**
 * Generate an array of row objects for list benchmarks.
 * @param count - Number of rows to generate.
 * @param startId - Starting ID (default 1).
 * @returns Array of `{ _id, label }` objects.
 */
export function generateRows(count: number, startId = 1): Array<{ _id: string; label: string }> {
  const rows = [];
  for (let i = 0; i < count; i++) {
    const id = startId + i;
    rows.push({ _id: String(id), label: `Item ${id}` });
  }
  return rows;
}
