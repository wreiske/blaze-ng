# Conditionals

Control what's rendered based on reactive data using `{{#if}}` and `{{#unless}}`.

## Basic `{{#if}}`

```handlebars
{{#if isVisible}}
  <div class='content'>This is visible!</div>
{{/if}}
```

The block renders when the value is **truthy**. Blaze considers these falsy:

- `false`
- `null`
- `undefined`
- `0`
- `""` (empty string)
- `[]` (empty array — Blaze-specific!)

## `{{else}}` Branch

```handlebars
{{#if hasMessages}}
  <div class='inbox'>
    {{#each messages}}
      <div class='message'>{{text}}</div>
    {{/each}}
  </div>
{{else}}
  <div class='empty-state'>
    <img src='/no-messages.svg' alt='' />
    <p>No messages yet</p>
  </div>
{{/if}}
```

## `{{#unless}}`

The inverse of `{{#if}}` — renders when the value is **falsy**:

```handlebars
{{#unless isLoading}}
  <div class='results'>
    {{#each results}}
      <div>{{title}}</div>
    {{/each}}
  </div>
{{/unless}}
```

`{{#unless}}` also supports `{{else}}`:

```handlebars
{{#unless error}}
  <p class='success'>Everything looks good!</p>
{{else}}
  <p class='error'>{{error}}</p>
{{/unless}}
```

## Using Helpers

Conditionals can use helpers that return boolean values:

```ts
Template.taskList.helpers({
  hasActiveTasks() {
    return Tasks.find({ completed: false }).count() > 0;
  },
  isOverdue() {
    return this.dueDate && this.dueDate < new Date();
  },
  canEdit() {
    return this.ownerId === Meteor.userId() || Roles.userIsInRole(Meteor.userId(), 'admin');
  },
});
```

```handlebars
{{#if hasActiveTasks}}
  <h2>Active Tasks</h2>
  {{#each activeTasks}}
    <div class="task {{#if isOverdue}}overdue{{/if}}">
      <span>{{text}}</span>
      {{#if canEdit}}
        <button class="edit">Edit</button>
      {{/if}}
    </div>
  {{/each}}
{{else}}
  <p>All tasks completed! 🎉</p>
{{/if}}
```

## Nested Conditionals

```handlebars
{{#if currentUser}}
  {{#if isAdmin}}
    <nav class='admin-nav'>
      <a href='/admin/users'>Users</a>
      <a href='/admin/settings'>Settings</a>
    </nav>
  {{else}}
    <nav class='user-nav'>
      <a href='/dashboard'>Dashboard</a>
      <a href='/profile'>Profile</a>
    </nav>
  {{/if}}
{{else}}
  <nav class='public-nav'>
    <a href='/login'>Log In</a>
    <a href='/register'>Sign Up</a>
  </nav>
{{/if}}
```

## Inline Conditional Patterns

### Conditional CSS Classes

```handlebars
<div class="btn {{#if isPrimary}}btn-primary{{else}}btn-secondary{{/if}}">
  {{label}}
</div>

<tr class="{{#if isSelected}}selected{{/if}} {{#if isDisabled}}disabled{{/if}}">
  <td>{{name}}</td>
</tr>
```

### Conditional Attributes

```handlebars
<input
  type="text"
  value="{{value}}"
  {{#if isRequired}}required{{/if}}
  {{#if isDisabled}}disabled{{/if}}
  {{#if maxLength}}maxlength="{{maxLength}}"{{/if}}
>

<button
  class="btn"
  {{#if isLoading}}disabled{{/if}}
>
  {{#if isLoading}}
    <span class="spinner"></span> Saving...
  {{else}}
    Save
  {{/if}}
</button>
```

## Nested Expressions in Conditionals

Use parentheses for complex conditions:

```handlebars
{{! Helper-based logic }}
{{#if (and isLoggedIn hasPermission)}}
  <button>Delete</button>
{{/if}}

{{#if (or isOwner isAdmin)}}
  <button>Edit</button>
{{/if}}

{{#if (not isArchived)}}
  <div class='actions'>...</div>
{{/if}}

{{#if (gt itemCount 0)}}
  <span class='badge'>{{itemCount}}</span>
{{/if}}

{{#if (eq status 'active')}}
  <span class='status active'>Active</span>
{{/if}}
```

Register the comparison helpers:

```ts
Template.registerHelper('and', (a, b) => a && b);
Template.registerHelper('or', (a, b) => a || b);
Template.registerHelper('not', (a) => !a);
Template.registerHelper('eq', (a, b) => a === b);
Template.registerHelper('gt', (a, b) => a > b);
Template.registerHelper('lt', (a, b) => a < b);
Template.registerHelper('gte', (a, b) => a >= b);
Template.registerHelper('lte', (a, b) => a <= b);
```

## Complete Example: Notification Center

```handlebars
<template name="notificationCenter">
  <div class="notification-center">
    <button class="bell" aria-label="Notifications">
      🔔
      {{#if (gt unreadCount 0)}}
        <span class="badge">{{unreadCount}}</span>
      {{/if}}
    </button>

    {{#if isOpen}}
      <div class="dropdown">
        <div class="header">
          <h3>Notifications</h3>
          {{#if (gt unreadCount 0)}}
            <button class="mark-all-read">Mark all read</button>
          {{/if}}
        </div>

        {{#if isLoading}}
          <div class="loading">
            <span class="spinner"></span>
            Loading notifications...
          </div>
        {{else}}
          {{#if hasNotifications}}
            {{#each notification in notifications}}
              <div class="notification {{#unless notification.read}}unread{{/unless}}">
                {{#if (eq notification.type "mention")}}
                  <span class="icon">@</span>
                {{/if}}
                {{#if (eq notification.type "like")}}
                  <span class="icon">❤️</span>
                {{/if}}
                {{#if (eq notification.type "comment")}}
                  <span class="icon">💬</span>
                {{/if}}

                <div class="body">
                  <p>{{notification.message}}</p>
                  <time>{{formatDate notification.createdAt}}</time>
                </div>
              </div>
            {{/each}}
          {{else}}
            <div class="empty">
              <p>No notifications</p>
              <small>You're all caught up!</small>
            </div>
          {{/if}}
        {{/if}}
      </div>
    {{/if}}
  </div>
</template>
```

```ts
Template.notificationCenter.onCreated(function () {
  this.isOpen = new ReactiveVar(false);
  this.autorun(() => {
    if (this.isOpen.get()) {
      this.subscribe('notifications');
    }
  });
});

Template.notificationCenter.helpers({
  isOpen() {
    return Template.instance().isOpen.get();
  },
  isLoading() {
    return !Template.instance().subscriptionsReady();
  },
  unreadCount() {
    return Notifications.find({ read: false }).count();
  },
  hasNotifications() {
    return Notifications.find().count() > 0;
  },
  notifications() {
    return Notifications.find({}, { sort: { createdAt: -1 } });
  },
});

Template.notificationCenter.events({
  'click .bell'(event, instance) {
    instance.isOpen.set(!instance.isOpen.get());
  },
  'click .mark-all-read'() {
    Meteor.call('notifications.markAllRead');
  },
});
```
