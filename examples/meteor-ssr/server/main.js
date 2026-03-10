import { Meteor } from 'meteor/meteor';
import { Blaze } from 'meteor/blaze';
import { Template } from 'meteor/templating';
import { WebApp } from 'meteor/webapp';
import { onPageLoad } from 'meteor/server-render';
import { Messages } from '../imports/api/messages';

// Import shared templates + helpers so they register on the server
import '../imports/templates/setup';
import '../imports/templates/app';
import '../imports/templates/chat';

// ─── Utility ─────────────────────────────────────────────────────────────────

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function pluralize(count, singular, plural) {
  return count === 1 ? singular : plural;
}

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
  { text: 'Set up Meteor app', completed: true },
  { text: 'Define shared templates', completed: true },
  { text: 'Add SSR routes with WebApp', completed: true },
  { text: 'Render email templates server-side', completed: true },
  { text: 'Deploy to Galaxy', completed: false },
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

// ─── Publication ─────────────────────────────────────────────────────────────

Meteor.publish('messages', function () {
  return Messages.find({}, { sort: { createdAt: 1 } });
});

// ─── Method ──────────────────────────────────────────────────────────────────

function formatTime(d) {
  let h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${m < 10 ? '0' : ''}${m} ${ampm}`;
}

Meteor.methods({
  'messages.insert'(text) {
    if (!text || typeof text !== 'string' || !text.trim()) {
      throw new Meteor.Error('invalid-message', 'Message text is required');
    }
    const now = new Date();
    return Messages.insertAsync({
      sender: 'Alice Chen',
      initials: 'AC',
      avatarColor: '#3b82f6',
      text: text.trim(),
      time: formatTime(now),
      direction: 'sent',
      createdAt: now,
    });
  },
});

// ─── Seed data ───────────────────────────────────────────────────────────────

const seedMessages = [
  {
    sender: 'Alice Chen',
    initials: 'AC',
    avatarColor: '#3b82f6',
    text: 'Hey team! I just pushed the new SSR example using Blaze-NG. Check it out when you get a chance \uD83D\uDE80',
    time: '2:34 PM',
    direction: 'sent',
    reactions: ['\uD83D\uDD25', '\uD83D\uDC4D'],
    createdAt: new Date(Date.now() - 86400000 + 0),
  },
  {
    sender: 'Bob Smith',
    initials: 'BS',
    avatarColor: '#8b5cf6',
    text: 'Nice! How does the template compilation work on the server side?',
    time: '2:36 PM',
    direction: 'received',
    createdAt: new Date(Date.now() - 86400000 + 120000),
  },
  {
    sender: 'Alice Chen',
    initials: 'AC',
    avatarColor: '#3b82f6',
    text: 'Spacebars compiles to render functions at startup, then toHTMLWithData() renders them to strings. Same templates could be used client-side too.',
    time: '2:38 PM',
    direction: 'sent',
    createdAt: new Date(Date.now() - 86400000 + 240000),
  },
  {
    sender: 'Carol Diaz',
    initials: 'CD',
    avatarColor: '#ec4899',
    text: "That's awesome! I love that we can share templates between server and client. What's the bundle size like?",
    time: '2:41 PM',
    direction: 'received',
    reactions: ['\uD83D\uDCAF'],
    createdAt: new Date(Date.now() - 86400000 + 420000),
  },
  {
    sender: 'Alice Chen',
    initials: 'AC',
    avatarColor: '#3b82f6',
    text: 'About 18.5 KB gzipped for the full runtime. Pretty lightweight.',
    time: '2:43 PM',
    direction: 'sent',
    createdAt: new Date(Date.now() - 86400000 + 540000),
  },
  {
    sender: 'Dave Kim',
    initials: 'DK',
    avatarColor: '#f59e0b',
    text: 'Morning everyone! Just reviewed the SSR code. The Express integration is really clean.',
    time: '9:15 AM',
    direction: 'received',
    createdAt: new Date(Date.now() - 3600000 * 5),
  },
  {
    sender: 'Dave Kim',
    initials: 'DK',
    avatarColor: '#f59e0b',
    text: 'I especially like the defineTemplate() pattern \u2014 compile once, render many times.',
    time: '9:16 AM',
    direction: 'received',
    image: 'screenshot-ssr-code.png',
    createdAt: new Date(Date.now() - 3600000 * 5 + 60000),
  },
  {
    sender: 'Bob Smith',
    initials: 'BS',
    avatarColor: '#8b5cf6',
    text: 'Agreed. I ran some benchmarks \u2014 rendering the todo page takes under 1ms. The feature cards page is around 0.5ms.',
    time: '9:22 AM',
    direction: 'received',
    reactions: ['\u26A1', '\uD83C\uDF89'],
    createdAt: new Date(Date.now() - 3600000 * 5 + 420000),
  },
  {
    sender: 'Carol Diaz',
    initials: 'CD',
    avatarColor: '#ec4899',
    text: "Can we use this for email templates too? We've been looking for something to replace our current email renderer.",
    time: '9:30 AM',
    direction: 'received',
    createdAt: new Date(Date.now() - 3600000 * 5 + 900000),
  },
  {
    sender: 'Alice Chen',
    initials: 'AC',
    avatarColor: '#3b82f6',
    text: 'Absolutely! toHTML() gives you a plain HTML string \u2014 works perfectly for emails. No DOM needed.',
    time: '9:33 AM',
    direction: 'sent',
    reactions: ['\uD83D\uDE4C', '\uD83D\uDCE7'],
    createdAt: new Date(Date.now() - 3600000 * 5 + 1080000),
  },
  {
    sender: 'Bob Smith',
    initials: 'BS',
    avatarColor: '#8b5cf6',
    text: "Let's add an email template example to the demo. I can take that on.",
    time: '9:35 AM',
    direction: 'received',
    createdAt: new Date(Date.now() - 3600000 * 5 + 1200000),
  },
  {
    sender: 'Alice Chen',
    initials: 'AC',
    avatarColor: '#3b82f6',
    text: "Sounds great! \uD83C\uDFAF Let's sync on it after lunch.",
    time: '9:37 AM',
    direction: 'sent',
    createdAt: new Date(Date.now() - 3600000 * 5 + 1320000),
  },
];

async function seedChatMessages() {
  const count = await Messages.find().countAsync();
  if (count === 0) {
    for (const msg of seedMessages) {
      await Messages.insertAsync(msg);
    }
    console.log(`Seeded ${seedMessages.length} chat messages`);
  }
}

// ─── Layout wrapper ──────────────────────────────────────────────────────────

function wrapInLayout(title, contentHtml, { script } = {}) {
  const extraScript = script || '';
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)} — Blaze-NG Meteor SSR</title>
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
    .ssr-page { padding: 1rem 0; }
    .ssr-page h2 { font-size: 1.5rem; margin-bottom: 0.5rem; }
    .ssr-page .subtitle { color: #64748b; margin-bottom: 1.5rem; }
    .ssr-card { background: white; padding: 1.5rem; border-radius: 0.75rem; box-shadow: 0 1px 3px rgba(0,0,0,0.06); margin-bottom: 1rem; }
    .ssr-card .ssr-card-icon { font-size: 2rem; }
    .ssr-card h3 { margin: 0.5rem 0 0.25rem; font-size: 1rem; }
    .ssr-card p { color: #64748b; font-size: 0.875rem; }
    .features-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr)); gap: 1rem; }
    .profile-card { background: white; padding: 2rem; border-radius: 0.75rem; box-shadow: 0 1px 3px rgba(0,0,0,0.06); }
    .profile-avatar { width: 4rem; height: 4rem; background: #3b82f6; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 1.25rem; font-weight: 700; margin-bottom: 1rem; }
    .profile-card h2 { font-size: 1.25rem; margin-bottom: 0.25rem; }
    .profile-email { color: #64748b; font-size: 0.9rem; }
    .profile-bio { margin-top: 1rem; line-height: 1.6; }
    .profile-stats { display: flex; gap: 2rem; margin-top: 1.5rem; padding-top: 1rem; border-top: 1px solid #e2e8f0; }
    .stat { text-align: center; }
    .stat-value { font-size: 1.5rem; font-weight: 700; color: #3b82f6; }
    .stat-label { font-size: 0.75rem; color: #94a3b8; }
    .todo-page h2 { font-size: 1.5rem; margin-bottom: 0.5rem; }
    .todo-summary { color: #64748b; margin-bottom: 1rem; }
    .todo-items { list-style: none; background: white; border-radius: 0.75rem; box-shadow: 0 1px 3px rgba(0,0,0,0.06); overflow: hidden; }
    .todo-item-ssr { padding: 0.75rem 1.5rem; border-bottom: 1px solid #f1f5f9; display: flex; align-items: center; gap: 0.75rem; }
    .todo-item-ssr:last-child { border-bottom: none; }
    .todo-item-ssr.done .todo-text { text-decoration: line-through; color: #94a3b8; }
    .todo-check { font-size: 1rem; }
    .todo-item-ssr.done .todo-check { color: #22c55e; }
    .todo-item-ssr:not(.done) .todo-check { color: #e2e8f0; }
    .not-found { text-align: center; padding: 4rem 0; }
    .not-found h1 { font-size: 4rem; font-weight: 200; color: #94a3b8; }
    .not-found p { margin-top: 0.5rem; color: #64748b; }
    .not-found a { display: inline-block; margin-top: 1.5rem; color: #3b82f6; }
    .email-preview { background: #e2e8f0; padding: 2rem; border-radius: 0.75rem; }
    .email-preview-label { font-size: 0.75rem; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 1rem; font-weight: 600; }
    .chat { max-width: 100%; }
    .chat h2 { font-size: 1.5rem; margin-bottom: 0.25rem; }
    .chat .subtitle { color: #64748b; font-size: 0.9rem; margin-bottom: 1.5rem; }
    .chat-window { background: white; border-radius: 0.75rem; box-shadow: 0 1px 3px rgba(0,0,0,0.06); overflow: hidden; }
    .chat-date { text-align: center; padding: 0.75rem; font-size: 0.75rem; color: #94a3b8; font-weight: 500; }
    .chat-messages { padding: 0.5rem 1rem; display: flex; flex-direction: column; gap: 0.75rem; }
    .msg { display: flex; gap: 0.75rem; max-width: 85%; }
    .msg.sent { flex-direction: row-reverse; margin-left: auto; }
    .msg-avatar { width: 2rem; height: 2rem; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.75rem; font-weight: 600; color: white; flex-shrink: 0; }
    .msg-body { display: flex; flex-direction: column; gap: 0.125rem; }
    .msg-sender { font-size: 0.75rem; font-weight: 600; color: #475569; }
    .msg.sent .msg-sender { text-align: right; }
    .msg-bubble { padding: 0.625rem 0.875rem; border-radius: 1rem; font-size: 0.875rem; line-height: 1.4; }
    .msg.received .msg-bubble { background: #f1f5f9; border-top-left-radius: 0.25rem; }
    .msg.sent .msg-bubble { background: #3b82f6; color: white; border-top-right-radius: 0.25rem; }
    .msg-time { font-size: 0.675rem; color: #94a3b8; }
    .msg.sent .msg-time { text-align: right; }
    .msg-image { margin-top: 0.375rem; border-radius: 0.5rem; font-size: 0.8rem; color: #64748b; font-style: italic; background: #f8fafc; padding: 2rem; text-align: center; border: 1px dashed #e2e8f0; }
    .msg-reactions { display: flex; gap: 0.25rem; margin-top: 0.25rem; }
    .msg.sent .msg-reactions { justify-content: flex-end; }
    .reaction { font-size: 0.75rem; background: #f1f5f9; border-radius: 1rem; padding: 0.125rem 0.375rem; }
    .chat-compose { display: flex; gap: 0.75rem; padding: 1rem; border-top: 1px solid #e2e8f0; align-items: center; }
    .chat-compose input { flex: 1; padding: 0.625rem 1rem; border: 1px solid #e2e8f0; border-radius: 1.5rem; font-size: 0.875rem; outline: none; background: #f8fafc; }
    .chat-compose button { background: #3b82f6; color: white; border: none; border-radius: 50%; width: 2.25rem; height: 2.25rem; font-size: 1rem; cursor: pointer; display: flex; align-items: center; justify-content: center; }
    .chat-participants { display: flex; gap: 0.5rem; margin-bottom: 1rem; flex-wrap: wrap; }
    .participant-chip { display: flex; align-items: center; gap: 0.375rem; background: white; border-radius: 2rem; padding: 0.25rem 0.75rem 0.25rem 0.25rem; font-size: 0.8rem; box-shadow: 0 1px 3px rgba(0,0,0,0.06); }
    .participant-chip .chip-avatar { width: 1.5rem; height: 1.5rem; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.6rem; font-weight: 600; color: white; }
  </style>
</head>
<body>
  <nav>
    <a href="/" class="logo">Blaze-NG Meteor SSR</a>
    <a href="/ssr">Home</a>
    <a href="/ssr/todos">Todos</a>
    <a href="/ssr/profile/alice">Profile</a>
    <a href="/ssr/chat">Chat</a>
    <a href="/ssr/email/welcome">Email</a>
    <a href="/">← Client App</a>
  </nav>
  <main>${contentHtml}</main>
  ${extraScript}
  <footer>
    &copy; ${new Date().getFullYear()} Blaze-NG &middot; Server-side rendered by Meteor
  </footer>
</body>
</html>`;
}

