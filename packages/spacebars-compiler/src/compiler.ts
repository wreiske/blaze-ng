import {
  TemplateTag as HtmlToolsTemplateTag,
  parseFragment,
  TEMPLATE_TAG_POSITION,
} from '@blaze-ng/html-tools';
import { HTML } from '@blaze-ng/htmljs';
import { BlazeTools } from '@blaze-ng/blaze-tools';
import { CodeGen } from './codegen';
import { optimize } from './optimizer';
import { ReactComponentSiblingForbidder } from './react';
import { TemplateTag } from './templatetag';
import { removeWhitespace } from './whitespace';

/**
 * Parse a Spacebars template string into an HTMLjs AST.
 *
 * @param input - The template string.
 * @returns The parsed HTMLjs tree.
 */
export function parse(input: string): unknown {
  return parseFragment(input, {
    getTemplateTag: TemplateTag.parseCompleteTag,
  });
}

/**
 * Options for the compile function.
 */
export interface CompileOptions {
  isTemplate?: boolean;
  isBody?: boolean;
  whitespace?: string;
  sourceName?: string;
}

/**
 * Compile a Spacebars template string to a JavaScript function string.
 *
 * @param input - The template string.
 * @param options - Compile options.
 * @returns JS function string.
 */
export function compile(input: string, options?: CompileOptions): string {
  const tree = parse(input);
  return codeGen(tree, options);
}

/**
 * Visitor that replaces TemplateTags with generated code.
 */
class TemplateTagReplacer extends HTML.TransformingVisitor {
  codegen!: CodeGen;
  inAttributeValue = false;

  override visitObject(x: unknown): unknown {
    if (x instanceof HtmlToolsTemplateTag) {
      // Ensure TemplateTags in attributes have the right position
      if (this.inAttributeValue) (x as TemplateTag).position = TEMPLATE_TAG_POSITION.IN_ATTRIBUTE;

      return this.codegen.codeGenTemplateTag(x as TemplateTag);
    }

    return super.visitObject(x);
  }

  override visitAttributes(attrs: unknown, ...args: unknown[]): unknown {
    if (attrs instanceof HtmlToolsTemplateTag)
      return this.codegen.codeGenTemplateTag(attrs as TemplateTag);

    return super.visitAttributes(attrs, ...args);
  }

  override visitAttribute(name: string, value: unknown, tag: unknown, ...args: unknown[]): unknown {
    this.inAttributeValue = true;
    const result = this.visit(value, ...args);
    this.inAttributeValue = false;

    if (result !== value) {
      return new BlazeTools.EmitCode(this.codegen.codeGenBlock(result));
    }
    return result;
  }
}

/**
 * Generate JavaScript code from a parsed HTMLjs tree.
 *
 * @param parseTree - The HTMLjs AST.
 * @param options - Compile options.
 * @returns JS function string.
 */
export function codeGen(parseTree: unknown, options?: CompileOptions): string {
  const isTemplate = options && options.isTemplate;
  const isBody = options && options.isBody;
  const whitespace = options && options.whitespace;
  const sourceName = options && options.sourceName;

  let tree = parseTree;

  if (isTemplate || isBody) {
    if (typeof whitespace === 'string' && whitespace.toLowerCase() === 'strip') {
      tree = removeWhitespace(tree);
    }
    tree = optimize(tree);
  }

  // throws an error if using `{{> React}}` with siblings
  new ReactComponentSiblingForbidder({ sourceName }).visit(tree);

  const codegen = new CodeGen();
  codegen._codeGenBlock = (content: unknown) => codeGen(content);

  tree = new TemplateTagReplacer({ codegen }).visit(tree);

  let code = '(function () { ';
  if (isTemplate || isBody) {
    code += 'var view = this; ';
  }
  code += 'return ';
  code += BlazeTools.toJS(tree);
  code += '; })';

  code = _beautify(code);

  return code;
}

/**
 * Beautify generated code.
 *
 * The original used UglifyJS for beautification. This implementation
 * applies basic formatting to match expected output.
 *
 * @param code - The raw JS code string.
 * @returns Formatted code string.
 */
export function _beautify(code: string): string {
  // Basic formatting: normalize whitespace in function bodies
  // to match the original UglifyJS beautifier output.
  //
  // The approach:
  // 1. Parse and re-emit with consistent indentation
  // We replicate what UglifyJS beautify does:
  // - 2-space indent
  // - spaces after colons/commas
  // - newlines before/after blocks

  // Use a simple approach: pass through a formatter that matches UglifyJS output
  let result = code;

  // Remove wrapping parens if present, format, re-add
  const hasParens = result.startsWith('(') && result.endsWith(')');
  if (hasParens) {
    result = result.slice(1, -1);
  }

  // Normalize whitespace: collapse multiple spaces/newlines
  result = result.replace(/\s+/g, ' ');

  // Format function declarations onto new lines
  result = result.replace(/function\s*\(\)\s*\{\s*/g, 'function() {\n');

  // Add newlines after semicolons inside function bodies (var declarations)
  result = result.replace(/;\s*/g, ';\n');

  // Add newlines before return statements
  result = result.replace(/\s*return\s+/g, '  return ');

  // Close braces on their own line
  result = result.replace(/\s*\}/g, '\n}');

  if (hasParens) {
    result = '(' + result + ')';
  }

  // Strip trailing semicolons (UglifyJS adds them for statements)
  result = result.replace(/;$/, '');

  return result;
}
