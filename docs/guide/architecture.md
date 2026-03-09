# Architecture

Deep dive into how Blaze-ng is structured and how the packages work together.

## Package Dependency Graph

```
┌─────────────────────────────────────────────────────────┐
│                    Application Code                      │
└─────────┬───────────────┬───────────────┬───────────────┘
          │               │               │
          ▼               ▼               ▼
┌─────────────┐  ┌────────────────┐  ┌──────────────────┐
│  templating  │  │ templating-    │  │  spacebars-      │
│  (entry)     │  │ runtime        │  │  compiler         │
└──────┬──────┘  └───────┬────────┘  └────────┬─────────┘
       │                 │                     │
       │                 ▼                     ▼
       │         ┌──────────────┐     ┌──────────────┐
       │         │    blaze     │     │  spacebars    │
       │         │   (core)     │     │  (runtime)    │
       │         └──────┬──────┘     └──────┬────────┘
       │                │                    │
       │                ▼                    │
       │         ┌──────────────┐            │
       │         │   htmljs     │◄───────────┘
       │         └──────┬──────┘
       │                │
       ▼                ▼
┌─────────────┐  ┌──────────────┐  ┌──────────────────┐
│ templating-  │  │  observe-    │  │   blaze-tools    │
│ compiler     │  │  sequence    │  │   (parsing)      │
└──────┬──────┘  └──────────────┘  └──────────────────┘
       │                                    │
       ▼                                    ▼
┌─────────────┐                    ┌──────────────────┐
│ templating-  │                    │   html-tools     │
│ tools        │                    │   (HTML parser)  │
└──────┬──────┘                    └──────────────────┘
       │
       ▼
┌──────────────────┐
│ caching-html-    │
│ compiler          │
└──────────────────┘
```

## Package Descriptions

### Core Runtime

| Package                        | Purpose                                                              | Size  |
| ------------------------------ | -------------------------------------------------------------------- | ----- |
| **@blaze-ng/blaze**            | Core rendering engine — `Blaze.View`, `Blaze.render`, `Blaze.toHTML` | ~8 KB |
| **@blaze-ng/htmljs**           | HTML object representation — `HTML.DIV()`, `HTML.Raw()`, etc.        | ~2 KB |
| **@blaze-ng/observe-sequence** | Reactive list diffing with `_id`-based tracking                      | ~3 KB |

### Template System

| Package                             | Purpose                                                | Size  |
| ----------------------------------- | ------------------------------------------------------ | ----- |
| **@blaze-ng/templating-runtime**    | `Template` class, helpers, events, lifecycle callbacks | ~4 KB |
| **@blaze-ng/templating-compiler**   | Compiles `.html` files to JavaScript at build time     | ~3 KB |
| **@blaze-ng/templating-tools**      | Shared utilities for template compilation              | ~2 KB |
| **@blaze-ng/caching-html-compiler** | Caching layer for build-time compilation               | ~1 KB |

### Spacebars (Template Language)

| Package                          | Purpose                                          | Size   |
| -------------------------------- | ------------------------------------------------ | ------ |
| **@blaze-ng/spacebars**          | Runtime for Spacebars expressions                | ~3 KB  |
| **@blaze-ng/spacebars-compiler** | Compiles Spacebars templates to render functions | ~12 KB |

### Parsing

| Package                   | Purpose                                       | Size  |
| ------------------------- | --------------------------------------------- | ----- |
| **@blaze-ng/html-tools**  | Tokenizer and parser for HTML                 | ~5 KB |
| **@blaze-ng/blaze-tools** | Scanner utilities for parsing Blaze templates | ~2 KB |

### Optional

| Package              | Purpose                                                   | Size                |
| -------------------- | --------------------------------------------------------- | ------------------- |
| **@blaze-ng/wasm**   | Optional WASM accelerators for diffing and tokenization   | ~1 KB (JS fallback) |
| **@blaze-ng/meteor** | Meteor-specific integration (Tracker, ReactiveVar, Mongo) | ~2 KB               |

## How Rendering Works

### 1. Template Compilation

Spacebars template:

```handlebars
<template name='greeting'>
  <h1>Hello, {{name}}!</h1>
  {{#if showDetails}}
    <p>{{email}}</p>
  {{/if}}
</template>
```

Compiles to a render function (at build time or runtime):

