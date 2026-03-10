---
layout: home

hero:
  name: 'Blaze-NG'
  text: "Reactive Templating,\nRewritten in TypeScript"
  tagline: A modern, zero-dependency rewrite of Meteor Blaze — faster, smaller, fully typed.
  actions:
    - theme: brand
      text: Try it Live →
      link: /playground
    - theme: brand
      text: Get Started
      link: /guide/getting-started
    - theme: alt
      text: View on GitHub
      link: https://github.com/wreiske/blaze-ng

features:
  - icon: 🚀
    title: Zero Dependencies
    details: No jQuery, no lodash, no uglify-js. Pure native DOM APIs with zero runtime deps.
  - icon: 🔒
    title: Full TypeScript
    details: Strict TypeScript from the ground up. Every API is fully typed with rich IntelliSense.
  - icon: ⚡
    title: 10K+ Reactive Updates/sec
    details: Single text update in 0.10ms. 100 batched updates in 0.08ms. Native classList, style.setProperty, addEventListener.
  - icon: 🔌
    title: Framework Agnostic
    details: Bring your own reactive system. Works with Meteor Tracker, signals, or any custom system.
  - icon: 🎯
    title: 100% API Compatible
    details: Drop-in replacement for Blaze. Your existing templates, helpers, and events just work.
  - icon: 🧪
    title: 490 Tests, 34 Benchmarks
    details: Extensively tested with Vitest. Every original Blaze test ported and passing. Full benchmark suite included.
---

<style>
:root {
  --vp-home-hero-name-color: transparent;
  --vp-home-hero-name-background: -webkit-linear-gradient(120deg, #e25822 30%, #ff8c42);
  --vp-home-hero-image-background-image: linear-gradient(-45deg, #e25822aa 50%, #ff8c42aa 50%);
  --vp-home-hero-image-filter: blur(44px);
}
</style>

<script setup>
import BlazePlayground from './.vitepress/theme/components/BlazePlayground.vue';
</script>

## See it in Action

Edit the code below and watch Blaze-NG render in real time — no build step, no server, pure client-side:

<BlazePlayground mini preset="counter" height="480px" />

## Comparison

<div class="comparison-table">

| Feature           | Original Blaze              | Blaze-NG                      |
| ----------------- | --------------------------- | ----------------------------- |
| Language          | JavaScript (ES5)            | **TypeScript (strict)**       |
| Dependencies      | jQuery + lodash + uglify-js | **Zero**                      |
| Bundle size       | ~25KB gzip                  | **29 KB gzip** (core runtime) |
| DOM manipulation  | jQuery wrappers             | **Native APIs**               |
| Reactivity        | Tracker only                | **Any reactive system**       |
| Module format     | Meteor packages             | **ESM + CJS**                 |
| Testing           | Tinytest                    | **Vitest (490 tests)**        |
| SSR               | Limited                     | **Full support**              |
| WASM acceleration | None                        | **Optional**                  |

</div>

## Performance at a Glance

Real numbers from the [benchmark suite](/guide/performance):

<div class="benchmark-highlights">

| Category            | Highlight              |     ops/sec |
| ------------------- | ---------------------- | ----------: |
| **First Render**    | Static div → DOM       |  **10,151** |
| **Reactive Update** | Single text change     |  **10,220** |
| **Batched Updates** | 100 updates, 1 flush   |  **12,022** |
| **Attribute**       | Style property update  |  **11,714** |
| **List**            | Create 100 rows        |     **660** |
| **Lifecycle**       | Create + destroy cycle |  **10,001** |
| **Compilation**     | Simple template → JS   | **117,950** |
| **Diff**            | Shuffle 100 items      | **129,568** |

</div>

Run benchmarks yourself:

```bash
pnpm bench:run      # Full benchmark suite (34 suites)
pnpm bench:compare  # Old vs New head-to-head comparison
pnpm bundle-size    # Bundle size analysis
```

See the full [Performance & Benchmarks](/guide/performance) page for all results, including [head-to-head comparisons with original Blaze](/guide/performance#old-vs-new-head-to-head-comparison).
