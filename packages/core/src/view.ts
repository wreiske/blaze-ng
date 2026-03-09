/**
 * View — the core reactive building block of Blaze.
 *
 * A View represents a reactive region of DOM. Views have lifecycle callbacks,
 * a parent pointer forming a hierarchy, and a render() method that returns
 * renderable content (HTMLjs).
 */

import { HTML, type Tag, TransformingVisitor } from '@blaze-ng/htmljs';
import type { ReactiveSystem, Computation, ReactiveVar, Binding } from './types';
import { DOMRange, _elementContains } from './domrange';
import { DOMBackend } from './dombackend';
import { _bind, _warn } from './preamble';
import { _reportException, _wrapCatchingExceptions } from './exceptions';

// ─── Reactive system registration ──────────────────────────────────────────

let _reactive: ReactiveSystem | null = null;

/**
 * Register the reactive system used by Blaze.
 *
 * @param system - The reactive system implementation.
 */
export function setReactiveSystem(system: ReactiveSystem): void {
  _reactive = system;
}

/**
 * Get the current reactive system, throwing if none is set.
 *
 * @returns The active reactive system.
 * @throws {Error} If no reactive system has been registered.
 */
export function _getReactiveSystem(): ReactiveSystem {
  if (!_reactive) {
    throw new Error('No reactive system registered. Call Blaze.setReactiveSystem() first.');
  }
  return _reactive;
}

// ─── Forward declarations for Blaze.Template (set later) ──────────────────

/** Template class — set via _setTemplateClass to break circular deps. */
let TemplateClass: TemplateConstructor | null = null;

export interface TemplateConstructor {
  new (viewName?: string, renderFunction?: () => unknown): TemplateInstance;
  _currentTemplateInstanceFunc: (() => TemplateInstance) | null;
  _withTemplateInstanceFunc: <T>(
    templateInstanceFunc: (() => TemplateInstance) | null,
    fn: () => T,
  ) => T;
}

export interface TemplateInstance {
  viewName: string;
  renderFunction: () => unknown;
  constructView: (contentFunc?: () => unknown, elseFunc?: () => unknown) => View;
  __helpers: {
    has(name: string): boolean;
    get(name: string): unknown;
    set(name: string, value: unknown): void;
  };
  __eventMaps: Record<string, (...args: unknown[]) => void>[];
  _callbacks: { created: (() => void)[]; rendered: (() => void)[]; destroyed: (() => void)[] };
  _getCallbacks: (which: 'created' | 'rendered' | 'destroyed') => (() => void)[];
  [key: string]: unknown;
}

/**
 * Register the Template class (called during initialization).
 *
 * @param tmplClass - The Template constructor.
 */
export function _setTemplateClass(tmplClass: TemplateConstructor): void {
  TemplateClass = tmplClass;
}

// ─── View class ────────────────────────────────────────────────────────────

/** Callback lists for a view. */
interface ViewCallbacks {
  created: ((() => void) | null)[];
  rendered: ((() => void) | null)[];
  destroyed: ((() => void) | null)[];
}

/**
 * A View represents a reactive region of DOM. It is the fundamental
 * building block of the Blaze view layer.
 */
export class View {
  name: string;
  _render: () => unknown;
  _callbacks: ViewCallbacks;

  isCreated = false;
  _isCreatedForExpansion = false;
  isRendered = false;
  _isAttached = false;
  isDestroyed = false;
  _isInRender = false;
  parentView: View | null = null;
  _domrange: DOMRange | null = null;
  _hasGeneratedParent = false;
  _scopeBindings: Record<string, ReactiveVar<Binding>> = {};
  renderCount = 0;

  // These are set by Template.constructView
  template: TemplateInstance | null = null;
  templateContentBlock: TemplateInstance | null = null;
  templateElseBlock: TemplateInstance | null = null;
  _templateInstance: unknown = null;
  templateInstance: (() => unknown) | null = null;
  __startsNewLexicalScope?: boolean;
  __childDoesntStartNewLexicalScope?: boolean;
  __isTemplateWith?: boolean;
  __conditionVar?: ReactiveVar<Binding> | null;
  originalParentView?: View;

  // For Blaze.Each
  initialSubviews?: View[] | null;
  numItems?: number;
  inElseMode?: boolean;
  stopHandle?: { stop(): void } | null;
  contentFunc?: () => unknown;
  elseFunc?: () => unknown;
  argVar?: ReactiveVar<Binding>;
  variableName?: string | null;
  expandedValueDep?: { depend(): void; changed(): void };

