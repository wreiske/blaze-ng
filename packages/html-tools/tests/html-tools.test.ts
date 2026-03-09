import { describe, it, expect } from 'vitest';
import {
  Scanner,
  getCharacterReference,
  getComment,
  getDoctype,
  getHTMLToken,
  getContent,
  parseFragment,
  TemplateTag,
} from '../src/index';
import { HTML, CharRef, Comment, Tag, AttrsFn } from '@blaze-ng/htmljs';
import { toJS } from '@blaze-ng/blaze-tools';

// Helper: tokenize an entire input string
function tokenize(input: string) {
  const scanner = new Scanner(input);
  const tokens = [];
  while (!scanner.isEOF()) {
    const token = getHTMLToken(scanner);
    if (token) tokens.push(token);
  }
  return tokens;
}

// =========================================================================
// Character reference tests
// =========================================================================
describe('html-tools - entities', () => {
  const succeed = (
    input: string | { input: string; inAttribute?: boolean; allowedChar?: string },
    matchOrCp: string | (string | number)[],
    codepoints?: (string | number)[],
  ) => {
    const opts = typeof input === 'string' ? { input } : input;
    let match: string;
    let cp: (string | number)[];
    if (typeof matchOrCp !== 'string') {
      cp = matchOrCp;
      match = opts.input;
    } else {
      match = matchOrCp;
      cp = codepoints!;
    }

    const scanner = new Scanner(opts.input);
    const result = getCharacterReference(scanner, opts.inAttribute, opts.allowedChar);
    expect(result).toBeTruthy();
    expect(scanner.pos).toBe(match.length);
    expect(result).toEqual({
      t: 'CharRef',
      v: match,
      cp: cp.map((x) => (typeof x === 'string' ? x.charCodeAt(0) : x)),
    });
  };

  const ignore = (
    input: string | { input: string; inAttribute?: boolean; allowedChar?: string },
  ) => {
    const opts = typeof input === 'string' ? { input } : input;
    const scanner = new Scanner(opts.input);
    const result = getCharacterReference(scanner, opts.inAttribute, opts.allowedChar);
    expect(result).toBeFalsy();
    expect(scanner.pos).toBe(0);
  };

  const fatal = (
    input: string | { input: string; inAttribute?: boolean; allowedChar?: string },
    messageContains: string,
  ) => {
    const opts = typeof input === 'string' ? { input } : input;
    const scanner = new Scanner(opts.input);
    expect(() => getCharacterReference(scanner, opts.inAttribute, opts.allowedChar)).toThrow(
      messageContains,
    );
  };

  it('should handle basic cases', () => {
    ignore('a');
    ignore('&');
    ignore('&&');
    ignore('&\t');
    ignore('& ');
    fatal('&#', 'Invalid numerical character reference starting with &#');
    ignore('&a');
    fatal('&a;', 'Invalid character reference: &a;');
    ignore({ input: '&"', allowedChar: '"' });
    ignore('&"');
  });

  it('should parse named entities', () => {
    succeed('&gt;', ['>']);
    fatal('&gt', 'Character reference requires semicolon');
    ignore('&aaa');
    fatal('&gta', 'Character reference requires semicolon');
    ignore({ input: '&gta', inAttribute: true });
    fatal({ input: '&gt=', inAttribute: true }, 'Character reference requires semicolon: &gt');
    succeed('&gt;;', '&gt;', ['>']);
    fatal('&asdflkj;', 'Invalid character reference: &asdflkj;');
    fatal('&A0asdflkj;', 'Invalid character reference: &A0asdflkj;');
    ignore('&A0asdflkj');
    succeed('&zopf;', [120171]);
    succeed('&acE;', [8766, 819]);
  });

  it('should parse numeric entities', () => {
    succeed('&#10;', [10]);
    fatal('&#10', 'Invalid numerical character reference starting with &#');
    fatal('&#xg;', 'Invalid numerical character reference starting with &#');
    fatal('&#;', 'Invalid numerical character reference starting with &#');
    fatal('&#a;', 'Invalid numerical character reference starting with &#');
    fatal('&#a', 'Invalid numerical character reference starting with &#');
    fatal('&#z', 'Invalid numerical character reference starting with &#');
    succeed('&#000000000000010;', [10]);
    fatal('&#0001000000000010;', 'Numerical character reference too large: 1000000000010');
    succeed('&#x00000000000000000000a;', [10]);
    fatal('&#x000100000000000a;', 'Numerical character reference too large: 0x100000000000a');
    succeed('&#010;', [10]);
    succeed('&#xa;', [10]);
    succeed('&#Xa;', [10]);
    succeed('&#XA;', [10]);
    succeed('&#xA;', [10]);
  });

  it('should validate codepoints', () => {
    fatal('&#0;', 'Illegal codepoint in numerical character reference: &#0;');
    fatal('&#x0;', 'Illegal codepoint in numerical character reference: &#x0;');
    fatal('&#xb;', 'Illegal codepoint in numerical character reference: &#xb;');
    succeed('&#xc;', [12]);
    fatal('&#11;', 'Illegal codepoint in numerical character reference: &#11;');
    succeed('&#12;', [12]);
    fatal('&#x10ffff;', 'Illegal codepoint in numerical character reference');
    fatal('&#x10fffe;', 'Illegal codepoint in numerical character reference');
    succeed('&#x10fffd;', [0x10fffd]);
    fatal('&#1114111;', 'Illegal codepoint in numerical character reference');
    fatal('&#1114110;', 'Illegal codepoint in numerical character reference');
    succeed('&#1114109;', [0x10fffd]);
  });
});

