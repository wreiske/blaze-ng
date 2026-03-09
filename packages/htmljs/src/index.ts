/**
 * @blaze-ng/htmljs — HTML AST representation for Blaze-NG.
 *
 * Provides a typed tree representation of HTML content:
 * - `Tag` subclasses (HTML.P, HTML.DIV, etc.) for elements
 * - `CharRef` for character references (&amp;, etc.)
 * - `Comment` for HTML comments
 * - `Raw` for unescaped HTML strings
 * - Visitor pattern for tree traversal and transformation
 * - `toHTML()` and `toText()` for serialization
 *
 * @example
 * ```ts
 * import { HTML } from '@blaze-ng/htmljs';
 *
 * const node = HTML.P({ class: 'hello' }, 'world');
 * console.log(HTML.toHTML(node)); // '<p class="hello">world</p>'
 * ```
 */

// Re-export all types
export type {
  HtmljsType,
  HTMLNode,
  TagArgs,
  CharRefAttrs,
  TextMode,
  TagConstructor,
} from './types';
export { TEXTMODE } from './types';

// Core classes
export {
  Tag,
  makeTagConstructor,
  AttrsWrapper,
  Attrs as AttrsFn,
  isConstructedObject,
} from './tag';
export { CharRef, Comment, Raw } from './nodes';

// Element registry
export {
  HTMLTags,
  getTag,
  ensureTag,
  isTagEnsured,
  getSymbolName,
  knownHTMLElementNames,
  knownSVGElementNames,
  knownElementNames,
  voidElementNames,
  isKnownElement,
  isKnownSVGElement,
  isVoidElement,
} from './elements';

// Utilities
export { isArray, isNully, isValidAttributeName, flattenAttributes } from './utils';

// Visitors
export {
  Visitor,
  TransformingVisitor,
  ToHTMLVisitor,
  ToTextVisitor,
  toHTML,
  toText,
} from './visitors';

// Build the composite HTML namespace object (matches original Blaze API)
import {
  HTMLTags,
  getTag,
  ensureTag,
  isTagEnsured,
  getSymbolName,
  knownHTMLElementNames,
  knownSVGElementNames,
  knownElementNames,
  voidElementNames,
  isKnownElement,
  isKnownSVGElement,
  isVoidElement,
} from './elements';
import { Tag, isConstructedObject } from './tag';
import { CharRef, Comment, Raw } from './nodes';
import { isArray, isNully, isValidAttributeName, flattenAttributes } from './utils';
import {
  Visitor,
  TransformingVisitor,
  ToHTMLVisitor,
  ToTextVisitor,
  toHTML,
  toText,
} from './visitors';
import { TEXTMODE } from './types';
import { Attrs } from './tag';

// Re-export Attrs type from types.ts (attribute dictionary type)
export type { Attrs } from './types';

/**
 * The main HTML namespace object, matching the original Blaze `HTML` API.
 *
 * Contains all tag constructors (HTML.P, HTML.DIV, etc.) plus utility
 * functions and classes for working with the HTMLjs AST.
 */
export const HTML = Object.assign(HTMLTags, {
  Tag,
  Attrs,
  getTag,
  ensureTag,
  isTagEnsured,
  getSymbolName,
  knownHTMLElementNames,
  knownSVGElementNames,
  knownElementNames,
  voidElementNames,
  isKnownElement,
  isKnownSVGElement,
  isVoidElement,
  CharRef,
  Comment,
  Raw,
  isArray,
  isConstructedObject,
  isNully,
  isValidAttributeName,
  flattenAttributes,
  toHTML,
  TEXTMODE,
  toText,
  Visitor,
  TransformingVisitor,
  ToHTMLVisitor,
  ToTextVisitor,
});
