# Migration from Blaze

This guide helps you migrate from the original Meteor Blaze to Blaze-ng.

## What Changes

Blaze-ng is a **TypeScript rewrite** of the original Blaze. The template syntax and API are the same — the main changes are in how you install and configure it.

### Same

- Spacebars template syntax (`{{#if}}`, `{{#each}}`, `{{> inclusion}}`, etc.)
- Template helpers, events, and lifecycle callbacks
- `Blaze.render`, `Blaze.toHTML`, `Blaze.renderWithData`
- `Template.instance()`, `Template.currentData()`
- View tree architecture
- DOM reactivity model

### Different

- **TypeScript** — full type safety
- **No Meteor dependency** — works outside Meteor
- **BYORS** — bring your own reactive system (no Tracker dependency)
- **ESM + CJS** — modern module format
- **Smaller bundle** — tree-shakeable packages
- **Faster** — optimized algorithms

## Step-by-Step Migration

### Step 1: Install Blaze-ng Packages

```bash
# Remove old Blaze packages
meteor remove blaze-html-templates
meteor remove templating

# Install Blaze-ng
meteor npm install @blaze-ng/blaze @blaze-ng/htmljs @blaze-ng/spacebars \
  @blaze-ng/spacebars-compiler @blaze-ng/templating-runtime \
  @blaze-ng/observe-sequence @blaze-ng/meteor
```

### Step 2: Configure Reactive System

Blaze-ng doesn't include Tracker by default. Use the Meteor adapter:

```ts
// imports/startup/client/blaze-setup.ts
import { Blaze } from '@blaze-ng/blaze';
import { MeteorAdapter } from '@blaze-ng/meteor';

Blaze.setReactiveSystem(MeteorAdapter.createReactiveSystem());
```

Import this file early in your client entry point:

```ts
// client/main.ts
import '../imports/startup/client/blaze-setup';
import '../imports/startup/client/routes';
```

### Step 3: Update Imports

```ts
// Before (Meteor globals)
Template.myTemplate.helpers({ ... });

// After (explicit imports)
import { Template } from '@blaze-ng/templating-runtime';

Template.myTemplate.helpers({ ... });
```

```ts
// Before
import { Blaze } from 'meteor/blaze';

// After
import { Blaze } from '@blaze-ng/blaze';
```

```ts
// Before
import { HTML } from 'meteor/htmljs';

// After
import { HTML } from '@blaze-ng/htmljs';
```

### Step 4: Template Files

**No changes needed!** Your `.html` template files work as-is:

```handlebars
<!-- This works exactly the same -->
<template name="taskItem">
  <li class="task {{#if checked}}checked{{/if}}">
    <input type="checkbox" checked={{checked}}>
    <span class="text">{{text}}</span>
    {{#if isOwner}}
      <button class="delete">&times;</button>
    {{/if}}
  </li>
</template>
```

### Step 5: Helpers and Events

**No changes needed** for most helpers and events:

```ts
// This code works identically in Blaze-ng
Template.taskItem.helpers({
  isOwner() {
    return this.owner === Meteor.userId();
  },
});

Template.taskItem.events({
  'click .delete'() {
    Meteor.call('tasks.remove', this._id);
  },
  'click input[type=checkbox]'() {
    Meteor.call('tasks.toggle', this._id);
  },
});
```

### Step 6: Lifecycle Callbacks

**No changes needed:**

```ts
Template.myComponent.onCreated(function () {
  this.subscribe('myData');
  this.state = new ReactiveVar('initial');
});

Template.myComponent.onRendered(function () {
  this.$('.datepicker').datepicker();
});

Template.myComponent.onDestroyed(function () {
  // Cleanup
});
```

### Step 7: Add TypeScript (Optional)

Rename `.js` files to `.ts` and add type annotations:

```ts
// Before: helpers.js
Template.taskList.helpers({
  tasks() {
    return Tasks.find({}, { sort: { createdAt: -1 } });
  },
});

// After: helpers.ts
import { Template } from '@blaze-ng/templating-runtime';
import { Tasks } from '../api/tasks';

Template.taskList.helpers({
  tasks(): Mongo.Cursor<Task> {
    return Tasks.find({}, { sort: { createdAt: -1 } });
  },
});
```

