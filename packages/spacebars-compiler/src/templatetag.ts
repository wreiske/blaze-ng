import {
  TemplateTag as HtmlToolsTemplateTag,
  Scanner,
  TEMPLATE_TAG_POSITION,
  parseFragment,
} from '@blaze-ng/html-tools';
import { HTML } from '@blaze-ng/htmljs';
import { BlazeTools } from '@blaze-ng/blaze-tools';

/**
 * Tag type for a Spacebars template tag.
 */
export type TemplateTagType =
  | 'DOUBLE'
  | 'TRIPLE'
  | 'EXPR'
  | 'COMMENT'
  | 'BLOCKCOMMENT'
  | 'INCLUSION'
  | 'BLOCKOPEN'
  | 'BLOCKCLOSE'
  | 'ELSE'
  | 'ESCAPE';

/**
 * An argument type in a template tag.
 */
export type ArgType = 'STRING' | 'NUMBER' | 'BOOLEAN' | 'NULL' | 'PATH' | 'EXPR';

/**
 * An argument spec: [type, value] or [type, value, keyword].
 */
export type ArgSpec = [ArgType, unknown] | [ArgType, unknown, string];

/**
 * Spacebars TemplateTag — result of parsing a single `{{...}}` tag.
 *
 * Extends html-tools TemplateTag with Spacebars-specific fields:
 * type, path, args, value, content, elseContent, position, textMode.
 */
export class TemplateTag extends HtmlToolsTemplateTag {
  override constructorName = 'SpacebarsCompiler.TemplateTag';

  type?: TemplateTagType;
  path?: string[];
  args?: ArgSpec[];
  value?: string;
  content?: unknown;
  elseContent?: unknown;
  position?: number;
  textMode?: unknown;

