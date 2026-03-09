import { describe, it, expect } from 'vitest';
import {
  TemplatingTools,
  scanHtmlForTags,
  compileTagsWithSpacebars,
  CompileError,
} from '../src/index';

describe('templating-tools - html scanner', () => {
  /**
   * Helper: assert that a string contains a substring.
   */
  const testInString = (actual: string, wanted: string) => {
    expect(actual).toContain(wanted);
  };

  /**
   * Helper: assert that calling f throws a CompileError with the given
   * message substring and line number.
   */
  const checkError = (f: () => void, msgText: string, lineNum: number) => {
    try {
      f();
    } catch (e) {
      if (!(e instanceof CompileError)) {
        throw e;
      }
      expect(e.line).toBe(lineNum);
      testInString(e.message, msgText);
      return;
    }
    throw new Error("Parse error didn't throw exception");
  };

  /**
   * Returns the expected JS for simple body content.
   * content is a source string including quotes, e.g. '"Hello"'.
   */
  const simpleBody = (content: string) => {
    return (
      '\nTemplate.body.addContent((function() {\n  var view = this;\n  return ' +
      content +
      ';\n}));\nMeteor.startup(Template.body.renderToDocument);\n'
    );
  };

  /**
   * Returns expected JS for a simple template.
   * Both arguments are quoted strings like '"hello"'.
   */
  const simpleTemplate = (templateName: string, content: string) => {
    const viewName = templateName.slice(0, 1) + 'Template.' + templateName.slice(1);

    return (
      '\nTemplate.__checkName(' +
      templateName +
      ');\nTemplate[' +
      templateName +
      '] = new Template(' +
      viewName +
      ', (function() {\n  var view = this;\n  return ' +
      content +
      ';\n}));\n'
    );
  };

  const checkResults = (
    results: ReturnType<typeof compileTagsWithSpacebars>,
    expectJs?: string,
    expectHead?: string,
    expectBodyAttrs?: Record<string, string>,
  ) => {
    expect(results.body).toBe('');
    expect(results.js).toBe(expectJs || '');
    expect(results.head).toBe(expectHead || '');
    expect(results.bodyAttrs).toEqual(expectBodyAttrs || {});
  };

  function scanForTest(contents: string) {
    const tags = scanHtmlForTags({
      sourceName: '',
      contents,
      tagNames: ['body', 'head', 'template'],
    });

    return compileTagsWithSpacebars(tags);
  }

  it('should reject unexpected top-level content', () => {
    checkError(() => scanForTest('asdf'), 'Expected one of: <body>, <head>, <template>', 1);
  });

  it('body all on one line', () => {
    checkResults(scanForTest('<body>Hello</body>'), simpleBody('"Hello"'));
  });

  it('multi-line body, contents trimmed', () => {
    checkResults(scanForTest('\n\n\n<body>\n\nHello\n\n</body>\n\n\n'), simpleBody('"Hello"'));
  });

  it('body with HTML comments', () => {
    checkResults(
      scanForTest('\n<!--\n\nfoo\n-->\n<!-- -->\n' + '<body>\n\nHello\n\n</body>\n\n<!----\n>\n\n'),
      simpleBody('"Hello"'),
    );
  });

  it('head and body', () => {
    checkResults(
      scanForTest('<head>\n<title>Hello</title>\n</head>\n\n<body>World</body>\n\n'),
      simpleBody('"World"'),
      '<title>Hello</title>',
    );
  });

  it('head and body with tag whitespace', () => {
    checkResults(
      scanForTest('<head\n>\n<title>Hello</title>\n</head  >\n\n<body>World</body\n\n>\n\n'),
      simpleBody('"World"'),
      '<title>Hello</title>',
    );
  });

  it('head, body, and template', () => {
    checkResults(
      scanForTest(
        '<head>\n<title>Hello</title>\n</head>\n\n<body>World</body>\n\n' +
          '<template name="favoritefood">\n  pizza\n</template>\n',
      ),
      simpleBody('"World"') + simpleTemplate('"favoritefood"', '"pizza"'),
      '<title>Hello</title>',
    );
  });

  it('one-line template', () => {
    checkResults(
      scanForTest('<template name="favoritefood">pizza</template>'),
      simpleTemplate('"favoritefood"', '"pizza"'),
    );
  });

  it('template with other attributes', () => {
    checkResults(
      scanForTest('<template foo="bar" name="favoritefood" baz="qux">' + 'pizza</template>'),
      simpleTemplate('"favoritefood"', '"pizza"'),
    );
  });

  it('whitespace around = in attributes and at end of tag', () => {
    checkResults(
      scanForTest(
        '<template foo = "bar" name  ="favoritefood" baz= "qux"  >' + 'pizza</template\n\n>',
      ),
      simpleTemplate('"favoritefood"', '"pizza"'),
    );
  });

  it('whitespace around template name', () => {
    checkResults(
      scanForTest('<template name=" favoritefood  ">pizza</template>'),
      simpleTemplate('"favoritefood"', '"pizza"'),
    );
  });

  it('single quotes around template name', () => {
    checkResults(
      scanForTest('<template name=\'the "cool" template\'>' + 'pizza</template>'),
      simpleTemplate('"the \\"cool\\" template"', '"pizza"'),
    );
  });

  it('body with attributes', () => {
    checkResults(scanForTest('<body foo="bar">\n  Hello\n</body>'), simpleBody('"Hello"'), '', {
      foo: 'bar',
    });
  });

  // Error cases

  it('unclosed body', () => {
    checkError(() => scanForTest('\n\n<body>\n  Hello\n</body'), 'body', 3);
  });

  it('bad open tag', () => {
    checkError(
      () => scanForTest('\n\n\n<bodyd>\n  Hello\n</body>'),
      'Expected one of: <body>, <head>, <template>',
      4,
    );
    checkError(() => scanForTest('\n\n\n\n<body foo=>\n  Hello\n</body>'), 'error in tag', 5);
  });

  it('unclosed tag', () => {
    checkError(() => scanForTest('\n<body>Hello'), 'nclosed', 2);
  });

  it('unnamed template', () => {
    checkError(
      () => scanForTest('\n\n<template>Hi</template>\n\n<template>Hi</template>'),
      'name',
      3,
    );
  });

  it('helpful doctype message', () => {
    checkError(
      () =>
        scanForTest(
          '<!DOCTYPE HTML PUBLIC "-//W3C//DTD HTML 4.01//EN" ' +
            '"http://www.w3.org/TR/html4/strict.dtd">' +
            '\n\n<head>\n</head>',
        ),
      'DOCTYPE',
      1,
    );
  });

  it('lowercase basic doctype', () => {
    checkError(() => scanForTest('<!doctype html>'), 'DOCTYPE', 1);
  });

  it('attributes on head not supported', () => {
    checkError(() => scanForTest('<head foo="bar">\n  Hello\n</head>'), '<head>', 1);
  });

  it("can't mismatch quotes", () => {
    checkError(() => scanForTest('<template name="foo\'>' + 'pizza</template>'), 'error in tag', 1);
  });

  it('unexpected <html> at top level', () => {
    checkError(
      () => scanForTest('\n<html>\n</html>'),
      'Expected one of: <body>, <head>, <template>',
      2,
    );
  });
});

describe('templating-tools - namespace', () => {
  it('TemplatingTools namespace has all expected properties', () => {
    expect(typeof TemplatingTools.scanHtmlForTags).toBe('function');
    expect(typeof TemplatingTools.compileTagsWithSpacebars).toBe('function');
    expect(typeof TemplatingTools.generateTemplateJS).toBe('function');
    expect(typeof TemplatingTools.generateBodyJS).toBe('function');
    expect(typeof TemplatingTools.CompileError).toBe('function');
    expect(typeof TemplatingTools.throwCompileError).toBe('function');
  });
});
