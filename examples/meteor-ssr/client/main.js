import { Template } from 'meteor/templating';
import { ReactiveVar } from 'meteor/reactive-var';

// Import shared templates and helpers (registers them on both client + server)
import '../imports/templates/setup';

import './main.html';
import './styles.css';

// ─── Interactive counter (client-side only) ──────────────────────────────────

Template.interactiveDemo.onCreated(function () {
  this.count = new ReactiveVar(0);
});

Template.interactiveDemo.helpers({
  count() {
    return Template.instance().count.get();
  },
  isZero() {
    return Template.instance().count.get() === 0;
  },
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
