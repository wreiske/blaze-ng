import { describe, test, expect } from 'vitest';
import {
  Spacebars,
  kw,
  SafeString,
  call,
  dot,
  mustache,
  attrMustache,
  makeRaw,
  include,
} from '../src/index';
import { Raw } from '@blaze-ng/htmljs';

// ─── Spacebars.dot tests ────────────────────────────────────────────────────

describe('Spacebars.dot', () => {
  test('basic property access', () => {
    expect(dot(null, 'foo')).toBe(null);
    expect(dot('foo', 'foo')).toBe(undefined);
    expect(dot({ x: 1 }, 'x')).toBe(1);
  });

  test('function property with binding', () => {
    const result = dot(
      {
        x: 1,
        y: function () {
          return this.x + 1;
        },
      },
      'y',
    ) as () => number;
    expect(result()).toBe(2);
  });

  test('value is a function returning object', () => {
    const result = dot(
      () => ({
        x: 1,
        y: function () {
          return this.x + 1;
        },
      }),
      'y',
    ) as () => number;
    expect(result()).toBe(2);
  });

  test('mget pattern — re-evaluates value function each time', () => {
    let m = 1;
    const mget = () => ({
      answer: m,
      getAnswer: function () {
        return this.answer;
      },
    });

    const mgetDotAnswer = dot(mget, 'answer');
    expect(mgetDotAnswer).toBe(1);

    m = 3;
    const mgetDotGetAnswer = dot(mget, 'getAnswer') as () => number;
    expect(mgetDotGetAnswer()).toBe(3);
    m = 4;
    // getAnswer was bound when m=3, so it returns 3
    expect(mgetDotGetAnswer()).toBe(3);
  });

  test('multi-level dot access', () => {
    let m = 5;
    const mget = () => ({
      answer: m,
      getAnswer: function () {
        return this.answer;
      },
    });
    const closet = {
      mget,
      mget2: function () {
        return this.mget();
      },
    };

    m = 5;
    dot(closet, 'mget', 'answer');
    m = 6;
    const f2 = dot(closet, 'mget2', 'answer');
    expect(f2).toBe(6);
    m = 8;
    const f3 = dot(closet, 'mget2', 'getAnswer') as () => number;
    m = 9;
    expect(f3()).toBe(8);
  });

  test('falsy values pass through', () => {
    expect(dot(0, 'abc', 'def')).toBe(0);
    expect(dot(() => null, 'abc', 'def')).toBe(null);
    expect(dot(() => 0, 'abc', 'def')).toBe(0);
  });

  test('function property that takes arguments', () => {
    const result1 = dot(
      {
        one: 1,
        inc: function (x: number) {
          return this.one + x;
        },
      },
      'inc',
    ) as (x: number) => number;
    expect(result1(6)).toBe(7);

    const result2 = dot(
      () => ({
        one: 1,
        inc: function (x: number) {
          return this.one + x;
        },
      }),
      'inc',
    ) as (x: number) => number;
    expect(result2(8)).toBe(9);
  });
});

// ─── Spacebars.call tests ───────────────────────────────────────────────────

describe('Spacebars.call', () => {
  test('calls function with evaluated args', () => {
    const add = (x: number, y: number) => x + y;
    expect(call(add, 1, 2)).toBe(3);
  });

  test('evaluates function args before calling', () => {
    const add = (x: number, y: number) => x + y;
    expect(
      call(
        add,
        () => 1,
        () => 2,
      ),
    ).toBe(3);
  });

  test('returns non-function value as-is', () => {
    expect(call(42)).toBe(42);
    expect(call('hello')).toBe('hello');
    expect(call(null)).toBe(null);
    expect(call(undefined)).toBe(undefined);
  });

  test('throws on non-function with args', () => {
    expect(() => call(42, 1)).toThrow("Can't call non-function: 42");
  });

  test('null with args does not throw', () => {
    expect(call(null, 1)).toBe(null);
  });

  test('async - promise arguments', async () => {
    const add = (x: number, y: number) => x + y;
    expect(await call(add, 1, Promise.resolve(2))).toBe(3);
    expect(await call(add, Promise.resolve(1), 2)).toBe(3);
    expect(await call(add, Promise.resolve(1), Promise.resolve(2))).toBe(3);
  });
});

// ─── Spacebars.dot async tests ──────────────────────────────────────────────

