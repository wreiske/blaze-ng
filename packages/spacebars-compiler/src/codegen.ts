import { TEMPLATE_TAG_POSITION } from '@blaze-ng/html-tools';
import { BlazeTools } from '@blaze-ng/blaze-tools';
import type { TemplateTag, ArgSpec } from './templatetag';

/**
 * Built-in block helpers mapped to their runtime equivalents.
 */
export const builtInBlockHelpers: Record<string, string> = {
  if: 'Blaze.If',
  unless: 'Blaze.Unless',
  with: 'Spacebars.With',
  each: 'Blaze.Each',
  let: 'Blaze.Let',
};

/**
 * Template macros that expand to special code when preceded by `Template.`.
 */
const builtInTemplateMacros: Record<string, string> = {
  contentBlock: 'view.templateContentBlock',
  elseBlock: 'view.templateElseBlock',
  dynamic: 'Template.__dynamic',
  subscriptionsReady: 'view.templateInstance().subscriptionsReady()',
};

const additionalReservedNames = [
  'body',
  'toString',
  'instance',
  'constructor',
  'toString',
  'toLocaleString',
  'valueOf',
  'hasOwnProperty',
  'isPrototypeOf',
  'propertyIsEnumerable',
  '__defineGetter__',
  '__lookupGetter__',
  '__defineSetter__',
  '__lookupSetter__',
  '__proto__',
  'dynamic',
  'registerHelper',
  'currentData',
  'parentData',
  '_migrateTemplate',
  '_applyHmrChanges',
  '__pendingReplacement',
];

/**
 * Check whether a name is reserved and can't be used as a template name.
 *
 * @param name - The name to check.
 * @returns True if the name is reserved.
 */
export function isReservedName(name: string): boolean {
  return (
    Object.prototype.hasOwnProperty.call(builtInBlockHelpers, name) ||
    Object.prototype.hasOwnProperty.call(builtInTemplateMacros, name) ||
    additionalReservedNames.includes(name)
  );
}

/**
 * Build an object literal string from a key→source-code map.
 *
 * @param obj - Map of property names to source code strings.
 * @returns JS object literal string.
 */
function makeObjectLiteral(obj: Record<string, string>): string {
  const parts: string[] = [];
  for (const k in obj) parts.push(BlazeTools.toObjectLiteralKey(k) + ': ' + obj[k]);
  return '{' + parts.join(', ') + '}';
}

/**
 * Code generator for converting template tags to JavaScript source.
 *
 * Stateless — could carry per-function state in the future.
 */
export class CodeGen {
  /** Reference to `codeGen()` from compiler, set externally. */
  _codeGenBlock: ((content: unknown, options?: unknown) => string) | null = null;

