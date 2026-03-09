# @blaze-ng/blaze-tools

Compile-time utilities for Blaze-NG. Converts HTMLJS ASTs to JavaScript source code for template compilation.

## Installation

```bash
npm install @blaze-ng/blaze-tools
```

## Usage

```ts
import { toJS, toJSLiteral, EmitCode, ToJSVisitor } from '@blaze-ng/blaze-tools';
import { HTML } from '@blaze-ng/htmljs';

// Convert HTMLJS AST to JavaScript source
const js = toJS(HTML.DIV({ class: 'x' }, 'hello'));

// Convert a literal value to its JS representation
toJSLiteral('hello'); // → "'hello'"
toJSLiteral(42); // → '42'
```

## Exports

| Export                        | Description                                      |
| ----------------------------- | ------------------------------------------------ |
| `toJS`                        | Convert an HTMLJS tree to JavaScript source code |
| `toJSLiteral`                 | Convert a JS value to its source representation  |
| `toObjectLiteralKey`          | Format a string as an object literal key         |
| `EmitCode`                    | Wrapper for raw code strings in JS output        |
| `ToJSVisitor`                 | HTMLJS visitor that produces JavaScript source   |
| `parseNumber`                 | Parse a numeric literal                          |
| `parseIdentifierName`         | Parse a JavaScript identifier                    |
| `parseExtendedIdentifierName` | Parse an extended identifier (with dots)         |
| `parseStringLiteral`          | Parse a string literal                           |
| `BlazeTools`                  | Namespace re-export of all utilities             |

## License

MIT
