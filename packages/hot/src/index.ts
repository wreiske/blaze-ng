/**
 * @blaze-ng/hot — Hot Module Replacement support for Blaze-NG templates.
 *
 * Patches `Template` registration to track which source module defined
 * each template. When a module is re-evaluated during HMR, only the
 * templates from that module are re-rendered — avoiding a full page reload.
 *
 * This package is intended for **development only**. It hooks into the
 * bundler's `module.hot` API (Webpack / Rspack).
 *
 * @example
 * ```ts
 * // In your client entry point (development only):
 * import '@blaze-ng/hot';
 * ```
 */

import type { View } from '@blaze-ng/core';
import { render, remove } from '@blaze-ng/core';
import {
  _migrateTemplate,
  _applyHmrChanges,
  _markPendingReplacement,
  getRegisteredTemplate,
} from '@blaze-ng/templating-runtime';

/* -------------------------------------------------------------------------- */
/*  Source module tracking                                                     */
/* -------------------------------------------------------------------------- */

/** Symbol used to tag a Template with its source module ID. */
const SOURCE_MODULE = Symbol('blaze-ng:sourceModule');

/** Map from template name → most recent source module ID. */
const _templateModuleMap = new Map<string, string>();

/**
 * Get the source module ID that defined a template.
 *
 * @param name - The template name.
 * @returns The module ID, or undefined.
 */
export function getTemplateModule(name: string): string | undefined {
  return _templateModuleMap.get(name);
}

/**
 * Associate a template with the module that defines it.
 *
 * @param name - The template name.
 * @param moduleId - The module ID from the bundler.
 */
export function setTemplateModule(name: string, moduleId: string): void {
  _templateModuleMap.set(name, moduleId);
  const tmpl = getRegisteredTemplate(name);
  if (tmpl) {
    (tmpl as unknown as Record<symbol, string>)[SOURCE_MODULE] = moduleId;
  }
}

/* -------------------------------------------------------------------------- */
/*  Rendered view tracking                                                    */
/* -------------------------------------------------------------------------- */

/** Map from template name → set of currently rendered Views. */
const _renderedViews = new Map<string, Set<View>>();

/**
 * Track a rendered view for HMR re-rendering.
 *
 * @param name - The template name.
 * @param view - The rendered view.
 */
export function trackRenderedView(name: string, view: View): void {
  let views = _renderedViews.get(name);
  if (!views) {
    views = new Set();
    _renderedViews.set(name, views);
  }
  views.add(view);
}

/**
 * Stop tracking a destroyed view.
 *
 * @param name - The template name.
 * @param view - The view to untrack.
 */
export function untrackRenderedView(name: string, view: View): void {
  const views = _renderedViews.get(name);
  if (views) {
    views.delete(view);
    if (views.size === 0) {
      _renderedViews.delete(name);
    }
  }
}

/* -------------------------------------------------------------------------- */
/*  HMR re-rendering                                                          */
/* -------------------------------------------------------------------------- */

/** Signal to re-render all templates (e.g., after a global helper change). */
export const UPDATE_ALL = Symbol('blaze-ng:updateAll');

/**
 * Re-render templates affected by an HMR update.
 *
 * For each affected template, finds its rendered views, destroys the old
 * DOM, and re-renders in the same position.
 *
 * @param templateNames - Names of templates to re-render, or UPDATE_ALL for all.
 */
export function applyHmrUpdate(templateNames: string[] | typeof UPDATE_ALL): void {
  const names = templateNames === UPDATE_ALL ? [..._renderedViews.keys()] : templateNames;

  for (const name of names) {
    const views = _renderedViews.get(name);
    if (!views || views.size === 0) continue;

    const tmpl = getRegisteredTemplate(name);
    if (!tmpl) continue;

    // Snapshot the set since we'll modify it during re-render
    const snapshot = [...views];

    for (const view of snapshot) {
      if (view.isDestroyed) {
        views.delete(view);
        continue;
      }

      // Find the DOMRange for this view
      const range = view._domrange;
      if (!range) continue;

      // Get the parent element for re-rendering
      const parentEl = range.parentElement;
      if (!parentEl) continue;

      // Get a reference node for insertion position
      const nextNode = range.lastNode()?.nextSibling ?? null;

      // Remove the old view
      remove(view);
      views.delete(view);

      // Re-render at the same position
      const newView = render(tmpl, parentEl, nextNode);
      if (newView) {
        trackRenderedView(name, newView);
      }
    }
  }
}

/**
 * Clean template state when a module is disposed during HMR.
 *
 * Marks the template for pending replacement so the next define
 * replaces rather than errors on duplicate.
 *
 * @param moduleId - The module being disposed.
 */
export function cleanModule(moduleId: string): void {
  for (const [name, mid] of _templateModuleMap) {
    if (mid === moduleId) {
      _markPendingReplacement(name);
    }
  }
}

/**
 * Reset all HMR tracking state. For testing only.
 *
 * @internal
 */
export function _resetHmrState(): void {
  _templateModuleMap.clear();
  _renderedViews.clear();
}
