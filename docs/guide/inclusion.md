# Template Inclusion and Composition

Build complex UIs by composing small, focused templates together.

## Basic Inclusion

Include one template inside another with `{{> templateName}}`:

```handlebars
<template name="app">
  {{> navbar}}
  <main>
    {{> content}}
  </main>
  {{> footer}}
</template>
```

## Passing Data

### Data Context

Pass a data context to the included template:

```handlebars
{{> userCard user=currentUser}}
{{> productCard product=this}}
```

The included template receives the passed data as its data context:

```handlebars
<template name='userCard'>
  <div class='user-card'>
    <img src='{{user.avatar}}' alt='{{user.name}}' />
    <h3>{{user.name}}</h3>
    <p>{{user.email}}</p>
  </div>
</template>
```

### Multiple Arguments

```handlebars
{{> commentItem
    comment=this
    author=../postAuthor
    canDelete=../isAdmin
    depth=0
}}
```

### Passing the Current Context

```handlebars
{{!-- Pass the entire current data context --}}
{{#each posts}}
  {{> postCard}}  {{!-- 'this' (the post) becomes the data context --}}
{{/each}}
```

## Dynamic Templates

Render different templates based on reactive data:

```handlebars
{{> Template.dynamic template=currentView}}
{{> Template.dynamic template=currentView data=viewData}}
```

```ts
Template.app.helpers({
  currentView() {
    const route = Router.current();
    switch (route) {
      case 'home':
        return 'homePage';
      case 'profile':
        return 'profilePage';
      case 'settings':
        return 'settingsPage';
      default:
        return 'notFoundPage';
    }
  },
  viewData() {
    return { userId: Router.param('id') };
  },
});
```

### Dynamic Component Pattern

```handlebars
<template name="widgetRenderer">
  {{#each widget in widgets}}
    <div class="widget-wrapper">
      {{> Template.dynamic template=widget.type data=widget.config}}
    </div>
  {{/each}}
</template>
```

```ts
Template.widgetRenderer.helpers({
  widgets() {
    return [
      { type: 'chartWidget', config: { chartType: 'bar', data: salesData } },
      { type: 'statsWidget', config: { metrics: ['users', 'revenue'] } },
      { type: 'tableWidget', config: { collection: 'orders', limit: 10 } },
    ];
  },
});
```

## Content Blocks

Templates can accept block content, similar to "slots" in other frameworks.

### Defining a Wrapper Template

```handlebars
<template name="card">
  <div class="card {{class}}">
    {{#if title}}
      <div class="card-header">
        <h3>{{title}}</h3>
      </div>
    {{/if}}
    <div class="card-body">
      {{> Template.contentBlock}}
    </div>
  </div>
</template>
```

### Using the Wrapper

```handlebars
{{#card title='User Profile' class='profile-card'}}
  <div class='avatar'>
    <img src='{{user.avatar}}' alt='{{user.name}}' />
  </div>
  <h2>{{user.name}}</h2>
  <p>{{user.bio}}</p>
{{/card}}
```

### Else Content

Templates can also accept an `elseBlock`:

```handlebars
<template name="ifLoaded">
  {{#if ready}}
    {{> Template.contentBlock}}
  {{else}}
    {{#if Template.elseBlock}}
      {{> Template.elseBlock}}
    {{else}}
      <div class="spinner">Loading...</div>
    {{/if}}
  {{/if}}
</template>
```

```handlebars
{{#ifLoaded ready=dataReady}}
  <div class='content'>{{data}}</div>
{{else}}
  <div class='custom-loader'>
    <div class='skeleton-line'></div>
    <div class='skeleton-line'></div>
    <div class='skeleton-line'></div>
  </div>
{{/ifLoaded}}
```

## Layout Pattern

Build a layout system with content blocks:

```handlebars
<template name="layout">
  <div class="app-layout">
    <header>
      {{#if Template.contentBlock "header"}}
        {{> Template.contentBlock "header"}}
      {{else}}
        {{> defaultHeader}}
      {{/if}}
    </header>

    <nav class="sidebar">
      {{> sidebar}}
    </nav>

    <main>
      {{> Template.contentBlock}}
    </main>

    <footer>
      {{> footer}}
    </footer>
  </div>
</template>
```

## Recursive Templates

Templates can include themselves for tree structures:

```handlebars
<template name="commentThread">
  <div class="comment" style="margin-left: {{indent}}px">
    <div class="comment-header">
      <img src="{{author.avatar}}" class="avatar">
      <strong>{{author.name}}</strong>
      <time>{{formatDate createdAt}}</time>
    </div>
    <div class="comment-body">{{body}}</div>
    <div class="comment-actions">
      <button class="reply">Reply</button>
      {{#if canDelete}}
        <button class="delete">Delete</button>
      {{/if}}
    </div>

    {{!-- Recursive inclusion --}}
    {{#if replies.length}}
      <div class="replies">
        {{#each reply in replies}}
          {{> commentThread reply indent=(add ../indent 24)}}
        {{/each}}
      </div>
    {{/if}}
  </div>
</template>
```

