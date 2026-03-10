import { Meteor } from 'meteor/meteor';
import { Template } from 'meteor/templating';

import './chat.html';

// ─── Participants (static for demo) ──────────────────────────────────────────

const PARTICIPANTS = [
  { name: 'Alice Chen', initials: 'AC', color: '#3b82f6' },
  { name: 'Bob Smith', initials: 'BS', color: '#8b5cf6' },
  { name: 'Carol Diaz', initials: 'CD', color: '#ec4899' },
  { name: 'Dave Kim', initials: 'DK', color: '#f59e0b' },
];

// ─── Isomorphic helpers (work on both client + server for SSR) ───────────────

// On the server, template instances are registered by Meteor's build system
// (via server-meteor.js HTML imports) which runs after the rspack bundle.
// Defer helper registration to Meteor.startup() so templates are available.
function registerChatHelpers() {
  Template.chatPage.helpers({
    participants() {
      return PARTICIPANTS;
    },
    participantCount() {
      return PARTICIPANTS.length;
    },
    messageCount() {
      if (Meteor.isServer) return this.messages ? this.messages.length : 0;
      const Messages = require('../api/messages').Messages;
      return Messages.find().count();
    },
    messageGroups() {
      let msgs;
      if (Meteor.isServer) {
        msgs = this.messages || [];
      } else {
        const Messages = require('../api/messages').Messages;
        msgs = Messages.find({}, { sort: { createdAt: 1 } }).fetch();
      }

      const groups = [];
      let currentDate = null;
      let currentGroup = null;

      msgs.forEach((msg) => {
        const dateLabel = formatDateLabel(msg.createdAt);
        if (dateLabel !== currentDate) {
          currentDate = dateLabel;
          currentGroup = { date: dateLabel, messages: [] };
          groups.push(currentGroup);
        }
        currentGroup.messages.push(msg);
      });

      return groups;
    },
  });
}

Meteor.startup(() => {
  registerChatHelpers();

  // ─── Client-only: subscription, events, lifecycle ────────────────────────────

  if (Meteor.isClient) {
    const { Messages } = require('../api/messages');

    Template.chatPage.onCreated(function () {
      this.subscribe('messages');
    });

    Template.chatPage.events({
      'click #chatSend'() {
        sendMessage();
      },
      'keydown #chatInput'(event) {
        if (event.key === 'Enter') sendMessage();
      },
    });

    Template.chatPage.onRendered(function () {
      const input = document.getElementById('chatInput');
      if (input) input.focus();
    });

    function sendMessage() {
      const input = document.getElementById('chatInput');
      const text = input.value.trim();
      if (!text) return;
      input.value = '';
      Meteor.call('messages.insert', text);
    }
  }
});

// ─── Shared helpers ──────────────────────────────────────────────────────────

function formatDateLabel(date) {
  const now = new Date();
  const d = new Date(date);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const msgDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());

  if (msgDay.getTime() === today.getTime()) return 'Today';
  if (msgDay.getTime() === yesterday.getTime()) return 'Yesterday';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
