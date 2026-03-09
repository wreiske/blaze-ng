/**
 * Attribute handlers — manage updates to individual HTML attributes.
 *
 * Each handler knows how to update a specific attribute on a specific element,
 * handling browser quirks (class/SVG class, style diffing, boolean attributes,
 * DOM properties, xlink namespace, URL sanitization).
 */

import { _warn } from './preamble';

// ─── JavaScript URL protection ─────────────────────────────────────────────

let jsUrlsAllowed = false;

/**
 * Allow `javascript:` URLs in URL attributes (insecure — use only in trusted environments).
 */
export function _allowJavascriptUrls(): void {
  jsUrlsAllowed = true;
}

/**
 * Whether `javascript:` URLs are currently allowed.
 *
 * @returns True if javascript URLs are allowed.
 */
export function _javascriptUrlsAllowed(): boolean {
  return jsUrlsAllowed;
}

// ─── Simple OrderedDict (replaces meteor/ordered-dict) ─────────────────────

class OrderedDict<T> {
  private _map = new Map<string, T>();

  has(key: string): boolean {
    return this._map.has(key);
  }

  get(key: string): T | undefined {
    return this._map.get(key);
  }

  append(key: string, value: T): void {
    this._map.set(key, value);
  }

  remove(key: string): void {
    this._map.delete(key);
  }

  forEach(fn: (value: T, key: string, i: number) => void): void {
    let i = 0;
    this._map.forEach((value, key) => {
      fn(value, key, i++);
    });
  }
}

// ─── AttributeHandler base class ───────────────────────────────────────────

/**
 * An AttributeHandler is responsible for updating a particular attribute
 * of a particular element. Subclasses implement browser-specific logic
 * for dealing with particular attributes across different browsers.
 */
export class AttributeHandler {
  name: string;
  value: string | null;

  constructor(name: string, value: string | null) {
    this.name = name;
    this.value = value;
  }

  /**
   * Update the attribute on the element.
   *
   * @param element - The DOM element.
   * @param oldValue - The previous value.
   * @param value - The new value.
   */
  update(element: Element, oldValue: string | null, value: string | null): void {
    if (value === null) {
      if (oldValue !== null) element.removeAttribute(this.name);
    } else {
      element.setAttribute(this.name, value);
    }
  }
}

// ─── DiffingAttributeHandler ───────────────────────────────────────────────

/**
 * Base class for attribute handlers that diff individual tokens
 * (e.g., class names, style properties).
 */
export abstract class DiffingAttributeHandler extends AttributeHandler {
  abstract getCurrentValue(element: Element): string;
  abstract setValue(element: Element, value: string): void;
  abstract parseValue(attrString: string): OrderedDict<string>;
  abstract joinValues(values: string[]): string;

  override update(element: Element, oldValue: string | null, value: string | null): void {
    const oldAttrsMap = oldValue ? this.parseValue(oldValue) : new OrderedDict<string>();
    const attrsMap = value ? this.parseValue(value) : new OrderedDict<string>();

    const currentAttrString = this.getCurrentValue(element);
    const currentAttrsMap = currentAttrString
      ? this.parseValue(currentAttrString)
      : new OrderedDict<string>();

    // Preserve outside changes that aren't overridden by new attrs
    currentAttrsMap.forEach((val, key) => {
      if (attrsMap.has(key)) return;
      if (oldAttrsMap.has(key)) return;
      attrsMap.append(key, val);
    });

    const values: string[] = [];
    attrsMap.forEach((val) => {
      values.push(val);
    });

    this.setValue(element, this.joinValues(values));
  }
}

// ─── ClassHandler ──────────────────────────────────────────────────────────

class ClassHandler extends DiffingAttributeHandler {
  getCurrentValue(element: Element): string {
    return (element as HTMLElement).className;
  }

  setValue(element: Element, className: string): void {
    (element as HTMLElement).className = className;
  }

  parseValue(attrString: string): OrderedDict<string> {
    const tokens = new OrderedDict<string>();
    attrString.split(' ').forEach((token) => {
      if (token && !tokens.has(token)) {
        tokens.append(token, token);
      }
    });
    return tokens;
  }

