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

  // Now do a simple brace-aware indentation pass
  let output = '';
  let indent = 0;
  const tokens = tokenizeForBeautify(result);

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];

    if (token === '{') {
      // Ensure space before opening brace (e.g. "function() {")
      if (output.length > 0 && !output.endsWith(' ') && !output.endsWith('\n')) {
        output += ' ';
      }
      output += '{\n';
      indent++;
    } else if (token === '}') {
      indent--;
      output += indentStr(indent) + '}';
      // Check if next token exists and is not a special char
      if (i + 1 < tokens.length && tokens[i + 1] !== ')' && tokens[i + 1] !== ';') {
        output += '\n';
      }
    } else if (token === ';') {
      output += ';\n';
    } else {
      // Regular text or string token
      const trimmed = token.trim();
      if (trimmed) {
        if (output.length === 0 || output.endsWith('\n')) {
          // Start of line — add indentation
          output += indentStr(indent) + trimmed;
        } else {
          // Continuation on same line — ensure space separation
          // between text/string tokens if needed
          const lastChar = output[output.length - 1];
          const firstChar = trimmed[0];
          const needsSpace =
            lastChar !== ' ' &&
            lastChar !== '(' &&
            firstChar !== ')' &&
            firstChar !== ',' &&
            firstChar !== '.';
          if (needsSpace) {
            output += ' ';
          }
          output += trimmed;
        }
      }
    }
  }

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

/** Produce 2-space indentation string. */
function indentStr(level: number): string {
  return '  '.repeat(level);
}

/**
 * Split code into tokens for the beautifier: strings, braces, semicolons,
 * and text chunks. Strings are kept intact to avoid breaking them.
 */
function tokenizeForBeautify(code: string): string[] {
  const tokens: string[] = [];
  let i = 0;
  let buf = '';

  const flush = () => {
    if (buf) {
      tokens.push(buf);
      buf = '';
    }
  };

  while (i < code.length) {
    const ch = code[i];

    // Handle string literals (preserve them intact)
    if (ch === '"' || ch === "'") {
      flush();
      let str = ch;
      i++;
      while (i < code.length) {
        const c = code[i];
        str += c;
        i++;
        if (c === '\\' && i < code.length) {
          str += code[i];
          i++;
        } else if (c === ch) {
          break;
        }
      }
      tokens.push(str);
      continue;
    }

    if (ch === '{' || ch === '}' || ch === ';') {
      flush();
      tokens.push(ch);
      i++;
      continue;
    }

    buf += ch;
    i++;
  }

  flush();
  return tokens;
}
