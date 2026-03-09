# Lists and Iteration

Render collections of data reactively with `{{#each}}`.

## Basic `{{#each}}`

```handlebars
<ul>
  {{#each fruits}}
    <li>{{this}}</li>
  {{/each}}
</ul>
```

```ts
Template.fruitList.helpers({
  fruits() {
    return ['Apple', 'Banana', 'Cherry'];
  },
});
```

## Iterating Objects

When iterating an array of objects, each object becomes the data context:

```handlebars
{{#each users}}
  <div class="user-card">
    <img src="{{avatar}}" alt="{{name}}">
    <h3>{{name}}</h3>
    <p>{{email}}</p>
  </div>
{{/each}}
```

```ts
Template.userList.helpers({
  users() {
    return [
      { name: 'Alice', email: 'alice@example.com', avatar: '/avatars/alice.jpg' },
      { name: 'Bob', email: 'bob@example.com', avatar: '/avatars/bob.jpg' },
    ];
  },
});
```

## Named Iteration — `{{#each item in list}}`

Avoids data context issues and makes code clearer:

```handlebars
{{#each user in users}}
  <div class="user-card">
    <img src="{{user.avatar}}" alt="{{user.name}}">
    <h3>{{user.name}}</h3>
    <p>{{user.email}}</p>
    {{!-- Can access outer context directly --}}
    <span>From: {{organizationName}}</span>
  </div>
{{/each}}
```

This is especially useful when nesting:

```handlebars
{{#each department in departments}}
  <h2>{{department.name}}</h2>
  {{#each employee in department.employees}}
    <div>
      {{employee.name}} — {{department.name}}
      {{!-- No need for ../../ to reach outer context --}}
    </div>
  {{/each}}
{{/each}}
```

## Empty State with `{{else}}`

Show a fallback when the list is empty:

```handlebars
{{#each tasks}}
  <div class="task">
    <input type="checkbox" checked={{completed}}>
    <span>{{text}}</span>
  </div>
{{else}}
  <div class="empty-state">
    <img src="/empty-tasks.svg" alt="">
    <h3>No tasks yet</h3>
    <p>Create your first task to get started.</p>
    <button class="create-first">Create Task</button>
  </div>
{{/each}}
```

## Reactive Cursors

`{{#each}}` works seamlessly with reactive data sources. When the underlying data changes, only the affected DOM elements are updated:

```ts
Template.taskList.helpers({
  tasks() {
    // Returns a reactive cursor — UI updates automatically
    return Tasks.find(
      { listId: this.listId },
      { sort: { createdAt: -1 } }
    );
  },
});
```

```handlebars
{{#each task in tasks}}
  <div class="task" data-id="{{task._id}}">
    <span class="text {{#if task.completed}}done{{/if}}">
      {{task.text}}
    </span>
    <time>{{formatDate task.createdAt}}</time>
  </div>
{{/each}}
```

### How Reactive Updates Work

When an item is:
- **Added** → Only the new element is inserted
- **Removed** → Only that element is removed
- **Moved** → The element is repositioned (no re-render)
- **Changed** → Only that element's content updates

This means hundreds of items can update efficiently without re-rendering the entire list.

## Nested Iteration

```handlebars
<template name="kanbanBoard">
  {{#each column in columns}}
    <div class="column">
      <h2>{{column.title}} ({{column.cards.length}})</h2>
      <div class="cards">
        {{#each card in column.cards}}
          <div class="card" draggable="true" data-card-id="{{card._id}}">
            <h4>{{card.title}}</h4>
            {{#if card.labels.length}}
              <div class="labels">
                {{#each label in card.labels}}
                  <span class="label" style="background: {{label.color}}">
                    {{label.name}}
                  </span>
                {{/each}}
              </div>
            {{/if}}
            {{#if card.assignee}}
              <img class="assignee" src="{{card.assignee.avatar}}" 
                   alt="{{card.assignee.name}}">
            {{/if}}
          </div>
        {{/each}}
      </div>
      <button class="add-card" data-column-id="{{column._id}}">
        + Add Card
      </button>
    </div>
  {{/each}}
</template>
```

## Index Access

Use `@index` to get the zero-based index of the current item:

```handlebars
{{#each items}}
  <div class="item {{#if (eq @index 0)}}first{{/if}}">
    <span class="number">{{add @index 1}}.</span>
    <span>{{name}}</span>
  </div>
{{/each}}
```

## Filtering and Sorting

Use helpers to transform data before rendering:

```ts
Template.productList.helpers({
  filteredProducts() {
    const filter = Template.instance().filter.get();
    const sort = Template.instance().sort.get();
    
    const query = {};
    if (filter.category) query.category = filter.category;
    if (filter.minPrice) query.price = { $gte: filter.minPrice };
    if (filter.search) {
      query.name = { $regex: filter.search, $options: 'i' };
    }
    
    return Products.find(query, {
      sort: { [sort.field]: sort.direction },
      limit: 50,
    });
  },
  categories() {
    return _.uniq(Products.find().map(p => p.category)).sort();
  },
});
```