### File Tree Example

```handlebars
<template name="fileNode">
  <div class="file-node {{#if isDirectory}}directory{{else}}file{{/if}}"
       style="padding-left: {{multiply depth 16}}px">
    {{#if isDirectory}}
      <span class="toggle {{#if isExpanded}}open{{/if}}" data-path="{{path}}">
        {{#if isExpanded}}📂{{else}}📁{{/if}}
      </span>
    {{else}}
      <span class="icon">{{fileIcon extension}}</span>
    {{/if}}

    <span class="name">{{name}}</span>

    {{#if isDirectory}}
      {{#if isExpanded}}
        {{#each child in children}}
          {{> fileNode child depth=(add ../depth 1)}}
        {{/each}}
      {{/if}}
    {{/if}}
  </div>
</template>
```

## Reusable Component Library

### Button Component

```handlebars
<template name="button">
  <button class="btn btn-{{variant}} btn-{{size}} {{#if loading}}loading{{/if}}"
          {{#if disabled}}disabled{{/if}}
          {{#if type}}type="{{type}}"{{/if}}>
    {{#if loading}}
      <span class="spinner"></span>
    {{/if}}
    {{#if icon}}
      <span class="icon">{{icon}}</span>
    {{/if}}
    {{#if Template.contentBlock}}
      {{> Template.contentBlock}}
    {{else}}
      {{label}}
    {{/if}}
  </button>
</template>
```

Usage:

```handlebars
{{> button label="Save" variant="primary" size="md"}}
{{> button label="Cancel" variant="ghost" size="sm"}}
{{> button label="Delete" variant="danger" loading=isDeleting disabled=isDeleting}}

{{#button variant="primary" size="lg"}}
  <span class="icon">🚀</span> Launch Project
{{/button}}
```

### Modal Component

```handlebars
<template name="modal">
  {{#if isOpen}}
    <div class="modal-overlay" data-close="true">
      <div class="modal modal-{{size}}">
        <div class="modal-header">
          <h2>{{title}}</h2>
          <button class="modal-close" aria-label="Close">&times;</button>
        </div>
        <div class="modal-body">
          {{> Template.contentBlock}}
        </div>
        {{#if showFooter}}
          <div class="modal-footer">
            {{> button label="Cancel" variant="ghost" class="modal-cancel"}}
            {{> button label=confirmLabel variant="primary" class="modal-confirm"
                       loading=isProcessing}}
          </div>
        {{/if}}
      </div>
    </div>
  {{/if}}
</template>
```

Usage:

```handlebars
{{#modal
  title='Delete Project' isOpen=showDeleteModal confirmLabel='Delete' showFooter=true size='sm'
}}
  <p>Are you sure you want to delete <strong>{{project.name}}</strong>?</p>
  <p class='text-danger'>This action cannot be undone.</p>
{{/modal}}
```

### Form Field Component

```handlebars
<template name="formField">
  <div class="form-field {{#if error}}has-error{{/if}}">
    {{#if label}}
      <label for="{{fieldId}}">
        {{label}}
        {{#if required}}<span class="required">*</span>{{/if}}
      </label>
    {{/if}}

    {{#if Template.contentBlock}}
      {{> Template.contentBlock}}
    {{else}}
      <input id="{{fieldId}}"
             type="{{inputType}}"
             value="{{value}}"
             placeholder="{{placeholder}}"
             {{#if required}}required{{/if}}>
    {{/if}}

    {{#if helpText}}
      <small class="help-text">{{helpText}}</small>
    {{/if}}
    {{#if error}}
      <small class="error-text">{{error}}</small>
    {{/if}}
  </div>
</template>
```

Usage:

```handlebars
<form>
  {{> formField label="Email" fieldId="email" inputType="email"
                placeholder="you@example.com" required=true
                error=emailError}}

  {{> formField label="Password" fieldId="password" inputType="password"
                helpText="Must be at least 8 characters" required=true
                error=passwordError}}

  {{#formField label="Bio" fieldId="bio"}}
    <textarea id="bio" rows="4" placeholder="Tell us about yourself...">{{bio}}</textarea>
  {{/formField}}

  {{> button label="Create Account" variant="primary" type="submit"
             loading=isSubmitting}}
</form>
```

## Best Practices

1. **Keep templates small** — each template should do one thing well
2. **Name clearly** — use descriptive names like `userCard`, `taskListItem`, `modalConfirm`
3. **Pass only needed data** — don't pass entire objects when only a few fields are used
4. **Use named iteration** — prefer `{{#each item in list}}` over `{{#each list}}`
5. **Compose, don't duplicate** — extract shared patterns into reusable templates
6. **Document data contracts** — comment what data each template expects
