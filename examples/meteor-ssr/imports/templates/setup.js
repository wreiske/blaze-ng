import { Meteor } from 'meteor/meteor';
import { Template } from 'meteor/templating';

import './pages.html';

// ─── Global helpers (available in all templates) ─────────────────────────────

Template.registerHelper('year', () => new Date().getFullYear());

Template.registerHelper('pluralize', (count, singular, plural) =>
  count === 1 ? singular : plural,
);

Template.registerHelper('eq', (a, b) => a === b);

// ─── Helpers for initials in profile ─────────────────────────────────────────

// On the server, template instances are registered by Meteor's build system
// (via server-meteor.js HTML imports) which runs after the rspack bundle.
// Defer helper registration to Meteor.startup() so templates are available.
function registerTemplateHelpers() {
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
}

Meteor.startup(registerTemplateHelpers);
