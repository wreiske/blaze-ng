import { Tag } from './tag';
import { CharRef, Comment, Raw } from './nodes';
import { getTag, isVoidElement } from './elements';
import { isArray, flattenAttributes } from './utils';
import { isConstructedObject } from './tag';
import { TEXTMODE } from './types';
import type { TextMode } from './types';

const isPromiseLike = (x: unknown): boolean =>
  !!x && typeof (x as { then?: unknown }).then === 'function';

/**
 * Base class for HTMLjs tree visitors.
 *
 * Visitors dispatch on the type of each node (Tag, CharRef, Comment, Raw,
 * array, primitive, function, object). Subclasses override specific
 * `visit*` methods to implement custom behavior.
 */
export class Visitor {
  [key: string]: unknown;

  constructor(props?: Record<string, unknown>) {
    if (props) {
      Object.assign(this, props);
    }
  }

  /**
   * Visit any HTMLjs content node, dispatching to the appropriate handler.
   *
   * @param content - The node to visit.
   * @param args - Additional arguments passed through to handlers.
   * @returns The result of the handler.
   */
  visit(content: unknown, ...args: unknown[]): unknown {
    if (content == null) {
      return this.visitNull(content, ...args);
    }

    if (typeof content === 'object') {
      const typed = content as { htmljsType?: unknown };
      if (typed.htmljsType) {
        switch (typed.htmljsType) {
          case Tag.htmljsType:
            return this.visitTag(content as Tag, ...args);
          case CharRef.htmljsType:
            return this.visitCharRef(content as CharRef, ...args);
          case Comment.htmljsType:
            return this.visitComment(content as Comment, ...args);
          case Raw.htmljsType:
            return this.visitRaw(content as Raw, ...args);
          default:
            throw new Error('Unknown htmljs type: ' + typed.htmljsType);
        }
      }

      if (isArray(content)) {
        return this.visitArray(content, ...args);
      }

      return this.visitObject(content, ...args);
    } else if (
      typeof content === 'string' ||
      typeof content === 'boolean' ||
      typeof content === 'number'
    ) {
      return this.visitPrimitive(content, ...args);
    } else if (typeof content === 'function') {
      return this.visitFunction(content, ...args);
    }

    throw new Error('Unexpected object in htmljs: ' + content);
  }

  visitNull(_nullOrUndefined: unknown, ..._args: unknown[]): unknown {
    return undefined;
  }
  visitPrimitive(_value: string | boolean | number, ..._args: unknown[]): unknown {
    return undefined;
  }
  visitArray(_array: unknown[], ..._args: unknown[]): unknown {
    return undefined;
  }
  visitComment(_comment: Comment, ..._args: unknown[]): unknown {
    return undefined;
  }
  visitCharRef(_charRef: CharRef, ..._args: unknown[]): unknown {
    return undefined;
  }
  visitRaw(_raw: Raw, ..._args: unknown[]): unknown {
    return undefined;
  }
  visitTag(_tag: Tag, ..._args: unknown[]): unknown {
    return undefined;
  }
  visitObject(obj: unknown, ..._args: unknown[]): unknown {
    throw new Error('Unexpected object in htmljs: ' + obj);
  }
  visitFunction(fn: unknown, ..._args: unknown[]): unknown {
    throw new Error('Unexpected function in htmljs: ' + fn);
  }
}

/**
 * A visitor that transforms an HTMLjs tree, producing a new tree.
 *
 * By default, returns nodes unchanged (identity transform). Override
 * specific methods to transform particular node types. Uses copy-on-write
 * for arrays and tags to minimize allocations.
 */
export class TransformingVisitor extends Visitor {
  override visitNull(nullOrUndefined: unknown): unknown {
    return nullOrUndefined;
  }

  override visitPrimitive(value: string | boolean | number): unknown {
    return value;
  }

