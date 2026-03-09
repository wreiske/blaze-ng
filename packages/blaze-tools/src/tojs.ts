/**
 * JavaScript code generation from HTMLjs AST.
 *
 * Converts HTMLjs nodes (Tag, CharRef, Comment, Raw) to executable JavaScript
 * code strings that reconstruct the same HTML structure at runtime.
 */

import { Visitor, isArray, isNully, isTagEnsured, getSymbolName } from '@blaze-ng/htmljs';
import type { Attrs, Tag, CharRef, Comment, Raw } from '@blaze-ng/htmljs';

/** Interface for objects that can serialize themselves to JS code. */
interface HasToJS {
  toJS(visitor: ToJSVisitor): string;
}

const hasToJS = (x: unknown): x is HasToJS => !!x && typeof (x as HasToJS).toJS === 'function';

/**
 * Wraps raw JavaScript code to prevent escaping/serialization.
 *
 * When visited by ToJSVisitor, the raw code string is emitted as-is.
 * Can be called with or without `new`.
 */
export class EmitCode {
  value: string;

  constructor(value: string) {
    if (typeof value !== 'string') {
      throw new Error('EmitCode must be constructed with a string');
    }
    this.value = value;
  }

  /**
   * Return the raw code string when visited.
   *
   * @param _visitor - The visitor (ignored).
   * @returns The raw JavaScript code.
   */
  toJS(_visitor: ToJSVisitor): string {
    return this.value;
  }
}

/**
 * Convert any JSON-compatible value to a JavaScript literal string.
 *
 * Escapes Unicode line/paragraph separators and surrogates that are valid
 * in JSON but can cause issues in JavaScript source.
 *
 * @param obj - Any JSON-compatible value.
 * @returns A safe JavaScript literal string.
 */
export function toJSLiteral(obj: unknown): string {
  return JSON.stringify(obj).replace(/[\u2028\u2029\ud800-\udfff]/g, (c) => {
    return '\\u' + ('000' + c.charCodeAt(0).toString(16)).slice(-4);
  });
}

// ES3 reserved words — keys that must be quoted in object literals
const jsReservedWordSet: Record<string, 1> = {};
'abstract else instanceof super boolean enum int switch break export interface synchronized byte extends let this case false long throw catch final native throws char finally new transient class float null true const for package try continue function private typeof debugger goto protected var default if public void delete implements return volatile do import short while double in static with'
  .split(' ')
  .forEach((w) => {
    jsReservedWordSet[w] = 1;
  });

const VALID_IDENT_RE = /^[a-zA-Z$_][a-zA-Z$0-9_]*$/;

/**
 * Format a string as a JavaScript object literal key.
 *
 * Returns the key unquoted if it's a valid non-reserved identifier,
 * otherwise returns it as a quoted string literal.
 *
 * @param k - The property name.
 * @returns The formatted key string.
 */
export function toObjectLiteralKey(k: string): string {
  if (VALID_IDENT_RE.test(k) && jsReservedWordSet[k] !== 1) return k;
  return toJSLiteral(k);
}

/**
 * Visitor that converts HTMLjs AST nodes to JavaScript code strings.
 *
 * The generated code, when evaluated, recreates the same HTML structure
 * using HTML.* constructors from @blaze-ng/htmljs.
 */
export class ToJSVisitor extends Visitor {
  override visitNull(_nullOrUndefined: unknown): string {
    return 'null';
  }

  override visitPrimitive(value: string | boolean | number): string {
    return toJSLiteral(value);
  }

  override visitArray(array: unknown[]): string {
    const parts: string[] = [];
    for (let i = 0; i < array.length; i++) {
      parts.push(this.visit(array[i]) as string);
    }
    return '[' + parts.join(', ') + ']';
  }

  override visitTag(tag: Tag): string {
    return this.generateCall(tag.tagName, tag.attrs, tag.children);
  }

  override visitComment(comment: Comment): string {
    return this.generateCall('HTML.Comment', null, [comment.value]);
  }

