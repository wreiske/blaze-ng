import { TemplateTag as HtmlToolsTemplateTag } from '@blaze-ng/html-tools';
import { HTML } from '@blaze-ng/htmljs';
import type { Tag, Raw } from '@blaze-ng/htmljs';

const OPTIMIZABLE = {
  NONE: 0,
  PARTS: 1,
  FULL: 2,
} as const;

type Optimizability = (typeof OPTIMIZABLE)[keyof typeof OPTIMIZABLE];

/**
 * Visitor that determines how optimizable content is.
 *
 * FULL = can be turned into a Raw HTML string.
 * PARTS = contains some optimizable children.
 * NONE = cannot be optimized at all (e.g. SVG, template tags).
 */
class CanOptimizeVisitor extends HTML.Visitor {
  override visitNull(): Optimizability {
    return OPTIMIZABLE.FULL;
  }
  override visitPrimitive(): Optimizability {
    return OPTIMIZABLE.FULL;
  }
  override visitComment(): Optimizability {
    return OPTIMIZABLE.FULL;
  }
  override visitCharRef(): Optimizability {
    return OPTIMIZABLE.FULL;
  }
  override visitRaw(): Optimizability {
    return OPTIMIZABLE.FULL;
  }
  override visitObject(): Optimizability {
    return OPTIMIZABLE.NONE;
  }
  override visitFunction(): Optimizability {
    return OPTIMIZABLE.NONE;
  }
  override visitArray(x: unknown[]): Optimizability {
    for (let i = 0; i < x.length; i++)
      if ((this.visit(x[i]) as Optimizability) !== OPTIMIZABLE.FULL) return OPTIMIZABLE.PARTS;
    return OPTIMIZABLE.FULL;
  }
  override visitTag(tag: Tag): Optimizability {
    const tagName = tag.tagName;
    if (tagName === 'textarea') {
      return OPTIMIZABLE.NONE;
    } else if (tagName === 'script') {
      return OPTIMIZABLE.NONE;
    } else if (!(HTML.isKnownElement(tagName) && !HTML.isKnownSVGElement(tagName))) {
      return OPTIMIZABLE.NONE;
    } else if (tagName === 'table') {
      return OPTIMIZABLE.PARTS;
    } else if (tagName === 'tr') {
      return OPTIMIZABLE.PARTS;
    }

    const children = tag.children;
    for (let i = 0; i < children.length; i++)
      if ((this.visit(children[i]) as Optimizability) !== OPTIMIZABLE.FULL)
        return OPTIMIZABLE.PARTS;

    if ((this.visitAttributes(tag.attrs) as unknown as Optimizability) !== OPTIMIZABLE.FULL)
      return OPTIMIZABLE.PARTS;

    return OPTIMIZABLE.FULL;
  }
  visitAttributes(attrs: unknown): Optimizability {
    if (attrs) {
      const isArr = HTML.isArray(attrs);
      const len = isArr ? (attrs as unknown[]).length : 1;
      for (let i = 0; i < len; i++) {
        const a = isArr ? (attrs as unknown[])[i] : attrs;
        if (typeof a !== 'object' || a instanceof HtmlToolsTemplateTag) return OPTIMIZABLE.PARTS;
        for (const k in a as Record<string, unknown>)
          if (
            (this.visit((a as Record<string, unknown>)[k]) as Optimizability) !== OPTIMIZABLE.FULL
          )
            return OPTIMIZABLE.PARTS;
      }
    }
    return OPTIMIZABLE.FULL;
  }
}

function getOptimizability(content: unknown): Optimizability {
  return new CanOptimizeVisitor().visit(content) as Optimizability;
}

/**
 * Convert content to a Raw HTML node.
 *
 * @param x - The content to convert.
 * @returns An HTML.Raw node.
 */
export function toRaw(x: unknown): Raw {
  return new HTML.Raw(HTML.toHTML(x));
}

/**
 * A TransformingVisitor that passes TemplateTags through in attributes.
 */
export class TreeTransformer extends HTML.TransformingVisitor {
  override visitAttributes(attrs: unknown, ...args: unknown[]): unknown {
    if (attrs instanceof HtmlToolsTemplateTag) return attrs;
    return super.visitAttributes(attrs, ...args);
  }
}

/**
 * Replace fully optimizable parts of the HTMLjs tree with Raw nodes.
 */
class OptimizingVisitor extends TreeTransformer {
  override visitNull(x: unknown): unknown {
    return toRaw(x);
  }
  override visitPrimitive(x: string | boolean | number): unknown {
    return toRaw(x);
  }
  override visitComment(x: unknown): unknown {
    return toRaw(x);
  }
  override visitCharRef(x: unknown): unknown {
    return toRaw(x);
  }
  override visitArray(array: unknown[]): unknown {
    const optimizability = getOptimizability(array);
    if (optimizability === OPTIMIZABLE.FULL) {
      return toRaw(array);
    } else if (optimizability === OPTIMIZABLE.PARTS) {
      return TreeTransformer.prototype.visitArray.call(this, array);
    }
    return array;
  }
  override visitTag(tag: Tag): unknown {
    const optimizability = getOptimizability(tag);
    if (optimizability === OPTIMIZABLE.FULL) {
      return toRaw(tag);
    } else if (optimizability === OPTIMIZABLE.PARTS) {
      return TreeTransformer.prototype.visitTag.call(this, tag);
    }
    return tag;
  }
  override visitChildren(children: unknown[]): unknown {
    // don't optimize the children array into a Raw object
    return TreeTransformer.prototype.visitArray.call(this, children);
  }
  override visitAttributes(attrs: unknown): unknown {
    return attrs;
  }
}

/**
 * Combine consecutive Raw nodes and remove empty ones.
 */
class RawCompactingVisitor extends TreeTransformer {
  override visitArray(array: unknown[]): unknown {
    const result: unknown[] = [];
    for (let i = 0; i < array.length; i++) {
      const item = array[i];
      if (
        item instanceof HTML.Raw &&
        (!(item as Raw).value || (result.length && result[result.length - 1] instanceof HTML.Raw))
      ) {
        if ((item as Raw).value) {
          result[result.length - 1] = new HTML.Raw(
            (result[result.length - 1] as Raw).value + (item as Raw).value,
          );
        }
      } else {
        result.push(this.visit(item));
      }
    }
    return result;
  }
}

/**
 * Replace Raw nodes that contain no special characters with plain strings.
 */
class RawReplacingVisitor extends TreeTransformer {
  override visitRaw(raw: Raw): unknown {
    const html = raw.value;
    if (html.indexOf('&') < 0 && html.indexOf('<') < 0) {
      return html;
    }
    return raw;
  }
}

/**
 * Optimize an HTMLjs tree by converting static parts to Raw HTML strings.
 *
 * Runs three passes: optimize → compact → replace.
 *
 * @param tree - The HTMLjs tree to optimize.
 * @returns The optimized tree.
 */
export function optimize(tree: unknown): unknown {
  tree = new OptimizingVisitor().visit(tree);
  tree = new RawCompactingVisitor().visit(tree);
  tree = new RawReplacingVisitor().visit(tree);
  return tree;
}