```handlebars
<template name="productList">
  <div class="filters">
    <input type="search" class="search" placeholder="Search products...">
    <select class="category-filter">
      <option value="">All Categories</option>
      {{#each category in categories}}
        <option value="{{category}}">{{category}}</option>
      {{/each}}
    </select>
    <select class="sort">
      <option value="name">Name</option>
      <option value="price">Price</option>
      <option value="createdAt">Newest</option>
    </select>
  </div>

  <div class="product-grid">
    {{#each product in filteredProducts}}
      <div class="product-card">
        <img src="{{product.image}}" alt="{{product.name}}">
        <h3>{{product.name}}</h3>
        <p class="price">{{formatCurrency product.price}}</p>
        <span class="category">{{product.category}}</span>
        <button class="add-to-cart" data-id="{{product._id}}">
          Add to Cart
        </button>
      </div>
    {{else}}
      <div class="no-results">
        <p>No products match your filters.</p>
        <button class="clear-filters">Clear Filters</button>
      </div>
    {{/each}}
  </div>
</template>
```

## Performance Tips

### Use `_id` for Efficient Diffing

When iterating database documents, Blaze uses `_id` to track items. This enables efficient DOM updates:

```ts
// Good — returns cursor, Blaze uses _id for tracking
Template.list.helpers({
  items() { return Items.find(); },
});

// Also good — array with _id fields
Template.list.helpers({
  items() {
    return [
      { _id: '1', name: 'First' },
      { _id: '2', name: 'Second' },
    ];
  },
});
```

### Limit Rendered Items

For large lists, paginate or virtualize:

```ts
Template.infiniteList.onCreated(function () {
  this.limit = new ReactiveVar(20);
});

Template.infiniteList.helpers({
  items() {
    return Items.find({}, { 
      sort: { createdAt: -1 },
      limit: Template.instance().limit.get(),
    });
  },
  hasMore() {
    return Items.find().count() > Template.instance().limit.get();
  },
});

Template.infiniteList.events({
  'click .load-more'(event, instance) {
    instance.limit.set(instance.limit.get() + 20);
  },
});
```

### Avoid Heavy Helpers in Loops

```handlebars
{{!-- Bad: expensiveHelper runs for every item --}}
{{#each items}}
  {{#if (expensiveCheck this)}}
    <div>{{name}}</div>
  {{/if}}
{{/each}}

{{!-- Better: filter in the helper first --}}
{{#each filteredItems}}
  <div>{{name}}</div>
{{/each}}
```

## Complete Example: Sortable Table

```handlebars
<template name="dataTable">
  <table class="data-table">
    <thead>
      <tr>
        {{#each column in columns}}
          <th class="{{#if (eq sortField column.field)}}sorted {{sortDirection}}{{/if}}"
              data-field="{{column.field}}">
            {{column.label}}
            {{#if (eq sortField column.field)}}
              <span class="sort-indicator">
                {{#if (eq sortDirection "asc")}}▲{{else}}▼{{/if}}
              </span>
            {{/if}}
          </th>
        {{/each}}
      </tr>
    </thead>
    <tbody>
      {{#each row in rows}}
        <tr class="{{#if row.selected}}selected{{/if}}">
          {{#each column in ../columns}}
            <td>{{lookup row column.field}}</td>
          {{/each}}
        </tr>
      {{else}}
        <tr>
          <td colspan="{{columns.length}}" class="empty">
            No data available
          </td>
        </tr>
      {{/each}}
    </tbody>
  </table>
  
  {{#if hasMore}}
    <div class="pagination">
      <span>Showing {{rows.length}} of {{totalCount}}</span>
      <button class="load-more">Load More</button>
    </div>
  {{/if}}
</template>
```

```ts
Template.dataTable.onCreated(function () {
  this.sortField = new ReactiveVar('name');
  this.sortDirection = new ReactiveVar('asc');
  this.limit = new ReactiveVar(25);
});

Template.dataTable.helpers({
  columns: () => [
    { field: 'name', label: 'Name' },
    { field: 'email', label: 'Email' },
    { field: 'role', label: 'Role' },
    { field: 'createdAt', label: 'Joined' },
  ],
  rows() {
    const instance = Template.instance();
    const sortField = instance.sortField.get();
    const direction = instance.sortDirection.get() === 'asc' ? 1 : -1;
    return Users.find({}, {
      sort: { [sortField]: direction },
      limit: instance.limit.get(),
    });
  },
  sortField() { return Template.instance().sortField.get(); },
  sortDirection() { return Template.instance().sortDirection.get(); },
  totalCount() { return Users.find().count(); },
  hasMore() {
    return Users.find().count() > Template.instance().limit.get();
  },
});

Template.dataTable.events({
  'click th[data-field]'(event, instance) {
    const field = event.currentTarget.dataset.field;
    if (instance.sortField.get() === field) {
      instance.sortDirection.set(
        instance.sortDirection.get() === 'asc' ? 'desc' : 'asc'
      );
    } else {
      instance.sortField.set(field);
      instance.sortDirection.set('asc');
    }
  },
  'click .load-more'(event, instance) {
    instance.limit.set(instance.limit.get() + 25);
  },
});
```
