# @blaze-ng/observe-sequence

Reactive array and cursor observation for Blaze-NG. Efficiently tracks changes to arrays, cursors, and other sequences for minimal DOM updates.

## Installation

```bash
npm install @blaze-ng/observe-sequence
```

## Usage

```ts
import { ObserveSequence, diffQueryOrderedChanges, idStringify, idParse } from '@blaze-ng/observe-sequence';

// Observe changes to a reactive sequence
const handle = ObserveSequence.observe(
  () => myReactiveArray.get(),
  {
    addedAt(id, item, index) { /* item added at index */ },
    changedAt(id, newItem, oldItem, index) { /* item changed */ },
    removedAt(id, item, index) { /* item removed */ },
    movedTo(id, item, fromIndex, toIndex) { /* item moved */ },
  }
);

// Stop observing
handle.stop();
```

## Exports

| Export | Description |
|--------|-------------|
| `ObserveSequence` | Main namespace with `observe` for sequence tracking |
| `diffQueryOrderedChanges` | Compute minimal diff between two ordered query results |
| `idStringify` | Convert an ID value to a string key |
| `idParse` | Parse a string key back to an ID value |

### Supported Data Sources

- Plain arrays
- Reactive arrays (via `ReactiveVar` or signals)
- Cursor-like objects (with `observe` or `observeChanges` methods)
- Single reactive values (treated as one-element sequences)

## License

MIT
