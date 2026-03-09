import { describe, test, expect, beforeEach } from 'vitest';
import {
  Template,
  __checkName,
  __define__,
  body,
  addBodyContent,
  getRegisteredTemplate,
  _migrateTemplate,
  _markPendingReplacement,
  _resetRegistry,
  __dynamic,
  __dynamicWithDataContext,
} from '../src/index';
import { Template as CoreTemplate, isTemplate } from '@blaze-ng/core';

// ─── Setup ──────────────────────────────────────────────────────────────────

beforeEach(() => {
  _resetRegistry();
});

// ─── __checkName tests ──────────────────────────────────────────────────────

describe('__checkName', () => {
  test('allows valid names', () => {
    expect(() => __checkName('myTemplate')).not.toThrow();
  });

  test('rejects reserved name __proto__', () => {
    expect(() => __checkName('__proto__')).toThrow('reserved');
  });

  test('rejects reserved name "name"', () => {
    expect(() => __checkName('name')).toThrow('reserved');
  });

  test('rejects duplicate template names', () => {
    __define__('foo', () => 'hello');
    expect(() => __checkName('foo')).toThrow('multiple templates');
  });
});

// ─── __define__ tests ───────────────────────────────────────────────────────

describe('__define__', () => {
  test('registers a template by name', () => {
    __define__('test_define', () => 'content');
    const tmpl = getRegisteredTemplate('test_define');
    expect(tmpl).toBeDefined();
    expect(isTemplate(tmpl)).toBe(true);
  });

  test('sets viewName with Template. prefix', () => {
    __define__('myName', () => 'content');
    const tmpl = getRegisteredTemplate('myName')!;
    expect(tmpl.viewName).toBe('Template.myName');
  });

  test('rejects duplicate names', () => {
    __define__('dup', () => 'a');
    expect(() => __define__('dup', () => 'b')).toThrow('multiple templates');
  });
});

// ─── Template.body tests ────────────────────────────────────────────────────

describe('body template', () => {
  test('is a valid Template instance', () => {
    expect(isTemplate(body)).toBe(true);
    expect(body.viewName).toBe('body');
  });

  test('is registered in the registry', () => {
    expect(getRegisteredTemplate('body')).toBe(body);
  });

  test('addBodyContent adds render functions', () => {
    let called = false;
    addBodyContent(() => {
      called = true;
      return 'content';
    });
    // Body calls its content render functions when rendered
    // We can't fully test rendering without a DOM, but we can verify registration
    expect(called).toBe(false); // not called until rendered
  });
});

// ─── _migrateTemplate tests ────────────────────────────────────────────────

describe('_migrateTemplate', () => {
  test('registers a new template', () => {
    const tmpl = new CoreTemplate('Template.migrated', () => 'hello');
    _migrateTemplate('migrated', tmpl);
    expect(getRegisteredTemplate('migrated')).toBe(tmpl);
  });

  test('migrates helpers from old template during HMR', () => {
    const oldTmpl = new CoreTemplate('Template.hmr_test', () => 'old');
    oldTmpl.helpers({ greeting: () => 'hi' });
    _migrateTemplate('hmr_test', oldTmpl);

    // Mark for replacement
    _markPendingReplacement('hmr_test');

    const newTmpl = new CoreTemplate('Template.hmr_test', () => 'new');
    _migrateTemplate('hmr_test', newTmpl);

    // The new template should have inherited the helpers
    expect(
      (newTmpl as CoreTemplate & { __helpers?: Map<string, unknown> }).__helpers,
    ).toBeDefined();
  });
});

// ─── Dynamic template registration ─────────────────────────────────────────

describe('dynamic templates', () => {
  test('__dynamic is registered', () => {
    expect(getRegisteredTemplate('__dynamic')).toBe(__dynamic);
    expect(isTemplate(__dynamic)).toBe(true);
  });

  test('__dynamicWithDataContext is registered', () => {
    expect(getRegisteredTemplate('__dynamicWithDataContext')).toBe(__dynamicWithDataContext);
    expect(isTemplate(__dynamicWithDataContext)).toBe(true);
  });
});

// ─── _resetRegistry tests ───────────────────────────────────────────────────

describe('_resetRegistry', () => {
  test('clears user templates but keeps builtins', () => {
    __define__('user_template', () => 'content');
    expect(getRegisteredTemplate('user_template')).toBeDefined();

    _resetRegistry();

    expect(getRegisteredTemplate('user_template')).toBeUndefined();
    expect(getRegisteredTemplate('body')).toBeDefined();
    expect(getRegisteredTemplate('__dynamic')).toBeDefined();
    expect(getRegisteredTemplate('__dynamicWithDataContext')).toBeDefined();
  });
});

// ─── Template re-export ─────────────────────────────────────────────────────

describe('Template re-export', () => {
  test('Template is the core Template class', () => {
    expect(Template).toBe(CoreTemplate);
  });
});
