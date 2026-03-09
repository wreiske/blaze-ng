/**
 * @blaze-ng/wasm — Optional WASM accelerators for Blaze-NG.
 *
 * Provides high-performance WASM implementations for:
 * - Sequence diffing (used by `{{#each}}` for large lists)
 * - HTML tokenization (used by the compiler)
 *
 * Both have pure JS fallbacks that are used when WASM is unavailable
 * or when the overhead isn't worth it (small inputs).
 *
 * @example
 * ```ts
 * import { diff, isWasmAvailable, loadWasm } from '@blaze-ng/wasm';
 *
 * // Optionally pre-load WASM module
 * await loadWasm();
 *
 * // diff() automatically uses WASM when available and beneficial
 * const changes = diff(oldArray, newArray, getId);
 * ```
 *
 * @packageDocumentation
 */

// ─── Types ───────────────────────────────────────────────────────────────────

/** A single diff operation describing how a sequence changed. */
export interface DiffOp<T> {
  type: 'insert' | 'remove' | 'move' | 'change';
  /** The item affected. */
  item: T;
  /** Index in the old array (for remove/move/change). */
  oldIndex?: number;
  /** Index in the new array (for insert/move/change). */
  newIndex?: number;
}

/** Options for the diff algorithm. */
export interface DiffOptions<T> {
  /** Extract a unique string key from an item. Defaults to String(item). */
  getId?: (item: T) => string;
  /** Extract fields to compare for changes. Defaults to JSON.stringify. */
  getFields?: (item: T) => string;
}

/** Result of a tokenization pass. */
export interface Token {
  type: 'tag-open' | 'tag-close' | 'tag-self-close' | 'text' | 'comment' | 'doctype';
  value: string;
  /** Byte offset in source. */
  start: number;
  /** Byte offset of end in source. */
  end: number;
}

// ─── WASM State ──────────────────────────────────────────────────────────────

let _wasmModule: WasmExports | null = null;
let _wasmLoadAttempted = false;

interface WasmExports {
  diff_sequences(oldJson: string, newJson: string): string;
  tokenize_html(source: string): string;
}

/**
 * Check if WASM acceleration is available and loaded.
 * @returns True if the WASM module has been successfully loaded.
 */
export function isWasmAvailable(): boolean {
  return _wasmModule !== null;
}

/**
 * Attempt to load the WASM module. Safe to call multiple times.
 * Returns true if WASM is now available.
 *
 * @returns Whether the WASM module was successfully loaded.
 */
export async function loadWasm(): Promise<boolean> {
  if (_wasmModule) return true;
  if (_wasmLoadAttempted) return false;

  _wasmLoadAttempted = true;

  try {
    // In production, this would load the actual .wasm file
    // For now, this is a placeholder for the Rust-compiled module
    // The WASM file would be at: ./wasm/blaze_ng_wasm_bg.wasm
    const wasmUrl = new URL('./wasm/blaze_ng_wasm_bg.wasm', import.meta.url);
    const response = await fetch(wasmUrl);
    if (!response.ok) return false;

    const bytes = await response.arrayBuffer();
    const module = await WebAssembly.instantiate(bytes);
    _wasmModule = module.instance.exports as unknown as WasmExports;
    return true;
  } catch {
    // WASM not available — fall back to JS implementations
    return false;
  }
}

// ─── Sequence Diff ───────────────────────────────────────────────────────────

/** Threshold: only use WASM for arrays larger than this. */
const WASM_DIFF_THRESHOLD = 500;

/**
 * Compute the diff between two arrays, producing a minimal set of operations
 * to transform `oldArray` into `newArray`.
 *
 * Automatically uses WASM acceleration for large arrays (>500 items)
 * when available, falling back to the JS implementation otherwise.
 *
 * @param oldArray - The original array.
 * @param newArray - The target array.
 * @param options - Diff configuration.
 * @returns Array of diff operations.
 *
 * @example
 * ```ts
 * const ops = diff(
 *   [{ id: 1, name: 'a' }, { id: 2, name: 'b' }],
 *   [{ id: 2, name: 'b' }, { id: 3, name: 'c' }],
 *   { getId: item => String(item.id) }
 * );
 * // ops = [
 * //   { type: 'remove', item: { id: 1, name: 'a' }, oldIndex: 0 },
 * //   { type: 'insert', item: { id: 3, name: 'c' }, newIndex: 1 },
 * // ]
 * ```
 */
export function diff<T>(
  oldArray: readonly T[],
  newArray: readonly T[],
  options: DiffOptions<T> = {},
): DiffOp<T>[] {
  const useWasm =
    _wasmModule &&
    oldArray.length + newArray.length > WASM_DIFF_THRESHOLD;

  if (useWasm) {
    return _wasmDiff(oldArray, newArray, options);
  }

  return _jsDiff(oldArray, newArray, options);
}

/**
 * JS fallback implementation of sequence diff.
 * Uses a simple O(n+m) algorithm with Map-based lookups.
 */
function _jsDiff<T>(
  oldArray: readonly T[],
  newArray: readonly T[],
  options: DiffOptions<T>,
): DiffOp<T>[] {
  const getId = options.getId ?? ((item: T) => String(item));
  const getFields = options.getFields ?? ((item: T) => JSON.stringify(item));
  const ops: DiffOp<T>[] = [];

  // Build maps
  const oldMap = new Map<string, { item: T; index: number }>();
  const newMap = new Map<string, { item: T; index: number }>();

  for (let i = 0; i < oldArray.length; i++) {
    oldMap.set(getId(oldArray[i]!), { item: oldArray[i]!, index: i });
  }

  for (let i = 0; i < newArray.length; i++) {
    newMap.set(getId(newArray[i]!), { item: newArray[i]!, index: i });
  }

  // Find removals
  for (const [id, { item, index }] of oldMap) {
    if (!newMap.has(id)) {
      ops.push({ type: 'remove', item, oldIndex: index });
    }
  }

  // Find insertions and changes
  for (const [id, { item, index }] of newMap) {
    const old = oldMap.get(id);
    if (!old) {
      ops.push({ type: 'insert', item, newIndex: index });
    } else if (getFields(old.item) !== getFields(item)) {
      ops.push({ type: 'change', item, oldIndex: old.index, newIndex: index });
    } else if (old.index !== index) {
      ops.push({ type: 'move', item, oldIndex: old.index, newIndex: index });
    }
  }

  return ops;
}

