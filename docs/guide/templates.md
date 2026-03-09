# Templates

Templates are the building blocks of Blaze-NG applications. They define reactive HTML that automatically updates when data changes.

## Defining Templates

Templates are defined in `.html` files using the `<template>` tag:

```handlebars
<template name='myComponent'>
  <div class='component'>
    <h2>{{title}}</h2>
    <p>{{description}}</p>
  </div>
</template>
```

The `name` attribute must be unique across your application. It becomes the key you use to reference the template in JavaScript.

## Accessing Templates

In JavaScript/TypeScript, templates are available on the `Template` object:

```ts
import { Template } from '@blaze-ng/core';

// Access by name
const myTemplate = Template.myComponent;

// Check if a template exists
if (Template.myComponent) {
  // ...
}
```

## Template Data Context

Every template has a **data context** — an object that provides the default values for `{{expressions}}`:

```handlebars
<template name='userCard'>
  <div class='card'>
    <h3>{{name}}</h3>
    <p>{{email}}</p>
    <span class='role'>{{role}}</span>
  </div>
</template>
```

```ts
// Render with a data context
Blaze.renderWithData(
  Template.userCard,
  {
    name: 'Jane Doe',
    email: 'jane@example.com',
    role: 'Admin',
  },
  container,
);
```

Or via inclusion in another template:

```handlebars
<template name="userList">
  {{#each users}}
    {{> userCard}}  {{!-- each item becomes the data context --}}
  {{/each}}
</template>
```

## Template Composition

### Simple Inclusion

Include one template inside another:

```handlebars
<template name="page">
  {{> header}}
  <main>
    {{> content}}
  </main>
  {{> footer}}
</template>
```

### Inclusion with Arguments

Pass data to included templates:

```handlebars
<template name="page">
  {{> header title="My App" showNav=true}}
  {{> userCard user=currentUser}}
</template>
```

### Dynamic Templates

Render different templates based on reactive data:

```handlebars
<template name="layout">
  {{> Template.dynamic template=currentPage}}
</template>
```

```ts
Template.layout.helpers({
  currentPage() {
    return Router.current().template;
  },
});
```

Or use a helper that returns a template:

```handlebars
<template name="layout">
  {{> pageTemplate}}
</template>
```

```ts
Template.layout.helpers({
  pageTemplate() {
    const page = Session.get('currentPage');
    return Template[page] || Template.notFound;
  },
});
```

## Template Body

The `<body>` section in your HTML is a special template:

```html
<!-- client/main.html -->
<head>
  <title>My App</title>
</head>

<body>
  <div id="app">{{> App}}</div>
</body>
```

## Block Content

Templates can accept block content using `Template.contentBlock`:

```handlebars
<template name="card">
  <div class="card {{class}}">
    <div class="card-header">{{title}}</div>
    <div class="card-body">
      {{> Template.contentBlock}}
    </div>
  </div>
</template>
```

Use it as a block helper:

```handlebars
{{#card title='Settings' class='primary'}}
  <p>Card content goes here.</p>
  <button>Save</button>
{{/card}}
```

With else blocks:

```handlebars
<template name="ifLoaded">
  {{#if isReady}}
    {{> Template.contentBlock}}
  {{else}}
    {{> Template.elseBlock}}
  {{/if}}
</template>
```

```handlebars
{{#ifLoaded}}
  <p>Data is ready!</p>
{{else}}
  <p>Loading...</p>
{{/ifLoaded}}
```

## toHTML — Server-Side Rendering

Render any template to an HTML string:

```ts
// Simple
const html = Blaze.toHTML(Template.myPage);

// With data
const html = Blaze.toHTMLWithData(Template.myPage, {
  title: 'Hello',
  items: [1, 2, 3],
});
```

This works perfectly for SSR, email templates, or PDF generation.

## Best Practices

### Keep Templates Small

Each template should represent a single, focused piece of UI. If a template file exceeds 50 lines, consider splitting it.

### Use Naming Conventions

```
Header.html     → Template.Header
todoItem.html   → Template.todoItem
adminDashboard  → Template.adminDashboard
```

### Co-locate Files

Keep template, helpers, events, and styles together:

```
components/
  TodoItem/
    TodoItem.html
    TodoItem.ts
    TodoItem.css
```
