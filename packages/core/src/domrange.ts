/**
 * DOMRange — manages a contiguous range of DOM nodes and sub-ranges.
 *
 * A DOMRange consists of an array of consecutive DOM nodes and DOMRanges,
 * which may be replaced at any time. If the DOMRange has been attached to
 * the DOM at some location, updating the array will update the DOM at
 * that location.
 */

import type { View } from './view';

/** A constant empty array (frozen). */
const _emptyArray: readonly never[] = Object.freeze([]);

/** A member of a DOMRange: either a child DOMRange or a DOM Node. */
export type RangeOrNode = DOMRange | Node;

/** Callbacks for attached/detached lifecycle. */
export interface AttachedDetachedCallbacks {
  attached?: (range: DOMRange, element: Element) => void;
  detached?: (range: DOMRange, element: Element) => void;
}

/**
 * Hooks on a parent element for custom insertion/removal/move behavior.
 * Used for animation integration (e.g., _uihooks).
 */
interface UIHooks {
  insertElement?: (node: Node, next: Node | null) => void;
  removeElement?: (node: Node) => void;
  moveElement?: (node: Node, next: Node | null) => void;
}

// Lazy reference to Blaze functions to break circular dependency.
// Set via `DOMRange._setDestroyFunctions`.
let _destroyViewFn: ((view: View, skipNodes?: boolean) => void) | null = null;
let _destroyNodeFn: ((node: Node) => void) | null = null;

/**
 * A DOMRange manages a range of DOM nodes, tracking their position
 * in the DOM and supporting reactive updates.
 */
export class DOMRange {
  members: RangeOrNode[];
  emptyRangePlaceholder: Node | null = null;
  attached = false;
  parentElement: Element | null = null;
  parentRange: DOMRange | null = null;
  attachedCallbacks: AttachedDetachedCallbacks[] =
    _emptyArray as unknown as AttachedDetachedCallbacks[];
  view: View | null = null;

  constructor(nodeAndRangeArray?: RangeOrNode[]) {
    const members = nodeAndRangeArray || (_emptyArray as unknown as RangeOrNode[]);
    if (!members || typeof members.length !== 'number') {
      throw new Error('Expected array');
    }

    for (let i = 0; i < members.length; i++) {
      this._memberIn(members[i]!);
    }
    this.members = members;
  }

  /**
   * Set the functions for destroying views and nodes.
   * Called during Blaze initialization to break circular deps.
   *
   * @param destroyView - The Blaze._destroyView function.
   * @param destroyNode - The Blaze._destroyNode function.
   */
  static _setDestroyFunctions(
    destroyView: (view: View, skipNodes?: boolean) => void,
    destroyNode: (node: Node) => void,
  ): void {
    _destroyViewFn = destroyView;
    _destroyNodeFn = destroyNode;
  }

  /**
   * Insert a range or node into a parent element.
   *
   * @param rangeOrNode - The range or node to insert.
   * @param parentElement - The parent element.
   * @param nextNode - Insert before this node, or append if null.
   * @param _isMove - Whether this is a move operation.
   */
  static _insert(
    rangeOrNode: RangeOrNode,
    parentElement: Element,
    nextNode: Node | null,
    _isMove?: boolean,
  ): void {
    if (rangeOrNode instanceof DOMRange) {
      rangeOrNode.attach(parentElement, nextNode, _isMove);
    } else {
      if (_isMove) {
        DOMRange._moveNodeWithHooks(rangeOrNode, parentElement, nextNode);
      } else {
        DOMRange._insertNodeWithHooks(rangeOrNode, parentElement, nextNode);
      }
    }
  }

  /**
   * Remove a range or node.
   *
   * @param rangeOrNode - The range or node to remove.
   */
  static _remove(rangeOrNode: RangeOrNode): void {
    if (rangeOrNode instanceof DOMRange) {
      rangeOrNode.detach();
    } else {
      DOMRange._removeNodeWithHooks(rangeOrNode);
    }
  }

  static _removeNodeWithHooks(n: Node): void {
    if (!n.parentNode) return;
    const parent = n.parentNode as Element & { _uihooks?: UIHooks };
    if (n.nodeType === 1 && parent._uihooks?.removeElement) {
      parent._uihooks.removeElement(n);
    } else {
      n.parentNode.removeChild(n);
    }
  }