// ─── SSR render functions ────────────────────────────────────────────────────

function renderSsrPage({ title, subtitle, items }) {
  const cards = items
    .map(
      (item) => `
    <div class="ssr-card">
      <div class="ssr-card-icon">${escapeHtml(item.icon)}</div>
      <h3>${escapeHtml(item.title)}</h3>
      <p>${escapeHtml(item.description)}</p>
    </div>`,
    )
    .join('');
  return `
    <div class="ssr-page">
      <h2>${escapeHtml(title)}</h2>
      <p class="subtitle">${escapeHtml(subtitle)}</p>
      <div class="features-grid">${cards}</div>
    </div>`;
}

function renderTodos({ todos, activeCount }) {
  const items = todos
    .map(
      (todo) => `
    <li class="todo-item-ssr${todo.completed ? ' done' : ''}">
      <span class="todo-check">${todo.completed ? '✓' : '○'}</span>
      <span class="todo-text">${escapeHtml(todo.text)}</span>
    </li>`,
    )
    .join('');
  return `
    <div class="todo-page">
      <h2>Server-Rendered Todos</h2>
      <p class="todo-summary">
        ${activeCount} ${pluralize(activeCount, 'item', 'items')} remaining
      </p>
      <ul class="todo-items">${items}</ul>
    </div>`;
}

