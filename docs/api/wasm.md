# @blaze-ng/wasm

Optional WebAssembly accelerators for sequence diffing and HTML tokenization. Falls back to JavaScript implementations when WASM is not available.

## Installation

```bash
npm install @blaze-ng/wasm
```

## Overview

This package provides performance-critical operations with optional WASM acceleration:

- **`diff()`** — Compute minimal diff between two sequences
- **`tokenize()`** — Tokenize HTML strings

Both functions use JavaScript implementations by default and automatically switch to WASM when:

1. WASM has been loaded via `loadWasm()`
2. The input size exceeds the acceleration threshold

## API

### `loadWasm()`

Load the WASM module. Call once at application startup.

```ts
async function loadWasm(): Promise<boolean>;
```

Returns `true` if WASM loaded successfully, `false` otherwise.

```ts
import { loadWasm } from '@blaze-ng/wasm';

// Optional — will use JS fallbacks if not called
const wasmAvailable = await loadWasm();
console.log(`WASM: ${wasmAvailable ? 'enabled' : 'using JS fallback'}`);
```

### `isWasmAvailable()`

Check if WASM is loaded and ready.

```ts
function isWasmAvailable(): boolean;
```

### `diff()`

Compute the minimal diff between two sequences.

```ts
function diff<T>(oldArray: T[], newArray: T[], options?: DiffOptions<T>): DiffOp<T>[];
```

**Parameters:**

- `oldArray` — Original sequence
- `newArray` — Updated sequence
- `options.identity` — Function to extract identity key (default: item itself)
- `options.equals` — Custom equality function (default: `===`)

**Returns:** Array of diff operations

```ts
import { diff } from '@blaze-ng/wasm';

const ops = diff(['a', 'b', 'c'], ['a', 'c', 'd']);
// [
//   { type: 'remove', index: 1, item: 'b' },
//   { type: 'insert', index: 2, item: 'd' },
// ]
```

#### With Identity Function

```ts
const ops = diff(
  [
    { id: 1, name: 'Alice' },
    { id: 2, name: 'Bob' },
  ],
  [
    { id: 2, name: 'Robert' },
    { id: 1, name: 'Alice' },
  ],
  { identity: (item) => item.id },
);
// [
//   { type: 'move', from: 1, to: 0, item: { id: 2, name: 'Robert' } },
//   { type: 'change', index: 0, oldItem: { id: 2, name: 'Bob' }, item: { id: 2, name: 'Robert' } },
// ]
```

### `tokenize()`

Tokenize an HTML string into a sequence of tokens.

```ts
function tokenize(source: string): Token[];
```

```ts
import { tokenize } from '@blaze-ng/wasm';

const tokens = tokenize('<div class="hello">World</div>');
// [
//   { type: 'tag-open', name: 'div', attrs: { class: 'hello' }, selfClose: false },
//   { type: 'text', value: 'World' },
//   { type: 'tag-close', name: 'div' },
// ]
```

## Types

### `DiffOp<T>`

```ts
type DiffOp<T> =
  | { type: 'insert'; index: number; item: T }
  | { type: 'remove'; index: number; item: T }
  | { type: 'move'; from: number; to: number; item: T }
  | { type: 'change'; index: number; oldItem: T; item: T };
```

### `DiffOptions<T>`

```ts
interface DiffOptions<T> {
  /** Extract an identity key from an item */
  identity?: (item: T) => unknown;
  /** Custom equality comparison */
  equals?: (a: T, b: T) => boolean;
}
```

### `Token`

```ts
type Token =
  | { type: 'tag-open'; name: string; attrs: Record<string, string>; selfClose: boolean }
  | { type: 'tag-close'; name: string }
  | { type: 'text'; value: string }
  | { type: 'comment'; value: string }
  | { type: 'doctype'; value: string };
```

## Performance Thresholds

WASM acceleration kicks in automatically when:

| Operation    | Threshold              |
| ------------ | ---------------------- |
| `diff()`     | Arrays with >500 items |
| `tokenize()` | Strings >10 KB         |

Below these thresholds, the JavaScript implementations are fast enough and avoid WASM call overhead.

## JavaScript Fallbacks

Both functions work without WASM — the JS implementations are efficient:

- **diff**: O(n+m) Map-based algorithm
- **tokenize**: Regex-based state machine

The WASM versions provide ~2-3x speedup for large inputs.