  joinValues(values: string[]): string {
    return values.join(' ');
  }
}

// ─── SVGClassHandler ───────────────────────────────────────────────────────

class SVGClassHandler extends ClassHandler {
  override getCurrentValue(element: Element): string {
    return (element as SVGElement).className.baseVal;
  }

  override setValue(element: Element, className: string): void {
    element.setAttribute('class', className);
  }
}

// ─── StyleHandler ──────────────────────────────────────────────────────────

class StyleHandler extends DiffingAttributeHandler {
  getCurrentValue(element: Element): string {
    return element.getAttribute('style') || '';
  }

  setValue(element: Element, style: string): void {
    if (style === '') {
      element.removeAttribute('style');
    } else {
      element.setAttribute('style', style);
    }
  }

  parseValue(attrString: string): OrderedDict<string> {
    const tokens = new OrderedDict<string>();
    // Regex from css-parse for parsing CSS attribute declarations
    const regex =
      /(\*?[-#/\*\\w]+(?:\[[0-9a-z_-]+\])?)\s*:\s*(?:'(?:\\'|.)*?'|"(?:\\"|.)*?"|\([^)]*?\)|[^};])+[;\s]*/g;
    let match = regex.exec(attrString);
    while (match) {
      // Use the last value for the same key
      if (tokens.has(match[1]!)) {
        tokens.remove(match[1]!);
      }
      tokens.append(match[1]!, match[0].trim());
      match = regex.exec(attrString);
    }
    return tokens;
  }

  joinValues(values: string[]): string {
    return values.join(' ');
  }
}

// ─── BooleanHandler ────────────────────────────────────────────────────────

class BooleanHandler extends AttributeHandler {
  override update(element: Element, oldValue: string | null, value: string | null): void {
    if (value == null) {
      if (oldValue != null) (element as unknown as Record<string, boolean>)[this.name] = false;
    } else {
      (element as unknown as Record<string, boolean>)[this.name] = true;
    }
  }
}

// ─── DOMPropertyHandler ────────────────────────────────────────────────────

class DOMPropertyHandler extends AttributeHandler {
  override update(element: Element, _oldValue: string | null, value: string | null): void {
    if (value !== (element as unknown as Record<string, unknown>)[this.name]) {
      (element as unknown as Record<string, unknown>)[this.name] = value;
    }
  }
}

// ─── XlinkHandler ──────────────────────────────────────────────────────────

class XlinkHandler extends AttributeHandler {
  override update(element: Element, oldValue: string | null, value: string | null): void {
    const NS = 'http://www.w3.org/1999/xlink';
    if (value === null) {
      if (oldValue !== null) element.removeAttributeNS(NS, this.name);
    } else {
      element.setAttributeNS(NS, this.name, this.value!);
    }
  }
}

// ─── URL attribute detection ───────────────────────────────────────────────

function isSVGElement(elem: Element): boolean {
  return 'ownerSVGElement' in elem;
}

const URL_ATTRS: Record<string, string[]> = {
  FORM: ['action'],
  BODY: ['background'],
  BLOCKQUOTE: ['cite'],
  Q: ['cite'],
  DEL: ['cite'],
  INS: ['cite'],
  OBJECT: ['classid', 'codebase', 'data', 'usemap'],
  APPLET: ['codebase'],
  A: ['href'],
  AREA: ['href'],
  LINK: ['href'],
  IMG: ['longdesc', 'src', 'usemap'],
  FRAME: ['longdesc', 'src'],
  IFRAME: ['longdesc', 'src'],
  HEAD: ['profile'],
  SCRIPT: ['src'],
  INPUT: ['src', 'usemap', 'formaction'],
  BUTTON: ['formaction'],
  BASE: ['href'],
  MENUITEM: ['icon'],
  HTML: ['manifest'],
  VIDEO: ['poster'],
};

function isUrlAttribute(tagName: string, attrName: string): boolean {
  if (attrName === 'itemid') return true;
  const urlAttrNames = URL_ATTRS[tagName] || [];
  return urlAttrNames.includes(attrName);
}

// URL protocol detection via an anchor element
let anchorForNormalization: HTMLAnchorElement | undefined;
if (typeof document !== 'undefined') {
  anchorForNormalization = document.createElement('A') as HTMLAnchorElement;
}

function getUrlProtocol(url: string): string {
  if (anchorForNormalization) {
    anchorForNormalization.href = url;
    return (anchorForNormalization.protocol || '').toLowerCase();
  }
  throw new Error('getUrlProtocol not available (no document)');
}

// ─── UrlHandler ────────────────────────────────────────────────────────────

class UrlHandler extends AttributeHandler {
  override update(element: Element, oldValue: string | null, value: string | null): void {
    if (_javascriptUrlsAllowed()) {
      super.update(element, oldValue, value);
    } else {
      const isJavascript = value ? getUrlProtocol(value) === 'javascript:' : false;
      const isVBScript = value ? getUrlProtocol(value) === 'vbscript:' : false;
      if (isJavascript || isVBScript) {
        _warn(
          "URLs that use the 'javascript:' or 'vbscript:' protocol are not " +
            'allowed in URL attribute values. ' +
            'Call Blaze._allowJavascriptUrls() ' +
            'to enable them.',
        );
        super.update(element, oldValue, null);
      } else {
        super.update(element, oldValue, value);
      }
    }
  }
}

// ─── _makeAttributeHandler ─────────────────────────────────────────────────

/**
 * Create the appropriate AttributeHandler for a given element/attribute combo.
 *
 * @param elem - The DOM element.
 * @param name - The attribute name.
 * @param value - The attribute value.
 * @returns An AttributeHandler instance.
 */
export function _makeAttributeHandler(
  elem: Element,
  name: string,
  value: string | null,
): AttributeHandler {
  if (name === 'class') {
    return isSVGElement(elem) ? new SVGClassHandler(name, value) : new ClassHandler(name, value);
  } else if (name === 'style') {
    return new StyleHandler(name, value);
  } else if (
    (elem.tagName === 'OPTION' && name === 'selected') ||
    (elem.tagName === 'INPUT' && name === 'checked') ||
    (elem.tagName === 'VIDEO' && name === 'muted')
  ) {
    return new BooleanHandler(name, value);
  } else if ((elem.tagName === 'TEXTAREA' || elem.tagName === 'INPUT') && name === 'value') {
    return new DOMPropertyHandler(name, value);
  } else if (name.substring(0, 6) === 'xlink:') {
    return new XlinkHandler(name.substring(6), value);
  } else if (isUrlAttribute(elem.tagName, name)) {
    return new UrlHandler(name, value);
  } else {
    return new AttributeHandler(name, value);
  }
}

// ─── ElementAttributesUpdater ──────────────────────────────────────────────

/**
 * Manages updating all attributes on an element, creating/removing
 * AttributeHandlers as needed.
 */
export class ElementAttributesUpdater {
  elem: Element;
  handlers: Record<string, AttributeHandler> = {};

  constructor(elem: Element) {
    this.elem = elem;
  }

  /**
   * Update attributes on the element to match the dictionary.
   *
   * @param newAttrs - Dictionary of attribute name to value (or null to remove).
   */
  update(newAttrs: Record<string, string | null>): void {
    const { elem, handlers } = this;

    // Remove handlers for attributes no longer present
    Object.getOwnPropertyNames(handlers).forEach((k) => {
      if (!Object.hasOwn(newAttrs, k)) {
        const handler = handlers[k]!;
        const oldValue = handler.value;
        handler.value = null;
        handler.update(elem, oldValue, null);
        delete handlers[k];
      }
    });

    // Update or create handlers for current attributes
    Object.getOwnPropertyNames(newAttrs).forEach((k) => {
      let handler: AttributeHandler | null = null;
      let oldValue: string | null = null;
      const value = newAttrs[k] ?? null;

      if (!Object.hasOwn(handlers, k)) {
        if (value !== null) {
          handler = _makeAttributeHandler(elem, k, value);
          handlers[k] = handler;
        }
      } else {
        handler = handlers[k] ?? null;
        oldValue = handler!.value;
      }

      if (handler && oldValue !== value) {
        handler.value = value;
        handler.update(elem, oldValue, value);
        if (value === null) delete handlers[k];
      }
    });
  }
}
