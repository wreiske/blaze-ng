import { HTML } from '@blaze-ng/htmljs';
import type { Tag } from '@blaze-ng/htmljs';

/**
 * Visitor that forbids `{{> React}}` from having siblings.
 *
 * Ensures React components included via `{{> React}}` are the only
 * child in their parent element, since React.render would eliminate siblings.
 */
export class ReactComponentSiblingForbidder extends HTML.Visitor {
  sourceName?: string;

  override visitArray(array: unknown[], parentTag?: Tag): void {
    for (let i = 0; i < array.length; i++) {
      this.visit(array[i], parentTag);
    }
  }

  override visitObject(obj: unknown, parentTag?: Tag): void {
    const o = obj as { type?: string; path?: string[] };
    if (o.type === 'INCLUSION' && o.path && o.path.length === 1 && o.path[0] === 'React') {
      if (!parentTag) {
        throw new Error(
          '{{> React}} must be used in a container element' +
            (this.sourceName ? ' in ' + this.sourceName : '') +
            '. Learn more at https://github.com/meteor/meteor/wiki/React-components-must-be-the-only-thing-in-their-wrapper-element',
        );
      }

      let numSiblings = 0;
      for (let i = 0; i < parentTag.children.length; i++) {
        const child = parentTag.children[i];
        if (child !== obj && !(typeof child === 'string' && /^\s*$/.test(child))) {
          numSiblings++;
        }
      }

      if (numSiblings > 0) {
        throw new Error(
          '{{> React}} must be used as the only child in a container element' +
            (this.sourceName ? ' in ' + this.sourceName : '') +
            '. Learn more at https://github.com/meteor/meteor/wiki/React-components-must-be-the-only-thing-in-their-wrapper-element',
        );
      }
    }
  }

  override visitTag(tag: Tag): void {
    this.visitArray(tag.children, tag);
  }
}