  // For Blaze.With
  dataVar?: ReactiveVar<Binding>;

  // Misc properties set by various code paths
  number?: number;

  constructor(name?: string | (() => unknown), render?: () => unknown) {
    if (typeof name === 'function') {
      render = name;
      name = '';
    }
    this.name = name || '';
    this._render = render || (() => null);
    this._callbacks = {
      created: [],
      rendered: [],
      destroyed: [],
    };
  }

  /**
   * Register a callback for when this view is created.
   *
   * @param cb - The callback function.
   */
  onViewCreated(cb: () => void): void {
    this._callbacks.created.push(cb);
  }

  /**
   * Register a callback for when this view is rendered.
   * (Private — use `onViewReady` for the public API.)
   *
   * @param cb - The callback function.
   */
  _onViewRendered(cb: () => void): void {
    this._callbacks.rendered.push(cb);
  }

  /**
   * Register a callback for when this view is "ready" (rendered + attached + after flush).
   *
   * @param cb - The callback function.
   */
  onViewReady(cb: () => void): void {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this;
    const fire = () => {
      _getReactiveSystem().afterFlush(() => {
        if (!self.isDestroyed) {
          _withCurrentView(self, () => {
            cb.call(self);
          });
        }
      });
    };
    self._onViewRendered(function onViewRendered() {
      if (self.isDestroyed) return;
      if (!self._domrange!.attached) {
        self._domrange!.onAttached(fire);
      } else {
        fire();
      }
    });
  }

  /**
   * Register a callback for when this view is destroyed.
   *
   * @param cb - The callback function.
   */
  onViewDestroyed(cb: () => void): void {
    this._callbacks.destroyed.push(cb);
  }

  /**
   * Remove a previously registered destroyed callback.
   *
   * @param cb - The callback to remove.
   */
  removeViewDestroyedListener(cb: () => void): void {
    const destroyed = this._callbacks.destroyed;
    const index = destroyed.lastIndexOf(cb);
    if (index !== -1) {
      destroyed[index] = null;
    }
  }

