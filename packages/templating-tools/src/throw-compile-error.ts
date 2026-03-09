/**
 * Error thrown during template compilation.
 *
 * Includes the source file name and line number where the error occurred.
 */
export class CompileError extends Error {
  file?: string;
  line?: number;

  constructor(message?: string) {
    super(message);
    this.name = 'CompileError';
  }
}

/** Tag descriptor passed to throwCompileError. */
export interface TagDescriptor {
  tagStartIndex: number;
  sourceName: string;
  fileContents: string;
  contentsStartIndex?: number;
}

/**
 * Throw a CompileError with file and line information derived from a tag.
 *
 * @param tag - The tag descriptor providing source context.
 * @param message - The error message.
 * @param overrideIndex - Optional character index to use instead of tag start.
 * @throws {CompileError} Always.
 */
export function throwCompileError(
  tag: TagDescriptor,
  message?: string,
  overrideIndex?: number,
): never {
  const finalIndex = typeof overrideIndex === 'number' ? overrideIndex : tag.tagStartIndex;

  const err = new CompileError(message || 'bad formatting in template file');
  err.file = tag.sourceName;
  err.line = tag.fileContents.substring(0, finalIndex).split('\n').length;
  throw err;
}
