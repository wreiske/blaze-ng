/**
 * HTMLTools shim — re-exports from original Blaze html-tools sub-files.
 *
 * The original main.js uses an implicit global `HTMLTools = {...}` which
 * fails in strict-mode ESM. This shim assembles the same object from
 * properly-exported sub-files.
 */
import { Scanner } from '../../../../blaze/packages/html-tools/scanner.js';
import { TemplateTag } from '../../../../blaze/packages/html-tools/templatetag.js';
import {
  parseFragment,
  codePointToString,
  getContent,
  getRCData,
} from '../../../../blaze/packages/html-tools/parse.js';
import {
  getComment,
  getDoctype,
  getHTMLToken,
  getTagToken,
  TEMPLATE_TAG_POSITION,
} from '../../../../blaze/packages/html-tools/tokenize.js';
import {
  asciiLowerCase,
  properCaseTagName,
  properCaseAttributeName,
} from '../../../../blaze/packages/html-tools/utils.js';
import { getCharacterReference } from '../../../../blaze/packages/html-tools/charref.js';

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
