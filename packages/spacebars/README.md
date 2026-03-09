# @blaze-ng/spacebars

Spacebars template runtime for Blaze-NG. Provides the runtime functions that compiled templates call to render mustache expressions, inclusions, and block helpers.

## Installation

```bash
npm install @blaze-ng/spacebars
```

## Usage

```ts
import { mustache, include, With, kw, SafeString } from '@blaze-ng/spacebars';

// Runtime mustache evaluation
const result = mustache(() => someValue);

// Include another template with data
const view = include(Template.myTemplate, () => data);

// Mark HTML as safe (won't be escaped)
const raw = new SafeString('<strong>bold</strong>');
```

## Exports

| Export         | Description                                                |
| -------------- | ---------------------------------------------------------- |
| `mustache`     | Evaluate a mustache expression in the current data context |
| `attrMustache` | Evaluate a mustache expression for HTML attributes         |
| `dataMustache` | Evaluate a mustache with an explicit data context          |
| `include`      | Include a template as a sub-view                           |
| `makeRaw`      | Convert a value to raw (unescaped) HTML                    |
| `call`         | Call a function in template context                        |
| `dot`          | Property access chain (`a.b.c`)                            |
| `With`         | `{{#with}}` block helper implementation                    |
| `kw`           | Keyword arguments wrapper for hash parameters              |
| `SafeString`   | Wraps a string to prevent HTML escaping                    |

## License

MIT
