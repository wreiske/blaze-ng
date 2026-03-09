# What is Blaze-NG?

Blaze-NG is a **modern TypeScript rewrite** of [Meteor Blaze](https://github.com/meteor/blaze), the reactive templating engine that powers thousands of Meteor applications.

## The Problem

The original Blaze is great, but it was written in ES5 JavaScript over a decade ago. It depends on jQuery, lodash, and uglify-js. It has no TypeScript types. It's tightly coupled to Meteor's Tracker. And at ~25KB gzipped, it's larger than it needs to be.

## The Solution

Blaze-NG is a ground-up rewrite that keeps everything developers love about Blaze while modernizing everything else:

- **Zero runtime dependencies** — no jQuery, no lodash. Native DOM APIs only.
- **Full TypeScript** — strict mode, complete type declarations, rich IntelliSense.
- **Framework agnostic** — bring your own reactive system (Tracker, signals, etc.).
- **Tree-shakeable** — ESM + CJS bundles, import only what you use.
- **Faster** — 2-5x faster reactive updates through native APIs and V8 optimizations.
- **Smaller** — under 15KB gzipped for the core runtime.
- **100% compatible** — drop-in replacement for existing Blaze apps.

## How It Works

Blaze-NG uses the same **Spacebars** template syntax and the same programming model as original Blaze:

1. **Templates** define reactive HTML with `{{expressions}}`
2. **Helpers** compute values that update automatically when data changes
3. **Events** handle user interactions declaratively
4. **Lifecycle callbacks** let you run code at creation, render, and destruction

The key difference is under the hood: instead of jQuery DOM manipulation, Blaze-NG uses native `classList`, `style.setProperty()`, and `addEventListener`. Instead of lodash utilities, it uses built-in JavaScript methods. Instead of requiring Meteor Tracker, it accepts any reactive system through a clean interface.

## Package Architecture

Blaze-NG is organized as a monorepo of focused, composable packages:

```
@blaze-ng/core           — View engine, rendering, DOM, events, Template
@blaze-ng/htmljs         — HTML AST (Tag, Raw, CharRef, Comment, Visitors)
@blaze-ng/spacebars      — Spacebars runtime (mustache, include, etc.)
@blaze-ng/observe-sequence — Reactive array/cursor observation for {{#each}}
@blaze-ng/meteor         — Tracker adapter for Meteor integration
@blaze-ng/wasm           — Optional WASM accelerators (diff, tokenize)
```

Most of the time you'll just use `@blaze-ng/html-templates` which bundles everything together.

## Who Should Use This?

- **Existing Meteor/Blaze apps** that want better performance, TypeScript support, and modern tooling — without rewriting templates
- **New Meteor apps** that prefer Blaze's simplicity over React/Svelte
- **Non-Meteor apps** that want a lightweight reactive templating engine with no framework lock-in
