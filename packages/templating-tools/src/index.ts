/**
 * @blaze-ng/templating-tools — HTML scanner and template compilation utilities.
 *
 * Scans HTML files for top-level `<head>`, `<body>`, and `<template>` tags,
 * compiles their contents using the Spacebars compiler, and generates
 * JavaScript registration code.
 *
 * @example
 * ```ts
 * import { TemplatingTools } from '@blaze-ng/templating-tools';
 * const tags = TemplatingTools.scanHtmlForTags({ sourceName: 'file.html', contents: html, tagNames: ['body', 'head', 'template'] });
 * const result = TemplatingTools.compileTagsWithSpacebars(tags);
 * ```
 * @module
 */
export { scanHtmlForTags } from './html-scanner';
export type { ScanOptions, ScannedTag } from './html-scanner';

export { compileTagsWithSpacebars } from './compile-tags-with-spacebars';
export type { CompileResult } from './compile-tags-with-spacebars';

export { generateTemplateJS, generateBodyJS } from './code-generation';

export { CompileError, throwCompileError } from './throw-compile-error';
export type { TagDescriptor } from './throw-compile-error';

// Composite namespace object (matches original TemplatingTools API)
import { scanHtmlForTags } from './html-scanner';
import { compileTagsWithSpacebars } from './compile-tags-with-spacebars';
import { generateTemplateJS, generateBodyJS } from './code-generation';
import { CompileError, throwCompileError } from './throw-compile-error';

/**
 * The TemplatingTools namespace, matching the original Meteor API surface.
 */
export const TemplatingTools = {
  scanHtmlForTags,
  compileTagsWithSpacebars,
  generateTemplateJS,
  generateBodyJS,
  CompileError,
  throwCompileError,
};
