# @blaze-ng/spacebars-compiler

Spacebars template compiler for Blaze-NG. Parses Spacebars syntax and compiles it to JavaScript render functions.

## Installation

```bash
npm install @blaze-ng/spacebars-compiler
```

## Usage

```ts
import { compile, parse, codeGen } from '@blaze-ng/spacebars-compiler';

// Compile template string to JavaScript code
const js = compile('<div>{{name}}</div>');

// Two-step: parse to AST, then generate code
const ast = parse('<div>{{#if active}}Yes{{/if}}</div>');
const code = codeGen(ast);
```

## Exports

| Export | Description |
|--------|-------------|
| `compile` | Compile a Spacebars template to JavaScript source |
| `parse` | Parse template to an AST |
| `codeGen` | Generate JavaScript from a parsed AST |
| `optimize` | Optimize an AST before code generation |
| `removeWhitespace` | Strip insignificant whitespace from AST |
| `_beautify` | Format generated code for readability |
| `TemplateTag` | AST node for template tags (`{{...}}`) |
| `CodeGen` | Code generation visitor class |
| `TreeTransformer` | AST transformation utility |
| `SpacebarsCompiler` | Namespace re-export of all compiler functions |

## License

MIT
