/**
 * @blaze-ng/spacebars — Spacebars template runtime for Blaze-NG.
 *
 * Provides the runtime helpers that compiled Spacebars templates use:
 * - `include` — template/function inclusion with reactive template switching
 * - `mustache` / `attrMustache` / `dataMustache` — mustache expression evaluation
 * - `makeRaw` — triple-stache (unescaped HTML)
 * - `call` — function invocation with Promise support
 * - `dot` — safe property access with binding and Promise support
 * - `kw` — keyword arguments container
 * - `SafeString` — safe (unescaped) HTML string wrapper
 * - `With` — conditional data context ({{#with}})
 */

import {
  View,
  currentView,
  _withCurrentView,
  _reportExceptionAndThrow,
  _getReactiveSystem,
  isTemplate,
  If,
  With as BlazeWith,
} from '@blaze-ng/core';
import type { Template } from '@blaze-ng/core';
import { Raw, isValidAttributeName } from '@blaze-ng/htmljs';

// ─── Helpers ────────────────────────────────────────────────────────────────

const tripleEquals = (a: unknown, b: unknown): boolean => a === b;

/**
 * Check if a value is a thenable (Promise-like).
 *
 * @param x - The value to check.
 * @returns True if x has a `.then` method.
 */
function isPromiseLike(x: unknown): x is PromiseLike<unknown> {
  return !!x && typeof (x as PromiseLike<unknown>).then === 'function';
}

/**
 * Execute `fn` with the resolved value of `promise` while preserving
 * the current Blaze view context across the async boundary.
 *
 * @param promise - The promise to await.
 * @param fn - The function to call with the resolved value.
 * @returns A promise of the result of fn.
 */
function _thenWithContext<T, U>(promise: Promise<T>, fn: (x: T) => U): Promise<U> {
  const view = currentView;
  return promise.then(
    (value) => (view ? _withCurrentView(view, () => fn(value)) : fn(value)),
    _reportExceptionAndThrow,
  );
}

// ─── kw (keyword arguments) ────────────────────────────────────────────────

/**
 * Container for keyword arguments passed to Spacebars helpers.
 *
 * Created by compiled templates for `{{helper key=value}}` syntax.
 * The hash contains the key/value pairs.
 */
export class kw {
  /** The keyword argument hash. */
  hash: Record<string, unknown>;

  /**
   * @param hash - The keyword arguments object.
   */
  constructor(hash?: Record<string, unknown>) {
    this.hash = hash || {};
  }
}

// ─── SafeString ────────────────────────────────────────────────────────────

/**
 * Wrapper indicating that a string is safe HTML and should not be escaped.
 *
 * Equivalent to `Handlebars.SafeString` in the original Blaze.
 */
export class SafeString {
  private readonly _value: string;

  /**
   * @param html - The safe HTML string.
   */
  constructor(html: string) {
    this._value = html;
  }

  /**
   * Return the raw HTML string.
   *
   * @returns The safe HTML string.
   */
  toString(): string {
    return this._value;
  }
}

// ─── include ────────────────────────────────────────────────────────────────

/**
 * Include a template or reactive template function.
 *
 * If `templateOrFunction` is a Template, it is rendered directly.
 * If it is a function, the function is called reactively and its
 * return value (a Template) is rendered, re-rendering when the
 * function's reactive dependencies change.
 *
 * @param templateOrFunction - A Template, a reactive function returning a Template, or null.
 * @param contentFunc - Optional content block ({{> template}}...{{/template}}).
 * @param elseFunc - Optional else block.
 * @returns A View, or null if templateOrFunction is falsy.
 */
export function include(
  templateOrFunction: Template | (() => Template | null) | null | undefined,
  contentFunc?: () => unknown,
  elseFunc?: () => unknown,
): View | null {
  if (!templateOrFunction) return null;

  if (typeof templateOrFunction !== 'function') {
    const template = templateOrFunction;
    if (!isTemplate(template)) {
      throw new Error('Expected template or null, found: ' + template);
    }
    const view = template.constructView(contentFunc, elseFunc);
    (view as View & { __startsNewLexicalScope?: boolean }).__startsNewLexicalScope = true;
    return view;
  }

  const reactive = _getReactiveSystem();
  const templateVar = reactive.ReactiveVar<Template | null>(null, tripleEquals);
  const view = new View('Spacebars.include', () => {
    const template = templateVar.get();
    if (template === null) return null;

    if (!isTemplate(template)) {
      throw new Error('Expected template or null, found: ' + template);
    }

    return template.constructView(contentFunc, elseFunc);
  });
  (view as View & { __templateVar?: unknown }).__templateVar = templateVar;
  view.onViewCreated(function (this: View) {
    this.autorun(() => {
      templateVar.set((templateOrFunction as () => Template | null)());
    });
  });
  (view as View & { __startsNewLexicalScope?: boolean }).__startsNewLexicalScope = true;

  return view;
}

