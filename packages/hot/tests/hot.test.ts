/**
 * Tests for @blaze-ng/hot HMR support.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  getTemplateModule,
  setTemplateModule,
  trackRenderedView,
  untrackRenderedView,
  _resetHmrState,
} from '../src/index';
import { View } from '@blaze-ng/core';
import { __define__, _resetRegistry } from '@blaze-ng/templating-runtime';

describe('hot', () => {
  beforeEach(() => {
    _resetHmrState();
    _resetRegistry();
  });

  describe('template module tracking', () => {
    it('setTemplateModule associates a module ID', () => {
      setTemplateModule('myTemplate', '/imports/ui/my-template.js');
      expect(getTemplateModule('myTemplate')).toBe('/imports/ui/my-template.js');
    });

    it('getTemplateModule returns undefined for unknown templates', () => {
      expect(getTemplateModule('unknown')).toBeUndefined();
    });

    it('overwrites previous module association', () => {
      setTemplateModule('myTemplate', '/old-module.js');
      setTemplateModule('myTemplate', '/new-module.js');
      expect(getTemplateModule('myTemplate')).toBe('/new-module.js');
    });
  });

  describe('rendered view tracking', () => {
    it('trackRenderedView and untrackRenderedView', () => {
      const view = new View('test', () => 'content');
      trackRenderedView('testTmpl', view);

      // Untrack should not throw
      untrackRenderedView('testTmpl', view);
    });

    it('untrackRenderedView is safe for unknown templates', () => {
      const view = new View('test', () => 'content');
      // Should not throw
      untrackRenderedView('nonexistent', view);
    });

    it('untrackRenderedView is safe for unknown views', () => {
      const view1 = new View('test', () => 'content');
      const view2 = new View('test2', () => 'content');
      trackRenderedView('tmpl', view1);
      // Untracking a different view should not throw
      untrackRenderedView('tmpl', view2);
    });
  });

  describe('_resetHmrState', () => {
    it('clears all tracking state', () => {
      setTemplateModule('a', 'mod-a');
      const view = new View('test', () => 'content');
      trackRenderedView('a', view);

      _resetHmrState();

      expect(getTemplateModule('a')).toBeUndefined();
    });
  });
});
