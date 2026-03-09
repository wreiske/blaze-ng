import type { TemplateTag } from './templatetag';

/** A parsed HTML comment token. */
export interface CommentToken {
  t: 'Comment';
  v: string;
}

/** A parsed DOCTYPE token. */
export interface DoctypeToken {
  t: 'Doctype';
  v: string;
  name: string;
  systemId?: string;
  publicId?: string;
}

/** A parsed character data token. */
export interface CharsToken {
  t: 'Chars';
  v: string;
}

/** A parsed character reference token. */
export interface CharRefToken {
  t: 'CharRef';
  v: string;
  cp: number[];
}

/** An attribute value token (subset of all tokens). */
export type AttrValueToken = CharsToken | CharRefToken | TemplateTagToken;

/** A dynamic attribute containing a template tag. */
export interface TemplateTagAttrToken {
  t: 'TemplateTag';
  v: TemplateTag;
}

/** Attribute dictionary: maps name → array of value tokens. */
export type AttrsDict = Record<string, AttrValueToken[]>;

/** Attributes can be a simple dict or an array of dict + template tags. */
export type TagAttrs = AttrsDict | [AttrsDict, ...TemplateTagAttrToken[]];

/** A parsed start or end tag token. */
export interface TagToken {
  t: 'Tag';
  n: string;
  isEnd?: boolean;
  isSelfClosing?: boolean;
  attrs?: TagAttrs;
}

/** A template tag token. */
export interface TemplateTagToken {
  t: 'TemplateTag';
  v: TemplateTag;
}

/** Union of all possible HTML tokens. */
export type HTMLToken =
  | CommentToken
  | DoctypeToken
  | CharsToken
  | CharRefToken
  | TagToken
  | TemplateTagToken;
