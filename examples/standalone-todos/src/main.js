/**
 * Blaze-NG Standalone Todos — no Meteor required.
 *
 * Demonstrates a more complex standalone app with:
 * - Multiple templates (todoApp + todoItem)
 * - In-memory reactive data store
 * - {{#each}} iteration, {{#if}} conditionals
 * - Sub-template inclusion with data context
 * - Event delegation
 */
import {
  Template,
  View,
  Each,
  If,
  Unless,
  With,
  Let,
  _TemplateWith,
  _InOuterTemplateScope,
  render,
  setReactiveSystem,
  registerHelper,
} from '@blaze-ng/core';
import { SimpleReactiveSystem } from '@blaze-ng/core/testing';
import { compile } from '@blaze-ng/spacebars-compiler';
import { Spacebars } from '@blaze-ng/spacebars';
import { HTML as _HTML } from '@blaze-ng/htmljs';
import { __define__, getRegisteredTemplate } from '@blaze-ng/templating-runtime';
import { ObserveSequence } from '@blaze-ng/observe-sequence';

// Compiled Spacebars code calls HTML.Raw/CharRef/Comment without `new`,
// but in blaze-ng these are ES6 classes. Wrap them as callable functions.
const HTML = Object.create(_HTML);
HTML.Raw = (...args) => new _HTML.Raw(...args);
HTML.CharRef = (...args) => new _HTML.CharRef(...args);
HTML.Comment = (...args) => new _HTML.Comment(...args);

// Shim the Blaze namespace expected by compiled template code.
const Blaze = {
  View: (...args) => new View(...args),
  Each,
  If,
  Unless,
  With,
  Let,
  _TemplateWith,
  _InOuterTemplateScope,
};

// ─── 1. Set up reactivity ────────────────────────────────────────────────────

const reactive = new SimpleReactiveSystem();
setReactiveSystem(reactive);
ObserveSequence.setReactiveSystem(reactive);

// ─── 2. In-memory reactive data store ────────────────────────────────────────

let nextId = 1;
const todosVar = reactive.ReactiveVar([
  { _id: nextId++, text: 'Learn Blaze-NG', completed: false },
  { _id: nextId++, text: 'Build without Meteor', completed: true },
  { _id: nextId++, text: 'Ship to production', completed: false },
]);

function getTodos() {
  return todosVar.get();
}

function addTodo(text) {
  todosVar.set([...getTodos(), { _id: nextId++, text, completed: false }]);
}

function toggleTodo(id) {
  todosVar.set(getTodos().map((t) => (t._id === id ? { ...t, completed: !t.completed } : t)));
}

function removeTodo(id) {
  todosVar.set(getTodos().filter((t) => t._id !== id));
}

function clearCompleted() {
  todosVar.set(getTodos().filter((t) => !t.completed));
}

// ─── 3. Compile and register templates ───────────────────────────────────────

function compileAndRegister(name, source) {
  const code = compile(source, { isTemplate: true });
  // eslint-disable-next-line no-new-func
  const renderFunc = new Function('HTML', 'Spacebars', 'Blaze', `return ${code}`)(
    HTML,
    Spacebars,
    Blaze,
  );
  __define__(name, renderFunc);
  Template[name] = getRegisteredTemplate(name);
}

compileAndRegister(
  'todoApp',
  `
  <div class="app">
    <header>
      <h1>📋 Todos</h1>
      {{#if completedCount}}
        <button class="clear-completed">Clear done ({{completedCount}})</button>
      {{/if}}
    </header>

    <form class="add-form">
      <input type="text" class="new-todo" placeholder="What needs to be done?" autofocus />
      <button type="submit">Add</button>
    </form>

    <div class="filters">
      <button class="filter-btn {{activeClass 'all'}}" data-filter="all">All ({{totalCount}})</button>
      <button class="filter-btn {{activeClass 'active'}}" data-filter="active">Active ({{activeCount}})</button>
      <button class="filter-btn {{activeClass 'completed'}}" data-filter="completed">Done ({{completedCount}})</button>
    </div>

    <ul class="todo-list">
      {{#each todo in filteredTodos}}
        {{> todoItem todo}}
      {{else}}
        <li class="empty">
          {{#if (eq currentFilter 'all')}}
            No todos yet — add one above!
          {{else if (eq currentFilter 'active')}}
            All done! 🎉
          {{else}}
            Nothing completed yet.
          {{/if}}
        </li>
      {{/each}}
    </ul>

    {{#if totalCount}}
      <footer class="status">
        {{activeCount}} {{pluralize activeCount "item" "items"}} left
      </footer>
    {{/if}}
  </div>
`,
);

compileAndRegister(
  'todoItem',
  `
  <li class="{{todoItemClass}}">
    <input type="checkbox" class="toggle" checked={{completed}} />
    <span class="text">{{text}}</span>
    <button class="destroy" title="Delete">&times;</button>
  </li>
`,
);

// ─── 4. Global helpers ──────────────────────────────────────────────────────

registerHelper('pluralize', (count, singular, plural) => (count === 1 ? singular : plural));

registerHelper('eq', (a, b) => a === b);

// ─── 5. todoApp helpers & events ─────────────────────────────────────────────

Template.todoApp.onCreated(function () {
  this.filter = reactive.ReactiveVar('all');
});

Template.todoApp.helpers({
  filteredTodos() {
    const filter = Template.instance().filter.get();
    const todos = getTodos();
    if (filter === 'active') return todos.filter((t) => !t.completed);
    if (filter === 'completed') return todos.filter((t) => t.completed);
    return todos;
  },
  currentFilter() {
    return Template.instance().filter.get();
  },
  activeClass(filterName) {
    return Template.instance().filter.get() === filterName ? 'active' : '';
  },
  totalCount() {
    return getTodos().length;
  },
  activeCount() {
    return getTodos().filter((t) => !t.completed).length;
  },
  completedCount() {
    return getTodos().filter((t) => t.completed).length;
  },
});

Template.todoApp.events({
  'submit .add-form'(event, instance) {
    event.preventDefault();
    const input = event.target.querySelector('.new-todo');
    const text = input.value.trim();
    if (!text) return;
    addTodo(text);
    input.value = '';
    reactive.flush();
  },
  'click .filter-btn'(event, instance) {
    instance.filter.set(event.currentTarget.dataset.filter);
    reactive.flush();
  },
  'click .clear-completed'() {
    clearCompleted();
    reactive.flush();
  },
});

// ─── 6. todoItem helpers & events ────────────────────────────────────────────

Template.todoItem.helpers({
  todoItemClass() {
    return 'todo-item' + (this.completed ? ' completed' : '');
  },
});

Template.todoItem.events({
  'click .toggle'() {
    toggleTodo(this._id);
    reactive.flush();
  },
  'click .destroy'() {
    removeTodo(this._id);
    reactive.flush();
  },
});

// ─── 7. Render ──────────────────────────────────────────────────────────────

const app = document.getElementById('app');
render(Template.todoApp, app);
reactive.flush();
