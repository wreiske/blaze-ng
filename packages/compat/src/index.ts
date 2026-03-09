/**
 * @blaze-ng/compat — Backward compatibility aliases for legacy Meteor code.
 *
 * Provides `UI` and `Handlebars` namespaces that map to modern Blaze-NG APIs.
 * All aliases emit deprecation warnings on first use in development builds.
 *
 * This enables code written for Meteor 0.9–1.x (using `UI.*` or
 * `Handlebars.*`) to continue working against Blaze-NG.
 *
 * @example
 * ```ts
 * import { UI, Handlebars } from '@blaze-ng/compat';
 *
 * // Legacy code continues to work:
 * Handlebars.registerHelper('formatDate', (date) => date.toLocaleDateString());
 * ```
 */

import * as Blaze from '@blaze-ng/core';

const _warned = new Set<string>();

/**
 * Emit a one-time deprecation warning.
 *
 * @param api - The deprecated API name.
 * @param replacement - The modern replacement.
 */
function _deprecate(api: string, replacement: string): void {
  if (_warned.has(api)) return;
  _warned.add(api);
  console.warn(`[blaze-ng] "${api}" is deprecated. Use "${replacement}" instead.`);
}

/* -------------------------------------------------------------------------- */
/*  UI namespace                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Deprecated `UI` namespace — maps to `Blaze` for backward compatibility.
 *
 * @deprecated Use `Blaze` / `@blaze-ng/core` directly.
 */
export const UI = {
  /** @deprecated Use `Blaze.Template.instance()` */
  _templateInstance(): Blaze.TemplateInstance | null {
    _deprecate('UI._templateInstance', 'Blaze.Template.instance()');
    return Blaze.Template.instance();
  },

  /** @deprecated Use `Blaze.render()` */
  render(...args: Parameters<typeof Blaze.render>): ReturnType<typeof Blaze.render> {
    _deprecate('UI.render', 'Blaze.render()');
    return Blaze.render(...args);
  },

  /** @deprecated Use `Blaze.renderWithData()` */
  renderWithData(
    ...args: Parameters<typeof Blaze.renderWithData>
  ): ReturnType<typeof Blaze.renderWithData> {
    _deprecate('UI.renderWithData', 'Blaze.renderWithData()');
    return Blaze.renderWithData(...args);
  },

  /** @deprecated Use `Blaze.remove()` */
  remove(...args: Parameters<typeof Blaze.remove>): void {
    _deprecate('UI.remove', 'Blaze.remove()');
    Blaze.remove(...args);
  },

  /** @deprecated Use `Blaze.toHTML()` */
  toHTML(...args: Parameters<typeof Blaze.toHTML>): string {
    _deprecate('UI.toHTML', 'Blaze.toHTML()');
    return Blaze.toHTML(...args);
  },

  /** @deprecated Use `Blaze.getView()` */
  getView(...args: Parameters<typeof Blaze.getView>): Blaze.View | null {
    _deprecate('UI.getView', 'Blaze.getView()');
    return Blaze.getView(...args);
  },

  /** Access underlying Blaze for any other UI.* usage */
  get Template() {
    _deprecate('UI.Template', 'Template from @blaze-ng/core');
    return Blaze.Template;
  },
};

/* -------------------------------------------------------------------------- */
/*  Handlebars namespace                                                      */
/* -------------------------------------------------------------------------- */

/**
 * A string wrapper that prevents HTML escaping in templates.
 *
 * @deprecated Use `SafeString` from `@blaze-ng/spacebars` instead.
 */
export class SafeString {
  /** The wrapped string value. */
  string: string;

  constructor(value: string) {
    this.string = value;
  }

  toString(): string {
    return this.string;
  }
}

/**
 * Deprecated `Handlebars` namespace — maps to Blaze helpers for backward compat.
 *
 * @deprecated Use `Blaze.registerHelper()` / `@blaze-ng/core` directly.
 */
export const Handlebars = {
  /** @deprecated Use `Blaze.registerHelper()` */
  registerHelper(name: string, fn: unknown): void {
    _deprecate('Handlebars.registerHelper', 'Blaze.registerHelper()');
    Blaze.registerHelper(name, fn);
  },

  /** @deprecated Use `Blaze._escape()` */
  _escape(s: string): string {
    _deprecate('Handlebars._escape', 'Blaze._escape()');
    return Blaze._escape(s);
  },

  SafeString,
};

/**
 * Reset internal warning cache. For testing only.
 *
 * @internal
 */
export function _resetWarnings(): void {
  _warned.clear();
}
