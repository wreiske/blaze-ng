import { asciiLowerCase, properCaseTagName, properCaseAttributeName } from './utils';
import { TemplateTag } from './templatetag';
import { getCharacterReference } from './charref';
import { makeRegexMatcher } from './scanner';
import type { Scanner } from './scanner';
import type {
  HTMLToken,
  CommentToken,
  DoctypeToken,
  TagToken,
  AttrValueToken,
  AttrsDict,
} from './types';

// Whitespace per HTML spec
const HTML_SPACE = /^[\f\n\r\t ]/;

const convertCRLF = (str: string) => str.replace(/\r\n?/g, '\n');

/**
 * Parse an HTML comment token (`<!-- ... -->`).
 * @param scanner - Input scanner.
 * @returns A Comment token or null.
 * @throws {Error} On malformed comments.
 */
export function getComment(scanner: Scanner): CommentToken | null {
  if (scanner.rest().slice(0, 4) !== '<!--') return null;
  scanner.pos += 4;

  const rest = scanner.rest();
  if (rest.charAt(0) === '>' || rest.slice(0, 2) === '->')
    scanner.fatal("HTML comment can't start with > or ->");

  const closePos = rest.indexOf('-->');
  if (closePos < 0) scanner.fatal('Unclosed HTML comment');

  const commentContents = rest.slice(0, closePos);
  if (commentContents.slice(-1) === '-') scanner.fatal('HTML comment must end at first `--`');
  if (commentContents.indexOf('--') >= 0)
    scanner.fatal('HTML comment cannot contain `--` anywhere');
  if (commentContents.indexOf('\u0000') >= 0) scanner.fatal('HTML comment cannot contain NULL');

  scanner.pos += closePos + 3;
  return { t: 'Comment', v: convertCRLF(commentContents) };
}

const skipSpaces = (scanner: Scanner) => {
  while (HTML_SPACE.test(scanner.peek())) scanner.pos++;
};

const requireSpaces = (scanner: Scanner) => {
  if (!HTML_SPACE.test(scanner.peek())) scanner.fatal('Expected space');
  skipSpaces(scanner);
};

const getDoctypeQuotedString = (scanner: Scanner): string => {
  const quote = scanner.peek();
  if (!(quote === '"' || quote === "'"))
    scanner.fatal('Expected single or double quote in DOCTYPE');
  scanner.pos++;

  if (scanner.peek() === quote) scanner.fatal('Malformed DOCTYPE');

  let str = '';
  let ch: string;
  while (((ch = scanner.peek()), ch !== quote)) {
    if (!ch || ch === '\u0000' || ch === '>') scanner.fatal('Malformed DOCTYPE');
    str += ch;
    scanner.pos++;
  }

  scanner.pos++;
  return str;
};

/**
 * Parse a DOCTYPE token.
 * @param scanner - Input scanner.
 * @returns A Doctype token or null.
 * @throws {Error} On malformed DOCTYPE.
 */
export function getDoctype(scanner: Scanner): DoctypeToken | null {
  if (asciiLowerCase(scanner.rest().slice(0, 9)) !== '<!doctype') return null;
  const start = scanner.pos;
  scanner.pos += 9;

  requireSpaces(scanner);

  let ch = scanner.peek();
  if (!ch || ch === '>' || ch === '\u0000') scanner.fatal('Malformed DOCTYPE');
  let name = ch;
  scanner.pos++;

  while (((ch = scanner.peek()), !(HTML_SPACE.test(ch) || ch === '>'))) {
    if (!ch || ch === '\u0000') scanner.fatal('Malformed DOCTYPE');
    name += ch;
    scanner.pos++;
  }
  name = asciiLowerCase(name);

  skipSpaces(scanner);

  let systemId: string | null = null;
  let publicId: string | null = null;

  if (scanner.peek() !== '>') {
    const publicOrSystem = asciiLowerCase(scanner.rest().slice(0, 6));

    if (publicOrSystem === 'system') {
      scanner.pos += 6;
      requireSpaces(scanner);
      systemId = getDoctypeQuotedString(scanner);
      skipSpaces(scanner);
      if (scanner.peek() !== '>') scanner.fatal('Malformed DOCTYPE');
    } else if (publicOrSystem === 'public') {
      scanner.pos += 6;
      requireSpaces(scanner);
      publicId = getDoctypeQuotedString(scanner);
      if (scanner.peek() !== '>') {
        requireSpaces(scanner);
        if (scanner.peek() !== '>') {
          systemId = getDoctypeQuotedString(scanner);
          skipSpaces(scanner);
          if (scanner.peek() !== '>') scanner.fatal('Malformed DOCTYPE');
        }
      }
    } else {
      scanner.fatal('Expected PUBLIC or SYSTEM in DOCTYPE');
    }
  }

  scanner.pos++;
  const result: DoctypeToken = {
    t: 'Doctype',
    v: scanner.input.slice(start, scanner.pos),
    name,
  };

  if (systemId) result.systemId = systemId;
  if (publicId) result.publicId = publicId;

  return result;
}

