import { defineConfig } from 'vitepress';

export default defineConfig({
  title: 'Blaze-NG',
  description: 'A modern TypeScript rewrite of Meteor Blaze — the reactive templating engine',

  ignoreDeadLinks: [/localhost/],

  vite: {
    ssr: {
      noExternal: [
        'codemirror',
        '@codemirror/lang-html',
        '@codemirror/lang-javascript',
        '@codemirror/theme-one-dark',
        '@blaze-ng/observe-sequence',
      ],
    },
  },

  head: [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/logo.svg' }],
    ['meta', { name: 'theme-color', content: '#e25822' }],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:title', content: 'Blaze-NG' }],
    ['meta', { property: 'og:description', content: 'Modern TypeScript rewrite of Meteor Blaze' }],
  ],

  themeConfig: {
    logo: '/logo.svg',

    nav: [
      { text: 'Guide', link: '/guide/getting-started' },
      { text: 'API', link: '/api/' },
      { text: 'Examples', link: '/examples/' },
      { text: 'Playground', link: '/playground' },
      {
        text: 'v0.1.0',
        items: [
          { text: 'Changelog', link: '/changelog' },
          { text: 'Contributing', link: '/contributing' },
        ],
      },
    ],

    sidebar: {
      '/guide/': [
        {
          text: 'Introduction',
          items: [
            { text: 'What is Blaze-NG?', link: '/guide/what-is-blaze-ng' },
            { text: 'Getting Started', link: '/guide/getting-started' },
            { text: 'Migration from Blaze', link: '/guide/migration' },
          ],
        },
        {
          text: 'Essentials',
          items: [
            { text: 'Templates', link: '/guide/templates' },
            { text: 'Helpers', link: '/guide/helpers' },
            { text: 'Events', link: '/guide/events' },
            { text: 'Reactivity', link: '/guide/reactivity' },
            { text: 'Lifecycle', link: '/guide/lifecycle' },
          ],
        },
        {
          text: 'Template Syntax',
          items: [
            { text: 'Spacebars Overview', link: '/guide/spacebars' },
            { text: 'Conditionals', link: '/guide/conditionals' },
            { text: 'Lists & Iteration', link: '/guide/lists' },
            { text: 'Inclusion & Composition', link: '/guide/inclusion' },
            { text: 'Dynamic Attributes', link: '/guide/attributes' },
          ],
        },
        {
          text: 'Advanced',
          items: [
            { text: 'Custom Reactive Systems', link: '/guide/reactive-systems' },
            { text: 'Server-Side Rendering', link: '/guide/ssr' },
            { text: 'Performance', link: '/guide/performance' },
            { text: 'Architecture', link: '/guide/architecture' },
          ],
        },
      ],
      '/api/': [
        {
          text: 'API Reference',
          items: [
            { text: 'Overview', link: '/api/' },
            { text: '@blaze-ng/core', link: '/api/core' },
            { text: '@blaze-ng/htmljs', link: '/api/htmljs' },
            { text: '@blaze-ng/spacebars', link: '/api/spacebars' },
            { text: '@blaze-ng/spacebars-compiler', link: '/api/spacebars-compiler' },
            { text: '@blaze-ng/templating-runtime', link: '/api/templating-runtime' },
            { text: '@blaze-ng/templating-compiler', link: '/api/templating-compiler' },
            { text: '@blaze-ng/templating-tools', link: '/api/templating-tools' },
            { text: '@blaze-ng/observe-sequence', link: '/api/observe-sequence' },
            { text: '@blaze-ng/html-tools', link: '/api/html-tools' },
            { text: '@blaze-ng/blaze-tools', link: '/api/blaze-tools' },
            { text: '@blaze-ng/meteor', link: '/api/meteor' },
            { text: '@blaze-ng/wasm', link: '/api/wasm' },
          ],
        },
      ],
      '/examples/': [
        {
          text: 'Examples',
          items: [
            { text: 'Overview', link: '/examples/' },
            { text: 'Running the Examples', link: '/examples/running-examples' },
            { text: 'Counter', link: '/examples/counter' },
            { text: 'Todo App', link: '/examples/todo-app' },
            { text: 'Chat App', link: '/examples/chat-app' },
            { text: 'Form Handling', link: '/examples/forms' },
            { text: 'Dashboard', link: '/examples/dashboard' },
            { text: 'Dynamic Components', link: '/examples/dynamic-components' },
            { text: 'SSR', link: '/examples/ssr-example' },
          ],
        },
      ],
    },

    socialLinks: [{ icon: 'github', link: 'https://github.com/wreiske/blaze-ng' }],

    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © 2024-present wreiske',
    },

    search: {
      provider: 'local',
    },

    editLink: {
      pattern: 'https://github.com/wreiske/blaze-ng/edit/main/docs/:path',
      text: 'Edit this page on GitHub',
    },
  },

  markdown: {
    config(md) {
      // Escape {{ }} in prose and inline code so Vue doesn't treat them as
      // interpolation.  Fenced code blocks already get v-pre from VitePress.
      const defaultText = md.renderer.rules.text;
      md.renderer.rules.text = (tokens, idx, options, env, self) => {
        const html = defaultText
          ? defaultText(tokens, idx, options, env, self)
          : md.utils.escapeHtml(tokens[idx].content);
        return html.replace(/\{\{/g, '&#123;&#123;').replace(/\}\}/g, '&#125;&#125;');
      };

      const defaultCodeInline = md.renderer.rules.code_inline;
      md.renderer.rules.code_inline = (tokens, idx, options, env, self) => {
        const html = defaultCodeInline
          ? defaultCodeInline(tokens, idx, options, env, self)
          : `<code>${md.utils.escapeHtml(tokens[idx].content)}</code>`;
        return html.replace(/\{\{/g, '&#123;&#123;').replace(/\}\}/g, '&#125;&#125;');
      };
    },
  },
});
