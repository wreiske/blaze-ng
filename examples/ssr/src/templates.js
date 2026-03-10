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

export const CHAT_SCRIPT = `<script>
(function() {
  var input = document.getElementById('chat-input');
  if (!input) return;
  var btn = document.getElementById('chat-send');
  var typing = document.querySelector('.typing-indicator');

  function getTime() {
    var d = new Date();
    var h = d.getHours();
    var m = d.getMinutes();
    var ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return h + ':' + (m < 10 ? '0' : '') + m + ' ' + ampm;
  }

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text) e.textContent = text;
    return e;
  }

  function appendMessage(text, time) {
    var groups = document.querySelectorAll('.chat-messages');
    var lastGroup = groups[groups.length - 1];

    var msg = el('div', 'msg sent');
    var avatar = el('div', 'msg-avatar', 'AC');
    avatar.style.background = '#3b82f6';
    var body = el('div', 'msg-body');
    body.appendChild(el('div', 'msg-sender', 'Alice Chen'));
    body.appendChild(el('div', 'msg-bubble', text));
    body.appendChild(el('div', 'msg-time', time));
    msg.appendChild(avatar);
    msg.appendChild(body);
    lastGroup.appendChild(msg);

    var subtitle = document.querySelector('.chat .subtitle');
    var count = document.querySelectorAll('.msg').length;
    subtitle.textContent = count + ' messages in #general';

    msg.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }

  function send() {
    var text = input.value.trim();
    if (!text) return;
    input.value = '';
    btn.disabled = true;

    fetch('/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: text })
    })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (data.ok) {
        appendMessage(data.message.text, data.message.time);
        typing.textContent = '';
      }
    })
    .catch(function() {
      appendMessage(text, getTime());
    })
    .finally(function() {
      btn.disabled = false;
      input.focus();
    });
  }

  btn.addEventListener('click', send);
  input.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') send();
  });
  input.focus();
})();
<\/script>`;

export function wrapInLayout(title, contentHtml, { script } = {}) {
  const chatScript = script || '';
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
    .typing-indicator { padding: 0.5rem 1rem 0.75rem; font-size: 0.8rem; color: #94a3b8; font-style: italic; }
  </style>
</head>
<body>
  <nav>
    <a href="/" class="logo">Blaze-NG SSR</a>
    <a href="/">Home</a>
    <a href="/todos">Todos</a>
    <a href="/profile/alice">Profile</a>
    <a href="/chat">Chat</a>
  </nav>
  <main>${contentHtml}</main>
  ${chatScript}
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

// ─── Chat page ───────────────────────────────────────────────────────────────

defineTemplate(
  'chatPage',
  `
<div class="chat">
  <h2>💬 Team Chat</h2>
  <p class="subtitle">{{messageCount}} messages in #{{channelName}}</p>
  <div class="chat-participants">
    {{#each p in participants}}
      {{> participantChip p}}
    {{/each}}
  </div>
  <div class="chat-window">
    {{#each group in messageGroups}}
      <div class="chat-date">{{group.date}}</div>
      <div class="chat-messages">
        {{#each msg in group.messages}}
          {{> chatMessage msg}}
        {{/each}}
      </div>
    {{/each}}
    <div class="typing-indicator">{{typingText}}</div>
    <div class="chat-compose">
      <input type="text" placeholder="Type a message..." id="chat-input" />
      <button id="chat-send">↑</button>
    </div>
  </div>
</div>
`,
);

defineTemplate(
  'participantChip',
  `
<div class="participant-chip">
  <div class="chip-avatar" style="background: {{color}}">{{initials}}</div>
  <span>{{name}}</span>
</div>
`,
);

defineTemplate(
  'chatMessage',
  `
<div class="msg {{direction}}">
  <div class="msg-avatar" style="background: {{avatarColor}}">{{initials}}</div>
  <div class="msg-body">
    <div class="msg-sender">{{sender}}</div>
    <div class="msg-bubble">{{text}}</div>
    {{#if image}}
      <div class="msg-image">📎 {{image}}</div>
    {{/if}}
    {{#if reactions}}
      <div class="msg-reactions">
        {{#each r in reactions}}
          <span class="reaction">{{r}}</span>
        {{/each}}
      </div>
    {{/if}}
    <div class="msg-time">{{time}}</div>
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
