import { describe, it, expect } from 'vitest';
import { SpacebarsCompiler, TemplateTag, _beautify } from '../src/index';
import { toJS } from '@blaze-ng/blaze-tools';

// =========================================================================
// Stache tag parsing tests
// =========================================================================
describe('spacebars-compiler - stache tags', () => {
  /**
   * Strip `constructorName` from a TemplateTag (and nested TemplateTags) so
   * we can compare them with plain object expectations.
   */
  const stripCtor = (obj: unknown): unknown => {
    if (obj === null || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(stripCtor);
    const { constructorName: _, ...rest } = obj as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(rest)) {
      out[k] = stripCtor(v);
    }
    return out;
  };

  const run = (input: string, expected: Record<string, unknown> | string) => {
    if (typeof expected === 'string') {
      let msg = '';
      expect(() => {
        try {
          TemplateTag.parse(input);
        } catch (e) {
          msg = (e as Error).message;
          throw e;
        }
      }).toThrow();
      expect(msg.slice(0, expected.length)).toBe(expected);
    } else {
      const result = TemplateTag.parse(input);
      expect(stripCtor(result)).toEqual(expected);
    }
  };

  it('basic double/triple stache', () => {
    run('{{foo}}', { type: 'DOUBLE', path: ['foo'], args: [] });
    run('{{foo3}}', { type: 'DOUBLE', path: ['foo3'], args: [] });
    run('{{{foo}}}', { type: 'TRIPLE', path: ['foo'], args: [] });
    run('{{{foo}}', 'Expected `}}}`');
    run('{{{foo', 'Expected');
    run('{{foo', 'Expected');
  });

  it('unknown stache tags', () => {
    run('{{ {foo}}}', 'Unknown stache tag');
    run('{{{{foo}}}}', 'Unknown stache tag');
    run('{{{>foo}}}', 'Unknown stache tag');
    run('{{>>foo}}', 'Unknown stache tag');
  });

  it('comments', () => {
    run('{{! asdf }}', { type: 'COMMENT', value: ' asdf ' });
    run('{{ ! asdf }}', { type: 'COMMENT', value: ' asdf ' });
    run('{{ ! asdf }asdf', 'Unclosed');
  });

  it('block comments', () => {
    run('{{!-- asdf --}}', { type: 'BLOCKCOMMENT', value: ' asdf ' });
    run('{{ !-- asdf -- }}', { type: 'BLOCKCOMMENT', value: ' asdf ' });
    run('{{ !-- {{asdf}} -- }}', { type: 'BLOCKCOMMENT', value: ' {{asdf}} ' });
    run('{{ !-- {{as--df}} --}}', { type: 'BLOCKCOMMENT', value: ' {{as--df}} ' });
    run('{{ !-- asdf }asdf', 'Unclosed');
    run('{{ !-- asdf --}asdf', 'Unclosed');
  });

  it('else', () => {
    run('{{else}}', { type: 'ELSE' });
    run('{{ else }}', { type: 'ELSE' });
    run('{{ else}}', { type: 'ELSE' });
    run('{{ else x}}', { type: 'ELSE', path: ['x'], args: [] });
    run('{{else_x}}', { type: 'DOUBLE', path: ['else_x'], args: [] });
    run('{{ else else_x}}', { type: 'ELSE', path: ['else_x'], args: [] });
  });

  it('block close', () => {
    run('{{/if}}', { type: 'BLOCKCLOSE', path: ['if'] });
    run('{{ / if }}', { type: 'BLOCKCLOSE', path: ['if'] });
    run('{{/if x}}', 'Expected');
  });

  it('block open', () => {
    run('{{#if}}', { type: 'BLOCKOPEN', path: ['if'], args: [] });
    run('{{ # if }}', { type: 'BLOCKOPEN', path: ['if'], args: [] });
    run('{{#if_3}}', { type: 'BLOCKOPEN', path: ['if_3'], args: [] });
  });

  it('inclusion', () => {
    run('{{>x}}', { type: 'INCLUSION', path: ['x'], args: [] });
    run('{{ > x }}', { type: 'INCLUSION', path: ['x'], args: [] });
    run('{{>x_3}}', { type: 'INCLUSION', path: ['x_3'], args: [] });
  });

  it('number arguments', () => {
    run('{{foo 3}}', { type: 'DOUBLE', path: ['foo'], args: [['NUMBER', 3]] });
    run('{{ foo  3 }}', { type: 'DOUBLE', path: ['foo'], args: [['NUMBER', 3]] });
    run('{{#foo 3}}', { type: 'BLOCKOPEN', path: ['foo'], args: [['NUMBER', 3]] });
    run('{{ # foo  3 }}', { type: 'BLOCKOPEN', path: ['foo'], args: [['NUMBER', 3]] });
    run('{{>foo 3}}', { type: 'INCLUSION', path: ['foo'], args: [['NUMBER', 3]] });
    run('{{ > foo  3 }}', { type: 'INCLUSION', path: ['foo'], args: [['NUMBER', 3]] });
    run('{{{foo 3}}}', { type: 'TRIPLE', path: ['foo'], args: [['NUMBER', 3]] });
    run('{{else foo 3}}', { type: 'ELSE', path: ['foo'], args: [['NUMBER', 3]] });
  });

  it('path and keyword arguments', () => {
    run('{{foo bar ./foo foo/bar a.b.c baz=qux x3=.}}', {
      type: 'DOUBLE',
      path: ['foo'],
      args: [
        ['PATH', ['bar']],
        ['PATH', ['.', 'foo']],
        ['PATH', ['foo', 'bar']],
        ['PATH', ['a', 'b', 'c']],
        ['PATH', ['qux'], 'baz'],
        ['PATH', ['.'], 'x3'],
      ],
    });
  });

  it('nested expressions', () => {
    run('{{helper (subhelper ./arg) arg.sub (args.passedHelper)}}', {
      type: 'DOUBLE',
      path: ['helper'],
      args: [
        [
          'EXPR',
          {
            type: 'EXPR',
            path: ['subhelper'],
            args: [['PATH', ['.', 'arg']]],
          },
        ],
        ['PATH', ['arg', 'sub']],
        [
          'EXPR',
          {
            type: 'EXPR',
            path: ['args', 'passedHelper'],
            args: [],
          },
        ],
      ],
    });
    run('{{helper (h arg}}', 'Expected `)`');
    run('{{helper (h arg))}}', 'Expected');
    run('{{helper ) h arg}}', 'Expected');
    run('{{(dyn) arg}}', 'Expected ID');
  });

  it('numbers and bracket paths', () => {
    run('{{{x 0.3 [0].[3] .4 ./[4]}}}', {
      type: 'TRIPLE',
      path: ['x'],
      args: [
        ['NUMBER', 0.3],
        ['PATH', ['0', '3']],
        ['NUMBER', 0.4],
        ['PATH', ['.', '4']],
      ],
    });
  });

  it('this and null keywords', () => {
    run('{{# foo this this.x null z=null}}', {
      type: 'BLOCKOPEN',
      path: ['foo'],
      args: [
        ['PATH', ['.']],
        ['PATH', ['.', 'x']],
        ['NULL', null],
        ['NULL', null, 'z'],
      ],
    });
    run('{{else foo this this.x null z=null}}', {
      type: 'ELSE',
      path: ['foo'],
      args: [
        ['PATH', ['.']],
        ['PATH', ['.', 'x']],
        ['NULL', null],
        ['NULL', null, 'z'],
      ],
    });
  });

  it('relative paths', () => {
    run('{{./foo 3}}', { type: 'DOUBLE', path: ['.', 'foo'], args: [['NUMBER', 3]] });
    run('{{this/foo 3}}', { type: 'DOUBLE', path: ['.', 'foo'], args: [['NUMBER', 3]] });
    run('{{../foo 3}}', { type: 'DOUBLE', path: ['..', 'foo'], args: [['NUMBER', 3]] });
    run('{{../../foo 3}}', { type: 'DOUBLE', path: ['...', 'foo'], args: [['NUMBER', 3]] });
  });

  it('invalid path trailing segments', () => {
    run('{{foo x/..}}', 'Expected');
    run('{{foo x/.}}', 'Expected');
  });

  it('dotted paths in blocks/inclusions', () => {
    run('{{#a.b.c}}', { type: 'BLOCKOPEN', path: ['a', 'b', 'c'], args: [] });
    run('{{> a.b.c}}', { type: 'INCLUSION', path: ['a', 'b', 'c'], args: [] });
    run('{{else a.b.c}}', { type: 'ELSE', path: ['a', 'b', 'c'], args: [] });
  });

  it('bracket paths', () => {
    run('{{foo.[]/[]}}', { type: 'DOUBLE', path: ['foo', '', ''], args: [] });
    run('{{x foo.[=]}}', { type: 'DOUBLE', path: ['x'], args: [['PATH', ['foo', '=']]] });
    run('{{[].foo}}', "Path can't start with empty string");
  });

  it('literal arguments (null, boolean, string)', () => {
    run('{{foo null}}', { type: 'DOUBLE', path: ['foo'], args: [['NULL', null]] });
    run('{{foo false}}', { type: 'DOUBLE', path: ['foo'], args: [['BOOLEAN', false]] });
    run('{{foo true}}', { type: 'DOUBLE', path: ['foo'], args: [['BOOLEAN', true]] });
    run('{{foo "bar"}}', { type: 'DOUBLE', path: ['foo'], args: [['STRING', 'bar']] });
    run("{{foo 'bar'}}", { type: 'DOUBLE', path: ['foo'], args: [['STRING', 'bar']] });
  });

  it('negative numbers', () => {
    run('{{foo -1 -2}}', {
      type: 'DOUBLE',
      path: ['foo'],
      args: [
        ['NUMBER', -1],
        ['NUMBER', -2],
      ],
    });
  });

  it('quoted special chars', () => {
    run('{{x "\'"}}', { type: 'DOUBLE', path: ['x'], args: [['STRING', "'"]] });
    run("{{x '\"'}}", { type: 'DOUBLE', path: ['x'], args: [['STRING', '"']] });
  });

  it('keyword arguments', () => {
    run('{{> foo x=1 y=2}}', {
      type: 'INCLUSION',
      path: ['foo'],
      args: [
        ['NUMBER', 1, 'x'],
        ['NUMBER', 2, 'y'],
      ],
    });
    run('{{> foo x = 1 y = 2}}', {
      type: 'INCLUSION',
      path: ['foo'],
      args: [
        ['NUMBER', 1, 'x'],
        ['NUMBER', 2, 'y'],
      ],
    });
    run('{{> foo with-dashes=1 another-one=2}}', {
      type: 'INCLUSION',
      path: ['foo'],
      args: [
        ['NUMBER', 1, 'with-dashes'],
        ['NUMBER', 2, 'another-one'],
      ],
    });
    run('{{> foo 1="keyword can start with a number"}}', {
      type: 'INCLUSION',
      path: ['foo'],
      args: [['STRING', 'keyword can start with a number', '1']],
    });
  });

  it('invalid keyword characters', () => {
    run('{{> foo disallow-dashes-in-posarg}}', 'Expected');
    run('{{> foo disallow-#=1}}', 'Expected');
    run('{{> foo disallow->=1}}', 'Expected');
    run('{{> foo disallow-{=1}}', 'Expected');
    run('{{> foo disallow-(=1}}', 'Expected');
    run('{{> foo disallow-}=1}}', 'Expected');
    run('{{> foo disallow-)=1}}', 'Expected');
    run('{{> foo x=1 y=2 z}}', "Can't have a non-keyword argument");
  });

  it('reserved words in paths', () => {
    run('{{true.foo}}', "Can't use");
    run('{{foo.this}}', 'Can only use');
    run('{{./this}}', 'Can only use');
    run('{{../this}}', 'Can only use');
  });

  it('string equals sign', () => {
    run('{{foo "="}}', { type: 'DOUBLE', path: ['foo'], args: [['STRING', '=']] });
  });

  it('escape tags', () => {
    run('{{| asdf', { type: 'ESCAPE', value: '{{' });
    run('{{{| asdf', { type: 'ESCAPE', value: '{{{' });
    run('{{{{| asdf', { type: 'ESCAPE', value: '{{{{' });
  });
});

