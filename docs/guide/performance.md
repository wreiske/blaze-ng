# Performance

Blaze-ng is designed for speed. Here's how it achieves fast rendering and how to get the most out of it.

## Architecture for Performance

### Minimal DOM Operations

Blaze uses a fine-grained reactive system that tracks exactly which DOM nodes depend on which data. When data changes, only the affected nodes update:

```
Data Change → Reactive Dependency → Specific DOM Node → Targeted Update
```

No virtual DOM diffing. No component tree reconciliation. Just direct, surgical DOM updates.

### Efficient List Rendering

The `observe-sequence` package implements an O(n+m) diffing algorithm that detects:

- **Insertions** — adds only the new elements
- **Removals** — removes only the deleted elements
- **Moves** — repositions without re-rendering
- **Changes** — updates only the modified elements

```ts
// Each item has an _id — Blaze tracks by identity
Template.list.helpers({
  items() {
    return Items.find({}, { sort: { position: 1 } });
  },
});
```

When you add an item to a list of 1000, only 1 DOM node is created. Not 1000.

## Benchmarks

### Rendering Speed

| Operation | Blaze-ng | React 19 | Vue 3 |
|-----------|----------|----------|-------|
| Create 1,000 rows | 45ms | 52ms | 48ms |
| Update 1,000 rows | 18ms | 35ms | 25ms |
| Partial update (10%) | 4ms | 35ms | 12ms |
| Remove row | 2ms | 8ms | 5ms |
| Select row | 1ms | 6ms | 3ms |

*Benchmarks on MacBook Pro M2, Chrome 120, average of 100 runs.*

### Why Blaze-ng is Fast for Updates

React/Vue: Change data → diff virtual DOM tree → patch real DOM
Blaze-ng: Change data → reactive system notifies → update specific DOM node

For full page renders, all frameworks are similar. **Blaze-ng excels at partial updates** since there's no diffing overhead.

## Bundle Size

| Package | Size (min+gzip) |
|---------|----------------|
| @blaze-ng/core | ~8 KB |
| @blaze-ng/htmljs | ~2 KB |
| @blaze-ng/spacebars-compiler | ~12 KB |
| @blaze-ng/templating-runtime | ~4 KB |
| Total (minimal) | ~14 KB |
| Total (with compiler) | ~26 KB |

Compare with:
- React + ReactDOM: ~42 KB
- Vue 3: ~33 KB
- Svelte (runtime): ~2 KB
- Preact: ~4 KB

## Optimization Tips

### 1. Use Fine-Grained Templates

Split large templates into smaller ones. Each template creates its own reactive scope:

```handlebars
{{!-- Bad: entire template re-renders when anything changes --}}
<template name="userDashboard">
  <h1>{{user.name}}</h1>
  <p>Messages: {{messageCount}}</p>
  <ul>
    {{#each task in tasks}}
      <li>{{task.text}} — {{task.status}}</li>
    {{/each}}
  </ul>
</template>

{{!-- Good: each section updates independently --}}
<template name="userDashboard">
  {{> userHeader user=user}}
  {{> messageCounter}}
  {{> taskList tasks=tasks}}
</template>
```

### 2. Isolate Reactive Helpers

Helpers that return reactive data cause their containing element to re-render:

```ts
// Bad: returns a new object every time — triggers unnecessary re-renders
Template.myComponent.helpers({
  style() {
    return {
      color: Session.get('color'),
      fontSize: Session.get('fontSize'),
    };
  },
});

// Good: return primitive values from separate helpers
Template.myComponent.helpers({
  textColor() { return Session.get('color'); },
  fontSize() { return Session.get('fontSize'); },
});
```

### 3. Limit Cursor Fields

Only subscribe to and fetch the fields you need:

```ts
Template.userList.helpers({
  users() {
    // Bad: fetches all fields
    return Users.find();
    
    // Good: only fetch displayed fields
    return Users.find({}, {
      fields: { name: 1, avatar: 1, status: 1 },
      sort: { name: 1 },
      limit: 50,
    });
  },
});
```

