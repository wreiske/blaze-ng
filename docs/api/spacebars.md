# @blaze-ng/spacebars

Runtime support for Spacebars templates. Handles mustache evaluation, template inclusion, and keyword arguments.

## Installation

```bash
npm install @blaze-ng/spacebars
```

## Namespace

```ts
import { Spacebars } from '@blaze-ng/spacebars';
```

## Functions

### `mustache()`

Evaluate a mustache expression (`{{expression}}`). Handles helpers, data context properties, and escaping.

```ts
function mustache(value: unknown, ...args: unknown[]): unknown;
```

Used internally by compiled templates:

```ts
// {{name}} compiles to:
Spacebars.mustache(view.lookup('name'))

// {{formatDate createdAt "short"}} compiles to:
Spacebars.mustache(view.lookup('formatDate'), view.lookup('createdAt'), 'short')
```

### `attrMustache()`

Evaluate a mustache in an HTML attribute context. Returns an attribute object or `null`.

```ts
function attrMustache(...args: unknown[]): Record<string, unknown> | null;
```

```ts
// <div {{attrs}}> compiles to:
Spacebars.attrMustache(view.lookup('attrs'))
```

### `dataMustache()`

Evaluate a mustache and return the raw value (not HTML-escaped). Used for data context arguments.

```ts
function dataMustache(...args: unknown[]): unknown;
```

### `include()`

Include a template or content function.

```ts
function include(
  templateOrFunction: Template | (() => unknown),
  contentFunc?: () => unknown,
  elseFunc?: () => unknown
): View | unknown;
```

```ts
// {{> myTemplate}} compiles to:
Spacebars.include(view.lookupTemplate('myTemplate'))

// {{#myBlock}}...{{else}}...{{/myBlock}} compiles to:
Spacebars.include(view.lookupTemplate('myBlock'), contentFunc, elseFunc)
```

### `makeRaw()`

Wrap a value in `HTML.Raw` for triple-stache output (`{{{expression}}}`).

```ts
function makeRaw(value: unknown): Raw | null;
```

```ts
// {{{htmlContent}}} compiles to:
Spacebars.makeRaw(view.lookup('htmlContent'))
```

### `call()`

Call a function with arguments, with support for Promise-returning helpers.

```ts
function call(...args: unknown[]): unknown;
```

### `dot()`

Safe property access (dot notation in templates).

```ts
function dot(value: unknown, ...keys: string[]): unknown;
```

```ts
// {{user.address.city}} compiles to:
Spacebars.dot(view.lookup('user'), 'address', 'city')
```

### `With()`

Create a `{{#with}}` block view.

```ts
function With(
  argFunc: () => unknown,
  contentFunc: () => unknown,
  elseFunc?: () => unknown
): View;
```

## Classes

### `kw`

Keyword arguments container. When templates pass keyword arguments (`key=value`), they're wrapped in a `kw` instance.

```ts
class kw {
  constructor(hash: Record<string, unknown>);
  hash: Record<string, unknown>;
}
```

```ts
// {{> myTemplate name="Alice" age=30}} passes:
// args = [new Spacebars.kw({ name: 'Alice', age: 30 })]
```

### `SafeString`

Marks a string as safe HTML (not to be escaped):

```ts
class SafeString {
  constructor(html: string);
  toHTML(): string;
  toString(): string;
}
```

```ts
// In a helper, return SafeString to avoid escaping:
Template.registerHelper('bold', function (text) {
  return new Spacebars.SafeString(`<strong>${Blaze._escape(text)}</strong>`);
});
```

## How It Works

When you write a Spacebars template:

```handlebars
<h1>Hello, {{name}}!</h1>
{{#if isLoggedIn}}
  <p>Welcome back</p>
{{/if}}
```

It compiles to code that uses `Spacebars` functions:

```ts
function render() {
  const view = this;
  return [
    HTML.H1(
      'Hello, ',
      Blaze.View('lookup:name', () => 
        Spacebars.mustache(view.lookup('name'))
      ),
      '!'
    ),
    Blaze.If(
      () => Spacebars.call(view.lookup('isLoggedIn')),
      () => HTML.P('Welcome back')
    ),
  ];
}
```