// =========================================================================
// Parse tests (full parse through to toJS)
// =========================================================================
describe('spacebars-compiler - parse', () => {
  it('basic double stache', () => {
    expect(toJS(SpacebarsCompiler.parse('{{foo}}'))).toBe(
      'SpacebarsCompiler.TemplateTag({type: "DOUBLE", path: ["foo"]})',
    );
  });

  it('comment returns null', () => {
    expect(toJS(SpacebarsCompiler.parse('{{!foo}}'))).toBe('null');
    expect(toJS(SpacebarsCompiler.parse('x{{!foo}}y'))).toBe('"xy"');
  });

  it('block comment returns null', () => {
    expect(toJS(SpacebarsCompiler.parse('{{!--foo--}}'))).toBe('null');
    expect(toJS(SpacebarsCompiler.parse('x{{!--foo--}}y'))).toBe('"xy"');
  });

  it('block tags', () => {
    expect(toJS(SpacebarsCompiler.parse('{{#foo}}x{{/foo}}'))).toBe(
      'SpacebarsCompiler.TemplateTag({type: "BLOCKOPEN", path: ["foo"], content: "x"})',
    );
  });

  it('nested block tags', () => {
    expect(toJS(SpacebarsCompiler.parse('{{#foo}}{{#bar}}{{/bar}}{{/foo}}'))).toBe(
      'SpacebarsCompiler.TemplateTag({type: "BLOCKOPEN", path: ["foo"], content: SpacebarsCompiler.TemplateTag({type: "BLOCKOPEN", path: ["bar"]})})',
    );
  });

  it('block with HTML', () => {
    expect(
      toJS(
        SpacebarsCompiler.parse(
          '<div>hello</div> {{#foo}}<div>{{#bar}}world{{/bar}}</div>{{/foo}}',
        ),
      ),
    ).toBe(
      '[HTML.DIV("hello"), " ", SpacebarsCompiler.TemplateTag({type: "BLOCKOPEN", path: ["foo"], content: HTML.DIV(SpacebarsCompiler.TemplateTag({type: "BLOCKOPEN", path: ["bar"], content: "world"}))})]',
    );
  });

  it('else content', () => {
    expect(toJS(SpacebarsCompiler.parse('{{#foo}}x{{else}}y{{/foo}}'))).toBe(
      'SpacebarsCompiler.TemplateTag({type: "BLOCKOPEN", path: ["foo"], content: "x", elseContent: "y"})',
    );
  });

  it('else with path (else if)', () => {
    expect(toJS(SpacebarsCompiler.parse('{{#foo}}x{{else bar}}y{{/foo}}'))).toBe(
      'SpacebarsCompiler.TemplateTag({type: "BLOCKOPEN", path: ["foo"], content: "x", elseContent: SpacebarsCompiler.TemplateTag({type: "BLOCKOPEN", path: ["bar"], content: "y"})})',
    );
  });

  it('chained else', () => {
    expect(toJS(SpacebarsCompiler.parse('{{#foo}}x{{else bar}}y{{else}}z{{/foo}}'))).toBe(
      'SpacebarsCompiler.TemplateTag({type: "BLOCKOPEN", path: ["foo"], content: "x", elseContent: SpacebarsCompiler.TemplateTag({type: "BLOCKOPEN", path: ["bar"], content: "y", elseContent: "z"})})',
    );
  });

  it('triple chained else', () => {
    expect(
      toJS(SpacebarsCompiler.parse('{{#foo}}x{{else bar}}y{{else baz}}q{{else}}z{{/foo}}')),
    ).toBe(
      'SpacebarsCompiler.TemplateTag({type: "BLOCKOPEN", path: ["foo"], content: "x", elseContent: SpacebarsCompiler.TemplateTag({type: "BLOCKOPEN", path: ["bar"], content: "y", elseContent: SpacebarsCompiler.TemplateTag({type: "BLOCKOPEN", path: ["baz"], content: "q", elseContent: "z"})})})',
    );
  });

  it('else with nested block', () => {
    expect(toJS(SpacebarsCompiler.parse('{{#foo}}x{{else bar}}{{#baz}}z{{/baz}}{{/foo}}'))).toBe(
      'SpacebarsCompiler.TemplateTag({type: "BLOCKOPEN", path: ["foo"], content: "x", elseContent: SpacebarsCompiler.TemplateTag({type: "BLOCKOPEN", path: ["bar"], content: SpacebarsCompiler.TemplateTag({type: "BLOCKOPEN", path: ["baz"], content: "z"})})})',
    );
  });

  it('throws on triple stache in start tag', () => {
    expect(() => SpacebarsCompiler.parse('<a {{{x}}}></a>')).toThrow();
  });

  it('throws on block in start tag', () => {
    expect(() => SpacebarsCompiler.parse('<a {{#if x}}{{/if}}></a>')).toThrow();
  });

  it('throws on stache in attribute name', () => {
    expect(() => SpacebarsCompiler.parse('<a {{k}}={[v}}></a>')).toThrow();
  });

  it('throws on partial stache in attribute name', () => {
    expect(() => SpacebarsCompiler.parse('<a x{{y}}></a>')).toThrow();
    expect(() => SpacebarsCompiler.parse('<a x{{y}}=z></a>')).toThrow();
  });

  it('throws on inclusion in start tag', () => {
    expect(() => SpacebarsCompiler.parse('<a {{> x}}></a>')).toThrow();
  });

  it('comments in attributes are stripped', () => {
    expect(toJS(SpacebarsCompiler.parse('<a {{! x--}} b=c{{! x}} {{! x}}></a>'))).toBe(
      'HTML.A({b: "c"})',
    );

    expect(
      toJS(SpacebarsCompiler.parse('<a {{!-- x--}} b=c{{ !-- x --}} {{!-- x -- }}></a>')),
    ).toBe('HTML.A({b: "c"})');
  });

  it('comment-only attribute values', () => {
    expect(toJS(SpacebarsCompiler.parse('<input selected={{!foo}}>'))).toBe(
      'HTML.INPUT({selected: ""})',
    );
    expect(toJS(SpacebarsCompiler.parse('<input selected={{!foo}}{{!bar}}>'))).toBe(
      'HTML.INPUT({selected: ""})',
    );
    expect(toJS(SpacebarsCompiler.parse('<input selected={{!--foo--}}>'))).toBe(
      'HTML.INPUT({selected: ""})',
    );
    expect(toJS(SpacebarsCompiler.parse('<input selected={{!--foo--}}{{!--bar--}}>'))).toBe(
      'HTML.INPUT({selected: ""})',
    );
  });
});

