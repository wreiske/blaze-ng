# Example: Server-Side Rendering

Render Blaze templates on the server for fast initial page loads, email generation, and static sites.

## Basic SSR

```ts
import { Blaze } from '@blaze-ng/core';
import { Template } from '@blaze-ng/templating-runtime';

// Define a template
Template.__define__('userCard', function () {
  return Blaze._TemplateWith(this.data, () => {
    const HTML = require('@blaze-ng/htmljs');
    return HTML.DIV(
      { class: 'user-card' },
      HTML.IMG({ src: this.data.avatar, alt: this.data.name, class: 'avatar' }),
      HTML.H3(this.data.name),
      HTML.P({ class: 'bio' }, this.data.bio),
    );
  });
});

// Render to HTML string
const html = Blaze.toHTMLWithData(Template.userCard, {
  name: 'Alice Chen',
  avatar: '/avatars/alice.jpg',
  bio: 'Full-stack developer, open source contributor',
});

console.log(html);
// <div class="user-card">
//   <img src="/avatars/alice.jpg" alt="Alice Chen" class="avatar">
//   <h3>Alice Chen</h3>
//   <p class="bio">Full-stack developer, open source contributor</p>
// </div>
```

## Express Integration

```ts
import express from 'express';
import { Blaze } from '@blaze-ng/core';
import { Template } from '@blaze-ng/templating-runtime';

const app = express();

// Layout template
Template.__define__('layout', function () {
  const HTML = require('@blaze-ng/htmljs');
  return HTML.Raw(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${Blaze._escape(this.data.title)} — My App</title>
  <link rel="stylesheet" href="/styles.css">
</head>
<body>
  <nav class="nav">
    <a href="/" class="logo">My App</a>
    <div class="nav-links">
      <a href="/about">About</a>
      <a href="/blog">Blog</a>
    </div>
  </nav>
  <main>${this.data.content}</main>
  <footer><p>&copy; 2025 My App</p></footer>
  <script src="/client.js" defer></script>
</body>
</html>`);
});

// Page templates
Template.__define__('homePage', function () {
  const HTML = require('@blaze-ng/htmljs');
  return HTML.Raw(`
    <div class="hero">
      <h1>Welcome to My App</h1>
      <p>Built with Blaze-ng SSR</p>
    </div>
    <div class="features">
      ${this.data.features
        .map(
          (f) => `
        <div class="feature-card">
          <span class="icon">${f.icon}</span>
          <h3>${Blaze._escape(f.title)}</h3>
          <p>${Blaze._escape(f.description)}</p>
        </div>
      `,
        )
        .join('')}
    </div>
  `);
});

Template.__define__('blogPost', function () {
  const HTML = require('@blaze-ng/htmljs');
  const post = this.data.post;
  return HTML.Raw(`
    <article class="blog-post">
      <header>
        <h1>${Blaze._escape(post.title)}</h1>
        <div class="meta">
          <time>${new Date(post.publishedAt).toLocaleDateString()}</time>
          <span>by ${Blaze._escape(post.author)}</span>
        </div>
      </header>
      <div class="content">${post.htmlContent}</div>
    </article>
  `);
});

// Routes
app.get('/', (req, res) => {
  const content = Blaze.toHTMLWithData(Template.homePage, {
    features: [
      { icon: '⚡', title: 'Fast', description: 'Server-rendered for instant loads' },
      { icon: '🔒', title: 'Secure', description: 'No client-side data fetching needed' },
      { icon: '🔍', title: 'SEO Ready', description: 'Full HTML sent to crawlers' },
    ],
  });

  const html = Blaze.toHTMLWithData(Template.layout, {
    title: 'Home',
    content,
  });

  res.send(html);
});

app.get('/blog/:slug', async (req, res) => {
  const post = await fetchPost(req.params.slug); // Your data fetching
  if (!post) return res.status(404).send('Not found');

  const content = Blaze.toHTMLWithData(Template.blogPost, { post });
  const html = Blaze.toHTMLWithData(Template.layout, {
    title: post.title,
    content,
  });

  res.send(html);
});

app.listen(3000);
```

## Email Templates

Perfect for generating HTML emails that render consistently:

```ts
import { Blaze } from '@blaze-ng/core';
import { Template } from '@blaze-ng/templating-runtime';