// =========================================================================
// Comment tests
// =========================================================================
describe('html-tools - comments', () => {
  it('should parse valid comments', () => {
    expect(getComment(new Scanner('<!-- hello -->'))).toEqual({ t: 'Comment', v: ' hello ' });
    expect(getComment(new Scanner('<!---->'))).toEqual({ t: 'Comment', v: '' });
    expect(getComment(new Scanner('<!---x-->'))).toEqual({ t: 'Comment', v: '-x' });
    expect(getComment(new Scanner('<!--x-->'))).toEqual({ t: 'Comment', v: 'x' });
    expect(getComment(new Scanner('<!-- hello - - world -->'))).toEqual({
      t: 'Comment',
      v: ' hello - - world ',
    });
  });

  it('should ignore non-comments', () => {
    for (const input of ['<!DOCTYPE>', '<!-a', '<--', '<!', 'abc', '<a']) {
      const scanner = new Scanner(input);
      expect(getComment(scanner)).toBeNull();
      expect(scanner.pos).toBe(0);
    }
  });

  it('should fail on malformed comments', () => {
    expect(() => getComment(new Scanner('<!--'))).toThrow('Unclosed');
    expect(() => getComment(new Scanner('<!---'))).toThrow('Unclosed');
    expect(() => getComment(new Scanner('<!----'))).toThrow('Unclosed');
    expect(() => getComment(new Scanner('<!-- -'))).toThrow('Unclosed');
    expect(() => getComment(new Scanner('<!-- --'))).toThrow('Unclosed');
    expect(() => getComment(new Scanner('<!-- -- abcd'))).toThrow('Unclosed');
    expect(() => getComment(new Scanner('<!-- ->'))).toThrow('Unclosed');
    expect(() => getComment(new Scanner('<!-- a--b -->'))).toThrow('cannot contain');
    expect(() => getComment(new Scanner('<!--x--->'))).toThrow('must end at first');
    expect(() => getComment(new Scanner('<!-- a\u0000b -->'))).toThrow('cannot contain');
    expect(() => getComment(new Scanner('<!--\u0000 x-->'))).toThrow('cannot contain');
  });
});