  /**
   * Generate JS code for a single template tag.
   *
   * @param tag - The template tag to generate code for.
   * @returns An EmitCode or string value.
   * @throws {Error} On unexpected tag types.
   */
  codeGenTemplateTag(tag: TemplateTag): unknown {
    if (tag.position === TEMPLATE_TAG_POSITION.IN_START_TAG) {
      return new BlazeTools.EmitCode(
        'function () { return ' +
          this.codeGenMustache(tag.path!, tag.args!, 'attrMustache') +
          '; }',
      );
    } else {
      if (tag.type === 'DOUBLE' || tag.type === 'TRIPLE') {
        let code = this.codeGenMustache(tag.path!, tag.args!);
        if (tag.type === 'TRIPLE') {
          code = 'Spacebars.makeRaw(' + code + ')';
        }
        if (tag.position !== TEMPLATE_TAG_POSITION.IN_ATTRIBUTE) {
          code =
            'Blaze.View(' +
            BlazeTools.toJSLiteral('lookup:' + tag.path!.join('.')) +
            ', ' +
            'function () { return ' +
            code +
            '; })';
        }
        return new BlazeTools.EmitCode(code);
      } else if (tag.type === 'INCLUSION' || tag.type === 'BLOCKOPEN') {
        const path = tag.path!;
        const args = tag.args!;

        if (
          tag.type === 'BLOCKOPEN' &&
          Object.prototype.hasOwnProperty.call(builtInBlockHelpers, path[0])
        ) {
          if (path.length > 1) throw new Error('Unexpected dotted path beginning with ' + path[0]);
          if (!args.length) throw new Error('#' + path[0] + ' requires an argument');

          let dataCode: string | null = null;

          if (
            path[0] === 'each' &&
            args.length >= 2 &&
            args[1][0] === 'PATH' &&
            (args[1][1] as string[]).length &&
            (args[1][1] as string[])[0] === 'in'
          ) {
            const eachUsage =
              'Use either {{#each items}} or ' + '{{#each item in items}} form of #each.';
            const inArg = args[1];
            if (!(args.length >= 3 && (inArg[1] as string[]).length === 1)) {
              throw new Error('Malformed #each. ' + eachUsage);
            }
            const variableArg = args[0];
            if (
              !(
                variableArg[0] === 'PATH' &&
                (variableArg[1] as string[]).length === 1 &&
                (variableArg[1] as string[])[0].replace(/\./g, '')
              )
            ) {
              throw new Error('Bad variable name in #each');
            }
            const variable = (variableArg[1] as string[])[0];
            dataCode =
              'function () { return { _sequence: ' +
              this.codeGenInclusionData(args.slice(2)) +
              ', _variable: ' +
              BlazeTools.toJSLiteral(variable) +
              ' }; }';
          } else if (path[0] === 'let') {
            const dataProps: Record<string, string> = {};
            args.forEach((arg) => {
              if (arg.length !== 3) {
                throw new Error('Incorrect form of #let');
              }
              const argKey = arg[2] as string;
              dataProps[argKey] =
                'function () { return Spacebars.call(' + this.codeGenArgValue(arg) + '); }';
            });
            dataCode = makeObjectLiteral(dataProps);
          }

          if (!dataCode) {
            dataCode = this.codeGenInclusionDataFunc(args) || 'null';
          }

          const contentBlock = 'content' in tag ? this.codeGenBlock(tag.content) : null;
          const elseContentBlock = 'elseContent' in tag ? this.codeGenBlock(tag.elseContent) : null;

          const callArgs: (string | null)[] = [dataCode, contentBlock];
          if (elseContentBlock) callArgs.push(elseContentBlock);

          return new BlazeTools.EmitCode(
            builtInBlockHelpers[path[0]] + '(' + callArgs.join(', ') + ')',
          );
        } else {
          let compCode = this.codeGenPath(path, { lookupTemplate: true });
          if (path.length > 1) {
            compCode = 'function () { return Spacebars.call(' + compCode + '); }';
          }

          const dataCode = this.codeGenInclusionDataFunc(tag.args!);
          const content = 'content' in tag ? this.codeGenBlock(tag.content) : null;
          const elseContent = 'elseContent' in tag ? this.codeGenBlock(tag.elseContent) : null;

          const includeArgs: (string | null)[] = [compCode];
          if (content) {
            includeArgs.push(content);
            if (elseContent) includeArgs.push(elseContent);
          }

          let includeCode = 'Spacebars.include(' + includeArgs.join(', ') + ')';

          if (dataCode) {
            includeCode =
              'Blaze._TemplateWith(' + dataCode + ', function () { return ' + includeCode + '; })';
          }

          // XXX BACK COMPAT - UI is the old name, Template is the new
          if (
            (path[0] === 'UI' || path[0] === 'Template') &&
            (path[1] === 'contentBlock' || path[1] === 'elseBlock')
          ) {
            includeCode =
              'Blaze._InOuterTemplateScope(view, function () { return ' + includeCode + '; })';
          }

          return new BlazeTools.EmitCode(includeCode);
        }
      } else if (tag.type === 'ESCAPE') {
        return tag.value;
      } else {
        throw new Error('Unexpected template tag type: ' + tag.type);
      }
    }
  }

  /**
   * Generate code for a path lookup.
   *
   * @param path - Array of path segments.
   * @param opts - Options (lookupTemplate).
   * @returns JS source string for the lookup.
   * @throws {Error} If the path uses a built-in block helper name.
   */
  codeGenPath(path: string[], opts?: { lookupTemplate?: boolean }): string {
    if (Object.prototype.hasOwnProperty.call(builtInBlockHelpers, path[0]))
      throw new Error("Can't use the built-in '" + path[0] + "' here");

    // XXX BACK COMPAT - UI is the old name, Template is the new
    if (
      path.length >= 2 &&
      (path[0] === 'UI' || path[0] === 'Template') &&
      Object.prototype.hasOwnProperty.call(builtInTemplateMacros, path[1])
    ) {
      if (path.length > 2)
        throw new Error('Unexpected dotted path beginning with ' + path[0] + '.' + path[1]);
      return builtInTemplateMacros[path[1]];
    }

    const firstPathItem = BlazeTools.toJSLiteral(path[0]);
    let lookupMethod = 'lookup';
    if (opts && opts.lookupTemplate && path.length === 1) lookupMethod = 'lookupTemplate';
    let code = 'view.' + lookupMethod + '(' + firstPathItem + ')';

    if (path.length > 1) {
      code =
        'Spacebars.dot(' + code + ', ' + path.slice(1).map(BlazeTools.toJSLiteral).join(', ') + ')';
    }

    return code;
  }

