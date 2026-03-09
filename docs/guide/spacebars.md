# Spacebars Syntax

Spacebars is the template language used by Blaze. It extends [Handlebars](https://handlebarsjs.com/) with reactivity and Blaze-specific features.

## Expressions

### Double Braces — `{{expression}}`

Inserts the value as **escaped text** (safe from XSS):

```handlebars
<p>Hello, {{name}}!</p>
<span>Count: {{getCount}}</span>
<div>{{formatDate createdAt}}</div>
```

If `name` is `<script>alert("xss")</script>`, it renders as the literal text, not HTML.

### Triple Braces — `{{{expression}}}`

Inserts raw HTML **without escaping**:

```handlebars
<div class='content'>{{{markdownToHtml body}}}</div>
<span class='icon'>{{{iconSvg name}}}</span>
```

::: warning
Only use triple braces with trusted content. Never use with user input.
:::

### Comments — `{{! comment}}`

```handlebars
{{! This is a comment — not rendered in output }}
{{! This is a block comment
     that spans multiple lines }}
```

## Paths

### Simple Paths

```handlebars
{{name}}
{{! current data context property }}
{{formatName}}
{{! helper function }}
```

### Dotted Paths

```handlebars
{{user.name}}
{{! nested property }}
{{user.address.city}}
{{! deeply nested }}
{{post.author.name}}
{{! chain of objects }}
```

### `this`

```handlebars
{{this}}
{{! the entire data context }}
{{this.name}}
{{!-- same as {{name}} --}}
```

Useful inside `{{#each}}` when iterating simple values:

```handlebars
{{#each tags}}
  <span class='tag'>{{this}}</span>
{{/each}}
```

### Parent Data Context — `../`

```handlebars
{{#each items}}
  {{!-- Access parent's title from inside each --}}
  <div>{{../title}} — {{name}}</div>

  {{#each subItems}}
    {{!-- Go up two levels --}}
    <span>{{../../title}} > {{../name}} > {{this}}</span>
  {{/each}}
{{/each}}
```

## Arguments

### Positional Arguments

```handlebars
{{formatDate createdAt 'YYYY-MM-DD'}}
{{truncate description 100}}
{{pluralize count 'item' 'items'}}
```

### Keyword Arguments

```handlebars
{{formatDate createdAt format="relative"}}
{{> userCard user=currentUser size="large" showAvatar=true}}
{{input type="email" placeholder="Enter email" required=true}}
```

### Mixed Arguments

```handlebars
{{formatNumber amount currency='USD' decimals=2}}
```

Arguments are passed to helpers as positional args, with keyword args as the last parameter's `hash`:

```ts
Template.registerHelper('formatNumber', function (value, options) {
  const { currency, decimals } = options.hash;
  return new Intl.NumberFormat('en-US', {
    style: currency ? 'currency' : 'decimal',
    currency,
    minimumFractionDigits: decimals,
  }).format(value);
});
```

## Block Helpers

### `{{#if}}`

```handlebars
{{#if isLoggedIn}}
  <p>Welcome back, {{username}}!</p>
{{else}}
  <p>Please <a href='/login'>log in</a>.</p>
{{/if}}
```

Falsy values: `false`, `null`, `undefined`, `0`, `""`, `[]` (empty array).

### `{{#unless}}`

The inverse of `{{#if}}`:

```handlebars
{{#unless hasPermission}}
  <div class='alert'>You don't have permission to view this.</div>
{{/unless}}
```

### `{{#each}}`

Iterate over arrays or cursors:

```handlebars
{{#each tasks}}
  <div class="task {{#if completed}}done{{/if}}">
    <span>{{text}}</span>
    <small>Created by {{author}}</small>
  </div>
{{else}}
  <p class="empty">No tasks yet. Add one above!</p>
{{/each}}
```

### `{{#each .. in ..}}`

Named iteration variable (avoids `../` confusion):

```handlebars
{{#each task in tasks}}
  <div class='task'>
    <span>{{task.text}}</span>
    <span>by {{task.author}}</span>
    {{! Can still access outer context directly }}
    <span>Project: {{projectName}}</span>
  </div>
{{/each}}
```

### `{{#with}}`

Change the data context:

```handlebars
{{#with selectedUser}}
  <div class='profile'>
    <h2>{{name}}</h2>
    <p>{{email}}</p>
    <p>Joined {{formatDate joinedAt}}</p>
  </div>
{{else}}
  <p>Select a user to view their profile.</p>
{{/with}}
```

### `{{#let}}`

Define local variables:

```handlebars
{{#let fullName=(concat firstName ' ' lastName)}}
  <h1>{{fullName}}</h1>
  <title>Profile — {{fullName}}</title>
{{/let}}
```

## Template Inclusion

### Basic Inclusion

```handlebars
{{> header}}
{{> userProfile}}
{{> footer}}
```

### With Data Context

```handlebars
{{> userCard user=currentUser}}
{{> commentItem comment=this author=../postAuthor}}
```

### Dynamic Templates

```handlebars
{{> Template.dynamic template=currentView data=viewData}}
```

### Block Content (Content Blocks)

Define a wrapper template:

```handlebars
<template name="card">
  <div class="card">
    <div class="card-header">{{title}}</div>
    <div class="card-body">
      {{> Template.contentBlock}}
    </div>
  </div>
</template>
```

Use it with block syntax:

```handlebars
{{#card title='User Info'}}
  <p>{{user.name}}</p>
  <p>{{user.email}}</p>
{{/card}}
```

## Attribute Helpers

### Dynamic Attributes

```handlebars
<div class="item {{#if active}}active{{/if}} {{typeClass}}">
  {{text}}
</div>

<input type="text" value="{{currentValue}}" {{#if disabled}}disabled{{/if}}>

<a href="{{url}}" target="{{#if external}}_blank{{/if}}">{{label}}</a>
```

### Attribute Object Spread

Return an object from a helper to set multiple attributes:

```ts
Template.myComponent.helpers({
  inputAttrs() {
    return {
      type: 'text',
      class: 'form-input',
      placeholder: 'Enter value...',
      'data-id': this._id,
      'aria-label': this.label,
    };
  },
});
```

```handlebars
<input {{inputAttrs}} />
{{! Renders: <input type="text" class="form-input" placeholder="Enter value..." data-id="abc" aria-label="Name"> }}
```

### Boolean Attributes

```handlebars
<input type="checkbox" {{#if checked}}checked{{/if}}>
<button {{#if loading}}disabled{{/if}}>Submit</button>
<details {{#if expanded}}open{{/if}}>...</details>
```

## Nested Expressions

Use parentheses for nested helper calls:

```handlebars
{{!-- Pass result of one helper as argument to another --}}
{{formatDate (currentDate) "MMMM D, YYYY"}}
{{truncate (markdownToText description) 200}}
{{pluralize (length items) "item" "items"}}

{{!-- In attributes --}}
<div class="{{concat "status-" (toLowerCase status)}}">

{{!-- In conditionals --}}
{{#if (and isAdmin (not isReadOnly))}}
  <button>Edit</button>
{{/if}}

{{!-- Deeply nested --}}
{{#if (gt (length (filter tasks "active")) 0)}}
  <span>{{length (filter tasks "active")}} active tasks</span>
{{/if}}
```

## Lookup Order

When you write `{{name}}`, Blaze resolves it in this order:

1. **Helper** — registered on the current template
2. **Data context property** — from the current data context
3. **Global helper** — registered with `Template.registerHelper()`
4. `undefined` — renders as empty string

```ts
// 1. Template helper (highest priority)
Template.myComponent.helpers({
  name() {
    return 'from helper';
  },
});

// 3. Global helper (lowest priority)
Template.registerHelper('name', function () {
  return 'from global helper';
});

// 2. Data context is set when rendering:
// Blaze.renderWithData(Template.myComponent, { name: 'from data' })
```

## Escaping

To output literal braces:

```handlebars
{{!-- Use the special Raw helper --}}
To write a helper, use {{|openBrace}}{{|openBrace}}helperName{{|closeBrace}}{{|closeBrace}}
```

Or use a helper:

```ts
Template.registerHelper('literal', function (text) {
  return text;
});
```

```handlebars
{{literal '{{example}}'}}
```