  override visitCharRef(charRef: CharRef): string {
    return this.generateCall('HTML.CharRef', { html: charRef.html, str: charRef.str }, undefined);
  }

  override visitRaw(raw: Raw): string {
    return this.generateCall('HTML.Raw', null, [raw.value]);
  }

  override visitObject(x: unknown): string {
    if (hasToJS(x)) {
      return x.toJS(this);
    }
    throw new Error('Unexpected object in HTMLjs in toJS: ' + x);
  }

  /**
   * Generate a JavaScript function call expression.
   *
   * @param name - The tag/function name (e.g. 'p', 'HTML.Comment').
   * @param attrs - Attributes dictionary, array of dicts, or null.
   * @param children - Child nodes array or undefined.
   * @returns JavaScript call expression string.
   */
  generateCall(
    name: string,
    attrs: Attrs | Attrs[] | Record<string, unknown> | null | undefined,
    children: unknown[] | undefined,
  ): string {
    let tagSymbol: string;
    if (name.indexOf('.') >= 0) {
      tagSymbol = name;
    } else if (isTagEnsured(name)) {
      tagSymbol = 'HTML.' + getSymbolName(name);
    } else {
      tagSymbol = 'HTML.getTag(' + toJSLiteral(name) + ')';
    }

    let attrsArray: string[] | null = null;
    let needsHTMLAttrs = false;
    if (attrs) {
      attrsArray = [];
      if (isArray(attrs)) {
        for (let i = 0; i < (attrs as unknown[]).length; i++) {
          const a = (attrs as unknown[])[i];
          if (hasToJS(a)) {
            attrsArray.push(a.toJS(this));
            needsHTMLAttrs = true;
          } else {
            const attrsObjStr = this.generateAttrsDictionary(a as Record<string, unknown>);
            if (attrsObjStr !== null) attrsArray.push(attrsObjStr);
          }
        }
      } else if (hasToJS(attrs)) {
        attrsArray.push(attrs.toJS(this));
        needsHTMLAttrs = true;
      } else {
        attrsArray.push(this.generateAttrsDictionary(attrs as Record<string, unknown>));
      }
    }

    let attrsStr: string | null = null;
    if (attrsArray && attrsArray.length) {
      if (attrsArray.length === 1 && !needsHTMLAttrs) {
        attrsStr = attrsArray[0]!;
      } else {
        attrsStr = 'HTML.Attrs(' + attrsArray.join(', ') + ')';
      }
    }

    const argStrs: string[] = [];
    if (attrsStr !== null) argStrs.push(attrsStr);

    if (children) {
      for (let i = 0; i < children.length; i++) {
        argStrs.push(this.visit(children[i]) as string);
      }
    }

    return tagSymbol + '(' + argStrs.join(', ') + ')';
  }

  /**
   * Generate a JavaScript object literal from an attributes dictionary.
   *
   * @param attrsDict - Plain object with attribute key/value pairs.
   * @returns Object literal string, or null if all values are nully.
   */
  generateAttrsDictionary(attrsDict: Record<string, unknown>): string {
    if (hasToJS(attrsDict)) {
      return (attrsDict as unknown as HasToJS).toJS(this);
    }

    const kvStrs: string[] = [];
    for (const k in attrsDict) {
      if (!isNully(attrsDict[k])) {
        kvStrs.push(toObjectLiteralKey(k) + ': ' + (this.visit(attrsDict[k]) as string));
      }
    }
    if (kvStrs.length) return '{' + kvStrs.join(', ') + '}';
    return null as unknown as string;
  }
}

// Reuse a singleton since ToJSVisitor is stateless
const _toJSVisitor = new ToJSVisitor();

/**
 * Convert HTMLjs content to executable JavaScript code.
 *
 * @param content - Any HTMLjs node or tree.
 * @returns JavaScript code string that reconstructs the content.
 */
export function toJS(content: unknown): string {
  return _toJSVisitor.visit(content) as string;
}