  /**
   * Generate code for an argument value (positional or keyword).
   *
   * @param arg - The argument spec.
   * @returns JS source string.
   * @throws {Error} On unexpected arg type.
   */
  codeGenArgValue(arg: ArgSpec): string {
    const argType = arg[0];
    const argValue = arg[1];

    let argCode: string;
    switch (argType) {
      case 'STRING':
      case 'NUMBER':
      case 'BOOLEAN':
      case 'NULL':
        argCode = BlazeTools.toJSLiteral(argValue);
        break;
      case 'PATH':
        argCode = this.codeGenPath(argValue as string[]);
        break;
      case 'EXPR': {
        const expr = argValue as TemplateTag;
        argCode = this.codeGenMustache(expr.path!, expr.args!, 'dataMustache');
        break;
      }
      default:
        throw new Error('Unexpected arg type: ' + argType);
    }

    return argCode;
  }

  /**
   * Generate a `Spacebars.fooMustache(...)` call on evaluated arguments.
   *
   * @param path - The path segments.
   * @param args - The argument specs.
   * @param mustacheType - The mustache function name (default 'mustache').
   * @returns JS source string.
   */
  codeGenMustache(path: string[], args: ArgSpec[], mustacheType?: string): string {
    const nameCode = this.codeGenPath(path);
    const argCode = this.codeGenMustacheArgs(args);
    const mustache = mustacheType || 'mustache';

    return (
      'Spacebars.' + mustache + '(' + nameCode + (argCode ? ', ' + argCode.join(', ') : '') + ')'
    );
  }

  /**
   * Generate code for mustache arguments.
   *
   * @param tagArgs - The argument specs.
   * @returns Array of source strings, or null if no args.
   */
  codeGenMustacheArgs(tagArgs: ArgSpec[]): string[] | null {
    let kwArgs: Record<string, string> | null = null;
    let args: string[] | null = null;

    tagArgs.forEach((arg) => {
      const argCode = this.codeGenArgValue(arg);

      if (arg.length > 2) {
        kwArgs = kwArgs || {};
        kwArgs[arg[2] as string] = argCode;
      } else {
        args = args || [];
        args.push(argCode);
      }
    });

    if (kwArgs) {
      args = args || [];
      args.push('Spacebars.kw(' + makeObjectLiteral(kwArgs) + ')');
    }

    return args;
  }

  /**
   * Generate a function literal wrapping content code.
   *
   * @param content - The content to generate code for.
   * @returns JS source string for the function.
   */
  codeGenBlock(content: unknown): string {
    if (!this._codeGenBlock) throw new Error('codeGenBlock not initialized');
    return this._codeGenBlock(content);
  }

  /**
   * Generate code for inclusion data (data context).
   *
   * @param args - The argument specs.
   * @returns JS source string, or null if no args.
   */
  codeGenInclusionData(args: ArgSpec[]): string | null {
    if (!args.length) {
      return null;
    } else if (args[0].length === 3) {
      // keyword arguments only
      const dataProps: Record<string, string> = {};
      args.forEach((arg) => {
        const argKey = arg[2] as string;
        dataProps[argKey] = 'Spacebars.call(' + this.codeGenArgValue(arg) + ')';
      });
      return makeObjectLiteral(dataProps);
    } else if (args[0][0] !== 'PATH') {
      // literal first argument
      return this.codeGenArgValue(args[0]);
    } else if (args.length === 1) {
      return 'Spacebars.call(' + this.codeGenPath(args[0][1] as string[]) + ')';
    } else {
      return this.codeGenMustache(args[0][1] as string[], args.slice(1), 'dataMustache');
    }
  }

  /**
   * Generate a function wrapper around inclusion data code.
   *
   * @param args - The argument specs.
   * @returns JS function source string, or null.
   */
  codeGenInclusionDataFunc(args: ArgSpec[]): string | null {
    const dataCode = this.codeGenInclusionData(args);
    if (dataCode) {
      return 'function () { return ' + dataCode + '; }';
    }
    return null;
  }
}
