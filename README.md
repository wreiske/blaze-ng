# 🔥 Blaze-NG

**A modern TypeScript rewrite of [Meteor Blaze](https://github.com/meteor/blaze) — the reactive templating engine.**

[![Tests](https://img.shields.io/badge/tests-435%20passing-brightgreen)]()
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue)]()
[![License](https://img.shields.io/badge/license-MIT-green)]()
[![Node](https://img.shields.io/badge/node-%3E%3D18-brightgreen)]()

Blaze-NG is a ground-up rewrite of Meteor's Blaze templating engine in modern TypeScript. It delivers **100% API compatibility** with the original while being faster, smaller, fully typed, and dependency-free.

## Why Blaze-NG?

|                      | Original Blaze            | Blaze-NG                                         |
| -------------------- | ------------------------- | ------------------------------------------------ |
| **Language**         | JavaScript (ES5)          | TypeScript (strict)                              |
| **Dependencies**     | jQuery, lodash, uglify-js | **Zero runtime deps**                            |
| **Bundle size**      | ~25KB gzip                | **<15KB gzip**                                   |
| **DOM manipulation** | jQuery wrappers           | Native `classList`, `addEventListener`           |
| **Reactivity**       | Meteor Tracker only       | **Any reactive system** (Tracker, signals, etc.) |
| **Module format**    | Meteor packages           | **ESM + CJS** (tree-shakeable)                   |
| **Type safety**      | None                      | Full TypeScript with strict mode                 |
| **Testing**          | Tinytest                  | Vitest (435+ tests)                              |

## Quick Start

### With Meteor

```bash
meteor add wreiske:blaze-ng
```

```js
// In your Meteor app — automatic Tracker integration
import { Template } from 'meteor/wreiske:blaze-ng';
```

### With npm (standalone)

```bash
npm install @blaze-ng/core @blaze-ng/spacebars @blaze-ng/templating
```

```ts
import { Template, Blaze } from '@blaze-ng/core';
import { Spacebars } from '@blaze-ng/spacebars';
```

## Examples

### Hello World

```handlebars
<template name='hello'>
  <h1>Hello, {{name}}!</h1>
  <button>Click me</button>
  <p>You've clicked {{count}} times.</p>
</template>
```

```ts
import { Template } from '@blaze-ng/core';

Template.hello.helpers({
  name() {
    return 'World';
  },
  count() {
    return Session.get('count') || 0;
  },
});

Template.hello.events({
  'click button'(event, instance) {
    const current = Session.get('count') || 0;
    Session.set('count', current + 1);
  },
});
```

### Reactive Lists with `{{#each}}`

```handlebars
<template name="todoList">
  <ul>
    {{#each todo in todos}}
      <li class="{{#if todo.done}}completed{{/if}}">
        {{todo.text}}
        <button class="delete">×</button>
      </li>
    {{else}}
      <li class="empty">No todos yet!</li>
    {{/each}}
  </ul>
</template>
```

```ts
Template.todoList.helpers({
  todos() {
    return Todos.find({}, { sort: { createdAt: -1 } });
  },
});

Template.todoList.events({
  'click .delete'(event, instance) {
    const todo = Blaze.getData(event.currentTarget.parentElement);
    Todos.remove(todo._id);
  },
});
```

### Conditional Rendering

```handlebars
<template name='userProfile'>
  {{#if currentUser}}
    <div class='profile'>
      <img src='{{currentUser.avatar}}' alt='{{currentUser.name}}' />
      <h2>{{currentUser.name}}</h2>
      {{#if isAdmin}}
        <span class='badge'>Admin</span>
      {{/if}}
    </div>
  {{else}}
    <p>Please <a href='/login'>sign in</a>.</p>
  {{/if}}
</template>
```

### Dynamic Attributes

```handlebars
<template name='dynamicButton'>
  <button class='btn {{buttonClass}}' disabled={{isDisabled}} data-loading='{{isLoading}}'>
    {{#if isLoading}}
      Loading...
    {{else}}
      {{label}}
    {{/if}}
  </button>
</template>
```

```ts
Template.dynamicButton.helpers({
  buttonClass() {
    return Template.instance().data.variant || 'primary';
  },
  isDisabled() {
    return Template.instance().data.disabled;
  },
  isLoading() {
    return Template.instance().state.get('loading');
  },
  label() {
    return Template.instance().data.label || 'Submit';
  },
});
```

### Template Composition with `{{> inclusion}}`

```handlebars
<!-- Parent template -->
<template name="dashboard">
  <div class="dashboard">
    {{> header title="Dashboard"}}
    <div class="content">
      {{> sidebar}}
      {{> mainContent}}
    </div>
    {{> footer}}
  </div>
</template>

<!-- Reusable header -->
<template name="header">
  <header>
    <h1>{{title}}</h1>
    <nav>{{> navigation}}</nav>
  </header>
</template>
```

### Template Lifecycle

```ts
Template.myComponent.onCreated(function () {
  // Runs once when the template instance is created
  this.counter = new ReactiveVar(0);
  this.autorun(() => {
    // Re-runs whenever reactive data changes
    console.log('Counter is now:', this.counter.get());
  });
});

Template.myComponent.onRendered(function () {
  // DOM is now available
  const canvas = this.find('canvas');
  this.chart = new Chart(canvas, {
    /* ... */
  });
});

Template.myComponent.onDestroyed(function () {
  // Clean up resources
  if (this.chart) {
    this.chart.destroy();
  }
});
```

### Raw HTML with `{{{triple}}}`

```handlebars
<template name='richContent'>
  <div class='content'>
    {{{htmlContent}}}
  </div>
  <p>Escaped: {{htmlContent}}</p>
</template>
```

```ts
Template.richContent.helpers({
  htmlContent() {
    return '<strong>Bold</strong> and <em>italic</em>';
  },
});
// {{{htmlContent}}} renders: <strong>Bold</strong> and <em>italic</em>
// {{htmlContent}} renders: &lt;strong&gt;Bold&lt;/strong&gt; and &lt;em&gt;italic&lt;/em&gt;
```

### `{{#let}}` Block for Local Variables

```handlebars
<template name='calculations'>
  {{#let total=calculateTotal tax=calculateTax shipping=shippingCost}}
    <p>Subtotal: ${{total}}</p>
    <p>Tax: ${{tax}}</p>
    <p>Shipping: ${{shipping}}</p>
    <hr />
    <p><strong>Total: ${{grandTotal total tax shipping}}</strong></p>
  {{/let}}
</template>
```

### `{{#with}}` Data Context

```handlebars
<template name='orderDetails'>
  {{#with selectedOrder}}
    <div class='order'>
      <h3>Order #{{_id}}</h3>
      <p>Customer: {{customer.name}}</p>
      <p>Status: {{status}}</p>
      {{#each item in items}}
        <div class='line-item'>
          {{item.name}}
          ×
          {{item.qty}}
          = ${{item.total}}
        </div>
      {{/each}}
    </div>
  {{else}}
    <p>Select an order to view details.</p>
  {{/with}}
</template>
```

### Server-Side Rendering (SSR)

```ts
import { Blaze, Template } from '@blaze-ng/core';

// Render any template to an HTML string — perfect for SSR
const html = Blaze.toHTML(Template.myPage);
// Or with data:
const html = Blaze.toHTMLWithData(Template.myPage, { title: 'Hello' });
```

### Global Helpers

```ts
import { Blaze } from '@blaze-ng/core';

// Register helpers available in every template
Blaze.registerHelper('formatDate', (date) => {
  return new Date(date).toLocaleDateString();
});

Blaze.registerHelper('pluralize', (count, singular, plural) => {
  return count === 1 ? singular : plural || singular + 's';
});

Blaze.registerHelper('eq', (a, b) => a === b);
Blaze.registerHelper('gt', (a, b) => a > b);
Blaze.registerHelper('and', (a, b) => a && b);
Blaze.registerHelper('or', (a, b) => a || b);
```

```handlebars
<p>{{formatDate createdAt}}</p>
<p>{{pluralize count 'item'}}</p>
{{#if (eq status 'active')}}Active!{{/if}}
```

### Programmatic Rendering

```ts
import { Blaze } from '@blaze-ng/core';

// Render to a specific DOM element
const view = Blaze.render(Template.myWidget, document.getElementById('container'));

// Render with a data context
const view = Blaze.renderWithData(
  Template.myWidget,
  { title: 'Hello', items: [1, 2, 3] },
  document.getElementById('container'),
);

// Clean up when done
Blaze.remove(view);
```

## Bring Your Own Reactive System

Blaze-NG is **framework-agnostic**. The core has zero dependencies on Meteor Tracker. You can plug in any reactive system:

```ts
import { Blaze } from '@blaze-ng/core';

// Use Meteor Tracker (via the adapter package)
import { createTrackerAdapter } from '@blaze-ng/meteor';
Blaze.setReactiveSystem(createTrackerAdapter(Tracker));

// Or use the built-in simple reactive system (for testing/non-Meteor apps)
import { SimpleReactiveSystem } from '@blaze-ng/core/testing';
Blaze.setReactiveSystem(new SimpleReactiveSystem());

// Or implement your own:
Blaze.setReactiveSystem({
  autorun(fn) {
    /* ... */
  },
  nonReactive(fn) {
    /* ... */
  },
  ReactiveVar(initialValue) {
    /* ... */
  },
});
```

## Package Architecture

```
@blaze-ng/core               ← View engine, rendering, DOM, events, Template
@blaze-ng/htmljs              ← HTML AST nodes (Tag, Raw, CharRef, Comment)
@blaze-ng/spacebars           ← Spacebars runtime (mustache, include, etc.)
@blaze-ng/spacebars-compiler  ← Template → JS compiler
@blaze-ng/observe-sequence    ← Reactive array/cursor observation
@blaze-ng/html-tools          ← HTML tokenizer & parser
@blaze-ng/blaze-tools         ← Token parsers, JS code generation
@blaze-ng/templating-tools    ← HTML scanner, code generation
@blaze-ng/templating-compiler ← .html build plugin
@blaze-ng/templating-runtime  ← Template.body, dynamic templates
@blaze-ng/templating          ← Meta: runtime + compiler
@blaze-ng/html-templates      ← Meta: core + templating
@blaze-ng/meteor              ← Tracker adapter + Meteor bridge
@blaze-ng/hot                 ← HMR (Hot Module Replacement) support
@blaze-ng/compat              ← UI/Handlebars backward-compat aliases
@blaze-ng/wasm                ← Optional WASM accelerators (Rust)
```

### Dependency Graph

```
htmljs ─────────────────────────────────────┐
  ├── html-tools ──┐                        │
  ├── blaze-tools ─┤                        │
  │                ├── spacebars-compiler    │
  │                │     └── templating-tools│
  │                │           └── templating-compiler
  │                │                    │
  ├── core ◄───────┘                    │
  │   ├── spacebars                     │
  │   │   └── templating-runtime ◄──────┘
  │   │         └── templating (meta)
  │   │               └── html-templates (meta)
  │   ├── meteor (adapter)
  │   ├── hot
  │   └── compat
  │
  └── observe-sequence
        └── core (uses for {{#each}})
```

## Performance

Blaze-NG achieves significant performance improvements through:

1. **Native `classList` API** — No more string parsing for class attributes
2. **Native `style.setProperty()`** — Direct style manipulation without parsing
3. **Native `addEventListener`** — No jQuery event wrapper overhead
4. **Zero lodash** — Native `Object.hasOwn`, `Array.isArray`, `typeof`
5. **TypeScript shapes** — V8 hidden class optimization from consistent object shapes
6. **`WeakRef` / `FinalizationRegistry`** — Automatic view cleanup without manual GC
7. **Optional WASM** — Accelerated sequence diffing for large `{{#each}}` lists (1000+ items)
8. **Tree-shakeable ESM** — Only import what you use

## TypeScript Support

Every package ships with full TypeScript declarations. Your templates get type safety:

```ts
import { Template, TemplateInstance, Blaze } from '@blaze-ng/core';

// Type-safe helper definitions
Template.myComponent.helpers({
  greeting(): string {
    return `Hello, ${this.name}!`;
  },
  items(): Array<{ id: number; label: string }> {
    return Template.instance().data.items;
  },
});

// Type-safe event handlers
Template.myComponent.events({
  'click .delete'(event: MouseEvent, instance: TemplateInstance) {
    const itemId = instance.data.itemId;
    // ...
  },
});

// Type-safe lifecycle
Template.myComponent.onCreated(function (this: TemplateInstance) {
  this.autorun(() => {
    // ...
  });
});
```

## Migration from Blaze

Blaze-NG is designed as a **drop-in replacement**. For most apps:

1. Install `@blaze-ng/html-templates` (replaces `blaze-html-templates`)
2. Install `@blaze-ng/meteor` (bridges Tracker)
3. Your existing `.html` templates and `.js` helpers work unchanged
4. Optionally add TypeScript types for improved DX

```bash
# Remove old packages
meteor remove blaze-html-templates

# Add Blaze-NG
meteor add wreiske:blaze-ng-html-templates
```

See the [Migration Guide](docs/guide/migration.md) for detailed instructions.

## Example Apps

The `examples/` directory contains six complete, runnable applications:

| Example              | Stack            | What it demonstrates                                       |
| -------------------- | ---------------- | ---------------------------------------------------------- |
| `meteor-counter`     | Meteor           | ReactiveVar, helpers, events, conditional rendering        |
| `meteor-todos`       | Meteor + MongoDB | Collections, `{{#each}}` cursors, sub-templates, filtering |
| `meteor-ssr`         | Meteor + WebApp  | Server-side rendering, shared templates, email generation  |
| `standalone-counter` | Vite (npm)       | Runtime compilation, SimpleReactiveSystem, no Meteor       |
| `standalone-todos`   | Vite (npm)       | Multiple templates, reactive store, list rendering         |
| `ssr`                | Express (npm)    | Server-only rendering, layout composition, dynamic routes  |

Meteor examples:

```bash
cd examples/meteor-counter
npx meteor@latest npm install
npx meteor@latest
```

Standalone examples:

```bash
cd examples/standalone-counter
pnpm install
pnpm dev
```

See each example's README for full details.

## Development

```bash
# Clone the repo
git clone https://github.com/wreiske/blaze-ng.git
cd blaze-ng

# Install dependencies
pnpm install

# Run all 435+ tests
pnpm test

# Build all packages
pnpm build

# Lint & format
pnpm lint
pnpm format
```

## Project Status

| Phase                      | Status         | Details                                          |
| -------------------------- | -------------- | ------------------------------------------------ |
| Phase 0: Scaffolding       | ✅ Complete    | pnpm monorepo, TypeScript, Vitest                |
| Phase 1: Foundation        | ✅ Complete    | htmljs, blaze-tools, observe-sequence            |
| Phase 2: Parsers           | ✅ Complete    | html-tools, spacebars-compiler, templating-tools |
| Phase 3: Core Runtime      | ✅ Complete    | View, DOMRange, Template, Events, Builtins       |
| Phase 4: Spacebars         | ✅ Complete    | Spacebars runtime, templating runtime            |
| Phase 5: Meteor Adapter    | ✅ Complete    | TrackerAdapter, HMR, compat aliases              |
| Phase 6: Integration Tests | ✅ Complete    | 435+ tests across 14 test files                  |
| Phase 7: WASM              | ✅ Complete    | JS fallbacks + WASM acceleration ready           |
| Phase 8: Documentation     | ✅ Complete    | VitePress site, API docs, examples               |
| Phase 9: Release           | 🚧 In Progress | npm publish, Atmosphere publish                  |

## License

MIT — see [LICENSE](LICENSE).

## Credits

- Original [Meteor Blaze](https://github.com/meteor/blaze) by the Meteor Development Group
- Built with love for the Meteor community
