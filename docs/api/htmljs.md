# @blaze-ng/htmljs

Structured HTML representation. Instead of string concatenation, Blaze uses an object model to represent HTML, enabling type-safe manipulation and efficient rendering.

## Installation

```bash
npm install @blaze-ng/htmljs
```

## The HTML Namespace

Import the `HTML` namespace which contains constructors for all standard HTML and SVG elements:

```ts
import { HTML } from '@blaze-ng/htmljs';
```

## Tag Functions {#tag-functions}

Every HTML element has a corresponding function:

```ts
HTML.DIV({ class: 'card' }, HTML.H2('Title'), HTML.P('Content'));
// Renders: <div class="card"><h2>Title</h2><p>Content</p></div>
```

### Signature

```ts
function TAG(attributes?: Attrs, ...children: HTMLNode[]): Tag;
function TAG(...children: HTMLNode[]): Tag;
```

Attributes are optional. Children can be strings, numbers, other tags, arrays, or special nodes.

### Common Tags

```ts
// Block elements
HTML.DIV()      HTML.SECTION()   HTML.ARTICLE()
HTML.HEADER()   HTML.FOOTER()    HTML.NAV()
HTML.MAIN()     HTML.ASIDE()

// Text elements
HTML.H1()  HTML.H2()  HTML.H3()  HTML.H4()  HTML.H5()  HTML.H6()
HTML.P()   HTML.SPAN() HTML.A()  HTML.STRONG() HTML.EM()

// Lists
HTML.UL()  HTML.OL()  HTML.LI()

// Tables
HTML.TABLE()  HTML.THEAD()  HTML.TBODY()  HTML.TR()  HTML.TH()  HTML.TD()

// Forms
HTML.FORM()   HTML.INPUT()  HTML.BUTTON()  HTML.SELECT()
HTML.OPTION() HTML.TEXTAREA() HTML.LABEL()

// Media
HTML.IMG()  HTML.VIDEO()  HTML.AUDIO()  HTML.SOURCE()

// SVG
HTML.SVG()  HTML.CIRCLE()  HTML.RECT()  HTML.PATH()  HTML.G()
```

### Examples

```ts
// Simple paragraph
HTML.P('Hello, world!');

// Link with attributes
HTML.A({ href: '/about', class: 'nav-link' }, 'About');

// Nested structure
HTML.UL(HTML.LI('First'), HTML.LI('Second'), HTML.LI('Third'));

// Form
HTML.FORM(
  { action: '/login', method: 'post' },
  HTML.LABEL({ for: 'email' }, 'Email'),
  HTML.INPUT({ type: 'email', id: 'email', name: 'email', required: '' }),
  HTML.BUTTON({ type: 'submit' }, 'Log In'),
);

// Table
HTML.TABLE(
  { class: 'data-table' },
  HTML.THEAD(HTML.TR(HTML.TH('Name'), HTML.TH('Email'))),
  HTML.TBODY(HTML.TR(HTML.TD('Alice'), HTML.TD('alice@example.com'))),
);
```

## Special Nodes

### `Raw`

Insert unescaped HTML:

```ts
const raw = HTML.Raw('<strong>Bold</strong>');
// Renders as HTML, not escaped text
```

::: warning
Only use `Raw` with trusted content. Never use with user input.
:::

### `CharRef`

Character reference:

```ts
const nbsp = HTML.CharRef({ html: '&nbsp;', str: '\u00A0' });
const amp = HTML.CharRef({ html: '&amp;', str: '&' });
```

### `Comment`

HTML comment:

```ts
const comment = HTML.Comment('This is a comment');
// Renders: <!-- This is a comment -->
```

## Tag Class

All tag functions return `Tag` instances:

```ts
class Tag {
  tagName: string;
  attrs: Attrs | null;
  children: HTMLNode[];
}
```

### Custom Tags

Create constructors for custom elements or web components:

