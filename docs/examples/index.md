# Examples

Learn Blaze-ng through complete, working examples.

## Beginner

| Example | Description |
|---------|-------------|
| [Todo App](./todo-app.md) | Classic todo list with add, complete, delete, and filter |
| [Counter](./counter.md) | Simple reactive counter with increment/decrement |

## Intermediate

| Example | Description |
|---------|-------------|
| [Chat App](./chat-app.md) | Real-time chat with rooms, typing indicators, and message history |
| [Forms](./forms.md) | Form validation, dynamic fields, and multi-step wizards |
| [Dashboard](./dashboard.md) | Data dashboard with charts, filters, and real-time updates |

## Advanced

| Example | Description |
|---------|-------------|
| [Dynamic Components](./dynamic-components.md) | Plugin system, lazy loading, and runtime template registration |
| [SSR](./ssr-example.md) | Server-side rendering with hydration |

## Running Examples

Each example includes complete, copy-pasteable code. To run them:

### With Meteor

```bash
meteor create my-app --blaze
cd my-app
# Copy the template and JS code into your app
meteor
```

### Without Meteor (npm)

```bash
mkdir my-app && cd my-app
npm init -y
npm install @blaze-ng/core @blaze-ng/htmljs @blaze-ng/spacebars \
  @blaze-ng/spacebars-compiler @blaze-ng/templating-runtime
```

Set up the reactive system, then use the runtime compilation approach shown in each example.
