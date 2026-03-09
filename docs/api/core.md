# @blaze-ng/core

The core rendering engine. Provides the `View` class, `Template` class, rendering functions, and the reactive system interface.

## Installation

```bash
npm install @blaze-ng/core
```

## Rendering

### `render()`

Render a template or view into a DOM element.

```ts
function render(
  content: Template | View | (() => unknown),
  parentElement: Element,
  nextNode?: Node | null,
  parentView?: View
): View;
```

**Parameters:**
- `content` — Template, View, or render function to render
- `parentElement` — DOM element to render into
- `nextNode` — Insert before this node (default: append)
- `parentView` — Parent view for context inheritance

**Returns:** The rendered `View`

```ts
import { Blaze } from '@blaze-ng/core';

const view = Blaze.render(Template.myComponent, document.getElementById('app'));
```

### `renderWithData()`

Render with a specific data context.

```ts
function renderWithData(
  content: Template | View | (() => unknown),
  data: object | (() => object),
  parentElement: Element,
  nextNode?: Node | null,
  parentView?: View
): View;
```

```ts
const view = Blaze.renderWithData(
  Template.userCard,
  { name: 'Alice', email: 'alice@example.com' },
  document.getElementById('app')
);
```

### `remove()`

Remove a rendered view and clean up.

```ts
function remove(view: View): void;
```

```ts
const view = Blaze.render(Template.modal, document.body);
// Later...
Blaze.remove(view);
```

### `toHTML()` {#tohtml}

Render to an HTML string (for SSR).

```ts
function toHTML(content: Template | View | (() => unknown)): string;
```

```ts
const html = Blaze.toHTML(Template.myComponent);
// => '<div class="card">...</div>'
```

### `toHTMLWithData()`

Render to HTML with a data context.

```ts
function toHTMLWithData(
  content: Template | View | (() => unknown),
  data: object | (() => object)
): string;
```

```ts
const html = Blaze.toHTMLWithData(Template.greeting, { name: 'World' });
// => '<h1>Hello, World!</h1>'
```

## View

The fundamental building block of Blaze's rendering system. Each reactive region in a template is a `View`.

### Constructor

```ts
class View {
  constructor(name?: string, render?: () => unknown);
}
```

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `name` | `string` | View name (e.g., `'Template.myComponent'`, `'if'`, `'each'`) |
| `parentView` | `View \| null` | Parent in the view tree |
| `isCreated` | `boolean` | Whether the view has been created |
| `isRendered` | `boolean` | Whether the view is in the document |
| `isDestroyed` | `boolean` | Whether the view has been destroyed |
| `renderCount` | `number` | Number of times the view has re-rendered |
| `template` | `Template \| null` | Associated template (if any) |
| `templateInstance` | `TemplateInstance \| null` | Template instance (if any) |
| `firstNode` | `Node` | First DOM node |
| `lastNode` | `Node` | Last DOM node |

### Lifecycle Callbacks

```ts
view.onViewCreated(callback: () => void): void;
view.onViewReady(callback: () => void): void;
view.onViewDestroyed(callback: () => void): void;
```

### Methods

```ts
// Look up a value by name in this view's scope
view.lookup(name: string): unknown;

// Get the current data context
view.templateInstance(): TemplateInstance;
```

## Template {#template-helpers}

### Defining Helpers

```ts
Template.myComponent.helpers({
  fullName() {
    return `${this.firstName} ${this.lastName}`;
  },
  formattedDate() {
    return new Date(this.date).toLocaleDateString();
  },
});
```

### Defining Events {#template-events}

```ts
Template.myComponent.events({
  'click .btn'(event: Event, instance: TemplateInstance) {
    event.preventDefault();
    instance.state.set('clicked', true);
  },
  'submit form'(event: Event, instance: TemplateInstance) {
    event.preventDefault();
    // Handle form submission
  },
});
```

### Lifecycle Callbacks {#lifecycle-callbacks}

```ts
Template.myComponent.onCreated(function () {
  // 'this' is the TemplateInstance
  this.counter = new ReactiveVar(0);
});

Template.myComponent.onRendered(function () {
  // DOM is ready
  this.find('input')?.focus();
});

Template.myComponent.onDestroyed(function () {
  // Clean up
});
```

### Static Methods

```ts
// Get the current template instance
Template.instance(): TemplateInstance;

// Get the current data context
Template.currentData(): object;

// Get parent data context
Template.parentData(numLevels?: number): object;

// Register a global helper
Template.registerHelper(name: string, fn: Function): void;

// Deregister a global helper
Blaze.deregisterHelper(name: string): void;
```

## TemplateInstance

Available inside lifecycle callbacks and event handlers as `this` (lifecycle) or the second parameter (events).

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `data` | `object` | Current data context |
| `view` | `View` | The underlying view |
| `firstNode` | `Node` | First DOM node |
| `lastNode` | `Node` | Last DOM node |

### Methods

```ts
// Find a DOM element within this template
instance.find(selector: string): Element | null;

// Find all matching DOM elements
instance.findAll(selector: string): Element[];

// Run a reactive computation (auto-stopped on destroy)
instance.autorun(fn: (computation: Computation) => void): Computation;

// Subscribe to data (auto-stopped on destroy)
instance.subscribe(name: string, ...args: unknown[]): SubscriptionHandle;

// Check if all subscriptions are ready
instance.subscriptionsReady(): boolean;
```

## Reactive System

### `setReactiveSystem()`

Configure the reactive system before using any templates.

```ts
function setReactiveSystem(system: ReactiveSystem): void;
```

```ts
interface ReactiveSystem {
  autorun(fn: () => void): { stop: () => void };
  createVar<T>(initialValue: T): { get: () => T; set: (v: T) => void };
  nonReactive<T>(fn: () => T): T;
  batch?(fn: () => void): void;
}
```

### `SimpleReactiveSystem`

Built-in minimal reactive system for testing and prototyping:

```ts
import { SimpleReactiveSystem, Blaze } from '@blaze-ng/core';

Blaze.setReactiveSystem(new SimpleReactiveSystem());
```

## Block Helpers

### `With()`

```ts
function With(data: () => unknown, contentFunc: () => unknown, elseFunc?: () => unknown): View;
```

### `If()` / `Unless()`

```ts
function If(condition: () => unknown, contentFunc: () => unknown, elseFunc?: () => unknown): View;
function Unless(condition: () => unknown, contentFunc: () => unknown, elseFunc?: () => unknown): View;
```

### `Each()`

```ts
function Each(argFunc: () => unknown, contentFunc: () => unknown, elseFunc?: () => unknown): View;
```

### `Let()`

```ts
function Let(bindings: Record<string, () => unknown>, contentFunc: () => unknown): View;
```

## Utilities

```ts
// Get data context of a DOM element
Blaze.getData(element?: Element): object;

// Get the view for a DOM element
Blaze.getView(element?: Element): View;

// Check if a value is a Template instance
Blaze.isTemplate(value: unknown): boolean;

// Get the currently executing view
Blaze.currentView: View | null;
```
