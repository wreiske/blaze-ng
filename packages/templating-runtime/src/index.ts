/**
 * @blaze-ng/templating-runtime — Runtime for compiled .html templates.
 *
 * Provides:
 * - Template name registration and validation (`__checkName`, `__define__`)
 * - Template.body for root `<body>` content
 * - `renderToDocument` for mounting the body template
 * - HMR integration for live template replacement
 * - Dynamic template inclusion (`__dynamic`, `__dynamicWithDataContext`)
 */

import {
  Template,
  isTemplate,
  View,
  render,
  renderWithData,
  remove,
  _getTemplate,
  __rootViews,
} from '@blaze-ng/core';
import { include } from '@blaze-ng/spacebars';

// Re-export Template for consumers
export { Template };

// ─── Reserved names ─────────────────────────────────────────────────────────

const RESERVED_TEMPLATE_NAMES = ['__proto__', 'name'];

// ─── Template name registry ────────────────────────────────────────────────

/**
 * Registry of named templates, keyed by template name.
 *
 * Compiled .html files register templates here via `__define__` or
 * `_migrateTemplate`. Template lookup by name uses this map.
 */
const _templateRegistry = new Map<string, Template>();

/**
 * Look up a registered template by name.
 *
 * @param name - The template name to look up.
 * @returns The registered template, or undefined.
 */
export function getRegisteredTemplate(name: string): Template | undefined {
  return _templateRegistry.get(name);
}

/**
 * Check if a template name is valid and not already registered.
 *
 * Throws if the name is reserved or a duplicate.
 *
 * @param name - The template name to validate.
 * @throws {Error} If the name is reserved or already registered.
 */
export function __checkName(name: string): void {
  if (RESERVED_TEMPLATE_NAMES.includes(name)) {
    throw new Error('This template name is reserved: ' + name);
  }
  const existing = _templateRegistry.get(name);
  if (existing) {
    if (isTemplate(existing) && name !== 'body') {
      throw new Error(
        "There are multiple templates named '" +
          name +
          "'. Each template needs a unique name.",
      );
    }
    throw new Error('This template name is reserved: ' + name);
  }
}

/**
 * Define a named template (legacy compat with pre-0.9.0 Blaze).
 *
 * Creates a new Template with the given render function and registers
 * it under the given name. The viewName is set to `"Template.<name>"`.
 *
 * @param name - The template name.
 * @param renderFunc - The template's render function.
 */
export function __define__(name: string, renderFunc: () => unknown): void {
  __checkName(name);
  const tmpl = new Template('Template.' + name, renderFunc);
  (tmpl as Template & { _NOWARN_OLDSTYLE_HELPERS?: boolean })._NOWARN_OLDSTYLE_HELPERS = true;
  _templateRegistry.set(name, tmpl);
}

// ─── Template.body ──────────────────────────────────────────────────────────

/** Render functions added by `<body>` tags. */
const _bodyContentRenderFuncs: Array<() => unknown> = [];

/** The rendered body View, or null if not yet rendered. */
let _bodyView: View | null = null;

/**
 * The body template — renders all `<body>` content render functions.
 */
export const body = new Template('body', function (this: View) {
  const view = this;
  return _bodyContentRenderFuncs.map((func) => func.apply(view));
});

/**
 * Add a content render function to the body template.
 *
 * Called by compiled `<body>` tags to register their content.
 *
 * @param renderFunc - The render function to add.
 */
export function addBodyContent(renderFunc: () => unknown): void {
  _bodyContentRenderFuncs.push(renderFunc);
}

/**
 * Render `Template.body` into `document.body`.
 *
 * Idempotent — does nothing if already rendered.
 */
export function renderToDocument(): void {
  if (_bodyView) return;
  _bodyView = render(body, document.body);
}

/**
 * Get the current body view.
 *
 * @returns The rendered body view, or null.
 */
export function getBodyView(): View | null {
  return _bodyView;
}

// ─── HMR Support ────────────────────────────────────────────────────────────

/** Templates pending replacement during HMR. */
const _pendingReplacement: string[] = [];

/** Debounce timeout for HMR updates. */
let _updateTimeout: ReturnType<typeof setTimeout> | null = null;

/**
 * Apply HMR changes by re-rendering all root views.
 *
 * Debounced so that multiple template replacements in one rebuild
 * only trigger a single re-render pass.
 *
 * @param _templateName - The name of the changed template (unused, for API compat).
 */
