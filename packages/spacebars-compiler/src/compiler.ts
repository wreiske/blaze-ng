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
  // Replicate UglifyJS beautify output: 2-space indentation, newlines
  // after semicolons inside function bodies.
  let result = code;

  // Remove wrapping parens if present, format, re-add
  const hasParens = result.startsWith('(') && result.endsWith(')');
  if (hasParens) {
    result = result.slice(1, -1);
  }

  // Normalize all whitespace to single spaces first
  result = result.replace(/\s+/g, ' ');

  // UglifyJS normalizes "function ()" to "function()"
  result = result.replace(/function \(/g, 'function(');

  // Now do a simple brace-aware indentation pass (array-based to avoid O(n²) concat)
  const outParts: string[] = [];
  let lastChar = '';
  let indent = 0;
  const tokens = tokenizeForBeautify(result);

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];

    if (token === '{') {
      // Ensure space before opening brace (e.g. "function() {")
      if (lastChar && lastChar !== ' ' && lastChar !== '\n') {
        outParts.push(' ');
      }
      outParts.push('{\n');
      lastChar = '\n';
      indent++;
    } else if (token === '}') {
      indent--;
      outParts.push(indentStr(indent), '}');
      lastChar = '}';
      // Check if next token exists and is not a special char
      if (i + 1 < tokens.length && tokens[i + 1] !== ')' && tokens[i + 1] !== ';') {
        outParts.push('\n');
        lastChar = '\n';
      }
    } else if (token === ';') {
      outParts.push(';\n');
      lastChar = '\n';
    } else {
      // Regular text or string token
      const trimmed = token.trim();
      if (trimmed) {
        if (!lastChar || lastChar === '\n') {
          // Start of line — add indentation
          outParts.push(indentStr(indent), trimmed);
        } else {
          // Continuation on same line — ensure space separation
          const firstChar = trimmed[0];
          const needsSpace =
            lastChar !== ' ' &&
            lastChar !== '(' &&
            firstChar !== ')' &&
            firstChar !== ',' &&
            firstChar !== '.';
          if (needsSpace) {
            outParts.push(' ');
          }
          outParts.push(trimmed);
        }
        lastChar = trimmed[trimmed.length - 1]!;
      }
    }
  }

  const output = outParts.join('');

  // Clean up: remove trailing whitespace on lines, collapse blank lines
  result = output
    .split('\n')
    .map((l) => l.trimEnd())
    .filter((l, i, arr) => !(l === '' && i > 0 && arr[i - 1] === ''))
    .join('\n');

  // Remove trailing newline
  result = result.replace(/\n$/, '');

  if (hasParens) {
    result = '(' + result + ')';
  }

  return result;
}

/** Pre-computed indentation strings for common nesting levels. */
const INDENT_CACHE: string[] = [];
for (let i = 0; i < 16; i++) INDENT_CACHE.push('  '.repeat(i));

/** Produce 2-space indentation string. */
function indentStr(level: number): string {
  return INDENT_CACHE[level] ?? '  '.repeat(level);
}

/**
 * Split code into tokens for the beautifier: strings, braces, semicolons,
 * and text chunks. Strings are kept intact to avoid breaking them.
 * Uses substring slicing instead of char-by-char concatenation.
 */
function tokenizeForBeautify(code: string): string[] {
  const tokens: string[] = [];
  let i = 0;
  let bufStart = 0;

  const flush = () => {
    if (i > bufStart) {
      tokens.push(code.substring(bufStart, i));
    }
  };

  while (i < code.length) {
    const ch = code.charCodeAt(i);

    // Handle string literals (preserve them intact)
    if (ch === 0x22 /* " */ || ch === 0x27 /* ' */) {
      flush();
      const strStart = i;
      i++;
      while (i < code.length) {
        const c = code.charCodeAt(i);
        i++;
        if (c === 0x5c /* \\ */ && i < code.length) {
          i++;
        } else if (c === ch) {
          break;
        }
      }
      tokens.push(code.substring(strStart, i));
      bufStart = i;
      continue;
    }

    if (ch === 0x7b /* { */ || ch === 0x7d /* } */ || ch === 0x3b /* ; */) {
      flush();
      tokens.push(code.charAt(i));
      i++;
      bufStart = i;
      continue;
    }

    i++;
  }

  flush();
  return tokens;
}
