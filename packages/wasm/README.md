# @blaze-ng/wasm

Optional WebAssembly accelerators for Blaze-NG. Provides high-performance `diff` and `tokenize` operations with automatic fallback to JavaScript implementations.

## Installation

```bash
npm install @blaze-ng/wasm
```

## Usage

```ts
import { diff, tokenize, loadWasm, isWasmAvailable } from '@blaze-ng/wasm';

// Load WASM module (optional — JS fallback is always available)
await loadWasm();

// Check if WASM is loaded
console.log(isWasmAvailable()); // true if WASM loaded

// Diff two arrays — uses WASM for large arrays, JS for small
const ops = diff(oldArray, newArray);

// Tokenize a string — uses WASM for large strings, JS for small
const tokens = tokenize(htmlString);
```

## Exports

| Export            | Description                                        |
| ----------------- | -------------------------------------------------- |
| `loadWasm`        | Load the WASM module (async)                       |
| `isWasmAvailable` | Check whether WASM is loaded                       |
| `diff`            | Compute minimal diff operations between two arrays |
| `tokenize`        | Tokenize an HTML string                            |

### Automatic Thresholds

- **diff**: Uses WASM when array length > 500 items
- **tokenize**: Uses WASM when string length > 10KB

Below these thresholds, the JavaScript implementation is used (no overhead from WASM interop).

## License

MIT