// ─── mustacheImpl ───────────────────────────────────────────────────────────

/**
 * Shared implementation for `mustache` and `attrMustache`.
 *
 * Evaluates keyword argument functions, then delegates to `call`.
 *
 * @param args - The positional and keyword arguments.
 * @returns The result of calling the first argument with the rest.
 */
function mustacheImpl(...args: unknown[]): unknown {
  if (args.length > 1) {
    let kwArg = args[args.length - 1];
    if (!(kwArg instanceof kw)) {
      kwArg = new kw();
      args.push(kwArg);
    } else {
      // Evaluate keyword arg functions
      const newHash: Record<string, unknown> = {};
      for (const k of Object.keys((kwArg as kw).hash)) {
        const v = (kwArg as kw).hash[k];
        newHash[k] = typeof v === 'function' ? (v as () => unknown)() : v;
      }
      args[args.length - 1] = new kw(newHash);
    }
  }

  return call(...args);
}

// ─── mustache ───────────────────────────────────────────────────────────────

/**
 * Evaluate a `{{mustache}}` expression.
 *
 * Calls `mustacheImpl` and post-processes:
 * - SafeString → HTML.Raw
 * - Promise → pass through
 * - null/undefined/false → null (for absent attributes)
 * - Everything else → String
 *
 * @param args - The mustache arguments (value, positional args, keyword args).
 * @returns The processed result.
 */
export function mustache(...args: unknown[]): unknown {
  const result = mustacheImpl(...args);

  if (result instanceof SafeString) return new Raw(result.toString());
  if (isPromiseLike(result)) return result;
  // Map null, undefined, and false to null (important for absent attributes).
  // Stringify everything else (strings, booleans, numbers including 0).
  return result == null || result === false ? null : String(result);
}

// ─── attrMustache ───────────────────────────────────────────────────────────

/**
 * Evaluate an attribute mustache expression.
 *
 * Returns null for empty results, passes through objects,
 * and converts valid attribute names to `{ name: '' }`.
 *
 * @param args - The mustache arguments.
 * @returns An attribute object, null, or throws.
 * @throws {Error} If the result is not a valid attribute name, object, or empty.
 */
export function attrMustache(...args: unknown[]): Record<string, unknown> | null {
  const result = mustacheImpl(...args);

  if (result == null || result === '') return null;
  if (typeof result === 'object') return result as Record<string, unknown>;
  if (typeof result === 'string' && isValidAttributeName(result)) {
    return { [result]: '' };
  }
  throw new Error("Expected valid attribute name, '', null, or object");
}

// ─── dataMustache ───────────────────────────────────────────────────────────

/**
 * Evaluate a data mustache expression (returns the raw value).
 *
 * @param args - The mustache arguments.
 * @returns The raw result without post-processing.
 */
export function dataMustache(...args: unknown[]): unknown {
  return mustacheImpl(...args);
}

// ─── makeRaw ────────────────────────────────────────────────────────────────

/**
 * Idempotently wrap a value in `HTML.Raw` for triple-stache `{{{...}}}`.
 *
 * @param value - The value to wrap.
 * @returns An HTML.Raw node, a Promise, or null.
 */
export function makeRaw(value: unknown): Raw | PromiseLike<unknown> | null {
  if (value == null) return null;
  if (value instanceof Raw || isPromiseLike(value)) return value;
  return new Raw(String(value));
}

// ─── call ───────────────────────────────────────────────────────────────────

/**
 * If `value` is a function, evaluate its args (calling them if they are
 * functions) and call it on them. Otherwise, return `value`.
 *
 * Supports Promise arguments — if any argument is a Promise, the call
 * returns a Promise that resolves when all arguments resolve.
 *
 * @param args - [value, arg1, arg2, ...] where value may be a function.
 * @returns The result of calling value, or value itself.
 * @throws {Error} If value is non-null/non-function but args are provided.
 */