/**
 * WASM-accelerated diff. Serializes to JSON, calls WASM, deserializes result.
 */
function _wasmDiff<T>(
  oldArray: readonly T[],
  newArray: readonly T[],
  options: DiffOptions<T>,
): DiffOp<T>[] {
  const getId = options.getId ?? ((item: T) => String(item));

  // Serialize arrays as [id, fields] pairs for WASM
  const getFields = options.getFields ?? ((item: T) => JSON.stringify(item));
  const oldSerialized = oldArray.map((item) => [getId(item), getFields(item)]);
  const newSerialized = newArray.map((item) => [getId(item), getFields(item)]);

  try {
    const resultJson = _wasmModule!.diff_sequences(
      JSON.stringify(oldSerialized),
      JSON.stringify(newSerialized),
    );

    const rawOps = JSON.parse(resultJson) as Array<{
      type: string;
      index: number;
      oldIndex?: number;
      newIndex?: number;
    }>;

    return rawOps.map((op) => {
      const arr = op.type === 'remove' ? oldArray : newArray;
      const idx = op.type === 'remove' ? (op.oldIndex ?? op.index) : (op.newIndex ?? op.index);
      return {
        type: op.type as DiffOp<T>['type'],
        item: arr[idx]!,
        oldIndex: op.oldIndex,
        newIndex: op.newIndex,
      };
    });
  } catch {
    // If WASM fails, fall back to JS
    return _jsDiff(oldArray, newArray, options);
  }
}

// ─── HTML Tokenizer ──────────────────────────────────────────────────────────

/** Threshold: only use WASM for HTML strings larger than this. */
const WASM_TOKENIZE_THRESHOLD = 10_000;

/**
 * Tokenize an HTML string into a flat list of tokens.
 *
 * Uses WASM acceleration for large inputs (>10KB) when available,
 * falling back to the JS implementation otherwise.
 *
 * @param source - HTML source string.
 * @returns Array of tokens.
 *
 * @example
 * ```ts
 * const tokens = tokenize('<div class="foo">Hello</div>');
 * // tokens = [
 * //   { type: 'tag-open', value: '<div class="foo">', start: 0, end: 17 },
 * //   { type: 'text', value: 'Hello', start: 17, end: 22 },
 * //   { type: 'tag-close', value: '</div>', start: 22, end: 28 },
 * // ]
 * ```
 */
export function tokenize(source: string): Token[] {
  const useWasm =
    _wasmModule &&
    source.length > WASM_TOKENIZE_THRESHOLD;

  if (useWasm) {
    return _wasmTokenize(source);
  }

  return _jsTokenize(source);
}

/**
 * JS fallback implementation of HTML tokenizer.
 * Simple regex-based tokenizer for basic HTML.
 */
function _jsTokenize(source: string): Token[] {
  const tokens: Token[] = [];
  let pos = 0;

  while (pos < source.length) {
    // Comment
    if (source.startsWith('<!--', pos)) {
      const end = source.indexOf('-->', pos + 4);
      const endPos = end === -1 ? source.length : end + 3;
      tokens.push({ type: 'comment', value: source.slice(pos, endPos), start: pos, end: endPos });
      pos = endPos;
      continue;
    }

    // Doctype
    if (source.startsWith('<!DOCTYPE', pos) || source.startsWith('<!doctype', pos)) {
      const end = source.indexOf('>', pos);
      const endPos = end === -1 ? source.length : end + 1;
      tokens.push({ type: 'doctype', value: source.slice(pos, endPos), start: pos, end: endPos });
      pos = endPos;
      continue;
    }

    // Closing tag
    if (source.startsWith('</', pos)) {
      const end = source.indexOf('>', pos);
      const endPos = end === -1 ? source.length : end + 1;
      tokens.push({ type: 'tag-close', value: source.slice(pos, endPos), start: pos, end: endPos });
      pos = endPos;
      continue;
    }

    // Opening tag or self-closing tag
    if (source[pos] === '<' && pos + 1 < source.length && /[a-zA-Z]/.test(source[pos + 1]!)) {
      const end = source.indexOf('>', pos);
      const endPos = end === -1 ? source.length : end + 1;
      const tagStr = source.slice(pos, endPos);
      const type = tagStr.endsWith('/>') ? 'tag-self-close' : 'tag-open';
      tokens.push({ type, value: tagStr, start: pos, end: endPos });
      pos = endPos;
      continue;
    }

    // Text node — consume until next '<'
    const nextTag = source.indexOf('<', pos + 1);
    const endPos = nextTag === -1 ? source.length : nextTag;
    tokens.push({ type: 'text', value: source.slice(pos, endPos), start: pos, end: endPos });
    pos = endPos;
  }

  return tokens;
}

/**
 * WASM-accelerated HTML tokenizer.
 */
function _wasmTokenize(source: string): Token[] {
  try {
    const resultJson = _wasmModule!.tokenize_html(source);
    return JSON.parse(resultJson) as Token[];
  } catch {
    return _jsTokenize(source);
  }
}
