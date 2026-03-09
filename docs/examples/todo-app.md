# Example: Todo App

A complete todo list application with add, complete, delete, filter, and sort functionality.

## Preview

```
┌─────────────────────────────────────┐
│  📋 Todo App           [Clear Done] │
│  ┌─────────────────────────┐ [Add]  │
│  │ Buy groceries           │        │
│  └─────────────────────────┘        │
│  [All] [Active] [Completed]         │
│                                     │
│  ☐ Buy groceries              [×]   │
│  ☑ Write documentation   ──── [×]   │
│  ☐ Review pull request         [×]   │
│                                     │
│  2 items left                       │
└─────────────────────────────────────┘
```

## Templates

```handlebars
<template name="todoApp">
  <div class="todo-app">
    <header>
      <h1>📋 Todo App</h1>
      {{#if completedCount}}
        <button class="clear-completed">Clear Done ({{completedCount}})</button>
      {{/if}}
    </header>

    <form class="add-form">
      <input type="text" class="new-todo"
             placeholder="What needs to be done?"
             value="{{newTodoText}}"
             autofocus>
      <button type="submit" {{#unless newTodoText}}disabled{{/unless}}>Add</button>
    </form>

    <div class="filters">
      {{#each filterOption in filterOptions}}
        <button class="filter-btn {{#if (eq currentFilter filterOption.value)}}active{{/if}}"
                data-filter="{{filterOption.value}}">
          {{filterOption.label}}
        </button>
      {{/each}}
    </div>

    <ul class="todo-list">
      {{#each todo in filteredTodos}}
        {{> todoItem todo}}
      {{else}}
        <li class="empty-state">
          {{#if (eq currentFilter "all")}}
            No todos yet. Add one above!
          {{else if (eq currentFilter "active")}}
            No active todos. Nice work!
          {{else}}
            No completed todos.
          {{/if}}
        </li>
      {{/each}}
    </ul>

    {{#if todoCount}}
      <footer class="todo-footer">
        <span>{{activeCount}} {{pluralize activeCount "item" "items"}} left</span>
      </footer>
    {{/if}}
  </div>
</template>

<template name="todoItem">
  <li class="todo-item {{#if todo.completed}}completed{{/if}} {{#if isEditing}}editing{{/if}}">
    {{#if isEditing}}
      <form class="edit-form">
        <input type="text" class="edit-input" value="{{todo.text}}">
      </form>
    {{else}}
      <input type="checkbox" class="toggle" {{#if todo.completed}}checked{{/if}}>
      <label class="todo-text" title="Double-click to edit">{{todo.text}}</label>
      <time class="created-at">{{timeAgo todo.createdAt}}</time>
      <button class="destroy" aria-label="Delete">&times;</button>
    {{/if}}
  </li>
</template>
```

## JavaScript

