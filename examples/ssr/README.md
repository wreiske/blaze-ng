# Blaze-NG SSR Example (Express)

A standalone Express server that renders Blaze-NG templates to HTML on the server — no Meteor required.

## What It Demonstrates

- **Server-side rendering** with `toHTML()` and `toHTMLWithData()` from `@blaze-ng/core`
- **Runtime template compilation** using `@blaze-ng/spacebars-compiler`
- **Layout composition** — nested templates rendered to strings
- **Multiple routes** — home, todos, profiles, and 404 pages
- **Zero client-side JavaScript** — pages are pure server-rendered HTML

## Setup

```bash
cd examples/ssr
pnpm install
pnpm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Routes

| Route | Description |
|---|---|
| `/` | Home page with feature cards |
| `/todos` | Server-rendered todo list |
| `/profile/alice` | User profile (Alice) |
| `/profile/bob` | User profile (Bob) |

## Project Structure

```
ssr/
├── src/
│   ├── server.js           # Express server with routes
│   ├── templates.js         # Template definitions (Spacebars strings)
│   └── compile.js           # Utility: compile + register templates
├── package.json
└── README.md
```

## How It Works

### 1. Define Templates as Spacebars Strings

Templates are defined as strings and compiled at server startup:

```js
import { defineTemplate } from './compile.js';

defineTemplate('greeting', `
  <h1>Hello, {{name}}!</h1>
  <p>Welcome to {{place}}.</p>
`);
```

### 2. Compile & Register

The `defineTemplate()` helper compiles Spacebars → render function → registers via `__define__()`:

```js
import { compile } from '@blaze-ng/spacebars-compiler';
import { __define__ } from '@blaze-ng/templating-runtime';

export function defineTemplate(name, source) {
  const code = compile(source, { isTemplate: true });
  const renderFunc = new Function('HTML', 'Spacebars', `return ${code}`)(HTML, Spacebars);
  __define__(name, renderFunc);
}
```

### 3. Render to HTML

On each request, render templates with data using `toHTMLWithData()`:

```js
import { Template, toHTMLWithData } from '@blaze-ng/core';

app.get('/', (req, res) => {
  const html = toHTMLWithData(Template.greeting, {
    name: 'World',
    place: 'Blaze-NG',
  });
  res.type('html').send(html);
});
```

## Meteor vs Standalone

| Feature | Meteor SSR | This Example |
|---|---|---|
| Template compilation | Build-time (`.html` files) | Runtime (strings) |
| Template access | `import { Template } from 'meteor/templating'` | `import { Template } from '@blaze-ng/core'` |
| HTTP server | `WebApp.connectHandlers` | Express |
| SSR function | `Blaze.toHTMLWithData()` | `toHTMLWithData()` |
| Reactivity | Tracker (available but unused in SSR) | None needed |
