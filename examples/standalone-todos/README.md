# Blaze-NG Standalone Todos

A todo list app built with Blaze-NG and Vite — **no Meteor required**.

## What this demonstrates

- Multiple templates (`todoApp` + `todoItem`) working together
- `{{#each}}` list rendering with an in-memory reactive data store
- `{{> todoItem todo}}` sub-template inclusion with data context
- `{{#if}}` conditional rendering and CSS class binding
- Event delegation (`click .toggle`, `submit .add-form`)
- Reactive filtering (All / Active / Completed)
- Add, toggle, delete, and clear-completed operations

## Setup

```bash
cd examples/standalone-todos
pnpm install
pnpm dev
```

The app will be available at http://localhost:5173.

## Project Structure

```
standalone-todos/
├── index.html
├── src/
│   ├── main.js           # Templates, store, helpers, events, render
│   └── styles.css
└── package.json
```

## How the Reactive Store Works

Without Meteor's MongoDB collections, this example uses a `ReactiveVar` holding
an array of todo objects. Any helper that calls `todosVar.get()` will re-run
when the array changes:

```js
const todosVar = reactive.ReactiveVar([...]);

// Mutations create a new array (immutable pattern)
function addTodo(text) {
  todosVar.set([...getTodos(), { _id: nextId++, text, completed: false }]);
}

// After mutation, call reactive.flush() to synchronously propagate changes
```

This is the same reactive pattern that Meteor uses — only the data layer differs.