// =========================================================================
// Compiler output tests
// =========================================================================
describe('spacebars-compiler - compiler output', () => {
  const run = (input: string, expected: string | { fail: string }, whitespace = '') => {
    if (typeof expected === 'object' && 'fail' in expected) {
      const expectedMessage = expected.fail;
      let msg = '';
      expect(() => {
        try {
          SpacebarsCompiler.compile(input, {
            isTemplate: true,
            whitespace: whitespace || undefined,
          });
        } catch (e) {
          msg = (e as Error).message;
          throw e;
        }
      }).toThrow();
      expect(msg.slice(0, expectedMessage.length)).toBe(expectedMessage);
    } else {
      const output = SpacebarsCompiler.compile(input, {
        isTemplate: true,
        whitespace: whitespace || undefined,
      });
      const postProcess = (s: string) => {
        // remove initial and trailing parens
        let str = s.replace(/^\(([\S\s]*)\)$/, '$1');
        // Remove single-line comments
        str = str.replace(/\/\/.*$/gm, '');
        // kill whitespace
        str = str.replace(/\s+/g, '');
        return str;
      };
      expect(postProcess(output)).toBe(postProcess(_beautify('(' + expected + ')')));
    }
  };

  it('plain text', () => {
    run(
      'abc',
      `function () {
  var view = this;
  return "abc";
}`,
    );
  });

  it('double stache', () => {
    run(
      '{{foo}}',
      `function() {
  var view = this;
  return Blaze.View("lookup:foo", function() {
    return Spacebars.mustache(view.lookup("foo"));
  });
}`,
    );
  });

  it('double stache with arg', () => {
    run(
      '{{foo bar}}',
      `function() {
  var view = this;
  return Blaze.View("lookup:foo", function() {
    return Spacebars.mustache(view.lookup("foo"),
                              view.lookup("bar"));
  });
}`,
    );
  });

  it('double stache with keyword', () => {
    run(
      '{{foo x=bar}}',
      `function() {
  var view = this;
  return Blaze.View("lookup:foo", function() {
    return Spacebars.mustache(view.lookup("foo"), Spacebars.kw({
      x: view.lookup("bar")
    }));
  });
}`,
    );
  });

  it('dotted path with arg', () => {
    run(
      '{{foo.bar baz}}',
      `function() {
  var view = this;
  return Blaze.View("lookup:foo.bar", function() {
    return Spacebars.mustache(Spacebars.dot(
             view.lookup("foo"), "bar"),
             view.lookup("baz"));
  });
}`,
    );
  });

  it('sub expression', () => {
    run(
      '{{foo.bar (baz qux)}}',
      `function() {
  var view = this;
  return Blaze.View("lookup:foo.bar", function() {
    return Spacebars.mustache(Spacebars.dot(
             view.lookup("foo"), "bar"),
             Spacebars.dataMustache(view.lookup("baz"), view.lookup("qux")));
  });
}`,
    );
  });

  it('dotted arg', () => {
    run(
      '{{foo bar.baz}}',
      `function() {
  var view = this;
  return Blaze.View("lookup:foo", function() {
    return Spacebars.mustache(view.lookup("foo"),
           Spacebars.dot(view.lookup("bar"), "baz"));
  });
}`,
    );
  });

  it('keyword dotted arg', () => {
    run(
      '{{foo x=bar.baz}}',
      `function() {
  var view = this;
  return Blaze.View("lookup:foo", function() {
    return Spacebars.mustache(view.lookup("foo"), Spacebars.kw({
      x: Spacebars.dot(view.lookup("bar"), "baz")
    }));
  });
}`,
    );
  });

  it('block tag', () => {
    run(
      '{{#foo}}abc{{/foo}}',
      `function() {
  var view = this;
  return Spacebars.include(view.lookupTemplate("foo"), (function() {
    return "abc";
  }));
}`,
    );
  });

  it('if/else', () => {
    run(
      '{{#if cond}}aaa{{else}}bbb{{/if}}',
      `function() {
  var view = this;
  return Blaze.If(function () {
    return Spacebars.call(view.lookup("cond"));
  }, (function() {
    return "aaa";
  }), (function() {
    return "bbb";
  }));
}`,
    );
  });

  it('comments stripped from if/else', () => {
    run(
      '{{!-- --}}{{#if cond}}aaa{{!\n}}{{else}}{{!}}bbb{{!-- --}}{{/if}}{{!}}',
      `function() {
  var view = this;
  return Blaze.If(function () {
    return Spacebars.call(view.lookup("cond"));
  }, (function() {
    return "aaa";
  }), (function() {
    return "bbb";
  }));
}`,
    );
  });

  it('if/else with HTML and Raw', () => {
    run(
      '{{!-- --}}{{#if cond}}<p>aaa</p><p>ppp</p>{{!\n}}{{else}}{{!}}<p>{{bbb}}</p>{{!-- --}}{{/if}}{{!}}',
      `function() {
  var view = this;
  return Blaze.If(function () {
    return Spacebars.call(view.lookup("cond"));
  }, (function() {
    return HTML.Raw("<p>aaa</p><p>ppp</p>");
  }), (function() {
    return HTML.P(Blaze.View("lookup:bbb", function() {
      return Spacebars.mustache(view.lookup("bbb"));
    }));
  }));
}`,
    );
  });

  it('inclusion with data', () => {
    run(
      '{{> foo bar}}',
      `function() {
  var view = this;
  return Blaze._TemplateWith(function() {
    return Spacebars.call(view.lookup("bar"));
  }, function() {
    return Spacebars.include(view.lookupTemplate("foo"));
  });
}`,
    );
  });

  it('inclusion with keyword data', () => {
    run(
      '{{> foo x=bar}}',
      `function() {
  var view = this;
  return Blaze._TemplateWith(function() {
    return {
      x: Spacebars.call(view.lookup("bar"))
    };
  }, function() {
    return Spacebars.include(view.lookupTemplate("foo"));
  });
}
`,
    );
  });

  it('inclusion with dotted data', () => {
    run(
      '{{> foo bar.baz}}',
      `function() {
  var view = this;
  return Blaze._TemplateWith(function() {
    return Spacebars.call(Spacebars.dot(view.lookup("bar"), "baz"));
  }, function() {
    return Spacebars.include(view.lookupTemplate("foo"));
  });
}`,
    );
  });

  it('inclusion with keyword dotted data', () => {
    run(
      '{{> foo x=bar.baz}}',
      `function() {
  var view = this;
  return Blaze._TemplateWith(function() {
    return {
      x: Spacebars.call(Spacebars.dot(view.lookup("bar"), "baz"))
    };
  }, function() {
    return Spacebars.include(view.lookupTemplate("foo"));
  });
}`,
    );
  });

  it('inclusion with multiple args', () => {
    run(
      '{{> foo bar baz}}',
      `function() {
  var view = this;
  return Blaze._TemplateWith(function() {
    return Spacebars.dataMustache(view.lookup("bar"), view.lookup("baz"));
  }, function() {
    return Spacebars.include(view.lookupTemplate("foo"));
  });
}
`,
    );
  });

  it('block with data args', () => {
    run(
      '{{#foo bar baz}}aaa{{/foo}}',
      `function() {
  var view = this;
  return Blaze._TemplateWith(function() {
    return Spacebars.dataMustache(view.lookup("bar"), view.lookup("baz"));
  }, function() {
    return Spacebars.include(view.lookupTemplate("foo"), (function() {
      return "aaa";
    }));
  });
}`,
    );
  });

  it('block with dotted data args', () => {
    run(
      '{{#foo p.q r.s}}aaa{{/foo}}',
      `function() {
  var view = this;
  return Blaze._TemplateWith(function() {
    return Spacebars.dataMustache(Spacebars.dot(view.lookup("p"), "q"), Spacebars.dot(view.lookup("r"), "s"));
  }, function() {
    return Spacebars.include(view.lookupTemplate("foo"), (function() {
      return "aaa";
    }));
  });
}`,
    );
  });

  it('dynamic attributes', () => {
    run(
      '<a {{b}}></a>',
      `function() {
  var view = this;
  return HTML.A(HTML.Attrs(function() {
    return Spacebars.attrMustache(view.lookup("b"));
  }));
}`,
    );
  });

  it('dynamic and static attributes', () => {
    run(
      '<a {{b}} c=d{{e}}f></a>',
      `function() {
  var view = this;
  return HTML.A(HTML.Attrs({
    c: (function() { return [
      "d",
      Spacebars.mustache(view.lookup("e")),
      "f" ]; })
  }, function() {
    return Spacebars.attrMustache(view.lookup("b"));
  }));
}`,
    );
  });

  it('unknown HTML tag', () => {
    run(
      '<asdf>{{foo}}</asdf>',
      `function() {
  var view = this;
  return HTML.getTag("asdf")(Blaze.View("lookup:foo", function() {
    return Spacebars.mustache(view.lookup("foo"));
  }));
}`,
    );
  });

  it('textarea', () => {
    run(
      '<textarea>{{foo}}</textarea>',
      `function() {
  var view = this;
  return HTML.TEXTAREA({value: (function () {
    return Spacebars.mustache(view.lookup("foo"));
  }) });
}`,
    );
  });

  it('textarea with escape', () => {
    run(
      '<textarea>{{{{|{{|foo}}</textarea>',
      `function() {
  var view = this;
  return HTML.TEXTAREA({value: (function () {
    return [ "{{{{", "{{", "foo}}" ];
  }) });
}`,
    );
  });

  it('escape tag', () => {
    run(
      '{{|foo}}',
      `function() {
  var view = this;
  return [ "{{", "foo}}" ];
}`,
    );
  });

  it('attribute with escape', () => {
    run(
      '<a b={{{|></a>',
      `function() {
  var view = this;
  return HTML.A({
    b: (function () {
      return "{{{";
    })
  });
}`,
    );
  });

  it('mixed static and dynamic children', () => {
    run(
      '<div><div>{{helper}}<div>a</div><div>b</div></div></div>',
      `function() {
  var view = this;
  return HTML.DIV(HTML.DIV(Blaze.View("lookup:helper",function(){
      return Spacebars.mustache(view.lookup("helper"));
  }), HTML.Raw("<div>a</div><div>b</div>")));
}`,
    );
  });

  it('table with colgroup', () => {
    run(
      '<table><colgroup><col></colgroup><tr><td>aaa</td><td>bbb</td></tr></table>',
      `function() {
  var view = this;
  return HTML.TABLE(
    HTML.Raw("<colgroup><col></colgroup>"),
    HTML.TR(HTML.Raw("<td>aaa</td><td>bbb</td>"))
  );
}`,
    );
  });

  it('whitespace in div', () => {
    run(
      `<div>
    {{helper}}
</div>`,
      `function() {
  var view = this;
  return HTML.DIV(
    "\\n    ",
    Blaze.View("lookup:helper",function(){
      return Spacebars.mustache(view.lookup("helper"));
    }),
    "\\n"
  );
}`,
    );
  });

  it('whitespace strip mode', () => {
    run(
      `<div>
    {{helper}}
</div>`,
      `function() {
  var view = this;
  return HTML.DIV(
    Blaze.View("lookup:helper",function(){
      return Spacebars.mustache(view.lookup("helper"));
    })
  );
}`,
      'strip',
    );
  });

  it('whitespace strip with spans', () => {
    run(
      `<div>
    {{helper}}
    <span>Test</span> <span>Spaces</span>
</div>`,
      `function() {
  var view = this;
  return HTML.DIV(
    Blaze.View("lookup:helper",function(){
      return Spacebars.mustache(view.lookup("helper"));
    }),
    HTML.Raw("<span>Test</span> <span>Spaces</span>")
  );
}`,
      'strip',
    );
  });
});

