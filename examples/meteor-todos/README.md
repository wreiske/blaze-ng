# Blaze-NG Meteor Todos Example

A todo list app with MongoDB persistence, built with Meteor and Blaze-NG.

## What this demonstrates

- Meteor + Blaze-NG with MongoDB collections (full-stack reactivity)
- `{{#each}}` for rendering lists from a Mongo cursor
- `{{> todoItem}}` sub-template inclusion with data context
- Conditional CSS classes with `{{#if}}`
- Reactive filtering (All / Active / Completed)
- Insert, update, and remove operations via Meteor collections
- Server-side seeding of sample data

## Setup

```bash
cd examples/meteor-todos
npx meteor@latest npm install
npx meteor@latest
```

The app will be available at http://localhost:3000.

## Project Structure

```
meteor-todos/
├── .meteor/
│   ├── packages          # Includes mongo and blaze-html-templates
│   ├── platforms
│   └── release
├── client/
│   ├── main.html         # todoApp and todoItem templates
│   ├── main.js           # Helpers, events, collection queries
│   └── styles.css
├── imports/
│   └── api/
│       └── todos.js      # Todos collection definition
├── server/
│   └── main.js           # Seed data on startup
└── package.json
```

## How it works

The `Todos` collection is shared between client and server. On the client,
`Todos.find()` returns a reactive cursor — when documents change (insert,
update, remove), any template helper that called `find()` automatically re-runs
and the DOM updates. This is Blaze's core strength: **fine-grained reactive
rendering with zero boilerplate**.
