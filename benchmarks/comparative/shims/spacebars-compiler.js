/**
 * SpacebarsCompiler shim — re-exports from original Blaze spacebars-compiler sub-files.
 *
 * The original preamble.js uses an implicit global `SpacebarsCompiler = {...}` which
 * fails in strict-mode ESM. This shim assembles the same object from
 * properly-exported sub-files.
 */
import {
  CodeGen,
  builtInBlockHelpers,
  isReservedName,
} from '../../../../blaze/packages/spacebars-compiler/codegen.js';
import { optimize } from '../../../../blaze/packages/spacebars-compiler/optimizer.js';
import {
  parse,
  compile,
  codeGen,
  TemplateTagReplacer,
  beautify,
} from '../../../../blaze/packages/spacebars-compiler/compiler.js';
import { TemplateTag } from '../../../../blaze/packages/spacebars-compiler/templatetag.js';

export const SpacebarsCompiler = {
  CodeGen,
  _builtInBlockHelpers: builtInBlockHelpers,
  isReservedName,
  optimize,
  parse,
  compile,
  codeGen,
  _TemplateTagReplacer: TemplateTagReplacer,
  _beautify: beautify,
  TemplateTag,
};
