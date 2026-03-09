# @blaze-ng/core

Core view engine, rendering, DOM management, and event system for Blaze-NG.

## Installation

```bash
npm install @blaze-ng/core
```

## Usage

```ts
import { Blaze, Template, View, SimpleReactiveSystem } from '@blaze-ng/core';

// Set up reactivity
Blaze.setReactiveSystem(new SimpleReactiveSystem());

// Render a template
const view = Blaze.render(Template.myTemplate, document.getElementById('app'));

// Render with data context
Blaze.renderWithData(Template.myTemplate, { title: 'Hello' }, document.body);

// Server-side rendering
const html = Blaze.toHTML(Template.myTemplate);
const htmlWithData = Blaze.toHTMLWithData(Template.myTemplate, { name: 'World' });

// Clean up
Blaze.remove(view);
```

## Exports

| Export | Description |
|--------|-------------|
| `Blaze` | Main namespace — `render`, `renderWithData`, `remove`, `toHTML`, `toHTMLWithData`, `currentView`, `getView`, `With`, `If`, `Unless`, `Each` |
| `Template` | Template registry and definition |
| `TemplateInstance` | Instance class with `find`, `findAll`, `data`, `autorun` |
| `View` | Core view class — the fundamental rendering unit |
| `DOMRange` | DOM range management for efficient updates |
| `AttributeHandler` | Dynamic attribute binding |
| `EventSupport` | Event delegation system |
| `SimpleReactiveSystem` | Built-in reactive system implementation |
| `ReactiveVar` | Simple reactive variable |
| `Computation` | Reactive computation tracking |

## Bring Your Own Reactive System

The core package supports pluggable reactive systems via `Blaze.setReactiveSystem()`:

```ts
import { Blaze } from '@blaze-ng/core';
import { createTrackerAdapter } from '@blaze-ng/meteor';

// Use Meteor Tracker
Blaze.setReactiveSystem(createTrackerAdapter(Tracker));

// Or use the built-in SimpleReactiveSystem
Blaze.setReactiveSystem(new SimpleReactiveSystem());
```

## License

MIT