  static _insertNodeWithHooks(n: Node, parent: Element, next: Node | null): void {
    next = next || null;
    const p = parent as Element & { _uihooks?: UIHooks };
    if (n.nodeType === 1 && p._uihooks?.insertElement) {
      p._uihooks.insertElement(n, next);
    } else {
      parent.insertBefore(n, next);
    }
  }

  static _moveNodeWithHooks(n: Node, parent: Element, next: Node | null): void {
    if (n.parentNode !== parent) return;
    next = next || null;
    const p = parent as Element & { _uihooks?: UIHooks };
    if (n.nodeType === 1 && p._uihooks?.moveElement) {
      p._uihooks.moveElement(n, next);
    } else {
      parent.insertBefore(n, next);
    }
  }

  /**
   * Find the DOMRange associated with a given element.
   *
   * @param elem - The element to look up.
   * @returns The DOMRange, or null.
   */
  static forElement(elem: Element): DOMRange | null {
    if (elem.nodeType !== 1) {
      throw new Error('Expected element, found: ' + elem);
    }
    let range: DOMRange | null = null;
    let current: Element | null = elem;
    while (current && !range) {
      range = (current as Element & { $blaze_range?: DOMRange }).$blaze_range || null;
      if (!range) {
        current = current.parentElement;
      }
    }
    return range;
  }

  /**
   * Destroy a member (range or node).
   *
   * @param m - The member to destroy.
   * @param _skipNodes - Whether to skip node teardown.
   */
  static _destroy(m: RangeOrNode, _skipNodes?: boolean): void {
    if (m instanceof DOMRange) {
      if (m.view && _destroyViewFn) {
        _destroyViewFn(m.view, _skipNodes);
      }
    } else if (!_skipNodes && m.nodeType === 1) {
      const el = m as Element & { $blaze_range?: DOMRange | null };
      if (el.$blaze_range) {
        _destroyNodeFn?.(m);
        el.$blaze_range = null;
      }
    }
  }

  /**
   * Attach this DOMRange to a parent element in the DOM.
   *
   * @param parentElement - The parent element.
   * @param nextNode - Insert before this node, or append if null.
   * @param _isMove - Whether this is a move, not a first attach.
   * @param _isReplace - Whether this is a replacement during setMembers.
   */
  attach(
    parentElement: Element,
    nextNode?: Node | null,
    _isMove?: boolean,
    _isReplace?: boolean,
  ): void {
    if (_isMove || _isReplace) {
      if (!(this.parentElement === parentElement && this.attached)) {
        throw new Error(
          'Can only move or replace an attached DOMRange, and only under the same parent element',
        );
      }
    }

    const members = this.members;
    if (members.length) {
      this.emptyRangePlaceholder = null;
      for (let i = 0; i < members.length; i++) {
        DOMRange._insert(members[i]!, parentElement, nextNode || null, _isMove);
      }
    } else {
      const placeholder = document.createTextNode('');
      this.emptyRangePlaceholder = placeholder;
      parentElement.insertBefore(placeholder, nextNode || null);
    }
    this.attached = true;
    this.parentElement = parentElement;

    if (!(_isMove || _isReplace)) {
      for (let i = 0; i < this.attachedCallbacks.length; i++) {
        const obj = this.attachedCallbacks[i]!;
        obj.attached?.(this, parentElement);
      }
    }
  }

  /**
   * Replace all members of this range with new ones.
   *
   * @param newNodeAndRangeArray - The new members.
   */
  setMembers(newNodeAndRangeArray: RangeOrNode[]): void {
    const newMembers = newNodeAndRangeArray;
    if (!newMembers || typeof newMembers.length !== 'number') {
      throw new Error('Expected array');
    }

    const oldMembers = this.members;

    for (let i = 0; i < oldMembers.length; i++) {
      this._memberOut(oldMembers[i]!);
    }
    for (let i = 0; i < newMembers.length; i++) {
      this._memberIn(newMembers[i]!);
    }

    if (!this.attached) {
      this.members = newMembers;
    } else {
      // don't do anything if going from empty to empty
      if (newMembers.length || oldMembers.length) {
        const nextNode = this.lastNode().nextSibling;
        const parentElement = this.parentElement!;
        // Use detach/attach, but don't fire attached/detached hooks
        this.detach(true /* _isReplace */);
        this.members = newMembers;
        this.attach(parentElement, nextNode, false, true /* _isReplace */);
      }
    }
  }

