# Example: Chat App

A real-time chat application with rooms, message history, typing indicators, and user presence.

## Templates

```handlebars
<template name="chatApp">
  <div class="chat-app">
    {{> chatSidebar rooms=rooms currentRoom=currentRoom}}
    {{#if currentRoom}}
      {{> chatRoom room=currentRoom}}
    {{else}}
      <div class="no-room-selected">
        <h2>Welcome to Chat</h2>
        <p>Select a room to start chatting</p>
      </div>
    {{/if}}
  </div>
</template>

<template name="chatSidebar">
  <aside class="sidebar">
    <div class="sidebar-header">
      <h2>Rooms</h2>
      <button class="new-room" title="Create Room">+</button>
    </div>
    <ul class="room-list">
      {{#each room in rooms}}
        <li class="room-item {{#if (eq room._id ../currentRoom._id)}}active{{/if}}"
            data-room-id="{{room._id}}">
          <span class="room-name"># {{room.name}}</span>
          {{#if room.unreadCount}}
            <span class="unread-badge">{{room.unreadCount}}</span>
          {{/if}}
        </li>
      {{/each}}
    </ul>
    <div class="sidebar-footer">
      <div class="current-user">
        <span class="status-dot online"></span>
        {{currentUser.name}}
      </div>
    </div>
  </aside>
</template>

<template name="chatRoom">
  <div class="chat-room">
    <header class="room-header">
      <h3># {{room.name}}</h3>
      <span class="member-count">{{room.memberCount}} members</span>
    </header>

    <div class="messages-container">
      {{#if isLoading}}
        <div class="loading">Loading messages...</div>
      {{/if}}

      {{#if hasOlderMessages}}
        <button class="load-more">Load older messages</button>
      {{/if}}

      {{#each message in messages}}
        {{> chatMessage message=message
                        isOwn=(eq message.userId currentUserId)
                        showAvatar=(shouldShowAvatar message @index)}}
      {{/each}}

      {{#if typingUsers.length}}
        <div class="typing-indicator">
          {{typingText}} {{typingDots}}
        </div>
      {{/if}}
    </div>

    <form class="message-form">
      <input type="text" class="message-input"
             placeholder="Type a message..."
             value="{{draft}}"
             autocomplete="off">
      <button type="submit" {{#unless draft}}disabled{{/unless}}>
        Send
      </button>
    </form>
  </div>
</template>

<template name="chatMessage">
  <div class="message {{#if isOwn}}own{{/if}} {{#if message.isSystem}}system{{/if}}">
    {{#if showAvatar}}
      <img class="avatar" src="{{message.user.avatar}}" alt="{{message.user.name}}">
    {{else}}
      <div class="avatar-spacer"></div>
    {{/if}}
    <div class="message-content">
      {{#if showAvatar}}
        <div class="message-header">
          <strong class="author">{{message.user.name}}</strong>
          <time>{{formatTime message.createdAt}}</time>
        </div>
      {{/if}}
      <div class="message-body">
        {{#if message.isSystem}}
          <em>{{message.text}}</em>
        {{else}}
          {{message.text}}
        {{/if}}
      </div>
      {{#if message.reactions.length}}
        <div class="reactions">
          {{#each reaction in message.reactions}}
            <button class="reaction {{#if reaction.isMine}}mine{{/if}}"
                    data-emoji="{{reaction.emoji}}">
              {{reaction.emoji}} {{reaction.count}}
            </button>
          {{/each}}
        </div>
      {{/if}}
    </div>
  </div>
</template>
```

## JavaScript

