# Blaze-NG Standalone Counter

A reactive counter built with Blaze-NG and Vite — **no Meteor required**.

## What this demonstrates

- Using Blaze-NG as a **pure npm library**, independent of Meteor
- Runtime template compilation with `SpacebarsCompiler.compile()`
- `SimpleReactiveSystem` for state management (no Tracker needed)
- Template registration with `__define__()`
- Reactive rendering with `Blaze.render()`
- Event handling and template lifecycle

## Setup

```bash
cd examples/standalone-counter
pnpm install
pnpm dev
```

The app will be available at http://localhost:5173.

## Project Structure

```
standalone-counter/
├── index.html            # HTML shell
├── src/
│   ├── main.js           # App entry — compile, register, render
│   └── styles.css
└── package.json          # Uses @blaze-ng/* workspace packages
```

## Key Differences from Meteor

| Meteor                                          | Standalone                                    |
| ----------------------------------------------- | --------------------------------------------- |
| `meteor/templating` does build-time compilation | You call `compile()` at runtime               |
| Tracker provides reactivity automatically       | You create a `SimpleReactiveSystem`           |
| `<body>` is auto-rendered                       | You call `render(template, element)` manually |
| `ReactiveVar` comes from `meteor/reactive-var`  | You use `reactive.ReactiveVar()`              |
| `reactive.flush()` is automatic                 | You call `reactive.flush()` after mutations   |

## How Templates Work Without Meteor

1. **Write template as a string** — same Spacebars syntax (`{{helpers}}`, `{{#if}}`, `{{#each}}`)
2. **Compile** — `compile(templateStr, { isTemplate: true })` returns a JS function string
3. **Evaluate** — `new Function('HTML', 'Spacebars', \`return \${code}\`)(HTML, Spacebars)` → render function
4. **Register** — `__define__('name', renderFunc)` adds it to the template registry
5. **Render** — `render(Template.name, element)` mounts the template to the DOM