```ts
function render() {
  const view = this;
  return HTML.H1(
    'Hello, ',
    Blaze.View('lookup:name', () => Spacebars.mustache(view.lookup('name'))),
    '!',
  );
  // ... plus the #if block
}
```

### 2. View Tree

When rendered, Blaze creates a tree of `View` objects:

```
Template.greeting (View)
├── H1 element
│   ├── "Hello, " (text)
│   ├── lookup:name (View) → reactive
│   └── "!" (text)
└── if (View) → reactive
    └── P element
        └── lookup:email (View) → reactive
```

Each `View` tagged as reactive sets up a computation that re-runs when its dependencies change.

### 3. DOM Materialization

The view tree is converted to real DOM nodes:

```ts
// Simplified flow
Blaze.render(template, parentElement)
  → template.constructView()     // Create view tree
  → Blaze._materializeView(view) // Convert to DOM
  → parentElement.appendChild()  // Insert into document
```

### 4. Reactive Updates

When `name` changes:

```
name.set('Bob')
  → Dependency invalidated
  → Computation re-runs
  → lookup:name View re-evaluates
  → Returns 'Bob'
  → Blaze patches the specific text node
```

Only the text node containing the name is updated. Everything else stays untouched.

## The View Lifecycle

```
┌─────────────────────────────────┐
│         View Created            │
│  - renderFunction assigned      │
│  - parent/child links set       │
└──────────────┬──────────────────┘
               │
               ▼
┌─────────────────────────────────┐
│      View Materialized          │
│  - renderFunction called        │
│  - DOM nodes created            │
│  - Reactive computations start  │
│  - onViewCreated callbacks      │
└──────────────┬──────────────────┘
               │
               ▼
┌─────────────────────────────────┐
│        View Ready               │
│  - DOM in document              │
│  - onViewReady callbacks        │
│  - firstNode/lastNode available │
└──────────────┬──────────────────┘
               │ (reactive updates happen here)
               ▼
┌─────────────────────────────────┐
│      View Destroyed             │
│  - Computations stopped         │
│  - DOM nodes removed            │
│  - onViewDestroyed callbacks    │
│  - Children destroyed first     │
└─────────────────────────────────┘
```

## HTML Object Model (HTMLJS)

Instead of string concatenation, Blaze uses a structured HTML representation:

```ts
// HTMLJS objects
HTML.DIV({ class: 'card' }, HTML.H2('Title'), HTML.P('Content'), HTML.Raw('<svg>...</svg>'));

// Renders to:
// <div class="card"><h2>Title</h2><p>Content</p><svg>...</svg></div>
```

Benefits:

- **Type-safe** — catch errors at compile time
- **Transformable** — manipulate structure before rendering
- **Efficient** — no string parsing needed

## Observer Pattern for Lists

The `observe-sequence` package watches reactive arrays/cursors and emits granular changes:

```ts
import { ObserveSequence } from '@blaze-ng/observe-sequence';

const handle = ObserveSequence.observe(() => Items.find({}, { sort: { position: 1 } }), {
  addedAt(id, item, index) {
    // Insert DOM node at index
  },
  removedAt(id, item, index) {
    // Remove DOM node at index
  },
  movedTo(id, item, fromIndex, toIndex) {
    // Move DOM node from fromIndex to toIndex
  },
  changedAt(id, newItem, oldItem, index) {
    // Update DOM node at index
  },
});
```

## Compilation Pipeline

```
.html file
    │
    ▼
┌──────────────────┐
│  html-tools      │  Tokenize HTML
│  (tokenizer)     │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  html-tools      │  Parse into AST
│  (parser)        │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  spacebars-      │  Compile Spacebars syntax
│  compiler        │  into render functions
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  templating-     │  Register Template objects
│  tools           │  with render functions
└────────┬─────────┘
         │
         ▼
    JavaScript code
    (render functions)
```

## Extending Blaze-ng

### Custom View Types

```ts
// Create a custom view
const myView = Blaze.View('myCustomView', function () {
  return HTML.DIV({ class: 'custom' }, this.lookup('content'));
});

// Set up lifecycle hooks
myView.onViewCreated(function () {
  console.log('Custom view created');
});

Blaze.render(myView, document.body);
```

### Custom Block Helpers

```ts
// Register a block helper that provides animation context
Blaze.Template.registerHelper('animate', function () {
  const view = Blaze.currentView;
  // ... set up animation logic
  return Blaze.With(this, function () {
    return Template._templateInstance.get().view.templateContentBlock;
  });
});
```
