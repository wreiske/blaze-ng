# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [0.1.0] — 2025-01-XX

### Added

- **@blaze-ng/htmljs** — HTML AST representation with `Tag`, `Raw`, `Comment`, `CharRef`, `Visitor`, `toHTML`, `toText`
- **@blaze-ng/html-tools** — HTML tokenizer and parser with `Scanner`, `parseFragment`, character references
- **@blaze-ng/blaze-tools** — Compile-time utilities: `toJS`, `toJSLiteral`, `EmitCode`, `ToJSVisitor`
- **@blaze-ng/spacebars-compiler** — Full Spacebars compiler: `parse`, `compile`, `codeGen`, `optimize`, `TemplateTag`, `TreeTransformer`
- **@blaze-ng/spacebars** — Spacebars runtime: `mustache`, `attrMustache`, `include`, `With`, `kw`, `SafeString`
- **@blaze-ng/core** — View engine, rendering, DOM range management, attribute handlers, event system, `SimpleReactiveSystem`
- **@blaze-ng/observe-sequence** — Reactive sequence observation with `ObserveSequence.observe`, `diffQueryOrderedChanges`
- **@blaze-ng/templating-runtime** — Template registration, helpers, events, lifecycle hooks, HMR support
- **@blaze-ng/templating-compiler** — HTML template build plugin
- **@blaze-ng/templating-tools** — Template scanning and compilation utilities
- **@blaze-ng/templating** — Meta-package bundling runtime + compiler
- **@blaze-ng/html-templates** — Meta-package bundling core + templating
- **@blaze-ng/meteor** — Meteor Tracker reactive system adapter
- **@blaze-ng/compat** — Backward compatibility aliases (`UI`, `Handlebars`)
- **@blaze-ng/hot** — Hot Module Replacement support for templates
- **@blaze-ng/wasm** — Optional WASM accelerators for diff and tokenize with JS fallbacks

### Architecture

- **Bring Your Own Reactive System (BYORS)** — Pluggable reactive system interface via `Blaze.setReactiveSystem()`
- **TypeScript-first** — Full type safety with strict mode, declaration files for all packages
- **ESM + CJS** — Dual-format builds via tsup
- **Zero Meteor dependency** — Core packages work standalone; `@blaze-ng/meteor` bridges to Meteor
- **WASM-optional** — Performance accelerators that gracefully degrade to JS implementations
- **435 tests** across 14 test files covering all packages
- **VitePress documentation site** with guides, API reference, and interactive examples
