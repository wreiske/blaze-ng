# Server-Side Rendering (SSR)

Blaze-ng can render templates to HTML strings on the server for fast initial page loads, SEO, and email generation.

## Basic SSR

Every template and view can be rendered to an HTML string:

```ts
import { Blaze } from '@blaze-ng/core';
import { Template } from '@blaze-ng/templating-runtime';

// Render a template to HTML
const html = Blaze.toHTML(Template.myTemplate);

// Render with data
const html = Blaze.toHTMLWithData(Template.userCard, {
  name: 'Alice',
  email: 'alice@example.com',
  avatar: '/avatars/alice.jpg',
});
```

## Rendering Compiled Templates

```ts
import { SpacebarsCompiler } from '@blaze-ng/spacebars-compiler';

// Compile a template
const renderFn = SpacebarsCompiler.compile('<h1>Hello, {{name}}!</h1>');

// Create a template
const tmpl = new Template('greeting', renderFn);

// Render to HTML
const html = Blaze.toHTMLWithData(tmpl, { name: 'World' });
// => '<h1>Hello, World!</h1>'
```

## SSR Patterns

### Page Shell

```ts
function renderPage(templateName, data) {
  const content = Blaze.toHTMLWithData(Template[templateName], data);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${data.title || 'My App'}</title>
  <meta name="description" content="${data.description || ''}">
  <link rel="stylesheet" href="/styles.css">
</head>
<body>
  <div id="app">${content}</div>
  <script src="/client.js"></script>
</body>
</html>`;
}
```

### Express Integration

```ts
import express from 'express';
import { Blaze } from '@blaze-ng/core';
import { Template } from '@blaze-ng/templating-runtime';

const app = express();

app.get('/', (req, res) => {
  const html = Blaze.toHTMLWithData(Template.homePage, {
    title: 'Welcome',
    features: getFeatures(),
  });
  res.send(renderShell(html, { title: 'Home' }));
});

app.get('/users/:id', async (req, res) => {
  const user = await db.users.findOne(req.params.id);
  if (!user) {
    const html = Blaze.toHTML(Template.notFound);
    return res.status(404).send(renderShell(html, { title: 'Not Found' }));
  }

  const html = Blaze.toHTMLWithData(Template.userProfile, { user });
  res.send(
    renderShell(html, {
      title: `${user.name} — Profile`,
      description: user.bio,
    }),
  );
});
```

### Meteor SSR

```ts
import { WebApp } from 'meteor/webapp';
import { Blaze } from '@blaze-ng/core';
import { Template } from '@blaze-ng/templating-runtime';

