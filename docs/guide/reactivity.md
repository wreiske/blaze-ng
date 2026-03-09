# Reactivity

Reactivity is the core of Blaze. When data changes, the UI updates automatically — you never manually manipulate the DOM.

## How Reactivity Works

Blaze uses a **computation-based** reactive system:

1. When a template renders, each `{{expression}}` runs inside a **computation**
2. The computation tracks which **reactive data sources** are read
3. When a reactive source changes, the computation **re-runs**
4. Only the affected DOM nodes are updated

```
  ┌─────────────┐     reads     ┌──────────────┐
  │ Computation  │──────────────▶│ ReactiveVar  │
  │  ({{count}}) │              │  count = 5   │
  └──────┬───────┘              └──────┬───────┘
         │                             │
         │ re-runs when                │ .set(6)
         │ dependency changes          │
         ▼                             │
  ┌─────────────┐              ┌───────┴──────┐
  │  DOM update  │              │   User code  │
  │  "5" → "6"  │              │  or event    │
  └─────────────┘              └──────────────┘
```

## ReactiveVar

The most common reactive primitive:

```ts
import { ReactiveVar } from 'meteor/reactive-var';

const name = new ReactiveVar('Alice');

// Read (creates dependency in current computation)
name.get(); // 'Alice'

// Write (invalidates all dependent computations)
name.set('Bob');
```

### In Templates

```ts
Template.profile.onCreated(function () {
  this.name = new ReactiveVar('Alice');
  this.age = new ReactiveVar(30);
});

Template.profile.helpers({
  name() { return Template.instance().name.get(); },
  age() { return Template.instance().age.get(); },
  isAdult() { return Template.instance().age.get() >= 18; },
});
```

```handlebars
<template name="profile">
  <p>Name: {{name}}, Age: {{age}}</p>
  {{#if isAdult}}<span>Adult</span>{{/if}}
</template>
```

## Autorun

Run code automatically whenever its dependencies change:

```ts
Template.dashboard.onCreated(function () {
  this.filter = new ReactiveVar('all');
  
  // Re-runs whenever filter changes
  this.autorun(() => {
    const filter = this.filter.get();
    console.log('Filter changed to:', filter);
    
    // Subscribe to new data
    this.subscribe('todos', { filter });
  });
});
```

## Reactive Computations in Helpers

Helpers are automatically reactive — they re-run when any reactive source they read changes:

```ts
Template.stats.helpers({
  // Re-runs whenever the Todos collection changes
  completedCount() {
    return Todos.find({ completed: true }).count();
  },
  
  // Re-runs whenever completedCount or totalCount changes  
  completionRate() {
    const total = Todos.find().count();
    const completed = Todos.find({ completed: true }).count();
    return total > 0 ? Math.round((completed / total) * 100) : 0;
  },
});
```

## Fine-Grained Updates

Blaze only updates the exact DOM nodes that need to change:

```handlebars
<template name="userProfile">
  <div class="header">
    <h1>{{name}}</h1>             {{!-- Only this text updates --}}
    <img src="{{avatarUrl}}">     {{!-- Only this attribute updates --}}
  </div>
  <div class="stats">
    <span>Posts: {{postCount}}</span>  {{!-- Independent update --}}
    <span>Likes: {{likeCount}}</span>  {{!-- Independent update --}}
  </div>
</template>
```

When `name` changes, only the text inside `<h1>` is replaced. The `<img>`, `.stats`, and everything else stays untouched. This is why Blaze is so efficient — no virtual DOM diffing needed.

## Non-Reactive Reads

Sometimes you want to read a reactive source without creating a dependency:

```ts
import { Blaze } from '@blaze-ng/core';

Template.myComponent.helpers({
  initialValue() {
    // Read without tracking — won't re-run when value changes
    return Blaze.nonReactive(() => {
      return Session.get('initialConfig');
    });
  },
});
```

## Custom Reactive Systems

Blaze-NG is **framework-agnostic**. You can use any reactive system:

### Built-in SimpleReactiveSystem

For non-Meteor apps or testing:

```ts
import { Blaze, SimpleReactiveSystem } from '@blaze-ng/core';

const reactive = new SimpleReactiveSystem();
Blaze.setReactiveSystem(reactive);

// Create reactive variables
const name = reactive.ReactiveVar('Alice');

// Auto-run computations
reactive.autorun(() => {
  console.log('Name is:', name.get());
});

name.set('Bob'); // logs: "Name is: Bob"
reactive.flush(); // Process pending updates
```

### Meteor Tracker Adapter

```ts
import { createTrackerAdapter } from '@blaze-ng/meteor';

Blaze.setReactiveSystem(createTrackerAdapter(Tracker));
```

### Implement Your Own

```ts
Blaze.setReactiveSystem({
  autorun(fn) {
    // Run fn, track dependencies, re-run when they change
    // Return a computation handle with { stop() }
  },
  
  nonReactive(fn) {
    // Run fn without tracking
    return fn();
  },
  
  ReactiveVar(initialValue) {
    // Return { get(), set(value) }
    let value = initialValue;
    const listeners = new Set();
    return {
      get() { /* track dependency, return value */ },
      set(newValue) { /* update value, notify listeners */ },
    };
  },
});
```

## Reactive Patterns

### Derived State

```ts
Template.cart.onCreated(function () {
  this.items = new ReactiveVar([]);
});

Template.cart.helpers({
  items() {
    return Template.instance().items.get();
  },
  
  // Computed from items — automatically updates
  totalPrice() {
    const items = Template.instance().items.get();
    return items.reduce((sum, item) => sum + item.price * item.qty, 0);
  },
  
  itemCount() {
    return Template.instance().items.get().length;
  },
  
  isEmpty() {
    return Template.instance().items.get().length === 0;
  },
});
```

### Debounced Search

```ts
Template.search.onCreated(function () {
  this.query = new ReactiveVar('');
  this.results = new ReactiveVar([]);
  
  let timeout;
  this.autorun(() => {
    const query = this.query.get();
    clearTimeout(timeout);
    
    if (query.length < 2) {
      this.results.set([]);
      return;
    }
    
    // Debounce: wait 300ms after last keystroke
    timeout = setTimeout(() => {
      Meteor.call('search', query, (err, results) => {
        if (!err) this.results.set(results);
      });
    }, 300);
  });
});
```

### Loading States

```ts
Template.dataView.onCreated(function () {
  this.isLoading = new ReactiveVar(true);
  
  this.autorun(() => {
    const handle = this.subscribe('myData');
    this.isLoading.set(!handle.ready());
  });
});
```

```handlebars
<template name="dataView">
  {{#if isLoading}}
    <div class="spinner">Loading...</div>
  {{else}}
    {{#each items}}
      <div class="item">{{name}}</div>
    {{/each}}
  {{/if}}
</template>
```
