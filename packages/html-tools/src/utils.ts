import { knownElementNames } from '@blaze-ng/htmljs';

/**
 * Convert ASCII uppercase letters to lowercase.
 * @param str - Input string.
 * @returns The string with A-Z replaced by a-z.
 */
export function asciiLowerCase(str: string): string {
  return str.replace(/[A-Z]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 32));
}

const svgCamelCaseAttributes =
  'attributeName attributeType baseFrequency baseProfile calcMode clipPathUnits contentScriptType contentStyleType diffuseConstant edgeMode externalResourcesRequired filterRes filterUnits glyphRef glyphRef gradientTransform gradientTransform gradientUnits gradientUnits kernelMatrix kernelUnitLength kernelUnitLength kernelUnitLength keyPoints keySplines keyTimes lengthAdjust limitingConeAngle markerHeight markerUnits markerWidth maskContentUnits maskUnits numOctaves pathLength patternContentUnits patternTransform patternUnits pointsAtX pointsAtY pointsAtZ preserveAlpha preserveAspectRatio primitiveUnits refX refY repeatCount repeatDur requiredExtensions requiredFeatures specularConstant specularExponent specularExponent spreadMethod spreadMethod startOffset stdDeviation stitchTiles surfaceScale surfaceScale systemLanguage tableValues targetX targetY textLength textLength viewBox viewTarget xChannelSelector yChannelSelector zoomAndPan'.split(
    ' ',
  );

const properAttributeCaseMap: Record<string, string> = {};
for (const a of svgCamelCaseAttributes) {
  properAttributeCaseMap[asciiLowerCase(a)] = a;
}

const properTagCaseMap: Record<string, string> = {};
for (const a of knownElementNames) {
  properTagCaseMap[asciiLowerCase(a)] = a;
}

/**
 * Convert a tag name to proper case for HTML/SVG.
 *
 * HTML tag names are case-insensitive, but SVG element names are
 * case-sensitive in the DOM API. The browser's HTML parser normalizes
 * casing, and so must any HTML-parsing toolchain.
 *
 * @param name - Tag name in any case.
 * @returns Properly cased tag name, or lowered if unknown.
 */
export function properCaseTagName(name: string): string {
  const lowered = asciiLowerCase(name);
  return Object.prototype.hasOwnProperty.call(properTagCaseMap, lowered)
    ? properTagCaseMap[lowered]!
    : lowered;
}

/**
 * Convert an attribute name to proper case for SVG.
 * @param name - Attribute name in any case.
 * @returns Properly cased attribute name.
 */
export function properCaseAttributeName(name: string): string {
  const lowered = asciiLowerCase(name);
  return Object.prototype.hasOwnProperty.call(properAttributeCaseMap, lowered)
    ? properAttributeCaseMap[lowered]!
    : lowered;
}
