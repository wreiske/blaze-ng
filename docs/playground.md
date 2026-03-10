---
layout: page
title: Playground
---

<script setup>
import BlazePlayground from './.vitepress/theme/components/BlazePlayground.vue';
</script>

# Blaze Playground

Edit the **Template**, **JavaScript**, and **CSS** below to see Blaze-NG render in real time. Pick a preset from the dropdown to explore different features.

<BlazePlayground height="calc(100vh - 260px)" />

::: tip No build step needed
Blaze-NG compiles Spacebars templates to render functions entirely in the browser. What you see here runs 100% client-side — no server, no WebContainers, no WASM required.
:::

## What to try

- **Counter** — Reactive state with `ReactiveVar`, conditional `disabled` attribute, `{{#if}}` blocks
- **Conditionals** — Nested `{{#if}}` / `{{#unless}}` with a traffic light state machine
- **Each / Lists** — `{{#each item in items}}` with add, toggle, and remove operations
- **Dynamic Attributes** — Reactive inline styles, conditional classes, range inputs
- **Todo App** — Multi-feature app with filtering, events, and reactive list manipulation
- **Template Inclusion** — `{{> childTemplate data}}` pattern for composable UI components
