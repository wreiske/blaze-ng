/**
 * ID string conversion utilities.
 *
 * Replaces Meteor's MongoID.idStringify/idParse. These convert arbitrary
 * IDs to/from unique string keys for use in position maps during diffing.
 */

/**
 * Convert an arbitrary ID value to a unique string representation.
 *
 * @param id - The ID value (string, number, boolean, null, undefined, or object).
 * @returns A unique string key.
 */
export function idStringify(id: unknown): string {
  if (typeof id === 'string') {
    // Prefix with '-' for strings to distinguish from other types
    if (id === '') return id;
    // If it starts with '-' or '{' or the type prefixes, wrap it
    if (
      id.charAt(0) === '-' ||
      id.charAt(0) === '{' ||
      id.charAt(0) === '~' ||
      id.charAt(0) === '#' ||
      id.charAt(0) === '!'
    ) {
      return '-' + id;
    }
    return id;
  } else if (typeof id === 'number') {
    return '~' + id.toString();
  } else if (typeof id === 'boolean') {
    return '!' + (id ? '1' : '0');
  } else if (id === undefined) {
    return '#undefined';
  } else if (id === null) {
    return '#null';
  } else if (id instanceof Object) {
    // For ObjectId-like things, serialize to JSON
    return '{' + JSON.stringify(id) + '}';
  }
  throw new Error('Unsupported ID type: ' + typeof id);
}

/**
 * Parse a string key back to its original ID value.
 *
 * @param str - The stringified ID.
 * @returns The original ID value.
 */
export function idParse(str: string): unknown {
  if (str === '') return str;
  const prefix = str.charAt(0);
  if (prefix === '-') return str.slice(1);
  if (prefix === '~') return Number(str.slice(1));
  if (prefix === '!') return str === '!1';
  if (prefix === '#') return str === '#null' ? null : undefined;
  if (prefix === '{') return JSON.parse(str.slice(1, -1));
  return str;
}
