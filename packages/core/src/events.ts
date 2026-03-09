/**
 * EventSupport — event delegation and capture for Blaze views.
 *
 * Handles both bubbling events (via delegation) and non-bubbling events
 * (via capture), with automatic mode detection on first fire.
 */

import { DOMBackend } from './dombackend';
import type { DOMRange } from './domrange';
import { _setEventSupportListenFn } from './view';

// ─── Constants ─────────────────────────────────────────────────────────────

/** Events that always delegate (bubble reliably in all browsers). */
const eventsToDelegate: Record<string, number> = {
  blur: 1,
  change: 1,
  click: 1,
  focus: 1,
  focusin: 1,
  focusout: 1,
  reset: 1,
  submit: 1,
};

/** Event handler mode states. */
const EVENT_MODE = {
  TBD: 0,
  BUBBLING: 1,
  CAPTURING: 2,
} as const;

type EventMode = (typeof EVENT_MODE)[keyof typeof EVENT_MODE];

export { eventsToDelegate, EVENT_MODE };

// ─── HandlerRec ────────────────────────────────────────────────────────────

let NEXT_HANDLERREC_ID = 1;

/**
 * A handler record, representing a single event binding.
 */
export class HandlerRec {
  elem: Element;
  type: string;
  selector: string;
  handler: (...args: unknown[]) => unknown;
  recipient: DOMRange;
  id: number;
  mode: EventMode;
  delegatedHandler: (evt: Event) => unknown;
  capturingHandler?: (evt: Event) => void;

  constructor(
    elem: Element,
    type: string,
    selector: string,
    handler: (...args: unknown[]) => unknown,
    recipient: DOMRange,
  ) {
    this.elem = elem;
    this.type = type;
    this.selector = selector;
    this.handler = handler;
    this.recipient = recipient;
    this.id = NEXT_HANDLERREC_ID++;
    this.mode = EVENT_MODE.TBD;

    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const h = this;
    this.delegatedHandler = function (...args: unknown[]) {
      const evt = args[0] as Event;
      if (!h.selector && evt.currentTarget !== evt.target) return;
      return h.handler.apply(h.recipient, args);
    };

    const tryCapturing =
      typeof elem.addEventListener === 'function' &&
      !Object.hasOwn(eventsToDelegate, DOMBackend.Events.parseEventType(type));

    if (tryCapturing) {
      this.capturingHandler = function (evt: Event) {
        if (h.mode === EVENT_MODE.TBD) {
          if (evt.bubbles) {
            h.mode = EVENT_MODE.BUBBLING;
            DOMBackend.Events.unbindEventCapturer(h.elem, h.type, h.capturingHandler!);
            return;
          } else {
            h.mode = EVENT_MODE.CAPTURING;
            DOMBackend.Events.undelegateEvents(h.elem, h.type, h.delegatedHandler);
          }
        }
        h.delegatedHandler(evt);
      };
    } else {
      this.mode = EVENT_MODE.BUBBLING;
    }
  }

  /**
   * Bind this handler to the DOM.
   */
  bind(): void {
    if (this.mode !== EVENT_MODE.BUBBLING && this.capturingHandler) {
      DOMBackend.Events.bindEventCapturer(
        this.elem,
        this.type,
        this.selector || '*',
        this.capturingHandler,
      );
    }

    if (this.mode !== EVENT_MODE.CAPTURING) {
      DOMBackend.Events.delegateEvents(
        this.elem,
        this.type,
        this.selector || '*',
        this.delegatedHandler,
      );
    }
  }

  /**
   * Unbind this handler from the DOM.
   */
  unbind(): void {
    if (this.mode !== EVENT_MODE.BUBBLING && this.capturingHandler) {
      DOMBackend.Events.unbindEventCapturer(this.elem, this.type, this.capturingHandler);
    }

    if (this.mode !== EVENT_MODE.CAPTURING) {
      DOMBackend.Events.undelegateEvents(this.elem, this.type, this.delegatedHandler);
    }
  }
}

// ─── EventSupport.listen ───────────────────────────────────────────────────

interface BlazeEventDict {
  [type: string]: {
    handlers: HandlerRec[];
  };
}

/**
 * Attach event listeners to an element, with delegation and capture support.
 *
 * @param element - The DOM element.
 * @param events - Space-separated event types.
 * @param selector - CSS selector for delegation.
 * @param handler - The event handler function.
 * @param recipient - The DOMRange that receives events.
 * @param getParentRecipient - Function to walk up the recipient chain.
 * @returns An object with a `stop()` method.
 */
export function listen(
  element: Element,
  events: string,
  selector: string,
  handler: (...args: unknown[]) => unknown,
  recipient: DOMRange,
  getParentRecipient?: (r: DOMRange) => DOMRange | null,
): { stop(): void } {
  // Prevent JIT crash in some Safari versions
  try {
    element = element;
  } finally {
    // intentionally empty
  }

  const eventTypes: string[] = [];
  events.replace(/[^ /]+/g, (e) => {
    eventTypes.push(e);
    return e;
  });

  const newHandlerRecs: HandlerRec[] = [];
  const augElement = element as Element & { $blaze_events?: BlazeEventDict };

  for (let i = 0, N = eventTypes.length; i < N; i++) {
    const type = eventTypes[i]!;

    if (!augElement.$blaze_events) {
      augElement.$blaze_events = {};
    }
    const eventDict = augElement.$blaze_events;

    if (!eventDict[type]) {
      eventDict[type] = { handlers: [] };
    }
    const handlerList = eventDict[type]!.handlers;

    const handlerRec = new HandlerRec(element, type, selector, handler, recipient);
    newHandlerRecs.push(handlerRec);
    handlerRec.bind();
    handlerList.push(handlerRec);

    // Rebind handlers for parent ranges so they fire in the correct order
    if (getParentRecipient) {
      for (let r: DOMRange | null = getParentRecipient(recipient); r; r = getParentRecipient(r)) {
        for (let j = 0, Nj = handlerList.length; j < Nj; j++) {
          const h = handlerList[j]!;
          if (h.recipient === r) {
            h.unbind();
            h.bind();
            handlerList.splice(j, 1);
            handlerList.push(h);
            j--;
            Nj--;
          }
        }
      }
    }
  }

  return {
    stop() {
      const eventDict = augElement.$blaze_events;
      if (!eventDict) return;

      for (let i = 0; i < newHandlerRecs.length; i++) {
        const handlerToRemove = newHandlerRecs[i]!;
        const info = eventDict[handlerToRemove.type];
        if (!info) continue;
        const handlerList = info.handlers;
        for (let j = handlerList.length - 1; j >= 0; j--) {
          if (handlerList[j] === handlerToRemove) {
            handlerToRemove.unbind();
            handlerList.splice(j, 1);
          }
        }
      }
      newHandlerRecs.length = 0;
    },
  };
}

/** EventSupport namespace. */
export const EventSupport = {
  eventsToDelegate,
  EVENT_MODE,
  HandlerRec,
  listen,
};

// Register with view module
_setEventSupportListenFn(
  listen as typeof _setEventSupportListenFn extends (fn: infer F) => void ? NonNullable<F> : never,
);
