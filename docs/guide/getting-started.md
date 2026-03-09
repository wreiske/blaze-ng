# Getting Started

## Installation

### With Meteor

```bash
# Remove the old Blaze packages
meteor remove blaze-html-templates

# Install Blaze-NG
meteor add wreiske:blaze-ng-html-templates
```

That's it! Your existing `.html` templates and `.js` helpers continue to work unchanged.

### With npm (standalone)

```bash
npm install @blaze-ng/core @blaze-ng/spacebars @blaze-ng/templating-runtime
```

Or install everything at once:

```bash
npm install @blaze-ng/html-templates
```

## Your First Template

### 1. Define the Template

```handlebars
<template name='greeting'>
  <div class='greeting'>
    <h1>Hello, {{name}}!</h1>
    <p>Welcome to Blaze-NG.</p>
  </div>
</template>
```

### 2. Add Helpers

Helpers are functions that provide data to your templates:

```ts
import { Template } from '@blaze-ng/core';

Template.greeting.helpers({
  name() {
    return 'World';
  },
});
```

### 3. Render It

```ts
import { Blaze } from '@blaze-ng/core';

// Render to an element
Blaze.render(Template.greeting, document.getElementById('app'));

// Or render with data
Blaze.renderWithData(Template.greeting, { name: 'Developer' }, document.getElementById('app'));
```

## Adding Reactivity

The magic of Blaze is that templates **automatically re-render** when data changes:

```handlebars
<template name='counter'>
  <div>
    <p>Count: {{count}}</p>
    <button>Click me!</button>
  </div>
</template>
```

```ts
Template.counter.onCreated(function () {
  // Create a reactive variable
  this.count = new ReactiveVar(0);
});

Template.counter.helpers({
  count() {
    // Reading the reactive var creates a dependency
    return Template.instance().count.get();
  },
});

Template.counter.events({
  'click button'(event, instance) {
    // Setting the reactive var triggers a re-render
    instance.count.set(instance.count.get() + 1);
  },
});
```

When you click the button, only the `{{count}}` text updates — the rest of the DOM stays untouched. This is Blaze's fine-grained reactivity in action.

## Setting Up a Reactive System

Blaze-NG is framework-agnostic. You need to tell it which reactive system to use:

### With Meteor Tracker

```ts
import { Blaze } from '@blaze-ng/core';
import { createTrackerAdapter } from '@blaze-ng/meteor';

// This is done automatically when using the Meteor package
Blaze.setReactiveSystem(createTrackerAdapter(Tracker));
```

### Without Meteor

```ts
import { Blaze } from '@blaze-ng/core';
import { SimpleReactiveSystem } from '@blaze-ng/core/testing';

// Use the built-in simple reactive system
Blaze.setReactiveSystem(new SimpleReactiveSystem());
```

## Project Structure

A typical Blaze-NG Meteor project looks like this:

```
my-app/
├── client/
│   ├── main.html          ← Contains <head> and <body>
│   ├── main.js            ← Client entry point
│   └── styles.css
├── imports/
│   └── ui/
│       ├── App.html       ← Root template
│       ├── App.js
│       ├── components/
│       │   ├── Header.html
│       │   ├── Header.js
│       │   ├── TodoItem.html
│       │   └── TodoItem.js
│       └── pages/
│           ├── Home.html
│           └── Home.js
├── server/
│   └── main.js
└── package.json
```

## Next Steps

- [Templates](/guide/templates) — Learn the template system in depth
- [Helpers](/guide/helpers) — Data computation and formatting
- [Events](/guide/events) — Handling user interactions
- [Reactivity](/guide/reactivity) — Understanding reactive updates
- [Examples](/examples/) — Full working example apps
