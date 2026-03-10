import { Meteor } from 'meteor/meteor';
import { Template } from 'meteor/templating';

import './app.html';

// ─── Isomorphic helpers (server uses defaults, client uses ReactiveVar) ──────

// On the server, template instances are registered by Meteor's build system
// (via server-meteor.js HTML imports) which runs after the rspack bundle.
// Defer helper registration to Meteor.startup() so templates are available.
function registerInteractiveDemoHelpers() {
  Template.interactiveDemo.helpers({
    count() {
      if (Meteor.isServer) return 0;
      return Template.instance().count.get();
    },
    isZero() {
      if (Meteor.isServer) return true;
      return Template.instance().count.get() === 0;
    },
  });
}

Meteor.startup(() => {
  registerInteractiveDemoHelpers();

  // ─── Client-only: reactive counter state + events ────────────────────────────

  if (Meteor.isClient) {
    const { ReactiveVar } = require('meteor/reactive-var');

    Template.interactiveDemo.onCreated(function () {
      this.count = new ReactiveVar(0);
    });

    Template.interactiveDemo.events({
      'click .increment'(event, instance) {
        instance.count.set(instance.count.get() + 1);
      },
      'click .decrement'(event, instance) {
        const current = instance.count.get();
        if (current > 0) instance.count.set(current - 1);
      },
      'click .reset'(event, instance) {
        instance.count.set(0);
      },
    });
  }
});
