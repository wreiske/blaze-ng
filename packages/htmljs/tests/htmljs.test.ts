/**
 * Tests ported from packages/htmljs/htmljs_test.js (original Blaze).
 *
 * Original has 4 tests:
 * - htmljs - getTag
 * - htmljs - construction
 * - htmljs - utils
 * - htmljs - details
 */
import { describe, it, expect } from 'vitest';
import { HTML, Tag, CharRef, isVoidElement, isKnownElement, toHTML } from '../src/index';

describe('htmljs - getTag', () => {
  it('should create and register tag constructors', () => {
    const FOO = HTML.getTag('foo');
    expect(HTML.FOO).toBe(FOO);
    const x = FOO();

    expect(x.tagName).toBe('foo');
    expect(x).toBeInstanceOf(Tag);
    expect(x.children).toEqual([]);
    expect(x.attrs).toBe(null);

    expect(new FOO()).toBeInstanceOf(Tag);

    const P = HTML.P as ReturnType<typeof HTML.getTag>;
    expect(new P()).toBeInstanceOf(Tag);
    expect(new P()).not.toBeInstanceOf(FOO);

    const result = HTML.ensureTag('Bar');
    expect(result).toBeUndefined();
    const BAR = HTML.BAR as ReturnType<typeof HTML.getTag>;
    expect(BAR().tagName).toBe('Bar');
  });
});

describe('htmljs - construction', () => {
  it('should construct tags with attrs and children', () => {
    const A = HTML.getTag('a');
    const B = HTML.getTag('b');
    const C = HTML.getTag('c');

    const a = A(0, B({ q: 0 }, C(A(B({})), 'foo')));
    expect(a.tagName).toBe('a');
    expect(a.attrs).toBe(null);
    expect(a.children.length).toBe(2);
    expect(a.children[0]).toBe(0);

    const b = a.children[1] as Tag;
    expect(b.tagName).toBe('b');
    expect(b.attrs).toEqual({ q: 0 });
    expect(b.children.length).toBe(1);

    const c = b.children[0] as Tag;
    expect(c.tagName).toBe('c');
    expect(c.attrs).toBe(null);
    expect(c.children.length).toBe(2);
    expect((c.children[0] as Tag).tagName).toBe('a');
    expect((c.children[0] as Tag).attrs).toBe(null);
    expect((c.children[0] as Tag).children.length).toBe(1);
    expect(((c.children[0] as Tag).children[0] as Tag).tagName).toBe('b');
    expect(((c.children[0] as Tag).children[0] as Tag).children.length).toBe(0);
    expect(((c.children[0] as Tag).children[0] as Tag).attrs).toEqual({});
    expect(c.children[1]).toBe('foo');

    const a2 = new A({ m: 1 }, { n: 2 }, B(), { o: 3 }, 'foo');
    expect(a2.tagName).toBe('a');
    expect(a2.attrs).toEqual({ m: 1 });
    expect(a2.children.length).toBe(4);
    expect(a2.children[0]).toEqual({ n: 2 });
    expect((a2.children[1] as Tag).tagName).toBe('b');
    expect(a2.children[2]).toEqual({ o: 3 });
    expect(a2.children[3]).toBe('foo');

    // Tests of isConstructedObject (indirectly)
    expect(A({ x: 1 }).children.length).toBe(0);
    const f = function () {} as unknown as new () => object;
    expect(A(new f()).children.length).toBe(1);
    expect(A(new Date()).children.length).toBe(1);
    expect(A({ constructor: 'blah' }).children.length).toBe(0);
    expect(A({ constructor: Object }).children.length).toBe(0);

    expect(toHTML(new CharRef({ html: '&amp;', str: '&' }))).toBe('&amp;');
    expect(() => {
      new CharRef({ html: '&amp;' } as { html: string; str: string });
    }).toThrow();
  });
});

describe('htmljs - utils', () => {
  it('should correctly identify void and known elements', () => {
    expect(isVoidElement('br')).toBe(true);
    expect(isVoidElement('div')).toBe(false);
    expect(isKnownElement('div')).toBe(true);
  });
});

describe('htmljs - details', () => {
  it('should convert false to string', () => {
    expect(toHTML(false)).toBe('false');
  });
});
