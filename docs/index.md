---
layout: home

hero:
  name: "Blaze-NG"
  text: "Reactive Templating,\nRewritten in TypeScript"
  tagline: A modern, zero-dependency rewrite of Meteor Blaze — faster, smaller, fully typed.
  actions:
    - theme: brand
      text: Get Started
      link: /guide/getting-started
    - theme: alt
      text: View on GitHub
      link: https://github.com/wreiske/blaze-ng
    - theme: alt
      text: Examples
      link: /examples/

features:
  - icon: 🚀
    title: Zero Dependencies
    details: No jQuery, no lodash, no uglify-js. Pure native DOM APIs. Under 15KB gzipped.
  - icon: 🔒
    title: Full TypeScript
    details: Strict TypeScript from the ground up. Every API is fully typed with rich IntelliSense.
  - icon: ⚡
    title: 2-5x Faster Updates
    details: Native classList, style.setProperty, addEventListener. V8-optimized hidden classes.
  - icon: 🔌
    title: Framework Agnostic
    details: Bring your own reactive system. Works with Meteor Tracker, signals, or any custom system.
  - icon: 🎯
    title: 100% API Compatible
    details: Drop-in replacement for Blaze. Your existing templates, helpers, and events just work.
  - icon: 🧪
    title: 435+ Tests
    details: Extensively tested with Vitest. Every original Blaze test ported and passing.
---

<style>
:root {
  --vp-home-hero-name-color: transparent;
  --vp-home-hero-name-background: -webkit-linear-gradient(120deg, #e25822 30%, #ff8c42);
  --vp-home-hero-image-background-image: linear-gradient(-45deg, #e25822aa 50%, #ff8c42aa 50%);
  --vp-home-hero-image-filter: blur(44px);
}
</style>

## Quick Example

Here's what Blaze-NG looks like in action:

:::code-group

```handlebars [counter.html]
<template name="counter">
  <div class="counter">
    <h2>Count: {{count}}</h2>
    <button class="increment">+1</button>
    <button class="decrement">-1</button>
    <button class="reset">Reset</button>
  </div>
</template>
```

```ts [counter.ts]
import { Template } from '@blaze-ng/core';

Template.counter.onCreated(function () {
  this.count = new ReactiveVar(0);
});

Template.counter.helpers({
  count() {
    return Template.instance().count.get();
  },
});

Template.counter.events({
  'click .increment'(event, instance) {
    instance.count.set(instance.count.get() + 1);
  },
  'click .decrement'(event, instance) {
    instance.count.set(instance.count.get() - 1);
  },
  'click .reset'(event, instance) {
    instance.count.set(0);
  },
});
```

:::

## Comparison

<div class="comparison-table">

| Feature | Original Blaze | Blaze-NG |
|---------|---------------|----------|
| Language | JavaScript (ES5) | **TypeScript (strict)** |
| Dependencies | jQuery + lodash + uglify-js | **Zero** |
| Bundle size | ~25KB gzip | **<15KB gzip** |
| DOM manipulation | jQuery wrappers | **Native APIs** |
| Reactivity | Tracker only | **Any reactive system** |
| Module format | Meteor packages | **ESM + CJS** |
| Testing | Tinytest | **Vitest (435+ tests)** |
| SSR | Limited | **Full support** |
| WASM acceleration | None | **Optional** |

</div>
