# @blaze-ng/htmljs

HTML abstract syntax tree representation for Blaze-NG. Provides constructors for HTML elements, special nodes, and visitor-based traversal.

## Installation

```bash
npm install @blaze-ng/htmljs
```

## Usage

```ts
import { HTML, Tag, Raw, Comment, CharRef, Visitor, toHTML, toText } from '@blaze-ng/htmljs';

// Create HTML elements
const div = HTML.DIV({ class: 'container' }, HTML.P('Hello world'));

// Render to HTML string
const html = toHTML(div);
// → '<div class="container"><p>Hello world</p></div>'

// Special nodes
const raw = new Raw('<strong>bold</strong>');
const comment = new Comment('TODO: fix this');
const charRef = new CharRef({ html: '&amp;', str: '&' });
```

## Exports

| Export | Description |
|--------|-------------|
| `HTML` | Namespace with all tag constructors (`HTML.DIV`, `HTML.SPAN`, `HTML.A`, etc.) |
| `Tag` | Base class for all HTML tags |
| `Raw` | Raw HTML content (not escaped) |
| `Comment` | HTML comment node |
| `CharRef` | Character reference node |
| `Visitor` | Base visitor class for AST traversal |
| `ToHTMLVisitor` | Visitor that converts AST to HTML strings |
| `ToTextVisitor` | Visitor that converts AST to plain text |
| `toHTML` | Shorthand to render AST to HTML |
| `toText` | Shorthand to render AST to text |
| `TEXTMODE` | Text mode constants for parser context |

## License

MIT