// =========================================================================
// Compiler error tests
// =========================================================================
describe('spacebars-compiler - compiler errors', () => {
  const getError = (input: string): string => {
    try {
      SpacebarsCompiler.compile(input);
    } catch (e) {
      return (e as Error).message;
    }
    throw new Error("Didn't throw an error: " + input);
  };

  const isError = (input: string, errorStart: string) => {
    const msg = getError(input);
    expect(msg.substring(0, errorStart.length)).toBe(errorStart);
  };

  it('void element close tag', () => {
    isError('<input></input>', 'Unexpected HTML close tag.  <input> should have no close tag.');
    isError(
      '{{#each foo}}<input></input>{{/foo}}',
      'Unexpected HTML close tag.  <input> should have no close tag.',
    );
  });

  it('built-in block helpers require arguments', () => {
    isError('{{#if}}{{/if}}', '#if requires an argument');
    isError('{{#with}}{{/with}}', '#with requires an argument');
    isError('{{#each}}{{/each}}', '#each requires an argument');
    isError('{{#unless}}{{/unless}}', '#unless requires an argument');
  });

  it('non-identifier path start', () => {
    isError('{{0 0}}', 'Expected IDENTIFIER');
  });

  it('first argument must be function', () => {
    isError('{{> foo 0 0}}', 'First argument must be a function');
    isError('{{> foo 0 x=0}}', 'First argument must be a function');
    isError('{{#foo 0 0}}{{/foo}}', 'First argument must be a function');
    isError('{{#foo 0 x=0}}{{/foo}}', 'First argument must be a function');
  });

  it('unexpected close tags', () => {
    [
      'asdf</br>',
      '{{!foo}}</br>',
      '{{!foo}} </br>',
      'asdf</a>',
      '{{!foo}}</a>',
      '{{!foo}} </a>',
    ].forEach((badFrag) => {
      isError(badFrag, 'Unexpected HTML close tag');
    });
  });

  it('#let errors', () => {
    isError('{{#let myHelper}}{{/let}}', 'Incorrect form of #let');
  });

  it('#each-in errors', () => {
    isError('{{#each foo in.in bar}}{{/each}}', 'Malformed #each');
    isError('{{#each foo.bar in baz}}{{/each}}', 'Bad variable name in #each');
    isError('{{#each ../foo in baz}}{{/each}}', 'Bad variable name in #each');
    isError('{{#each 3 in baz}}{{/each}}', 'Bad variable name in #each');
  });

  it('unexpected else after else', () => {
    isError(
      '{{#foo}}x{{else bar}}y{{else}}z{{else baz}}q{{/foo}}',
      'Unexpected else after {{else}}',
    );
    isError('{{#foo}}x{{else bar}}y{{else}}z{{else}}q{{/foo}}', 'Unexpected else after {{else}}');
  });

  it('React component errors', () => {
    isError(
      '{{> React component=emptyComponent}}',
      '{{> React}} must be used in a container element',
    );
    isError(
      '<div>{{#if include}}{{> React component=emptyComponent}}{{/if}}</div>',
      '{{> React}} must be used in a container element',
    );
    isError(
      '<div><div>Sibling</div>{{> React component=emptyComponent}}</div>',
      '{{> React}} must be used as the only child in a container element',
    );
    isError(
      '<div>Sibling{{> React component=emptyComponent}}</div>',
      '{{> React}} must be used as the only child in a container element',
    );
    isError(
      '<div>{{#if sibling}}Sibling{{/if}}{{> React component=emptyComponent}}</div>',
      '{{> React}} must be used as the only child in a container element',
    );
  });
});