function renderUserProfile(user) {
  const initials = user.name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase();
  const stats = user.stats
    .map(
      (s) => `
    <div class="stat">
      <div class="stat-value">${escapeHtml(s.value)}</div>
      <div class="stat-label">${escapeHtml(s.label)}</div>
    </div>`,
    )
    .join('');
  return `
    <div class="profile-card">
      <div class="profile-avatar">${escapeHtml(initials)}</div>
      <h2>${escapeHtml(user.name)}</h2>
      <p class="profile-email">${escapeHtml(user.email)}</p>
      <p class="profile-bio">${escapeHtml(user.bio)}</p>
      <div class="profile-stats">${stats}</div>
    </div>`;
}

function renderEmailWelcome(data) {
  const featureItems = (data.features || [])
    .map((f) => `<li style="margin-bottom: 0.25rem;">${escapeHtml(f)}</li>`)
    .join('');
  return `
    <table width="600" cellpadding="0" cellspacing="0" style="margin: 0 auto; font-family: system-ui, -apple-system, sans-serif; background: #ffffff;">
      <tr><td style="background: #3b82f6; padding: 2rem; text-align: center;">
        <h1 style="color: #ffffff; margin: 0; font-size: 1.5rem;">Welcome to Blaze-NG!</h1>
      </td></tr>
      <tr><td style="padding: 2rem;">
        <p style="font-size: 1rem; line-height: 1.6; color: #1e293b;">Hi ${escapeHtml(data.name)},</p>
        <p style="font-size: 1rem; line-height: 1.6; color: #475569; margin-top: 1rem;">
          Thanks for signing up! Your account has been created successfully.
        </p>
        <table width="100%" cellpadding="12" cellspacing="0" style="margin-top: 1.5rem; border: 1px solid #e2e8f0;">
          <tr style="background: #f8fafc;">
            <td style="font-weight: 600; color: #64748b; font-size: 0.875rem;">Username</td>
            <td style="color: #1e293b;">${escapeHtml(data.username)}</td>
          </tr>
          <tr>
            <td style="font-weight: 600; color: #64748b; font-size: 0.875rem;">Email</td>
            <td style="color: #1e293b;">${escapeHtml(data.email)}</td>
          </tr>
          <tr style="background: #f8fafc;">
            <td style="font-weight: 600; color: #64748b; font-size: 0.875rem;">Plan</td>
            <td style="color: #1e293b;">${escapeHtml(data.plan)}</td>
          </tr>
        </table>
        ${featureItems ? `<p style="font-size: 0.875rem; color: #475569; margin-top: 1.5rem; font-weight: 600;">Your plan includes:</p><ul style="margin-top: 0.5rem; padding-left: 1.5rem; color: #475569;">${featureItems}</ul>` : ''}
      </td></tr>
      <tr><td style="padding: 1.5rem 2rem; background: #f8fafc; text-align: center; font-size: 0.75rem; color: #94a3b8;">
        &copy; ${new Date().getFullYear()} Blaze-NG &middot; This email was server-rendered
      </td></tr>
    </table>`;
}

