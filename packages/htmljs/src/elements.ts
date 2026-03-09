import { makeTagConstructor } from './tag';
import type { TagConstructor } from './types';

/**
 * Registry of tag constructors keyed by symbol name (e.g. 'P', 'DIV', 'FONT_FACE').
 *
 * The registry is the main `HTML` object — tag constructors are added
 * as properties like `HTML.P`, `HTML.DIV`, etc.
 */
export const HTMLTags: Record<string, TagConstructor> = {};

/**
 * Convert a tag name to its symbol name for the HTMLTags registry.
 *
 * Converts to uppercase and replaces hyphens with underscores.
 * E.g. `'font-face'` → `'FONT_FACE'`, `'div'` → `'DIV'`.
 *
 * @param tagName - The HTML tag name.
 * @returns The symbol name for the registry.
 * @throws If the tagName is already all-caps (ambiguous with symbol name).
 */
export function getSymbolName(tagName: string): string {
  return tagName.toUpperCase().replace(/-/g, '_');
}

/**
 * Get (or create) a tag constructor for the given tag name.
 *
 * If a constructor doesn't exist yet, one is created and registered.
 * Use the lowercase or camelCase form of the tag name.
 *
 * @param tagName - The HTML tag name (e.g. 'p', 'div').
 * @returns The tag constructor function.
 * @throws If tagName is all-caps (use lowercase form instead).
 */
export function getTag(tagName: string): TagConstructor {
  const symbolName = getSymbolName(tagName);
  if (symbolName === tagName) {
    throw new Error("Use the lowercase or camelCase form of '" + tagName + "' here");
  }

  if (!HTMLTags[symbolName]) {
    HTMLTags[symbolName] = makeTagConstructor(tagName);
  }

  return HTMLTags[symbolName]!;
}

/**
 * Ensure a tag constructor exists for the given tag name.
 *
 * Unlike `getTag`, this does not return the constructor.
 *
 * @param tagName - The HTML tag name to ensure.
 */
export function ensureTag(tagName: string): void {
  getTag(tagName);
}

/**
 * Check if a tag constructor has been registered for the given tag name.
 *
 * @param tagName - The HTML tag name to check.
 * @returns True if the tag is registered.
 */
export function isTagEnsured(tagName: string): boolean {
  return isKnownElement(tagName);
}

// ===== Known element lists =====

/** All known HTML element names. */
export const knownHTMLElementNames: string[] =
  'a abbr acronym address applet area article aside audio b base basefont bdi bdo big blockquote body br button canvas caption center cite code col colgroup command data datagrid datalist dd del details dfn dir div dl dt em embed eventsource fieldset figcaption figure font footer form frame frameset h1 h2 h3 h4 h5 h6 head header hgroup hr html i iframe img input ins isindex kbd keygen label legend li link main map mark menu meta meter nav noframes noscript object ol optgroup option output p param pre progress q rp rt ruby s samp script section select small source span strike strong style sub summary sup table tbody td textarea tfoot th thead time title tr track tt u ul var video wbr'.split(
    ' ',
  );

/** All known SVG element names. */
export const knownSVGElementNames: string[] =
  'altGlyph altGlyphDef altGlyphItem animate animateColor animateMotion animateTransform circle clipPath color-profile cursor defs desc ellipse feBlend feColorMatrix feComponentTransfer feComposite feConvolveMatrix feDiffuseLighting feDisplacementMap feDistantLight feFlood feFuncA feFuncB feFuncG feFuncR feGaussianBlur feImage feMerge feMergeNode feMorphology feOffset fePointLight feSpecularLighting feSpotLight feTile feTurbulence filter font font-face font-face-format font-face-name font-face-src font-face-uri foreignObject g glyph glyphRef hkern image line linearGradient marker mask metadata missing-glyph path pattern polygon polyline radialGradient rect set stop style svg switch symbol text textPath title tref tspan use view vkern'.split(
    ' ',
  );

/** All known element names (HTML + SVG). */
export const knownElementNames: string[] = knownHTMLElementNames.concat(knownSVGElementNames);

/** Void elements that don't get a closing tag in HTML5. */
export const voidElementNames: string[] =
  'area base br col command embed hr img input keygen link meta param source track wbr'.split(' ');

// Pre-built Sets for fast lookup
const knownElementSet = new Set(knownElementNames);
const knownSVGElementSet = new Set(knownSVGElementNames);
const voidElementSet = new Set(voidElementNames);

/**
 * Check if a tag name is a known HTML or SVG element.
 *
 * @param tagName - The tag name to check.
 * @returns True if the tag name is known.
 */
export function isKnownElement(tagName: string): boolean {
  return knownElementSet.has(tagName);
}

/**
 * Check if a tag name is a known SVG element.
 *
 * @param tagName - The tag name to check.
 * @returns True if the tag name is a known SVG element.
 */
export function isKnownSVGElement(tagName: string): boolean {
  return knownSVGElementSet.has(tagName);
}

/**
 * Check if a tag name is a void element (no closing tag in HTML5).
 *
 * @param tagName - The tag name to check.
 * @returns True if the tag name is a void element.
 */
export function isVoidElement(tagName: string): boolean {
  return voidElementSet.has(tagName);
}

// Ensure constructors exist for all known elements on module load
knownElementNames.forEach(ensureTag);
