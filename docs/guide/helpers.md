# Helpers

Helpers are functions that provide data and computed values to your templates. They are the bridge between your data layer and your UI.

## Defining Helpers

Register helpers on a specific template:

```ts
Template.myComponent.helpers({
  greeting() {
    return 'Hello, World!';
  },
  
  formattedDate() {
    return new Date().toLocaleDateString();
  },
});
```

Use them in your template:

```handlebars
<template name="myComponent">
  <p>{{greeting}}</p>
  <p>Today is {{formattedDate}}</p>
</template>
```

## Helpers with Arguments

Helpers can accept arguments:

```ts
Template.myComponent.helpers({
  add(a, b) {
    return a + b;
  },
  
  formatCurrency(amount, currency = 'USD') {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
    }).format(amount);
  },
  
  truncate(text, maxLength) {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength) + '...';
  },
});
```

```handlebars
<p>Total: {{add 5 3}}</p>
<p>Price: {{formatCurrency price "EUR"}}</p>
<p>{{truncate description 100}}</p>
```

## Keyword Arguments

Pass named arguments using `key=value` syntax:

```handlebars
{{formatDate date format="YYYY-MM-DD" timezone="UTC"}}
```

```ts
Template.myComponent.helpers({
  formatDate(date, options) {
    const { format, timezone } = options.hash;
    // Use format and timezone...
  },
});
```

## Data Context Access

Inside a helper, `this` refers to the current **data context**:

```handlebars
<template name="userCard">
  {{fullName}}
</template>
```

```ts
Template.userCard.helpers({
  fullName() {
    // `this` is the data context (e.g., { firstName: 'Jane', lastName: 'Doe' })
    return `${this.firstName} ${this.lastName}`;
  },
});
```

```ts
// Render with data
Blaze.renderWithData(Template.userCard, {
  firstName: 'Jane',
  lastName: 'Doe',
}, container);
```

## Accessing the Template Instance

Use `Template.instance()` to access the template instance from a helper:

```ts
Template.counter.onCreated(function () {
  this.count = new ReactiveVar(0);
  this.step = new ReactiveVar(1);
});

Template.counter.helpers({
  count() {
    return Template.instance().count.get();
  },
  step() {
    return Template.instance().step.get();
  },
});
```

## Reactive Helpers

Helpers that read reactive data sources automatically re-run when the data changes:

```ts
Template.dashboard.helpers({
  // Re-runs whenever the 'todos' collection changes
  todoCount() {
    return Todos.find({ completed: false }).count();
  },
  
  // Re-runs whenever Session.get('theme') changes
  themeClass() {
    return Session.get('theme') === 'dark' ? 'dark-mode' : 'light-mode';
  },
  
  // Re-runs when the ReactiveVar changes
  searchResults() {
    const query = Template.instance().searchQuery.get();
    return Items.find({ name: { $regex: query, $options: 'i' } });
  },
});
```

## Global Helpers

Register helpers available in **every** template:

```ts
import { Blaze } from '@blaze-ng/core';

// Comparison helpers
Blaze.registerHelper('eq', (a, b) => a === b);
Blaze.registerHelper('neq', (a, b) => a !== b);
Blaze.registerHelper('gt', (a, b) => a > b);
Blaze.registerHelper('gte', (a, b) => a >= b);
Blaze.registerHelper('lt', (a, b) => a < b);
Blaze.registerHelper('lte', (a, b) => a <= b);

// Logical helpers
Blaze.registerHelper('and', (...args) => args.slice(0, -1).every(Boolean));
Blaze.registerHelper('or', (...args) => args.slice(0, -1).some(Boolean));
Blaze.registerHelper('not', (val) => !val);

// String helpers
Blaze.registerHelper('uppercase', (str) => String(str).toUpperCase());
Blaze.registerHelper('lowercase', (str) => String(str).toLowerCase());
Blaze.registerHelper('capitalize', (str) => {
  const s = String(str);
  return s.charAt(0).toUpperCase() + s.slice(1);
});

// Number helpers
Blaze.registerHelper('formatNumber', (num) => {
  return new Intl.NumberFormat().format(num);
});

// Date helpers
Blaze.registerHelper('timeAgo', (date) => {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
});
```

Use global helpers anywhere:

```handlebars
{{#if (eq status "active")}}
  <span class="badge">Active</span>
{{/if}}

{{#if (and isLoggedIn hasPermission)}}
  <button>Edit</button>
{{/if}}

<p>{{uppercase name}}</p>
<p>{{formatNumber totalSales}}</p>
<p>{{timeAgo createdAt}}</p>
```

## Nested Expressions

Use parentheses for **sub-expressions**:

```handlebars
{{#if (gt items.length 0)}}
  <p>You have {{items.length}} {{pluralize items.length "item"}}.</p>
{{/if}}

{{#if (and (gt score 90) (eq grade "A"))}}
  <span class="excellent">Excellent!</span>
{{/if}}

{{formatCurrency (multiply price quantity) "USD"}}
```

## Helper vs. Data Context

When Blaze encounters `{{foo}}`, it checks in this order:

1. **Template helpers** — registered via `Template.xxx.helpers()`
2. **Lexical scope** — `{{#let}}` and `{{#each item in list}}` bindings
3. **Data context** — the current `this` object
4. **Global helpers** — registered via `Blaze.registerHelper()`

```handlebars
{{#let greeting="Hello"}}       {{!-- 1. Lexical scope --}}
  {{#with user}}                 {{!-- sets data context --}}
    {{greeting}}, {{name}}!      {{!-- greeting=lexical, name=data context --}}
    {{formatDate joinedAt}}      {{!-- formatDate=global helper, joinedAt=data --}}
  {{/with}}
{{/let}}
```

## Helpers That Return Templates

A helper can return a template for dynamic inclusion:

```ts
Template.dynamicPage.helpers({
  currentPage() {
    const page = Router.current().page;
    return Template[page] || Template.notFound;
  },
});
```

```handlebars
<template name="dynamicPage">
  {{> currentPage}}
</template>
```

## Best Practices

- **Keep helpers pure** — avoid side effects. Just compute and return.
- **Use `Template.instance()`** for accessing template state, not `this`.
- **Register global helpers** for common formatting (dates, numbers, strings).
- **Name clearly** — `formattedPrice` not `fp`, `isAdminUser` not `admin`.
