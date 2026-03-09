/**
 * @blaze-ng/blaze-tools — Compile-time utilities for Blaze-NG.
 *
 * Provides token parsers for JavaScript literals/identifiers and
 * code generation utilities for converting HTMLjs AST to JavaScript.
 *
 * @example
 * ```ts
 * import { toJS, toJSLiteral, EmitCode } from '@blaze-ng/blaze-tools';
 * import { HTML } from '@blaze-ng/htmljs';
 *
 * const code = toJS(HTML.P({ class: 'hello' }, 'world'));
 * // => 'HTML.P({class: "hello"}, "world")'
 * ```
 */

// Types
export type { Scanner, NumberToken, StringToken } from './types';

// Token parsers
export {
  parseNumber,
  parseIdentifierName,
  parseExtendedIdentifierName,
  parseStringLiteral,
} from './tokens';

// Code generation
export { EmitCode, toJSLiteral, toObjectLiteralKey, ToJSVisitor, toJS } from './tojs';

// Composite namespace object (matches original BlazeTools API)
import {
  parseNumber,
  parseIdentifierName,
  parseExtendedIdentifierName,
  parseStringLiteral,
} from './tokens';
import { EmitCode, toJSLiteral, toObjectLiteralKey, ToJSVisitor, toJS } from './tojs';

/**
 * The BlazeTools namespace, matching the original Blaze package API.
 */
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