// =========================================================================
// Doctype tests
// =========================================================================
describe('html-tools - doctype', () => {
  it('should parse basic doctypes', () => {
    expect(getDoctype(new Scanner('<!DOCTYPE html>x'))).toEqual({
      t: 'Doctype',
      v: '<!DOCTYPE html>',
      name: 'html',
    });

    expect(getDoctype(new Scanner("<!DOCTYPE html SYSTEM 'about:legacy-compat'>x"))).toEqual({
      t: 'Doctype',
      v: "<!DOCTYPE html SYSTEM 'about:legacy-compat'>",
      name: 'html',
      systemId: 'about:legacy-compat',
    });

    expect(getDoctype(new Scanner("<!DOCTYPE html PUBLIC '-//W3C//DTD HTML 4.0//EN'>x"))).toEqual({
      t: 'Doctype',
      v: "<!DOCTYPE html PUBLIC '-//W3C//DTD HTML 4.0//EN'>",
      name: 'html',
      publicId: '-//W3C//DTD HTML 4.0//EN',
    });
  });

  it('should handle case insensitivity', () => {
    for (const input of [
      '<!DOCTYPE html>',
      '<!DOCTYPE htML>',
      '<!DOCTYPE HTML>',
      '<!doctype html>',
      '<!doctYPE html>',
    ]) {
      const result = getDoctype(new Scanner(input));
      expect(result).toBeTruthy();
      expect(result!.name).toBe('html');
    }
  });

  it('should fail on malformed doctypes', () => {
    expect(() => getDoctype(new Scanner('<!DOCTYPE'))).toThrow('Expected space');
    expect(() => getDoctype(new Scanner('<!DOCTYPE >'))).toThrow('Malformed DOCTYPE');
    expect(() => getDoctype(new Scanner('<!DOCTYPE>'))).toThrow('Expected space');
    expect(() => getDoctype(new Scanner('<!DOCTYPE \u0000'))).toThrow('Malformed DOCTYPE');
  });
});

// =========================================================================
// Tokenize tests
// =========================================================================
describe('html-tools - tokenize', () => {
  it('should tokenize basic content', () => {
    expect(tokenize('')).toEqual([]);
    expect(tokenize('abc')).toEqual([{ t: 'Chars', v: 'abc' }]);
    expect(tokenize('&')).toEqual([{ t: 'Chars', v: '&' }]);
    expect(tokenize('&amp;')).toEqual([{ t: 'CharRef', v: '&amp;', cp: [38] }]);
    expect(tokenize('ok&#32;fine')).toEqual([
      { t: 'Chars', v: 'ok' },
      { t: 'CharRef', v: '&#32;', cp: [32] },
      { t: 'Chars', v: 'fine' },
    ]);
  });

  it('should tokenize comments', () => {
    expect(tokenize('a<!--b-->c')).toEqual([
      { t: 'Chars', v: 'a' },
      { t: 'Comment', v: 'b' },
      { t: 'Chars', v: 'c' },
    ]);
  });

  it('should tokenize tags', () => {
    expect(tokenize('<a>')).toEqual([{ t: 'Tag', n: 'a' }]);
    expect(tokenize('<a>X</a>')).toEqual([
      { t: 'Tag', n: 'a' },
      { t: 'Chars', v: 'X' },
      { t: 'Tag', n: 'a', isEnd: true },
    ]);
    expect(tokenize('<a/>')).toEqual([{ t: 'Tag', n: 'a', isSelfClosing: true }]);
  });

  it('should tokenize attributes', () => {
    expect(tokenize('<a b  >')).toEqual([{ t: 'Tag', n: 'a', attrs: { b: [] } }]);
    expect(tokenize('<a b="c" d=e f=\'g\' h \t>')).toEqual([
      {
        t: 'Tag',
        n: 'a',
        attrs: {
          b: [{ t: 'Chars', v: 'c' }],
          d: [{ t: 'Chars', v: 'e' }],
          f: [{ t: 'Chars', v: 'g' }],
          h: [],
        },
      },
    ]);
    // Slash is parsed as part of unquoted attribute
    expect(tokenize('<a b=/>')).toEqual([
      { t: 'Tag', n: 'a', attrs: { b: [{ t: 'Chars', v: '/' }] } },
    ]);
  });

  it('should tokenize character entities in attributes', () => {
    expect(tokenize('<div class=&amp;>')).toEqual([
      { t: 'Tag', n: 'div', attrs: { class: [{ t: 'CharRef', v: '&amp;', cp: [38] }] } },
    ]);
  });

  it('should fail on malformed tags', () => {
    expect(() => tokenize('<')).toThrow();
    expect(() => tokenize('<x')).toThrow();
    expect(() => tokenize('<x a a>')).toThrow(); // duplicate attribute
    expect(() => tokenize('< a>')).toThrow();
    expect(() => tokenize('<!x>')).toThrow();
    expect(() => tokenize('<a{{b}}>')).toThrow();
    expect(() => tokenize('</a b=c>')).toThrow(); // end tag can't have attributes
    expect(() => tokenize('</a/>')).toThrow(); // end tag can't be self-closing
  });

  it('should handle self-closing with attributes', () => {
    expect(tokenize('<x a = b />')).toEqual([
      { t: 'Tag', n: 'x', attrs: { a: [{ t: 'Chars', v: 'b' }] }, isSelfClosing: true },
    ]);
  });
});