export function _applyHmrChanges(_templateName?: string): void {
  if (_updateTimeout) return;

  _updateTimeout = setTimeout(() => {
    _updateTimeout = null;

    for (const name of _pendingReplacement) {
      _templateRegistry.delete(name);
    }
    _pendingReplacement.length = 0;

    const views = __rootViews.slice();
    for (const view of views) {
      if (view.isDestroyed) continue;

      const renderFunc = (view as View & { _render?: () => unknown })._render;
      let parentEl: Element | undefined;
      if (view._domrange?.parentElement) {
        parentEl = view._domrange.parentElement;
      } else if ((view as View & { _hmrParent?: Element })._hmrParent) {
        parentEl = (view as View & { _hmrParent?: Element })._hmrParent;
      }

      let comment: Comment | undefined;
      if ((view as View & { _hmrAfter?: Comment })._hmrAfter) {
        comment = (view as View & { _hmrAfter?: Comment })._hmrAfter;
      } else if (view._domrange) {
        const first = view._domrange.firstNode();
        comment = document.createComment('Blaze HMR Placeholder');
        parentEl?.insertBefore(comment, first);
      }

      (view as View & { _hmrAfter?: Comment | null })._hmrAfter = null;
      (view as View & { _hmrParent?: Element | null })._hmrParent = null;

      if (view._domrange) {
        remove(view);
      }

      try {
        if (view === _bodyView) {
          const newView = render(body, document.body, comment);
          _bodyView = newView;
        } else if ((view as View & { dataVar?: { curValue?: { value?: unknown } } }).dataVar && renderFunc) {
          renderWithData(
            renderFunc,
            (view as View & { dataVar: { curValue: { value: unknown } } }).dataVar.curValue?.value,
            parentEl!,
            comment,
          );
        } else if (renderFunc && parentEl) {
          render(renderFunc, parentEl, comment);
        }

        if (comment && parentEl) {
          parentEl.removeChild(comment);
        }
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('[Blaze HMR] Error re-rendering template:', e);

        const newestRoot = __rootViews[__rootViews.length - 1];
        if (newestRoot && newestRoot.isCreated && !newestRoot.isRendered) {
          (newestRoot as View & { _hmrAfter?: Comment })._hmrAfter = comment;
          (newestRoot as View & { _hmrParent?: Element })._hmrParent = parentEl;
        }
      }
    }
  });
}

/**
 * Register a new template, migrating helpers/events from an old version
 * if one exists (for HMR). Replaces the old template in the registry.
 *
 * @param templateName - The template name.
 * @param newTemplate - The new Template instance.
 */
export function _migrateTemplate(templateName: string, newTemplate: Template): void {
  const oldTemplate = _templateRegistry.get(templateName);
  const shouldMigrate = _pendingReplacement.indexOf(templateName) > -1;

  if (oldTemplate && shouldMigrate) {
    (newTemplate as Template & { __helpers?: unknown }).__helpers =
      (oldTemplate as Template & { __helpers?: unknown }).__helpers;
    (newTemplate as Template & { __eventMaps?: unknown[] }).__eventMaps =
      (oldTemplate as Template & { __eventMaps?: unknown[] }).__eventMaps;
    newTemplate._callbacks.created = oldTemplate._callbacks.created;
    newTemplate._callbacks.rendered = oldTemplate._callbacks.rendered;
    newTemplate._callbacks.destroyed = oldTemplate._callbacks.destroyed;
    _templateRegistry.delete(templateName);
    _applyHmrChanges(templateName);
  }

  if (shouldMigrate) {
    _pendingReplacement.splice(_pendingReplacement.indexOf(templateName), 1);
  }

  __checkName(templateName);
  _templateRegistry.set(templateName, newTemplate);
}

/**
 * Mark a template as pending replacement for HMR.
 *
 * @param name - The template name to mark.
 */
export function _markPendingReplacement(name: string): void {
  if (_pendingReplacement.indexOf(name) === -1) {
    _pendingReplacement.push(name);
  }
}

// ─── Dynamic templates ─────────────────────────────────────────────────────

/**
 * The `__dynamicWithDataContext` helper template.
 *
 * Used internally by the `__dynamic` template to resolve template names
 * to Template instances.
 */
export const __dynamicWithDataContext = new Template(
  '__dynamicWithDataContext',
  function (this: View) {
    const view = this;
    const templateName = view.lookup?.('template') as string;
    const tmpl = _getTemplate(templateName, () => view);
    if (!tmpl) return null;
    return include(tmpl as Template);
  },
);

__dynamicWithDataContext.helpers({
  chooseTemplate: function (this: { template?: string }, name: string) {
    return _getTemplate(name, () => Template.instance?.() as unknown);
  },
});

/**
 * The `__dynamic` helper template.
 *
 * Usage: `{{> Template.dynamic template=name data=context}}`
 */
export const __dynamic = new Template('__dynamic', function (this: View) {
  const view = this;
  const data = view.lookup?.('.') as Record<string, unknown> | undefined;

  if (!data || !('template' in data)) {
    throw new Error(
      "Must specify name in the 'template' argument to {{> Template.dynamic}}.",
    );
  }

  for (const k of Object.keys(data)) {
    if (k !== 'template' && k !== 'data') {
      throw new Error('Invalid argument to {{> Template.dynamic}}: ' + k);
    }
  }

  const hasData = 'data' in data;
  const templateName = data.template as string;

  const tmpl = _getTemplate(templateName, () => view);
  if (!tmpl) return null;

  if (hasData) {
    // Render with explicit data context
    const contentView = (tmpl as Template).constructView();
    // NOTE: data context is set up by the enclosing With/renderWithData
    return contentView;
  }

  return include(tmpl as Template);
});

// Register the dynamic templates so they can be found by name
_templateRegistry.set('__dynamic', __dynamic);
_templateRegistry.set('__dynamicWithDataContext', __dynamicWithDataContext);
_templateRegistry.set('body', body);

// ─── Cleanup utility (for testing) ─────────────────────────────────────────

/**
 * Clear all registered templates and reset state.
 *
 * Used in tests to ensure clean state between test runs.
 */
export function _resetRegistry(): void {
  _templateRegistry.clear();
  _bodyContentRenderFuncs.length = 0;
  _bodyView = null;
  _pendingReplacement.length = 0;
  if (_updateTimeout) {
    clearTimeout(_updateTimeout);
    _updateTimeout = null;
  }
  // Re-register built-in templates
  _templateRegistry.set('__dynamic', __dynamic);
  _templateRegistry.set('__dynamicWithDataContext', __dynamicWithDataContext);
  _templateRegistry.set('body', body);
}