function renderEmailNotification(data) {
  const actionBtn = data.actionUrl
    ? `<p style="margin-top: 1.5rem; text-align: center;">
        <a href="${escapeHtml(data.actionUrl)}" style="display: inline-block; padding: 0.75rem 2rem; background: #3b82f6; color: #ffffff; text-decoration: none; border-radius: 0.375rem; font-weight: 600; font-size: 0.9rem;">
          ${escapeHtml(data.actionLabel)}
        </a>
      </p>`
    : '';
  return `
    <table width="600" cellpadding="0" cellspacing="0" style="margin: 0 auto; font-family: system-ui, -apple-system, sans-serif; background: #ffffff;">
      <tr><td style="background: #0f172a; padding: 1.5rem 2rem;">
        <span style="color: #ffffff; font-weight: 700; font-size: 1rem;">Blaze-NG</span>
      </td></tr>
      <tr><td style="padding: 2rem;">
        <p style="font-size: 1rem; line-height: 1.6; color: #1e293b;">Hi ${escapeHtml(data.name)},</p>
        <p style="font-size: 1rem; line-height: 1.6; color: #475569; margin-top: 1rem;">${escapeHtml(data.message)}</p>
        ${actionBtn}
      </td></tr>
      <tr><td style="padding: 1rem 2rem; text-align: center; font-size: 0.75rem; color: #94a3b8;">
        &copy; ${new Date().getFullYear()} Blaze-NG
      </td></tr>
    </table>`;
}

