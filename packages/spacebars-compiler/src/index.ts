/**
 * @blaze-ng/spacebars-compiler — Spacebars template compiler.
 *
 * Compiles Spacebars template strings (`{{foo}}`, `{{#if}}`, etc.)
 * into JavaScript function strings that produce HTMLjs AST at runtime.
 *
 * @example
 * ```ts
 * import { SpacebarsCompiler } from '@blaze-ng/spacebars-compiler';
 *
 * const code = SpacebarsCompiler.compile('{{foo}}', { isTemplate: true });
 * ```
 */

export { TemplateTag } from './templatetag';
export type { TemplateTagType, ArgType, ArgSpec } from './templatetag';

export { CodeGen, builtInBlockHelpers, isReservedName } from './codegen';

export { optimize, toRaw, TreeTransformer } from './optimizer';

export { removeWhitespace } from './whitespace';

export { ReactComponentSiblingForbidder } from './react';

export { parse, compile, codeGen, _beautify } from './compiler';
export type { CompileOptions } from './compiler';

// Composite namespace object (matches original SpacebarsCompiler API)
import { TemplateTag } from './templatetag';
import { CodeGen, builtInBlockHelpers, isReservedName } from './codegen';
import { optimize, toRaw, TreeTransformer } from './optimizer';
import { removeWhitespace } from './whitespace';
import { ReactComponentSiblingForbidder } from './react';
import { parse, compile, codeGen, _beautify } from './compiler';

/**
 * The SpacebarsCompiler namespace, matching the original Meteor API surface.
 */
export const SpacebarsCompiler = {
  TemplateTag,
  CodeGen,
  builtInBlockHelpers,
  isReservedName,
  optimize,
  toRaw,
  TreeTransformer,
  removeWhitespace,
  ReactComponentSiblingForbidder,
  parse,
  compile,
  codeGen,
  _beautify,
};
