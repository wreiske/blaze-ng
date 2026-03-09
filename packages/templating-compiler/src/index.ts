/**
 * @blaze-ng/templating-compiler — HTML template compiler for Blaze-NG.
 *
 * Provides `compileTemplates`, which takes raw HTML template source and
 * compiles it into JavaScript code ready for execution. This combines
 * the HTML scanner and Spacebars compiler from `@blaze-ng/templating-tools`.
 *
 * In the original Meteor Blaze, this package registers a build plugin
 * via `Plugin.registerCompiler`. In Blaze-NG, it provides the same
 * compilation pipeline as a library function.
 */

import {
  scanHtmlForTags,
  compileTagsWithSpacebars,
} from '@blaze-ng/templating-tools';
import type { ScanOptions, ScannedTag, CompileResult } from '@blaze-ng/templating-tools';

export type { ScanOptions, ScannedTag, CompileResult };

/**
 * Compile an HTML template source string into JavaScript code.
 *
 * This is the main entry point for the templating compiler. It:
 * 1. Scans the HTML for `<template>` and `<body>` tags
 * 2. Compiles each tag's content using Spacebars
 * 3. Returns the generated JavaScript code
 *
 * @param source - The raw HTML template source.
 * @param sourceName - An identifier for the source (e.g., filename), used in error messages.
 * @param options - Options passed to the HTML scanner.
 * @returns The compilation result with head, body, and template JS.
 */
export function compileTemplates(
  source: string,
  sourceName: string,
  options?: ScanOptions,
): CompileResult {
  const tags = scanHtmlForTags(source, sourceName, options);
  return compileTagsWithSpacebars(tags, sourceName);
}

// Re-export individual steps for advanced usage
export { scanHtmlForTags, compileTagsWithSpacebars };
