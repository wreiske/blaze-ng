import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  splitting: false,
  sourcemap: true,
  esbuildOptions(options) {
    options.minifySyntax = true;
    options.minifyWhitespace = true;
    options.minifyIdentifiers = true;
  },
  clean: true,
});
