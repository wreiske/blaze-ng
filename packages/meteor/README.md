# @blaze-ng/meteor

Meteor Tracker adapter for Blaze-NG. Bridges Meteor's `Tracker` reactive system with Blaze-NG's pluggable reactive system interface.

## Installation

```bash
npm install @blaze-ng/meteor
```

## Usage

```ts
import { Blaze } from '@blaze-ng/core';
import { createTrackerAdapter } from '@blaze-ng/meteor';
import { Tracker } from 'meteor/tracker';

// Create and set the Tracker adapter
const adapter = createTrackerAdapter(Tracker);
Blaze.setReactiveSystem(adapter);

// Now Blaze-NG uses Meteor Tracker for all reactivity
```

## Exports

| Export                 | Description                                                       |
| ---------------------- | ----------------------------------------------------------------- |
| `createTrackerAdapter` | Create a reactive system adapter from a Meteor `Tracker` instance |
| `TrackerAdapter`       | The adapter class implementing `ReactiveSystem`                   |

## How It Works

The adapter wraps Meteor's `Tracker.autorun`, `Tracker.Dependency`, and `ReactiveVar` to conform to Blaze-NG's `ReactiveSystem` interface. This lets Blaze-NG templates participate in Meteor's reactivity graph seamlessly.

## License

MIT
