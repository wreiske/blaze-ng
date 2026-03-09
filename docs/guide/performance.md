# Performance

Blaze-NG is designed for speed. Here's how it achieves fast rendering, the real benchmark numbers, and how to get the most out of it.

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

## Benchmark Results

All benchmarks run with [Vitest bench](https://vitest.dev/guide/features.html#benchmarking) (tinybench) in a JSDOM environment. Run them yourself with:

```bash
pnpm bench:run
```

### First Render

How fast templates go from source → DOM:

| Operation                    |    ops/sec |    Mean |
| ---------------------------- | ---------: | ------: |
| Static div                   | **10,151** | 0.10 ms |
| Div with interpolation       | **10,504** | 0.10 ms |
| Div with multiple attrs      |  **6,719** | 0.15 ms |
| Card component (10 elements) |  **2,381** | 0.42 ms |
| 10-item list                 |  **2,948** | 0.34 ms |
| 100-item list                |    **372** | 2.69 ms |
| 1,000-item list              |     **50** | 20.1 ms |
| 1,000 items × 3 columns      |     **18** | 55.9 ms |
| 3-level template nesting     |  **3,335** | 0.30 ms |

### Reactive Updates

How fast data changes propagate to the DOM:

| Operation                 |    ops/sec |    Mean |
| ------------------------- | ---------: | ------: |
| Single text update        | **10,220** | 0.10 ms |
| 3 values + flush          |  **8,201** | 0.12 ms |
| `#if` toggle              |  **4,616** | 0.22 ms |
| Nested dep (outer)        |  **7,495** | 0.13 ms |
| Nested dep (inner)        |  **7,317** | 0.14 ms |
| Nested dep (both)         |  **6,901** | 0.14 ms |
| 10 updates, single flush  | **12,189** | 0.08 ms |
| 100 updates, single flush | **12,022** | 0.08 ms |

::: tip Batched flushes are free
Note that 100 sequential `ReactiveVar.set()` calls followed by a single `flush()` is just as fast as 10 — the reactive system coalesces updates automatically.
:::

### Attribute Updates

| Operation                    |    ops/sec |    Mean |
| ---------------------------- | ---------: | ------: |
| Class toggle                 |  **7,345** | 0.14 ms |
| Style color update           | **11,714** | 0.09 ms |
| Data attribute update        | **11,474** | 0.09 ms |
| 3 attributes + flush         |  **6,758** | 0.15 ms |
| Toggle class on 100 elements |    **131** | 7.61 ms |

### List Operations (Each)

| Operation             |   ops/sec |    Mean |
| --------------------- | --------: | ------: |
| Create 50 rows        | **1,092** | 0.92 ms |
| Create 100 rows       |   **660** | 1.52 ms |
| Append 1 row to 100   |   **532** | 1.88 ms |
| Append 10 rows to 100 |   **234** | 4.28 ms |
| Prepend 1 row to 100  |   **502** | 1.99 ms |
| Remove 1 from 100     |   **427** | 2.34 ms |
| Remove all 100 rows   |   **268** | 3.73 ms |
| Swap 2 rows in 100    |   **314** | 3.19 ms |
| Update every 10th row |   **343** | 2.92 ms |
| Reverse 100 rows      |   **114** | 8.80 ms |

### Template Lifecycle

| Operation                                |    ops/sec |    Mean |
| ---------------------------------------- | ---------: | ------: |
| Simple create/destroy                    | **10,001** | 0.10 ms |
| With helpers                             | **10,139** | 0.10 ms |
| 2-level nesting                          |  **5,628** | 0.18 ms |
| 3-level nesting                          |  **3,990** | 0.25 ms |
| 0 callbacks                              | **11,657** | 0.09 ms |
| 3 callbacks (created+rendered+destroyed) | **11,758** | 0.09 ms |
| 5 onCreated callbacks                    | **11,686** | 0.09 ms |
| 10 create/destroy cycles                 |  **4,561** | 0.22 ms |
| 50 create/destroy cycles                 |  **1,257** | 0.80 ms |

::: info Lifecycle callbacks are essentially free
Adding `onCreated`, `onRendered`, and `onDestroyed` callbacks adds no measurable overhead to the create/destroy cycle.
:::

### Compilation Speed

| Operation                |     ops/sec |     Mean |
| ------------------------ | ----------: | -------: |
| Simple template          | **117,950** | 0.008 ms |
| Medium (if/each/helpers) |   **5,867** |  0.17 ms |
| Complex (nested blocks)  |   **1,788** |  0.56 ms |
| 50 static rows           |     **558** |  1.79 ms |
| 200 static rows          |      **77** |  13.1 ms |

### Sequence Diffing

The `observe-sequence` diff algorithm:

| Operation                     |     ops/sec |     Mean |
| ----------------------------- | ----------: | -------: |
| 100 identical items (no-op)   | **134,876** | 0.007 ms |
| 1,000 identical items (no-op) |  **14,341** |  0.07 ms |
| 5,000 identical items (no-op) |   **2,270** |  0.44 ms |
| Append 10 → 100               | **119,667** | 0.008 ms |
| Append 100 → 1,000            |  **12,611** |  0.08 ms |
| Shuffle 100 items             | **129,568** | 0.008 ms |
| Shuffle 1,000 items           |  **14,128** |  0.07 ms |
| Full replace 100              | **111,748** | 0.009 ms |
| Full replace 1,000            |   **7,766** |  0.13 ms |
| Mixed ops on 1,000            |  **13,404** |  0.07 ms |

### Why Blaze-NG Excels at Updates

```
React/Vue:   Change data → diff virtual DOM tree → patch real DOM
Blaze-NG:    Change data → reactive system notifies → update specific DOM node
```

For full page renders, all frameworks perform similarly. **Blaze-NG excels at partial updates** since there's no diffing overhead — changes go straight to the affected DOM nodes.

## Bundle Size

Actual measured sizes (ESM, gzip level 9):

| Package                       |          Raw |        Gzip |
| ----------------------------- | -----------: | ----------: |
| @blaze-ng/core                |      86.5 KB |     19.6 KB |
| @blaze-ng/htmljs              |      15.6 KB |      4.3 KB |
| @blaze-ng/spacebars           |       5.2 KB |      1.7 KB |
| @blaze-ng/observe-sequence    |      12.3 KB |      3.4 KB |
| @blaze-ng/spacebars-compiler  |      36.7 KB |      8.8 KB |
| @blaze-ng/templating-runtime  |       6.2 KB |      1.8 KB |
| @blaze-ng/templating-compiler |       0.4 KB |      0.2 KB |
| **Core runtime total**        | **119.5 KB** | **29.0 KB** |
| All packages total            |     361.3 KB |     81.6 KB |

Run `pnpm bundle-size` to measure yourself.

::: info Zero runtime dependencies
Blaze-NG has **zero** runtime dependencies. No jQuery, no lodash, no uglify-js. Every byte in the bundle is Blaze-NG code.
:::

## Old vs New: Head-to-Head Comparison

These benchmarks run _identical operations_ through both the original Meteor Blaze engine and Blaze-NG, side by side in the same Vitest bench suite. Run them yourself:

```bash
pnpm bench:compare
```

### Compilation Speed (Template → JS Code)

::: v-pre

| Template                              | Original Blaze |     Blaze-NG |             Ratio |
| ------------------------------------- | -------------: | -----------: | ----------------: |
| Simple (`<div>{{name}}</div>`)        |   244K ops/sec | 122K ops/sec | **Original 2.0×** |
| Medium (if/each/helpers)              |    13K ops/sec | 6.4K ops/sec | **Original 2.0×** |
| Complex (nested blocks, unless, with) |   3.9K ops/sec | 1.8K ops/sec | **Original 2.2×** |
| Large (50-row table)                  |   1.2K ops/sec |  550 ops/sec | **Original 2.2×** |

:::

::: tip Compilation happens once
Template compilation typically runs at build time or once at startup. Even the "slower" Blaze-NG compiler compiles a complex template in **0.55 ms** — imperceptible to users. Runtime performance matters far more.
:::

### Parsing Speed (Template → AST)

| Template                     | Original Blaze |      Blaze-NG |             Ratio |
| ---------------------------- | -------------: | ------------: | ----------------: |
| Simple                       |   603K ops/sec |  354K ops/sec | **Original 1.7×** |
| Medium                       |  21.5K ops/sec | 15.3K ops/sec | **Original 1.4×** |
| Complex                      |   9.1K ops/sec |  6.7K ops/sec | **Original 1.4×** |
| Pure HTML (no template tags) |  30.4K ops/sec | 30.7K ops/sec |          **Tied** |

::: info Parsing parity on pure HTML
When there are no Spacebars template tags, both parsers are equally fast — Blaze-NG's TypeScript parser matches the original's JavaScript parser byte-for-byte.
:::

### HTML Rendering (HTMLjs Tree → HTML String)

| Operation                           | Original Blaze |      Blaze-NG |        Ratio |
| ----------------------------------- | -------------: | ------------: | -----------: |
| Simple element                      |  2.39M ops/sec | 2.36M ops/sec |     **Tied** |
| Medium tree (nested)                |   386K ops/sec |  405K ops/sec | **NG 1.05×** |
| Large table (100 rows)              |   6.2K ops/sec |  6.3K ops/sec | **NG 1.03×** |
| Deeply nested (50 levels)           |  57.9K ops/sec | 57.5K ops/sec |     **Tied** |
| **Build + render medium**           |   293K ops/sec |  310K ops/sec | **NG 1.06×** |
| **Build + render large (100 rows)** |   4.0K ops/sec |  4.5K ops/sec | **NG 1.13×** |

::: tip Blaze-NG wins where it matters
For the end-to-end path users actually experience — constructing an HTML tree and rendering it — Blaze-NG is **6–13% faster** than the original. And this is before Blaze-NG's advantage in reactive updates, which skip DOM diffing entirely.
:::

### Summary

| Layer                          | Overall Result                                                         |
| ------------------------------ | ---------------------------------------------------------------------- |
| **Compilation** (build-time)   | Original Blaze ~2× faster (pure JS vs TypeScript)                      |
| **Parsing** (build-time)       | Original 1.4–1.7× faster; parity on pure HTML                          |
| **HTML Rendering** (runtime)   | **Blaze-NG** matches or beats Original by up to 13%                    |
| **Reactive Updates** (runtime) | **Blaze-NG** — zero-dependency reactive system with no jQuery overhead |
| **Bundle Size**                | **Blaze-NG 29 KB** gzip vs Original's jQuery + Tracker + lodash deps   |

## Internal Engine Optimizations

Under the hood, Blaze-NG's parser, compiler, and rendering pipeline apply several low-level optimizations that reduce memory allocations and CPU overhead on every operation.

### Zero-Allocation Regex Matching

The HTML scanner's `makeRegexMatcher` converts `^`-anchored regexes to the **sticky (`y`) flag**, matching directly against the input string at the current position. This eliminates a `rest()` substring allocation on every token match — a significant win since the parser calls regex matchers thousands of times per template.

### Direct Input Access

Hot-path functions in the tokenizer (`getComment`, `getDoctype`, `getTagToken`, `isLookingAtEndTag`) and character reference resolver access `scanner.input` with `charAt`/`startsWith`/`indexOf` at `scanner.pos` instead of calling `scanner.rest()`. This avoids creating intermediate substrings that would immediately become garbage.

### Inline Character Code Checks

HTML whitespace detection uses an inline `charCodeAt` comparison instead of a regex test:

```ts
const isHTMLSpace = (ch: string): boolean => {
  if (!ch) return false;
  const c = ch.charCodeAt(0);
  return c === 0x09 || c === 0x0a || c === 0x0c || c === 0x0d || c === 0x20;
};
```

This is called in tight loops (attribute parsing, tag scanning, doctype parsing) where regex overhead adds up.

### Singleton Visitors

The `toHTML()`, `toJS()`, and common `toText()` functions reuse pre-built singleton visitor instances instead of allocating a new one per call. Since `ToHTMLVisitor`, `ToJSVisitor`, and `ToTextVisitor` are stateless, a single instance is safe to share across all invocations.

### Array-Based String Building

The `_beautify` code formatter builds its output using an array of string parts joined at the end, avoiding O(n²) string concatenation. It tracks `lastChar` as a scalar rather than indexing into a growing string.

### Cached Indentation Strings

The beautifier pre-computes indentation strings (`'  '.repeat(level)`) for nesting levels 0–15, covering virtually all real-world templates without any runtime `repeat()` calls.

### Module-Level Regex Constants

Frequently used regex patterns (identifier validation in `tojs`, end-tag detection in `tokenize`) are compiled once at module load and reused across calls, avoiding repeated regex construction inside hot functions.

### Substring Slicing in Tokenizer

The beautifier's `tokenizeForBeautify` uses index tracking (`bufStart`) and `substring` slicing to extract text chunks, replacing character-by-character string concatenation with a single allocation per token.

## Optimization Tips

### 1. Use Fine-Grained Templates

Split large templates into smaller ones. Each template creates its own reactive scope:

::: v-pre

```handlebars
<!-- Bad: entire template re-renders when anything changes -->
<template name="userDashboard">
  <h1>{{user.name}}</h1>
  <p>Messages: {{messageCount}}</p>
  <ul>
    {{#each task in tasks}}
      <li>{{task.text}} — {{task.status}}</li>
    {{/each}}
  </ul>
</template>

<!-- Good: each section updates independently -->
<template name="userDashboard">
  {{> userHeader user=user}}
  {{> messageCounter}}
  {{> taskList tasks=tasks}}
</template>
```

:::

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
  textColor() {
    return Session.get('color');
  },
  fontSize() {
    return Session.get('fontSize');
  },
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
    return Users.find(
      {},
      {
        fields: { name: 1, avatar: 1, status: 1 },
        sort: { name: 1 },
        limit: 50,
      },
    );
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
