/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck — vitest resolve aliases handle these imports at runtime
/**
 * Comparative parsing benchmarks — Original Blaze vs Blaze-NG.
 *
 * Measures template string → AST parsing speed (no code generation).
 * This isolates the HTML/Spacebars parser performance from codegen.
 */
import { bench, describe } from 'vitest';
import { parse as parseNG } from '@blaze-ng/spacebars-compiler';
import { SpacebarsCompiler } from 'meteor/spacebars-compiler';

// ─── Shared template sources ─────────────────────────────────────────────────

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
          </div>
        {{/each}}
      </section>
    {{/with}}
  </main>
</div>`;

const HTML_ONLY = `
<table class="data-table" id="main-table">
  <thead>
    <tr><th scope="col">Name</th><th scope="col">Value</th><th scope="col">Status</th></tr>
  </thead>
  <tbody>
    <tr><td>Alpha</td><td>100</td><td><span class="badge active">Active</span></td></tr>
    <tr><td>Beta</td><td>200</td><td><span class="badge">Inactive</span></td></tr>
    <tr><td>Gamma</td><td>300</td><td><span class="badge active">Active</span></td></tr>
  </tbody>
</table>`;

// ─── Parsing benchmarks ─────────────────────────────────────────────────────

describe('parse — simple template', () => {
  bench('Original Blaze', () => {
    SpacebarsCompiler.parse(SIMPLE);
  });

  bench('Blaze-NG', () => {
    parseNG(SIMPLE);
  });
});

describe('parse — medium template', () => {
  bench('Original Blaze', () => {
    SpacebarsCompiler.parse(MEDIUM);
  });

  bench('Blaze-NG', () => {
    parseNG(MEDIUM);
  });
});

describe('parse — complex template (nested blocks)', () => {
  bench('Original Blaze', () => {
    SpacebarsCompiler.parse(COMPLEX);
  });

  bench('Blaze-NG', () => {
    parseNG(COMPLEX);
  });
});

describe('parse — pure HTML (no template tags)', () => {
  bench('Original Blaze', () => {
    SpacebarsCompiler.parse(HTML_ONLY);
  });

  bench('Blaze-NG', () => {
    parseNG(HTML_ONLY);
  });
});
