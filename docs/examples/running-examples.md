# Running the Example Apps

Blaze-NG ships with six complete, runnable example applications in the [`examples/`](https://github.com/wreiske/blaze-ng/tree/main/examples) directory. These cover both **Meteor** and **standalone npm** usage so you can see Blaze-NG in action regardless of your stack.

## Prerequisites

- **Node.js** >= 18
- **pnpm** (for standalone examples that use workspace packages)
- **Meteor** (installed automatically via `npx meteor@latest` for Meteor examples)

Build the workspace packages first:

```bash
pnpm install
pnpm build
```

## Meteor Examples

These apps use Meteor's build system and the `blaze-html-templates` package, which compiles `.html` templates at build time and wires up Tracker reactivity automatically.

### Counter <Badge type="tip" text="Beginner" />

A minimal reactive counter demonstrating basic Meteor + Blaze-NG integration.

**What you'll learn:** ReactiveVar, helpers, events, conditional rendering, global helpers.

```bash
cd examples/meteor-counter
npx meteor@latest npm install
npx meteor@latest
```

Open [http://localhost:3000](http://localhost:3000).

::: details Project structure

```
meteor-counter/
├── client/
│   ├── main.html   # Templates and body
│   ├── main.js     # Helpers, events, lifecycle
│   └── styles.css
├── server/
│   └── main.js     # Server entry
└── package.json
```

:::

---

### Todos <Badge type="tip" text="Beginner" />

A todo list with MongoDB persistence, reactive cursor iteration, sub-template inclusion, and filtering.

**What you'll learn:** Mongo collections, `{{#each}}` with cursors, `{{> inclusion}}`, reactive filtering, insert/update/remove.

```bash
cd examples/meteor-todos
npx meteor@latest npm install
npx meteor@latest
```

Open [http://localhost:3000](http://localhost:3000).

::: details Project structure

```
meteor-todos/
├── client/
│   ├── main.html   # todoApp and todoItem templates
│   ├── main.js     # Helpers, events, collection queries
│   └── styles.css
├── imports/
│   └── api/
│       └── todos.js  # Todos collection definition
├── server/
│   └── main.js     # Seed data on startup
└── package.json
```

:::

---

### SSR (Meteor) <Badge type="warning" text="Advanced" />

Server-side rendering with shared templates between client and server, including email HTML generation and SEO-friendly routes.

**What you'll learn:** `Blaze.toHTMLWithData()`, `WebApp.connectHandlers`, shared templates, server routes.

```bash
cd examples/meteor-ssr
npx meteor@latest npm install
npx meteor@latest run
```

Open [http://localhost:3000](http://localhost:3000) for the client-side interactive demo.

SSR routes:

| Route                     | Description                    |
| ------------------------- | ------------------------------ |
| `/ssr`                    | Home page with feature cards   |
| `/ssr/todos`              | Server-rendered todo list      |
| `/ssr/profile/alice`      | User profile page              |
| `/ssr/profile/bob`        | Another user profile           |
| `/ssr/email/welcome`      | Welcome email template preview |
| `/ssr/email/notification` | Notification email preview     |

::: details Project structure

```
meteor-ssr/
├── imports/
│   └── templates/
│       ├── pages.html   # Shared templates (pages + emails)
│       ├── chat.html    # Chat template
│       ├── chat.js      # Chat helpers/events
│       ├── app.html     # App chrome
│       └── setup.js     # Template registration, global helpers
├── client/
│   ├── main.html  # Client-side body + interactiveDemo template
│   ├── main.js    # Client entry
│   └── styles.css
├── server/
│   └── main.js    # SSR routes via WebApp.connectHandlers
└── package.json
```

:::

## Standalone Examples (npm + Vite)

These apps use Blaze-NG as a pure npm library with Vite — no Meteor required. Templates are compiled at runtime and the built-in `SimpleReactiveSystem` provides reactivity.

### Counter (Standalone) <Badge type="tip" text="Beginner" />

A reactive counter using runtime template compilation and `SimpleReactiveSystem`.

**What you'll learn:** Runtime `compile()`, `SimpleReactiveSystem`, `__define__()` registration, manual `render()`.

```bash
cd examples/standalone-counter
pnpm install
pnpm dev
```

Open [http://localhost:5173](http://localhost:5173).

::: info Key differences from Meteor
| Meteor | Standalone |
|--------|-----------|
| Build-time compilation | Runtime `compile()` |
| Tracker provides reactivity | `SimpleReactiveSystem` |
| `<body>` auto-renders | Manual `render(template, element)` |
| `ReactiveVar` from package | `reactive.ReactiveVar()` |
| Auto flush | Manual `reactive.flush()` |
:::

::: details Project structure

```
standalone-counter/
├── index.html
├── src/
│   ├── main.js    # Compile, register, render
│   └── styles.css
└── package.json
```

:::

---

### Todos (Standalone) <Badge type="tip" text="Beginner" />

A todo list with multiple templates, in-memory reactive data store, and list rendering — all without Meteor.

**What you'll learn:** Multiple templates, `{{#each}}` with arrays, sub-template inclusion, reactive store pattern.

```bash
cd examples/standalone-todos
pnpm install
pnpm dev
```

Open [http://localhost:5173](http://localhost:5173).

::: details Project structure

```
standalone-todos/
├── index.html
├── src/
│   ├── main.js    # Templates, store, helpers, events, render
│   └── styles.css
└── package.json
```

:::

---

### SSR (Express) <Badge type="warning" text="Advanced" />

A standalone Express server that renders Blaze-NG templates to HTML — no Meteor, no client-side JavaScript.

**What you'll learn:** Express + Blaze-NG SSR, runtime compilation on the server, layout composition, dynamic routes.

```bash
cd examples/ssr
pnpm install
pnpm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Routes:

| Route            | Description                  |
| ---------------- | ---------------------------- |
| `/`              | Home page with feature cards |
| `/todos`         | Server-rendered todo list    |
| `/profile/alice` | User profile (Alice)         |
| `/profile/bob`   | User profile (Bob)           |

::: details Project structure

```
ssr/
├── src/
│   ├── server.js      # Express server with routes
│   ├── templates.js   # Template definitions (Spacebars strings)
│   └── compile.js     # Utility: compile + register templates
└── package.json
```

:::

## Quick Reference

| Example              | Stack            | Reactivity           | Templates  | Run command             |
| -------------------- | ---------------- | -------------------- | ---------- | ----------------------- |
| `meteor-counter`     | Meteor           | Tracker              | Build-time | `npx meteor@latest`     |
| `meteor-todos`       | Meteor + MongoDB | Tracker              | Build-time | `npx meteor@latest`     |
| `meteor-ssr`         | Meteor + WebApp  | Tracker              | Build-time | `npx meteor@latest run` |
| `standalone-counter` | Vite             | SimpleReactiveSystem | Runtime    | `pnpm dev`              |
| `standalone-todos`   | Vite             | SimpleReactiveSystem | Runtime    | `pnpm dev`              |
| `ssr`                | Express          | None (static)        | Runtime    | `pnpm run dev`          |
