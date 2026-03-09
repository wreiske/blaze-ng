/**
 * Exception reporting utilities for the Blaze view engine.
 *
 * We call into user code in many places, and it's nice to catch exceptions
 * propagated from user code immediately so that the whole system doesn't just
 * break. Catching exceptions is easy; reporting them is hard. These helpers
 * report exceptions.
 */

/**
 * Set this to `true` to cause `_reportException` to throw
 * the next exception rather than reporting it. Useful in
 * unit tests that test error messages.
 */
export let _throwNextException = false;

/**
 * Set the _throwNextException flag.
 *
 * @param value - Whether to throw the next exception.
 */
export function setThrowNextException(value: boolean): void {
  _throwNextException = value;
}

/**
 * Report an exception, either by throwing it (if _throwNextException is set)
 * or by logging it to the console.
 *
 * @param e - The error to report.
 * @param msg - Optional message prefix.
 */
export function _reportException(e: unknown, msg?: string): void {
  if (_throwNextException) {
    _throwNextException = false;
    throw e;
  }

  const debugFn = typeof console !== 'undefined' && console.log ? console.log : () => {};

  const error = e as { stack?: string; message?: string };
  debugFn(msg || 'Exception caught in template:', error.stack || error.message || e);
}

/**
 * Report an exception and re-throw it. Meant to be used in Promise chains
 * to report the error while not "swallowing" it.
 *
 * @param error - The error to report and throw.
 * @throws Always throws the provided error.
 */
export function _reportExceptionAndThrow(error: unknown): never {
  _reportException(error);
  throw error;
}

/**
 * Wrap a function to catch and report exceptions.
 *
 * @param f - The function to wrap.
 * @param where - A description of where this function is called from.
 * @returns The wrapped function, or `f` unchanged if it's not a function.
 */
export function _wrapCatchingExceptions<T>(f: T, where: string): T {
  if (typeof f !== 'function') return f;

  return function (this: unknown, ...args: unknown[]) {
    try {
      return (f as (...args: unknown[]) => unknown).apply(this, args);
    } catch (e) {
      _reportException(e, 'Exception in ' + where + ':');
    }
  } as unknown as T;
}