// =========================================================================
// Parser - getContent tests
// =========================================================================
describe('html-tools - parser getContent', () => {
  const BR = HTML.BR;
  const HR = HTML.HR;
  const INPUT = HTML.INPUT;
  const A = HTML.A;
  const TEXTAREA = HTML.TEXTAREA;
  const SCRIPT = HTML.SCRIPT;
  const STYLE = HTML.STYLE;

  const succeed = (input: string, expected: unknown) => {
    const endPos = input.indexOf('^^^');
    const cleanInput = input.replace('^^^', '');
    const expectedEnd = endPos < 0 ? cleanInput.length : endPos;

    const scanner = new Scanner(cleanInput);
    const result = getContent(scanner);
    expect(scanner.pos).toBe(expectedEnd);
    expect(toJS(result)).toBe(toJS(expected));
  };

  const fatal = (input: string, messageContains?: string) => {
    const scanner = new Scanner(input);
    if (messageContains) {
      expect(() => getContent(scanner)).toThrow(messageContains);
    } else {
      expect(() => getContent(scanner)).toThrow();
    }
  };

  it('should parse empty and text content', () => {
    succeed('', null);
    succeed('abc', 'abc');
    succeed('abc^^^</x>', 'abc');
  });

  it('should parse character references', () => {
    succeed('a&lt;b', ['a', new CharRef({ html: '&lt;', str: '<' }), 'b']);
    succeed('&acE;', new CharRef({ html: '&acE;', str: '\u223e\u0333' }));
    succeed('&zopf;', new CharRef({ html: '&zopf;', str: '\ud835\udd6b' }));
    succeed('&&>&g&gt;;', ['&&>&g', new CharRef({ html: '&gt;', str: '>' }), ';']);
  });

  it('should parse comments', () => {
    succeed('<!-- x -->', new Comment(' x '));
  });

  it('should fail on unescaped & before certain names', () => {
    fatal('&gt&');
    fatal('<');
  });

  it('should parse void elements', () => {
    succeed('<br>', BR());
    succeed('<br/>', BR());
    fatal('<div/>', 'self-close');
  });

  it('should parse elements with attributes', () => {
    succeed('<hr id=foo>', HR({ id: 'foo' }));
    succeed(
      '<hr id=&lt;foo&gt;>',
      HR({
        id: [
          new CharRef({ html: '&lt;', str: '<' }),
          'foo',
          new CharRef({ html: '&gt;', str: '>' }),
        ],
      }),
    );
    succeed('<input selected>', INPUT({ selected: '' }));
    succeed('<input selected/>', INPUT({ selected: '' }));
    succeed('<input selected />', INPUT({ selected: '' }));
  });

  it('should parse non-void elements', () => {
    succeed('<a></a>', A());
    succeed(
      '<a href="http://www.apple.com/">Apple</a>',
      A({ href: 'http://www.apple.com/' }, 'Apple'),
    );
  });

  it('should parse nested elements', () => {
    const A2 = HTML.getTag('a');
    const B = HTML.getTag('b');
    const C = HTML.getTag('c');
    const D = HTML.getTag('d');
    succeed('<a>1<b>2<c>3<d>4</d>5</c>6</b>7</a>8', [
      A2('1', B('2', C('3', D('4'), '5'), '6'), '7'),
      '8',
    ]);
  });

  it('should fail on unclosed tags', () => {
    fatal('<a>');
    fatal('<a><');
    fatal('<a></');
    fatal('<a></a');
    fatal('<p>');
  });

  it('should parse textarea content (RCDATA)', () => {
    succeed('<textarea>asdf</textarea>', TEXTAREA({ value: 'asdf' }));
    succeed('<textarea x=y>asdf</textarea>', TEXTAREA({ x: 'y', value: 'asdf' }));
    succeed('<textarea><p></textarea>', TEXTAREA({ value: '<p>' }));
    succeed(
      '<textarea>a&amp;b</textarea>',
      TEXTAREA({ value: ['a', new CharRef({ html: '&amp;', str: '&' }), 'b'] }),
    );
    succeed('<textarea></textarea</textarea>', TEXTAREA({ value: '</textarea' }));
    // absorb up to one initial newline
    succeed('<textarea>\n</textarea>', TEXTAREA());
    succeed('<textarea>\nasdf</textarea>', TEXTAREA({ value: 'asdf' }));
    succeed('<textarea>\n\nasdf</textarea>', TEXTAREA({ value: '\nasdf' }));
    succeed('<textarea>\n\n</textarea>', TEXTAREA({ value: '\n' }));
  });

  it('should parse script content (RawText)', () => {
    succeed('<script>var x="<div>";</script>', SCRIPT('var x="<div>";'));
    succeed('<script>var x=1 && 0;</script>', SCRIPT('var x=1 && 0;'));
    succeed('<script>asdf</script>', SCRIPT('asdf'));
    succeed('<script x=y>asdf</script>', SCRIPT({ x: 'y' }, 'asdf'));
    succeed('<script><p></script>', SCRIPT('<p>'));
    succeed('<script>a&amp;b</script>', SCRIPT('a&amp;b'));
    succeed('<script></script</script>', SCRIPT('</script'));
  });

  it('should parse style content (RawText)', () => {
    succeed('<style>asdf</style>', STYLE('asdf'));
    succeed('<style x=y>asdf</style>', STYLE({ x: 'y' }, 'asdf'));
    succeed('<style><p></style>', STYLE('<p>'));
    succeed('<style>a&amp;b</style>', STYLE('a&amp;b'));
  });

  it('should normalize CR/LF', () => {
    succeed('<br\r\n x>', BR({ x: '' }));
    succeed('<br\r x>', BR({ x: '' }));
    succeed('<!--\r\n-->', new Comment('\n'));
    succeed('<!--\r-->', new Comment('\n'));
  });

  it('should handle multiple sibling elements', () => {
    succeed('<br><br><br>', [BR(), BR(), BR()]);
    succeed('aaa<br>\nbbb<br>\nccc<br>', ['aaa', BR(), '\nbbb', BR(), '\nccc', BR()]);
  });
});

