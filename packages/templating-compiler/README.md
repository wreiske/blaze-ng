# @blaze-ng/templating-compiler

HTML template build plugin for Blaze-NG. Compiles `.html` template files into JavaScript modules during the build step.

## Installation

```bash
npm install @blaze-ng/templating-compiler
```

## Usage

```ts
import { compileTemplates } from '@blaze-ng/templating-compiler';

// Compile .html template files to JS
const result = compileTemplates(htmlSource, { isBody: false });
```

## Exports

| Export                     | Description                                        |
| -------------------------- | -------------------------------------------------- |
| `compileTemplates`         | Compile HTML source to JavaScript template modules |
| `scanHtmlForTags`          | Re-exported from `@blaze-ng/templating-tools`      |
| `compileTagsWithSpacebars` | Re-exported from `@blaze-ng/templating-tools`      |

## License

MIT