// The special character `{` is only allowed as the first character
// of a Chars, so that we have a chance to detect template tags.
const getChars = makeRegexMatcher(/^[^&<\u0000][^&<\u0000{]*/);

const assertIsTemplateTag = (x: unknown): TemplateTag => {
  if (!(x instanceof TemplateTag)) throw new Error('Expected an instance of HTMLTools.TemplateTag');
  return x;
};

/**
 * Position constants for template tag parsing.
 */
export const TEMPLATE_TAG_POSITION = {
  ELEMENT: 1,
  IN_START_TAG: 2,
  IN_ATTRIBUTE: 3,
  IN_RCDATA: 4,
  IN_RAWTEXT: 5,
} as const;

/**
 * Get the next HTML token from the scanner.
 *
 * @param scanner - Input scanner (may have `getTemplateTag` hook).
 * @param dataMode - Optional 'rcdata' or 'rawtext' mode for special content.
 * @returns An HTML token or null at EOF.
 * @throws {Error} On malformed input.
 */
export function getHTMLToken(scanner: Scanner, dataMode?: string): HTMLToken | null {
  let result: HTMLToken | null = null;

  if (scanner.getTemplateTag) {
    const lastPos = scanner.pos;
    const templateResult = scanner.getTemplateTag(
      scanner,
      dataMode === 'rcdata'
        ? TEMPLATE_TAG_POSITION.IN_RCDATA
        : dataMode === 'rawtext'
          ? TEMPLATE_TAG_POSITION.IN_RAWTEXT
          : TEMPLATE_TAG_POSITION.ELEMENT,
    );

    if (templateResult) return { t: 'TemplateTag', v: assertIsTemplateTag(templateResult) };
    else if (scanner.pos > lastPos) return null;
  }

  const chars = getChars(scanner);
  if (chars) return { t: 'Chars', v: convertCRLF(chars) };

  const ch = scanner.peek();
  if (!ch) return null; // EOF

  if (ch === '\u0000') scanner.fatal('Illegal NULL character');

  if (ch === '&') {
    if (dataMode !== 'rawtext') {
      const charRef = getCharacterReference(scanner);
      if (charRef) return charRef;
    }
    scanner.pos++;
    return { t: 'Chars', v: '&' };
  }

  if (scanner.peek() === '<' && dataMode) {
    scanner.pos++;
    return { t: 'Chars', v: '<' };
  }

  result = getTagToken(scanner) || getComment(scanner) || getDoctype(scanner);
  if (result) return result;

  scanner.fatal('Unexpected `<!` directive.');
}

const getTagName = makeRegexMatcher(/^[a-zA-Z][^\f\n\r\t />{]*/);
const getClangle = makeRegexMatcher(/^>/);
const getSlash = makeRegexMatcher(/^\//);
const getAttributeName = makeRegexMatcher(/^[^>/\u0000"'<=\f\n\r\t ][^\f\n\r\t /=>"'<\u0000]*/);

/** Try to match `>` or `/>`. Mutate tag if self-closing. */
const handleEndOfTag = (scanner: Scanner, tag: TagToken): TagToken | null => {
  if (getClangle(scanner)) return tag;
  if (getSlash(scanner)) {
    if (!getClangle(scanner)) scanner.fatal('Expected `>` after `/`');
    tag.isSelfClosing = true;
    return tag;
  }
  return null;
};

/** Scan a quoted or unquoted attribute value. */
const getAttributeValue = (scanner: Scanner, quote?: string): AttrValueToken[] => {
  if (quote) {
    if (scanner.peek() !== quote) return [];
    scanner.pos++;
  }

  const tokens: AttrValueToken[] = [];
  let charsTokenToExtend: { t: 'Chars'; v: string } | null = null;

  while (true) {
    const ch = scanner.peek();
    const curPos = scanner.pos;

    if (quote && ch === quote) {
      scanner.pos++;
      return tokens;
    } else if (!quote && (HTML_SPACE.test(ch) || ch === '>')) {
      return tokens;
    } else if (!ch) {
      scanner.fatal('Unclosed attribute in tag');
    } else if (quote ? ch === '\u0000' : '\u0000"\'<=`'.indexOf(ch) >= 0) {
      scanner.fatal('Unexpected character in attribute value');
    } else if (ch === '&') {
      const charRef = getCharacterReference(scanner, true, quote || '>');
      if (charRef) {
        tokens.push(charRef);
        charsTokenToExtend = null;
        continue;
      }
      // fall through to char handling below
    }

    // Check for template tag (only if we didn't already handle the char)
    if (ch !== '&' || !getCharacterReference) {
      // handled below
    }

    if (scanner.getTemplateTag && ch !== '&') {
      const templateTag = scanner.getTemplateTag(scanner, TEMPLATE_TAG_POSITION.IN_ATTRIBUTE);
      if (templateTag || scanner.pos > curPos) {
        if (templateTag) {
          tokens.push({ t: 'TemplateTag', v: assertIsTemplateTag(templateTag) });
          charsTokenToExtend = null;
        }
        continue;
      }
    }

    if (!charsTokenToExtend) {
      charsTokenToExtend = { t: 'Chars', v: '' };
      tokens.push(charsTokenToExtend);
    }
    charsTokenToExtend.v += ch === '\r' ? '\n' : ch;
    scanner.pos++;
    if (quote && ch === '\r' && scanner.peek() === '\n') scanner.pos++;
  }
};

const hasOwnProperty = Object.prototype.hasOwnProperty;

/**
 * Parse a tag token (start tag or end tag).
 * @param scanner - Input scanner.
 * @returns A Tag token or null.
 * @throws {Error} On malformed tags.
 */
export function getTagToken(scanner: Scanner): TagToken | null {
  if (!(scanner.peek() === '<' && scanner.rest().charAt(1) !== '!')) return null;
  scanner.pos++;

  const tag: TagToken = { t: 'Tag', n: '' };

  if (scanner.peek() === '/') {
    tag.isEnd = true;
    scanner.pos++;
  }

  const tagName = getTagName(scanner);
  if (!tagName) scanner.fatal('Expected tag name after `<`');
  tag.n = properCaseTagName(tagName);

  if (scanner.peek() === '/' && tag.isEnd) scanner.fatal("End tag can't have trailing slash");
  if (handleEndOfTag(scanner, tag)) return tag;

  if (scanner.isEOF()) scanner.fatal('Unclosed `<`');

  if (!HTML_SPACE.test(scanner.peek())) scanner.fatal('Expected space after tag name');

  skipSpaces(scanner);

  if (scanner.peek() === '/' && tag.isEnd) scanner.fatal("End tag can't have trailing slash");
  if (handleEndOfTag(scanner, tag)) return tag;

  if (tag.isEnd) scanner.fatal("End tag can't have attributes");

  tag.attrs = {};
  const nondynamicAttrs: AttrsDict = tag.attrs;

  while (true) {
    let spacesRequiredAfter = false;

    const curPos = scanner.pos;
    const templateTag =
      scanner.getTemplateTag && scanner.getTemplateTag(scanner, TEMPLATE_TAG_POSITION.IN_START_TAG);

    if (templateTag || scanner.pos > curPos) {
      if (templateTag) {
        if (tag.attrs === nondynamicAttrs) tag.attrs = [nondynamicAttrs];
        (tag.attrs as unknown[]).push({
          t: 'TemplateTag',
          v: assertIsTemplateTag(templateTag),
        });
      }
      spacesRequiredAfter = true;
    } else {
      const attributeName = getAttributeName(scanner);
      if (!attributeName) scanner.fatal('Expected attribute name in tag');
      if (attributeName.indexOf('{') >= 0) scanner.fatal('Unexpected `{` in attribute name.');
      const properName = properCaseAttributeName(attributeName);

      if (hasOwnProperty.call(nondynamicAttrs, properName))
        scanner.fatal('Duplicate attribute in tag: ' + properName);

      nondynamicAttrs[properName] = [];

      skipSpaces(scanner);

      if (handleEndOfTag(scanner, tag)) return tag;

      let ch = scanner.peek();
      if (!ch) scanner.fatal('Unclosed <');
      if ('\u0000"\'<'.indexOf(ch) >= 0)
        scanner.fatal('Unexpected character after attribute name in tag');

      if (ch === '=') {
        scanner.pos++;
        skipSpaces(scanner);

        ch = scanner.peek();
        if (!ch) scanner.fatal('Unclosed <');
        if ('\u0000><=`'.indexOf(ch) >= 0) scanner.fatal('Unexpected character after = in tag');

        if (ch === '"' || ch === "'") nondynamicAttrs[properName] = getAttributeValue(scanner, ch);
        else nondynamicAttrs[properName] = getAttributeValue(scanner);

        spacesRequiredAfter = true;
      }
    }

    if (handleEndOfTag(scanner, tag)) return tag;
    if (scanner.isEOF()) scanner.fatal('Unclosed `<`');

    if (spacesRequiredAfter) requireSpaces(scanner);
    else skipSpaces(scanner);

    if (handleEndOfTag(scanner, tag)) return tag;
  }
}

/**
 * Check if the scanner is looking at a closing tag for the given tag name.
 * Does not advance the scanner.
 * @param scanner - Input scanner.
 * @param tagName - Expected tag name (proper case).
 * @returns True if the scanner is positioned at `</tagName>`.
 */
export function isLookingAtEndTag(scanner: Scanner, tagName: string): boolean {
  const rest = scanner.rest();
  let pos = 0;
  const firstPart = /^<\/([a-zA-Z]+)/.exec(rest);
  if (firstPart && properCaseTagName(firstPart[1]!) === tagName) {
    pos += firstPart[0].length;
    while (pos < rest.length && HTML_SPACE.test(rest.charAt(pos))) pos++;
    if (pos < rest.length && rest.charAt(pos) === '>') return true;
  }
  return false;
}
