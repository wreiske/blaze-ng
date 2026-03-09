/**
 * @blaze-ng/html-tools — Standards-compliant HTML tokenizer and parser.
 *
 * Provides a Scanner, HTML tokenizer, character reference decoder,
 * and HTML parser that produces an HTMLjs AST.
 *
 * @example
 * ```ts
 * import { HTMLTools } from '@blaze-ng/html-tools';
 *
 * const ast = HTMLTools.parseFragment('<p>Hello &amp; world</p>');
 * ```
 */

export { Scanner, makeRegexMatcher } from './scanner';
export type { ScannerError, GetTemplateTagFn } from './scanner';

export { asciiLowerCase, properCaseTagName, properCaseAttributeName } from './utils';

export { TemplateTag } from './templatetag';

export { getCharacterReference } from './charref';

export {
  getComment,
  getDoctype,
  getHTMLToken,
  getTagToken,
  isLookingAtEndTag,
  TEMPLATE_TAG_POSITION,
} from './tokenize';

export { parseFragment, codePointToString, getContent, getRCData } from './parse';
export type { ParseOptions } from './parse';

export type {
  HTMLToken,
  CommentToken,
  DoctypeToken,
  CharsToken,
  CharRefToken,
  TagToken,
  TemplateTagToken,
  AttrValueToken,
  AttrsDict,
  TagAttrs,
} from './types';

// Build the composite HTMLTools namespace object (matches original Blaze API)
import { Scanner } from './scanner';
import { asciiLowerCase, properCaseTagName, properCaseAttributeName } from './utils';
import { TemplateTag } from './templatetag';
import { getCharacterReference } from './charref';
import {
  getComment,
  getDoctype,
  getHTMLToken,
  getTagToken,
  TEMPLATE_TAG_POSITION,
} from './tokenize';
import { parseFragment, codePointToString, getContent, getRCData } from './parse';

/**
 * The main HTMLTools namespace object, matching the original Blaze API surface.
 */
export const HTMLTools = {
  asciiLowerCase,
  properCaseTagName,
  properCaseAttributeName,
  TemplateTag,
  Scanner,
  parseFragment,
  codePointToString,
  TEMPLATE_TAG_POSITION,
  Parse: {
    getCharacterReference,
    getContent,
    getRCData,
    getComment,
    getDoctype,
    getHTMLToken,
    getTagToken,
  },
};