  /**
   * Parse a template tag from a scanner or string.
   *
   * Returns null if the input doesn't start with `{{`.
   * Otherwise, succeeds and returns a TemplateTag, or throws.
   *
   * @param scannerOrString - A Scanner or string to parse.
   * @returns The parsed TemplateTag, or null.
   * @throws {Error} On malformed template tags.
   */
  static parse(scannerOrString: Scanner | string): TemplateTag | null {
    const scanner =
      typeof scannerOrString === 'string' ? new Scanner(scannerOrString) : scannerOrString;

    if (!(scanner.peek() === '{' && scanner.rest().slice(0, 2) === '{{')) return null;

    const run = (regex: RegExp): string | null => {
      const result = regex.exec(scanner.rest());
      if (!result) return null;
      const ret = result[0];
      scanner.pos += ret.length;
      return ret;
    };

    const error = (msg: string): never => {
      scanner.fatal(msg);
      // scanner.fatal always throws, but TS doesn't know that
      throw new Error(msg);
    };

    const expected = (what: string): never => {
      return error('Expected ' + what);
    };

    const scanIdentifier = (isFirstInPath: boolean): string => {
      const id = BlazeTools.parseExtendedIdentifierName(scanner);
      if (!id) {
        expected('IDENTIFIER');
      }
      if (isFirstInPath && (id === 'null' || id === 'true' || id === 'false'))
        scanner.fatal("Can't use null, true, or false, as an identifier at start of path");
      return id as string;
    };

    const scanPath = (): string[] => {
      const segments: string[] = [];

      // handle initial `.`, `..`, `./`, `../`, `../..`, `../../`, etc
      let dots: string | null;
      if ((dots = run(/^[./]+/))) {
        let ancestorStr = '.';
        const endsWithSlash = /\/$/.test(dots);

        if (endsWithSlash) dots = dots.slice(0, -1);

        dots.split('/').forEach((dotClause, index) => {
          if (index === 0) {
            if (dotClause !== '.' && dotClause !== '..') expected('`.`, `..`, `./` or `../`');
          } else {
            if (dotClause !== '..') expected('`..` or `../`');
          }

          if (dotClause === '..') ancestorStr += '.';
        });

        segments.push(ancestorStr);

        if (!endsWithSlash) return segments;
      }

      while (true) {
        if (run(/^\[/)) {
          let seg = run(/^[\s\S]*?\]/);
          if (!seg) error('Unterminated path segment');
          seg = (seg as string).slice(0, -1);
          if (!seg && !segments.length) error("Path can't start with empty string");
          segments.push(seg);
        } else {
          const id = scanIdentifier(!segments.length);
          if (id === 'this') {
            if (!segments.length) {
              segments.push('.');
            } else {
              error(
                'Can only use `this` at the beginning of a path.\nInstead of `foo.this` or `../this`, just write `foo` or `.`.',
              );
            }
          } else {
            segments.push(id);
          }
        }

        const sep = run(/^[./]/);
        if (!sep) break;
      }

      return segments;
    };

    const scanArgKeyword = (): string | null => {
      const match = /^([^{}()>#=\s"'[\]]+)\s*=\s*/.exec(scanner.rest());
      if (match) {
        scanner.pos += match[0].length;
        return match[1];
      }
      return null;
    };

    const scanArgValue = (): ArgSpec => {
      const startPos = scanner.pos;
      let result: { value: number } | { value: string } | null;
      if ((result = BlazeTools.parseNumber(scanner))) {
        return ['NUMBER', (result as { value: number }).value];
      } else if ((result = BlazeTools.parseStringLiteral(scanner))) {
        return ['STRING', (result as { value: string }).value];
      } else if (/^[.\[]/.test(scanner.peek())) {
        return ['PATH', scanPath()];
      } else if (run(/^\(/)) {
        return ['EXPR', scanExpr('EXPR')];
      } else if (
        (result = BlazeTools.parseExtendedIdentifierName(scanner) as unknown as {
          value: string;
        } | null)
      ) {
        const id = result as unknown as string;
        if (id === 'null') {
          return ['NULL', null];
        } else if (id === 'true' || id === 'false') {
          return ['BOOLEAN', id === 'true'];
        } else {
          scanner.pos = startPos;
          return ['PATH', scanPath()];
        }
      } else {
        return expected(
          'identifier, number, string, boolean, null, or a sub expression enclosed in "(", ")"',
        );
      }
    };

    const scanArg = (): ArgSpec => {
      const keyword = scanArgKeyword();
      const value = scanArgValue();
      if (keyword) {
        return [value[0], value[1], keyword];
      }
      return value;
    };

    const ends: Record<string, RegExp> = {
      DOUBLE: /^\s*\}\}/,
      TRIPLE: /^\s*\}\}\}/,
      EXPR: /^\s*\)/,
    };

    const endsString: Record<string, string> = {
      DOUBLE: '}}',
      TRIPLE: '}}}',
      EXPR: ')',
    };

    const scanExpr = (type: TemplateTagType): TemplateTag => {
      let endType: string = type;
      if (type === 'INCLUSION' || type === 'BLOCKOPEN' || type === 'ELSE') endType = 'DOUBLE';

      const tag = new TemplateTag();
      tag.type = type;
      tag.path = scanPath();
      tag.args = [];
      let foundKwArg = false;
      while (true) {
        run(/^\s*/);
        if (run(ends[endType])) break;
        else if (/^[})]/.test(scanner.peek())) {
          expected('`' + endsString[endType] + '`');
        }
        const newArg = scanArg();
        if (newArg.length === 3) {
          foundKwArg = true;
        } else {
          if (foundKwArg) error("Can't have a non-keyword argument after a keyword argument");
        }
        tag.args.push(newArg);

        if (run(/^(?=[\s})])/) !== '') expected('space');
      }

      return tag;
    };

    const makeStacheTagStartRegex = (r: RegExp): RegExp => {
      return new RegExp(r.source + /(?![{>!#/])/.source, r.ignoreCase ? 'i' : '');
    };

    const starts: Record<string, RegExp> = {
      ESCAPE: /^\{\{(?=\{*\|)/,
      ELSE: makeStacheTagStartRegex(/^\{\{\s*else(\s+(?!\s)|(?=[}]))/i),
      DOUBLE: makeStacheTagStartRegex(/^\{\{\s*(?!\s)/),
      TRIPLE: makeStacheTagStartRegex(/^\{\{\{\s*(?!\s)/),
      BLOCKCOMMENT: makeStacheTagStartRegex(/^\{\{\s*!--/),
      COMMENT: makeStacheTagStartRegex(/^\{\{\s*!/),
      INCLUSION: makeStacheTagStartRegex(/^\{\{\s*>\s*(?!\s)/),
      BLOCKOPEN: makeStacheTagStartRegex(/^\{\{\s*#\s*(?!\s)/),
      BLOCKCLOSE: makeStacheTagStartRegex(/^\{\{\s*\/\s*(?!\s)/),
    };

    let type: TemplateTagType;

    // must do ESCAPE first, immediately followed by ELSE
    if (run(starts.ESCAPE)) type = 'ESCAPE';
    else if (run(starts.ELSE)) type = 'ELSE';
    else if (run(starts.DOUBLE)) type = 'DOUBLE';
    else if (run(starts.TRIPLE)) type = 'TRIPLE';
    else if (run(starts.BLOCKCOMMENT)) type = 'BLOCKCOMMENT';
    else if (run(starts.COMMENT)) type = 'COMMENT';
    else if (run(starts.INCLUSION)) type = 'INCLUSION';
    else if (run(starts.BLOCKOPEN)) type = 'BLOCKOPEN';
    else if (run(starts.BLOCKCLOSE)) type = 'BLOCKCLOSE';
    else return error('Unknown stache tag');

    let tag = new TemplateTag();
    tag.type = type;

    if (type === 'BLOCKCOMMENT') {
      const result = run(/^[\s\S]*?--\s*?\}\}/);
      if (!result) error('Unclosed block comment');
      tag.value = (result as string).slice(0, (result as string).lastIndexOf('--'));
    } else if (type === 'COMMENT') {
      const result = run(/^[\s\S]*?\}\}/);
      if (!result) error('Unclosed comment');
      tag.value = (result as string).slice(0, -2);
    } else if (type === 'BLOCKCLOSE') {
      tag.path = scanPath();
      if (!run(ends.DOUBLE)) expected('`}}`');
    } else if (type === 'ELSE') {
      if (!run(ends.DOUBLE)) {
        tag = scanExpr(type);
      }
    } else if (type === 'ESCAPE') {
      const result = run(/^\{*\|/);
      tag.value = '{{' + (result as string).slice(0, -1);
    } else {
      // DOUBLE, TRIPLE, BLOCKOPEN, INCLUSION
      tag = scanExpr(type);
    }

    return tag;
  }

  /**
   * Peek at a template tag without consuming input.
   *
   * @param scanner - The scanner to peek from.
   * @returns The parsed TemplateTag, or null.
   * @throws {Error} On malformed template tags.
   */
  static peek(scanner: Scanner): TemplateTag | null {
    const startPos = scanner.pos;
    const result = TemplateTag.parse(scanner);
    scanner.pos = startPos;
    return result;
  }

  /**
   * Parse a complete template tag, including block contents for BLOCKOPEN tags.
   *
   * - Returns null for COMMENT and BLOCKCOMMENT.
   * - Throws for unexpected ELSE or BLOCKCLOSE.
   * - Sets `.position` on the tag.
   * - Validates the tag.
   *
   * @param scannerOrString - A Scanner or string to parse.
   * @param position - The TEMPLATE_TAG_POSITION.
   * @returns The parsed TemplateTag, or null.
   * @throws {Error} On malformed or invalid template tags.
   */
  static parseCompleteTag(
    scannerOrString: Scanner | string,
    position?: number,
  ): TemplateTag | null {
    const scanner =
      typeof scannerOrString === 'string' ? new Scanner(scannerOrString) : scannerOrString;

    const startPos = scanner.pos;
    const result = TemplateTag.parse(scanner);
    if (!result) return result;

    if (result.type === 'BLOCKCOMMENT') return null;
    if (result.type === 'COMMENT') return null;

    if (result.type === 'ELSE') scanner.fatal('Unexpected {{else}}');
    if (result.type === 'BLOCKCLOSE') scanner.fatal('Unexpected closing template tag');

    position = position || TEMPLATE_TAG_POSITION.ELEMENT;
    if (position !== TEMPLATE_TAG_POSITION.ELEMENT) result.position = position;

    if (result.type === 'BLOCKOPEN') {
      const blockName = (result.path as string[]).join(',');

      let textMode: number | null = null;
      if (blockName === 'markdown' || position === TEMPLATE_TAG_POSITION.IN_RAWTEXT) {
        textMode = HTML.TEXTMODE.STRING;
      } else if (
        position === TEMPLATE_TAG_POSITION.IN_RCDATA ||
        position === TEMPLATE_TAG_POSITION.IN_ATTRIBUTE
      ) {
        textMode = HTML.TEXTMODE.RCDATA;
      }
      const parserOptions = {
        getTemplateTag: TemplateTag.parseCompleteTag,
        shouldStop: isAtBlockCloseOrElse,
        textMode: textMode,
      };
      result.textMode = textMode;
      result.content = parseFragment(scanner, parserOptions);

      if (scanner.rest().slice(0, 2) !== '{{')
        scanner.fatal('Expected {{else}} or block close for ' + blockName);

      let lastPos = scanner.pos;
      let tmplTag = TemplateTag.parse(scanner) as TemplateTag;

      let lastElseContentTag: TemplateTag | null = result;
      while (tmplTag.type === 'ELSE') {
        if (lastElseContentTag === null) {
          scanner.fatal('Unexpected else after {{else}}');
        }

        if (tmplTag.path) {
          lastElseContentTag.elseContent = new TemplateTag();
          (lastElseContentTag.elseContent as TemplateTag).type = 'BLOCKOPEN';
          (lastElseContentTag.elseContent as TemplateTag).path = tmplTag.path;
          (lastElseContentTag.elseContent as TemplateTag).args = tmplTag.args;
          (lastElseContentTag.elseContent as TemplateTag).textMode = textMode;
          (lastElseContentTag.elseContent as TemplateTag).content = parseFragment(
            scanner,
            parserOptions,
          );

          lastElseContentTag = lastElseContentTag.elseContent as TemplateTag;
        } else {
          lastElseContentTag.elseContent = parseFragment(scanner, parserOptions);
          lastElseContentTag = null;
        }

        if (scanner.rest().slice(0, 2) !== '{{')
          scanner.fatal('Expected block close for ' + blockName);

        lastPos = scanner.pos;
        tmplTag = TemplateTag.parse(scanner) as TemplateTag;
      }

      if (tmplTag.type === 'BLOCKCLOSE') {
        const blockName2 = (tmplTag.path as string[]).join(',');
        if (blockName !== blockName2) {
          scanner.pos = lastPos;
          scanner.fatal('Expected tag to close ' + blockName + ', found ' + blockName2);
        }
      } else {
        scanner.pos = lastPos;
        scanner.fatal('Expected tag to close ' + blockName + ', found ' + tmplTag.type);
      }
    }

    const finalPos = scanner.pos;
    scanner.pos = startPos;
    validateTag(result, scanner);
    scanner.pos = finalPos;

    return result;
  }
}

/**
 * @param scanner - Scanner to check for block close or else.
 * @returns Whether the scanner is at a block close or else tag.
 */
function isAtBlockCloseOrElse(scanner: Scanner): boolean {
  let rest: string;
  let type: string | undefined;
  return (
    scanner.peek() === '{' &&
    (rest = scanner.rest()).slice(0, 2) === '{{' &&
    /^\{\{\s*(\/|else\b)/.test(rest) &&
    !!(type = TemplateTag.peek(scanner)?.type) &&
    (type === 'BLOCKCLOSE' || type === 'ELSE')
  );
}

/**
 * Validate that a template tag is correctly formed and legal for its
 * HTML position.
 *
 * @param ttag - The template tag to validate.
 * @param scanner - Scanner for error reporting.
 * @throws {Error} If the tag is invalid.
 */
function validateTag(ttag: TemplateTag, scanner: Scanner): void {
  if (ttag.type === 'INCLUSION' || ttag.type === 'BLOCKOPEN') {
    const args = ttag.args as ArgSpec[];
    if (
      ttag.path![0] === 'each' &&
      args[1] &&
      args[1][0] === 'PATH' &&
      (args[1][1] as string[])[0] === 'in'
    ) {
      // For the each-in case, don't complain about non-function first arg
    } else {
      if (args.length > 1 && args[0].length === 2 && args[0][0] !== 'PATH') {
        scanner.fatal(
          'First argument must be a function, to be called on ' +
            'the rest of the arguments; found ' +
            args[0][0],
        );
      }
    }
  }

  const position = ttag.position || TEMPLATE_TAG_POSITION.ELEMENT;
  if (position === TEMPLATE_TAG_POSITION.IN_ATTRIBUTE) {
    if (ttag.type === 'DOUBLE' || ttag.type === 'ESCAPE') {
      return;
    } else if (ttag.type === 'BLOCKOPEN') {
      const path = ttag.path!;
      const path0 = path[0];
      if (
        !(
          path.length === 1 &&
          (path0 === 'if' || path0 === 'unless' || path0 === 'with' || path0 === 'each')
        )
      ) {
        scanner.fatal(
          'Custom block helpers are not allowed in an HTML attribute, only built-in ones like #each and #if',
        );
      }
    } else {
      scanner.fatal(ttag.type + ' template tag is not allowed in an HTML attribute');
    }
  } else if (position === TEMPLATE_TAG_POSITION.IN_START_TAG) {
    if (!(ttag.type === 'DOUBLE')) {
      scanner.fatal(
        'Reactive HTML attributes must either have a constant name or consist of a single {{helper}} providing a dictionary of names and values.  A template tag of type ' +
          ttag.type +
          ' is not allowed here.',
      );
    }
    if (scanner.peek() === '=') {
      scanner.fatal(
        'Template tags are not allowed in attribute names, only in attribute values or in the form of a single {{helper}} that evaluates to a dictionary of name=value pairs.',
      );
    }
  }
}
