import { makeRegexMatcher } from './scanner';
import type { Scanner } from './scanner';
import { ENTITIES } from './entities';
import type { CharRefToken } from './types';

const ALPHANUMERIC = /^[a-zA-Z0-9]/;
const getPossibleNamedEntityStart = makeRegexMatcher(/^&[a-zA-Z0-9]/);
const getApparentNamedEntity = makeRegexMatcher(/^&[a-zA-Z0-9]+;/);

// Build per-first-char entity matchers for fast lookup
const getNamedEntityByFirstChar: Record<string, (scanner: Scanner) => string | null> = {};
{
  const namedEntitiesByFirstChar: Record<string, string[]> = {};
  for (const ent of Object.keys(ENTITIES)) {
    const chr = ent.charAt(1);
    (namedEntitiesByFirstChar[chr] ??= []).push(ent.slice(2));
  }
  for (const chr of Object.keys(namedEntitiesByFirstChar)) {
    getNamedEntityByFirstChar[chr] = makeRegexMatcher(
      new RegExp('^&' + chr + '(?:' + namedEntitiesByFirstChar[chr]!.join('|') + ')'),
    );
  }
}

/** Run a matcher without advancing the scanner position. */
function peekMatcher(scanner: Scanner, matcher: (s: Scanner) => string | null): string | null {
  const start = scanner.pos;
  const result = matcher(scanner);
  scanner.pos = start;
  return result;
}

/**
 * Parse a named character reference like `&amp;`.
 * Returns the full entity string or null.
 */
function getNamedCharRef(scanner: Scanner, inAttribute?: boolean): string | null {
  if (!peekMatcher(scanner, getPossibleNamedEntityStart)) return null;

  const matcher = getNamedEntityByFirstChar[scanner.input.charAt(scanner.pos + 1)];
  let entity: string | null = null;
  if (matcher) entity = peekMatcher(scanner, matcher);

  if (entity) {
    if (entity.slice(-1) !== ';') {
      if (inAttribute && ALPHANUMERIC.test(scanner.input.charAt(scanner.pos + entity.length)))
        return null;
      scanner.fatal('Character reference requires semicolon: ' + entity);
    } else {
      scanner.pos += entity.length;
      return entity;
    }
  } else {
    const badEntity = peekMatcher(scanner, getApparentNamedEntity);
    if (badEntity) scanner.fatal('Invalid character reference: ' + badEntity);
    return null;
  }
}

/** Get codepoints for a named entity. */
function getCodePoints(namedEntity: string): number[] {
  return ENTITIES[namedEntity]!.codepoints;
}

const ALLOWED_AFTER_AMP = /^[\u0009\u000a\u000c <&]/;
const getCharRefNumber = makeRegexMatcher(/^(?:[xX][0-9a-fA-F]+|[0-9]+);/);

const BIG_BAD_CODEPOINTS: Record<number, true> = {};
{
  const list = [
    0x1fffe, 0x1ffff, 0x2fffe, 0x2ffff, 0x3fffe, 0x3ffff, 0x4fffe, 0x4ffff, 0x5fffe, 0x5ffff,
    0x6fffe, 0x6ffff, 0x7fffe, 0x7ffff, 0x8fffe, 0x8ffff, 0x9fffe, 0x9ffff, 0xafffe, 0xaffff,
    0xbfffe, 0xbffff, 0xcfffe, 0xcffff, 0xdfffe, 0xdffff, 0xefffe, 0xeffff, 0xffffe, 0xfffff,
    0x10fffe, 0x10ffff,
  ];
  for (const cp of list) BIG_BAD_CODEPOINTS[cp] = true;
}

/** Check if a codepoint is legal per HTML spec. */
function isLegalCodepoint(cp: number): boolean {
  if (
    cp === 0 ||
    (cp >= 0x80 && cp <= 0x9f) ||
    (cp >= 0xd800 && cp <= 0xdfff) ||
    cp >= 0x10ffff ||
    (cp >= 0x1 && cp <= 0x8) ||
    cp === 0xb ||
    (cp >= 0xd && cp <= 0x1f) ||
    (cp >= 0x7f && cp <= 0x9f) ||
    (cp >= 0xfdd0 && cp <= 0xfdef) ||
    cp === 0xfffe ||
    cp === 0xffff ||
    (cp >= 0x10000 && BIG_BAD_CODEPOINTS[cp])
  )
    return false;
  return true;
}

/**
 * Parse a character reference at the current position.
 *
 * Handles named (&amp;), decimal (&#123;), and hex (&#xAB;) references.
 * Returns null if no character reference starts here, or throws on errors.
 *
 * @param scanner - The input scanner positioned at a potential '&'.
 * @param inAttribute - Whether parsing inside an attribute value.
 * @param allowedChar - Character that aborts silently if found after '&'.
 * @returns A CharRef token or null.
 * @throws {Error} On invalid or illegal character references.
 */
export function getCharacterReference(
  scanner: Scanner,
  inAttribute?: boolean,
  allowedChar?: string,
): CharRefToken | null {
  if (scanner.peek() !== '&') return null;

  const afterAmp = scanner.input.charAt(scanner.pos + 1);

  if (afterAmp === '#') {
    scanner.pos += 2;
    const refNumber = getCharRefNumber(scanner);
    if (!refNumber) scanner.fatal('Invalid numerical character reference starting with &#');

    let codepoint: number;
    if (refNumber.charAt(0) === 'x' || refNumber.charAt(0) === 'X') {
      let hex = refNumber.slice(1, -1);
      while (hex.charAt(0) === '0') hex = hex.slice(1);
      if (hex.length > 6) scanner.fatal('Numerical character reference too large: 0x' + hex);
      codepoint = parseInt(hex || '0', 16);
    } else {
      let dec = refNumber.slice(0, -1);
      while (dec.charAt(0) === '0') dec = dec.slice(1);
      if (dec.length > 7) scanner.fatal('Numerical character reference too large: ' + dec);
      codepoint = parseInt(dec || '0', 10);
    }

    if (!isLegalCodepoint(codepoint))
      scanner.fatal('Illegal codepoint in numerical character reference: &#' + refNumber);

    return { t: 'CharRef', v: '&#' + refNumber, cp: [codepoint] };
  } else if (
    !afterAmp ||
    (allowedChar && afterAmp === allowedChar) ||
    ALLOWED_AFTER_AMP.test(afterAmp)
  ) {
    return null;
  } else {
    const namedEntity = getNamedCharRef(scanner, inAttribute);
    if (namedEntity) {
      return { t: 'CharRef', v: namedEntity, cp: getCodePoints(namedEntity) };
    }
    return null;
  }
}
