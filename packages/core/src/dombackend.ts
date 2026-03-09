/**
 * Native DOM backend for Blaze-NG.
 *
 * Replaces the jQuery-based DOMBackend from original Blaze with
 * native DOM APIs. Provides parseHTML, event delegation, teardown
 * callbacks, and element selection utilities.
 */

/**
 * Circular doubly-linked list node for teardown callbacks.
 */
class TeardownCallback {
  next: TeardownCallback;
  prev: TeardownCallback;
  func: (() => void) | null;

  constructor(func?: () => void) {
    this.next = this;
    this.prev = this;
    this.func = func || null;
  }

  /** Insert this node before `oldElt` in the circular list. */
  linkBefore(oldElt: TeardownCallback): void {
    this.prev = oldElt.prev;
    this.next = oldElt;
    oldElt.prev.next = this;
    oldElt.prev = this;
  }

  /** Remove this node from the list. */
  unlink(): void {
    this.prev.next = this.next;
    this.next.prev = this.prev;
  }

  /** Execute the callback. */
  go(): void {
    this.func?.();
  }

  /** Alias for unlink — used as a stop handle. */
  stop(): void {
    this.unlink();
  }
}

/** Property name for storing teardown callbacks on elements. */
const CB_PROP = '$blaze_teardown_callbacks';

/**
 * A native DOM backend that replaces jQuery with standard DOM APIs.
 */