```ts
import { Template } from '@blaze-ng/templating-runtime';
import { Blaze } from '@blaze-ng/core';
import { SimpleReactiveSystem } from '@blaze-ng/core/testing';

// Set up reactivity
Blaze.setReactiveSystem(new SimpleReactiveSystem());

// ── Data Store ──────────────────────────────────────────
// In a real app, this would be a Mongo collection

let todos = [
  { _id: '1', text: 'Buy groceries', completed: false, createdAt: new Date('2024-01-15') },
  { _id: '2', text: 'Write documentation', completed: true, createdAt: new Date('2024-01-14') },
  { _id: '3', text: 'Review pull request', completed: false, createdAt: new Date('2024-01-13') },
];
let nextId = 4;

// ── todoApp Template ────────────────────────────────────

Template.todoApp.onCreated(function () {
  this.filter = new ReactiveVar('all');
  this.newText = new ReactiveVar('');
});

Template.todoApp.helpers({
  newTodoText() {
    return Template.instance().newText.get();
  },
  currentFilter() {
    return Template.instance().filter.get();
  },
  filterOptions() {
    return [
      { label: 'All', value: 'all' },
      { label: 'Active', value: 'active' },
      { label: 'Completed', value: 'completed' },
    ];
  },
  filteredTodos() {
    const filter = Template.instance().filter.get();
    switch (filter) {
      case 'active':
        return todos.filter((t) => !t.completed);
      case 'completed':
        return todos.filter((t) => t.completed);
      default:
        return todos;
    }
  },
  todoCount() {
    return todos.length;
  },
  activeCount() {
    return todos.filter((t) => !t.completed).length;
  },
  completedCount() {
    return todos.filter((t) => t.completed).length;
  },
});

Template.todoApp.events({
  'submit .add-form'(event, instance) {
    event.preventDefault();
    const text = instance.newText.get().trim();
    if (!text) return;

    todos.push({
      _id: String(nextId++),
      text,
      completed: false,
      createdAt: new Date(),
    });
    instance.newText.set('');
  },
  'input .new-todo'(event, instance) {
    instance.newText.set(event.target.value);
  },
  'click .filter-btn'(event, instance) {
    instance.filter.set(event.currentTarget.dataset.filter);
  },
  'click .clear-completed'() {
    todos = todos.filter((t) => !t.completed);
  },
});

// ── todoItem Template ───────────────────────────────────

Template.todoItem.onCreated(function () {
  this.isEditing = new ReactiveVar(false);
});

Template.todoItem.helpers({
  isEditing() {
    return Template.instance().isEditing.get();
  },
});

Template.todoItem.events({
  'click .toggle'(event) {
    const todo = todos.find((t) => t._id === this.todo._id);
    if (todo) todo.completed = !todo.completed;
  },
  'click .destroy'() {
    todos = todos.filter((t) => t._id !== this.todo._id);
  },
  'dblclick .todo-text'(event, instance) {
    instance.isEditing.set(true);
    // Focus the input after render
    setTimeout(() => {
      instance.find('.edit-input')?.focus();
    }, 0);
  },
  'submit .edit-form'(event, instance) {
    event.preventDefault();
    const newText = instance.find('.edit-input').value.trim();
    if (newText) {
      const todo = todos.find((t) => t._id === this.todo._id);
      if (todo) todo.text = newText;
    }
    instance.isEditing.set(false);
  },
  'blur .edit-input'(event, instance) {
    instance.isEditing.set(false);
  },
  'keydown .edit-input'(event, instance) {
    if (event.key === 'Escape') {
      instance.isEditing.set(false);
    }
  },
});

// ── Global Helpers ──────────────────────────────────────

Template.registerHelper('eq', (a, b) => a === b);

Template.registerHelper('pluralize', (count, singular, plural) => {
  return count === 1 ? singular : plural;
});

Template.registerHelper('timeAgo', (date) => {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
});

// ── Render ──────────────────────────────────────────────

Blaze.render(Template.todoApp, document.getElementById('app'));
```

## Styles

```css
.todo-app {
  max-width: 500px;
  margin: 2rem auto;
  font-family: system-ui, sans-serif;
}

.todo-app header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.add-form {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.new-todo {
  flex: 1;
  padding: 0.75rem;
  border: 2px solid #e2e8f0;
  border-radius: 8px;
  font-size: 1rem;
}

.new-todo:focus {
  border-color: #4f46e5;
  outline: none;
}

.filters {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.filter-btn {
  padding: 0.5rem 1rem;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  background: white;
  cursor: pointer;
}

.filter-btn.active {
  background: #4f46e5;
  color: white;
  border-color: #4f46e5;
}

.todo-list {
  list-style: none;
  padding: 0;
}

.todo-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem;
  border-bottom: 1px solid #f1f5f9;
}

.todo-item.completed .todo-text {
  text-decoration: line-through;
  color: #94a3b8;
}

.todo-text {
  flex: 1;
  cursor: pointer;
}

.created-at {
  font-size: 0.75rem;
  color: #94a3b8;
}

.destroy {
  opacity: 0;
  border: none;
  background: none;
  color: #ef4444;
  font-size: 1.25rem;
  cursor: pointer;
}

.todo-item:hover .destroy {
  opacity: 1;
}

.empty-state {
  text-align: center;
  padding: 2rem;
  color: #94a3b8;
}

.todo-footer {
  padding: 0.75rem 0;
  color: #64748b;
  font-size: 0.875rem;
}

.clear-completed {
  padding: 0.5rem 1rem;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  background: white;
  cursor: pointer;
  font-size: 0.875rem;
}
```

## With Meteor

In a Meteor app, replace the in-memory store with a Mongo collection:

```ts
// imports/api/todos.ts
import { Mongo } from 'meteor/mongo';

export const Todos = new Mongo.Collection('todos');

// Replace the helpers:
Template.todoApp.helpers({
  filteredTodos() {
    const filter = Template.instance().filter.get();
    const query = {};
    if (filter === 'active') query.completed = false;
    if (filter === 'completed') query.completed = true;
    return Todos.find(query, { sort: { createdAt: -1 } });
  },
  todoCount() {
    return Todos.find().count();
  },
  activeCount() {
    return Todos.find({ completed: false }).count();
  },
  completedCount() {
    return Todos.find({ completed: true }).count();
  },
});
```
