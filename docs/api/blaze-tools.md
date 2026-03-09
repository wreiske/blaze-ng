# @blaze-ng/blaze-tools

Scanner and code generation utilities for Blaze template compilation.

## Installation

```bash
npm install @blaze-ng/blaze-tools
```

## Namespace

```ts
import { BlazeTools } from '@blaze-ng/blaze-tools';
```

## Code Generation

### `toJS()`

Convert an HTMLJS tree to JavaScript source code.

```ts
function toJS(node: HTMLNode): string;
```

```ts
import { HTML } from '@blaze-ng/htmljs';
import { BlazeTools } from '@blaze-ng/blaze-tools';

const node = HTML.DIV({ class: 'card' }, HTML.P('Hello'));
const js = BlazeTools.toJS(node);
// => 'HTML.DIV({"class": "card"}, HTML.P("Hello"))'
```

### `toJSLiteral()`

Convert a JavaScript value to a source code literal.

```ts
function toJSLiteral(value: unknown): string;
```

```ts
toJSLiteral('hello'); // => '"hello"'
toJSLiteral(42); // => '42'
toJSLiteral(true); // => 'true'
toJSLiteral(null); // => 'null'
toJSLiteral(undefined); // => 'undefined'
```

### `toObjectLiteralKey()`

Convert a string to a valid JavaScript object key.

```ts
function toObjectLiteralKey(key: string): string;
```

```ts
toObjectLiteralKey('class'); // => '"class"'
toObjectLiteralKey('validName'); // => 'validName'
toObjectLiteralKey('data-id'); // => '"data-id"'
```

## Classes

### `EmitCode`

Helper for building JavaScript code strings:

```ts
class EmitCode {
  value: string;
  constructor(value: string);
}
```

### `ToJSVisitor`

HTMLJS visitor that generates JavaScript code:

```ts
class ToJSVisitor extends Visitor {
  visitTag(tag: Tag): EmitCode;
  visitString(str: string): EmitCode;
  visitArray(arr: unknown[]): EmitCode;
  // ...
}
```

## Parsing Utilities

### `parseNumber()`

Parse a number token from a string.

```ts
function parseNumber(scanner: Scanner): NumberToken | null;
```

### `parseIdentifierName()`

Parse a JavaScript identifier.

```ts
function parseIdentifierName(scanner: Scanner): string | null;
```

### `parseExtendedIdentifierName()`

Parse an extended identifier (includes `.` and `/`).

```ts
function parseExtendedIdentifierName(scanner: Scanner): string | null;
```

### `parseStringLiteral()`

Parse a string literal (single or double quoted).

```ts
function parseStringLiteral(scanner: Scanner): StringToken | null;
```

## Types

```ts
interface Scanner {
  pos: number;
  input: string;
  peek(): string;
  rest(): string;
  isEOF(): boolean;
}

interface NumberToken {
  type: 'number';
  value: number;
  raw: string;
}

interface StringToken {
  type: 'string';
  value: string;
  raw: string;
}
```