  override visitArray(array: unknown[], ...args: unknown[]): unknown {
    let result = array;
    for (let i = 0; i < array.length; i++) {
      const oldItem = array[i];
      const newItem = this.visit(oldItem, ...args);
      if (newItem !== oldItem) {
        // Copy-on-write
        if (result === array) result = array.slice();
        result[i] = newItem;
      }
    }
    return result;
  }

  override visitComment(comment: Comment): unknown {
    return comment;
  }

  override visitCharRef(charRef: CharRef): unknown {
    return charRef;
  }

  override visitRaw(raw: Raw): unknown {
    return raw;
  }

  override visitObject(obj: unknown, ...args: unknown[]): unknown {
    const o = obj as Record<string, unknown>;
    // Don't parse Markdown & RCData as HTML
    if (o.textMode != null) {
      return obj;
    }
    if ('content' in o) {
      o.content = this.visit(o.content, ...args);
    }
    if ('elseContent' in o) {
      o.elseContent = this.visit(o.elseContent, ...args);
    }
    return obj;
  }

  override visitFunction(fn: unknown): unknown {
    return fn;
  }

  override visitTag(tag: Tag, ...args: unknown[]): unknown {
    const oldChildren = tag.children;
    const newChildren = this.visitChildren(oldChildren, ...args);

    const oldAttrs = tag.attrs;
    const newAttrs = this.visitAttributes(oldAttrs, ...args);

    if (newAttrs === oldAttrs && newChildren === oldChildren) return tag;

    const newTag = getTag(tag.tagName)(...(newChildren as unknown[]));
    newTag.attrs = newAttrs as Tag['attrs'];
    return newTag;
  }

  visitChildren(children: unknown[], ...args: unknown[]): unknown {
    return this.visitArray(children, ...args);
  }

  visitAttributes(attrs: unknown, ...args: unknown[]): unknown {
    // Allow Promise-like values; handled in materializer
    if (isPromiseLike(attrs)) {
      return attrs;
    }

    if (isArray(attrs)) {
      let result = attrs;
      for (let i = 0; i < attrs.length; i++) {
        const oldItem = attrs[i];
        const newItem = this.visitAttributes(oldItem, ...args);
        if (newItem !== oldItem) {
          if (result === attrs) result = attrs.slice();
          result[i] = newItem;
        }
      }
      return result;
    }

    if (attrs && isConstructedObject(attrs)) {
      throw new Error(
        'The basic TransformingVisitor does not support ' +
          'foreign objects in attributes.  Define a custom ' +
          'visitAttributes for this case.',
      );
    }

    const oldAttrs = attrs as Record<string, unknown> | null;
    let newAttrs = oldAttrs;
    if (oldAttrs) {
      for (const k in oldAttrs) {
        const oldValue = oldAttrs[k];
        const newValue = this.visitAttribute(k, oldValue, attrs, ...args);
        if (newValue !== oldValue) {
          if (newAttrs === oldAttrs) newAttrs = { ...oldAttrs };
          newAttrs![k] = newValue;
        }
      }
    }

    return newAttrs;
  }

  visitAttribute(_name: string, value: unknown, _tag: unknown, ...args: unknown[]): unknown {
    return this.visit(value, ...args);
  }
}

/**
 * Visitor that converts HTMLjs to plain text.
 *
 * The text mode determines how entities and special characters are escaped.
 */
export class ToTextVisitor extends Visitor {
  textMode: TextMode = TEXTMODE.STRING;

  constructor(props?: Record<string, unknown>) {
    super(props);
    if (props && typeof props.textMode === 'number') {
      this.textMode = props.textMode as TextMode;
    }
  }

  override visitNull(): string {
    return '';
  }

  override visitPrimitive(value: string | boolean | number): string {
    const str = String(value);
    if (this.textMode === TEXTMODE.RCDATA) {
      return str.replace(/&/g, '&amp;').replace(/</g, '&lt;');
    } else if (this.textMode === TEXTMODE.ATTRIBUTE) {
      return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
    }
    return str;
  }

  override visitArray(array: unknown[]): string {
    const parts: string[] = [];
    for (let i = 0; i < array.length; i++) {
      parts.push(this.visit(array[i]) as string);
    }
    return parts.join('');
  }