// =========================================================================
// parseFragment tests
// =========================================================================
describe('html-tools - parseFragment', () => {
  it('should parse simple fragments', () => {
    const DIV = HTML.DIV;
    const P = HTML.P;
    expect(toJS(parseFragment('<div><p id=foo>Hello</p></div>'))).toBe(
      toJS(DIV(P({ id: 'foo' }, 'Hello'))),
    );
  });

  it('should fail on unexpected close tags', () => {
    for (const badFrag of ['asdf</br>', 'asdf</a>']) {
      expect(() => parseFragment(badFrag)).toThrow(/Unexpected HTML close tag/);
    }
  });

  it('should parse elements with proper structure', () => {
    const p = parseFragment('<p></p>') as Tag;
    expect(p.tagName).toBe('p');
    expect(p.attrs).toBeNull();
    expect(p).toBeInstanceOf(Tag);
    expect(p.children).toHaveLength(0);
  });

  it('should parse elements with children', () => {
    const p = parseFragment('<p>x</p>') as Tag;
    expect(p.tagName).toBe('p');
    expect(p.children).toHaveLength(1);
    expect(p.children[0]).toBe('x');
  });

  it('should parse character references in content', () => {
    const p = parseFragment('<p>x&#65;</p>') as Tag;
    expect(p.children).toHaveLength(2);
    expect(p.children[0]).toBe('x');
    expect(p.children[1]).toBeInstanceOf(CharRef);
    expect((p.children[1] as CharRef).html).toBe('&#65;');
    expect((p.children[1] as CharRef).str).toBe('A');
  });

  it('should parse multiple sibling elements', () => {
    const pp = parseFragment('<p>x</p><p>y</p>') as unknown[];
    expect(pp).toBeInstanceOf(Array);
    expect(pp).toHaveLength(2);
  });

  it('should accept a Scanner as input', () => {
    const scanner = new Scanner('asdf');
    scanner.pos = 1;
    expect(parseFragment(scanner)).toBe('sdf');
  });
});

