# @blaze-ng/templating-tools

HTML scanning and template compilation utilities. Scans `.html` files for `<template>` and `<body>` tags and compiles them to JavaScript.

## Installation

```bash
npm install @blaze-ng/templating-tools
```

## Namespace

```ts
import { TemplatingTools } from '@blaze-ng/templating-tools';
```

## Functions

### `scanHtmlForTags()`

Scan an HTML source string for `<template>`, `<head>`, and `<body>` tags.

```ts
function scanHtmlForTags(source: string, sourceName?: string, options?: ScanOptions): ScannedTag[];
```

```ts
const tags = TemplatingTools.scanHtmlForTags(
  `
  <template name="myComponent">
    <h1>{{title}}</h1>
  </template>
  <body>
    {{> myComponent}}
  </body>
`,
  'myfile.html',
);

// [
//   { tagName: 'template', attribs: { name: 'myComponent' }, contents: '<h1>{{title}}</h1>', ... },
//   { tagName: 'body', attribs: {}, contents: '{{> myComponent}}', ... },
// ]
```

### `compileTagsWithSpacebars()`

Compile scanned tags into JavaScript code.

```ts
function compileTagsWithSpacebars(tags: ScannedTag[]): CompileResult;
```

```ts
const tags = TemplatingTools.scanHtmlForTags(source, 'app.html');
const result = TemplatingTools.compileTagsWithSpacebars(tags);

console.log(result.js); // JavaScript code string
console.log(result.body); // Body content code (if any)
console.log(result.head); // Head content (if any)
```

### `generateTemplateJS()`

Generate JavaScript for a single template.

```ts
function generateTemplateJS(name: string, renderFuncCode: string): string;
```

```ts
const js = TemplatingTools.generateTemplateJS(
  'myComponent',
  'function() { return HTML.H1("Hello"); }',
);
// Generates: Template.__checkName("myComponent"); Template["myComponent"] = ...
```

### `generateBodyJS()`

Generate JavaScript for body content.

```ts
function generateBodyJS(renderFuncCode: string): string;
```

### `throwCompileError()`

Throw a compilation error with source location.

```ts
function throwCompileError(message: string, tag?: ScannedTag, sourceName?: string): never;
```

## Types

### `ScannedTag`

```ts
interface ScannedTag {
  tagName: string;
  attribs: Record<string, string>;
  contents: string;
  contentsStartIndex: number;
  tagStartIndex: number;
  fileContents: string;
  sourceName?: string;
}
```

### `CompileResult`

```ts
interface CompileResult {
  js: string;
  body?: string;
  head?: string;
}
```

### `ScanOptions`

```ts
interface ScanOptions {
  // Currently no options, reserved for future use
}
```

### `CompileError`

```ts
class CompileError extends Error {
  file?: string;
  line?: number;
  column?: number;
}
```

## Build Pipeline Example

```ts
import { TemplatingTools } from '@blaze-ng/templating-tools';
import { readFileSync, writeFileSync } from 'fs';
import { glob } from 'glob';

// Find all template files
const files = glob.sync('imports/**/*.html');

for (const file of files) {
  const source = readFileSync(file, 'utf8');

  // Scan for template tags
  const tags = TemplatingTools.scanHtmlForTags(source, file);

  // Compile to JavaScript
  const result = TemplatingTools.compileTagsWithSpacebars(tags);

  // Write output
  writeFileSync(file.replace('.html', '.generated.js'), result.js);
}
```