```ts
import { Template } from '@blaze-ng/templating-runtime';
import { Blaze, SimpleReactiveSystem } from '@blaze-ng/core';

Blaze.setReactiveSystem(new SimpleReactiveSystem());

// ── chatApp ─────────────────────────────────────────────

Template.chatApp.onCreated(function () {
  this.currentRoomId = new ReactiveVar(null);
  this.rooms = new ReactiveVar([
    { _id: 'general', name: 'general', memberCount: 42, unreadCount: 0 },
    { _id: 'random', name: 'random', memberCount: 28, unreadCount: 3 },
    { _id: 'engineering', name: 'engineering', memberCount: 15, unreadCount: 0 },
  ]);
});

Template.chatApp.helpers({
  rooms() {
    return Template.instance().rooms.get();
  },
  currentRoom() {
    const id = Template.instance().currentRoomId.get();
    return Template.instance()
      .rooms.get()
      .find((r) => r._id === id);
  },
});

// ── chatSidebar ─────────────────────────────────────────

Template.chatSidebar.helpers({
  currentUser() {
    return { name: 'You', status: 'online' };
  },
});

Template.chatSidebar.events({
  'click .room-item'(event, instance) {
    const roomId = event.currentTarget.dataset.roomId;
    // Access parent template's state
    Template.instance().view.parentView.templateInstance().currentRoomId.set(roomId);
  },
});

// ── chatRoom ────────────────────────────────────────────

Template.chatRoom.onCreated(function () {
  this.messages = new ReactiveVar([]);
  this.draft = new ReactiveVar('');
  this.isLoading = new ReactiveVar(false);
  this.typingUsers = new ReactiveVar([]);
  this.limit = new ReactiveVar(50);

  // Simulate loading messages
  this.autorun(() => {
    const room = this.data.room;
    if (room) {
      this.isLoading.set(true);
      // In real app: this.subscribe('messages', room._id, this.limit.get());
      setTimeout(() => {
        this.messages.set(getSampleMessages(room._id));
        this.isLoading.set(false);
      }, 500);
    }
  });
});

Template.chatRoom.onRendered(function () {
  // Scroll to bottom on new messages
  this.autorun(() => {
    this.messages.get(); // Depend on messages
    const container = this.find('.messages-container');
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  });
});

Template.chatRoom.helpers({
  messages() {
    return Template.instance().messages.get();
  },
  draft() {
    return Template.instance().draft.get();
  },
  isLoading() {
    return Template.instance().isLoading.get();
  },
  currentUserId() {
    return 'current-user';
  },
  typingUsers() {
    return Template.instance().typingUsers.get();
  },
  typingText() {
    const users = Template.instance().typingUsers.get();
    if (users.length === 1) return `${users[0].name} is typing`;
    if (users.length === 2) return `${users[0].name} and ${users[1].name} are typing`;
    return 'Several people are typing';
  },
  typingDots() {
    return '...';
  },
  hasOlderMessages() {
    return false;
  },
  shouldShowAvatar(message, index) {
    const messages = Template.instance().messages.get();
    if (index === 0) return true;
    const prev = messages[index - 1];
    return prev.userId !== message.userId;
  },
});

Template.chatRoom.events({
  'submit .message-form'(event, instance) {
    event.preventDefault();
    const text = instance.draft.get().trim();
    if (!text) return;

    const messages = instance.messages.get();
    messages.push({
      _id: String(Date.now()),
      text,
      userId: 'current-user',
      user: { name: 'You', avatar: '/avatars/you.jpg' },
      createdAt: new Date(),
      reactions: [],
    });
    instance.messages.set([...messages]);
    instance.draft.set('');
  },
  'input .message-input'(event, instance) {
    instance.draft.set(event.target.value);
    // In real app: Meteor.call('typing.start', roomId);
  },
  'click .load-more'(event, instance) {
    instance.limit.set(instance.limit.get() + 50);
  },
});

// ── chatMessage ─────────────────────────────────────────

Template.chatMessage.events({
  'click .reaction'(event) {
    const emoji = event.currentTarget.dataset.emoji;
    // In real app: Meteor.call('messages.react', this.message._id, emoji);
    console.log(`React with ${emoji} on message ${this.message._id}`);
  },
});

// ── Global Helpers ──────────────────────────────────────

Template.registerHelper('eq', (a, b) => a === b);

Template.registerHelper('formatTime', (date) => {
  if (!date) return '';
  const d = new Date(date);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
});

// ── Sample Data ─────────────────────────────────────────

function getSampleMessages(roomId) {
  return [
    {
      _id: '1',
      text: `Welcome to #${roomId}! 👋`,
      userId: 'system',
      user: { name: 'System', avatar: '/avatars/bot.jpg' },
      createdAt: new Date(Date.now() - 3600000),
      reactions: [],
      isSystem: true,
    },
    {
      _id: '2',
      text: "Hey everyone! How's the new Blaze-ng library looking?",
      userId: 'alice',
      user: { name: 'Alice', avatar: '/avatars/alice.jpg' },
      createdAt: new Date(Date.now() - 1800000),
      reactions: [{ emoji: '👍', count: 3, isMine: true }],
    },
    {
      _id: '3',
      text: 'Really impressed with the TypeScript support! The DX is excellent.',
      userId: 'bob',
      user: { name: 'Bob', avatar: '/avatars/bob.jpg' },
      createdAt: new Date(Date.now() - 900000),
      reactions: [{ emoji: '🔥', count: 2, isMine: false }],
    },
    {
      _id: '4',
      text: "The BYORS concept is genius. I'm using it with Preact signals and it's blazing fast.",
      userId: 'alice',
      user: { name: 'Alice', avatar: '/avatars/alice.jpg' },
      createdAt: new Date(Date.now() - 600000),
      reactions: [],
    },
  ];
}

