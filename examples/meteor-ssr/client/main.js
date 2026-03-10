import { Meteor } from 'meteor/meteor';
import { Blaze } from 'meteor/blaze';
import { Template } from 'meteor/templating';

// Import shared templates + helpers (isomorphic — same code runs on server for SSR)
import '../imports/templates/setup';
import '../imports/templates/app';
import '../imports/templates/chat';

// Note: ./main.html only has <head> tags (no templates). Meteor's build system
// processes <head> content automatically — no import needed. Importing it would
// fail because the templating compiler doesn't generate a JS module for
// head-only HTML files.
import './styles.css';

// ─── Hydration: replace SSR shell with reactive Blaze templates ──────────────

Meteor.startup(() => {
  const app = document.getElementById('app');
  if (!app) return;

  // Keep the SSR content visible until the messages subscription is ready,
  // then swap in the reactive Blaze DOM in one step to avoid a flash.
  const sub = Meteor.subscribe('messages', {
    onReady() {
      const ssrNodes = Array.from(app.childNodes);
      Blaze.render(Template.interactiveDemo, app);
      ssrNodes.forEach((node) => node.remove());
    },
  });
});
