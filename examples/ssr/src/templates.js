/**
 * Template definitions for the SSR example.
 *
 * Each template is defined as a Spacebars string, compiled at startup,
 * and registered in the global Blaze template registry.
 */
import { Template, registerHelper, _escape } from '@blaze-ng/core';
import { defineTemplate } from './compile.js';

// ─── Global helpers ──────────────────────────────────────────────────────────

registerHelper('year', () => new Date().getFullYear());

registerHelper('pluralize', (count, singular, plural) => (count === 1 ? singular : plural));

registerHelper('eq', (a, b) => a === b);

// ─── Layout function ─────────────────────────────────────────────────────────
// Spacebars cannot parse <!DOCTYPE>, <html>, <head>, or <body> tags.
// The layout is a plain JS function that wraps rendered content in a full document.

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function wrapInLayout(title, contentHtml) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)} — Blaze-NG SSR</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: system-ui, -apple-system, sans-serif; background: #f8fafc; color: #1e293b; }
    nav { display: flex; align-items: center; gap: 2rem; padding: 1rem 2rem; background: white; border-bottom: 1px solid #e2e8f0; }
    nav .logo { font-weight: 700; font-size: 1.125rem; color: #0f172a; text-decoration: none; }
    nav a { color: #64748b; text-decoration: none; font-size: 0.9rem; }
    nav a:hover { color: #3b82f6; }
    main { max-width: 48rem; margin: 2rem auto; padding: 0 1rem; }
    footer { max-width: 48rem; margin: 3rem auto; padding: 2rem 1rem; text-align: center; color: #94a3b8; font-size: 0.8rem; border-top: 1px solid #e2e8f0; }
    .hero { text-align: center; padding: 3rem 0; }
    .hero h1 { font-size: 2.5rem; font-weight: 700; margin-bottom: 0.5rem; }
    .hero p { color: #64748b; font-size: 1.125rem; }
    .features { display: grid; grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr)); gap: 1.5rem; margin-top: 2rem; }
    .feature-card { background: white; padding: 1.5rem; border-radius: 0.75rem; box-shadow: 0 1px 3px rgba(0,0,0,0.06); }
    .feature-card .icon { font-size: 2rem; }
    .feature-card h3 { margin: 0.5rem 0 0.25rem; font-size: 1rem; }
    .feature-card p { color: #64748b; font-size: 0.875rem; }
    .profile { background: white; padding: 2rem; border-radius: 0.75rem; box-shadow: 0 1px 3px rgba(0,0,0,0.06); }
    .profile h2 { font-size: 1.25rem; margin-bottom: 0.25rem; }
    .profile .email { color: #64748b; font-size: 0.9rem; }
    .profile .bio { margin-top: 1rem; line-height: 1.6; }
    .profile .stats { display: flex; gap: 2rem; margin-top: 1.5rem; padding-top: 1rem; border-top: 1px solid #e2e8f0; }
    .stat { text-align: center; }
    .stat .value { font-size: 1.5rem; font-weight: 700; color: #3b82f6; }
    .stat .label { font-size: 0.75rem; color: #94a3b8; }
    .todo-page h2 { font-size: 1.5rem; margin-bottom: 1rem; }
    .todo-page ul { list-style: none; background: white; border-radius: 0.75rem; box-shadow: 0 1px 3px rgba(0,0,0,0.06); overflow: hidden; }
    .todo-page li { padding: 0.75rem 1.5rem; border-bottom: 1px solid #f1f5f9; display: flex; align-items: center; gap: 0.75rem; }
    .todo-page li:last-child { border-bottom: none; }
    .todo-page .done { text-decoration: line-through; color: #94a3b8; }
    .todo-page .check { color: #22c55e; }
    .todo-page .pending { color: #e2e8f0; }
    .not-found { text-align: center; padding: 4rem 0; }
    .not-found h1 { font-size: 4rem; font-weight: 200; color: #94a3b8; }
    .not-found p { margin-top: 0.5rem; color: #64748b; }
    .not-found a { display: inline-block; margin-top: 1.5rem; color: #3b82f6; }
  </style>
</head>
<body>
  <nav>
    <a href="/" class="logo">Blaze-NG SSR</a>
    <a href="/">Home</a>
    <a href="/todos">Todos</a>
    <a href="/profile/alice">Profile</a>
  </nav>
  <main>${contentHtml}</main>
  <footer>
    &copy; ${new Date().getFullYear()} Blaze-NG &middot; Server-side rendered
  </footer>
</body>
</html>`;
}

// ─── Home page ───────────────────────────────────────────────────────────────

defineTemplate(
  'homePage',
  `
<div class="hero">
  <h1>⚡ Blaze-NG SSR</h1>
  <p>Server-side rendered templates with Blaze-NG</p>
</div>
<div class="features">
  {{#each feature in features}}
    {{> featureCard feature}}
  {{/each}}
</div>
`,
);

defineTemplate(
  'featureCard',
  `
<div class="feature-card">
  <div class="icon">{{icon}}</div>
  <h3>{{title}}</h3>
  <p>{{description}}</p>
</div>
`,
);

// ─── Todos page ──────────────────────────────────────────────────────────────

defineTemplate(
  'todosPage',
  `
<div class="todo-page">
  <h2>📋 Server-Rendered Todos</h2>
  <p style="color: #64748b; margin-bottom: 1rem;">
    {{activeCount}} {{pluralize activeCount "item" "items"}} remaining
  </p>
  <ul>
    {{#each todo in todos}}
      {{> todoItemSSR todo}}
    {{/each}}
  </ul>
</div>
`,
);

defineTemplate(
  'todoItemSSR',
  `
<li>
  <span class="{{#if completed}}check{{else}}pending{{/if}}">
    {{#if completed}}✓{{else}}○{{/if}}
  </span>
  <span class="{{#if completed}}done{{/if}}">{{text}}</span>
</li>
`,
);

// ─── Profile page ────────────────────────────────────────────────────────────

defineTemplate(
  'profilePage',
  `
<div class="profile">
  <h2>{{user.name}}</h2>
  <div class="email">{{user.email}}</div>
  <div class="bio">{{user.bio}}</div>
  <div class="stats">
    {{#each stat in stats}}
      <div class="stat">
        <div class="value">{{stat.value}}</div>
        <div class="label">{{stat.label}}</div>
      </div>
    {{/each}}
  </div>
</div>
`,
);

// ─── 404 page ────────────────────────────────────────────────────────────────

defineTemplate(
  'notFound',
  `
<div class="not-found">
  <h1>404</h1>
  <p>Page not found</p>
  <a href="/">← Back to home</a>
</div>
`,
);