export function call(...args: unknown[]): unknown {
  const [value] = args;
  if (typeof value === 'function') {
    const newArgs: unknown[] = [];
    let anyIsPromise = false;
    for (let i = 1; i < args.length; i++) {
      const arg = args[i];
      newArgs[i - 1] = typeof arg === 'function' ? (arg as () => unknown)() : arg;
      anyIsPromise = anyIsPromise || isPromiseLike(newArgs[i - 1]);
    }

    if (anyIsPromise) {
      return _thenWithContext(Promise.all(newArgs), (resolved) =>
        (value as (...a: unknown[]) => unknown).apply(null, resolved),
      );
    }

    return (value as (...a: unknown[]) => unknown).apply(null, newArgs);
  }

  if (value != null && args.length > 1) {
    throw new Error("Can't call non-function: " + value);
  }
  return value;
}

// ─── dot ────────────────────────────────────────────────────────────────────

/**
 * Safe property access: `dot(foo, "bar", "baz")` ≈ `foo.bar.baz`.
 *
 * Handles null safety, function evaluation, and binding:
 * - If `value` is falsy, returns it without indexing.
 * - If `value` is a function, calls it first.
 * - If the result property is a function, binds it to the parent object.
 * - If `value` is a Promise, chains access via `.then()`.
 * - Recurses for multiple property keys.
 *
 * @param args - [value, key1, key2, ...] for chained access.
 * @returns The accessed value, potentially bound.
 */
export function dot(...args: unknown[]): unknown {
  let [value, id1] = args;

  if (args.length > 2) {
    const argsForRecurse: unknown[] = [dot(value, id1), ...args.slice(2)];
    return dot(...argsForRecurse);
  }

  while (typeof value === 'function') value = (value as () => unknown)();

  if (!value) return value; // falsy, don't index

  if (isPromiseLike(value)) {
    return _thenWithContext(value as Promise<unknown>, (resolved) => dot(resolved, id1));
  }

  const result = (value as Record<string, unknown>)[id1 as string];
  if (typeof result !== 'function') return result;

  // Bind the function to its parent object.
  return (...fnArgs: unknown[]) => (result as (...a: unknown[]) => unknown).apply(value, fnArgs);
}

// ─── With ───────────────────────────────────────────────────────────────────

/**
 * Implement `{{#with argFunc}}...{{else}}...{{/with}}`.
 *
 * Combines a Blaze.If (to handle the falsy case / else block)
 * with a Blaze.With (to establish the data context in the truthy case).
 * The argument is evaluated reactively.
 *
 * @param argFunc - A reactive function returning the data context.
 * @param contentFunc - The content block render function.
 * @param elseFunc - Optional else block render function.
 * @returns A View representing the {{#with}} block.
 */
export function With(
  argFunc: () => unknown,
  contentFunc: () => unknown,
  elseFunc?: () => unknown,
): View {
  const reactive = _getReactiveSystem();
  const argVar = reactive.ReactiveVar<unknown>(undefined);
  const view = new View('Spacebars_with', () =>
    If(
      () => argVar.get(),
      () => BlazeWith(() => argVar.get(), contentFunc),
      elseFunc,
    ),
  );
  view.onViewCreated(function (this: View) {
    this.autorun(() => {
      argVar.set(argFunc());

      // Eagerly invalidate dependents of argVar when this autorun
      // re-runs, so that nested autoruns inside the #with body get
      // stopped sooner (before they can re-run with stale data).
      // NOTE: This is a hack that reaches into ReactiveVar internals
      // to access its dep. Not all reactive system implementations
      // expose this, so we guard with a check.
      const varAny = argVar as unknown as { dep?: { changed(): void } };
      if (varAny.dep) {
        reactive.onInvalidate(() => {
          varAny.dep!.changed();
        });
      }
    });
  });

  return view;
}

// ─── Namespace export ───────────────────────────────────────────────────────

/**
 * The Spacebars namespace, matching the original Blaze `Spacebars` API.
 */
export const Spacebars = {
  include,
  mustache,
  attrMustache,
  dataMustache,
  makeRaw,
  call,
  kw,
  SafeString,
  dot,
  With,
};
