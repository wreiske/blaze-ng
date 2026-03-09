# Custom Reactive Systems

Blaze-ng is **framework-agnostic** — it doesn't bundle a reactive system. You choose (or build) the reactivity layer that fits your stack.

## Why BYORS (Bring Your Own Reactive System)?

Original Blaze was tightly coupled to Meteor's Tracker. Blaze-ng decouples reactivity so you can use it with:

- **Meteor Tracker** — drop-in compatibility for Meteor apps
- **Signals** — modern fine-grained reactivity (SolidJS, Preact, etc.)
- **RxJS** — observable-based reactivity for Angular/enterprise apps
- **Custom** — roll your own for minimal overhead

## The ReactiveSystem Interface

Every reactive system must implement this interface:

```ts
interface ReactiveSystem {
  /** Run a function reactively — re-run when dependencies change */
  autorun(fn: () => void): { stop: () => void };

  /** Create a reactive variable */
  createVar<T>(initialValue: T): { get: () => T; set: (v: T) => void };

  /** Run a function without tracking dependencies */
  nonReactive<T>(fn: () => T): T;

  /** Batch multiple updates into one flush */
  batch?(fn: () => void): void;
}
```

## Setting Up

Register your reactive system before creating any templates:

```ts
import { Blaze } from '@blaze-ng/core';

Blaze.setReactiveSystem(myReactiveSystem);
```

## Built-in: SimpleReactiveSystem

Blaze-ng ships with a minimal reactive system for quick prototyping:

```ts
import { Blaze } from '@blaze-ng/core';
import { SimpleReactiveSystem } from '@blaze-ng/core/testing';

Blaze.setReactiveSystem(new SimpleReactiveSystem());
```

Features:

- Automatic dependency tracking
- Synchronous re-runs
- `ReactiveVar` with `get()`/`set()`
- No external dependencies

```ts
const reactive = new SimpleReactiveSystem();

const name = reactive.createVar('Alice');

const computation = reactive.autorun(() => {
  console.log(`Hello, ${name.get()}!`);
});
// Logs: "Hello, Alice!"

name.set('Bob');
// Logs: "Hello, Bob!"

computation.stop();
name.set('Charlie');
// Nothing logged — computation stopped
```

## Meteor Tracker Adapter

For Meteor apps, wrap Tracker to implement the interface:

```ts
import { Tracker } from 'meteor/tracker';
import { ReactiveVar } from 'meteor/reactive-var';
import { Blaze } from '@blaze-ng/core';

const trackerSystem = {
  autorun(fn) {
    const computation = Tracker.autorun(fn);
    return { stop: () => computation.stop() };
  },

  createVar(initialValue) {
    const rv = new ReactiveVar(initialValue);
    return {
      get: () => rv.get(),
      set: (v) => rv.set(v),
    };
  },

  nonReactive(fn) {
    return Tracker.nonreactive(fn);
  },

  batch(fn) {
    // Tracker uses afterFlush for batching
    Tracker.flush();
    fn();
    Tracker.flush();
  },
};

Blaze.setReactiveSystem(trackerSystem);
```

## SolidJS Signals Adapter

Use SolidJS's fine-grained reactivity:

```ts
import { createSignal, createEffect, untrack, batch } from 'solid-js';
import { Blaze } from '@blaze-ng/core';

const solidSystem = {
  autorun(fn) {
    let disposed = false;
    // SolidJS createEffect returns a dispose function in certain contexts
    const dispose = createEffect(() => {
      if (!disposed) fn();
    });
    return {
      stop() {
        disposed = true;
        if (dispose) dispose();
      },
    };
  },

  createVar(initialValue) {
    const [get, set] = createSignal(initialValue);
    return { get, set };
  },

  nonReactive(fn) {
    return untrack(fn);
  },

  batch(fn) {
    batch(fn);
  },
};

Blaze.setReactiveSystem(solidSystem);
```

## Preact Signals Adapter

Use `@preact/signals-core` for lightweight signals:

```ts
import { signal, effect, untracked, batch } from '@preact/signals-core';
import { Blaze } from '@blaze-ng/core';

const preactSystem = {
  autorun(fn) {
    const dispose = effect(fn);
    return { stop: dispose };
  },

  createVar(initialValue) {
    const s = signal(initialValue);
    return {
      get: () => s.value,
      set: (v) => {
        s.value = v;
      },
    };
  },

  nonReactive(fn) {
    return untracked(fn);
  },

  batch(fn) {
    batch(fn);
  },
};

Blaze.setReactiveSystem(preactSystem);
```

## RxJS Adapter

For Angular or RxJS-heavy stacks:

