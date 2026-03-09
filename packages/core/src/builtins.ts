/**
 * Builtins — built-in reactive view constructors.
 *
 * Provides Blaze.With, Blaze.Let, Blaze.If, Blaze.Unless, Blaze.Each,
 * Blaze._Await, Blaze._TemplateWith, and Blaze._InOuterTemplateScope.
 */

import { HTML } from '@blaze-ng/htmljs';
import { ObserveSequence } from '@blaze-ng/observe-sequence';
import {
  View,
  currentView,
  _withCurrentView,
  _materializeView,
  _getReactiveSystem,
  _setTemplateWithFn,
} from './view';
import { Template } from './template';
import type { DOMRange } from './domrange';
import type { Binding, ReactiveVar } from './types';
import { _setMaterializerAwaitFn } from './materializer';

// ─── _calculateCondition ───────────────────────────────────────────────────

/**
 * Evaluate a condition value for If/Unless. Empty arrays are falsy.
 *
 * @param cond - The condition value.
 * @returns The boolean result.
 */
export function _calculateCondition(cond: unknown): boolean {
  if (HTML.isArray(cond) && (cond as unknown[]).length === 0) return false;
  return !!cond;
}

// ─── Binding helpers ───────────────────────────────────────────────────────

function _isEqualBinding(x: Binding, y: Binding): boolean {
  if (typeof x === 'object' && typeof y === 'object') {
    return (
      x !== undefined &&
      y !== undefined &&
      (x as { error?: unknown }).error === (y as { error?: unknown }).error &&
      _reactiveVarIsEqual((x as { value?: unknown }).value, (y as { value?: unknown }).value)
    );
  }
  return _reactiveVarIsEqual(x, y);
}

// Simple default equality — reference equality
function _reactiveVarIsEqual(a: unknown, b: unknown): boolean {
  return a === b;
}

function _identity<T>(x: T): T {
  return x;
}

function _setBindingValue<T, U>(
  reactiveVar: ReactiveVar<Binding>,
  value: T,
  mapper: (v: T) => U = _identity as (v: T) => U,
): void {
  if (value && typeof (value as { then?: unknown }).then === 'function') {
    (value as unknown as PromiseLike<T>).then(
      (v) => reactiveVar.set({ value: mapper(v) } as Binding),
      (error: unknown) => reactiveVar.set({ error } as Binding),
    );
  } else {
    reactiveVar.set({ value: mapper(value) } as Binding);
  }
}

function _createBinding<T>(
  view: View,
  binding: T | (() => T),
  displayName?: string,
  mapper?: (v: T) => unknown,
): ReactiveVar<Binding> {
  const reactive = _getReactiveSystem();
  const reactiveVar = reactive.ReactiveVar<Binding>(undefined, _isEqualBinding);

  if (typeof binding === 'function') {
    view.autorun(
      () => _setBindingValue(reactiveVar, (binding as () => T)(), mapper as (v: T) => unknown),
      view.parentView!,
      displayName,
    );
  } else {
    _setBindingValue(reactiveVar, binding, mapper as (v: T) => unknown);
  }

  return reactiveVar;
}

// ─── _attachBindingsToView ─────────────────────────────────────────────────

/**
 * Attach bindings to a view at creation time.
 *
 * @param bindings - Dictionary of binding names to values or functions.
 * @param view - The target view.
 */
export function _attachBindingsToView(bindings: Record<string, unknown>, view: View): void {
  view.onViewCreated(function () {
    Object.entries(bindings).forEach(([name, binding]) => {
      view._scopeBindings[name] = _createBinding(view, binding);
    });
  });
}

// ─── Blaze.With ────────────────────────────────────────────────────────────

/**
 * Construct a View that renders content with a data context.
 *
 * @param data - An object or function returning an object for the data context.
 * @param contentFunc - A function returning renderable content.
 * @returns A new View.
 */
export function With(data: unknown, contentFunc: () => unknown): View {
  const view = new View('with', contentFunc);

  view.dataVar = null as unknown as ReactiveVar<Binding>;
  view.onViewCreated(() => {
    view.dataVar = _createBinding(view, data as (() => unknown) | unknown, 'setData');
  });

  return view;
}

// ─── Blaze.Let ─────────────────────────────────────────────────────────────

/**
 * Construct a View setting local lexical scope bindings.
 *
 * @param bindings - Dictionary mapping names to values or reactive computations.
 * @param contentFunc - A function returning renderable content.
 * @returns A new View.
 */
export function Let(bindings: Record<string, unknown>, contentFunc: () => unknown): View {
  const view = new View('let', contentFunc);
  _attachBindingsToView(bindings, view);
  return view;
}

// ─── Blaze.If / Blaze.Unless ──────────────────────────────────────────────