WebApp.connectHandlers.use('/ssr', (req, res) => {
  const html = Blaze.toHTMLWithData(Template.ssrPage, {
    url: req.url,
    user: req.user,
  });

  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(html);
});
```

## Email Templates

SSR is perfect for generating HTML emails:

```handlebars
<template name='welcomeEmail'>
  <div style='font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;'>
    <div style='background: #4f46e5; color: white; padding: 32px; text-align: center;'>
      <h1 style='margin: 0;'>Welcome to {{appName}}!</h1>
    </div>
    <div style='padding: 32px;'>
      <p>Hi {{user.name}},</p>
      <p>Thanks for signing up! Here's what you can do next:</p>
      <ul>
        {{#each step in steps}}
          <li style='margin-bottom: 8px;'>
            <strong>{{step.title}}</strong>
            —
            {{step.description}}
          </li>
        {{/each}}
      </ul>
      <div style='text-align: center; margin: 32px 0;'>
        <a
          href='{{dashboardUrl}}'
          style='background: #4f46e5; color: white; padding: 12px 24px; 
                  text-decoration: none; border-radius: 6px;'
        >
          Go to Dashboard
        </a>
      </div>
    </div>
    <div style='background: #f3f4f6; padding: 16px; text-align: center; font-size: 12px;'>
      <p>{{appName}} — {{tagline}}</p>
      <a href='{{unsubscribeUrl}}'>Unsubscribe</a>
    </div>
  </div>
</template>
```

```ts
function sendWelcomeEmail(user) {
  const html = Blaze.toHTMLWithData(Template.welcomeEmail, {
    appName: 'MyApp',
    tagline: 'Build amazing things',
    user,
    dashboardUrl: `https://myapp.com/dashboard`,
    unsubscribeUrl: `https://myapp.com/unsubscribe?token=${user.unsubToken}`,
    steps: [
      { title: 'Complete your profile', description: 'Add a photo and bio' },
      { title: 'Create a project', description: 'Start building something cool' },
      { title: 'Invite your team', description: 'Collaborate in real-time' },
    ],
  });

  Email.send({
    to: user.email,
    from: 'hello@myapp.com',
    subject: 'Welcome to MyApp!',
    html,
  });
}
```

## PDF Generation

Combine SSR with a PDF library:

```ts
import puppeteer from 'puppeteer';

async function generateInvoicePdf(invoice) {
  const html = Blaze.toHTMLWithData(Template.invoice, {
    invoice,
    company: getCompanyInfo(),
    formatCurrency: (amount) => `$${amount.toFixed(2)}`,
  });

  const fullHtml = `
    <!DOCTYPE html>
    <html>
    <head><style>${getInvoiceStyles()}</style></head>
    <body>${html}</body>
    </html>
  `;

  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.setContent(fullHtml);
  const pdf = await page.pdf({ format: 'A4' });
  await browser.close();

  return pdf;
}
```

## Static Site Generation

Pre-render pages at build time:

```ts
import { writeFileSync, mkdirSync } from 'fs';
import { Blaze } from '@blaze-ng/core';
import { Template } from '@blaze-ng/templating-runtime';

const pages = [
  { path: '/', template: 'homePage', data: { title: 'Home' } },
  { path: '/about', template: 'aboutPage', data: { title: 'About' } },
  { path: '/pricing', template: 'pricingPage', data: { title: 'Pricing', plans: getPlans() } },
];

// Generate static HTML files
for (const page of pages) {
  const content = Blaze.toHTMLWithData(Template[page.template], page.data);
  const html = renderShell(content, page.data);

  const dir = `dist${page.path}`;
  mkdirSync(dir, { recursive: true });
  writeFileSync(`${dir}/index.html`, html);
}

console.log(`Generated ${pages.length} static pages`);
```

## Component Snapshots for Testing

Use SSR to test component output:

```ts
import { describe, it, expect } from 'vitest';
import { Blaze } from '@blaze-ng/core';
import { Template } from '@blaze-ng/templating-runtime';

describe('UserCard', () => {
  it('renders user information', () => {
    const html = Blaze.toHTMLWithData(Template.userCard, {
      name: 'Alice',
      email: 'alice@example.com',
      role: 'Admin',
    });

    expect(html).toContain('Alice');
    expect(html).toContain('alice@example.com');
    expect(html).toContain('Admin');
  });

  it('shows placeholder for missing avatar', () => {
    const html = Blaze.toHTMLWithData(Template.userCard, {
      name: 'Bob',
      avatar: null,
    });

    expect(html).toContain('avatar-placeholder');
    expect(html).not.toContain('<img');
  });

  it('matches snapshot', () => {
    const html = Blaze.toHTMLWithData(Template.userCard, {
      name: 'Test User',
      email: 'test@example.com',
    });

    expect(html).toMatchSnapshot();
  });
});
```

## Performance Tips

1. **Cache compiled templates** — compile once, render many times
2. **Minimize helpers** — complex helper logic runs on every render
3. **Use `toHTML` over `render`** — no DOM needed on the server
4. **Stream large pages** — for very large pages, consider streaming chunks
5. **Pre-render static parts** — cache parts that don't change per-request
