/**
 * Lookup — helper, binding, and data context resolution.
 *
 * Implements the Spacebars lookup chain:
 *  1. Template helper
 *  2. Lexical binding ({{#let}}, {{#each item in items}})
 *  3. Template by name
 *  4. Global helper
 *  5. Data context property
 */

import {
  View,
  currentView,
  _withCurrentView,
  getData,
  _parentData,
  _getReactiveSystem,
} from './view';
import { Template } from './template';
import { _bind, _warn } from './preamble';
import { _wrapCatchingExceptions } from './exceptions';
import type { Binding, ReactiveVar } from './types';

// ─── Bindings helpers ──────────────────────────────────────────────────────

type BindingChecker = (binding: Binding) => boolean;

function _createBindingsHelper(fn: BindingChecker): (...names: unknown[]) => boolean {
  return (...names: unknown[]) => {
    const view = currentView;
    if (!view) throw new Error('No current view');

    // Zero args: check all bindings. Otherwise, strip the trailing hash arg.
    const nameList: string[] =
      names.length === 0 ? Object.keys(view._scopeBindings) : (names.slice(0, -1) as string[]);

    return nameList.some((name) => {
      const binding = _lexicalBindingLookupInternal(view, name);
      if (!binding) {
        throw new Error(`Binding for "${name}" was not found.`);
      }
      return fn(binding.get());
    });
  };
}

// ─── Global helpers ────────────────────────────────────────────────────────

export const _globalHelpers: Record<string, unknown> = {
  '@pending': _createBindingsHelper((binding) => binding === undefined),
  '@rejected': _createBindingsHelper(
    (binding) => !!binding && typeof binding === 'object' && 'error' in binding,
  ),
  '@resolved': _createBindingsHelper(
    (binding) => !!binding && typeof binding === 'object' && 'value' in binding,
  ),
};

/**
 * Register a global helper function.
 *
 * @param name - The helper name.
 * @param func - The helper function.
 */
export function registerHelper(name: string, func: unknown): void {
  _globalHelpers[name] = func;
}

/**
 * Deregister a global helper function.
 *
 * @param name - The helper name to remove.
 */
export function deregisterHelper(name: string): void {
  delete _globalHelpers[name];
}

// ─── Binding helpers ───────────────────────────────────────────────────────

function bindDataContext(x: unknown): unknown {
  if (typeof x === 'function') {
    return function (this: unknown, ...args: unknown[]) {
      let data = getData();
      if (data == null) data = {};
      return (x as (...a: unknown[]) => unknown).apply(data, args);
    };
  }
  return x;
}

// Sentinel for old-style helpers
export const _OLDSTYLE_HELPER = {};

/**
 * Retrieve a helper from a template's helper map.
 *
 * @param template - The template.
 * @param name - The helper name.
 * @param tmplInstanceFunc - The template instance function.
 * @returns The helper, or null.
 */
export function _getTemplateHelper(
  template: Template,
  name: string,
  tmplInstanceFunc?: (() => unknown) | null,
): unknown {
  let isKnownOldStyleHelper = false;

  if (template.__helpers.has(name)) {
    const helper = template.__helpers.get(name);
    if (helper === _OLDSTYLE_HELPER) {
      isKnownOldStyleHelper = true;
    } else if (helper != null) {
      const printName = `${template.viewName} ${name}`;
      return wrapHelper(bindDataContext(helper), tmplInstanceFunc, printName);
    } else {
      return null;
    }
  }

  // Old-style helper (set directly on template instance)
  if (name in template) {
    if (!isKnownOldStyleHelper) {
      template.__helpers.set(name, _OLDSTYLE_HELPER);
      if (!template._NOWARN_OLDSTYLE_HELPERS) {
        _warn(
          'Assigning helper with `' +
            template.viewName +
            '.' +
            name +
            ' = ...` is deprecated.  Use `' +
            template.viewName +
            '.helpers(...)` instead.',
        );
      }
    }
    if ((template as Record<string, unknown>)[name] != null) {
      return wrapHelper(
        bindDataContext((template as Record<string, unknown>)[name]),
        tmplInstanceFunc,
      );
    }
  }

  return null;
}

function wrapHelper(
  f: unknown,
  templateFunc?: (() => unknown) | null,
  name = 'template helper',
): unknown {
  if (typeof f !== 'function') return f;

  return function (this: unknown, ...args: unknown[]) {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this;
    return Template._withTemplateInstanceFunc(
      // eslint-disable-next-line @typescript-eslint/consistent-type-imports
      (templateFunc as (() => import('./template').TemplateInstance) | null) ?? null,
      () => {
        return _wrapCatchingExceptions(f as (...a: unknown[]) => unknown, name).apply(self, args);
      },
    );
  };
}

// ─── Lexical binding lookup ────────────────────────────────────────────────