  /**
   * Like Tracker.autorun, but scoped to this View:
   * 1) Blaze.currentView is automatically set on every re-run
   * 2) the autorun is stopped when the View is destroyed
   *
   * @param f - The reactive function.
   * @param _inViewScope - Optional view for current view scope.
   * @param displayName - Optional name for debugging.
   * @returns A Computation handle.
   */
  autorun(f: (c: Computation) => void, _inViewScope?: View, _displayName?: string): Computation {
    if (!this.isCreated) {
      throw new Error('View#autorun must be called from the created callback at the earliest');
    }
    if (this._isInRender) {
      throw new Error(
        "Can't call View#autorun from inside render(); try calling it from the created or rendered callback",
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this;
    const templateInstanceFunc = TemplateClass?._currentTemplateInstanceFunc ?? null;

    const func = (c: Computation) => {
      return _withCurrentView(_inViewScope || self, () => {
        if (TemplateClass) {
          return TemplateClass._withTemplateInstanceFunc(templateInstanceFunc, () => {
            return f.call(self, c);
          });
        }
        return f.call(self, c);
      });
    };

    const reactive = _getReactiveSystem();
    const comp = reactive.autorun(func);

    const stopComputation = () => {
      comp.stop();
    };
    self.onViewDestroyed(stopComputation);
    comp.onStop(() => {
      self.removeViewDestroyedListener(stopComputation);
    });

    return comp;
  }

  _errorIfShouldntCallSubscribe(): void {
    if (!this.isCreated) {
      throw new Error('View#subscribe must be called from the created callback at the earliest');
    }
    if (this._isInRender) {
      throw new Error(
        "Can't call View#subscribe from inside render(); try calling it from the created or rendered callback",
      );
    }
    if (this.isDestroyed) {
      throw new Error(
        "Can't call View#subscribe from inside the destroyed callback, try calling it inside created or rendered.",
      );
    }
  }

  /**
   * Get the first DOM node of this view.
   *
   * @returns The first node.
   * @throws If the view is not attached.
   */
  firstNode(): Node {
    if (!this._isAttached) {
      throw new Error('View must be attached before accessing its DOM');
    }
    return this._domrange!.firstNode();
  }

  /**
   * Get the last DOM node of this view.
   *
   * @returns The last node.
   * @throws If the view is not attached.
   */
  lastNode(): Node {
    if (!this._isAttached) {
      throw new Error('View must be attached before accessing its DOM');
    }
    return this._domrange!.lastNode();
  }

  /**
   * Look up a name in the template scope.
   *
   * @param name - The name to look up.
   * @param _options - Optional options.
   * @returns The resolved value or function.
   */
  lookup(_name: string, _options?: { template?: boolean }): unknown {
    // Implemented in lookup.ts, will be patched onto View prototype
    throw new Error('View.lookup requires the lookup module to be loaded');
  }

  /**
   * Look up a template by name.
   *
   * @param name - The template name.
   * @returns The template or null.
   */
  lookupTemplate(name: string): unknown {
    return this.lookup(name, { template: true });
  }
}

// ─── Module-level functions ────────────────────────────────────────────────

/**
 * The View corresponding to the current template helper, event handler,
 * callback, or autorun. Null if there isn't one.
 */
export let currentView: View | null = null;

/**
 * Run a function with Blaze.currentView set to a given view.
 *
 * @param view - The view to set as current.
 * @param func - The function to execute.
 * @returns The return value of func.
 */
export function _withCurrentView<T>(view: View, func: () => T): T {
  const oldView = currentView;
  try {
    currentView = view;
    return func();
  } finally {
    currentView = oldView;
  }
}

/**
 * Fire lifecycle callbacks on a view.
 *
 * @param view - The view.
 * @param which - Which callback phase to fire.
 */
export function _fireCallbacks(view: View, which: 'created' | 'rendered' | 'destroyed'): void {
  _withCurrentView(view, () => {
    _getReactiveSystem().nonReactive(() => {
      const cbs = view._callbacks[which];
      for (let i = 0, N = cbs.length; i < N; i++) {
        cbs[i]?.call(view);
      }
    });
  });
}

/**
 * Create a view, setting its parent and firing 'created' callbacks.
 *
 * @param view - The view to create.
 * @param parentView - The parent view.
 * @param forExpansion - Whether creating for HTML expansion only.
 */
export function _createView(view: View, parentView?: View | null, forExpansion?: boolean): void {
  if (view.isCreated) throw new Error("Can't render the same View twice");

  view.parentView = parentView || null;
  view.isCreated = true;
  if (forExpansion) view._isCreatedForExpansion = true;

  _fireCallbacks(view, 'created');
}

function doFirstRender(view: View, initialContent: (DOMRange | Node)[]): DOMRange {
  const domrange = new DOMRange(initialContent);
  view._domrange = domrange;
  domrange.view = view;
  view.isRendered = true;
  _fireCallbacks(view, 'rendered');

  let teardownHook: { stop(): void } | null = null;

  domrange.onAttached((_range, element) => {
    view._isAttached = true;

    teardownHook = DOMBackend.Teardown.onElementTeardown(element, () => {
      _destroyView(view, true);
    });
  });

  view.onViewDestroyed(() => {
    teardownHook?.stop();
    teardownHook = null;
  });

  return domrange;
}

// Forward declaration for _materializeDOM — set via _setMaterializeDOMFn
let _materializeDOMFn:
  | ((
      htmljs: unknown,
      intoArray: (DOMRange | Node)[],
      parentView: View | undefined,
      _existingWorkStack?: (() => void)[],
    ) => (DOMRange | Node)[])
  | null = null;

/**
 * Register the _materializeDOM function (breaks circular dep with materializer).
 *
 * @param fn - The materializeDOM implementation.
 */
export function _setMaterializeDOMFn(fn: typeof _materializeDOMFn): void {
  _materializeDOMFn = fn;
}

/**
 * Create and render a view to DOM, setting up the reactive autorun.
 *
 * @param view - The view to materialize.
 * @param parentView - The parent view.
 * @param _workStack - Internal work stack for avoiding deep recursion.
 * @param _intoArray - Internal output array.
 * @returns A DOMRange, or null if using work stack.
 */
export function _materializeView(
  view: View,
  parentView?: View | null,
  _workStack?: (() => void)[],
  _intoArray?: (DOMRange | Node)[],
): DOMRange | null {
  _createView(view, parentView);

  let domrange: DOMRange | undefined;
  let lastHtmljs: unknown;
  const reactive = _getReactiveSystem();

  reactive.nonReactive(() => {
    view.autorun(
      function doRender(c: Computation) {
        view.renderCount = view.renderCount + 1;
        view._isInRender = true;
        const htmljs = view._render();
        view._isInRender = false;

        if (!c.firstRun && !_isContentEqual(lastHtmljs, htmljs)) {
          reactive.nonReactive(() => {
            const rangesAndNodes = _materializeDOMFn!(htmljs, [], view);
            domrange!.setMembers(rangesAndNodes);
            _fireCallbacks(view, 'rendered');
          });
        }
        lastHtmljs = htmljs;

        reactive.onInvalidate(() => {
          if (domrange) {
            domrange.destroyMembers();
          }
        });
      },
      undefined,
      'materialize',
    );

    let initialContents: (DOMRange | Node)[];
    if (!_workStack) {
      initialContents = _materializeDOMFn!(lastHtmljs, [], view);
      domrange = doFirstRender(view, initialContents);
    } else {
      initialContents = [];
      _workStack.push(() => {
        domrange = doFirstRender(view, initialContents);
        _intoArray!.push(domrange);
      });
      _workStack.push(
        _bind(
          _materializeDOMFn! as (...args: unknown[]) => unknown,
          null,
          lastHtmljs,
          initialContents,
          view,
          _workStack,
        ) as () => void,
      );
    }
  });

  if (!_workStack) {
    return domrange!;
  }
  return null;
}

/**
 * Expand a View to HTMLjs, calling render() recursively.
 *
 * @param view - The view to expand.
 * @param parentView - The parent view.
 * @returns The expanded HTMLjs.
 */
export function _expandView(view: View, parentView?: View | null): unknown {
  _createView(view, parentView, true);

  view._isInRender = true;
  const htmljs = _withCurrentView(view, () => view._render());
  view._isInRender = false;

  const result = _expand(htmljs, view);

  const reactive = _getReactiveSystem();
  if (reactive.active) {
    reactive.onInvalidate(() => {
      _destroyView(view);
    });
  } else {
    _destroyView(view);
  }

  return result;
}

// HTMLjs expander — expand Views and Templates to HTMLjs
class HTMLJSExpander extends TransformingVisitor {
  parentView: View | null;

  constructor(options: { parentView?: View | null } = {}) {
    super();
    this.parentView = options.parentView || null;
  }

  override visitObject(x: unknown): unknown {
    if (
      TemplateClass &&
      x instanceof (TemplateClass as unknown as new (...args: unknown[]) => unknown)
    ) {
      x = (x as TemplateInstance).constructView();
    }
    if (x instanceof View) {
      return _expandView(x, this.parentView);
    }
    return super.visitObject(x);
  }

  override visitAttributes(attrs: unknown): unknown {
    if (typeof attrs === 'function') {
      attrs = _withCurrentView(this.parentView!, attrs as () => unknown);
    }
    return super.visitAttributes(attrs);
  }

  override visitAttribute(name: string, value: unknown, tag: Tag): unknown {
    if (typeof value === 'function') {
      value = _withCurrentView(this.parentView!, value as () => unknown);
    }
    return super.visitAttribute(name, value, tag);
  }
}

/** Return Blaze.currentView, but only if it is being rendered. */
function currentViewIfRendering(): View | null {
  const view = currentView;
  return view && view._isInRender ? view : null;
}

/**
 * Expand HTMLjs, recursively expanding Views and dynamic attributes.
 *
 * @param htmljs - The HTMLjs to expand.
 * @param parentView - Optional parent view.
 * @returns The expanded HTMLjs.
 */
export function _expand(htmljs: unknown, parentView?: View | null): unknown {
  parentView = parentView || currentViewIfRendering();
  return new HTMLJSExpander({ parentView }).visit(htmljs);
}

/**
 * Expand attributes, recursively expanding dynamic attributes.
 *
 * @param attrs - The attributes to expand.
 * @param parentView - Optional parent view.
 * @returns The expanded attributes object.
 */
export function _expandAttributes(
  attrs: unknown,
  parentView?: View | null,
): Record<string, unknown> {
  parentView = parentView || currentViewIfRendering();
  const expanded = new HTMLJSExpander({ parentView }).visitAttributes(attrs);
  return (expanded as Record<string, unknown>) || {};
}

/**
 * Destroy a view and its children.
 *
 * @param view - The view to destroy.
 * @param _skipNodes - Whether to skip DOM node teardown.
 */
export function _destroyView(view: View, _skipNodes?: boolean): void {
  if (view.isDestroyed) return;
  view.isDestroyed = true;

  if (view._domrange) view._domrange.destroyMembers(_skipNodes);

  _fireCallbacks(view, 'destroyed');
}

/**
 * Destroy a DOM node, tearing down its Blaze data.
 *
 * @param node - The node to destroy.
 */
export function _destroyNode(node: Node): void {
  if (node.nodeType === 1) {
    DOMBackend.Teardown.tearDownElement(node as Element);
  }
}

/**
 * Check content equality for re-render avoidance.
 *
 * @param a - First content.
 * @param b - Second content.
 * @returns True if the content is equal.
 */
export function _isContentEqual(a: unknown, b: unknown): boolean {
  if (a instanceof HTML.Raw) {
    return b instanceof HTML.Raw && a.value === b.value;
  } else if (a == null) {
    return b == null;
  } else {
    return a === b && (typeof a === 'number' || typeof a === 'boolean' || typeof a === 'string');
  }
}

// ─── Rendering ─────────────────────────────────────────────────────────────

function checkRenderContent(content: unknown): void {
  if (content === null) throw new Error("Can't render null");
  if (typeof content === 'undefined') throw new Error("Can't render undefined");

  if (
    content instanceof View ||
    (TemplateClass &&
      content instanceof (TemplateClass as unknown as new (...args: unknown[]) => unknown)) ||
    typeof content === 'function'
  ) {
    return;
  }

  try {
    new HTML.Visitor().visit(content);
  } catch {
    throw new Error('Expected Template or View');
  }
}

function contentAsView(content: unknown): View {
  checkRenderContent(content);

  if (
    TemplateClass &&
    content instanceof (TemplateClass as unknown as new (...args: unknown[]) => unknown)
  ) {
    return (content as TemplateInstance).constructView();
  } else if (content instanceof View) {
    return content;
  } else {
    let func = content as (() => unknown) | unknown;
    if (typeof func !== 'function') {
      func = () => content;
    }
    return new View('render', func as () => unknown);
  }
}

function contentAsFunc(content: unknown): () => unknown {
  checkRenderContent(content);
  if (typeof content !== 'function') {
    return () => content;
  }
  return content as () => unknown;
}

/** Root views, tracked for debugging. */
export const __rootViews: View[] = [];

/**
 * Render a template or View to DOM and insert it.
 *
 * @param content - The template or View to render.
 * @param parentElement - The parent DOM element.
 * @param nextNode - Optional next sibling for positioning.
 * @param parentView - Optional parent View.
 * @returns The rendered View.
 */
export function render(
  content: unknown,
  parentElement?: Element,
  nextNode?: Node | View | null,
  parentView?: View | null,
): View {
  if (!parentElement) {
    _warn(
      'Blaze.render without a parent element is deprecated. ' +
        'You must specify where to insert the rendered content.',
    );
  }

  if (nextNode instanceof View) {
    parentView = nextNode;
    nextNode = null;
  }

  if (parentElement && typeof (parentElement as Node).nodeType !== 'number') {
    throw new Error("'parentElement' must be a DOM node");
  }
  if (nextNode && typeof (nextNode as Node).nodeType !== 'number') {
    throw new Error("'nextNode' must be a DOM node");
  }

  parentView = parentView || currentViewIfRendering();

  const view = contentAsView(content);

  if (!parentView) {
    view.onViewCreated(() => {
      __rootViews.push(view);
    });
    view.onViewDestroyed(() => {
      const index = __rootViews.indexOf(view);
      if (index > -1) __rootViews.splice(index, 1);
    });
  }

  _materializeView(view, parentView);
  if (parentElement) {
    view._domrange!.attach(parentElement, nextNode as Node | null);
  }

  return view;
}

/**
 * Render a template or View with a data context.
 *
 * @param content - The template or View to render.
 * @param data - Data context or function returning data.
 * @param parentElement - The parent DOM element.
 * @param nextNode - Optional next sibling.
 * @param parentView - Optional parent View.
 * @returns The rendered View.
 */
export function renderWithData(
  content: unknown,
  data: unknown,
  parentElement: Element,
  nextNode?: Node | View | null,
  parentView?: View | null,
): View {
  // _TemplateWith is set from builtins
  return render(
    _TemplateWithFn!(data, contentAsFunc(content)),
    parentElement,
    nextNode,
    parentView,
  );
}

// Forward reference to _TemplateWith
let _TemplateWithFn: ((arg: unknown, contentFunc: () => unknown) => View) | null = null;

/**
 * Register the _TemplateWith function (from builtins).
 *
 * @param fn - The _TemplateWith implementation.
 */
export function _setTemplateWithFn(fn: (arg: unknown, contentFunc: () => unknown) => View): void {
  _TemplateWithFn = fn;
}

/**
 * Remove a rendered View from the DOM.
 *
 * @param view - The view (or view-like object with _domrange) to remove.
 */
export function remove(
  view:
    | View
    | {
        _domrange: DOMRange;
        _hasGeneratedParent?: boolean;
        parentView?: View | null;
        isDestroyed?: boolean;
      },
): void {
  if (!view || !('_domrange' in view) || !(view._domrange instanceof DOMRange)) {
    throw new Error('Expected template rendered with Blaze.render');
  }

  let current: typeof view | null = view;
  while (current) {
    if (!current.isDestroyed) {
      const range = current._domrange;
      if (range) {
        range.destroy();

        if (range.attached && !range.parentRange) {
          range.detach();
        }
      }
    }

    current =
      current._hasGeneratedParent && current.parentView
        ? (current.parentView as unknown as typeof view)
        : null;
  }
}

/**
 * Render a template or View to a string of HTML.
 *
 * @param content - The template or View.
 * @param parentView - Optional parent View.
 * @returns The HTML string.
 */
export function toHTML(content: unknown, parentView?: View | null): string {
  parentView = parentView || currentViewIfRendering();
  return HTML.toHTML(_expandView(contentAsView(content), parentView));
}

/**
 * Render a template or View to HTML with a data context.
 *
 * @param content - The template or View.
 * @param data - Data context or function.
 * @param parentView - Optional parent View.
 * @returns The HTML string.
 */
export function toHTMLWithData(content: unknown, data: unknown, parentView?: View | null): string {
  parentView = parentView || currentViewIfRendering();
  return HTML.toHTML(_expandView(_TemplateWithFn!(data, contentAsFunc(content)), parentView));
}

/**
 * Convert HTMLjs to text using a given text mode.
 *
 * @param htmljs - The HTMLjs content.
 * @param parentView - The parent view (or text mode if view is omitted).
 * @param textMode - The text mode.
 * @returns The text string.
 */
export function _toText(
  htmljs: unknown,
  parentView?: View | null | number,
  textMode?: number,
): string {
  if (typeof htmljs === 'function') {
    throw new Error("Blaze._toText doesn't take a function, just HTMLjs");
  }

  if (parentView != null && !(parentView instanceof View)) {
    textMode = parentView as number;
    parentView = null;
  }
  parentView = (parentView as View | null) || currentViewIfRendering();

  if (!textMode) throw new Error('textMode required');
  if (
    textMode !== HTML.TEXTMODE.STRING &&
    textMode !== HTML.TEXTMODE.RCDATA &&
    textMode !== HTML.TEXTMODE.ATTRIBUTE
  ) {
    throw new Error('Unknown textMode: ' + textMode);
  }

  return HTML.toText(_expand(htmljs, parentView as View | null), textMode);
}

// ─── getData / getView ─────────────────────────────────────────────────────

/**
 * Get the data context of an element or view.
 *
 * @param elementOrView - A DOM element or View.
 * @returns The data context, or null.
 */
export function getData(elementOrView?: Element | View): unknown {
  let theWith: View | null;

  if (!elementOrView) {
    theWith = getView('with');
  } else if (elementOrView instanceof View) {
    const view = elementOrView;
    theWith = view.name === 'with' ? view : getView(view, 'with');
  } else if (typeof (elementOrView as Node).nodeType === 'number') {
    if ((elementOrView as Node).nodeType !== 1) {
      throw new Error('Expected DOM element');
    }
    theWith = getView(elementOrView as Element, 'with');
  } else {
    throw new Error('Expected DOM element or View');
  }

  return theWith ? theWith.dataVar?.get()?.value : null;
}

/**
 * Get a View, either the current one or one enclosing an element.
 *
 * @param elementOrView - A DOM element, View, or view name string.
 * @param _viewName - The name to filter by.
 * @returns The found View, or null.
 */
export function getView(elementOrView?: string | Element | View, _viewName?: string): View | null {
  let viewName = _viewName;

  if (typeof elementOrView === 'string') {
    viewName = elementOrView;
    elementOrView = undefined;
  }

  if (!elementOrView) {
    return _getCurrentView(viewName);
  } else if (elementOrView instanceof View) {
    return _getParentView(elementOrView, viewName);
  } else if (typeof (elementOrView as Node).nodeType === 'number') {
    return _getElementView(elementOrView as Element, viewName);
  } else {
    throw new Error('Expected DOM element or View');
  }
}

function _getCurrentView(name?: string): View | null {
  let view: View | null = currentView;
  if (!view) throw new Error('There is no current view');

  if (name) {
    while (view && view.name !== name) {
      view = view.parentView;
    }
    return view || null;
  }
  return view;
}

function _getParentView(view: View, name?: string): View | null {
  let v: View | null = view.parentView;
  if (name) {
    while (v && v.name !== name) {
      v = v.parentView;
    }
  }
  return v || null;
}

function _getElementView(elem: Element, name?: string): View | null {
  let range = DOMRange.forElement(elem);
  let view: View | null = null;
  while (range && !view) {
    view = range.view || null;
    if (!view) {
      if (range.parentRange) {
        range = range.parentRange;
      } else {
        range = DOMRange.forElement(range.parentElement!);
      }
    }
  }

  if (name) {
    while (view && view.name !== name) {
      view = view.parentView;
    }
    return view || null;
  }
  return view;
}

// ─── Event maps ────────────────────────────────────────────────────────────

// Forward reference to EventSupport.listen — set from events.ts
let _eventSupportListenFn:
  | ((
      element: Element,
      events: string,
      selector: string,
      handler: (...args: unknown[]) => unknown,
      recipient: DOMRange,
      getParentRecipient: (r: DOMRange) => DOMRange | null,
    ) => { stop(): void })
  | null = null;

/**
 * Register the EventSupport.listen function.
 *
 * @param fn - The listen function implementation.
 */
export function _setEventSupportListenFn(fn: typeof _eventSupportListenFn): void {
  _eventSupportListenFn = fn;
}

/**
 * Add event handlers to a view.
 *
 * @param view - The view to add events to.
 * @param eventMap - Map of event spec strings to handler functions.
 * @param thisInHandler - The `this` context for handlers.
 */
export function _addEventMap(
  view: View,
  eventMap: Record<string, (...args: unknown[]) => void>,
  thisInHandler?: unknown,
): void {
  thisInHandler = thisInHandler || null;
  const handles: { stop(): void }[] = [];

  if (!view._domrange) throw new Error('View must have a DOMRange');

  view._domrange.onAttached((_range, element) => {
    Object.keys(eventMap).forEach((spec) => {
      const handler = eventMap[spec]!;
      const clauses = spec.split(/,\s+/);
      clauses.forEach((clause) => {
        const parts = clause.split(/\s+/);
        if (parts.length === 0) return;

        const newEvents = parts.shift()!;
        const selector = parts.join(' ');
        handles.push(
          _eventSupportListenFn!(
            element,
            newEvents,
            selector,
            function (this: unknown, ...args: unknown[]) {
              const evt = args[0] as { currentTarget?: Element };
              if (!_range.containsElement(evt.currentTarget!, selector, newEvents)) {
                return null;
              }
              const handlerThis = thisInHandler || this;
              return _withCurrentView(view, () => {
                return handler.apply(handlerThis as object, args);
              });
            },
            _range,
            (r) => r.parentRange,
          ),
        );
      });
    });
  });

  view.onViewDestroyed(() => {
    handles.forEach((h) => h.stop());
    handles.length = 0;
  });
}

// ─── parentData ────────────────────────────────────────────────────────────

/**
 * Access ancestor data contexts.
 *
 * @param height - Number of levels up (1 = parent, 2 = grandparent, etc.).
 * @param _functionWrapped - Whether to return a function wrapper.
 * @returns The data context, or a function returning it.
 */
export function _parentData(height?: number | null, _functionWrapped?: boolean): unknown {
  if (height == null) height = 1;
  let theWith = getView('with');
  for (let i = 0; i < height && theWith; i++) {
    theWith = getView(theWith, 'with');
  }

  if (!theWith) return null;
  if (_functionWrapped) return () => theWith!.dataVar?.get()?.value;
  return theWith.dataVar?.get()?.value;
}
