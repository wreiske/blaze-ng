# Blaze-NG Meteor SSR Example

A Meteor application demonstrating **server-side rendering** with Blaze-NG templates. This app shows how to use the same Blaze templates for both client-side interactivity and server-rendered HTML output.

## What It Demonstrates

- **Server-rendered pages** — Full HTML pages rendered on the server via `Blaze.toHTMLWithData()` and served through `WebApp.connectHandlers`
- **Shared templates** — Templates defined once in `imports/templates/`, used on both client and server
- **Email HTML generation** — Server-rendered email templates (welcome emails, notifications) ready to send
- **Client + SSR coexistence** — Interactive client-side Blaze templates alongside SSR routes in the same app
- **SEO-friendly routes** — Static HTML served to crawlers without requiring client-side JavaScript

## Setup

```bash
cd examples/meteor-ssr
npx meteor@latest npm install
npx meteor@latest run
```

Open [http://localhost:3000](http://localhost:3000) for the client-side interactive demo.

## SSR Routes

| Route | Description |
|---|---|
| `/ssr` | Home page with feature cards |
| `/ssr/todos` | Server-rendered todo list |
| `/ssr/profile/alice` | User profile page |
| `/ssr/profile/bob` | Another profile |
| `/ssr/email/welcome` | Welcome email template preview |
| `/ssr/email/notification` | Notification email preview |

All `/ssr/*` routes return complete HTML documents with no client-side JavaScript — the HTML is fully rendered on the server.

## Project Structure

```
meteor-ssr/
├── .meteor/
│   ├── release              # METEOR@3.1
│   ├── packages             # blaze-html-templates, webapp, mongo, etc.
│   └── platforms
├── imports/
│   └── templates/
│       ├── pages.html       # Shared templates (page + email)
│       └── setup.js         # Template helpers, imported by both client & server
├── client/
│   ├── main.html            # Client-side <body> + interactiveDemo template
│   ├── main.js              # Client entry — imports templates, adds reactivity
│   └── styles.css           # Client styles
├── server/
│   └── main.js              # SSR routes via WebApp.connectHandlers
├── package.json
└── README.md
```

## How SSR Works in Meteor

### Shared Templates

Templates in `imports/templates/pages.html` are compiled at build time by the `blaze-html-templates` package. Both the client and server import `imports/templates/setup.js`, which registers the templates and global helpers:

```js
// imports/templates/setup.js
import { Template } from 'meteor/templating';
import './pages.html';

Template.registerHelper('year', () => new Date().getFullYear());
```

### Server Rendering

On the server, `Blaze.toHTMLWithData()` renders a template with data to an HTML string — no DOM required:

```js
// server/main.js
import { Blaze } from 'meteor/blaze';
import { Template } from 'meteor/templating';
import { WebApp } from 'meteor/webapp';

// Import shared templates
import '../imports/templates/setup';

WebApp.connectHandlers.use('/ssr/todos', (req, res) => {
  const html = Blaze.toHTMLWithData(Template.todoList, {
    todos: [
      { text: 'Buy groceries', completed: false },
      { text: 'Walk the dog', completed: true },
    ],
    activeCount: 1,
  });
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(html);
});
```

### Email Templates

The same SSR approach works for generating email HTML. Define email templates with inline styles (email clients ignore `<style>` blocks), then render them server-side:

```js
const emailHtml = Blaze.toHTMLWithData(Template.emailWelcome, {
  name: 'Alice',
  username: 'alice',
  plan: 'Pro',
  features: ['Unlimited projects', 'Priority support'],
});
// Send emailHtml via your email service (Mailgun, SES, etc.)
```

## Key Concepts

| Concept | Client | Server |
|---|---|---|
| Template compilation | Build-time (`.html` → JS) | Build-time (same) |
| Template access | `Template.myTemplate` | `Template.myTemplate` |
| Rendering | `Blaze.render()` → DOM | `Blaze.toHTMLWithData()` → string |
| Reactivity | Full (Tracker + ReactiveVar) | None (static render) |
| Use cases | Interactive UI | SEO, emails, PDFs, crawlers |
