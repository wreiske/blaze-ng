# @blaze-ng/meteor

Adapter for using Blaze-ng with Meteor's Tracker reactive system.

## Installation

```bash
meteor npm install @blaze-ng/meteor
```

## Setup

```ts
import { Blaze } from '@blaze-ng/core';
import { createTrackerAdapter } from '@blaze-ng/meteor';
import { Tracker } from 'meteor/tracker';
import { ReactiveVar } from 'meteor/reactive-var';

const reactiveSystem = createTrackerAdapter(Tracker, ReactiveVar);
Blaze.setReactiveSystem(reactiveSystem);
```

## API

### `createTrackerAdapter()`

Create a `ReactiveSystem` that wraps Meteor's Tracker.

```ts
function createTrackerAdapter(
  tracker: MeteorTracker,
  ReactiveVarCtor: MeteorReactiveVarConstructor,
): ReactiveSystem;
```

**Parameters:**

- `tracker` — Meteor's `Tracker` object
- `ReactiveVarCtor` — Meteor's `ReactiveVar` constructor

**Returns:** A `ReactiveSystem` compatible with `Blaze.setReactiveSystem()`

### `TrackerAdapter`

Class that implements the adapter:

```ts
class TrackerAdapter implements ReactiveSystem {
  constructor(tracker: MeteorTracker, ReactiveVarCtor: MeteorReactiveVarConstructor);

  autorun(fn: () => void): { stop: () => void };
  createVar<T>(initialValue: T): { get: () => T; set: (v: T) => void };
  nonReactive<T>(fn: () => T): T;
  batch(fn: () => void): void;
}
```

## Types

```ts
interface MeteorTracker {
  autorun(fn: (computation: MeteorComputation) => void): MeteorComputation;
  nonreactive<T>(fn: () => T): T;
  flush(): void;
}

interface MeteorComputation {
  stop(): void;
  invalidate(): void;
  onInvalidate(fn: () => void): void;
}

interface MeteorReactiveVarConstructor {
  new <T>(initialValue: T): MeteorReactiveVarInstance<T>;
}

interface MeteorReactiveVarInstance<T> {
  get(): T;
  set(value: T): void;
}
```

## Usage with Meteor

```ts
// server/main.ts — nothing to do on server

// client/main.ts
import { Blaze } from '@blaze-ng/core';
import { createTrackerAdapter } from '@blaze-ng/meteor';
import { Tracker } from 'meteor/tracker';
import { ReactiveVar } from 'meteor/reactive-var';

// Set up reactive system first
Blaze.setReactiveSystem(createTrackerAdapter(Tracker, ReactiveVar));

// Then import templates
import '../imports/ui/body';
```

After setup, Blaze-ng works identically to original Blaze — all Tracker-based reactivity flows through the adapter.