  /** Get the first node of this range. */
  firstNode(): Node {
    if (!this.attached) throw new Error('Must be attached');
    if (!this.members.length) return this.emptyRangePlaceholder!;

    const m = this.members[0]!;
    return m instanceof DOMRange ? m.firstNode() : m;
  }

  /** Get the last node of this range. */
  lastNode(): Node {
    if (!this.attached) throw new Error('Must be attached');
    if (!this.members.length) return this.emptyRangePlaceholder!;

    const m = this.members[this.members.length - 1]!;
    return m instanceof DOMRange ? m.lastNode() : m;
  }

  /**
   * Detach this DOMRange from the DOM.
   *
   * @param _isReplace - If true, don't fire detach callbacks.
   */
  detach(_isReplace?: boolean): void {
    if (!this.attached) throw new Error('Must be attached');

    const oldParentElement = this.parentElement!;
    const members = this.members;
    if (members.length) {
      for (let i = 0; i < members.length; i++) {
        DOMRange._remove(members[i]!);
      }
    } else {
      const placeholder = this.emptyRangePlaceholder;
      this.parentElement!.removeChild(placeholder!);
      this.emptyRangePlaceholder = null;
    }

    if (!_isReplace) {
      this.attached = false;
      this.parentElement = null;

      for (let i = 0; i < this.attachedCallbacks.length; i++) {
        const obj = this.attachedCallbacks[i]!;
        obj.detached?.(this, oldParentElement);
      }
    }
  }

  /**
   * Add a new member at a given index.
   *
   * @param newMember - The member to add.
   * @param atIndex - The index to insert at.
   * @param _isMove - Whether this is a move operation.
   */
  addMember(newMember: RangeOrNode, atIndex: number, _isMove?: boolean): void {
    const members = this.members;
    if (!(atIndex >= 0 && atIndex <= members.length)) {
      throw new Error('Bad index in range.addMember: ' + atIndex);
    }

    if (!_isMove) this._memberIn(newMember);

    if (!this.attached) {
      members.splice(atIndex, 0, newMember);
    } else if (members.length === 0) {
      this.setMembers([newMember]);
    } else {
      let nextNode: Node | null;
      if (atIndex === members.length) {
        nextNode = this.lastNode().nextSibling;
      } else {
        const m = members[atIndex]!;
        nextNode = m instanceof DOMRange ? m.firstNode() : m;
      }
      members.splice(atIndex, 0, newMember);
      DOMRange._insert(newMember, this.parentElement!, nextNode, _isMove);
    }
  }

  /**
   * Remove the member at a given index.
   *
   * @param atIndex - The index of the member to remove.
   * @param _isMove - Whether this is a move operation.
   */
  removeMember(atIndex: number, _isMove?: boolean): void {
    const members = this.members;
    if (!(atIndex >= 0 && atIndex < members.length)) {
      throw new Error('Bad index in range.removeMember: ' + atIndex);
    }

    if (_isMove) {
      members.splice(atIndex, 1);
    } else {
      const oldMember = members[atIndex]!;
      this._memberOut(oldMember);

      if (members.length === 1) {
        this.setMembers(_emptyArray as unknown as RangeOrNode[]);
      } else {
        members.splice(atIndex, 1);
        if (this.attached) DOMRange._remove(oldMember);
      }
    }
  }

  /**
   * Move a member from one index to another.
   *
   * @param oldIndex - The current index.
   * @param newIndex - The new index.
   */
  moveMember(oldIndex: number, newIndex: number): void {
    const member = this.members[oldIndex]!;
    this.removeMember(oldIndex, true /* _isMove */);
    this.addMember(member, newIndex, true /* _isMove */);
  }

  /**
   * Get the member at a given index.
   *
   * @param atIndex - The index to get.
   * @returns The member at that index.
   */
  getMember(atIndex: number): RangeOrNode {
    const members = this.members;
    if (!(atIndex >= 0 && atIndex < members.length)) {
      throw new Error('Bad index in range.getMember: ' + atIndex);
    }
    return this.members[atIndex]!;
  }

