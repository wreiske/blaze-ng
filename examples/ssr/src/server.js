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
import { wrapInLayout, CHAT_SCRIPT } from './templates.js';

const app = express();
app.use(express.json());
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

const chatHistory = {
  channelName: 'general',
  participants: [
    { name: 'Alice Chen', initials: 'AC', color: '#3b82f6' },
    { name: 'Bob Smith', initials: 'BS', color: '#8b5cf6' },
    { name: 'Carol Diaz', initials: 'CD', color: '#ec4899' },
    { name: 'Dave Kim', initials: 'DK', color: '#f59e0b' },
  ],
  messageGroups: [
    {
      date: 'Yesterday',
      messages: [
        {
          sender: 'Alice Chen',
          initials: 'AC',
          avatarColor: '#3b82f6',
          text: 'Hey team! I just pushed the new SSR example using Blaze-NG. Check it out when you get a chance 🚀',
          time: '2:34 PM',
          direction: 'sent',
          reactions: ['🔥', '👍'],
        },
        {
          sender: 'Bob Smith',
          initials: 'BS',
          avatarColor: '#8b5cf6',
          text: 'Nice! How does the template compilation work on the server side?',
          time: '2:36 PM',
          direction: 'received',
        },
        {
          sender: 'Alice Chen',
          initials: 'AC',
          avatarColor: '#3b82f6',
          text: 'Spacebars compiles to render functions at startup, then toHTMLWithData() renders them to strings. Same templates could be used client-side too.',
          time: '2:38 PM',
          direction: 'sent',
        },
        {
          sender: 'Carol Diaz',
          initials: 'CD',
          avatarColor: '#ec4899',
          text: "That's awesome! I love that we can share templates between server and client. What's the bundle size like?",
          time: '2:41 PM',
          direction: 'received',
          reactions: ['💯'],
        },
        {
          sender: 'Alice Chen',
          initials: 'AC',
          avatarColor: '#3b82f6',
          text: 'About 18.5 KB gzipped for the full runtime. Pretty lightweight.',
          time: '2:43 PM',
          direction: 'sent',
        },
      ],
    },
    {
      date: 'Today',
      messages: [
        {
          sender: 'Dave Kim',
          initials: 'DK',
          avatarColor: '#f59e0b',
          text: 'Morning everyone! Just reviewed the SSR code. The Express integration is really clean.',
          time: '9:15 AM',
          direction: 'received',
        },
        {
          sender: 'Dave Kim',
          initials: 'DK',
          avatarColor: '#f59e0b',
          text: 'I especially like the defineTemplate() pattern — compile once, render many times.',
          time: '9:16 AM',
          direction: 'received',
          image: 'screenshot-ssr-code.png',
        },
        {
          sender: 'Bob Smith',
          initials: 'BS',
          avatarColor: '#8b5cf6',
          text: 'Agreed. I ran some benchmarks — rendering the todo page takes under 1ms. The feature cards page is around 0.5ms.',
          time: '9:22 AM',
          direction: 'received',
          reactions: ['⚡', '🎉'],
        },
        {
          sender: 'Carol Diaz',
          initials: 'CD',
          avatarColor: '#ec4899',
          text: "Can we use this for email templates too? We've been looking for something to replace our current email renderer.",
          time: '9:30 AM',
          direction: 'received',
        },
        {
          sender: 'Alice Chen',
          initials: 'AC',
          avatarColor: '#3b82f6',
          text: 'Absolutely! toHTML() gives you a plain HTML string — works perfectly for emails. No DOM needed.',
          time: '9:33 AM',
          direction: 'sent',
          reactions: ['🙌', '📧'],
        },
        {
          sender: 'Bob Smith',
          initials: 'BS',
          avatarColor: '#8b5cf6',
          text: "Let's add an email template example to the demo. I can take that on.",
          time: '9:35 AM',
          direction: 'received',
        },
        {
          sender: 'Alice Chen',
          initials: 'AC',
          avatarColor: '#3b82f6',
          text: "Sounds great! 🎯 Let's sync on it after lunch.",
          time: '9:37 AM',
          direction: 'sent',
        },
      ],
    },
  ],
};

// ─── Helper: render a page inside the layout ─────────────────────────────────

function renderPage(title, contentTemplate, data = {}, options = {}) {
  const content = toHTMLWithData(contentTemplate, data);
  return wrapInLayout(title, content, options);
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

function formatTime(d) {
  let h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${m < 10 ? '0' : ''}${m} ${ampm}`;
}

app.get('/chat', (req, res) => {
  const messageCount = chatHistory.messageGroups.reduce((sum, g) => sum + g.messages.length, 0);
  const html = renderPage(
    'Chat',
    Template.chatPage,
    {
      ...chatHistory,
      messageCount,
      typingText: '',
    },
    { script: CHAT_SCRIPT },
  );
  res.type('html').send(html);
});

app.post('/chat', (req, res) => {
  const { text } = req.body;
  if (!text || typeof text !== 'string' || !text.trim()) {
    return res.status(400).json({ error: 'Message text is required' });
  }

  const now = new Date();
  const todayStr = 'Today';
  const message = {
    sender: 'Alice Chen',
    initials: 'AC',
    avatarColor: '#3b82f6',
    text: text.trim(),
    time: formatTime(now),
    direction: 'sent',
  };

  // Append to today's group, or create one
  const lastGroup = chatHistory.messageGroups[chatHistory.messageGroups.length - 1];
  if (lastGroup && lastGroup.date === todayStr) {
    lastGroup.messages.push(message);
  } else {
    chatHistory.messageGroups.push({ date: todayStr, messages: [message] });
  }

  res.json({ ok: true, message });
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
  console.log('     GET /chat          — Chat with message history');
});