function _lexicalKeepGoing(currentView: View): View | undefined {
  if (!currentView.parentView) return undefined;
  if (!currentView.__startsNewLexicalScope) return currentView.parentView;
  if (currentView.parentView.__childDoesntStartNewLexicalScope) {
    return currentView.parentView;
  }
  if (
    currentView.parentView.name === 'with' &&
    currentView.parentView.parentView &&
    currentView.parentView.parentView.__childDoesntStartNewLexicalScope
  ) {
    return currentView.parentView;
  }
  return undefined;
}

function _lexicalBindingLookupInternal(view: View, name: string): ReactiveVar<Binding> | null {
  let current: View | undefined = view;
  do {
    if (Object.hasOwn(current._scopeBindings, name)) {
      return current._scopeBindings[name] ?? null;
    }
  } while ((current = _lexicalKeepGoing(current)));
  return null;
}

/**
 * Look up a lexical binding by name, walking up the view hierarchy.
 *
 * @param view - The view to start from.
 * @param name - The binding name.
 * @returns A function returning the binding value, or null.
 */
export function _lexicalBindingLookup(view: View, name: string): (() => unknown) | null {
  const binding = _lexicalBindingLookupInternal(view, name);
  return binding ? () => binding.get()?.value : null;
}

/**
 * Look up a template by name.
 *
 * @param name - The template name.
 * @param _templateInstance - Optional template instance for context.
 * @returns The template, or null.
 */
export function _getTemplate(name: string, _templateInstance?: unknown): Template | null {
  if (
    name in Template &&
    (Template as unknown as Record<string, unknown>)[name] instanceof Template
  ) {
    return (Template as unknown as Record<string, unknown>)[name] as Template;
  }
  return null;
}

/**
 * Get a global helper by name.
 *
 * @param name - The helper name.
 * @param templateInstance - Optional template instance function.
 * @returns The wrapped helper, or null.
 */
export function _getGlobalHelper(name: string, templateInstance?: unknown): unknown {
  if (_globalHelpers[name] != null) {
    const printName = `global helper ${name}`;
    return wrapHelper(
      bindDataContext(_globalHelpers[name]),
      templateInstance as (() => unknown) | null,
      printName,
    );
  }
  return null;
}

// ─── View.prototype.lookup ─────────────────────────────────────────────────

/**
 * Look up a name in the template scope. Implements the Spacebars lookup chain.
 *
 * @param name - The name to look up.
 * @param _options - Optional options.
 * @returns The resolved value or function.
 */
function viewLookup(this: View, name: string, _options?: { template?: boolean }): unknown {
  const template = this.template as Template | null;
  const lookupTemplate = _options && _options.template;
  let helper: unknown;
  let binding: unknown;
  let boundTmplInstance: (() => unknown) | undefined;
  let foundTemplate: Template | null;

  if (this.templateInstance) {
    boundTmplInstance = _bind(this.templateInstance, this) as () => unknown;
  }

  // 0. looking up parent data context with "../" syntax
  if (/^\./.test(name)) {
    if (!/^(\.)+$/.test(name)) {
      throw new Error('id starting with dot must be a series of dots');
    }
    return _parentData(name.length - 1, true);
  }

  // 1. look up a helper on the current template
  if (template && (helper = _getTemplateHelper(template, name, boundTmplInstance)) != null) {
    return helper;
  }

  // 2. look up a lexical binding
  if (template && (binding = _lexicalBindingLookup(currentView!, name)) != null) {
    return binding;
  }

  // 3. look up a template by name
  if (lookupTemplate && (foundTemplate = _getTemplate(name, boundTmplInstance)) != null) {
    return foundTemplate;
  }

  // 4. look up a global helper
  helper = _getGlobalHelper(name, boundTmplInstance);
  if (helper != null) {
    return helper;
  }

  // 5. look up in data context
  return function (...args: unknown[]) {
    const isCalledAsFunction = args.length > 0;
    const data = getData() as Record<string, unknown> | null;
    const x = data && data[name];
    if (!x) {
      if (lookupTemplate) {
        throw new Error('No such template: ' + name);
      } else if (isCalledAsFunction) {
        throw new Error('No such function: ' + name);
      } else if (name.charAt(0) === '@' && (x === null || x === undefined)) {
        throw new Error('Unsupported directive: ' + name);
      }
    }
    if (!data) return null;
    if (typeof x !== 'function') {
      if (isCalledAsFunction) {
        throw new Error("Can't call non-function: " + x);
      }
      return x;
    }
    return (x as (...a: unknown[]) => unknown).apply(data, args);
  };
}

// Patch onto View.prototype
View.prototype.lookup = viewLookup;

// Wire up Template static helpers
Template.registerHelper = registerHelper;
Template.deregisterHelper = deregisterHelper;
