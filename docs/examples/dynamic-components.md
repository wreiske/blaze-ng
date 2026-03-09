# Example: Dynamic Components

A plugin system with lazy loading, runtime template registration, and dynamic composition.

## Plugin Architecture

```handlebars
<template name="pluginHost">
  <div class="plugin-host">
    <nav class="plugin-nav">
      <h2>Plugins</h2>
      {{#each plugin in plugins}}
        <button class="plugin-tab {{#if (eq plugin.id activePluginId)}}active{{/if}}"
                data-plugin-id="{{plugin.id}}">
          <span class="plugin-icon">{{plugin.icon}}</span>
          {{plugin.name}}
          {{#if plugin.badge}}
            <span class="badge">{{plugin.badge}}</span>
          {{/if}}
        </button>
      {{/each}}
    </nav>

    <main class="plugin-content">
      {{#if activePlugin}}
        {{#if isPluginLoading}}
          <div class="loading-state">
            <div class="spinner"></div>
            <p>Loading {{activePlugin.name}}...</p>
          </div>
        {{else}}
          {{> Template.dynamic template=activePlugin.template data=activePlugin.data}}
        {{/if}}
      {{else}}
        <div class="welcome-state">
          <h2>Welcome</h2>
          <p>Select a plugin from the sidebar to get started.</p>
        </div>
      {{/if}}
    </main>
  </div>
</template>
```

### Plugin Host Logic

```ts
import { Template } from '@blaze-ng/templating-runtime';
import { Blaze, SimpleReactiveSystem } from '@blaze-ng/core';

Blaze.setReactiveSystem(new SimpleReactiveSystem());

// ── Plugin Registry ─────────────────────────────────────

const pluginRegistry = new Map();

/**
 * Register a plugin with the system.
 * @param {object} config - Plugin configuration.
 * @param {string} config.id - Unique plugin identifier.
 * @param {string} config.name - Display name.
 * @param {string} config.icon - Emoji icon.
 * @param {string} config.template - Template name to render.
 * @param {Function} [config.loader] - Async loader for lazy plugins.
 */
function registerPlugin(config) {
  pluginRegistry.set(config.id, {
    ...config,
    loaded: !config.loader, // Eager plugins are already loaded
  });
}

// ── Plugin Host Template ────────────────────────────────

Template.pluginHost.onCreated(function () {
  this.activePluginId = new ReactiveVar(null);
  this.isPluginLoading = new ReactiveVar(false);
  this.pluginData = new ReactiveVar({});
});

Template.pluginHost.helpers({
  plugins() {
    return Array.from(pluginRegistry.values());
  },
  activePluginId() {
    return Template.instance().activePluginId.get();
  },
  activePlugin() {
    const id = Template.instance().activePluginId.get();
    if (!id) return null;
    const plugin = pluginRegistry.get(id);
    if (!plugin?.loaded) return null;
    return {
      ...plugin,
      data: Template.instance().pluginData.get()[id] || {},
    };
  },
  isPluginLoading() {
    return Template.instance().isPluginLoading.get();
  },
});

Template.pluginHost.events({
  async 'click .plugin-tab'(event, instance) {
    const pluginId = event.currentTarget.dataset.pluginId;
    instance.activePluginId.set(pluginId);
    
    const plugin = pluginRegistry.get(pluginId);
    if (plugin && !plugin.loaded && plugin.loader) {
      instance.isPluginLoading.set(true);
      
      // Load the plugin (registers its template)
      await plugin.loader();
      plugin.loaded = true;
      
      instance.isPluginLoading.set(false);
      // Force reactivity update
      instance.activePluginId.set(pluginId);
    }
  },
});
```

## Eager Plugins

These plugins are registered and available immediately:

### Notes Plugin

```handlebars
<template name="notesPlugin">
  <div class="notes-plugin">
    <div class="notes-toolbar">
      <button class="btn-new-note">+ New Note</button>
    </div>
    <div class="notes-layout">
      <ul class="notes-list">
        {{#each note in notes}}
          <li class="note-item {{#if (eq note.id activeNoteId)}}active{{/if}}"
              data-note-id="{{note.id}}">
            <strong>{{note.title}}</strong>
            <small>{{formatDate note.updatedAt}}</small>
          </li>
        {{/each}}
      </ul>
      {{#if activeNote}}
        <div class="note-editor">
          <input class="note-title-input" value="{{activeNote.title}}"
                 placeholder="Note title">
          <textarea class="note-body-input"
                    placeholder="Write something...">{{activeNote.body}}</textarea>
        </div>
      {{else}}
        <div class="no-note-selected">Select or create a note</div>
      {{/if}}
    </div>
  </div>
</template>
```

