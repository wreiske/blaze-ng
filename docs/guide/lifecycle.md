# Lifecycle Callbacks

Every template instance goes through a predictable lifecycle. Use callbacks to run code at the right time.

## Lifecycle Order

```
onCreated  →  (render)  →  onRendered  →  (updates)  →  onDestroyed
```

1. **`onCreated`** — Template instance created, before DOM exists
2. **`onRendered`** — DOM is ready, template is in the document
3. **`onDestroyed`** — Template is being removed, clean up resources

## onCreated

Runs once when the template instance is first created, **before** any DOM is generated:

```ts
Template.myComponent.onCreated(function () {
  // Initialize reactive state
  this.count = new ReactiveVar(0);
  this.filter = new ReactiveVar('all');
  this.searchQuery = new ReactiveVar('');

  // Set up subscriptions
  this.autorun(() => {
    this.subscribe('todos', this.filter.get());
  });

  // Fetch initial data
  Meteor.call('getConfig', (err, config) => {
    if (!err) this.config = config;
  });
});
```

### What you CAN do in `onCreated`:

- Initialize `ReactiveVar`s and other state
- Set up `autorun` computations
- Start subscriptions
- Make method calls
- Access `this.data` (the data context)

### What you CANNOT do in `onCreated`:

- Access DOM elements (they don't exist yet)
- Use `this.find()` or `this.findAll()`
- Use `this.firstNode` or `this.lastNode`

## onRendered

Runs once after the template's DOM is inserted into the document:

```ts
Template.chart.onRendered(function () {
  // DOM is ready — initialize third-party libraries
  const canvas = this.find('canvas');
  this.chart = new Chart(canvas, {
    type: 'bar',
    data: this.data.chartData,
  });

  // Set up resize observer
  this.resizeObserver = new ResizeObserver(() => {
    this.chart.resize();
  });
  this.resizeObserver.observe(this.find('.chart-container'));
});
```

### Common Uses

- Initialize third-party libraries (charts, maps, editors)
- Set up DOM observers (IntersectionObserver, ResizeObserver)
- Focus an input field
- Start animations
- Measure DOM elements

```ts
Template.autoFocusForm.onRendered(function () {
  // Focus the first input
  this.find('input')?.focus();
});

Template.scrollTracker.onRendered(function () {
  // Track when element becomes visible
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        analytics.track('section_viewed', { id: entry.target.id });
      }
    });
  });

  this.findAll('.trackable').forEach((el) => observer.observe(el));
  this._observer = observer;
});
```

## onDestroyed

Runs when the template is removed from the DOM:

```ts
Template.chart.onDestroyed(function () {
  // Clean up chart
  if (this.chart) {
    this.chart.destroy();
  }

  // Disconnect observer
  if (this.resizeObserver) {
    this.resizeObserver.disconnect();
  }
});
```

### What to Clean Up

- Third-party library instances
- DOM observers
- Timers (`setInterval`, `setTimeout`)
- WebSocket connections
- Event listeners on `window` or `document`

```ts
Template.liveUpdates.onCreated(function () {
  // Set up polling
  this.interval = setInterval(() => {
    Meteor.call('checkUpdates');
  }, 5000);

  // Listen for window resize
  this._onResize = () => this.handleResize();
  window.addEventListener('resize', this._onResize);
});

Template.liveUpdates.onDestroyed(function () {
  // Clean up everything
  clearInterval(this.interval);
  window.removeEventListener('resize', this._onResize);
});
```

## Template Instance API

Inside lifecycle callbacks, `this` is the `TemplateInstance`:

```ts
Template.myComponent.onRendered(function () {
  // this.data — the data context
  console.log(this.data);

  // this.find(selector) — find one element
  const header = this.find('h1');

  // this.findAll(selector) — find all elements
  const items = this.findAll('.item');

  // this.firstNode — first DOM node
  // this.lastNode — last DOM node

  // this.autorun(fn) — reactive computation (auto-stopped on destroy)
  this.autorun(() => {
    const count = this.data.count;
    this.find('.counter').textContent = String(count);
  });

  // this.subscribe(name, ...args) — subscription (auto-stopped on destroy)
  this.subscribe('messages', this.data.channelId);

  // this.view — the underlying Blaze.View
});
```

## Multiple Callbacks

You can register multiple callbacks of each type:

```ts
// Both run, in order
Template.myComponent.onCreated(function () {
  this.count = new ReactiveVar(0);
});

Template.myComponent.onCreated(function () {
  this.name = new ReactiveVar('');
});
```

## Complete Example

```handlebars
<template name='editableDocument'>
  <div class='document'>
    <div class='toolbar'>
      <button class='save' disabled={{isSaving}}>
        {{#if isSaving}}Saving...{{else}}Save{{/if}}
      </button>
      <span class='status'>{{statusMessage}}</span>
    </div>
    <div class='editor' contenteditable='true'>
      {{content}}
    </div>
  </div>
</template>
```

```ts
Template.editableDocument.onCreated(function () {
  this.content = new ReactiveVar(this.data.initialContent || '');
  this.isSaving = new ReactiveVar(false);
  this.lastSaved = new ReactiveVar(null);

  // Auto-save every 30 seconds
  this.autorun(() => {
    const content = this.content.get();
    // Debounce auto-save
  });
});

Template.editableDocument.onRendered(function () {
  // Initialize rich text editor
  this.editor = new Editor(this.find('.editor'), {
    onChange: (content) => {
      this.content.set(content);
    },
  });

  // Warn before leaving with unsaved changes
  this._beforeUnload = (e) => {
    if (this.hasUnsavedChanges()) {
      e.preventDefault();
      e.returnValue = '';
    }
  };
  window.addEventListener('beforeunload', this._beforeUnload);
});

Template.editableDocument.onDestroyed(function () {
  // Clean up editor
  if (this.editor) this.editor.destroy();

  // Remove window listener
  window.removeEventListener('beforeunload', this._beforeUnload);
});

Template.editableDocument.helpers({
  content() {
    return Template.instance().content.get();
  },
  isSaving() {
    return Template.instance().isSaving.get();
  },
  statusMessage() {
    const lastSaved = Template.instance().lastSaved.get();
    if (!lastSaved) return 'Not saved yet';
    return `Last saved ${timeAgo(lastSaved)}`;
  },
});

Template.editableDocument.events({
  'click .save'(event, instance) {
    instance.isSaving.set(true);
    Meteor.call(
      'saveDocument',
      {
        id: instance.data.documentId,
        content: instance.content.get(),
      },
      (err) => {
        instance.isSaving.set(false);
        if (!err) instance.lastSaved.set(new Date());
      },
    );
  },
});
```
