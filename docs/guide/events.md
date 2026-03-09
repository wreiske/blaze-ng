# Events

Blaze-NG provides a declarative event system that makes handling user interactions simple and clean.

## Defining Events

Register event handlers on a template:

```ts
Template.myComponent.events({
  'click button'(event, instance) {
    console.log('Button clicked!');
  },
});
```

The event map keys follow the format: `'eventType selector'`

## Event Handler Arguments

Every handler receives two arguments:

```ts
Template.myForm.events({
  'submit form'(event: Event, instance: TemplateInstance) {
    // event   — the native DOM event
    // instance — the TemplateInstance

    event.preventDefault();
    const formData = new FormData(event.target as HTMLFormElement);
    // ...
  },
});
```

## Event Types

All native DOM events are supported:

```ts
Template.myComponent.events({
  // Mouse events
  'click .button'(event) {},
  'dblclick .item'(event) {},
  'mouseenter .card'(event) {},
  'mouseleave .card'(event) {},

  // Keyboard events
  'keydown input'(event) {},
  'keyup input'(event) {},
  'keypress input'(event) {},

  // Form events
  'submit form'(event) {},
  'change select'(event) {},
  'input .search'(event) {},
  'focus input'(event) {},
  'blur input'(event) {},

  // Touch events
  'touchstart .slider'(event) {},
  'touchmove .slider'(event) {},
  'touchend .slider'(event) {},

  // Drag events
  'dragstart .draggable'(event) {},
  'dragover .dropzone'(event) {},
  'drop .dropzone'(event) {},

  // Scroll
  'scroll .container'(event) {},
});
```

## CSS Selectors

Use any valid CSS selector:

```ts
Template.myComponent.events({
  // Class selector
  'click .delete-btn'(event) {},

  // ID selector
  'click #submit'(event) {},

  // Element selector
  'click button'(event) {},

  // Attribute selector
  'click [data-action="delete"]'(event) {},

  // Descendant selector
  'click .list .item'(event) {},

  // Multiple classes
  'click .btn.primary'(event) {},
});
```

## Accessing Data Context

Get the data context of the element that triggered the event:

```handlebars
<template name='todoList'>
  {{#each todos}}
    <div class='todo-item' data-id='{{_id}}'>
      <span>{{text}}</span>
      <button class='delete'>Delete</button>
    </div>
  {{/each}}
</template>
```

```ts
Template.todoList.events({
  'click .delete'(event, instance) {
    // Get the data context of the clicked item
    const todo = Blaze.getData(event.currentTarget.parentElement);
    Todos.remove(todo._id);
  },
});
```

## Using Template Instance

Access reactive state created in `onCreated`:

```ts
Template.searchBox.onCreated(function () {
  this.searchQuery = new ReactiveVar('');
  this.isSearching = new ReactiveVar(false);
});

Template.searchBox.events({
  'input .search-input'(event, instance) {
    instance.searchQuery.set(event.target.value);
  },

  'submit .search-form'(event, instance) {
    event.preventDefault();
    instance.isSearching.set(true);

    // Perform search...
    performSearch(instance.searchQuery.get()).then(() => {
      instance.isSearching.set(false);
    });
  },

  'click .clear'(event, instance) {
    instance.searchQuery.set('');
    instance.find('.search-input').focus();
  },
});
```

## Event Delegation

Blaze-NG uses **event delegation** — events are attached to the template's root element and delegated to matching children. This means:

- Events work on dynamically added elements
- Only one listener per event type per template
- Efficient memory usage

```handlebars
<template name='dynamicList'>
  <div class='list'>
    {{! Items added later still trigger events }}
    {{#each items}}
      <button class='item'>{{name}}</button>
    {{/each}}
  </div>
</template>
```

```ts
Template.dynamicList.events({
  // This works even for items added after initial render
  'click .item'(event) {
    console.log('Clicked:', event.target.textContent);
  },
});
```

## Multiple Events on Same Selector

```ts
Template.input.events({
  'focus input, focus textarea'(event) {
    event.target.parentElement.classList.add('focused');
  },

  'blur input, blur textarea'(event) {
    event.target.parentElement.classList.remove('focused');
  },
});
```

## Practical Examples

### Toggle Button

```handlebars
<template name="toggleButton">
  <button class="toggle {{#if isActive}}active{{/if}}">
    {{#if isActive}}ON{{else}}OFF{{/if}}
  </button>
</template>
```

```ts
Template.toggleButton.onCreated(function () {
  this.isActive = new ReactiveVar(false);
});

Template.toggleButton.helpers({
  isActive() {
    return Template.instance().isActive.get();
  },
});

Template.toggleButton.events({
  'click .toggle'(event, instance) {
    instance.isActive.set(!instance.isActive.get());
  },
});
```

### Form with Validation

```handlebars
<template name="signupForm">
  <form class="signup">
    <div class="field {{#if errors.email}}has-error{{/if}}">
      <label>Email</label>
      <input type="email" name="email" value="{{email}}">
      {{#if errors.email}}<span class="error">{{errors.email}}</span>{{/if}}
    </div>

    <div class="field {{#if errors.password}}has-error{{/if}}">
      <label>Password</label>
      <input type="password" name="password">
      {{#if errors.password}}<span class="error">{{errors.password}}</span>{{/if}}
    </div>

    <button type="submit" disabled={{isSubmitting}}>
      {{#if isSubmitting}}Signing up...{{else}}Sign Up{{/if}}
    </button>
  </form>
</template>
```

```ts
Template.signupForm.onCreated(function () {
  this.errors = new ReactiveVar({});
  this.isSubmitting = new ReactiveVar(false);
});

Template.signupForm.events({
  'submit .signup'(event, instance) {
    event.preventDefault();

    const email = instance.find('[name="email"]').value;
    const password = instance.find('[name="password"]').value;

    // Validate
    const errors = {};
    if (!email.includes('@')) errors.email = 'Invalid email';
    if (password.length < 8) errors.password = 'Must be 8+ characters';

    if (Object.keys(errors).length > 0) {
      instance.errors.set(errors);
      return;
    }

    instance.errors.set({});
    instance.isSubmitting.set(true);

    Accounts.createUser({ email, password }, (err) => {
      instance.isSubmitting.set(false);
      if (err) instance.errors.set({ email: err.reason });
    });
  },
});
```

### Keyboard Shortcuts

```ts
Template.editor.events({
  'keydown .editor'(event, instance) {
    // Ctrl/Cmd + S to save
    if ((event.ctrlKey || event.metaKey) && event.key === 's') {
      event.preventDefault();
      instance.save();
    }

    // Ctrl/Cmd + Z to undo
    if ((event.ctrlKey || event.metaKey) && event.key === 'z') {
      event.preventDefault();
      instance.undo();
    }

    // Escape to close
    if (event.key === 'Escape') {
      instance.close();
    }
  },
});
```
