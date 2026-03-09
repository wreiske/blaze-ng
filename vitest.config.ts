import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      // Shims for loading original Blaze packages in comparative benchmarks
      'meteor/meteor': resolve(__dirname, 'benchmarks/comparative/shims/meteor.js'),
      'meteor/htmljs': resolve(__dirname, '../blaze/packages/htmljs/preamble.js'),
      'meteor/html-tools': resolve(__dirname, 'benchmarks/comparative/shims/html-tools.js'),
      'meteor/blaze-tools': resolve(__dirname, 'benchmarks/comparative/shims/blaze-tools.js'),
      'meteor/spacebars-compiler': resolve(
        __dirname,
        'benchmarks/comparative/shims/spacebars-compiler.js',
      ),

      '@blaze-ng/blaze-tools': resolve(__dirname, 'packages/blaze-tools/src/index.ts'),
      '@blaze-ng/compat': resolve(__dirname, 'packages/compat/src/index.ts'),
      '@blaze-ng/core/testing': resolve(__dirname, 'packages/core/src/testing.ts'),
      '@blaze-ng/core': resolve(__dirname, 'packages/core/src/index.ts'),
      '@blaze-ng/hot': resolve(__dirname, 'packages/hot/src/index.ts'),
      '@blaze-ng/html-templates': resolve(__dirname, 'packages/html-templates/src/index.ts'),
      '@blaze-ng/html-tools': resolve(__dirname, 'packages/html-tools/src/index.ts'),
      '@blaze-ng/htmljs': resolve(__dirname, 'packages/htmljs/src/index.ts'),
      '@blaze-ng/meteor': resolve(__dirname, 'packages/meteor/src/index.ts'),
      '@blaze-ng/observe-sequence': resolve(__dirname, 'packages/observe-sequence/src/index.ts'),
      '@blaze-ng/spacebars-compiler': resolve(
        __dirname,
        'packages/spacebars-compiler/src/index.ts',
      ),
      '@blaze-ng/spacebars': resolve(__dirname, 'packages/spacebars/src/index.ts'),
      '@blaze-ng/templating-compiler': resolve(
        __dirname,
        'packages/templating-compiler/src/index.ts',
      ),
      '@blaze-ng/templating-runtime': resolve(
        __dirname,
        'packages/templating-runtime/src/index.ts',
      ),
      '@blaze-ng/templating-tools': resolve(__dirname, 'packages/templating-tools/src/index.ts'),
      '@blaze-ng/templating': resolve(__dirname, 'packages/templating/src/index.ts'),
      '@blaze-ng/wasm': resolve(__dirname, 'packages/wasm/src/index.ts'),
    },
  },
  test: {
    include: ['packages/*/tests/**/*.test.ts'],
    globals: true,
    coverage: {
      provider: 'v8',
      include: ['packages/*/src/**/*.ts'],
      exclude: ['**/*.test.ts', '**/index.ts'],
    },
    benchmark: {
      include: ['benchmarks/**/*.bench.ts'],
    },
  },
});
