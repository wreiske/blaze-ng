# @blaze-ng/compat

Backward compatibility aliases for Blaze-NG. Provides `UI` and `Handlebars` namespaces that map to modern Blaze-NG APIs for migrating existing code.

## Installation

```bash
npm install @blaze-ng/compat
```

## Usage

```ts
import { UI, Handlebars } from '@blaze-ng/compat';

// These are aliases for the modern API:
// UI.render → Blaze.render
// UI.insert → Blaze.render
// Handlebars.registerHelper → Template.registerHelper
```

## Exports

| Export       | Description                                                                      |
| ------------ | -------------------------------------------------------------------------------- |
| `UI`         | Deprecated namespace — aliases for `Blaze.render`, `Blaze.renderWithData`, etc.  |
| `Handlebars` | Deprecated namespace — aliases for `Template.registerHelper`, `SafeString`, etc. |

> **Note:** These aliases exist only for migration convenience. New code should use `Blaze` and `Template` directly from `@blaze-ng/core`.

## License

MIT