export const DOMBackend = {
  _context: null as Document | null,

  /**
   * Get or create a document context for HTML parsing.
   *
   * @returns A Document suitable for parsing HTML.
   */
  getContext(): Document {
    if (DOMBackend._context) {
      return DOMBackend._context;
    }

    if (typeof document !== 'undefined') {
      DOMBackend._context = document.implementation.createHTMLDocument('');
      const base = DOMBackend._context.createElement('base');
      base.href = document.location?.href || '';
      DOMBackend._context.head.appendChild(base);
    } else {
      // Fallback for environments without document (SSR)
      throw new Error('DOMBackend requires a document object');
    }
    return DOMBackend._context;
  },

  /**
   * Parse an HTML string into an array of DOM nodes.
   *
   * @param html - The HTML string to parse.
   * @returns An array of DOM nodes.
   */
  parseHTML(html: string): Node[] {
    const ctx = DOMBackend.getContext();
    const container = ctx.createElement('div');
    container.innerHTML = html;
    return Array.from(container.childNodes);
  },

  Events: {
    /**
     * Delegate an event via addEventListener on the element.
     *
     * @param elem - The element to listen on.
     * @param type - The event type (may include namespace after '.').
     * @param selector - CSS selector to match against.
     * @param handler - The event handler function.
     */
    delegateEvents(elem: Element, type: string, selector: string, handler: EventListener): void {
      const eventType = DOMBackend.Events.parseEventType(type);
      elem.addEventListener(eventType, (event) => {
        const target = event.target as Element | null;
        if (!target) return;

        // Walk from target up to elem, checking if any element matches selector
        let current: Element | null = target;
        while (current && current !== elem) {
          if (current.matches(selector)) {
            // Set currentTarget since we're manually dispatching
            Object.defineProperty(event, 'currentTarget', {
              value: current,
              configurable: true,
            });
            handler.call(elem, event);
            return;
          }
          current = current.parentElement;
        }
        // Also check elem itself
        if (elem.matches(selector)) {
          Object.defineProperty(event, 'currentTarget', {
            value: elem,
            configurable: true,
          });
          handler.call(elem, event);
        }
      });
    },

    /**
     * Remove delegated events. With native events, we track handlers
     * differently from jQuery. For simplicity in this implementation,
     * we use a handler wrapper approach where unbinding is tracked
     * via the HandlerRec system.
     *
     * @param elem - The element.
     * @param type - The event type.
     * @param handler - The handler to remove.
     */
    undelegateEvents(elem: Element, type: string, handler: EventListener): void {
      const eventType = DOMBackend.Events.parseEventType(type);
      elem.removeEventListener(eventType, handler);
    },

    /**
     * Bind a capturing event listener.
     *
     * @param elem - The element to listen on.
     * @param type - The event type.
     * @param selector - CSS selector to filter targets.
     * @param handler - The event handler.
     */
    bindEventCapturer(elem: Element, type: string, selector: string, handler: EventListener): void {
      const eventType = DOMBackend.Events.parseEventType(type);

      const wrapper = (event: Event) => {
        const target = event.target as Element | null;
        if (!target) return;

        Object.defineProperty(event, 'currentTarget', {
          value: target,
          configurable: true,
        });

        if (target.matches(selector) || selector === '*') {
          handler.call(elem, event);
        }
      };

      // Store wrapper for later removal
      (handler as unknown as { _meteorui_wrapper: EventListener })._meteorui_wrapper = wrapper;
      elem.addEventListener(eventType, wrapper, true);
    },

    /**
     * Unbind a capturing event listener.
     *
     * @param elem - The element.
     * @param type - The event type.
     * @param handler - The handler whose wrapper to remove.
     */
    unbindEventCapturer(elem: Element, type: string, handler: EventListener): void {
      const eventType = DOMBackend.Events.parseEventType(type);
      const wrapper = (handler as unknown as { _meteorui_wrapper?: EventListener })
        ._meteorui_wrapper;
      if (wrapper) {
        elem.removeEventListener(eventType, wrapper, true);
      }
    },

    /**
     * Strip off event namespaces (e.g., 'click.myns' → 'click').
     *
     * @param type - The event type string.
     * @returns The base event type.
     */
    parseEventType(type: string): string {
      const dotLoc = type.indexOf('.');
      if (dotLoc >= 0) return type.slice(0, dotLoc);
      return type;
    },
  },

  Teardown: {
    /**
     * Register a callback to be called when the given element is torn down.
     *
     * @param elem - The DOM element.
     * @param func - The teardown callback function.
     * @returns An object with a `stop()` method to unregister the callback.
     */
    onElementTeardown(elem: Element, func: () => void): TeardownCallback {
      const elt = new TeardownCallback(func);
      const el = elem as Element & { [key: string]: TeardownCallback | undefined };

      if (!el[CB_PROP]) {
        // Create an empty sentinel node that is never unlinked
        el[CB_PROP] = new TeardownCallback();
      }

      elt.linkBefore(el[CB_PROP]!);
      return elt;
    },

    /**
     * Recursively tear down an element and all its descendants.
     *
     * @param elem - The root element to tear down.
     */
    tearDownElement(elem: Element): void {
      const nodeList = elem.getElementsByTagName('*');
      const elems: Element[] = [];
      for (let i = 0; i < nodeList.length; i++) {
        elems.push(nodeList[i]!);
      }
      elems.push(elem);

      for (const el of elems) {
        DOMBackend.Teardown._fireTeardownCallbacks(el);
      }
    },

    /**
     * Fire all teardown callbacks on a single element.
     *
     * @param elem - The element whose callbacks to fire.
     */
    _fireTeardownCallbacks(elem: Element): void {
      const el = elem as Element & { [key: string]: TeardownCallback | undefined };
      const callbacks = el[CB_PROP];
      if (callbacks) {
        let elt = callbacks.next;
        while (elt !== callbacks) {
          elt.go();
          elt = elt.next;
        }
        callbacks.go();
        el[CB_PROP] = undefined;
      }
    },
  },

  /**
   * Find all elements matching a selector within a context.
   *
   * @param selector - The CSS selector.
   * @param context - The context element to search within.
   * @returns An array of matching elements.
   */
  findBySelector(selector: string, context: Element | Document): Element[] {
    return Array.from(context.querySelectorAll(selector));
  },
};
