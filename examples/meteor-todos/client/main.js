import { Template } from 'meteor/templating';
import { ReactiveVar } from 'meteor/reactive-var';
import { Meteor } from 'meteor/meteor';
import { Todos } from '../imports/api/todos';

import './main.html';
import './styles.css';

// ─── Global helpers ──────────────────────────────────────────────────────────

Template.registerHelper('pluralize', (count, singular, plural) =>
  count === 1 ? singular : plural,
);

Template.registerHelper('isFilter', (value) => {
  return Template.instance()?.view?.parentView
    ? Template.instance().filter?.get() === value
    : false;
});

// ─── todoApp ─────────────────────────────────────────────────────────────────

Template.todoApp.onCreated(function () {
  this.filter = new ReactiveVar('all');
});

Template.todoApp.helpers({
  filteredTodos() {
    const filter = Template.instance().filter.get();
    const query = {};
    if (filter === 'active') query.completed = false;
    if (filter === 'completed') query.completed = true;
    return Todos.find(query, { sort: { createdAt: -1 } });
  },
  totalCount() {
    return Todos.find().count();
  },
  activeCount() {
    return Todos.find({ completed: false }).count();
  },
  completedCount() {
    return Todos.find({ completed: true }).count();
  },
});

Template.todoApp.events({
  'submit .add-form'(event, instance) {
    event.preventDefault();
    const input = event.target.querySelector('.new-todo');
    const text = input.value.trim();
    if (!text) return;
    Todos.insertAsync({ text, completed: false, createdAt: new Date() });
    input.value = '';
  },
  'click .filter-btn'(event, instance) {
    instance.filter.set(event.currentTarget.dataset.filter);
  },
  'click .clear-completed'() {
    Todos.find({ completed: true }).forEach((todo) => {
      Todos.removeAsync(todo._id);
    });
  },
});

// ─── todoItem ────────────────────────────────────────────────────────────────

Template.todoItem.helpers({
  todoItemClass() {
    return 'todo-item' + (this.completed ? ' completed' : '');
  },
});

Template.todoItem.events({
  'click .toggle'(event) {
    Todos.updateAsync(this._id, { $set: { completed: !this.completed } });
  },
  'click .destroy'(event) {
    Todos.removeAsync(this._id);
  },
});
