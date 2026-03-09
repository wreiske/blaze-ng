/**
 * Type declarations for workspace packages that don't yet generate .d.ts files.
 *
 * These allow downstream packages to import from upstream packages that
 * build JS successfully but have pre-existing strict-mode type issues
 * preventing DTS generation.
 */

declare module '@blaze-ng/templating-tools' {
  export interface ScanOptions {
    isBody?: boolean;
  }
  export interface ScannedTag {
    tagName: string;
    attribs: Record<string, string>;
    contents: string;
    contentsStartIndex: number;
    tagStartIndex: number;
    fileContents: string;
    sourceName: string;
  }
  export interface CompileResult {
    head: string;
    body: string;
    bodyAttrs: Record<string, string>;
    js: string;
  }
  export function scanHtmlForTags(
    source: string,
    sourceName: string,
    options?: ScanOptions,
  ): ScannedTag[];
  export function compileTagsWithSpacebars(
    tags: ScannedTag[],
    sourceName: string,
  ): CompileResult;
  export const TemplatingTools: {
    scanHtmlForTags: typeof scanHtmlForTags;
    compileTagsWithSpacebars: typeof compileTagsWithSpacebars;
  };
}

declare module '@blaze-ng/spacebars-compiler' {
  export function compile(input: string, options?: Record<string, unknown>): string;
}