```ts
Template.notesPlugin.onCreated(function () {
  this.notes = new ReactiveVar([
    { id: '1', title: 'Getting Started', body: 'Welcome to Notes!', updatedAt: new Date() },
    { id: '2', title: 'Ideas', body: 'Some ideas for the project...', updatedAt: new Date(Date.now() - 86400000) },
  ]);
  this.activeNoteId = new ReactiveVar(null);
});

Template.notesPlugin.helpers({
  notes() { return Template.instance().notes.get(); },
  activeNoteId() { return Template.instance().activeNoteId.get(); },
  activeNote() {
    const id = Template.instance().activeNoteId.get();
    return Template.instance().notes.get().find(n => n.id === id);
  },
});

Template.notesPlugin.events({
  'click .note-item'(event, instance) {
    instance.activeNoteId.set(event.currentTarget.dataset.noteId);
  },
  'click .btn-new-note'(event, instance) {
    const notes = instance.notes.get();
    const newNote = {
      id: String(Date.now()),
      title: 'Untitled',
      body: '',
      updatedAt: new Date(),
    };
    instance.notes.set([newNote, ...notes]);
    instance.activeNoteId.set(newNote.id);
  },
  'input .note-title-input'(event, instance) {
    updateNote(instance, 'title', event.target.value);
  },
  'input .note-body-input'(event, instance) {
    updateNote(instance, 'body', event.target.value);
  },
});

function updateNote(instance, field, value) {
  const id = instance.activeNoteId.get();
  const notes = instance.notes.get().map(n =>
    n.id === id ? { ...n, [field]: value, updatedAt: new Date() } : n
  );
  instance.notes.set(notes);
}

// Register as eager plugin
registerPlugin({
  id: 'notes',
  name: 'Notes',
  icon: '📝',
  template: 'notesPlugin',
});
```

### Timer Plugin

```handlebars
<template name="timerPlugin">
  <div class="timer-plugin">
    <div class="timer-display">
      {{formatTimer elapsed}}
    </div>
    <div class="timer-controls">
      {{#if isRunning}}
        <button class="btn-pause">⏸ Pause</button>
      {{else}}
        <button class="btn-start">▶ Start</button>
      {{/if}}
      <button class="btn-reset">↺ Reset</button>
      <button class="btn-lap" {{#unless isRunning}}disabled{{/unless}}>Lap</button>
    </div>
    {{#if laps.length}}
      <table class="lap-table">
        <thead><tr><th>#</th><th>Lap Time</th><th>Total</th></tr></thead>
        <tbody>
          {{#each lap in laps}}
            <tr>
              <td>{{math (subtract laps.length @index) "+" 0}}</td>
              <td>{{formatTimer lap.split}}</td>
              <td>{{formatTimer lap.total}}</td>
            </tr>
          {{/each}}
        </tbody>
      </table>
    {{/if}}
  </div>
</template>
```

```ts
Template.timerPlugin.onCreated(function () {
  this.elapsed = new ReactiveVar(0);
  this.isRunning = new ReactiveVar(false);
  this.laps = new ReactiveVar([]);
  this.intervalId = null;
  this.lastLapTime = 0;
});

Template.timerPlugin.onDestroyed(function () {
  if (this.intervalId) clearInterval(this.intervalId);
});

Template.timerPlugin.helpers({
  elapsed() { return Template.instance().elapsed.get(); },
  isRunning() { return Template.instance().isRunning.get(); },
  laps() { return Template.instance().laps.get(); },
});

Template.timerPlugin.events({
  'click .btn-start'(event, instance) {
    instance.isRunning.set(true);
    const startTime = Date.now() - instance.elapsed.get();
    instance.intervalId = setInterval(() => {
      instance.elapsed.set(Date.now() - startTime);
    }, 10);
  },
  'click .btn-pause'(event, instance) {
    instance.isRunning.set(false);
    clearInterval(instance.intervalId);
  },
  'click .btn-reset'(event, instance) {
    instance.isRunning.set(false);
    instance.elapsed.set(0);
    instance.laps.set([]);
    instance.lastLapTime = 0;
    clearInterval(instance.intervalId);
  },
  'click .btn-lap'(event, instance) {
    const total = instance.elapsed.get();
    const split = total - instance.lastLapTime;
    instance.lastLapTime = total;
    instance.laps.set([{ split, total }, ...instance.laps.get()]);
  },
});

registerPlugin({
  id: 'timer',
  name: 'Timer',
  icon: '⏱',
  template: 'timerPlugin',
});
```

