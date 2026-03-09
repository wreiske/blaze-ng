/**
 * A generic input scanner for parsers, lexers, and tokenizers.
 *
 * Holds an immutable source string and a mutable position index.
 */
export class Scanner {
  /** The source input (read-only). */
  readonly input: string;

  /** Current position in the input (read-write). */
  pos: number;

  /** Optional hook for parsing template tags. Set externally. */
  getTemplateTag?: GetTemplateTagFn;

  constructor(input: string) {
    this.input = input;
    this.pos = 0;
  }

  /** Returns the rest of the input after the current position. */
  rest(): string {
    return this.input.slice(this.pos);
  }

  /** Returns the character at the current position, or '' if EOF. */
  peek(): string {
    return this.input.charAt(this.pos);
  }

  /** Returns true if the position is at or beyond the end of input. */
  isEOF(): boolean {
    return this.pos >= this.input.length;
  }

  /**
   * Throw a parse error with context about the current position.
   * @param msg - Error message describing the problem.
   * @throws {ScannerError} Always throws with positional info.
   */
  fatal(msg: string): never {
    msg = msg || 'Parse error';

    const CONTEXT_AMOUNT = 20;
    const { input, pos } = this;

    let pastInput = input.substring(pos - CONTEXT_AMOUNT - 1, pos);
    if (pastInput.length > CONTEXT_AMOUNT) pastInput = '...' + pastInput.substring(-CONTEXT_AMOUNT);

    let upcomingInput = input.substring(pos, pos + CONTEXT_AMOUNT + 1);
    if (upcomingInput.length > CONTEXT_AMOUNT)
      upcomingInput = upcomingInput.substring(0, CONTEXT_AMOUNT) + '...';

    const positionDisplay =
      (pastInput + upcomingInput).replace(/\n/g, ' ') + '\n' + ' '.repeat(pastInput.length) + '^';

    const e = new Error(msg + '\n' + positionDisplay) as ScannerError;
    e.offset = pos;
    const allPastInput = input.substring(0, pos);
    e.line = 1 + (allPastInput.match(/\n/g) || []).length;
    e.col = 1 + pos - allPastInput.lastIndexOf('\n');
    e.scanner = this;

    throw e;
  }
}

/** Error subtype thrown by Scanner.fatal(). */
export interface ScannerError extends Error {
  offset: number;
  line: number;
  col: number;
  scanner: Scanner;
}

/** Signature for the getTemplateTag hook. */
export type GetTemplateTagFn = (scanner: Scanner, position: number) => unknown | null;

/**
 * Construct a matcher function from a regex.
 *
 * The regex should start with `^`. The returned function attempts to match
 * at the scanner's current position; on success it advances the position
 * and returns match group 1 (if non-empty) or the full match. On failure
 * it returns null without advancing.
 *
 * @param regex - A RegExp starting with `^`.
 * @returns A function `(scanner) => string | null`.
 */
export function makeRegexMatcher(regex: RegExp): (scanner: Scanner) => string | null {
  return (scanner: Scanner) => {
    const match = regex.exec(scanner.rest());
    if (!match) return null;
    scanner.pos += match[0].length;
    return match[1] || match[0];
  };
}