/**
 * Construct a View that renders content conditionally.
 *
 * @param conditionFunc - A function to reactively evaluate.
 * @param contentFunc - Content to show when truthy.
 * @param elseFunc - Optional content to show when falsy.
 * @param _not - Internal flag for Unless.
 * @returns A new View.
 */
export function If(
  conditionFunc: () => unknown,
  contentFunc: () => unknown,
  elseFunc?: (() => unknown) | null,
  _not?: boolean,
): View {
  const view: View = new View(_not ? 'unless' : 'if', (): unknown => {
    const condition = view.__conditionVar!.get();
    if (condition && typeof condition === 'object' && 'value' in condition) {
      return (condition as { value: unknown }).value ? contentFunc() : elseFunc ? elseFunc() : null;
    }
    return null;
  });

  view.__conditionVar = null;
  view.onViewCreated(() => {
    view.__conditionVar = _createBinding(
      view,
      conditionFunc,
      'condition',
      (value: unknown) => !_calculateCondition(value) !== !_not,
    );
  });

  return view;
}

/**
 * An inverted Blaze.If.
 *
 * @param conditionFunc - A function to reactively evaluate.
 * @param contentFunc - Content to show when falsy.
 * @param elseFunc - Optional content to show when truthy.
 * @returns A new View.
 */
export function Unless(
  conditionFunc: () => unknown,
  contentFunc: () => unknown,
  elseFunc?: (() => unknown) | null,
): View {
  return If(conditionFunc, contentFunc, elseFunc, true);
}

// ─── Blaze.Each ────────────────────────────────────────────────────────────

/**
 * Construct a View that renders content for each item in a sequence.
 *
 * @param argFunc - A function returning a sequence (array, cursor, etc.).
 * @param contentFunc - Content function for each item.
 * @param elseFunc - Optional content when sequence is empty.
 * @returns A new View.
 */
export function Each(
  argFunc: () => unknown,
  contentFunc: () => unknown,
  elseFunc?: () => unknown,
): View {
  const eachView = new View('each', function (this: View) {
    const subviews = this.initialSubviews;
    this.initialSubviews = null;
    if (this._isCreatedForExpansion) {
      const reactive = _getReactiveSystem();
      this.expandedValueDep = reactive.Dependency();
      this.expandedValueDep.depend();
    }
    return subviews;
  });

  eachView.initialSubviews = [];
  eachView.numItems = 0;
  eachView.inElseMode = false;
  eachView.stopHandle = null;
  eachView.contentFunc = contentFunc;
  eachView.elseFunc = elseFunc;
  eachView.argVar = undefined;
  eachView.variableName = null;

  const updateIndices = (from: number, to?: number) => {
    if (to === undefined) {
      to = eachView.numItems! - 1;
    }
    for (let i = from; i <= to; i++) {
      const view = (eachView._domrange!.members[i]! as DOMRange).view!;
      view._scopeBindings['@index']!.set({ value: i });
    }
  };

  eachView.onViewCreated(function () {
    const reactive = _getReactiveSystem();

    eachView.argVar = _createBinding(
      eachView,
      () => {
        let maybeSequence = argFunc() as { _variable?: string; _sequence?: unknown } | unknown;
        if (
          typeof maybeSequence === 'object' &&
          maybeSequence !== null &&
          Object.hasOwn(maybeSequence as object, '_sequence')
        ) {
          eachView.variableName = (maybeSequence as { _variable?: string })._variable || null;
          maybeSequence = (maybeSequence as { _sequence?: unknown })._sequence;
        }
        return maybeSequence;
      },
      'collection',
    );

    eachView.stopHandle = ObserveSequence.observe(
      () => (eachView.argVar!.get() as { value?: unknown } | undefined)?.value as unknown[],
      {
        addedAt(_id: unknown, item: unknown, index: number) {
          reactive.nonReactive(() => {
            let newItemView: View;
            if (eachView.variableName) {
              newItemView = new View('item', eachView.contentFunc!);
            } else {
              newItemView = With(item, eachView.contentFunc!);
            }

            eachView.numItems!++;

            const bindings: Record<string, unknown> = { '@index': index };
            if (eachView.variableName) {
              bindings[eachView.variableName] = item;
            }
            _attachBindingsToView(bindings, newItemView);

            if (eachView.expandedValueDep) {
              eachView.expandedValueDep.changed();
            } else if (eachView._domrange) {
              if (eachView.inElseMode) {
                eachView._domrange.removeMember(0);
                eachView.inElseMode = false;
              }
              const range = _materializeView(newItemView, eachView)!;
              eachView._domrange.addMember(range, index);
              updateIndices(index);
            } else {
              eachView.initialSubviews!.splice(index, 0, newItemView);
            }
          });
        },
        removedAt(_id: unknown, _item: unknown, index: number) {
          reactive.nonReactive(() => {
            eachView.numItems!--;
            if (eachView.expandedValueDep) {
              eachView.expandedValueDep.changed();
            } else if (eachView._domrange) {
              eachView._domrange.removeMember(index);
              updateIndices(index);
              if (eachView.elseFunc && eachView.numItems === 0) {
                eachView.inElseMode = true;
                eachView._domrange.addMember(
                  _materializeView(new View('each_else', eachView.elseFunc), eachView)!,
                  0,
                );
              }
            } else {
              eachView.initialSubviews!.splice(index, 1);
            }
          });
        },
        changedAt(_id: unknown, newItem: unknown, _oldItem: unknown, index: number) {
          reactive.nonReactive(() => {
            if (eachView.expandedValueDep) {
              eachView.expandedValueDep.changed();
            } else {
              let itemView: View;
              if (eachView._domrange) {
                itemView = (eachView._domrange.getMember(index) as DOMRange).view!;
              } else {
                itemView = eachView.initialSubviews![index]!;
              }
              if (eachView.variableName) {
                itemView._scopeBindings[eachView.variableName]!.set({
                  value: newItem,
                });
              } else {
                itemView.dataVar!.set({ value: newItem });
              }
            }
          });
        },
        movedTo(_id: unknown, _item: unknown, fromIndex: number, toIndex: number) {
          reactive.nonReactive(() => {
            if (eachView.expandedValueDep) {
              eachView.expandedValueDep.changed();
            } else if (eachView._domrange) {
              eachView._domrange.moveMember(fromIndex, toIndex);
              updateIndices(Math.min(fromIndex, toIndex), Math.max(fromIndex, toIndex));
            } else {
              const subviews = eachView.initialSubviews!;
              const itemView = subviews[fromIndex]!;
              subviews.splice(fromIndex, 1);
              subviews.splice(toIndex, 0, itemView);
            }
          });
        },
      },
    );

    if (eachView.elseFunc && eachView.numItems === 0) {
      eachView.inElseMode = true;
      eachView.initialSubviews![0] = new View('each_else', eachView.elseFunc);
    }
  });

  eachView.onViewDestroyed(function () {
    if (eachView.stopHandle) eachView.stopHandle.stop();
  });

  return eachView;
}