## Lazy-Loaded Plugin

This plugin is loaded on demand when first activated:

```ts
// Register with a loader function — template isn't defined yet
registerPlugin({
  id: 'weather',
  name: 'Weather',
  icon: '🌤',
  template: 'weatherPlugin',
  loader: async () => {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Define the template at runtime
    Template.__define__('weatherPlugin', () => {
      // Return the template's render function
      return Blaze._TemplateWith(
        { cities: () => Template.instance().cities.get() },
        () => Template.weatherPluginContent()
      );
    });
  },
});
```

```handlebars
<!-- This template is loaded lazily -->
<template name="weatherPluginContent">
  <div class="weather-plugin">
    <div class="weather-grid">
      {{#each city in cities}}
        <div class="weather-card">
          <h4>{{city.name}}</h4>
          <div class="weather-icon">{{city.icon}}</div>
          <div class="temperature">{{city.temp}}°</div>
          <div class="condition">{{city.condition}}</div>
        </div>
      {{/each}}
    </div>
  </div>
</template>
```

## Recursive Components

A file tree browser built with recursive template inclusion:

```handlebars
<template name="fileTree">
  <div class="file-tree">
    <h3>Project Files</h3>
    {{> fileNode node=root depth=0}}
  </div>
</template>

<template name="fileNode">
  <div class="file-node" style="padding-left: {{indent depth}}px">
    {{#if node.children}}
      <div class="folder" data-path="{{node.path}}">
        <span class="toggle">{{#if (isExpanded node.path)}}▼{{else}}▶{{/if}}</span>
        <span class="icon">📁</span>
        <span class="name">{{node.name}}</span>
      </div>
      {{#if (isExpanded node.path)}}
        {{#each child in node.children}}
          {{> fileNode node=child depth=(math depth "+" 1)}}
        {{/each}}
      {{/if}}
    {{else}}
      <div class="file">
        <span class="icon">{{fileIcon node.name}}</span>
        <span class="name">{{node.name}}</span>
        <span class="size">{{formatSize node.size}}</span>
      </div>
    {{/if}}
  </div>
</template>
```

```ts
Template.fileTree.onCreated(function () {
  this.expandedPaths = new ReactiveVar(new Set(['/', '/src']));
});

Template.fileTree.helpers({
  root() {
    return {
      name: 'project',
      path: '/',
      children: [
        {
          name: 'src', path: '/src',
          children: [
            { name: 'index.ts', path: '/src/index.ts', size: 2048 },
            { name: 'utils.ts', path: '/src/utils.ts', size: 1024 },
            {
              name: 'components', path: '/src/components',
              children: [
                { name: 'App.ts', path: '/src/components/App.ts', size: 3072 },
                { name: 'Header.ts', path: '/src/components/Header.ts', size: 1536 },
              ],
            },
          ],
        },
        { name: 'package.json', path: '/package.json', size: 512 },
        { name: 'tsconfig.json', path: '/tsconfig.json', size: 256 },
        { name: 'README.md', path: '/README.md', size: 4096 },
      ],
    };
  },
});

Template.registerHelper('isExpanded', (path) => {
  const instance = Blaze.getView().templateInstance();
  // Walk up to find the fileTree instance
  let view = instance.view;
  while (view && !view.template?.viewName?.includes('fileTree')) {
    view = view.parentView;
  }
  const fileTree = view?.templateInstance();
  return fileTree?.expandedPaths.get().has(path);
});

Template.registerHelper('indent', (depth) => depth * 20);

Template.registerHelper('fileIcon', (name) => {
  if (name.endsWith('.ts')) return '🟦';
  if (name.endsWith('.json')) return '📋';
  if (name.endsWith('.md')) return '📄';
  return '📄';
});

Template.registerHelper('formatSize', (bytes) => {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
});

Template.registerHelper('subtract', (a, b) => a - b);

Template.fileNode.events({
  'click .folder'(event, instance) {
    event.stopPropagation();
    const path = event.currentTarget.dataset.path;
    
    // Find the root fileTree instance
    let view = instance.view;
    while (view && !view.template?.viewName?.includes('fileTree')) {
      view = view.parentView;
    }
    const fileTree = view?.templateInstance();
    if (!fileTree) return;
    
    const expanded = new Set(fileTree.expandedPaths.get());
    if (expanded.has(path)) {
      expanded.delete(path);
    } else {
      expanded.add(path);
    }
    fileTree.expandedPaths.set(expanded);
  },
});
```

