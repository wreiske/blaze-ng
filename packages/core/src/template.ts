/**
 * Template — the class for template definitions.
 *
 * A Template represents a reusable UI component with helpers, event handlers,
 * and lifecycle callbacks. Each template has a view name and a render function.
 */

import {
  View,
  _addEventMap,
  _withCurrentView,
  _setTemplateClass,
  _getReactiveSystem,
  getData,
  _parentData,
  type TemplateConstructor,
} from './view';
import { _bind } from './preamble';
import { _wrapCatchingExceptions } from './exceptions';
import type { Computation } from './types';

// ─── HelperMap ─────────────────────────────────────────────────────────────

/**
 * A name-spaced map of template helpers.
 * Uses a ' ' prefix to avoid collisions with built-in props.
 */
class HelperMap {
  [key: string]: unknown;

  get(name: string): unknown {
    return this[' ' + name];
  }

  set(name: string, helper: unknown): void {
    this[' ' + name] = helper;
  }

  has(name: string): boolean {
    return typeof this[' ' + name] !== 'undefined';
  }
}

// ─── Template class ────────────────────────────────────────────────────────

/**
 * Constructor for a Template, which is used to construct Views
 * with a particular name and content.
 */
export class Template {
  viewName: string;
  renderFunction: () => unknown;
  __helpers: HelperMap;
  __eventMaps: Record<string, (...args: unknown[]) => void>[];
  _callbacks: {
    created: (() => void)[];
    rendered: (() => void)[];
    destroyed: (() => void)[];
  };
  _NOWARN_OLDSTYLE_HELPERS?: boolean;
  [key: string]: unknown;

  // Static members
  static _currentTemplateInstanceFunc: (() => TemplateInstance) | null = null;

  constructor(viewName?: string | (() => unknown), renderFunction?: () => unknown) {
    if (typeof viewName === 'function') {
      renderFunction = viewName;
      viewName = '';
    }
    if (typeof viewName !== 'string' && viewName !== undefined) {
      throw new Error('viewName must be a String (or omitted)');
    }
    if (typeof renderFunction !== 'function') {
      throw new Error('renderFunction must be a function');
    }

    this.viewName = viewName || '';
    this.renderFunction = renderFunction;
    this.__helpers = new HelperMap();
    this.__eventMaps = [];
    this._callbacks = {
      created: [],
      rendered: [],
      destroyed: [],
    };
  }

  /**
   * Register a callback for when an instance of this template is created.
   *
   * @param cb - The callback function.
   */
  onCreated(cb: () => void): void {
    this._callbacks.created.push(cb);
  }

  /**
   * Register a callback for when an instance of this template is inserted into the DOM.
   *
   * @param cb - The callback function.
   */
  onRendered(cb: () => void): void {
    this._callbacks.rendered.push(cb);
  }

  /**
   * Register a callback for when an instance of this template is destroyed.
   *
   * @param cb - The callback function.
   */
  onDestroyed(cb: () => void): void {
    this._callbacks.destroyed.push(cb);
  }

  _getCallbacks(which: 'created' | 'rendered' | 'destroyed'): (() => void)[] {
    const self = this as unknown as Record<string, unknown>;
    let callbacks: (() => void)[] = self[which] ? [self[which] as () => void] : [];
    callbacks = callbacks.concat(this._callbacks[which]);
    return callbacks;
  }

  /**
   * Construct a View for this template.
   *
   * @param contentFunc - Optional content block function.
   * @param elseFunc - Optional else block function.
   * @returns The constructed View.
   */
  constructView(contentFunc?: () => unknown, elseFunc?: () => unknown): View {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this;
    const view = new View(self.viewName, self.renderFunction);
    view.template = self as unknown as View['template'];

    view.templateContentBlock = contentFunc
      ? (new Template('(contentBlock)', contentFunc) as unknown as View['templateContentBlock'])
      : null;
    view.templateElseBlock = elseFunc
      ? (new Template('(elseBlock)', elseFunc) as unknown as View['templateElseBlock'])
      : null;

    if (self.__eventMaps || typeof (self as Record<string, unknown>).events === 'object') {
      view._onViewRendered(function () {
        if (view.renderCount !== 1) return;

        if (
          !self.__eventMaps.length &&
          typeof (self as Record<string, unknown>).events === 'object'
        ) {
          Template.prototype.events.call(
            self,
            (self as Record<string, unknown>).events as Record<
              string,
              (...args: unknown[]) => void
            >,
          );
        }

        self.__eventMaps.forEach((m) => {
          _addEventMap(view, m, view);
        });
      });
    }

    view._templateInstance = new TemplateInstance(view);
    view.templateInstance = function () {
      const inst = view._templateInstance as TemplateInstance;
      inst.data = getData(view);

      if (view._domrange && !view.isDestroyed) {
        inst.firstNode = view._domrange.firstNode();
        inst.lastNode = view._domrange.lastNode();
      } else {
        inst.firstNode = null;
        inst.lastNode = null;
      }

      return inst;
    };

    const createdCallbacks = self._getCallbacks('created');
    view.onViewCreated(function () {
      _fireTemplateCallbacks(createdCallbacks, (view.templateInstance as () => TemplateInstance)());
    });

    const renderedCallbacks = self._getCallbacks('rendered');
    view.onViewReady(function () {
      _fireTemplateCallbacks(
        renderedCallbacks,
        (view.templateInstance as () => TemplateInstance)(),
      );
    });

    const destroyedCallbacks = self._getCallbacks('destroyed');
    view.onViewDestroyed(function () {
      _fireTemplateCallbacks(
        destroyedCallbacks,
        (view.templateInstance as () => TemplateInstance)(),
      );
    });

    return view;
  }

