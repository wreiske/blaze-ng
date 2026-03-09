/**
 * Tests for @blaze-ng/wasm — JS fallback implementations.
 * WASM acceleration tests require a built WASM module.
 */
import { describe, test, expect } from 'vitest';
import { diff, tokenize, isWasmAvailable } from '../src/index';
import type { DiffOp, Token } from '../src/index';

describe('wasm - availability', () => {
  test('WASM is not available without loading', () => {
    expect(isWasmAvailable()).toBe(false);
  });
});

describe('wasm - JS diff fallback', () => {
  test('empty arrays produce no ops', () => {
    const ops = diff([], []);
    expect(ops).toEqual([]);
  });

  test('identical arrays produce no ops', () => {
    const ops = diff([1, 2, 3], [1, 2, 3]);
    expect(ops).toEqual([]);
  });

  test('detects insertions', () => {
    const ops = diff(
      [{ id: 1, name: 'a' }],
      [{ id: 1, name: 'a' }, { id: 2, name: 'b' }],
      { getId: (item) => String(item.id) },
    );
    expect(ops).toHaveLength(1);
    expect(ops[0]!.type).toBe('insert');
    expect(ops[0]!.item).toEqual({ id: 2, name: 'b' });
    expect(ops[0]!.newIndex).toBe(1);
  });

  test('detects removals', () => {
    const ops = diff(
      [{ id: 1, name: 'a' }, { id: 2, name: 'b' }],
      [{ id: 1, name: 'a' }],
      { getId: (item) => String(item.id) },
    );
    expect(ops).toHaveLength(1);
    expect(ops[0]!.type).toBe('remove');
    expect(ops[0]!.item).toEqual({ id: 2, name: 'b' });
    expect(ops[0]!.oldIndex).toBe(1);
  });

  test('detects changes', () => {
    const ops = diff(
      [{ id: 1, name: 'a' }],
      [{ id: 1, name: 'b' }],
      { getId: (item) => String(item.id) },
    );
    expect(ops).toHaveLength(1);
    expect(ops[0]!.type).toBe('change');
    expect(ops[0]!.item).toEqual({ id: 1, name: 'b' });
  });

  test('detects moves', () => {
    const ops = diff(
      [{ id: 1 }, { id: 2 }, { id: 3 }],
      [{ id: 3 }, { id: 1 }, { id: 2 }],
      { getId: (item) => String(item.id) },
    );
    // All items move
    const moves = ops.filter((op) => op.type === 'move');
    expect(moves.length).toBeGreaterThan(0);
  });

  test('complex diff scenario', () => {
    const old = [
      { id: 'a', v: 1 },
      { id: 'b', v: 2 },
      { id: 'c', v: 3 },
    ];
    const newArr = [
      { id: 'b', v: 2 },
      { id: 'd', v: 4 },
      { id: 'a', v: 10 },
    ];
    const ops = diff(old, newArr, { getId: (item) => item.id });

    const removes = ops.filter((op) => op.type === 'remove');
    const inserts = ops.filter((op) => op.type === 'insert');
    const changes = ops.filter((op) => op.type === 'change');

    expect(removes).toHaveLength(1); // c removed
    expect(removes[0]!.item.id).toBe('c');
    expect(inserts).toHaveLength(1); // d inserted
    expect(inserts[0]!.item.id).toBe('d');
    expect(changes).toHaveLength(1); // a changed (v: 1 → 10)
    expect(changes[0]!.item.id).toBe('a');
  });

  test('diff with string arrays uses default getId', () => {
    const ops = diff(['a', 'b', 'c'], ['b', 'c', 'd']);
    const removes = ops.filter((op) => op.type === 'remove');
    const inserts = ops.filter((op) => op.type === 'insert');
    expect(removes).toHaveLength(1);
    expect(removes[0]!.item).toBe('a');
    expect(inserts).toHaveLength(1);
    expect(inserts[0]!.item).toBe('d');
  });

  test('diff with custom getFields', () => {
    const ops = diff(
      [{ id: 1, name: 'a', extra: 'x' }],
      [{ id: 1, name: 'a', extra: 'y' }],
      {
        getId: (item) => String(item.id),
        getFields: (item) => item.name, // only compare name
      },
    );
    // name didn't change, so no change op (even though extra changed)
    expect(ops).toHaveLength(0);
  });
});

describe('wasm - JS tokenizer fallback', () => {
  test('tokenizes simple HTML', () => {
    const tokens = tokenize('<div>Hello</div>');
    expect(tokens).toHaveLength(3);
    expect(tokens[0]!.type).toBe('tag-open');
    expect(tokens[0]!.value).toBe('<div>');
    expect(tokens[1]!.type).toBe('text');
    expect(tokens[1]!.value).toBe('Hello');
    expect(tokens[2]!.type).toBe('tag-close');
    expect(tokens[2]!.value).toBe('</div>');
  });

  test('tokenizes self-closing tags', () => {
    const tokens = tokenize('<br/><hr/>');
    expect(tokens).toHaveLength(2);
    expect(tokens[0]!.type).toBe('tag-self-close');
    expect(tokens[1]!.type).toBe('tag-self-close');
  });

  test('tokenizes comments', () => {
    const tokens = tokenize('<!-- comment -->');
    expect(tokens).toHaveLength(1);
    expect(tokens[0]!.type).toBe('comment');
    expect(tokens[0]!.value).toBe('<!-- comment -->');
  });

  test('tokenizes doctype', () => {
    const tokens = tokenize('<!DOCTYPE html><html></html>');
    expect(tokens).toHaveLength(3);
    expect(tokens[0]!.type).toBe('doctype');
  });

  test('tokenizes attributes', () => {
    const tokens = tokenize('<div class="foo" id="bar">text</div>');
    expect(tokens).toHaveLength(3);
    expect(tokens[0]!.value).toBe('<div class="foo" id="bar">');
  });

  test('tokenizes nested HTML', () => {
    const tokens = tokenize('<ul><li>one</li><li>two</li></ul>');
    // <ul>, <li>, one, </li>, <li>, two, </li>, </ul> = 8
    expect(tokens).toHaveLength(8);
  });

  test('tokenizes empty string', () => {
    const tokens = tokenize('');
    expect(tokens).toHaveLength(0);
  });

  test('tokenizes text only', () => {
    const tokens = tokenize('Hello world');
    expect(tokens).toHaveLength(1);
    expect(tokens[0]!.type).toBe('text');
    expect(tokens[0]!.value).toBe('Hello world');
  });

  test('tracks positions correctly', () => {
    const tokens = tokenize('<p>Hi</p>');
    expect(tokens[0]!.start).toBe(0);
    expect(tokens[0]!.end).toBe(3); // <p>
    expect(tokens[1]!.start).toBe(3);
    expect(tokens[1]!.end).toBe(5); // Hi
    expect(tokens[2]!.start).toBe(5);
    expect(tokens[2]!.end).toBe(9); // </p>
  });

  test('handles complex real-world HTML', () => {
    const html = `<!DOCTYPE html>
<html lang="en">
<head><title>Test</title></head>
<body>
  <div class="container">
    <h1>Hello</h1>
    <!-- nav -->
    <p>World</p>
  </div>
</body>
</html>`;
    const tokens = tokenize(html);
    expect(tokens.length).toBeGreaterThan(10);

    const doctypes = tokens.filter((t) => t.type === 'doctype');
    expect(doctypes).toHaveLength(1);

    const comments = tokens.filter((t) => t.type === 'comment');
    expect(comments).toHaveLength(1);
    expect(comments[0]!.value).toBe('<!-- nav -->');
  });
});
