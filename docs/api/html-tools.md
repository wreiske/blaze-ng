# @blaze-ng/html-tools

HTML tokenizer and parser. Converts HTML strings into structured AST nodes.

## Installation

```bash
npm install @blaze-ng/html-tools
```

## Namespace

```ts
import { HTMLTools } from '@blaze-ng/html-tools';
```

## Parsing

### `parseFragment()`

Parse an HTML fragment into an HTMLJS tree.

```ts
function parseFragment(
  input: string,
  options?: ParseOptions
): HTMLNode[];
```

```ts
import { HTMLTools } from '@blaze-ng/html-tools';

const ast = HTMLTools.parseFragment('<div class="hello"><p>World</p></div>');
```

### `ParseOptions`

```ts
interface ParseOptions {
  getTemplateTag?: GetTemplateTagFn;
}
```

The `getTemplateTag` function is used by Spacebars to handle `{{...}}` expressions during parsing.

## Scanner

### `Scanner`

Low-level string scanner for tokenization.

```ts
class Scanner {
  constructor(input: string);
  
  pos: number;
  input: string;
  
  peek(): string;
  rest(): string;
  isEOF(): boolean;
  fatal(msg: string): never;
}
```

```ts
const scanner = new HTMLTools.Scanner('<div>hello</div>');
console.log(scanner.peek());  // '<'
console.log(scanner.rest());  // '<div>hello</div>'
```

## Tokenization

### `getHTMLToken()`

Get the next HTML token from a scanner.

```ts
function getHTMLToken(scanner: Scanner, dataMode?: string): HTMLToken | null;
```

### Token Types

```ts
type HTMLToken = 
  | TagToken        // <div>, </div>, <br/>
  | CharsToken      // text content
  | CommentToken    // <!-- comment -->
  | DoctypeToken    // <!DOCTYPE html>
  | CharRefToken;   // &amp;, &#123;

interface TagToken {
  t: 'Tag';
  n: string;           // tag name
  isEnd?: boolean;     // closing tag
  isSelfClose?: boolean;
  attrs?: AttrsDict;
}

interface CharsToken {
  t: 'Chars';
  v: string;           // text value
}

interface CommentToken {
  t: 'Comment';
  v: string;           // comment value
}

interface DoctypeToken {
  t: 'Doctype';
  v: string;           // doctype value
}
```

## Utility Functions

### `asciiLowerCase()`

Convert a string to lowercase (ASCII only).

```ts
function asciiLowerCase(str: string): string;
```

### `properCaseTagName()`

Get the proper case for an HTML tag name.

```ts
function properCaseTagName(name: string): string;
```

```ts
properCaseTagName('div')      // => 'DIV'
properCaseTagName('textArea') // => 'TEXTAREA'
```

### `properCaseAttributeName()`

Get the proper case for an attribute name.

```ts
function properCaseAttributeName(name: string): string;
```

### `getCharacterReference()`

Decode an HTML character reference.

```ts
function getCharacterReference(name: string): string | null;
```

```ts
getCharacterReference('amp')    // => '&'
getCharacterReference('lt')     // => '<'
getCharacterReference('#123')   // => '{'
getCharacterReference('#x1F600') // => '😀'
```

### `makeRegexMatcher()`

Create a function that matches a regex at the current scanner position.

```ts
function makeRegexMatcher(regex: RegExp): (scanner: Scanner) => string | null;
```

## Constants

### `TEMPLATE_TAG_POSITION`

Positions where template tags can appear:

```ts
const TEMPLATE_TAG_POSITION = {
  ELEMENT: 1,      // Between tags
  IN_START_TAG: 2, // Inside an opening tag
  IN_ATTRIBUTE: 3, // Inside an attribute value
  IN_RCDATA: 4,    // Inside <textarea> or <title>
};
```