  override visitComment(): string {
    throw new Error("Can't have a comment here");
  }

  override visitCharRef(charRef: CharRef): string {
    if (this.textMode === TEXTMODE.RCDATA || this.textMode === TEXTMODE.ATTRIBUTE) {
      return charRef.html;
    }
    return charRef.str;
  }

  override visitRaw(raw: Raw): string {
    return raw.value;
  }

  override visitTag(tag: Tag): string {
    return this.visit(toHTML(tag)) as string;
  }

  override visitObject(x: unknown): string {
    throw new Error('Unexpected object in htmljs in toText: ' + x);
  }
}

/**
 * Visitor that converts HTMLjs to an HTML string.
 */
export class ToHTMLVisitor extends Visitor {
  override visitNull(): string {
    return '';
  }

  override visitPrimitive(value: string | boolean | number): string {
    const str = String(value);
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  }

  override visitArray(array: unknown[]): string {
    const parts: string[] = [];
    for (let i = 0; i < array.length; i++) {
      parts.push(this.visit(array[i]) as string);
    }
    return parts.join('');
  }

  override visitComment(comment: Comment): string {
    return '<!--' + comment.sanitizedValue + '-->';
  }

  override visitCharRef(charRef: CharRef): string {
    return charRef.html;
  }

  override visitRaw(raw: Raw): string {
    return raw.value;
  }

  override visitTag(tag: Tag): string {
    const attrStrs: string[] = [];
    const tagName = tag.tagName;
    let children = tag.children;

    const rawAttrs = tag.attrs;
    if (rawAttrs) {
      const attrs = flattenAttributes(
        rawAttrs as Record<string, unknown> | Record<string, unknown>[],
      );
      if (attrs) {
        for (const k in attrs) {
          if (k === 'value' && tagName === 'textarea') {
            children = [attrs[k], ...children];
          } else {
            const v = toText(attrs[k], TEXTMODE.ATTRIBUTE);
            attrStrs.push(' ' + k + '="' + v + '"');
          }
        }
      }
    }

    const startTag = '<' + tagName + attrStrs.join('') + '>';

    const childStrs: string[] = [];
    let content: string;
    if (tagName === 'textarea') {
      for (let i = 0; i < children.length; i++) {
        childStrs.push(toText(children[i], TEXTMODE.RCDATA));
      }
      content = childStrs.join('');
      if (content.slice(0, 1) === '\n') {
        content = '\n' + content;
      }
    } else {
      for (let i = 0; i < children.length; i++) {
        childStrs.push(this.visit(children[i]) as string);
      }
      content = childStrs.join('');
    }

    let result = startTag + content;

    if (children.length || !isVoidElement(tagName)) {
      result += '</' + tagName + '>';
    }

    return result;
  }

  override visitObject(x: unknown): string {
    throw new Error('Unexpected object in htmljs in toHTML: ' + x);
  }
}

// ===== Top-level functions =====

/**
 * Convert HTMLjs content to an HTML string.
 *
 * @param content - The HTMLjs node(s) to convert.
 * @returns The HTML string.
 */
export function toHTML(content: unknown): string {
  return new ToHTMLVisitor().visit(content) as string;
}

/**
 * Convert HTMLjs content to plain text with the given escaping mode.
 *
 * @param content - The HTMLjs node(s) to convert.
 * @param textMode - The escaping mode (STRING, RCDATA, or ATTRIBUTE).
 * @returns The text string.
 * @throws If textMode is not provided or invalid.
 */
export function toText(content: unknown, textMode: TextMode): string {
  if (!textMode) {
    throw new Error('textMode required for HTML.toText');
  }
  if (
    textMode !== TEXTMODE.STRING &&
    textMode !== TEXTMODE.RCDATA &&
    textMode !== TEXTMODE.ATTRIBUTE
  ) {
    throw new Error('Unknown textMode: ' + textMode);
  }

  const visitor = new ToTextVisitor({ textMode });
  return visitor.visit(content) as string;
}
