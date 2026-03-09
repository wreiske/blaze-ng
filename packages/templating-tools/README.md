# @blaze-ng/templating-tools

Template compilation utilities for Blaze-NG. Scans HTML for template tags and compiles them to JavaScript output.

## Installation

```bash
npm install @blaze-ng/templating-tools
```

## Usage

```ts
import {
  scanHtmlForTags,
  compileTagsWithSpacebars,
  generateTemplateJS,
  throwCompileError,
} from '@blaze-ng/templating-tools';

// Scan HTML for <template> and <body> tags
const tags = scanHtmlForTags({
  sourceName: 'myfile.html',
  contents: '<template name="hello"><p>Hi</p></template>',
});

// Compile scanned tags to JavaScript
const js = compileTagsWithSpacebars(tags);
```

## Exports

| Export                     | Description                                                 |
| -------------------------- | ----------------------------------------------------------- |
| `scanHtmlForTags`          | Parse HTML source to extract `<template>` and `<body>` tags |
| `compileTagsWithSpacebars` | Compile extracted tags using the Spacebars compiler         |
| `generateTemplateJS`       | Generate JS code for a single named template                |
| `generateBodyJS`           | Generate JS code for body content                           |
| `CompileError`             | Error class for template compilation failures               |
| `throwCompileError`        | Throw a formatted compilation error                         |
| `TemplatingTools`          | Namespace re-export of all utilities                        |

## License

MIT
