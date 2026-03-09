import { describe, it, expect } from 'vitest';
import type { Scanner } from '../src/types';
import {
  parseNumber,
  parseIdentifierName,
  parseExtendedIdentifierName,
  parseStringLiteral,
  toJS,
  toJSLiteral,
  toObjectLiteralKey,
  EmitCode,
  ToJSVisitor,
} from '../src/index';
import { HTML } from '@blaze-ng/htmljs';

// Minimal Scanner implementation for testing
class TestScanner implements Scanner {
  pos = 0;
  readonly input: string;

  constructor(input: string) {
    this.input = input;
  }

  peek(): string {
    return this.input.charAt(this.pos);
  }

  rest(): string {
    return this.input.slice(this.pos);
  }

  isEOF(): boolean {
    return this.pos >= this.input.length;
  }

  fatal(message: string): never {
    throw new Error(message);
  }
}

describe('blaze-tools - token parsers', () => {
  const run = (
    func: (scanner: Scanner) => { text: string; value: unknown } | string | null,
    input: string,
    expected: unknown,
  ) => {
    const scanner = new TestScanner('z' + input);
    // make sure the parse function respects scanner.pos
    scanner.pos = 1;
    const result = func(scanner);
    if (expected === null) {
      expect(scanner.pos).toBe(1);
      expect(result).toBeNull();
    } else {
      expect(scanner.isEOF()).toBe(true);
      expect(result).toEqual(expected);
    }
  };

  const runValue = (
    func: (scanner: Scanner) => { text: string; value: unknown } | null,
    input: string,
    expectedValue: unknown,
  ) => {
    const expected = expectedValue === null ? null : { text: input, value: expectedValue };
    run(func, input, expected);
  };

  it('should parse numbers', () => {
    runValue(parseNumber, '0', 0);
    runValue(parseNumber, '-0', -0);
    runValue(parseNumber, '-', null);
    runValue(parseNumber, '.a', null);
    runValue(parseNumber, '.1', 0.1);
    runValue(parseNumber, '1.', 1);
    runValue(parseNumber, '1.1', 1.1);
    runValue(parseNumber, '0x', null);
    runValue(parseNumber, '0xa', 10);
    runValue(parseNumber, '-0xa', -10);
    runValue(parseNumber, '1e+1', 10);
  });

  it('should parse identifier names', () => {
    for (const f of [parseIdentifierName, parseExtendedIdentifierName]) {
      run(f, 'a', 'a');
      run(f, 'true', 'true');
      run(f, 'null', 'null');
      run(f, 'if', 'if');
      run(f, '1', null);
      run(f, '1a', null);
      run(f, '+a', null);
      run(f, 'a1', 'a1');
      run(f, 'a1a', 'a1a');
      run(f, '_a8f_f8d88_', '_a8f_f8d88_');
    }

    // Extended-only features
    run(parseIdentifierName, '@index', null);
    run(parseExtendedIdentifierName, '@index', '@index');
    run(parseExtendedIdentifierName, '@something', '@something');
    run(parseExtendedIdentifierName, '@', null);
  });

  it('should parse string literals', () => {
    runValue(parseStringLiteral, '"a"', 'a');
    runValue(parseStringLiteral, '"\'"', "'");
    runValue(parseStringLiteral, "'\"'", '"');
    runValue(parseStringLiteral, '"a\\\nb"', 'ab'); // line continuation
    runValue(parseStringLiteral, '"a\u0062c"', 'abc');
    runValue(parseStringLiteral, '"\\0\\b\\f\\n\\r\\t\\v"', '\0\b\f\n\r\t\u000b');
    runValue(parseStringLiteral, '"\\x41"', 'A');
    runValue(parseStringLiteral, '"\\\\"', '\\');
    runValue(parseStringLiteral, '"\\\""', '"');
    runValue(parseStringLiteral, '"\\\'"', "'");
    runValue(parseStringLiteral, "'\\\\'", '\\');
    runValue(parseStringLiteral, "'\\\"'", '"');
    runValue(parseStringLiteral, "'\\\''", "'");

    expect(() => {
      run(parseStringLiteral, "'this is my string", null);
    }).toThrow(/Unterminated string literal/);
  });
});

describe('blaze-tools - toJSLiteral', () => {
  it('should convert primitives to JS literals', () => {
    expect(toJSLiteral('hello')).toBe('"hello"');
    expect(toJSLiteral(42)).toBe('42');
    expect(toJSLiteral(true)).toBe('true');
    expect(toJSLiteral(null)).toBe('null');
  });
});

describe('blaze-tools - toObjectLiteralKey', () => {
  it('should return bare keys for valid identifiers', () => {
    expect(toObjectLiteralKey('foo')).toBe('foo');
    expect(toObjectLiteralKey('_private')).toBe('_private');
    expect(toObjectLiteralKey('$jquery')).toBe('$jquery');
  });

  it('should quote reserved words and invalid identifiers', () => {
    expect(toObjectLiteralKey('null')).toBe('"null"');
    expect(toObjectLiteralKey('if')).toBe('"if"');
    expect(toObjectLiteralKey('class')).toBe('"class"');
    expect(toObjectLiteralKey('foo-bar')).toBe('"foo-bar"');
    expect(toObjectLiteralKey('123')).toBe('"123"');
  });
});

describe('blaze-tools - EmitCode', () => {
  it('should wrap code strings', () => {
    const code = new EmitCode('function() { return 1; }');
    expect(code.value).toBe('function() { return 1; }');
    expect(code.toJS(new ToJSVisitor())).toBe('function() { return 1; }');
  });

  it('should throw on non-string input', () => {
    expect(() => new EmitCode(123 as unknown as string)).toThrow(
      /EmitCode must be constructed with a string/,
    );
  });
});

describe('blaze-tools - toJS', () => {
  it('should convert simple tags to JS', () => {
    const node = HTML.P('hello');
    const js = toJS(node);
    expect(js).toBe('HTML.P("hello")');
  });

  it('should convert tags with attrs and children', () => {
    const node = HTML.P({ class: 'test' }, 'hello');
    const js = toJS(node);
    expect(js).toContain('HTML.P(');
    expect(js).toContain('"class": "test"');
    expect(js).toContain('"hello"');
  });

  it('should convert CharRef to JS', () => {
    const ref = new (HTML.CharRef as unknown as new (attrs: {
      html: string;
      str: string;
    }) => unknown)({ html: '&amp;', str: '&' });
    const js = toJS(ref);
    expect(js).toContain('HTML.CharRef');
    expect(js).toContain('"&amp;"');
  });

  it('should convert Raw to JS', () => {
    const raw = new (HTML.Raw as unknown as new (value: string) => unknown)('<br>');
    const js = toJS(raw);
    expect(js).toBe('HTML.Raw("<br>")');
  });

  it('should convert null to "null"', () => {
    expect(toJS(null)).toBe('null');
  });

  it('should convert primitives to literals', () => {
    expect(toJS('hello')).toBe('"hello"');
    expect(toJS(42)).toBe('42');
    expect(toJS(true)).toBe('true');
    expect(toJS(false)).toBe('false');
  });

  it('should convert arrays', () => {
    expect(toJS(['a', 'b'])).toBe('["a", "b"]');
  });
});
