# @blaze-ng/spacebars-compiler

Compiles Spacebars template strings into JavaScript render functions.

## Installation

```bash
npm install @blaze-ng/spacebars-compiler
```

## Namespace

```ts
import { SpacebarsCompiler } from '@blaze-ng/spacebars-compiler';
```

## Functions

### `compile()` {#compile}

Compile a Spacebars template string into a JavaScript code string.

```ts
function compile(input: string, options?: CompileOptions): string;
```

**Parameters:**

- `input` — Spacebars template string
- `options.isTemplate` — Whether this is a `<template>` body (affects scope)
- `options.isBody` — Whether this is the `<body>` tag

**Returns:** JavaScript code string that, when evaluated, returns a render function.

```ts
const code = SpacebarsCompiler.compile('<h1>Hello, {{name}}!</h1>');
// Returns JS code string like:
// "function() { var view = this; return HTML.H1('Hello, ', ...) }"

// Evaluate the code to get a render function
const renderFn = new Function(`return ${code}`)();
```

### `parse()`

Parse a Spacebars template into an AST.

```ts
function parse(input: string): HTMLNode[];
```

```ts
const ast = SpacebarsCompiler.parse('<div>{{name}}</div>');
// Returns an HTMLJS tree with TemplateTag nodes
```

### `codeGen()`

Generate JavaScript code from a parsed AST.

```ts
function codeGen(ast: HTMLNode[], options?: CompileOptions): string;
```

### `optimize()`

Optimize a parsed AST (constant folding, whitespace removal).

```ts
function optimize(ast: HTMLNode[]): HTMLNode[];
```

### `removeWhitespace()`

Remove insignificant whitespace from the AST.

```ts
function removeWhitespace(ast: HTMLNode[]): HTMLNode[];
```

### `_beautify()`

Pretty-print generated JavaScript code.

```ts
function _beautify(code: string): string;
```

## Types

### `CompileOptions`

```ts
interface CompileOptions {
  isTemplate?: boolean;
  isBody?: boolean;
}
```

### `TemplateTagType`

```ts
type TemplateTagType =
  | 'DOUBLE' // {{expression}}
  | 'TRIPLE' // {{{expression}}}
  | 'EXPR' // (expression)
  | 'BLOCKOPEN' // {{#block}}
  | 'BLOCKCLOSE' // {{/block}}
  | 'ELSE' // {{else}}
  | 'COMMENT' // {{! comment}}
  | 'INCLUSION'; // {{> template}}
```

## Classes

### `TemplateTag`

Represents a Spacebars expression in the parsed AST.

```ts
class TemplateTag {
  type: TemplateTagType;
  path: string[];
  args: ArgSpec[];
  content?: HTMLNode;
  elseContent?: HTMLNode;
}
```

### `CodeGen`

Generates JavaScript code from HTMLJS + TemplateTag AST nodes.

```ts
class CodeGen {
  constructor(tree: HTMLNode, options?: CompileOptions);
  toJS(): string;
}
```

### `TreeTransformer`

Transform an HTMLJS tree, handling TemplateTag nodes:

```ts
class TreeTransformer {
  constructor(tree: HTMLNode);
  transform(): HTMLNode;
}
```

## Constants

### `builtInBlockHelpers`

```ts
const builtInBlockHelpers: Record<string, boolean>;
// { if: true, unless: true, with: true, each: true, let: true }
```

### `isReservedName()`

```ts
function isReservedName(name: string): boolean;
```

## Usage Examples

### Runtime Compilation

```ts
import { SpacebarsCompiler } from '@blaze-ng/spacebars-compiler';
import { Template } from '@blaze-ng/core';
import { HTML } from '@blaze-ng/htmljs';
import { Spacebars } from '@blaze-ng/spacebars';

// Compile template string
const code = SpacebarsCompiler.compile(`
  <div class="greeting">
    <h1>Hello, {{name}}!</h1>
    {{#if showDetails}}
      <p>Email: {{email}}</p>
    {{/if}}
  </div>
`);

// Create render function
const renderFn = new Function('HTML', 'Spacebars', 'Blaze', `return ${code}`)(
  HTML,
  Spacebars,
  Blaze,
);

// Create and use template
const tmpl = new Template('greeting', renderFn);
const html = Blaze.toHTMLWithData(tmpl, {
  name: 'Alice',
  showDetails: true,
  email: 'alice@example.com',
});
```

### Build-Time Compilation

```ts
import { SpacebarsCompiler } from '@blaze-ng/spacebars-compiler';
import { readFileSync, writeFileSync } from 'fs';

const templateSource = readFileSync('template.html', 'utf8');
const jsCode = SpacebarsCompiler.compile(templateSource, { isTemplate: true });

writeFileSync(
  'template.js',
  `
  import { HTML } from '@blaze-ng/htmljs';
  import { Spacebars } from '@blaze-ng/spacebars';
  import { Blaze, Template } from '@blaze-ng/core';
  
  export default new Template('myTemplate', ${jsCode});
`,
);
```

### AST Inspection

```ts
const ast = SpacebarsCompiler.parse('{{#each items}}<li>{{name}}</li>{{/each}}');
console.log(JSON.stringify(ast, null, 2));
// Useful for debugging template compilation
```