// ── Render ──────────────────────────────────────────────

Blaze.render(Template.chatApp, document.getElementById('app'));
```

## Styles

```css
.chat-app {
  display: grid;
  grid-template-columns: 250px 1fr;
  height: 100vh;
  font-family: system-ui, sans-serif;
}

/* Sidebar */
.sidebar {
  background: #1e1e2e;
  color: white;
  display: flex;
  flex-direction: column;
}

.sidebar-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  border-bottom: 1px solid #313244;
}

.room-list {
  list-style: none;
  padding: 0.5rem;
  margin: 0;
  flex: 1;
  overflow-y: auto;
}

.room-item {
  padding: 0.5rem 0.75rem;
  border-radius: 6px;
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.room-item:hover {
  background: #313244;
}
.room-item.active {
  background: #4f46e5;
}

.unread-badge {
  background: #ef4444;
  color: white;
  font-size: 0.75rem;
  padding: 0.125rem 0.375rem;
  border-radius: 999px;
}

.sidebar-footer {
  padding: 1rem;
  border-top: 1px solid #313244;
}

.status-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-right: 0.5rem;
}
.status-dot.online {
  background: #22c55e;
}

/* Chat Room */
.chat-room {
  display: flex;
  flex-direction: column;
  height: 100vh;
}

.room-header {
  padding: 1rem;
  border-bottom: 1px solid #e2e8f0;
  display: flex;
  align-items: baseline;
  gap: 1rem;
}

.member-count {
  color: #64748b;
  font-size: 0.875rem;
}

.messages-container {
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
}

/* Messages */
.message {
  display: flex;
  gap: 0.75rem;
  margin-bottom: 0.25rem;
  padding: 0.25rem 0;
}

.message .avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  object-fit: cover;
}

.avatar-spacer {
  width: 36px;
}

.message-header {
  display: flex;
  gap: 0.5rem;
  align-items: baseline;
  margin-bottom: 0.125rem;
}

.message-header time {
  font-size: 0.75rem;
  color: #94a3b8;
}

.message.system {
  justify-content: center;
  color: #64748b;
  font-size: 0.875rem;
}

.reactions {
  display: flex;
  gap: 0.25rem;
  margin-top: 0.25rem;
}

.reaction {
  padding: 0.125rem 0.5rem;
  border: 1px solid #e2e8f0;
  border-radius: 999px;
  background: white;
  font-size: 0.75rem;
  cursor: pointer;
}

.reaction.mine {
  border-color: #4f46e5;
  background: #eef2ff;
}

.typing-indicator {
  color: #64748b;
  font-size: 0.875rem;
  padding: 0.5rem 0;
  font-style: italic;
}

/* Message Form */
.message-form {
  display: flex;
  gap: 0.5rem;
  padding: 1rem;
  border-top: 1px solid #e2e8f0;
}

.message-input {
  flex: 1;
  padding: 0.75rem;
  border: 2px solid #e2e8f0;
  border-radius: 8px;
  font-size: 1rem;
}

.message-input:focus {
  border-color: #4f46e5;
  outline: none;
}

.no-room-selected {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100vh;
  color: #64748b;
}
```

## What This Demonstrates

- **Template composition** — sidebar, room, and message components
- **Named iteration** — `{{#each room in rooms}}`, `{{#each message in messages}}`
- **Data passing** — passing data between parent and child templates
- **Reactive state** — messages, typing indicators, room selection
- **Lifecycle hooks** — `onCreated` for data loading, `onRendered` for scroll
- **Autorun** — reactive computations for data fetching and scroll behavior
- **Event delegation** — click handlers on list items with `data-*` attributes
- **Conditional rendering** — loading states, empty states, system messages
- **Global helpers** — `eq`, `formatTime` used across templates