// =========================================================================
// getTemplateTag tests
// =========================================================================
describe('html-tools - getTemplateTag', () => {
  const BR = HTML.BR;
  const DIV = HTML.DIV;
  const TEXTAREA = HTML.TEXTAREA;

  const mustache = /^\{\{(!?[a-zA-Z 0-9</>]+)\}\}/;

  const getTemplateTag = (scanner: Scanner, _position: number) => {
    if (!(scanner.peek() === '{' && scanner.rest().slice(0, 2) === '{{')) return null;
    const match = mustache.exec(scanner.rest());
    if (!match) scanner.fatal('Bad mustache');
    scanner.pos += match![0].length;
    if (match![1].charAt(0) === '!') return null;
    return new TemplateTag({ stuff: match![1] });
  };

  const succeed = (input: string, expected: unknown) => {
    const endPos = input.indexOf('^^^');
    const cleanInput = input.replace('^^^', '');
    const expectedEnd = endPos < 0 ? cleanInput.length : endPos;

    const scanner = new Scanner(cleanInput);
    scanner.getTemplateTag = getTemplateTag;
    let result: unknown;
    try {
      result = getContent(scanner);
    } catch (e) {
      result = String(e);
    }
    expect(scanner.pos).toBe(expectedEnd);
    expect(toJS(result)).toBe(toJS(expected));
  };

  const fatal = (input: string, messageContains?: string) => {
    const scanner = new Scanner(input);
    scanner.getTemplateTag = getTemplateTag;
    if (messageContains) {
      expect(() => getContent(scanner)).toThrow(messageContains);
    } else {
      expect(() => getContent(scanner)).toThrow();
    }
  };

  it('should parse template tags', () => {
    succeed('{{foo}}', new TemplateTag({ stuff: 'foo' }));
  });

  it('should parse template tags in elements', () => {
    succeed(
      '<a href=http://www.apple.com/>{{foo}}</a>',
      HTML.A({ href: 'http://www.apple.com/' }, new TemplateTag({ stuff: 'foo' })),
    );
  });

  it('should not parse template tags in comments', () => {
    succeed('<!--{{foo}}-->', new Comment('{{foo}}'));
  });

  it('should handle template comments', () => {
    succeed('x{{!foo}}{{!bar}}y', 'xy');
    succeed('x{{!foo}}{{bar}}y', ['x', new TemplateTag({ stuff: 'bar' }), 'y']);
    succeed('{{!foo}}', null);
    succeed('', null);
  });

  it('should fail on incomplete template tags', () => {
    fatal('{{foo');
    fatal('<a>{{</a>');
  });

  it('should handle template tags in start tags', () => {
    succeed('<br {{x}}>', BR(AttrsFn(new TemplateTag({ stuff: 'x' }))));
    succeed(
      '<br {{x}} {{y}}>',
      BR(AttrsFn(new TemplateTag({ stuff: 'x' }), new TemplateTag({ stuff: 'y' }))),
    );
    succeed('<br {{x}} y>', BR(AttrsFn({ y: '' }, new TemplateTag({ stuff: 'x' }))));
  });

  it('should handle template tags in attribute values', () => {
    succeed('<br x={{y}} z>', BR({ x: new TemplateTag({ stuff: 'y' }), z: '' }));
    succeed('<br x=y{{z}}w>', BR({ x: ['y', new TemplateTag({ stuff: 'z' }), 'w'] }));
    succeed('<br x="y{{z}}w">', BR({ x: ['y', new TemplateTag({ stuff: 'z' }), 'w'] }));
  });

  it('should fail on template tags adjacent to attribute names', () => {
    fatal('<br {{x}}y>');
    fatal('<br {{x}}=y>');
  });

  it('should handle single curly brace', () => {
    succeed('a{b', 'a{b');
    succeed('<br x={ />', BR({ x: '{' }));
  });

  it('should handle empty content with template comments', () => {
    succeed('<div>{{!foo}}{{!bar}}</div>', DIV());
    succeed('<div>{{!foo}}<br />{{!bar}}</div>', DIV(BR()));
    succeed('{{! <div></div> }}', null);
  });

  it('should handle textarea with template tag attrs', () => {
    succeed(
      '<textarea {{a}} x=1 {{b}}></textarea>',
      TEXTAREA(
        AttrsFn({ x: '1' }, new TemplateTag({ stuff: 'a' }), new TemplateTag({ stuff: 'b' })),
      ),
    );
  });
});
