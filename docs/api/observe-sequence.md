# @blaze-ng/observe-sequence

Efficient reactive list observation and diffing. Tracks changes to arrays and database cursors, emitting granular added/removed/moved/changed callbacks.

## Installation

```bash
npm install @blaze-ng/observe-sequence
```

## ObserveSequence

### `observe()`

Watch a reactive data source and receive granular change callbacks.

```ts
ObserveSequence.observe(
  sequenceFunc: () => unknown,
  callbacks: SequenceCallbacks
): ObserveHandle;
```

**Parameters:**
- `sequenceFunc` — Reactive function returning an array, cursor, or single value
- `callbacks` — Object with change notification handlers

**Returns:** Handle with a `stop()` method

```ts
import { ObserveSequence } from '@blaze-ng/observe-sequence';

const handle = ObserveSequence.observe(
  () => Items.find({}, { sort: { position: 1 } }),
  {
    addedAt(id, item, index, beforeId) {
      // Insert DOM node at index
    },
    removedAt(id, item, index) {
      // Remove DOM node at index
    },
    movedTo(id, item, fromIndex, toIndex, beforeId) {
      // Move DOM node
    },
    changedAt(id, newItem, oldItem, index) {
      // Update DOM node
    },
  }
);

// Stop observing
handle.stop();
```

### Callback Types

```ts
interface SequenceCallbacks {
  /** An item was added at the given index */
  addedAt(id: string, item: unknown, index: number, beforeId?: string): void;
  
  /** An item was removed from the given index */
  removedAt(id: string, item: unknown, index: number): void;
  
  /** An item was moved from one index to another */
  movedTo(id: string, item: unknown, fromIndex: number, toIndex: number, beforeId?: string): void;
  
  /** An item at the given index was changed */
  changedAt(id: string, newItem: unknown, oldItem: unknown, index: number): void;
}
```

## Diff Algorithm

### `diffQueryOrderedChanges()`

Compute the minimal set of operations to transform one ordered sequence into another.

```ts
function diffQueryOrderedChanges(
  oldResults: Map<string, unknown>,
  newResults: Map<string, unknown>,
  callbacks: DiffCallbacks
): void;
```

Uses an O(n+m) algorithm based on identity tracking:

1. Build a map of items by `_id`
2. Detect new items (insertions)
3. Detect removed items (deletions)
4. Detect position changes (moves)
5. Detect content changes

### DiffCallbacks

```ts
interface DiffCallbacks {
  addedBefore?(id: string, item: unknown, beforeId?: string): void;
  removed?(id: string, item: unknown): void;
  movedBefore?(id: string, beforeId?: string): void;
  changed?(id: string, newFields: object): void;
}
```

## ID Utilities

### `idStringify()`

Convert an ID value to a string for map keys.

```ts
function idStringify(id: unknown): string;
```

Handles strings, numbers, `ObjectID` instances, and `null`:

```ts
idStringify('abc')       // => '"abc"'
idStringify(123)         // => '123'
idStringify(null)        // => 'null'
```

### `idParse()`

Parse a stringified ID back to its original type.

```ts
function idParse(idString: string): unknown;
```

```ts
idParse('"abc"')  // => 'abc'
idParse('123')    // => 123
idParse('null')   // => null
```

## Supported Data Sources

`ObserveSequence` works with:

1. **Arrays** — plain JavaScript arrays with optional `_id` fields
2. **Cursors** — objects with `observe()` and `fetch()` methods (Mongo cursors)
3. **Single values** — wrapped as a single-element array
4. **Null/undefined** — treated as empty array

### Array Items

When observing arrays, items are tracked by `_id` if present, or by index:

```ts
// Tracked by _id (efficient)
const items = [
  { _id: '1', name: 'First' },
  { _id: '2', name: 'Second' },
];

// Tracked by index (less efficient for reordering)
const items = ['apple', 'banana', 'cherry'];
```

### Cursor Support

Objects that implement the cursor interface:

```ts
interface StoreCursor {
  observe(callbacks: CursorCallbacks): { stop(): void };
  fetch(): unknown[];
}
```

This is compatible with Meteor's `Mongo.Cursor`.

## How Blaze Uses ObserveSequence

The `{{#each}}` block helper uses `ObserveSequence` internally:

```
{{#each items}}
  <div>{{name}}</div>
{{/each}}

↓ Blaze internally calls:

ObserveSequence.observe(
  () => view.lookup('items'),  // reactive data source
  {
    addedAt(id, item, index) {
      // Create a new View for this item
      // Render it at the correct position
    },
    removedAt(id, item, index) {
      // Destroy the View for this item
      // Remove its DOM nodes
    },
    movedTo(id, item, fromIndex, toIndex) {
      // Move the View's DOM nodes
    },
    changedAt(id, newItem, oldItem, index) {
      // Update the View's data context
      // Reactive helpers re-run automatically
    },
  }
);
```

This is why Blaze can efficiently update lists of thousands of items.
