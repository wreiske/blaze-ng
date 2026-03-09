# Blaze-NG Meteor Counter Example

A simple reactive counter built with Meteor and Blaze-NG.

## What this demonstrates

- Basic Meteor + Blaze-NG integration via `blaze-html-templates`
- `ReactiveVar` for state management (Meteor's built-in reactivity)
- Template helpers and event handlers
- Conditional rendering with `{{#if}}`
- Global helper registration (`pluralize`)

## Setup

```bash
cd examples/meteor-counter
npx meteor@latest npm install
npx meteor@latest
```

The app will be available at http://localhost:3000.

## Project Structure

```
meteor-counter/
├── .meteor/
│   ├── packages          # Meteor packages (includes blaze-html-templates)
│   ├── platforms          # browser, server
│   └── release            # Meteor version
├── client/
│   ├── main.html          # Templates and body
│   ├── main.js            # Helpers, events, lifecycle
│   └── styles.css         # Styles
├── server/
│   └── main.js            # Server entry
└── package.json
```

## How it works

The `blaze-html-templates` Meteor package automatically:
1. Compiles `<template>` tags in `.html` files at build time
2. Registers them in the template registry
3. Renders `<body>` content to `document.body` on startup
4. Connects Meteor's `Tracker` as the reactive system

This means you write standard Blaze templates — Blaze-NG is a drop-in replacement.