// ─── Blaze._Await ──────────────────────────────────────────────────────────

function _AwaitContent(): unknown {
  return (currentView!._scopeBindings['value']!.get() as { value?: unknown } | undefined)?.value;
}

/**
 * Create a Blaze.Let view that unwraps a Promise.
 *
 * @param value - The value (possibly a Promise) to unwrap.
 * @returns A new View.
 */
export function _Await(value: unknown): View {
  return Let({ value }, _AwaitContent);
}

// Register _Await with materializer
_setMaterializerAwaitFn(_Await);

// ─── Blaze._TemplateWith ──────────────────────────────────────────────────

/**
 * Wrap a template inclusion with a data context.
 *
 * @param arg - The data argument (or function).
 * @param contentFunc - The content function.
 * @returns A new View.
 */
export function _TemplateWith(arg: unknown, contentFunc: () => unknown): View {
  // eslint-disable-next-line prefer-const
  let w: View;

  let argFunc = arg as () => unknown;
  if (typeof arg !== 'function') {
    argFunc = () => arg;
  }

  const wrappedArgFunc = () => {
    let viewToEvaluateArg: View | null = null;
    if (w.parentView && w.parentView.name === 'InOuterTemplateScope') {
      viewToEvaluateArg = w.parentView.originalParentView || null;
    }
    if (viewToEvaluateArg) {
      return _withCurrentView(viewToEvaluateArg, argFunc);
    }
    return argFunc();
  };

  const wrappedContentFunc = function (this: unknown) {
    let content = contentFunc.call(this);

    if (content instanceof Template) {
      content = content.constructView();
    }
    if (content instanceof View) {
      content._hasGeneratedParent = true;
    }

    return content;
  };

  w = With(wrappedArgFunc, wrappedContentFunc);
  w.__isTemplateWith = true;
  return w;
}

// Register _TemplateWith with view module
_setTemplateWithFn(_TemplateWith);

// ─── Blaze._InOuterTemplateScope ──────────────────────────────────────────

/**
 * Create a View that "escapes" the current template scope,
 * used for `{{> Template.contentBlock}}`.
 *
 * @param templateView - The template view to escape from.
 * @param contentFunc - The content function.
 * @returns A new View.
 */
export function _InOuterTemplateScope(templateView: View, contentFunc: () => unknown): View {
  const view = new View('InOuterTemplateScope', contentFunc);
  let parentView = templateView.parentView;

  if (parentView && parentView.__isTemplateWith) {
    parentView = parentView.parentView;
  }

  view.onViewCreated(function () {
    view.originalParentView = view.parentView!;
    view.parentView = parentView;
    view.__childDoesntStartNewLexicalScope = true;
  });

  return view;
}
