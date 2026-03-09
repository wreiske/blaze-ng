import { Template } from 'meteor/templating';
import { ReactiveVar } from 'meteor/reactive-var';

import './main.html';

Template.counter.onCreated(function () {
  this.count = new ReactiveVar(0);
});

Template.counter.helpers({
  count() {
    return Template.instance().count.get();
  },
  isZero() {
    return Template.instance().count.get() === 0;
  },
});

Template.counter.events({
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

Template.registerHelper('pluralize', (count, singular, plural) =>
  count === 1 ? singular : plural,
);
