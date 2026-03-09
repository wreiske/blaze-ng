/**
 * BlazeTools shim — re-exports from original Blaze blaze-tools sub-files.
 *
 * The original preamble.js uses an implicit global `BlazeTools = {...}` which
 * fails in strict-mode ESM. This shim assembles the same object from
 * properly-exported sub-files.
 */
import {
  EmitCode,
  toJSLiteral,
  toObjectLiteralKey,
  ToJSVisitor,
  toJS,
} from '../../../../blaze/packages/blaze-tools/tojs.js';

import {
  parseNumber,
  parseIdentifierName,
  parseExtendedIdentifierName,
  parseStringLiteral,
} from '../../../../blaze/packages/blaze-tools/tokens.js';

export const BlazeTools = {
  EmitCode,
  toJSLiteral,
  toObjectLiteralKey,
  ToJSVisitor,
  toJS,
  parseNumber,
  parseIdentifierName,
  parseExtendedIdentifierName,
  parseStringLiteral,
};
