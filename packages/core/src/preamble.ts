/**
 * Blaze namespace preamble — core utility functions.
 *
 * Provides HTML-escaping, warnings, and function binding utilities
 * used throughout the Blaze view engine.
 */

const ESCAPE_MAP: Record<string, string> = {
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
  '/': '&#x2F;',
  '`': '&#x60;',
  '&': '&amp;',
};

/**
 * HTML-escape a string.
 *
 * @param x - The string to escape.
 * @returns The escaped string.
 */
export function _escape(x: string): string {
  return x.replace(/[&<>"'`]/g, (c) => ESCAPE_MAP[c]!);
}

/**
 * Emit a warning message to the console.
 *
 * @param msg - The warning message.
 */
export function _warn(msg: string): void {
  msg = 'Warning: ' + msg;
  if (typeof console !== 'undefined' && console.warn) {
    console.warn(msg);
  }
}

/**
 * Bind a function to a context, with optional partial application.
 *
 * @param func - The function to bind.
 * @param obj - The `this` context.
 * @param args - Additional arguments to partially apply.
 * @returns The bound function.
 */
export function _bind(
  func: (...args: unknown[]) => unknown,
  obj: unknown,
  ...args: unknown[]
): (...args: unknown[]) => unknown {
  if (args.length === 0) {
    return func.bind(obj as object);
  }
  return func.bind(obj as object, ...args);
}
