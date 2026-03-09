import {
  CharRef,
  Comment as HtmlComment,
  isArray,
  isVoidElement,
  isKnownSVGElement,
  getTag,
  AttrsWrapper,
  AttrsFn,
  TEXTMODE,
} from '@blaze-ng/htmljs';
import type { HTMLNode } from '@blaze-ng/htmljs';
import { Scanner } from './scanner';
import { properCaseAttributeName } from './utils';
import { getHTMLToken, isLookingAtEndTag } from './tokenize';
import type { AttrsDict, TagAttrs } from './types';

/** Options for parseFragment. */
export interface ParseOptions {
  getTemplateTag?: (scanner: Scanner, position: number) => unknown | null;
  shouldStop?: (scanner: Scanner) => boolean;
  textMode?: number;
}

/**
 * Parse a fragment of HTML into an HTMLjs AST.
 *
 * @param input - HTML string or a Scanner instance.
 * @param options - Parse options (template tag hook, stop predicate, text mode).
 * @returns An HTMLjs node, array of nodes, string, or null.
 */
export function parseFragment(input: string | Scanner, options?: ParseOptions): HTMLNode | null {
  let scanner: Scanner;
  if (typeof input === 'string') scanner = new Scanner(input);
  else scanner = input;

  if (options?.getTemplateTag) scanner.getTemplateTag = options.getTemplateTag;

  const shouldStop = options?.shouldStop;

  let result: HTMLNode | null;
  if (options?.textMode) {
    if (options.textMode === TEXTMODE.STRING) {
      result = getRawText(scanner, undefined, shouldStop);
    } else if (options.textMode === TEXTMODE.RCDATA) {
      result = getRCData(scanner, undefined, shouldStop);
    } else {
      throw new Error('Unsupported textMode: ' + options.textMode);
    }
  } else {
    result = getContent(scanner, shouldStop);
  }

  if (!scanner.isEOF()) {
    const posBefore = scanner.pos;

    let endTag: ReturnType<typeof getHTMLToken> | undefined;
    try {
      endTag = getHTMLToken(scanner) ?? undefined;
    } catch {
      // ignore errors from getTemplateTag
    }

    if (endTag && endTag.t === 'Tag' && endTag.isEnd) {
      const closeTag = endTag.n;
      const isVoid = isVoidElement(closeTag);
      scanner.fatal(
        'Unexpected HTML close tag' +
          (isVoid ? '.  <' + endTag.n + '> should have no close tag.' : ''),
      );
    }

    scanner.pos = posBefore;

    if (!shouldStop) scanner.fatal('Expected EOF');
  }

  return result;
}

/**
 * Encode a Unicode code point as a JS string.
 * Handles surrogate pairs for code points above U+FFFF.
 *
 * @param cp - Unicode code point.
 * @returns The character(s) as a string.
 */
export function codePointToString(cp: number): string {
  if ((cp >= 0 && cp <= 0xd7ff) || (cp >= 0xe000 && cp <= 0xffff)) {
    return String.fromCharCode(cp);
  } else if (cp >= 0x10000 && cp <= 0x10ffff) {
    cp -= 0x10000;
    const first = ((0xffc00 & cp) >> 10) + 0xd800;
    const second = (0x3ff & cp) + 0xdc00;
    return String.fromCharCode(first) + String.fromCharCode(second);
  }
  return '';
}

/**
 * Parse HTML content tokens into an HTMLjs AST.
 *
 * @param scanner - Input scanner.
 * @param shouldStopFunc - Optional predicate to stop parsing early.
 * @returns HTMLjs nodes (string, array, Tag, etc.) or null.
 */
export function getContent(
  scanner: Scanner,
  shouldStopFunc?: (scanner: Scanner) => boolean,
): HTMLNode | null {
  const items: unknown[] = [];

  while (!scanner.isEOF()) {
    if (shouldStopFunc && shouldStopFunc(scanner)) break;

    const posBefore = scanner.pos;
    const token = getHTMLToken(scanner);
    if (!token) continue;

    if (token.t === 'Doctype') {
      scanner.fatal('Unexpected Doctype');
    } else if (token.t === 'Chars') {
      pushOrAppendString(items, token.v);
    } else if (token.t === 'CharRef') {
      items.push(convertCharRef(token));
    } else if (token.t === 'Comment') {
      items.push(new HtmlComment(token.v));
    } else if (token.t === 'TemplateTag') {
      items.push(token.v);
    } else if (token.t === 'Tag') {
      if (token.isEnd) {
        scanner.pos = posBefore;
        break;
      }

      const tagName = token.n;
      const isVoid = isVoidElement(tagName);
      if (token.isSelfClosing) {
        if (!(isVoid || isKnownSVGElement(tagName) || tagName.indexOf(':') >= 0))
          scanner.fatal(
            'Only certain elements like BR, HR, IMG, etc. (and foreign elements like SVG) are allowed to self-close',
          );
      }

      // result of parseAttrs may be null
      let attrs: unknown = parseAttrs(token.attrs);
      // arrays need to be wrapped in HTML.Attrs(...)
      if (isArray(attrs)) attrs = AttrsFn(...(attrs as unknown[]));

      const tagFunc = getTag(tagName);
      if (isVoid || token.isSelfClosing) {
        items.push(attrs ? tagFunc(attrs) : tagFunc());
      } else {
        const looksLikeSelfClose = scanner.input.substr(scanner.pos - 2, 2) === '/>';

        let content: HTMLNode | null = null;
        if (token.n === 'textarea') {
          if (scanner.peek() === '\n') scanner.pos++;
          const textareaValue = getRCData(scanner, token.n, shouldStopFunc);
          if (textareaValue) {
            if (attrs instanceof AttrsWrapper) {
              attrs = AttrsFn.apply(null, [...attrs.value, { value: textareaValue }]);
            } else {
              attrs = (attrs || {}) as Record<string, unknown>;
              (attrs as Record<string, unknown>).value = textareaValue;
            }
          }
        } else if (token.n === 'script' || token.n === 'style') {
          content = getRawText(scanner, token.n, shouldStopFunc);
        } else {
          content = getContent(scanner, shouldStopFunc);
        }

        const endTagToken = getHTMLToken(scanner);

        if (
          !(
            endTagToken &&
            endTagToken.t === 'Tag' &&
            endTagToken.isEnd &&
            endTagToken.n === tagName
          )
        )
          scanner.fatal(
            'Expected "' +
              tagName +
              '" end tag' +
              (looksLikeSelfClose
                ? ' -- if the "<' +
                  token.n +
                  ' />" tag was supposed to self-close, try adding a space before the "/"'
                : ''),
          );

        // make `content` into an array suitable for applying tag constructor
        let contentArr: unknown[];
        if (content == null) contentArr = [];
        else if (!isArray(content)) contentArr = [content];
        else contentArr = content as unknown[];

        const args = attrs ? [attrs, ...contentArr] : contentArr;
        items.push(getTag(tagName)(...args));
      }
    } else {
      scanner.fatal('Unknown token type: ' + (token as { t: string }).t);
    }
  }

  if (items.length === 0) return null;
  else if (items.length === 1) return items[0] as HTMLNode;
  else return items as unknown as HTMLNode;
}

