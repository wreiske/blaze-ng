# @blaze-ng/html-tools

HTML tokenizer and parser for Blaze-NG. Provides a scanner-based parser for HTML fragments with support for template tags.

## Installation

```bash
npm install @blaze-ng/html-tools
```

## Usage

```ts
import { parseFragment, Scanner, getHTMLToken } from '@blaze-ng/html-tools';

// Parse an HTML fragment to an AST
const ast = parseFragment('<div class="x">Hello</div>');

// Low-level scanning
const scanner = new Scanner('<p>text</p>');
const token = getHTMLToken(scanner);
```

## Exports

| Export                  | Description                                          |
| ----------------------- | ---------------------------------------------------- |
| `parseFragment`         | Parse an HTML fragment into an HTMLJS AST            |
| `Scanner`               | Character-level scanner for tokenization             |
| `getHTMLToken`          | Read the next HTML token from a scanner              |
| `getTagToken`           | Read an HTML tag token                               |
| `getComment`            | Read an HTML comment                                 |
| `getDoctype`            | Read a DOCTYPE declaration                           |
| `getCharacterReference` | Parse a character reference (`&amp;`, `&#60;`, etc.) |
| `codePointToString`     | Convert a Unicode code point to a character          |
| `HTMLTools`             | Namespace re-export of all parser utilities          |

## License

MIT
