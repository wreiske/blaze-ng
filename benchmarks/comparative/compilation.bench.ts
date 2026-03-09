/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck — vitest resolve aliases handle these imports at runtime
/**
 * Comparative compilation benchmarks — Original Blaze vs Blaze-NG.
 *
 * Runs identical template sources through both compilers and measures
 * compilation throughput (template string → JS code string).
 */
import { bench, describe } from 'vitest';
import { compile as compileNG } from '@blaze-ng/spacebars-compiler';
import { SpacebarsCompiler } from 'meteor/spacebars-compiler';

// ─── Shared template sources (identical input to both compilers) ─────────────

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

/**
 * Generate a large template with repeated table rows.
 * @param {number} rowCount - Number of rows to generate.
 * @returns {string} Template source.
 */
function generateLargeTemplate(rowCount) {
  const rows = [];
  for (let i = 0; i < rowCount; i++) {
    rows.push(`<tr><td>{{name_${i}}}</td><td>{{value_${i}}}</td><td>{{status_${i}}}</td></tr>`);
  }
  return `<table><thead><tr><th>Name</th><th>Value</th><th>Status</th></tr></thead><tbody>${rows.join('\n')}</tbody></table>`;
}

const LARGE_50 = generateLargeTemplate(50);

// ─── Compilation benchmarks ──────────────────────────────────────────────────

describe('compilation — simple template', () => {
  bench('Original Blaze', () => {
    SpacebarsCompiler.compile(SIMPLE, { isTemplate: true });
  });

  bench('Blaze-NG', () => {
    compileNG(SIMPLE, { isTemplate: true });
  });
});

describe('compilation — medium template (if/each/helpers)', () => {
  bench('Original Blaze', () => {
    SpacebarsCompiler.compile(MEDIUM, { isTemplate: true });
  });

  bench('Blaze-NG', () => {
    compileNG(MEDIUM, { isTemplate: true });
  });
});

describe('compilation — complex template (nested blocks)', () => {
  bench('Original Blaze', () => {
    SpacebarsCompiler.compile(COMPLEX, { isTemplate: true });
  });

  bench('Blaze-NG', () => {
    compileNG(COMPLEX, { isTemplate: true });
  });
});

describe('compilation — large template (50 rows)', () => {
  bench('Original Blaze', () => {
    SpacebarsCompiler.compile(LARGE_50, { isTemplate: true });
  });

  bench('Blaze-NG', () => {
    compileNG(LARGE_50, { isTemplate: true });
  });
});
