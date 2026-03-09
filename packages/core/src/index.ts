/**
 * @blaze-ng/core — the Blaze view engine, rewritten in TypeScript.
 *
 * This is the main entry point. It wires up all modules (breaking circular
 * deps via setter functions) and re-exports the public API.
 */

// ─── Import modules in dependency order ────────────────────────────────────
// Some modules register themselves via setter functions on import.
// Import order matters: view → materializer → attrs → events → template → lookup → builtins

// Types
export type { Computation, ReactiveVar, Binding, Dependency, ReactiveSystem } from './types';

// Preamble utilities
export { _escape, _warn, _bind } from './preamble';

// Exception handling
export {
  _throwNextException,
  setThrowNextException,
  _reportException,
  _reportExceptionAndThrow,
  _wrapCatchingExceptions,
} from './exceptions';

// DOM backend
export { DOMBackend } from './dombackend';

// DOMRange
export { DOMRange, _elementContains } from './domrange';

// View (core)
export {
  View,
  currentView,
  setReactiveSystem,
  _getReactiveSystem,
  _withCurrentView,
  _fireCallbacks,
  _createView,
  _materializeView,
  _expandView,
  _expand,
  _expandAttributes,
  _destroyView,
  _destroyNode,
  _isContentEqual,
  render,
  renderWithData,
  remove,
  toHTML,
  toHTMLWithData,
  _toText,
  getData,
  getView,
  _addEventMap,
  _parentData,
  __rootViews,
} from './view';

// Materializer — registers _materializeDOMFn on import
export { _materializeDOM } from './materializer';

// Attribute handlers
export {
  AttributeHandler,
  DiffingAttributeHandler,
  ElementAttributesUpdater,
  _makeAttributeHandler,
  _allowJavascriptUrls,
  _javascriptUrlsAllowed,
} from './attrs';

// Wire up ElementAttributesUpdater with materializer
import { _setElementAttributesUpdater } from './materializer';
import { ElementAttributesUpdater } from './attrs';
_setElementAttributesUpdater(ElementAttributesUpdater);

// Events — registers _eventSupportListenFn on import
export { EventSupport, HandlerRec, listen, EVENT_MODE } from './events';

// Template — registers Template class with view on import
export { Template, TemplateInstance, isTemplate } from './template';

// Lookup — patches View.prototype.lookup on import
export {
  _globalHelpers,
  registerHelper,
  deregisterHelper,
  _getTemplateHelper,
  _lexicalBindingLookup,
  _getTemplate,
  _getGlobalHelper,
  _OLDSTYLE_HELPER,
} from './lookup';

// Builtins — registers _TemplateWith and _Await on import
export {
  _calculateCondition,
  _attachBindingsToView,
  With,
  Let,
  If,
  Unless,
  Each,
  _Await,
  _TemplateWith,
  _InOuterTemplateScope,
} from './builtins';

// Wire up DOMRange destroy functions with view module
import { DOMRange } from './domrange';
import { _destroyView, _destroyNode } from './view';
DOMRange._setDestroyFunctions(
  // eslint-disable-next-line @typescript-eslint/consistent-type-imports
  (view) => _destroyView(view as import('./view').View),
  _destroyNode,
);

// Wire up materializer's Template class reference
import { _setMaterializerTemplateClass } from './materializer';
import { Template as Tmpl } from './template';
_setMaterializerTemplateClass(
  Tmpl as unknown as Parameters<typeof _setMaterializerTemplateClass>[0],
);
