import { Template } from 'meteor/templating';

import './pages.html';

// ─── Global helpers (available in all templates) ─────────────────────────────

Template.registerHelper('year', () => new Date().getFullYear());

Template.registerHelper('pluralize', (count, singular, plural) =>
  count === 1 ? singular : plural,
);

Template.registerHelper('eq', (a, b) => a === b);

// ─── Helpers for initials in profile ─────────────────────────────────────────

Template.userProfile.helpers({
  initials() {
    return this.name
      .split(' ')
      .map((w) => w[0])
      .join('')
      .toUpperCase();
  },
});

Template.todoItemSSR.helpers({
  todoItemClass() {
    return 'todo-item-ssr' + (this.completed ? ' done' : '');
  },
});
