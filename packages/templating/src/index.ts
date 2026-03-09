/**
 * @blaze-ng/templating — Meta-package combining runtime and compiler.
 *
 * Re-exports everything from:
 * - `@blaze-ng/templating-runtime` (Template, body, dynamic templates, HMR)
 * - `@blaze-ng/templating-compiler` (compileTemplates, scanHtmlForTags)
 */

export {
  Template,
  __checkName,
  __define__,
  body,
  addBodyContent,
  renderToDocument,
  getBodyView,
  getRegisteredTemplate,
  _migrateTemplate,
  _markPendingReplacement,
  _applyHmrChanges,
  _resetRegistry,
  __dynamic,
  __dynamicWithDataContext,
} from '@blaze-ng/templating-runtime';

export {
  compileTemplates,
  scanHtmlForTags,
  compileTagsWithSpacebars,
} from '@blaze-ng/templating-compiler';
export type { ScanOptions, ScannedTag, CompileResult } from '@blaze-ng/templating-compiler';