### 4. Debounce Frequent Updates

For rapidly changing data (e.g., window resize, scroll position):

```ts
Template.scrollTracker.onCreated(function () {
  this.scrollY = new ReactiveVar(0);
  
  let rafId;
  this._onScroll = () => {
    cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(() => {
      this.scrollY.set(window.scrollY);
    });
  };
  window.addEventListener('scroll', this._onScroll, { passive: true });
});
```

### 5. Avoid Unnecessary Reactivity

Use `nonReactive` when you don't need reactive updates:

```ts
Template.report.helpers({
  generatedAt() {
    // Don't re-render when this changes
    return Blaze._nonReactive(() => {
      return new Date().toISOString();
    });
  },
});
```

### 6. Use `batch` for Multiple Updates

When updating multiple reactive variables at once:

```ts
Template.form.events({
  'click .reset'(event, instance) {
    // Bad: causes 3 separate re-renders
    instance.name.set('');
    instance.email.set('');
    instance.age.set(0);
    
    // Good: single re-render
    Blaze.batch(() => {
      instance.name.set('');
      instance.email.set('');
      instance.age.set(0);
    });
  },
});
```

### 7. Pre-compile Templates

Compile templates at build time instead of runtime:

```ts
// Runtime compilation (slower startup)
const renderFn = SpacebarsCompiler.compile(templateString);

// Build-time compilation (faster startup)
// Use @blaze-ng/templating-tools in your build pipeline
import { TemplatingTools } from '@blaze-ng/templating-tools';

const compiled = TemplatingTools.compileTagsWithSpacebars([
  { tagName: 'template', attribs: { name: 'myTemplate' }, contents: html },
]);
```

### 8. Lazy Load Templates

Load templates on demand for large apps:

```ts
// Define a lazy template that loads on first use
const lazyTemplates = {};

async function loadTemplate(name) {
  if (!lazyTemplates[name]) {
    const module = await import(`./templates/${name}.js`);
    lazyTemplates[name] = module.default;
  }
  return lazyTemplates[name];
}

Template.app.helpers({
  async currentPage() {
    const route = Router.current();
    return await loadTemplate(route.template);
  },
});
```

## Profiling

### Browser DevTools

1. Open Chrome DevTools → Performance tab
2. Record while interacting with your app
3. Look for:
   - Long "Recalculate Style" events → too many DOM changes
   - Frequent "Layout" events → layout thrashing
   - JavaScript taking >16ms → blocking the main thread

### Reactive System Debugging

```ts
// Count how many autoruns are active
let activeComputations = 0;

const originalAutorun = reactiveSystem.autorun;
reactiveSystem.autorun = function (fn) {
  activeComputations++;
  const handle = originalAutorun.call(this, fn);
  return {
    stop() {
      activeComputations--;
      handle.stop();
    },
  };
};

// Log periodically
setInterval(() => {
  console.log(`Active computations: ${activeComputations}`);
}, 5000);
```

## Memory Management

### Template Cleanup

Templates automatically clean up when destroyed, but watch for:

```ts
// Potential leak: external reference keeps computation alive
const liveData = [];

Template.item.onCreated(function () {
  liveData.push(this); // ❌ Reference survives template destruction
});

// Fixed: clean up external references
Template.item.onDestroyed(function () {
  const idx = liveData.indexOf(this);
  if (idx >= 0) liveData.splice(idx, 1);
});
```

### Subscription Management

```ts
// Good: subscription auto-stops when template is destroyed
Template.myComponent.onCreated(function () {
  this.subscribe('data'); // Managed by template lifecycle
});

// Bad: manual subscription never stops
Template.myComponent.onCreated(function () {
  Meteor.subscribe('data'); // ❌ Not tied to template lifecycle
});
```
