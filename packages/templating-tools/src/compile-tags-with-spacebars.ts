import { SpacebarsCompiler } from '@blaze-ng/spacebars-compiler';
import { generateBodyJS, generateTemplateJS } from './code-generation';
import { throwCompileError } from './throw-compile-error';
import type { ScannedTag } from './html-scanner';

/** Results of compiling a set of scanned tags. */
export interface CompileResult {
  head: string;
  body: string;
  js: string;
  bodyAttrs: Record<string, string>;
}

/**
 * Compile an array of scanned tags with the Spacebars compiler.
 *
 * @param tags - Array of scanned tag descriptors from scanHtmlForTags.
 * @param hmrAvailable - Whether HMR code should be emitted.
 * @returns Compilation results containing head, body, js, and bodyAttrs.
 * @throws {CompileError} On invalid template structures.
 */
export function compileTagsWithSpacebars(
  tags: ScannedTag[],
  hmrAvailable?: boolean,
): CompileResult {
  const handler = new SpacebarsTagCompiler();

  tags.forEach((tag) => {
    handler.addTagToResults(tag, hmrAvailable);
  });

  return handler.getResults();
}

class SpacebarsTagCompiler {
  private results: CompileResult;
  private tag!: ScannedTag;

  constructor() {
    this.results = {
      head: '',
      body: '',
      js: '',
      bodyAttrs: {},
    };
  }

  getResults(): CompileResult {
    return this.results;
  }

  addTagToResults(tag: ScannedTag, hmrAvailable?: boolean): void {
    this.tag = tag;

    // do we have 1 or more attributes?
    const hasAttribs = Object.keys(this.tag.attribs).length > 0;

    if (this.tag.tagName === 'head') {
      if (hasAttribs) {
        this.throwCompileError('Attributes on <head> not supported');
      }

      this.results.head += this.tag.contents;
      return;
    }

    // <body> or <template>

    try {
      if (this.tag.tagName === 'template') {
        const name = this.tag.attribs.name;

        if (!name) {
          this.throwCompileError("Template has no 'name' attribute");
        }

        if (SpacebarsCompiler.isReservedName(name)) {
          this.throwCompileError(`Template can't be named "${name}"`);
        }

        const whitespace = this.tag.attribs.whitespace || '';

        const renderFuncCode = SpacebarsCompiler.compile(this.tag.contents, {
          whitespace,
          isTemplate: true,
          sourceName: `Template "${name}"`,
        });

        this.results.js += generateTemplateJS(name, renderFuncCode, hmrAvailable);
      } else if (this.tag.tagName === 'body') {
        const { whitespace = '', ...attribs } = this.tag.attribs;
        this.addBodyAttrs(attribs);

        const renderFuncCode = SpacebarsCompiler.compile(this.tag.contents, {
          whitespace,
          isBody: true,
          sourceName: '<body>',
        });

        // We may be one of many `<body>` tags.
        this.results.js += generateBodyJS(renderFuncCode, hmrAvailable);
      } else {
        this.throwCompileError('Expected <template>, <head>, or <body> tag in template file');
      }
    } catch (e) {
      if ((e as { scanner?: unknown }).scanner) {
        // The error came from Spacebars
        this.throwCompileError(
          (e as Error).message,
          this.tag.contentsStartIndex + (e as { offset: number }).offset,
        );
      } else {
        throw e;
      }
    }
  }

  private addBodyAttrs(attrs: Record<string, string>): void {
    Object.keys(attrs).forEach((attr) => {
      const val = attrs[attr];

      if (Object.hasOwn(this.results.bodyAttrs, attr) && this.results.bodyAttrs[attr] !== val) {
        this.throwCompileError(
          `<body> declarations have conflicting values for the '${attr}' attribute.`,
        );
      }

      this.results.bodyAttrs[attr] = val;
    });
  }

  private throwCompileError(message?: string, overrideIndex?: number): never {
    throwCompileError(this.tag, message, overrideIndex);
  }
}