// Email-safe template (inline styles for email clients)
Template.__define__('welcomeEmail', function () {
  const HTML = require('@blaze-ng/htmljs');
  const d = this.data;
  return HTML.Raw(`
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;font-family:Arial,sans-serif;">
  <tr>
    <td style="background:#4f46e5;padding:32px;text-align:center;">
      <h1 style="color:white;margin:0;font-size:24px;">Welcome to Our App!</h1>
    </td>
  </tr>
  <tr>
    <td style="padding:32px;">
      <p style="font-size:16px;color:#1e293b;">Hi ${Blaze._escape(d.name)},</p>
      <p style="font-size:16px;color:#475569;line-height:1.6;">
        Thanks for signing up! Your account has been created successfully.
        Here&rsquo;s what you can do next:
      </p>
      <ul style="color:#475569;line-height:2;">
        ${d.steps.map((step) => `<li>${Blaze._escape(step)}</li>`).join('')}
      </ul>
      <div style="text-align:center;margin:32px 0;">
        <a href="${Blaze._escape(d.actionUrl)}"
           style="background:#4f46e5;color:white;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:600;">
          Get Started
        </a>
      </div>
    </td>
  </tr>
  <tr>
    <td style="background:#f8fafc;padding:24px;text-align:center;color:#94a3b8;font-size:12px;">
      <p>&copy; 2025 Our App. All rights reserved.</p>
      <p><a href="${Blaze._escape(d.unsubscribeUrl)}" style="color:#94a3b8;">Unsubscribe</a></p>
    </td>
  </tr>
</table>
  `);
});

// Generate email HTML
function sendWelcomeEmail(user) {
  const html = Blaze.toHTMLWithData(Template.welcomeEmail, {
    name: user.name,
    steps: ['Complete your profile', 'Connect your first integration', 'Invite your team members'],
    actionUrl: `https://app.example.com/onboarding?token=${user.token}`,
    unsubscribeUrl: `https://app.example.com/unsubscribe?email=${encodeURIComponent(user.email)}`,
  });

  // Send with your email provider
  return sendEmail({
    to: user.email,
    subject: 'Welcome to Our App!',
    html,
  });
}
```

## Meteor SSR

Using Blaze SSR in a Meteor application with server-side routes:

```ts
// server/ssr.js
import { Blaze } from '@blaze-ng/core';
import { Template } from '@blaze-ng/templating-runtime';
import { WebApp } from 'meteor/webapp';

// SSR middleware for specific routes
WebApp.connectHandlers.use('/preview/:templateName', (req, res, next) => {
  const { templateName } = req.params;
  const template = Template[templateName];

  if (!template) {
    res.writeHead(404);
    res.end('Template not found');
    return;
  }

  const data = getPreviewData(templateName);
  const content = Blaze.toHTMLWithData(template, data);

  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(`
    <!DOCTYPE html>
    <html>
    <head><title>Preview: ${templateName}</title></head>
    <body>${content}</body>
    </html>
  `);
});
```

## Static Site Generation

Generate a complete static site from Blaze templates:

```ts
import { Blaze } from '@blaze-ng/core';
import { Template } from '@blaze-ng/templating-runtime';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

interface Page {
  path: string;
  template: string;
  data: Record<string, unknown>;
}

/**
 * Generate static HTML files from Blaze templates.
 * @param pages - Array of page configurations.
 * @param outDir - Output directory path.
 */
function generateStaticSite(pages: Page[], outDir: string) {
  for (const page of pages) {
    const template = Template[page.template];
    if (!template) {
      console.warn(`Template "${page.template}" not found, skipping`);
      continue;
    }

    const content = Blaze.toHTMLWithData(template, page.data);
    const html = Blaze.toHTMLWithData(Template.layout, {
      title: page.data.title,
      content,
    });

    const filePath = join(outDir, page.path, 'index.html');
    mkdirSync(join(outDir, page.path), { recursive: true });
    writeFileSync(filePath, html);
    console.log(`Generated: ${filePath}`);
  }
}

// Usage
generateStaticSite([
  { path: '/', template: 'homePage', data: { title: 'Home', features: [...] } },
  { path: '/about', template: 'aboutPage', data: { title: 'About', team: [...] } },
  { path: '/pricing', template: 'pricingPage', data: { title: 'Pricing', plans: [...] } },
], './dist');
```

## Component Preview / Snapshot Testing

Use SSR for component snapshot testing:

```ts
import { describe, it, expect } from 'vitest';
import { Blaze } from '@blaze-ng/core';
import { Template } from '@blaze-ng/templating-runtime';

describe('Component Snapshots', () => {
  it('renders user card correctly', () => {
    const html = Blaze.toHTMLWithData(Template.userCard, {
      name: 'Test User',
      avatar: '/test.jpg',
      bio: 'Test bio',
    });

    expect(html).toMatchSnapshot();
  });

  it('renders empty state when no data', () => {
    const html = Blaze.toHTMLWithData(Template.userList, {
      users: [],
    });

    expect(html).toContain('No users found');
    expect(html).not.toContain('user-card');
  });

  it('escapes user-provided content', () => {
    const html = Blaze.toHTMLWithData(Template.userCard, {
      name: '<script>alert("xss")</script>',
      avatar: '/test.jpg',
      bio: 'Normal bio',
    });

    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });
});
```

## What This Demonstrates

- **`Blaze.toHTML`** and **`Blaze.toHTMLWithData`** — core SSR functions
- **Express integration** — SSR middleware for web applications
- **Email generation** — HTML emails with inline styles
- **Static site generation** — build-time page rendering
- **Snapshot testing** — component rendering verification
- **XSS prevention** — proper escaping in server-rendered output
- **Meteor integration** — SSR within Meteor's `WebApp`
- **Template composition** — layout wrapping content on the server
