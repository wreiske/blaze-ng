/**
 * @blaze-ng/core/testing — test utilities for the Blaze view engine.
 *
 * This entry point exports the SimpleReactiveSystem which provides
 * a minimal in-memory reactive system for unit testing without
 * depending on Meteor Tracker. Not intended for production use.
 *
 * @example
 * ```ts
 * import { SimpleReactiveSystem } from '@blaze-ng/core/testing';
 * import { setReactiveSystem } from '@blaze-ng/core';
 * setReactiveSystem(new SimpleReactiveSystem());
 * ```
 */
export { SimpleReactiveSystem } from './reactivity';