function pushOrAppendString(items: unknown[], str: string): void {
  if (items.length && typeof items[items.length - 1] === 'string')
    items[items.length - 1] = (items[items.length - 1] as string) + str;
  else items.push(str);
}

/**
 * Parse RCDATA content (e.g., within textarea).
 *
 * @param scanner - Input scanner.
 * @param tagName - The enclosing tag name (optional).
 * @param shouldStopFunc - Optional stop predicate.
 * @returns Content nodes or null.
 */
export function getRCData(
  scanner: Scanner,
  tagName?: string,
  shouldStopFunc?: (scanner: Scanner) => boolean,
): HTMLNode | null {
  const items: unknown[] = [];

  while (!scanner.isEOF()) {
    if (tagName && isLookingAtEndTag(scanner, tagName)) break;
    if (shouldStopFunc && shouldStopFunc(scanner)) break;

    const token = getHTMLToken(scanner, 'rcdata');
    if (!token) continue;

    if (token.t === 'Chars') {
      pushOrAppendString(items, token.v);
    } else if (token.t === 'CharRef') {
      items.push(convertCharRef(token));
    } else if (token.t === 'TemplateTag') {
      items.push(token.v);
    } else {
      scanner.fatal('Unknown or unexpected token type: ' + token.t);
    }
  }

  if (items.length === 0) return null;
  else if (items.length === 1) return items[0] as HTMLNode;
  else return items as unknown as HTMLNode;
}

function getRawText(
  scanner: Scanner,
  tagName?: string,
  shouldStopFunc?: (scanner: Scanner) => boolean,
): HTMLNode | null {
  const items: unknown[] = [];

  while (!scanner.isEOF()) {
    if (tagName && isLookingAtEndTag(scanner, tagName)) break;
    if (shouldStopFunc && shouldStopFunc(scanner)) break;

    const token = getHTMLToken(scanner, 'rawtext');
    if (!token) continue;

    if (token.t === 'Chars') {
      pushOrAppendString(items, token.v);
    } else if (token.t === 'TemplateTag') {
      items.push(token.v);
    } else {
      scanner.fatal('Unknown or unexpected token type: ' + token.t);
    }
  }

  if (items.length === 0) return null;
  else if (items.length === 1) return items[0] as HTMLNode;
  else return items as unknown as HTMLNode;
}

/** Convert a CharRef token to an HTMLjs CharRef node. */
function convertCharRef(token: { v: string; cp: number[] }): CharRef {
  let str = '';
  for (const cp of token.cp) str += codePointToString(cp);
  return new CharRef({ html: token.v, str });
}

/**
 * Parse tokenized attributes into HTMLjs format.
 *
 * @param attrs - Raw token attributes.
 * @returns null, a dict, or an array of dicts + template tags.
 */
function parseAttrs(attrs: TagAttrs | undefined): Record<string, unknown> | unknown[] | null {
  if (!attrs) return null;

  let result: Record<string, unknown> | unknown[] | null = null;

  if (isArray(attrs)) {
    const arr = attrs as unknown[];
    const nondynamicAttrs = parseAttrs(arr[0] as TagAttrs);
    if (nondynamicAttrs) {
      result = result || [];
      (result as unknown[]).push(nondynamicAttrs);
    }
    for (let i = 1; i < arr.length; i++) {
      const token = arr[i] as { t: string; v: unknown };
      if (token.t !== 'TemplateTag') throw new Error('Expected TemplateTag token');
      result = result || [];
      (result as unknown[]).push(token.v);
    }
    return result;
  }

  const dict = attrs as AttrsDict;
  for (const k of Object.keys(dict)) {
    if (!result) result = {};

    const inValue = dict[k]!;
    const outParts: unknown[] = [];
    for (const token of inValue) {
      if (token.t === 'CharRef') {
        outParts.push(convertCharRef(token));
      } else if (token.t === 'TemplateTag') {
        outParts.push(token.v);
      } else if (token.t === 'Chars') {
        pushOrAppendString(outParts, token.v);
      }
    }

    const outValue = inValue.length === 0 ? '' : outParts.length === 1 ? outParts[0] : outParts;
    const properKey = properCaseAttributeName(k);
    (result as Record<string, unknown>)[properKey] = outValue;
  }

  return result;
}
