# @blaze-ng/templating-compiler

High-level API for compiling HTML template files to JavaScript. Combines scanning and Spacebars compilation in one step.

## Installation

```bash
npm install @blaze-ng/templating-compiler
```

## API

### `compileTemplates()`

Compile an HTML source string containing templates into JavaScript.

```ts
function compileTemplates(source: string, sourceName: string, options?: ScanOptions): CompileResult;
```

**Parameters:**

- `source` — HTML string containing `<template>` and/or `<body>` tags
- `sourceName` — Filename for error messages
- `options` — Scan options

**Returns:** Compiled JavaScript code

```ts
import { compileTemplates } from '@blaze-ng/templating-compiler';

const result = compileTemplates(
  `
  <template name="hello">
    <h1>Hello, {{name}}!</h1>
  </template>
`,
  'hello.html',
);

console.log(result.js);
// JavaScript code that registers the template
```

### Re-exports

This package also re-exports from `@blaze-ng/templating-tools`:

- `scanHtmlForTags()`
- `compileTagsWithSpacebars()`
- `ScanOptions`, `ScannedTag`, `CompileResult` types

## Usage

### Simple Compilation

```ts
import { compileTemplates } from '@blaze-ng/templating-compiler';

const source = `
<template name="userCard">
  <div class="card">
    <h3>{{name}}</h3>
    <p>{{email}}</p>
  </div>
</template>

<template name="userList">
  <ul>
    {{#each users}}
      <li>{{> userCard}}</li>
    {{/each}}
  </ul>
</template>
`;

const { js } = compileTemplates(source, 'users.html');
// js contains code to register both templates
```

### Build Tool Integration

```ts
// Webpack/Rspack loader
export default function blazeLoader(source) {
  const { js } = compileTemplates(source, this.resourcePath);
  return js;
}
```

```ts
// Vite plugin
export function blazePlugin() {
  return {
    name: 'blaze',
    transform(code, id) {
      if (!id.endsWith('.html')) return;
      const { js } = compileTemplates(code, id);
      return { code: js };
    },
  };
}
```
