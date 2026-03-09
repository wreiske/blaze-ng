import type { Attrs, TagArgs, TagConstructor, HtmljsType } from './types';

const FROZEN_EMPTY: readonly unknown[] = Object.freeze([]);

/**
 * Base class for all HTML tag nodes in the AST.
 *
 * Tag instances represent HTML elements with a tagName, optional attributes,
 * and children. Concrete tag types (HTML.P, HTML.DIV, etc.) are subclasses
 * created dynamically via `makeTagConstructor`.
 */
export class Tag {
  static readonly htmljsType: HtmljsType = ['Tag'];
  readonly htmljsType: HtmljsType = Tag.htmljsType;

  tagName = '';
  attrs: Attrs | Attrs[] | null = null;
  children: unknown[] = FROZEN_EMPTY as unknown as unknown[];
}

/**
 * Create a constructor function for a specific HTML tag name.
 *
 * The returned constructor can be called with or without `new`. The first
 * argument is treated as attributes if it's a plain object or an `AttrsWrapper`.
 * Remaining arguments become children.
 *
 * @param tagName - The HTML tag name (e.g. 'p', 'div').
 * @returns A constructor function for the tag.
 */
export function makeTagConstructor(tagName: string): TagConstructor {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const HTMLTag: any = function HTMLTag(this: unknown, ...args: TagArgs): Tag {
    // Work with or without `new`
    const instance: Tag = this instanceof Tag ? this : new (HTMLTag as TagConstructor)();

    let i = 0;
    const firstArg = args.length > 0 ? args[0] : undefined;
    if (firstArg && typeof firstArg === 'object') {
      if (!isConstructedObject(firstArg)) {
        // Plain JS object → treat as attributes dictionary
        instance.attrs = firstArg as Attrs;
        i++;
      } else if (firstArg instanceof AttrsWrapper) {
        const array = firstArg.value;
        if (array.length === 1) {
          instance.attrs = array[0] as Attrs;
        } else if (array.length > 1) {
          instance.attrs = array as Attrs[];
        }
        i++;
      }
    }

    // Only create a children array if there are actual children
    if (i < args.length) {
      instance.children = args.slice(i);
    }

    return instance;
  } as unknown as TagConstructor;

  HTMLTag.prototype = new Tag();
  HTMLTag.prototype.constructor = HTMLTag;
  HTMLTag.prototype.tagName = tagName;

  return HTMLTag;
}

/**
 * Wrapper to pass multiple attribute dictionaries to a tag.
 *
 * Used for implementing dynamic attributes where multiple attribute
 * sources need to be merged at render time.
 */
export class AttrsWrapper {
  value: unknown[];

  constructor(...args: unknown[]) {
    this.value = args;
  }
}

// Also support calling without `new` for backward compat
export function Attrs(...args: unknown[]): AttrsWrapper {
  return new AttrsWrapper(...args);
}

/**
 * Determine if a value is a "constructed object" (instance of a class)
 * as opposed to a plain object literal.
 *
 * Returns true for instances of classes (new Date, new MyClass(), etc.)
 * and false for plain objects ({}, {foo: 1}, {constructor: ...}).
 *
 * @param x - The value to check.
 * @returns True if x is an instance of a non-Object constructor.
 */
export function isConstructedObject(x: unknown): boolean {
  if (!x || typeof x !== 'object') return false;

  // Check if this is a plain object
  const proto = Object.getPrototypeOf(x);
  if (proto === null) return false; // Object.create(null)

  // Walk to the root prototype
  let root = proto;
  while (Object.getPrototypeOf(root) !== null) {
    root = Object.getPrototypeOf(root);
  }

  // If the direct prototype is the root, it's a plain object
  if (proto === root) return false;

  return (
    typeof (x as Record<string, unknown>).constructor === 'function' &&
    x instanceof ((x as Record<string, unknown>).constructor as new (...a: unknown[]) => unknown)
  );
}
