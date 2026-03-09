/**
 * Template compiler utility.
 *
 * Compiles Spacebars template strings into render functions
 * and registers them in the Blaze-NG template registry.
 */
import { compile } from '@blaze-ng/spacebars-compiler';
import { Spacebars } from '@blaze-ng/spacebars';
import { HTML as _HTML } from '@blaze-ng/htmljs';
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
} from '@blaze-ng/core';
import { __define__, getRegisteredTemplate } from '@blaze-ng/templating-runtime';

// Compiled Spacebars code calls HTML.Raw/CharRef/Comment without `new`,
// but in blaze-ng these are ES6 classes. Wrap them as callable functions.
const HTML = Object.create(_HTML);
HTML.Raw = (...args) => new _HTML.Raw(...args);
HTML.CharRef = (...args) => new _HTML.CharRef(...args);
HTML.Comment = (...args) => new _HTML.Comment(...args);

// Shim the Blaze namespace expected by compiled template code.
// Compiled Spacebars calls constructors without `new`, so we wrap them.
function callableView(...args) {
  return new View(...args);
}

const Blaze = {
  View: callableView,
  Each,
  If,
  Unless,
  With,
  Let,
  _TemplateWith,
  _InOuterTemplateScope,
};

/**
 * Compile a Spacebars template string and register it.
 *
 * Also assigns the template to Template[name] so it can be accessed
 * as Template.homePage, Template.todosPage, etc.
 *
 * @param {string} name - Template name.
 * @param {string} source - Spacebars template source.
 */
export function defineTemplate(name, source) {
  const code = compile(source, { isTemplate: true });
  // eslint-disable-next-line no-new-func
  const renderFunc = new Function('HTML', 'Spacebars', 'Blaze', `return ${code}`)(
    HTML,
    Spacebars,
    Blaze,
  );
  __define__(name, renderFunc);
  // Make accessible via Template[name] (e.g. Template.homePage)
  Template[name] = getRegisteredTemplate(name);
}
