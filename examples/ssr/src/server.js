/**
 * Blaze-NG SSR Example — Express server rendering Blaze templates to HTML.
 *
 * Demonstrates:
 * - Server-side rendering with Blaze.toHTML() / Blaze.toHTMLWithData()
 * - Layout composition (nested template rendering)
 * - Route handling with dynamic data
 * - Multiple page templates
 */
import express from 'express';
import { Template, toHTMLWithData, _escape, setReactiveSystem } from '@blaze-ng/core';
import { SimpleReactiveSystem } from '@blaze-ng/core/testing';
import { ObserveSequence } from '@blaze-ng/observe-sequence';

// Set up a reactive system (required by both Blaze-NG core and ObserveSequence)
const reactive = new SimpleReactiveSystem();
setReactiveSystem(reactive);
ObserveSequence.setReactiveSystem(reactive);

// Import and register all templates (side effect: populates Template registry)
import { wrapInLayout } from './templates.js';

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Sample data ─────────────────────────────────────────────────────────────

const features = [
  { icon: '⚡', title: 'Fast', description: 'Server-rendered HTML for instant page loads' },
  { icon: '🔍', title: 'SEO Ready', description: 'Full HTML sent to search engine crawlers' },
  { icon: '📧', title: 'Email Ready', description: 'Generate email HTML from the same templates' },
  { icon: '🚀', title: 'No JS Required', description: 'Pages work without client-side JavaScript' },
  { icon: '🎨', title: 'Spacebars', description: 'Use the same Spacebars syntax you already know' },
  { icon: '📦', title: 'Lightweight', description: 'Zero runtime dependencies, ~18 KB gzipped' },
];

const todos = [
  { text: 'Set up Express server', completed: true },
  { text: 'Define Spacebars templates', completed: true },
  { text: 'Render with Blaze.toHTMLWithData()', completed: true },
  { text: 'Add layout composition', completed: true },
  { text: 'Deploy to production', completed: false },
  { text: 'Add client-side hydration', completed: false },
];

const users = {
  alice: {
    name: 'Alice Chen',
    email: 'alice@example.com',
    bio: 'Full-stack developer and open source contributor. Loves building fast, accessible web applications.',
    stats: [
      { value: '142', label: 'Projects' },
      { value: '1.2k', label: 'Contributions' },
      { value: '89', label: 'Stars' },
    ],
  },
  bob: {
    name: 'Bob Smith',
    email: 'bob@example.com',
    bio: 'DevOps engineer focused on infrastructure automation and monitoring.',
    stats: [
      { value: '67', label: 'Projects' },
      { value: '830', label: 'Contributions' },
      { value: '45', label: 'Stars' },
    ],
  },
};

// ─── Helper: render a page inside the layout ─────────────────────────────────

function renderPage(title, contentTemplate, data = {}) {
  const content = toHTMLWithData(contentTemplate, data);
  return wrapInLayout(title, content);
}

// ─── Routes ──────────────────────────────────────────────────────────────────

app.get('/', (req, res) => {
  const html = renderPage('Home', Template.homePage, { features });
  res.type('html').send(html);
});

app.get('/todos', (req, res) => {
  const activeCount = todos.filter((t) => !t.completed).length;
  const html = renderPage('Todos', Template.todosPage, { todos, activeCount });
  res.type('html').send(html);
});

app.get('/profile/:username', (req, res) => {
  const user = users[req.params.username];
  if (!user) {
    const html = renderPage('Not Found', Template.notFound);
    return res.status(404).type('html').send(html);
  }
  const html = renderPage(user.name, Template.profilePage, { user, stats: user.stats });
  res.type('html').send(html);
});

app.use((req, res) => {
  const html = renderPage('Not Found', Template.notFound);
  res.status(404).type('html').send(html);
});

// ─── Start ───────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`🚀 Blaze-NG SSR running at http://localhost:${PORT}`);
  console.log('   Routes:');
  console.log('     GET /              — Home page with feature cards');
  console.log('     GET /todos         — Server-rendered todo list');
  console.log('     GET /profile/alice — User profile page');
  console.log('     GET /profile/bob   — Another profile');
});