## Styles

```css
/* Plugin Host */
.plugin-host {
  display: grid;
  grid-template-columns: 220px 1fr;
  height: 100vh;
  font-family: system-ui, sans-serif;
}

.plugin-nav {
  background: #1e1e2e;
  color: white;
  padding: 1rem;
}

.plugin-tab {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
  padding: 0.75rem;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: #a1a1b5;
  cursor: pointer;
  font-size: 0.875rem;
  text-align: left;
}

.plugin-tab:hover { background: #313244; color: white; }
.plugin-tab.active { background: #4f46e5; color: white; }

.badge {
  margin-left: auto;
  background: #ef4444;
  color: white;
  padding: 0.125rem 0.375rem;
  border-radius: 999px;
  font-size: 0.6875rem;
}

.plugin-content { padding: 2rem; }

/* Loading & welcome */
.loading-state, .welcome-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 50vh;
  color: #64748b;
}

.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid #e2e8f0;
  border-top-color: #4f46e5;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }

/* Notes */
.notes-layout { display: grid; grid-template-columns: 200px 1fr; gap: 1rem; margin-top: 1rem; }
.notes-list { list-style: none; padding: 0; margin: 0; }
.note-item { padding: 0.75rem; border-radius: 8px; cursor: pointer; }
.note-item:hover { background: #f1f5f9; }
.note-item.active { background: #eef2ff; }
.note-title-input { width: 100%; font-size: 1.25rem; font-weight: 600; border: none; border-bottom: 2px solid #e2e8f0; padding: 0.5rem 0; margin-bottom: 1rem; }
.note-body-input { width: 100%; min-height: 300px; border: none; resize: vertical; font-size: 1rem; line-height: 1.6; }

/* Timer */
.timer-plugin { text-align: center; padding: 2rem; }
.timer-display { font-size: 4rem; font-weight: 700; font-variant-numeric: tabular-nums; letter-spacing: -0.02em; margin-bottom: 1.5rem; }
.timer-controls { display: flex; gap: 0.75rem; justify-content: center; margin-bottom: 2rem; }
.lap-table { width: 100%; max-width: 400px; margin: 0 auto; border-collapse: collapse; }
.lap-table th, .lap-table td { padding: 0.5rem 1rem; text-align: right; border-bottom: 1px solid #e2e8f0; }

/* Weather */
.weather-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 1rem; }
.weather-card { background: linear-gradient(135deg, #667eea, #764ba2); color: white; padding: 1.5rem; border-radius: 12px; text-align: center; }
.weather-icon { font-size: 3rem; margin: 0.5rem 0; }
.temperature { font-size: 2rem; font-weight: 700; }

/* File Tree */
.file-tree { background: #1e1e2e; color: #d4d4d8; padding: 1rem; border-radius: 8px; font-family: 'SF Mono', monospace; font-size: 0.875rem; }
.file-node { cursor: default; }
.folder { cursor: pointer; padding: 0.25rem 0; }
.folder:hover { background: #313244; border-radius: 4px; }
.file { padding: 0.25rem 0; display: flex; gap: 0.5rem; }
.file .size { margin-left: auto; color: #71717a; }
.toggle { width: 1em; display: inline-block; }
```

## What This Demonstrates

- **Plugin architecture** — runtime registration with `registerPlugin()`
- **Lazy loading** — plugins loaded asynchronously on first activation
- **`Template.dynamic`** — switching rendered template by name
- **`Template.__define__`** — registering templates at runtime
- **Recursive templates** — file tree using self-referencing `{{> fileNode}}`
- **Cross-component communication** — walking the view hierarchy to find parent state
- **Timer with cleanup** — `onDestroyed` clears intervals
- **Computed depth** — inline `{{math depth "+" 1}}` for recursive indentation
