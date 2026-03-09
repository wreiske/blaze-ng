/**
 * Compilation benchmarks — measures Spacebars template → JS code generation.
 *
 * Tests compilation speed at various template complexities:
 * - Simple interpolation
 * - Nested conditionals and loops
 * - Large templates with many helpers
 */
import { bench, describe } from 'vitest';
import { compile } from '@blaze-ng/spacebars-compiler';

// ─── Template sources at varying complexity ──────────────────────────────────

const SIMPLE = '<div>{{name}}</div>';

const MEDIUM = `
<div class="card {{cardClass}}">
  <h2>{{title}}</h2>
  {{#if showBody}}
    <div class="body">
      {{#each items}}
        <p class="{{itemClass this}}">{{label}} - {{value}}</p>
      {{/each}}
    </div>
  {{else}}
    <p>No content</p>
  {{/if}}
  <footer>{{formatDate createdAt}}</footer>
</div>`;

const COMPLEX = `
<div class="dashboard">
  <header>
    <h1>{{title}}</h1>
    {{#if isAdmin}}<span class="badge">Admin</span>{{/if}}
  </header>
  <nav>
    {{#each navItems}}
      <a href="{{url}}" class="{{#if active}}active{{/if}} nav-link">
        {{icon}} {{label}}
      </a>
    {{/each}}
  </nav>
  <main>
    {{#with currentSection}}
      <section id="{{sectionId}}">
        <h2>{{sectionTitle}}</h2>
        {{#each rows}}
          <div class="row {{rowClass}}" data-id="{{_id}}">
            <span class="name">{{name}}</span>
            <span class="value">{{formatNumber value}}</span>
            {{#if showActions}}
              <div class="actions">
                <button class="edit">Edit</button>
                <button class="delete">Delete</button>
              </div>
            {{/if}}
            {{#unless hidden}}
              <div class="details">
                {{#each tags}}
                  <span class="tag">{{this}}</span>
                {{/each}}
              </div>
            {{/unless}}
          </div>
        {{else}}
          <p class="empty">No rows found.</p>
        {{/each}}
      </section>
    {{/with}}
  </main>
  <footer>
    {{copyrightYear}} &mdash; {{appName}}
  </footer>
</div>`;

// Generate a large template with repeated rows
function generateLargeTemplate(rowCount: number): string {
  const rows = [];
  for (let i = 0; i < rowCount; i++) {
    rows.push(`<tr><td>{{name_${i}}}</td><td>{{value_${i}}}</td><td>{{status_${i}}}</td></tr>`);
  }
  return `<table><thead><tr><th>Name</th><th>Value</th><th>Status</th></tr></thead><tbody>${rows.join('\n')}</tbody></table>`;
}

const LARGE_50 = generateLargeTemplate(50);
const LARGE_200 = generateLargeTemplate(200);

// ─── Benchmarks ──────────────────────────────────────────────────────────────

describe('compilation — template to JS', () => {
  bench('simple template (1 interpolation)', () => {
    compile(SIMPLE, { isTemplate: true });
  });

  bench('medium template (if/each/helpers)', () => {
    compile(MEDIUM, { isTemplate: true });
  });

  bench('complex template (nested blocks, unless, with)', () => {
    compile(COMPLEX, { isTemplate: true });
  });

  bench('large template (50 static rows)', () => {
    compile(LARGE_50, { isTemplate: true });
  });

  bench('large template (200 static rows)', () => {
    compile(LARGE_200, { isTemplate: true });
  });
});

describe('compilation — parse only', () => {
  bench('parse simple', () => {
    compile(SIMPLE);
  });

  bench('parse complex', () => {
    compile(COMPLEX);
  });
});
