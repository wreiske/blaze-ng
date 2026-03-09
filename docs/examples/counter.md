# Example: Counter

The simplest possible Blaze-ng app — a reactive counter.

## Template

```handlebars
<template name="counter">
  <div class="counter">
    <h1>{{count}}</h1>
    <div class="buttons">
      <button class="decrement" {{#if isZero}}disabled{{/if}}>−</button>
      <button class="reset">Reset</button>
      <button class="increment">+</button>
    </div>
    <p class="label">
      {{#if isZero}}
        Click + to start counting
      {{else}}
        Clicked {{count}} {{pluralize count "time" "times"}}
      {{/if}}
    </p>
  </div>
</template>
```

## JavaScript

```ts
import { Template } from '@blaze-ng/templating-runtime';
import { Blaze } from '@blaze-ng/core';
import { SimpleReactiveSystem } from '@blaze-ng/core/testing';

Blaze.setReactiveSystem(new SimpleReactiveSystem());

Template.counter.onCreated(function () {
  this.count = new ReactiveVar(0);
});

Template.counter.helpers({
  count() {
    return Template.instance().count.get();
  },
  isZero() {
    return Template.instance().count.get() === 0;
  },
});

Template.counter.events({
  'click .increment'(event, instance) {
    instance.count.set(instance.count.get() + 1);
  },
  'click .decrement'(event, instance) {
    const current = instance.count.get();
    if (current > 0) instance.count.set(current - 1);
  },
  'click .reset'(event, instance) {
    instance.count.set(0);
  },
});

Template.registerHelper('pluralize', (count, singular, plural) =>
  count === 1 ? singular : plural,
);

Blaze.render(Template.counter, document.getElementById('app'));
```

## Styles

```css
.counter {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  padding: 3rem;
  font-family: system-ui, sans-serif;
}

.counter h1 {
  font-size: 6rem;
  font-weight: 200;
  margin: 0;
  font-variant-numeric: tabular-nums;
}

.buttons {
  display: flex;
  gap: 0.5rem;
}

.buttons button {
  width: 3rem;
  height: 3rem;
  border: 2px solid #e2e8f0;
  border-radius: 50%;
  background: white;
  font-size: 1.25rem;
  cursor: pointer;
  transition: all 0.15s;
}

.buttons button:hover:not(:disabled) {
  border-color: #4f46e5;
  color: #4f46e5;
}

.buttons button:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.buttons .reset {
  width: auto;
  border-radius: 1.5rem;
  padding: 0 1rem;
  font-size: 0.875rem;
}

.label {
  color: #64748b;
}
```

## What This Demonstrates

- **`ReactiveVar`** — reactive state management
- **`Template.instance()`** — accessing instance state from helpers
- **Event handling** — click events with instance access
- **Conditional rendering** — `{{#if}}` for disabled state and labels
- **Global helpers** — `pluralize` registered once, used anywhere
