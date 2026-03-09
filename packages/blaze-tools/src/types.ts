/**
 * Minimal scanner interface expected by token parsers.
 *
 * The full implementation lives in `@blaze-ng/html-tools`.
 * This interface defines just the surface needed by blaze-tools.
 */
export interface Scanner {
  pos: number;
  readonly input: string;
  peek(): string;
  rest(): string;
  isEOF(): boolean;
  fatal(message: string): never;
}

/** Result of parsing a number literal. */
export interface NumberToken {
  text: string;
  value: number;
}

/** Result of parsing a string literal. */
export interface StringToken {
  text: string;
  value: string;
}
