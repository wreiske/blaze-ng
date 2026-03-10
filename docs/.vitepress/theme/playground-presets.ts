export interface PlaygroundPreset {
  name: string;
  label: string;
  template: string;
  javascript: string;
  css?: string;
}

export const presets: PlaygroundPreset[] = [
  {
    name: 'counter',
    label: 'Counter',
    template: `<div class="counter">
  <h1>{{count}}</h1>
  <div class="buttons">
    <button class="decrement" disabled={{isZero}}>&minus;</button>
    <button class="reset">Reset</button>
    <button class="increment">+</button>
  </div>
  <p class="label">
    {{#if isZero}}
      Click + to start counting
    {{else}}
      Clicked {{count}} {{pluralize count "time" "times"}}
    {{/if}}
  </p>
</div>`,
    javascript: `Template.demo.onCreated(function () {
  this.count = reactive.ReactiveVar(0);
});

Template.demo.helpers({
  count() {
    return Template.instance().count.get();
  },
  isZero() {
    return Template.instance().count.get() === 0;
  },
});

Template.demo.events({
  'click .increment'(event, instance) {
    instance.count.set(instance.count.get() + 1);
    reactive.flush();
  },
  'click .decrement'(event, instance) {
    const current = instance.count.get();
    if (current > 0) instance.count.set(current - 1);
    reactive.flush();
  },
  'click .reset'(event, instance) {
    instance.count.set(0);
    reactive.flush();
  },
});

registerHelper('pluralize', (count, singular, plural) =>
  count === 1 ? singular : plural
);`,
    css: `.counter {
  font-family: system-ui, sans-serif;
  text-align: center;
  padding: 2rem;
}
.counter h1 {
  font-size: 4rem;
  margin: 0 0 2rem;
  color: #e25822;
}
.buttons { display: flex; gap: 0.5rem; justify-content: center; margin: 1rem 0; }
.buttons button {
  padding: 0.5rem 1.25rem;
  font-size: 1.1rem;
  border: 2px solid #e25822;
  border-radius: 6px;
  background: white;
  color: #e25822;
  cursor: pointer;
  transition: all 0.15s;
}
.buttons button:hover:not(:disabled) { background: #e25822; color: white; }
.buttons button:disabled { opacity: 0.4; cursor: not-allowed; }
.label { color: #666; font-size: 0.95rem; }
:root.dark .buttons button { background: #2a2a2a; color: #e25822; border-color: #e25822; }
:root.dark .buttons button:hover:not(:disabled) { background: #e25822; color: white; }
:root.dark .label { color: #aaa; }`,
  },
  {
    name: 'conditionals',
    label: 'Conditionals',
    template: `<div class="demo">
  <h2>Traffic Light</h2>
  <div class="light-box">
    {{#if isRed}}
      <div class="light red">🔴 STOP</div>
    {{else}}
      {{#if isYellow}}
        <div class="light yellow">🟡 CAUTION</div>
      {{else}}
        <div class="light green">🟢 GO</div>
      {{/if}}
    {{/if}}
  </div>
  <p>Current: <strong>{{currentColor}}</strong></p>
  <button class="next-btn">Next Light →</button>
  {{#unless isGreen}}
    <p class="warning">⚠️ Not safe to go yet!</p>
  {{/unless}}
</div>`,
    javascript: `const colors = ['red', 'yellow', 'green'];

Template.demo.onCreated(function () {
  this.colorIndex = reactive.ReactiveVar(0);
});

Template.demo.helpers({
  currentColor() {
    return colors[Template.instance().colorIndex.get()];
  },
  isRed() {
    return colors[Template.instance().colorIndex.get()] === 'red';
  },
  isYellow() {
    return colors[Template.instance().colorIndex.get()] === 'yellow';
  },
  isGreen() {
    return colors[Template.instance().colorIndex.get()] === 'green';
  },
});

Template.demo.events({
  'click .next-btn'(event, instance) {
    const next = (instance.colorIndex.get() + 1) % colors.length;
    instance.colorIndex.set(next);
    reactive.flush();
  },
});`,
    css: `.demo {
  font-family: system-ui, sans-serif;
  text-align: center;
  padding: 2rem;
}
.light-box {
  margin: 1.5rem auto;
  padding: 1.5rem;
  border-radius: 12px;
  background: #1a1a2e;
  display: inline-block;
  min-width: 180px;
}
.light { font-size: 1.5rem; font-weight: bold; padding: 0.5rem; }
.light.red { color: #ff4444; }
.light.yellow { color: #ffcc00; }
.light.green { color: #44ff44; }
.next-btn {
  padding: 0.6rem 1.5rem;
  font-size: 1rem;
  border: 2px solid #e25822;
  border-radius: 6px;
  background: #e25822;
  color: white;
  cursor: pointer;
}
.next-btn:hover { background: #c94a1a; }
.warning { color: #cc6600; font-style: italic; margin-top: 0.5rem; }
:root.dark .warning { color: #e89040; }`,
  },
  {
    name: 'each-list',
    label: 'Each / Lists',
    template: `<div class="demo">
  <h2>🛒 Shopping List</h2>
  <form class="add-form">
    <input type="text" class="new-item" placeholder="Add item..." />
    <button type="submit">Add</button>
  </form>
  <ul class="item-list">
    {{#each item in items}}
      <li class="{{#if item.bought}}bought{{/if}}">
        <input type="checkbox" class="toggle" checked={{item.bought}} data-id="{{item.id}}" />
        <span>{{item.name}}</span>
        <button class="remove" data-id="{{item.id}}">&times;</button>
      </li>
    {{else}}
      <li class="empty">List is empty — add some items!</li>
    {{/each}}
  </ul>
  {{#if hasItems}}
    <p class="summary">{{boughtCount}} of {{totalCount}} items bought</p>
  {{/if}}
</div>`,
    javascript: `let nextId = 1;
const itemsVar = reactive.ReactiveVar([
  { id: nextId++, name: 'Milk', bought: false },
  { id: nextId++, name: 'Bread', bought: true },
  { id: nextId++, name: 'Eggs', bought: false },
]);

Template.demo.helpers({
  items() { return itemsVar.get(); },
  hasItems() { return itemsVar.get().length > 0; },
  totalCount() { return itemsVar.get().length; },
  boughtCount() { return itemsVar.get().filter(i => i.bought).length; },
});

Template.demo.events({
  'submit .add-form'(event) {
    event.preventDefault();
    const input = event.target.querySelector('.new-item');
    const name = input.value.trim();
    if (!name) return;
    itemsVar.set([...itemsVar.get(), { id: nextId++, name, bought: false }]);
    input.value = '';
    reactive.flush();
  },
  'click .toggle'(event) {
    const id = Number(event.currentTarget.dataset.id);
    itemsVar.set(itemsVar.get().map(i =>
      i.id === id ? { ...i, bought: !i.bought } : i
    ));
    reactive.flush();
  },
  'click .remove'(event) {
    const id = Number(event.currentTarget.dataset.id);
    itemsVar.set(itemsVar.get().filter(i => i.id !== id));
    reactive.flush();
  },
});`,
    css: `.demo {
  font-family: system-ui, sans-serif;
  padding: 1.5rem;
  max-width: 400px;
  margin: 0 auto;
}
.add-form { display: flex; gap: 0.5rem; margin-bottom: 1rem; }
.add-form input {
  flex: 1; padding: 0.5rem; border: 2px solid #ddd;
  border-radius: 6px; font-size: 0.95rem;
}
.add-form button {
  padding: 0.5rem 1rem; background: #e25822; color: white;
  border: none; border-radius: 6px; cursor: pointer; font-size: 0.95rem;
}
.item-list { list-style: none; padding: 0; margin: 0; }
.item-list li {
  display: flex; align-items: center; gap: 0.5rem;
  padding: 0.5rem 0; border-bottom: 1px solid #eee;
}
.item-list li.bought span { text-decoration: line-through; color: #999; }
.item-list .empty { color: #999; font-style: italic; justify-content: center; }
.remove {
  margin-left: auto; background: none; border: none;
  color: #cc3333; font-size: 1.2rem; cursor: pointer;
}
.summary { color: #666; text-align: center; font-size: 0.9rem; }
:root.dark .add-form input { background: #2a2a2a; border-color: #444; color: #e0e0e0; }
:root.dark .item-list li { border-bottom-color: #333; }
:root.dark .item-list li.bought span { color: #666; }
:root.dark .item-list .empty { color: #777; }
:root.dark .summary { color: #aaa; }`,
  },
  {
    name: 'dynamic-attrs',
    label: 'Dynamic Attributes',
    template: `<div class="demo">
  <h2>🎨 Style Editor</h2>
  <div class="controls">
    <label>
      Color:
      <select class="color-select">
        <option value="#e25822">Orange</option>
        <option value="#2563eb">Blue</option>
        <option value="#16a34a">Green</option>
        <option value="#9333ea">Purple</option>
      </select>
    </label>
    <label>
      Size: <input type="range" class="size-range" min="1" max="5" value="3" />
    </label>
    <label>
      <input type="checkbox" class="bold-check" /> Bold
    </label>
    <label>
      <input type="checkbox" class="round-check" /> Rounded
    </label>
  </div>
  <div class="preview-box" style="{{boxStyle}}">
    Hello, Blaze-NG!
  </div>
</div>`,
    javascript: `Template.demo.onCreated(function () {
  this.color = reactive.ReactiveVar('#e25822');
  this.size = reactive.ReactiveVar(3);
  this.bold = reactive.ReactiveVar(false);
  this.rounded = reactive.ReactiveVar(false);
});

const sizeMap = { 1: '0.8rem', 2: '1rem', 3: '1.5rem', 4: '2rem', 5: '3rem' };

Template.demo.helpers({
  boxStyle() {
    const inst = Template.instance();
    const c = inst.color.get();
    const s = sizeMap[inst.size.get()] || '1.5rem';
    const b = inst.bold.get() ? 'bold' : 'normal';
    const r = inst.rounded.get() ? '24px' : '0';
    return 'color:' + c + '; border-color:' + c + '; font-size:' + s + '; font-weight:' + b + '; border-radius:' + r + ';';
  },
});

Template.demo.events({
  'change .color-select'(e, inst) {
    inst.color.set(e.target.value);
    reactive.flush();
  },
  'input .size-range'(e, inst) {
    inst.size.set(Number(e.target.value));
    reactive.flush();
  },
  'change .bold-check'(e, inst) {
    inst.bold.set(e.target.checked);
    reactive.flush();
  },
  'change .round-check'(e, inst) {
    inst.rounded.set(e.target.checked);
    reactive.flush();
  },
});`,
    css: `.demo {
  font-family: system-ui, sans-serif;
  padding: 1.5rem;
}
.controls {
  display: flex; flex-wrap: wrap; gap: 1rem;
  margin-bottom: 1.5rem; align-items: center;
}
.controls label { display: flex; align-items: center; gap: 0.4rem; font-size: 0.9rem; }
.controls select, .controls input[type="range"] { cursor: pointer; }
.preview-box {
  padding: 2rem; text-align: center;
  border: 3px solid currentColor;
  background: #fdf5f0;
  transition: all 0.2s;
}
:root.dark .controls select { background: #2a2a2a; border-color: #444; color: #e0e0e0; }
:root.dark .preview-box { background: #2a1a10; }`,
  },
  {
    name: 'todo-app',
    label: 'Todo App',
    template: `<div class="app">
  <h2>📋 Todos</h2>
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
      <li class="todo-item {{#if todo.completed}}completed{{/if}}">
        <input type="checkbox" class="toggle" checked={{todo.completed}} data-id="{{todo.id}}" />
        <span class="text">{{todo.text}}</span>
        <button class="destroy" data-id="{{todo.id}}">&times;</button>
      </li>
    {{else}}
      <li class="empty">No todos to show</li>
    {{/each}}
  </ul>
  {{#if completedCount}}
    <button class="clear-completed">Clear completed</button>
  {{/if}}
</div>`,
    javascript: `let nextId = 1;
const todosVar = reactive.ReactiveVar([
  { id: nextId++, text: 'Learn Blaze-NG', completed: false },
  { id: nextId++, text: 'Build something awesome', completed: false },
]);

Template.demo.onCreated(function () {
  this.filter = reactive.ReactiveVar('all');
});

Template.demo.helpers({
  filteredTodos() {
    const filter = Template.instance().filter.get();
    const todos = todosVar.get();
    if (filter === 'active') return todos.filter(t => !t.completed);
    if (filter === 'completed') return todos.filter(t => t.completed);
    return todos;
  },
  activeClass(name) {
    return Template.instance().filter.get() === name ? 'active' : '';
  },
  totalCount() { return todosVar.get().length; },
  activeCount() { return todosVar.get().filter(t => !t.completed).length; },
  completedCount() { return todosVar.get().filter(t => t.completed).length; },
});

Template.demo.events({
  'submit .add-form'(event) {
    event.preventDefault();
    const input = event.target.querySelector('.new-todo');
    const text = input.value.trim();
    if (!text) return;
    todosVar.set([...todosVar.get(), { id: nextId++, text, completed: false }]);
    input.value = '';
    reactive.flush();
  },
  'click .filter-btn'(event, instance) {
    instance.filter.set(event.currentTarget.dataset.filter);
    reactive.flush();
  },
  'click .toggle'(event) {
    const id = Number(event.currentTarget.dataset.id);
    todosVar.set(todosVar.get().map(t =>
      t.id === id ? { ...t, completed: !t.completed } : t
    ));
    reactive.flush();
  },
  'click .destroy'(event) {
    const id = Number(event.currentTarget.dataset.id);
    todosVar.set(todosVar.get().filter(t => t.id !== id));
    reactive.flush();
  },
  'click .clear-completed'() {
    todosVar.set(todosVar.get().filter(t => !t.completed));
    reactive.flush();
  },
});`,
    css: `.app {
  font-family: system-ui, sans-serif;
  padding: 1.5rem;
  max-width: 450px;
  margin: 0 auto;
}
.add-form { display: flex; gap: 0.5rem; margin-bottom: 1rem; }
.add-form input {
  flex: 1; padding: 0.5rem 0.75rem; border: 2px solid #ddd;
  border-radius: 6px; font-size: 0.95rem;
}
.add-form input:focus { border-color: #e25822; outline: none; }
.add-form button {
  padding: 0.5rem 1rem; background: #e25822; color: white;
  border: none; border-radius: 6px; cursor: pointer;
}
.filters { display: flex; gap: 0.4rem; margin-bottom: 1rem; }
.filter-btn {
  padding: 0.3rem 0.75rem; border: 1px solid #ddd; border-radius: 4px;
  background: white; cursor: pointer; font-size: 0.85rem;
}
.filter-btn.active { background: #e25822; color: white; border-color: #e25822; }
.todo-list { list-style: none; padding: 0; margin: 0; }
.todo-item {
  display: flex; align-items: center; gap: 0.5rem;
  padding: 0.6rem 0; border-bottom: 1px solid #eee;
}
.todo-item.completed .text { text-decoration: line-through; color: #999; }
.destroy {
  margin-left: auto; background: none; border: none;
  color: #cc3333; font-size: 1.2rem; cursor: pointer; opacity: 0.5;
}
.destroy:hover { opacity: 1; }
.empty { color: #999; font-style: italic; padding: 1rem 0; text-align: center; }
.clear-completed {
  margin-top: 0.75rem; padding: 0.4rem 1rem; background: none;
  border: 1px solid #cc3333; color: #cc3333; border-radius: 4px;
  cursor: pointer; font-size: 0.85rem;
}
.clear-completed:hover { background: #cc3333; color: white; }
:root.dark .add-form input { background: #2a2a2a; border-color: #444; color: #e0e0e0; }
:root.dark .add-form input:focus { border-color: #e25822; }
:root.dark .filter-btn { background: #2a2a2a; border-color: #444; color: #ccc; }
:root.dark .filter-btn.active { background: #e25822; color: white; border-color: #e25822; }
:root.dark .todo-item { border-bottom-color: #333; }
:root.dark .todo-item.completed .text { color: #666; }
:root.dark .empty { color: #777; }
:root.dark .clear-completed { border-color: #cc4444; color: #cc4444; }
:root.dark .clear-completed:hover { background: #cc4444; color: white; }`,
  },
  {
    name: 'template-inclusion',
    label: 'Template Inclusion',
    template: `<div class="demo">
  <h2>👥 Team Directory</h2>
  {{#each member in members}}
    {{> memberCard member}}
  {{/each}}
</div>

<template name="memberCard">
  <div class="card {{#if isOnline}}online{{/if}}">
    <div class="avatar">{{initials}}</div>
    <div class="info">
      <strong>{{name}}</strong>
      <span class="role">{{role}}</span>
    </div>
    <span class="status">{{#if isOnline}}🟢{{else}}⚫{{/if}}</span>
  </div>
</template>`,
    javascript: `const membersVar = reactive.ReactiveVar([
  { name: 'Alice Chen', role: 'Lead Engineer', isOnline: true },
  { name: 'Bob Smith', role: 'Designer', isOnline: false },
  { name: 'Carol Wu', role: 'Product Manager', isOnline: true },
  { name: 'Dan Park', role: 'DevOps', isOnline: true },
]);

Template.demo.helpers({
  members() { return membersVar.get(); },
});

Template.memberCard.helpers({
  initials() {
    return this.name.split(' ').map(n => n[0]).join('');
  },
});

Template.memberCard.events({
  'click .card'() {
    const members = membersVar.get();
    membersVar.set(members.map(m =>
      m.name === this.name ? { ...m, isOnline: !m.isOnline } : m
    ));
    reactive.flush();
  },
});`,
    css: `.demo {
  font-family: system-ui, sans-serif;
  padding: 1.5rem;
  max-width: 400px;
  margin: 0 auto;
}
.card {
  display: flex; align-items: center; gap: 0.75rem;
  padding: 0.75rem 1rem; margin-bottom: 0.5rem;
  border: 2px solid #eee; border-radius: 10px;
  cursor: pointer; transition: all 0.2s;
}
.card:hover { border-color: #e25822; }
.card.online { border-color: #16a34a40; background: #f0fdf4; }
.avatar {
  width: 40px; height: 40px; border-radius: 50%;
  background: #e25822; color: white; display: flex;
  align-items: center; justify-content: center;
  font-weight: bold; font-size: 0.85rem;
}
.info { flex: 1; }
.info strong { display: block; font-size: 0.95rem; }
.role { font-size: 0.8rem; color: #666; }
.status { font-size: 1.2rem; }
:root.dark .card { border-color: #333; }
:root.dark .card:hover { border-color: #e25822; }
:root.dark .card.online { border-color: #16a34a60; background: #0a1f0a; }
:root.dark .role { color: #aaa; }`,
  },
];

export function getPreset(name: string): PlaygroundPreset | undefined {
  return presets.find((p) => p.name === name);
}
