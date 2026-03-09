/**
 * Materializer — converts HTMLjs into DOM nodes and DOMRanges.
 *
 * This is the bridge between the reactive HTMLjs tree and the actual DOM.
 * Uses a work-stack approach to avoid deep recursion.
 */

import { HTML, type Tag } from '@blaze-ng/htmljs';
import { DOMRange } from './domrange';
import { DOMBackend } from './dombackend';
import {
  View,
  _materializeView,
  _expand,
  _expandAttributes,
  _toText,
  _getReactiveSystem,
  _setMaterializeDOMFn,
} from './view';
import { _bind } from './preamble';
import { _reportException, _reportExceptionAndThrow } from './exceptions';

// ─── Forward declarations for Template/Blaze._Await ───────────────────

let _TemplateClass: (new (...args: unknown[]) => { constructView(): View }) | null = null;
let _AwaitFn: ((value: unknown) => View) | null = null;

/**
 * Set the Template class reference for materializer.
 *
 * @param cls - The Template constructor.
 */
export function _setMaterializerTemplateClass(cls: typeof _TemplateClass): void {
  _TemplateClass = cls;
}

/**
 * Set the Blaze._Await reference for materializer.
 *
 * @param fn - The _Await function.
 */
export function _setMaterializerAwaitFn(fn: typeof _AwaitFn): void {
  _AwaitFn = fn;
}

// ─── Attribute handler forward reference ─────────────────────────────

let _ElementAttributesUpdaterClass:
  | (new (elem: Element) => {
      update(attrs: Record<string, string | null>): void;
    })
  | null = null;

/**
 * Set the ElementAttributesUpdater class.
 *
 * @param cls - The updater constructor.
 */
export function _setElementAttributesUpdater(cls: typeof _ElementAttributesUpdaterClass): void {
  _ElementAttributesUpdaterClass = cls;
}

// ─── _materializeDOM ─────────────────────────────────────────────────

type WorkStack = (() => void)[];

/**
 * Convert HTMLjs into DOM nodes and DOMRanges.
 *
 * @param htmljs - The HTMLjs to materialize.
 * @param intoArray - The output array of DOM nodes and DOMRanges.
 * @param parentView - The parent view context.
 * @param _existingWorkStack - Internal work stack for avoiding deep recursion.
 * @returns The intoArray.
 */
export function _materializeDOM(
  htmljs: unknown,
  intoArray: (DOMRange | Node)[],
  parentView?: View,
  _existingWorkStack?: WorkStack,
): (DOMRange | Node)[] {
  const workStack: WorkStack = _existingWorkStack || [];
  materializeDOMInner(htmljs, intoArray, parentView, workStack);

  if (!_existingWorkStack) {
    while (workStack.length) {
      const task = workStack.pop()!;
      task();
    }
  }

  return intoArray;
}

function isPromiseLike(x: unknown): x is PromiseLike<unknown> {
  return !!x && typeof (x as { then?: unknown }).then === 'function';
}

function then<T>(maybePromise: T | PromiseLike<T>, fn: (value: T) => void): void {
  if (isPromiseLike(maybePromise)) {
    (maybePromise as PromiseLike<T>).then(fn, _reportException as (reason: unknown) => void);
  } else {
    fn(maybePromise as T);
  }
}

function waitForAllAttributes(attrs: unknown): unknown {
  if (!attrs || attrs !== Object(attrs)) {
    return {};
  }

  if (Array.isArray(attrs)) {
    const mapped = attrs.map(waitForAllAttributes);
    return mapped.some(isPromiseLike) ? Promise.all(mapped) : mapped;
  }

  if (isPromiseLike(attrs)) {
    return (attrs as PromiseLike<unknown>).then(waitForAllAttributes, _reportExceptionAndThrow);
  }

  const obj = attrs as Record<string, unknown>;
  const promises: PromiseLike<void>[] = [];
  for (const [key, value] of Object.entries(obj)) {
    if (isPromiseLike(value)) {
      promises.push(
        (value as PromiseLike<unknown>).then((v) => {
          obj[key] = v;
        }, _reportExceptionAndThrow),
      );
    } else if (Array.isArray(value)) {
      value.forEach((element, index) => {
        if (isPromiseLike(element)) {
          promises.push(
            (element as PromiseLike<unknown>).then((el) => {
              value[index] = el;
            }, _reportExceptionAndThrow),
          );
        }
      });
    }
  }

  return promises.length
    ? Promise.all(promises).then(() => attrs, _reportExceptionAndThrow)
    : attrs;
}

