/**
 * Core types for the HTMLjs AST representation.
 *
 * HTMLjs represents HTML as a tree of typed nodes (Tags, CharRefs, Comments,
 * Raw strings) plus primitives (strings, numbers, booleans) and arrays.
 */

/** Marker tuple used for fast runtime type checking via `htmljsType` property. */
export type HtmljsType = readonly [string];

/** An attributes dictionary — plain object mapping attribute names to values. */
export type Attrs = Record<string, unknown>;

/**
 * Any valid child of an HTML tag or content array.
 *
 * Use this as a general type — the actual class types are checked at runtime
 * via the `htmljsType` property.
 */
export type HTMLNode =
  | { htmljsType: HtmljsType }
  | string
  | number
  | boolean
  | null
  | undefined
  | HTMLNode[]
  | ((...args: unknown[]) => unknown);

/** Constructor arguments for a Tag: optional attrs dict, then children. */
export type TagArgs = unknown[];

/** Options for CharRef construction. */
export interface CharRefAttrs {
  /** The HTML entity string (e.g. `'&amp;'`). */
  html: string;
  /** The decoded character string (e.g. `'&'`). */
  str: string;
}

/** Text escaping modes for `toText`. */
export const TEXTMODE = {
  STRING: 1,
  RCDATA: 2,
  ATTRIBUTE: 3,
} as const;

export type TextMode = (typeof TEXTMODE)[keyof typeof TEXTMODE];

/** Interface for a Tag constructor function (e.g. `HTML.P`, `HTML.DIV`). */
export interface TagConstructor {
  new (...args: TagArgs): Tag;
  (...args: TagArgs): Tag;
  prototype: Tag;
}

import type { Tag } from './tag';