  /**
   * Specify template helpers available to this template.
   *
   * @param dict - Dictionary of helper functions by name.
   */
  helpers(dict: Record<string, unknown>): void {
    if (typeof dict !== 'object' || dict === null) {
      throw new Error('Helpers dictionary has to be an object');
    }
    for (const k in dict) {
      this.__helpers.set(k, dict[k]);
    }
  }

  /**
   * Specify event handlers for this template.
   *
   * @param eventMap - Event handlers to associate with this template.
   */
  events(eventMap: Record<string, (...args: unknown[]) => void>): void {
    if (typeof eventMap !== 'object' || eventMap === null) {
      throw new Error('Event map has to be an object');
    }

    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const template = this;
    const eventMap2: Record<string, (...args: unknown[]) => void> = {};

    for (const k in eventMap) {
      eventMap2[k] = (function (_evKey, handler) {
        return function (this: View, ...args: unknown[]) {
          // eslint-disable-next-line @typescript-eslint/no-this-alias
          const view = this;
          const evt = args[0] as { currentTarget?: Element };
          const reactive = _getReactiveSystem();

          return reactive.nonReactive(() => {
            let data = getData(evt.currentTarget as Element);
            if (data == null) data = {};
            const tmplInstanceFunc = _bind(view.templateInstance!, view) as () => TemplateInstance;
            args.splice(1, 0, tmplInstanceFunc());
            return Template._withTemplateInstanceFunc(tmplInstanceFunc, () => {
              return handler.apply(data as object, args);
            });
          });
        };
      })(k, eventMap[k]!);
    }

    template.__eventMaps.push(eventMap2);
  }

  /**
   * Run a function with a given template instance function set as current.
   *
   * @param templateInstanceFunc - The template instance function.
   * @param fn - The function to execute.
   * @returns The return value of fn.
   */
  static _withTemplateInstanceFunc<T>(
    templateInstanceFunc: (() => TemplateInstance) | null,
    fn: () => T,
  ): T {
    if (typeof fn !== 'function') {
      throw new Error('Expected function, got: ' + fn);
    }
    const old = Template._currentTemplateInstanceFunc;
    try {
      Template._currentTemplateInstanceFunc = templateInstanceFunc;
      return fn();
    } finally {
      Template._currentTemplateInstanceFunc = old;
    }
  }

  /**
   * Get the current template instance.
   *
   * @returns The current template instance, or null.
   */
  static instance(): TemplateInstance | null {
    return (
      (Template._currentTemplateInstanceFunc && Template._currentTemplateInstanceFunc()) || null
    );
  }

  /** Alias for Blaze.getData. */
  static currentData = getData;

  /** Alias for Blaze._parentData. */
  static parentData = _parentData;

  /** Placeholder — set by lookup module. */
  static registerHelper: (name: string, func: unknown) => void;

  /** Placeholder — set by lookup module. */
  static deregisterHelper: (name: string) => void;
}

// ─── TemplateInstance ──────────────────────────────────────────────────────

/**
 * The class for template instances. Provides access to the view, data,
 * first/last nodes, and subscription management.
 */
export class TemplateInstance {
  view: View;
  data: unknown = null;
  firstNode: Node | null = null;
  lastNode: Node | null = null;
  _allSubsReadyDep: { depend(): void; changed(): void };
  _allSubsReady = false;
  _subscriptionHandles: Record<string, { subscriptionId: string; ready(): boolean; stop(): void }> =
    {};

  constructor(view: View) {
    if (!(view instanceof View)) {
      throw new Error('View required');
    }
    view._templateInstance = this;
    this.view = view;

    const reactive = _getReactiveSystem();
    this._allSubsReadyDep = reactive.Dependency();
  }

  /**
   * Find all elements matching selector in this template instance.
   *
   * @param selector - CSS selector, scoped to template contents.
   * @returns Array of matching elements.
   */
  $(selector: string): Element[] {
    const view = this.view;
    if (!view._domrange) {
      throw new Error("Can't use $ on template instance with no DOM");
    }
    return view._domrange.$(selector);
  }

  /**
   * Find all elements matching selector.
   *
   * @param selector - CSS selector.
   * @returns Array of matching elements.
   */
  findAll(selector: string): Element[] {
    return Array.prototype.slice.call(this.$(selector));
  }

  /**
   * Find one element matching selector.
   *
   * @param selector - CSS selector.
   * @returns The first matching element, or null.
   */
  find(selector: string): Element | null {
    const result = this.$(selector);
    return result[0] || null;
  }

  /**
   * A version of autorun that is stopped when the template is destroyed.
   *
   * @param f - The reactive function.
   * @returns A Computation handle.
   */
  autorun(f: (...args: unknown[]) => void): ReturnType<View['autorun']> {
    return this.view.autorun(f as (c: Computation) => void);
  }

  /**
   * Check whether all subscriptions on this template instance are ready.
   *
   * @returns True if all subscriptions are ready.
   */
  subscriptionsReady(): boolean {
    this._allSubsReadyDep.depend();
    this._allSubsReady = Object.values(this._subscriptionHandles).every((handle) => handle.ready());
    return this._allSubsReady;
  }
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function _fireTemplateCallbacks(callbacks: (() => void)[], template: TemplateInstance): void {
  Template._withTemplateInstanceFunc(
    () => template,
    () => {
      for (let i = 0, N = callbacks.length; i < N; i++) {
        callbacks[i]!.call(template);
      }
    },
  );
}

/**
 * Returns true if `value` is a template object.
 *
 * @param t - The value to test.
 * @returns True if `t` is a Template instance.
 */
export function isTemplate(t: unknown): t is Template {
  return t instanceof Template;
}

// ─── Register Template class with view module ──────────────────────────────

_setTemplateClass(Template as unknown as TemplateConstructor);
