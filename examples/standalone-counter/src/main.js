/**
 * Blaze-NG Standalone Counter — no Meteor required.
 *
 * Demonstrates how to use Blaze-NG as a pure npm library with:
 * - Runtime template compilation (SpacebarsCompiler.compile)
 * - SimpleReactiveSystem for reactivity
 * - Template helpers, events, and lifecycle
 */
import {
  Template,
  View,
  Each,
  If,
  Unless,
  With,
  Let,
  _TemplateWith,
  _InOuterTemplateScope,
  render,
  setReactiveSystem,
  registerHelper,
} from '@blaze-ng/core';
import { SimpleReactiveSystem } from '@blaze-ng/core/testing';
import { compile } from '@blaze-ng/spacebars-compiler';
import { Spacebars } from '@blaze-ng/spacebars';
import { HTML as _HTML } from '@blaze-ng/htmljs';
import { __define__, getRegisteredTemplate } from '@blaze-ng/templating-runtime';

// Compiled Spacebars code calls HTML.Raw/CharRef/Comment without `new`,
// but in blaze-ng these are ES6 classes. Wrap them as callable functions.
const HTML = Object.create(_HTML);
HTML.Raw = (...args) => new _HTML.Raw(...args);
HTML.CharRef = (...args) => new _HTML.CharRef(...args);
HTML.Comment = (...args) => new _HTML.Comment(...args);

// Shim the Blaze namespace expected by compiled template code.
const Blaze = {
  View: (...args) => new View(...args),
  Each,
  If,
  Unless,
  With,
  Let,
  _TemplateWith,
  _InOuterTemplateScope,
};

// ─── 1. Set up reactivity ────────────────────────────────────────────────────

const reactive = new SimpleReactiveSystem();
setReactiveSystem(reactive);

// ─── 2. Compile and register the template ────────────────────────────────────

const counterTemplate = `
  <div class="counter">
    <h1>{{count}}</h1>
    <div class="buttons">
      <button class="decrement" disabled={{isZero}}>&minus;</button>
      <button class="reset">Reset</button>
      <button class="increment">+</button>
    </div>
    <p class="label">
      {{#if isZero}}
        Click + to start counting
      {{else}}
        Clicked {{count}} {{pluralize count "time" "times"}}
      {{/if}}
    </p>
  </div>
`;

// Compile the template string to a render function
const code = compile(counterTemplate, { isTemplate: true });
// eslint-disable-next-line no-new-func
const renderFunc = new Function('HTML', 'Spacebars', 'Blaze', `return ${code}`)(
  HTML,
  Spacebars,
  Blaze,
);

// Register the template
__define__('counter', renderFunc);
Template.counter = getRegisteredTemplate('counter');

// ─── 3. Define helpers ───────────────────────────────────────────────────────

Template.counter.onCreated(function () {
  this.count = reactive.ReactiveVar(0);
});

Template.counter.helpers({
  count() {
    return Template.instance().count.get();
  },
  isZero() {
    return Template.instance().count.get() === 0;
  },
});

// ─── 4. Define events ───────────────────────────────────────────────────────

Template.counter.events({
  'click .increment'(event, instance) {
    instance.count.set(instance.count.get() + 1);
    reactive.flush();
  },
  'click .decrement'(event, instance) {
    const current = instance.count.get();
    if (current > 0) instance.count.set(current - 1);
    reactive.flush();
  },
  'click .reset'(event, instance) {
    instance.count.set(0);
    reactive.flush();
  },
});

// ─── 5. Global helpers ──────────────────────────────────────────────────────

registerHelper('pluralize', (count, singular, plural) => (count === 1 ? singular : plural));

// ─── 6. Render to the DOM ───────────────────────────────────────────────────

const app = document.getElementById('app');
render(Template.counter, app);
reactive.flush();