  /** Track that a member belongs to this range. */
  _memberIn(m: RangeOrNode): void {
    if (m instanceof DOMRange) {
      m.parentRange = this;
    } else if (m.nodeType === 1) {
      (m as Element & { $blaze_range?: DOMRange }).$blaze_range = this;
    }
  }

  /** Remove (destroy) a member from this range. */
  _memberOut(m: RangeOrNode, _skipNodes?: boolean): void {
    DOMRange._destroy(m, _skipNodes);
  }

  /**
   * Destroy all members without removing them from the DOM.
   *
   * @param _skipNodes - Whether to skip node teardown.
   */
  destroyMembers(_skipNodes?: boolean): void {
    const members = this.members;
    for (let i = 0; i < members.length; i++) {
      this._memberOut(members[i]!, _skipNodes);
    }
  }

  /**
   * Destroy this range and its members.
   *
   * @param _skipNodes - Whether to skip node teardown.
   */
  destroy(_skipNodes?: boolean): void {
    DOMRange._destroy(this, _skipNodes);
  }

  /**
   * Check whether this range contains a given element.
   *
   * @param elem - The element to check.
   * @param selector - The CSS selector (for error messages).
   * @param event - The event type (for error messages).
   * @returns True if the element is contained in this range.
   */
  containsElement(elem: Element, selector?: string, event?: string): boolean {
    const templateName = this.view?.name ? this.view.name.split('.')[1] : 'unknown template';
    if (!this.attached) {
      throw new Error(
        `${event} event triggered with ${selector} on ${templateName} but associated view is not be found.\n    Make sure the event doesn't destroy the view.`,
      );
    }

    if (!_elementContains(this.parentElement!, elem)) return false;

    // Walk up to immediate child of parentElement
    let current: Element = elem;
    while (current.parentNode !== this.parentElement) {
      current = current.parentNode as Element;
    }

    let range = (current as Element & { $blaze_range?: DOMRange }).$blaze_range;
    while (range && range !== this) {
      range = range.parentRange!;
    }

    return range === this;
  }

  /**
   * Check whether this range contains another range.
   *
   * @param range - The range to check.
   * @returns True if the range is contained within this range.
   */
  containsRange(range: DOMRange): boolean {
    if (!this.attached) throw new Error('Must be attached');
    if (!range.attached) return false;

    if (range.parentElement !== this.parentElement) {
      return this.containsElement(range.parentElement!);
    }

    if (range === this) return false;

    let current: DOMRange | null = range;
    while (current && current !== this) {
      current = current.parentRange;
    }
    return current === this;
  }

  /**
   * Register a callback for when this range is attached.
   *
   * @param attached - The callback function.
   */
  onAttached(attached: (range: DOMRange, element: Element) => void): void {
    this.onAttachedDetached({ attached });
  }

  /**
   * Register attached/detached callbacks.
   *
   * @param callbacks - Object with optional attached and detached callbacks.
   */
  onAttachedDetached(callbacks: AttachedDetachedCallbacks): void {
    if ((this.attachedCallbacks as unknown) === _emptyArray) {
      this.attachedCallbacks = [];
    }
    this.attachedCallbacks.push(callbacks);
  }

  /**
   * Find all elements matching a selector within this range.
   *
   * @param selector - The CSS selector.
   * @returns An array of matching elements.
   */
  $(selector: string): Element[] {
    const parentNode = this.parentElement;
    if (!parentNode) throw new Error("Can't select in removed DomRange");

    if (parentNode.nodeType === 11 /* DocumentFragment */) {
      throw new Error("Can't use $ on an offscreen range");
    }

    const results = Array.from(parentNode.querySelectorAll(selector));
    return results.filter((elem) => this.containsElement(elem));
  }
}

/**
 * Returns true if element `a` contains node `b` and is not node `b`.
 *
 * @param a - The potential parent element.
 * @param b - The potential child node.
 * @returns True if a contains b.
 */
export function _elementContains(a: Node, b: Node): boolean {
  if (a.nodeType !== 1) return false;
  if (a === b) return false;

  if (a.compareDocumentPosition) {
    return (a.compareDocumentPosition(b) & 0x10) !== 0;
  }

  // Fallback
  const current: Node | null = b.parentNode;
  if (!current || current.nodeType !== 1) return false;
  if (a === current) return true;
  return (a as Element).contains(current as Element);
}