## API Compatibility Reference

### Fully Compatible

| API                                 | Status       |
| ----------------------------------- | ------------ |
| `Template.myTemplate.helpers()`     | ✅ Identical |
| `Template.myTemplate.events()`      | ✅ Identical |
| `Template.myTemplate.onCreated()`   | ✅ Identical |
| `Template.myTemplate.onRendered()`  | ✅ Identical |
| `Template.myTemplate.onDestroyed()` | ✅ Identical |
| `Template.instance()`               | ✅ Identical |
| `Template.currentData()`            | ✅ Identical |
| `Template.registerHelper()`         | ✅ Identical |
| `Blaze.render()`                    | ✅ Identical |
| `Blaze.renderWithData()`            | ✅ Identical |
| `Blaze.remove()`                    | ✅ Identical |
| `Blaze.toHTML()`                    | ✅ Identical |
| `Blaze.toHTMLWithData()`            | ✅ Identical |
| `Blaze.View`                        | ✅ Identical |
| `Blaze.currentView`                 | ✅ Identical |
| `Blaze.With()`                      | ✅ Identical |
| `Blaze.If()` / `Blaze.Unless()`     | ✅ Identical |
| `Blaze.Each()`                      | ✅ Identical |
| `Blaze.Let()`                       | ✅ Identical |
| `HTML.*` (all tag functions)        | ✅ Identical |
| `{{#if}}` / `{{#unless}}`           | ✅ Identical |
| `{{#each}}` / `{{#each in}}`        | ✅ Identical |
| `{{#with}}`                         | ✅ Identical |
| `{{#let}}`                          | ✅ Identical |
| `{{> inclusion}}`                   | ✅ Identical |
| `{{{raw}}}`                         | ✅ Identical |
| `{{! comments}}`                    | ✅ Identical |

### Requires Adapter

| API                    | Migration                                       |
| ---------------------- | ----------------------------------------------- |
| `Tracker.autorun()`    | Use `@blaze-ng/meteor` adapter                  |
| `ReactiveVar`          | Use `@blaze-ng/meteor` adapter or `createVar()` |
| `ReactiveDict`         | Use `@blaze-ng/meteor` adapter                  |
| `Mongo.Cursor` observe | Use `@blaze-ng/meteor` adapter                  |

### Deprecated / Removed

| API                     | Replacement                 |
| ----------------------- | --------------------------- |
| `Blaze._globalHelpers`  | `Template.registerHelper()` |
| `UI` namespace (legacy) | `Blaze` namespace           |
| `Blaze.isTemplate()`    | `instanceof Template`       |

## Common Migration Issues

### Issue: "No reactive system configured"

```
Error: No reactive system configured. Call Blaze.setReactiveSystem() first.
```

**Fix:** Set up the reactive system before any template code runs:

```ts
import { Blaze } from '@blaze-ng/blaze';
import { MeteorAdapter } from '@blaze-ng/meteor';

Blaze.setReactiveSystem(MeteorAdapter.createReactiveSystem());
```

### Issue: jQuery Methods

Original Blaze had `Template.instance().$()` for jQuery. In Blaze-ng, use native DOM:

```ts
// Before
Template.myComponent.onRendered(function () {
  this.$('.slider').slider({ min: 0, max: 100 });
});

// After
Template.myComponent.onRendered(function () {
  const el = this.find('.slider');
  new SliderLibrary(el, { min: 0, max: 100 });
});
```

### Issue: Global Template Access

```ts
// Before (Meteor global)
Template.myTemplate.helpers({ ... });

// After (explicit import)
import { Template } from '@blaze-ng/templating-runtime';
Template.myTemplate.helpers({ ... });
```

## Gradual Migration

You can migrate incrementally — Blaze-ng can coexist with original Blaze during migration:

1. Start with new features using Blaze-ng
2. Migrate one template at a time
3. Share helpers between old and new templates
4. Remove original Blaze when all templates are migrated

## Non-Meteor Migration

Using Blaze outside Meteor for the first time? See the [Getting Started](./getting-started.md) guide for npm-only setup.
