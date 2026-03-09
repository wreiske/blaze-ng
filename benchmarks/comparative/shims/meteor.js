/**
 * Minimal Meteor global shim for running original Blaze packages outside Meteor.
 * Only provides what the spacebars-compiler compilation path actually uses.
 */
export const Meteor = {
  isServer: false,
  isClient: false,
};
