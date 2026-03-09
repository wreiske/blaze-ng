import { HTML } from '@blaze-ng/htmljs';
import type { Tag } from '@blaze-ng/htmljs';
import { TreeTransformer, toRaw } from './optimizer';

/**
 * Compact consecutive Raw nodes in an array.
 *
 * @param array - Array of HTMLjs nodes.
 * @returns Compacted array.
 */
function compactRaw(array: unknown[]): unknown[] {
  const result: unknown[] = [];
  for (let i = 0; i < array.length; i++) {
    const item = array[i];
    if (item instanceof HTML.Raw) {
      if (!(item as { value: string }).value) {
        continue;
      }
      if (result.length && result[result.length - 1] instanceof HTML.Raw) {
        result[result.length - 1] = new HTML.Raw(
          (result[result.length - 1] as { value: string }).value +
            (item as { value: string }).value,
        );
        continue;
      }
    }
    result.push(item);
  }
  return result;
}

function replaceIfContainsNewline(match: string): string {
  if (match.indexOf('\n') >= 0) {
    return '';
  }
  return match;
}

/**
 * Strip leading/trailing whitespace from Raw nodes when it contains newlines.
 *
 * @param array - Array of HTMLjs nodes.
 * @returns Stripped array.
 */
function stripWhitespace(array: unknown[]): unknown[] {
  const result: unknown[] = [];
  for (let i = 0; i < array.length; i++) {
    let item = array[i];
    if (item instanceof HTML.Raw) {
      const value = (item as { value: string }).value;
      // remove nodes that contain only whitespace & a newline
      if (value.indexOf('\n') !== -1 && !/\S/.test(value)) {
        continue;
      }
      let newStr = value;
      newStr = newStr.replace(/^\s+/, replaceIfContainsNewline);
      newStr = newStr.replace(/\s+$/, replaceIfContainsNewline);
      if (newStr !== value) {
        item = new HTML.Raw(newStr);
      }
    }
    result.push(item);
  }
  return result;
}

/**
 * Visitor that removes insignificant whitespace from the tree.
 */
class WhitespaceRemovingVisitor extends TreeTransformer {
  override visitNull(x: unknown): unknown {
    return toRaw(x);
  }
  override visitPrimitive(x: string | boolean | number): unknown {
    return toRaw(x);
  }
  override visitCharRef(x: unknown): unknown {
    return toRaw(x);
  }
  override visitArray(array: unknown[]): unknown {
    let result = TreeTransformer.prototype.visitArray.call(this, array) as unknown[];
    result = compactRaw(result);
    result = stripWhitespace(result);
    return result;
  }
  override visitTag(tag: Tag): unknown {
    const tagName = tag.tagName;
    if (
      tagName === 'textarea' ||
      tagName === 'script' ||
      tagName === 'pre' ||
      !HTML.isKnownElement(tagName) ||
      HTML.isKnownSVGElement(tagName)
    ) {
      return tag;
    }
    return TreeTransformer.prototype.visitTag.call(this, tag);
  }
  override visitAttributes(attrs: unknown): unknown {
    return attrs;
  }
}

/**
 * Remove insignificant whitespace from an HTMLjs tree.
 *
 * @param tree - The HTMLjs tree.
 * @returns Tree with whitespace removed.
 */
export function removeWhitespace(tree: unknown): unknown {
  return new WhitespaceRemovingVisitor().visit(tree);
}