// ─── SSR render function for chat (uses MongoDB) ────────────────────────────

const CHAT_PARTICIPANTS = [
  { name: 'Alice Chen', initials: 'AC', color: '#3b82f6' },
  { name: 'Bob Smith', initials: 'BS', color: '#8b5cf6' },
  { name: 'Carol Diaz', initials: 'CD', color: '#ec4899' },
  { name: 'Dave Kim', initials: 'DK', color: '#f59e0b' },
];

function formatDateLabel(date) {
  const now = new Date();
  const d = new Date(date);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const msgDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());

  if (msgDay.getTime() === today.getTime()) return 'Today';
  if (msgDay.getTime() === yesterday.getTime()) return 'Yesterday';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function renderChatSSR(messages, messageCount) {
  const participantsHtml = CHAT_PARTICIPANTS.map(
    (p) => `
    <div class="participant-chip">
      <div class="chip-avatar" style="background:${escapeHtml(p.color)}">${escapeHtml(p.initials)}</div>
      ${escapeHtml(p.name)}
    </div>`,
  ).join('');

  // Group messages by date
  const groups = [];
  let currentDate = null;
  let currentGroup = null;
  messages.forEach((msg) => {
    const dateLabel = formatDateLabel(msg.createdAt);
    if (dateLabel !== currentDate) {
      currentDate = dateLabel;
      currentGroup = { date: dateLabel, messages: [] };
      groups.push(currentGroup);
    }
    currentGroup.messages.push(msg);
  });

  const groupsHtml = groups
    .map((group) => {
      const msgsHtml = group.messages
        .map((msg) => {
          const reactionsHtml = msg.reactions
            ? `<div class="msg-reactions">${msg.reactions.map((r) => `<span class="reaction">${r}</span>`).join('')}</div>`
            : '';
          const imageHtml = msg.image
            ? `<div class="msg-image">\uD83D\uDCCE ${escapeHtml(msg.image)}</div>`
            : '';
          return `
        <div class="msg ${escapeHtml(msg.direction)}">
          <div class="msg-avatar" style="background:${escapeHtml(msg.avatarColor)}">${escapeHtml(msg.initials)}</div>
          <div class="msg-body">
            <div class="msg-sender">${escapeHtml(msg.sender)}</div>
            <div class="msg-bubble">${escapeHtml(msg.text)}</div>
            ${imageHtml}
            ${reactionsHtml}
            <div class="msg-time">${escapeHtml(msg.time)}</div>
          </div>
        </div>`;
        })
        .join('');
      return `<div class="chat-date">${escapeHtml(group.date)}</div><div class="chat-messages">${msgsHtml}</div>`;
    })
    .join('');

  return `
    <div class="chat">
      <h2>#general</h2>
      <p class="subtitle">${messageCount} ${pluralize(messageCount, 'message', 'messages')} \u00B7 ${CHAT_PARTICIPANTS.length} participants</p>
      <div class="chat-participants">${participantsHtml}</div>
      <div class="chat-window" id="chatWindow">
        ${groupsHtml}
        <div class="chat-compose">
          <input type="text" id="chatInput" placeholder="Type a message\u2026" autocomplete="off" disabled />
          <button id="chatSend" aria-label="Send" disabled>\u27A4</button>
        </div>
      </div>
      <p style="margin-top: 1rem; color: #64748b; font-size: 0.85rem; text-align: center;">
        This is the SSR preview. <a href="/" style="color: #3b82f6;">Go to the client app</a> for the interactive chat with real-time reactivity.
      </p>
    </div>`;
}

