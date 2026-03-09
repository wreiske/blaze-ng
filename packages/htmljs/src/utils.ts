import { isConstructedObject } from './tag';

/**
 * Check if a value is an array.
 *
 * @param x - The value to check.
 * @returns True if x is an Array.
 */
export function isArray(x: unknown): x is unknown[] {
  return Array.isArray(x);
}

/**
 * Check if an HTMLjs node is "nully" — null, undefined, or an array of all nully items.
 *
 * @param node - The node to check.
 * @returns True if the node is nully.
 */
export function isNully(node: unknown): boolean {
  if (node == null) return true;

  if (isArray(node)) {
    for (let i = 0; i < node.length; i++) {
      if (!isNully(node[i])) return false;
    }
    return true;
  }

  return false;
}

/**
 * Check if a string is a valid HTML attribute name.
 *
 * @param name - The attribute name to validate.
 * @returns True if the name is valid.
 */
export function isValidAttributeName(name: string): boolean {
  return /^[:_A-Za-z][:_A-Za-z0-9.\-]*/.test(name);
}

/**
 * Flatten an array of attribute dictionaries into a single dictionary.
 *
 * Combines multiple attribute dictionaries, removing nully values.
 *
 * @param attrs - A single attribute dictionary or array of dictionaries.
 * @returns The flattened attributes, or null if empty.
 * @throws If any item is not a plain JS object, or if an attribute name is invalid.
 */
export function flattenAttributes(
  attrs: Record<string, unknown> | Record<string, unknown>[] | null | undefined,
): Record<string, unknown> | null {
  if (!attrs) return attrs ?? null;

  const isList = isArray(attrs);
  if (isList && attrs.length === 0) return null;

  const result: Record<string, unknown> = {};
  const count = isList ? attrs.length : 1;

  for (let i = 0; i < count; i++) {
    const oneAttrs = (isList ? attrs[i] : attrs) as Record<string, unknown>;
    if (typeof oneAttrs !== 'object' || isConstructedObject(oneAttrs)) {
      throw new Error('Expected plain JS object as attrs, found: ' + oneAttrs);
    }
    for (const name in oneAttrs) {
      if (!isValidAttributeName(name)) {
        throw new Error('Illegal HTML attribute name: ' + name);
      }
      const value = oneAttrs[name];
      if (!isNully(value)) {
        result[name] = value;
      }
    }
  }

  return result;
}