describe('Spacebars.dot async', () => {
  test('resolves promise values', async () => {
    const o = { y: 1 };
    expect(await dot(Promise.resolve(null), 'x', 'y')).toBe(null);
    expect(await dot(Promise.resolve({ x: o }), 'x', 'y')).toBe(1);
  });

  test('handles promise in nested property', async () => {
    const o = { y: 1 };
    expect(await dot({ x: Promise.resolve(o) }, 'x', 'y')).toBe(1);
  });
});

// ─── kw tests ───────────────────────────────────────────────────────────────

describe('kw', () => {
  test('creates keyword arguments', () => {
    const k = new kw({ a: 1, b: 'hello' });
    expect(k).toBeInstanceOf(kw);
    expect(k.hash).toEqual({ a: 1, b: 'hello' });
  });

  test('defaults to empty hash', () => {
    const k = new kw();
    expect(k.hash).toEqual({});
  });
});

// ─── SafeString tests ──────────────────────────────────────────────────────

describe('SafeString', () => {
  test('wraps HTML string', () => {
    const s = new SafeString('<b>bold</b>');
    expect(s).toBeInstanceOf(SafeString);
    expect(s.toString()).toBe('<b>bold</b>');
  });
});

// ─── mustache tests ─────────────────────────────────────────────────────────

describe('mustache', () => {
  test('stringifies simple values', () => {
    expect(mustache('hello')).toBe('hello');
    expect(mustache(42)).toBe('42');
    expect(mustache(0)).toBe('0');
    expect(mustache(true)).toBe('true');
  });

  test('maps nully values to null', () => {
    expect(mustache(null)).toBe(null);
    expect(mustache(undefined)).toBe(null);
    expect(mustache(false)).toBe(null);
  });

  test('SafeString becomes Raw', () => {
    const result = mustache(new SafeString('<b>bold</b>'));
    expect(result).toBeInstanceOf(Raw);
    expect((result as Raw).value).toBe('<b>bold</b>');
  });

  test('calls function and stringifies result', () => {
    expect(mustache(() => 42)).toBe('42');
    expect(mustache(() => null)).toBe(null);
  });

  test('with keyword args', () => {
    const helper = (_kw: kw) => `name=${_kw.hash.name}`;
    expect(mustache(helper, new kw({ name: 'world' }))).toBe('name=world');
  });

  test('evaluates keyword arg functions', () => {
    const helper = (_kw: kw) => `val=${_kw.hash.x}`;
    expect(mustache(helper, new kw({ x: () => 42 }))).toBe('val=42');
  });
});

// ─── attrMustache tests ─────────────────────────────────────────────────────

describe('attrMustache', () => {
  test('returns null for nully/empty', () => {
    expect(attrMustache(null)).toBe(null);
    expect(attrMustache(undefined)).toBe(null);
    expect(attrMustache('')).toBe(null);
  });

  test('passes through object', () => {
    const result = attrMustache({ class: 'foo' });
    expect(result).toEqual({ class: 'foo' });
  });

  test('converts valid attr name to object', () => {
    expect(attrMustache('disabled')).toEqual({ disabled: '' });
  });

  test('throws on invalid attr name', () => {
    expect(() => attrMustache('123invalid')).toThrow('Expected valid attribute name');
  });
});

// ─── makeRaw tests ──────────────────────────────────────────────────────────

describe('makeRaw', () => {
  test('null and undefined return null', () => {
    expect(makeRaw(null)).toBe(null);
    expect(makeRaw(undefined)).toBe(null);
  });

  test('wraps string in Raw', () => {
    const result = makeRaw('<b>hi</b>');
    expect(result).toBeInstanceOf(Raw);
    expect((result as Raw).value).toBe('<b>hi</b>');
  });

  test('idempotent on Raw', () => {
    const raw = new Raw('<b>hi</b>');
    expect(makeRaw(raw)).toBe(raw);
  });
});

// ─── Namespace export test ──────────────────────────────────────────────────

describe('Spacebars namespace', () => {
  test('exports all expected functions and classes', () => {
    expect(typeof Spacebars.include).toBe('function');
    expect(typeof Spacebars.mustache).toBe('function');
    expect(typeof Spacebars.attrMustache).toBe('function');
    expect(typeof Spacebars.dataMustache).toBe('function');
    expect(typeof Spacebars.makeRaw).toBe('function');
    expect(typeof Spacebars.call).toBe('function');
    expect(typeof Spacebars.dot).toBe('function');
    expect(typeof Spacebars.With).toBe('function');
    expect(Spacebars.kw).toBe(kw);
    expect(Spacebars.SafeString).toBe(SafeString);
  });
});