// ─── SSR Routes via WebApp.connectHandlers ───────────────────────────────────

// ─── Client-page SSR (onPageLoad) ────────────────────────────────────────────
// Render the interactiveDemo template on the server using Blaze.toHTMLWithData.
// This uses the same Blaze templates as the client — no duplicated HTML.

onPageLoad(async (sink) => {
  const messages = await Messages.find({}, { sort: { createdAt: 1 } }).fetchAsync();
  const html = Blaze.toHTMLWithData(Template.interactiveDemo, { messages });
  sink.appendToBody(`<div id="app">${html}</div>`);
});

Meteor.startup(async () => {
  await seedChatMessages();

  // SSR chat page — reads from MongoDB
  WebApp.connectHandlers.use('/ssr/chat', async (req, res, next) => {
    if (req.url !== '/' && req.url !== '') return next();
    const messages = await Messages.find({}, { sort: { createdAt: 1 } }).fetchAsync();
    const messageCount = messages.length;
    const contentHtml = renderChatSSR(messages, messageCount);
    const html = wrapInLayout('Chat', contentHtml);
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
  });

  // Home page — feature cards
  WebApp.connectHandlers.use('/ssr/profile', (req, res, next) => {
    const username = req.url.replace(/^\//, '').split('/')[0];
    if (!username) return next();

    const user = users[username];
    if (!user) {
      const html = wrapInLayout(
        'Not Found',
        `
        <div class="not-found">
          <h1>404</h1>
          <p>User "${escapeHtml(username)}" not found</p>
          <a href="/ssr">← Back to home</a>
        </div>
      `,
      );
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);
      return;
    }

    const contentHtml = renderUserProfile(user);
    const html = wrapInLayout(user.name, contentHtml);
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
  });

  // Todos page
  WebApp.connectHandlers.use('/ssr/todos', (req, res) => {
    const activeCount = todos.filter((t) => !t.completed).length;
    const contentHtml = renderTodos({ todos, activeCount });
    const html = wrapInLayout('Todos', contentHtml);
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
  });

  // Email preview — welcome email
  WebApp.connectHandlers.use('/ssr/email/welcome', (req, res) => {
    const emailHtml = renderEmailWelcome({
      name: 'Alice',
      username: 'alice',
      email: 'alice@example.com',
      plan: 'Pro',
      features: ['Unlimited projects', 'Priority support', 'Custom domains', 'API access'],
    });
    const html = wrapInLayout(
      'Welcome Email',
      `
      <h2 style="margin-bottom: 0.5rem;">Email Template Preview</h2>
      <p style="color: #64748b; margin-bottom: 1.5rem;">
        This HTML was rendered server-side — ready to send via any email service.
      </p>
      <div class="email-preview">
        <div class="email-preview-label">Email Preview</div>
        ${emailHtml}
      </div>
    `,
    );
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
  });

  // Email preview — notification
  WebApp.connectHandlers.use('/ssr/email/notification', (req, res) => {
    const emailHtml = renderEmailNotification({
      name: 'Bob',
      message:
        'Your deployment to production completed successfully. All 12 tests passed and the app is live.',
      actionUrl: 'https://example.com/dashboard',
      actionLabel: 'View Dashboard',
    });
    const html = wrapInLayout(
      'Notification Email',
      `
      <h2 style="margin-bottom: 0.5rem;">Notification Email Preview</h2>
      <p style="color: #64748b; margin-bottom: 1.5rem;">
        Another email template rendered server-side — useful for notifications, digests, and alerts.
      </p>
      <div class="email-preview">
        <div class="email-preview-label">Email Preview</div>
        ${emailHtml}
      </div>
    `,
    );
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
  });

  // SSR home page (must be last — catches /ssr and /ssr/)
  WebApp.connectHandlers.use('/ssr', (req, res, next) => {
    // Only handle exact /ssr or /ssr/ — let other /ssr/* routes pass through
    if (req.url !== '/' && req.url !== '') return next();

    const contentHtml = renderSsrPage({
      title: 'Blaze-NG Meteor SSR',
      subtitle: 'Server-side rendered templates powered by Meteor and Blaze-NG',
      items: features,
    });
    const html = wrapInLayout('Home', contentHtml);
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
  });

  console.log('Blaze-NG Meteor SSR routes registered:');
  console.log('  GET /ssr              — Home page with feature cards');
  console.log('  GET /ssr/todos        — Server-rendered todo list');
  console.log('  GET /ssr/profile/:id  — User profiles (alice, bob)');
  console.log('  GET /ssr/chat         — Chat with message history');
  console.log('  GET /ssr/email/*      — Email template previews');
});
