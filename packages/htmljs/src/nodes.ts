import type { HtmljsType, CharRefAttrs } from './types';

/**
 * Represents an HTML character reference (entity) like `&amp;` or `&#x2603;`.
 *
 * Stores both the HTML entity string and the decoded character string
 * so that the correct form can be used depending on context.
 */
export class CharRef {
  static readonly htmljsType: HtmljsType = ['CharRef'];
  readonly htmljsType: HtmljsType = CharRef.htmljsType;

  /** The HTML entity string (e.g. `'&amp;'`). */
  readonly html: string;
  /** The decoded character (e.g. `'&'`). */
  readonly str: string;

  constructor(attrs: CharRefAttrs) {
    if (!attrs?.html || !attrs?.str) {
      throw new Error('HTML.CharRef must be constructed with ({html:..., str:...})');
    }
    this.html = attrs.html;
    this.str = attrs.str;
  }
}

/**
 * Represents an HTML comment node (`<!-- ... -->`).
 *
 * The value is sanitized to remove illegal hyphen sequences that
 * cannot be escaped in HTML comments.
 */
export class Comment {
  static readonly htmljsType: HtmljsType = ['Comment'];
  readonly htmljsType: HtmljsType = Comment.htmljsType;

  /** The original comment text. */
  readonly value: string;
  /** The sanitized comment text (illegal hyphens removed). */
  readonly sanitizedValue: string;

  constructor(value: string) {
    if (typeof value !== 'string') {
      throw new Error('HTML.Comment must be constructed with a string');
    }
    this.value = value;
    this.sanitizedValue = value.replace(/^-|--+|-$/g, '');
  }
}

/**
 * Represents raw (unescaped) HTML content.
 *
 * When rendered, the value is inserted as-is without HTML escaping.
 * Use with caution — the caller is responsible for ensuring safety.
 */
export class Raw {
  static readonly htmljsType: HtmljsType = ['Raw'];
  readonly htmljsType: HtmljsType = Raw.htmljsType;

  /** The raw HTML string. */
  readonly value: string;

  constructor(value: string) {
    if (typeof value !== 'string') {
      throw new Error('HTML.Raw must be constructed with a string');
    }
    this.value = value;
  }
}
