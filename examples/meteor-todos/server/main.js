import { Meteor } from 'meteor/meteor';
import { Todos } from '../imports/api/todos';

Meteor.startup(async () => {
  // Seed with sample data if empty
  if ((await Todos.find().countAsync()) === 0) {
    const samples = [
      { text: 'Learn Blaze-NG', completed: false },
      { text: 'Build a todo app', completed: true },
      { text: 'Ship to production', completed: false },
    ];
    for (const todo of samples) {
      await Todos.insertAsync({ ...todo, createdAt: new Date() });
    }
  }
});