```ts
import { BehaviorSubject, Subscription } from 'rxjs';
import { distinctUntilChanged } from 'rxjs/operators';
import { Blaze } from '@blaze-ng/core';

const rxjsSystem = {
  autorun(fn) {
    // Track subscriptions created during fn
    const subscriptions = new Subscription();
    let isTracking = true;

    // Initial run
    fn();
    isTracking = false;

    return {
      stop() {
        subscriptions.unsubscribe();
      },
    };
  },

  createVar(initialValue) {
    const subject = new BehaviorSubject(initialValue);
    return {
      get: () => subject.getValue(),
      set: (v) => subject.next(v),
      // Expose observable for RxJS interop
      observable: subject.pipe(distinctUntilChanged()),
    };
  },

  nonReactive(fn) {
    return fn();
  },
};

Blaze.setReactiveSystem(rxjsSystem);
```

## Building Your Own

For maximum control, build a minimal reactive system:

```ts
interface Computation {
  fn: () => void;
  deps: Set<Dependency>;
  stop: () => void;
}

interface Dependency {
  computations: Set<Computation>;
}

let activeComputation: Computation | null = null;
let isBatching = false;
let pendingFlush = new Set<Computation>();

const customSystem = {
  autorun(fn) {
    const computation: Computation = {
      fn,
      deps: new Set(),
      stop() {
        // Remove this computation from all its dependencies
        for (const dep of computation.deps) {
          dep.computations.delete(computation);
        }
        computation.deps.clear();
      },
    };

    // Run and track dependencies
    const run = () => {
      computation.stop(); // Clear old deps
      activeComputation = computation;
      try {
        fn();
      } finally {
        activeComputation = null;
      }
    };

    computation.fn = run;
    run(); // Initial run

    return { stop: () => computation.stop() };
  },

  createVar(initialValue) {
    let value = initialValue;
    const dep: Dependency = { computations: new Set() };

    return {
      get() {
        // Track dependency
        if (activeComputation) {
          dep.computations.add(activeComputation);
          activeComputation.deps.add(dep);
        }
        return value;
      },
      set(newValue) {
        if (Object.is(value, newValue)) return;
        value = newValue;

        if (isBatching) {
          for (const comp of dep.computations) {
            pendingFlush.add(comp);
          }
        } else {
          // Re-run all dependent computations
          for (const comp of [...dep.computations]) {
            comp.fn();
          }
        }
      },
    };
  },

  nonReactive(fn) {
    const prev = activeComputation;
    activeComputation = null;
    try {
      return fn();
    } finally {
      activeComputation = prev;
    }
  },

  batch(fn) {
    isBatching = true;
    try {
      fn();
    } finally {
      isBatching = false;
      const toFlush = [...pendingFlush];
      pendingFlush.clear();
      for (const comp of toFlush) {
        comp.fn();
      }
    }
  },
};

Blaze.setReactiveSystem(customSystem);
```

## Testing Your Reactive System

Verify your implementation works correctly:

```ts
import { describe, it, expect, vi } from 'vitest';

function testReactiveSystem(createSystem) {
  describe('ReactiveSystem contract', () => {
    it('autorun runs immediately', () => {
      const system = createSystem();
      const spy = vi.fn();
      system.autorun(spy);
      expect(spy).toHaveBeenCalledOnce();
    });

    it('autorun re-runs when dependency changes', () => {
      const system = createSystem();
      const v = system.createVar(1);
      const spy = vi.fn(() => v.get());
      system.autorun(spy);
      expect(spy).toHaveBeenCalledTimes(1);

      v.set(2);
      expect(spy).toHaveBeenCalledTimes(2);
    });

    it('stop prevents re-runs', () => {
      const system = createSystem();
      const v = system.createVar(1);
      const spy = vi.fn(() => v.get());
      const { stop } = system.autorun(spy);

      stop();
      v.set(2);
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('nonReactive does not track', () => {
      const system = createSystem();
      const v = system.createVar(1);
      const spy = vi.fn(() => {
        system.nonReactive(() => v.get());
      });
      system.autorun(spy);

      v.set(2);
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('batch defers updates', () => {
      const system = createSystem();
      if (!system.batch) return;

      const v1 = system.createVar(1);
      const v2 = system.createVar(1);
      const spy = vi.fn(() => {
        v1.get();
        v2.get();
      });
      system.autorun(spy);

      system.batch(() => {
        v1.set(2);
        v2.set(2);
      });
      // Should have re-run only once during the batch flush
      expect(spy).toHaveBeenCalledTimes(2); // 1 initial + 1 batch
    });
  });
}
```

## Choosing a Reactive System

| System               | Bundle Size     | Best For                         |
| -------------------- | --------------- | -------------------------------- |
| SimpleReactiveSystem | 0 KB (built-in) | Prototyping, small apps          |
| Meteor Tracker       | ~5 KB           | Existing Meteor apps             |
| @preact/signals-core | ~2 KB           | Minimal, fast signals            |
| SolidJS              | ~7 KB           | Fine-grained, complex reactivity |
| RxJS                 | ~30 KB          | Angular apps, stream processing  |
| Custom               | Varies          | Special requirements             |
