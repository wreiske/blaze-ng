import { Meteor } from 'meteor/meteor';
import { WebApp } from 'meteor/webapp';

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

// ─── Layout wrapper ──────────────────────────────────────────────────────────

function wrapInLayout(title, contentHtml) {
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
  </style>
</head>
<body>
  <nav>
    <a href="/" class="logo">Blaze-NG Meteor SSR</a>
    <a href="/ssr">Home</a>
    <a href="/ssr/todos">Todos</a>
    <a href="/ssr/profile/alice">Profile</a>
    <a href="/ssr/email/welcome">Email</a>
    <a href="/">← Client App</a>
  </nav>
  <main>${contentHtml}</main>
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

// ─── SSR Routes via WebApp.connectHandlers ───────────────────────────────────

Meteor.startup(() => {
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
  console.log('  GET /ssr/email/*      — Email template previews');
});
