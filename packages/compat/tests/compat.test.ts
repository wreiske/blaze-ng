/**
 * Tests for @blaze-ng/compat backward-compatibility aliases.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UI, Handlebars, SafeString, _resetWarnings } from '../src/index';

// Mock console.warn to capture deprecation warnings
const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

describe('compat', () => {
  beforeEach(() => {
    warnSpy.mockClear();
    _resetWarnings();
  });

  describe('UI namespace', () => {
    it('has expected methods', () => {
      expect(typeof UI.render).toBe('function');
      expect(typeof UI.renderWithData).toBe('function');
      expect(typeof UI.remove).toBe('function');
      expect(typeof UI.toHTML).toBe('function');
      expect(typeof UI.getView).toBe('function');
      expect(typeof UI._templateInstance).toBe('function');
    });

    it('UI.Template accesses core Template with deprecation', () => {
      const T = UI.Template;
      expect(T).toBeDefined();
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('UI.Template'));
    });

    it('only warns once per API', () => {
      UI.Template;
      UI.Template;
      // Should only have 1 warning for UI.Template
      const templateWarnings = warnSpy.mock.calls.filter((c) =>
        String(c[0]).includes('UI.Template'),
      );
      expect(templateWarnings).toHaveLength(1);
    });
  });

  describe('Handlebars namespace', () => {
    it('has registerHelper', () => {
      expect(typeof Handlebars.registerHelper).toBe('function');
    });

    it('has _escape', () => {
      expect(typeof Handlebars._escape).toBe('function');
    });

    it('_escape works via Blaze._escape', () => {
      const result = Handlebars._escape('<div>');
      expect(result).toBe('&lt;div&gt;');
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Handlebars._escape'));
    });

    it('has SafeString', () => {
      expect(Handlebars.SafeString).toBe(SafeString);
    });
  });

  describe('SafeString', () => {
    it('wraps a string value', () => {
      const s = new SafeString('<b>bold</b>');
      expect(s.string).toBe('<b>bold</b>');
    });

    it('toString returns the wrapped string', () => {
      const s = new SafeString('<i>italic</i>');
      expect(s.toString()).toBe('<i>italic</i>');
      expect(`${s}`).toBe('<i>italic</i>');
    });
  });

  describe('_resetWarnings', () => {
    it('clears warning cache', () => {
      Handlebars._escape('x');
      expect(warnSpy).toHaveBeenCalledTimes(1);
      warnSpy.mockClear();

      // Without reset, no new warning
      Handlebars._escape('y');
      expect(warnSpy).not.toHaveBeenCalled();

      // After reset, warns again
      _resetWarnings();
      Handlebars._escape('z');
      expect(warnSpy).toHaveBeenCalledTimes(1);
    });
  });
});