function materializeDOMInner(
  htmljs: unknown,
  intoArray: (DOMRange | Node)[],
  parentView: View | undefined,
  workStack: WorkStack,
): void {
  if (htmljs == null) return;

  switch (typeof htmljs) {
    case 'string':
    case 'boolean':
    case 'number':
      intoArray.push(document.createTextNode(String(htmljs)));
      return;
    case 'object': {
      const obj = htmljs as {
        htmljsType?: unknown;
        str?: string;
        sanitizedValue?: string;
        value?: string;
        tagName?: string;
        attrs?: unknown;
        children?: unknown[];
      };
      if (obj.htmljsType) {
        switch (obj.htmljsType) {
          case HTML.Tag.htmljsType:
            intoArray.push(materializeTag(htmljs as Tag, parentView, workStack));
            return;
          case HTML.CharRef.htmljsType:
            intoArray.push(document.createTextNode(obj.str!));
            return;
          case HTML.Comment.htmljsType:
            intoArray.push(document.createComment(obj.sanitizedValue!));
            return;
          case HTML.Raw.htmljsType: {
            const nodes = DOMBackend.parseHTML(obj.value!);
            for (let i = 0; i < nodes.length; i++) {
              intoArray.push(nodes[i]!);
            }
            return;
          }
        }
      } else if (HTML.isArray(htmljs)) {
        const arr = htmljs as unknown[];
        for (let i = arr.length - 1; i >= 0; i--) {
          workStack.push(
            _bind(
              _materializeDOM as (...args: unknown[]) => unknown,
              null,
              arr[i],
              intoArray,
              parentView,
              workStack,
            ) as () => void,
          );
        }
        return;
      } else {
        let content: unknown = htmljs;
        if (isPromiseLike(content)) {
          content = _AwaitFn!(content);
        } else if (_TemplateClass && content instanceof _TemplateClass) {
          content = (content as { constructView(): View }).constructView();
        }

        if (content instanceof View) {
          _materializeView(content, parentView, workStack, intoArray);
          return;
        }
      }
    }
  }

  throw new Error('Unexpected object in htmljs: ' + htmljs);
}

function isSVGAnchor(node: Tag): boolean {
  return (
    node.tagName === 'a' &&
    !!node.attrs &&
    (node.attrs as Record<string, unknown>)['xlink:href'] !== undefined
  );
}

function materializeTag(tag: Tag, parentView: View | undefined, workStack: WorkStack): Element {
  const tagName = tag.tagName;
  let elem: Element;

  if (
    (HTML.isKnownSVGElement(tagName) || isSVGAnchor(tag)) &&
    typeof document.createElementNS === 'function'
  ) {
    elem = document.createElementNS('http://www.w3.org/2000/svg', tagName);
  } else {
    elem = document.createElement(tagName);
  }

  let rawAttrs = tag.attrs;
  let children = tag.children;

  if (
    tagName === 'textarea' &&
    tag.children.length &&
    !(rawAttrs && 'value' in (rawAttrs as Record<string, unknown>))
  ) {
    if (typeof rawAttrs === 'function' || HTML.isArray(rawAttrs)) {
      throw new Error(
        "Can't have reactive children of TEXTAREA node; " + "use the 'value' attribute instead.",
      );
    }
    rawAttrs = Object.assign({}, (rawAttrs as Record<string, unknown>) || null);
    (rawAttrs as Record<string, unknown>).value = _expand(children, parentView);
    children = [];
  }

  if (rawAttrs) {
    const attrUpdater = new _ElementAttributesUpdaterClass!(elem);
    const updateAttributes = () => {
      const expandedAttrs = _expandAttributes(rawAttrs, parentView);
      then(waitForAllAttributes(expandedAttrs), (awaitedAttrs) => {
        const flattenedAttrs = HTML.flattenAttributes(awaitedAttrs as Record<string, unknown>);
        if (!flattenedAttrs) return;
        const stringAttrs: Record<string, string | null> = {};
        Object.keys(flattenedAttrs).forEach((attrName) => {
          if (flattenedAttrs[attrName] == null || flattenedAttrs[attrName] === false) {
            stringAttrs[attrName] = null;
          } else {
            stringAttrs[attrName] = _toText(
              flattenedAttrs[attrName],
              parentView,
              HTML.TEXTMODE.STRING,
            );
          }
        });
        attrUpdater.update(stringAttrs);
      });
    };

    let updaterComputation;
    if (parentView) {
      updaterComputation = parentView.autorun(updateAttributes, undefined, 'updater');
    } else {
      const reactive = _getReactiveSystem();
      updaterComputation = reactive.nonReactive(() => {
        return reactive.autorun(updateAttributes);
      });
    }
    DOMBackend.Teardown.onElementTeardown(elem, () => {
      updaterComputation.stop();
    });
  }

  if (children.length) {
    const childNodesAndRanges: (DOMRange | Node)[] = [];
    workStack.push(() => {
      for (let i = 0; i < childNodesAndRanges.length; i++) {
        const x = childNodesAndRanges[i]!;
        if (x instanceof DOMRange) {
          x.attach(elem);
        } else {
          elem.appendChild(x);
        }
      }
    });
    workStack.push(
      _bind(
        _materializeDOM as (...args: unknown[]) => unknown,
        null,
        children,
        childNodesAndRanges,
        parentView,
        workStack,
      ) as () => void,
    );
  }

  return elem;
}

// Register _materializeDOM with the view module
_setMaterializeDOMFn(_materializeDOM);