```ts
const MyWidget = HTML.makeTagConstructor('my-widget');
const el = MyWidget({ theme: 'dark' }, 'Content');
// Renders: <my-widget theme="dark">Content</my-widget>
```

## Attributes

### `Attrs()`

Create an attribute wrapper:

```ts
const attrs = HTML.Attrs({ class: 'btn' }, { id: 'submit-btn' });
```

Multiple attribute objects are merged, with later values taking precedence.

### `flattenAttributes()`

Merge an array of attribute objects:

```ts
import { flattenAttributes } from '@blaze-ng/htmljs';

const merged = flattenAttributes([
  { class: 'btn', id: 'my-btn' },
  { class: 'btn-primary', disabled: '' },
]);
// => { class: 'btn btn-primary', id: 'my-btn', disabled: '' }
```

Note: `class` values are concatenated with a space; other attributes are overwritten.

## Rendering

### `toHTML()`

Convert HTMLJS nodes to an HTML string:

```ts
import { toHTML } from '@blaze-ng/htmljs';

const node = HTML.DIV({ class: 'card' }, HTML.P('Hello'));
const html = toHTML(node);
// => '<div class="card"><p>Hello</p></div>'
```

### `toText()`

Convert to plain text (strips tags):

```ts
import { toText } from '@blaze-ng/htmljs';

const text = toText(HTML.P('Hello ', HTML.STRONG('world')));
// => 'Hello world'
```

## Visitor Pattern

Transform or traverse HTMLJS trees:

### `Visitor`

```ts
import { Visitor } from '@blaze-ng/htmljs';

class MyVisitor extends Visitor {
  visitTag(tag: Tag) {
    console.log(`Found tag: ${tag.tagName}`);
    return super.visitTag(tag);
  }
  visitString(str: string) {
    console.log(`Found text: ${str}`);
    return str;
  }
}

new MyVisitor().visit(myHtmlTree);
```

### `TransformingVisitor`

Transform nodes during traversal:

```ts
import { TransformingVisitor, Tag } from '@blaze-ng/htmljs';

class AddClassVisitor extends TransformingVisitor {
  visitTag(tag: Tag) {
    if (tag.tagName === 'div') {
      tag.attrs = { ...tag.attrs, class: 'enhanced' };
    }
    return super.visitTag(tag);
  }
}
```

### `ToHTMLVisitor`

Built-in visitor for HTML serialization (used by `toHTML()`).

### `ToTextVisitor`

Built-in visitor for text extraction (used by `toText()`).

## Utility Functions

```ts
import {
  isArray,
  isNully,
  isValidAttributeName,
  isKnownElement,
  isKnownSVGElement,
  isVoidElement,
  getTag,
  ensureTag,
} from '@blaze-ng/htmljs';

isArray([1, 2, 3]); // true
isNully(null); // true
isNully(undefined); // true
isNully(''); // false
isValidAttributeName('class'); // true
isValidAttributeName('on"x'); // false
isKnownElement('div'); // true
isKnownSVGElement('circle'); // true
isVoidElement('br'); // true
isVoidElement('div'); // false
```

## Types

```ts
// Any valid HTMLJS node
type HTMLNode =
  | string
  | number
  | boolean
  | null
  | undefined
  | Tag
  | Raw
  | CharRef
  | Comment
  | HTMLNode[];

// Tag attributes
type Attrs = Record<string, string | number | boolean | null | undefined> | Attrs[];

// Text modes for parsing context
enum TEXTMODE {
  STRING = 1,
  RCDATA = 2,
  ATTRIBUTE = 3,
}
```

## Constants

```ts
import {
  knownHTMLElementNames, // string[] — all standard HTML element names
  knownSVGElementNames, // string[] — all standard SVG element names
  knownElementNames, // string[] — combined HTML + SVG
  voidElementNames, // string[] — self-closing elements (br, hr, img, etc.)
} from '@blaze-ng/htmljs';
```
