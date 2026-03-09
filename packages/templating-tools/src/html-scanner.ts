import { CompileError } from './throw-compile-error';

/** Options for scanHtmlForTags. */
export interface ScanOptions {
  /** The source file name (used in error messages). */
  sourceName: string;
  /** The full file contents to scan. */
  contents: string;
  /** Array of allowed top-level tag names (e.g. ["body", "head", "template"]). */
  tagNames: string[];
}

/** A scanned tag descriptor. */
export interface ScannedTag {
  tagName: string;
  attribs: Record<string, string>;
  contents: string;
  contentsStartIndex: number;
  tagStartIndex: number;
  fileContents: string;
  sourceName: string;
}

/**
 * Scan an HTML file for top-level tags and extract their contents.
 *
 * This is a primitive, regex-based scanner. It scans top-level tags,
 * which are allowed to have attributes, and ignores top-level HTML comments.
 *
 * @param options - The scan options.
 * @returns Array of scanned tag descriptors.
 * @throws {CompileError} On unexpected tags or malformed HTML.
 */
export function scanHtmlForTags(options: ScanOptions): ScannedTag[] {
  const scan = new HtmlScan(options);
  return scan.getTags();
}

class HtmlScan {
  private sourceName: string;
  private contents: string;
  private tagNames: string[];
  private rest: string;
  private index: number;
  private tags: ScannedTag[];

  constructor({ sourceName, contents, tagNames }: ScanOptions) {
    this.sourceName = sourceName;
    this.contents = contents;
    this.tagNames = tagNames;
    this.rest = contents;
    this.index = 0;
    this.tags = [];

    const tagNameRegex = this.tagNames.join('|');
    const openTagRegex = new RegExp(`^((<(${tagNameRegex})\\b)|(<!--)|(<!DOCTYPE|{{!)|$)`, 'i');

    while (this.rest) {
      // skip whitespace first (for better line numbers)
      this.advance(this.rest.match(/^\s*/)![0].length);

      const match = openTagRegex.exec(this.rest);

      if (!match) {
        this.throwCompileError(`Expected one of: <${this.tagNames.join('>, <')}>`);
      }

      const matchToken = match[1];
      const matchTokenTagName = match[3];
      const matchTokenComment = match[4];
      const matchTokenUnsupported = match[5];

      const tagStartIndex = this.index;
      this.advance(match.index + match[0].length);

      if (!matchToken) {
        break; // matched $ (end of file)
      }

      if (matchTokenComment === '<!--') {
        // top-level HTML comment
        const commentEnd = /--\s*>/.exec(this.rest);
        if (!commentEnd) this.throwCompileError('unclosed HTML comment in template file');
        this.advance(commentEnd.index + commentEnd[0].length);
        continue;
      }

      if (matchTokenUnsupported) {
        switch (matchTokenUnsupported.toLowerCase()) {
          case '<!doctype':
            this.throwCompileError(
              "Can't set DOCTYPE here.  (Meteor sets <!DOCTYPE html> for you)",
            );
            break; // unreachable, but satisfies linter
          case '{{!':
            this.throwCompileError("Can't use '{{! }}' outside a template.  Use '<!-- -->'.");
            break;
        }

        this.throwCompileError();
      }

      // otherwise, a <tag>
      const tagName = matchTokenTagName.toLowerCase();
      const tagAttribs: Record<string, string> = {};
      const tagPartRegex = /^\s*((([a-zA-Z0-9:_-]+)\s*=\s*(["'])(.*?)\4)|(>))/;

      // read attributes
      let attr: RegExpExecArray | null;
      while ((attr = tagPartRegex.exec(this.rest))) {
        const attrToken = attr[1];
        const attrKey = attr[3];
        let attrValue = attr[5];
        this.advance(attr.index + attr[0].length);

        if (attrToken === '>') {
          break;
        }

        // trim attribute value
        attrValue = attrValue.match(/^\s*([\s\S]*?)\s*$/)![1];
        tagAttribs[attrKey] = attrValue;
      }

      if (!attr) {
        // didn't end on '>'
        this.throwCompileError('Parse error in tag');
      }

      // find </tag>
      const end = new RegExp('</' + tagName + '\\s*>', 'i').exec(this.rest);
      if (!end) {
        this.throwCompileError('unclosed <' + tagName + '>');
      }

      const tagContents = this.rest.slice(0, end.index);
      const contentsStartIndex = this.index;

      // trim the tag contents (courtesy, also relied on by some tests)
      const m = tagContents.match(/^([ \t\r\n]*)([\s\S]*?)[ \t\r\n]*$/)!;
      const trimmedContentsStartIndex = contentsStartIndex + m[1].length;
      const trimmedTagContents = m[2];

      const tag: ScannedTag = {
        tagName,
        attribs: tagAttribs,
        contents: trimmedTagContents,
        contentsStartIndex: trimmedContentsStartIndex,
        tagStartIndex,
        fileContents: this.contents,
        sourceName: this.sourceName,
      };

      this.tags.push(tag);

      // advance afterwards, so that line numbers in errors are correct
      this.advance(end.index + end[0].length);
    }
  }

  private advance(amount: number): void {
    this.rest = this.rest.substring(amount);
    this.index += amount;
  }

  private throwCompileError(msg?: string, overrideIndex?: number): never {
    const finalIndex = typeof overrideIndex === 'number' ? overrideIndex : this.index;

    const err = new CompileError(msg || 'bad formatting in template file');
    err.file = this.sourceName;
    err.line = this.contents.substring(0, finalIndex).split('\n').length;

    throw err;
  }

  getTags(): ScannedTag[] {
    return this.tags;
  }
}
