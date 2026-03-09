# Blaze-NG (wreiske:blaze-ng) — TypeScript Rewrite Plan

**Goal**: Full, modern TypeScript rewrite of Meteor Blaze with 100% API parity, all 370+ original tests passing, superior performance, and minimal dependencies. Drop-in replacement for any Meteor app.

---

## Architecture Decisions

- [x] **Framework-agnostic core + Meteor adapter** — Core has zero Meteor deps; `@blaze-ng/meteor` bridges Tracker
- [x] **pnpm workspaces + tsup** — Fast builds, tree-shakeable ESM + CJS
- [x] **Dual publish** — npm (`@blaze-ng/*`) + Meteor atmosphere (`wreiske:blaze-ng-*`)
- [x] **jQuery dropped** — Native DOM APIs (`classList`, `style.setProperty`, `addEventListener`)
- [x] **Lodash dropped** — `Object.hasOwn`, `Array.isArray`, `typeof`
- [x] **ES2020+ target** — No IE11. Node.js 18+ for SSR/build
- [x] **WASM optional** — Selective use for HTML tokenization (build) + sequence diffing (runtime), with JS fallbacks

---

## Package Map

| Original Package     | New Package (`@blaze-ng/*`) | Purpose                                                |
| -------------------- | --------------------------- | ------------------------------------------------------ |
| htmljs               | `htmljs`                    | HTML AST (Tag, Attrs, CharRef, Raw, Comment, Visitors) |
| html-tools           | `html-tools`                | HTML tokenizer & parser                                |
| blaze-tools          | `blaze-tools`               | Token parsers, JS code generation                      |
| spacebars-compiler   | `spacebars-compiler`        | Template → JS compiler                                 |
| observe-sequence     | `observe-sequence`          | Reactive array/cursor observation                      |
| **blaze**            | `core`                      | **View engine, rendering, DOM, events**                |
| spacebars            | `spacebars`                 | Spacebars runtime (include, mustache, etc.)            |
| templating-tools     | `templating-tools`          | HTML scanner, code generation                          |
| templating-compiler  | `templating-compiler`       | .html build plugin                                     |
| templating-runtime   | `templating-runtime`        | Template.body, dynamic templates                       |
| templating           | `templating`                | Meta: runtime + compiler                               |
| blaze-html-templates | `html-templates`            | Meta: core + templating                                |
| blaze-hot            | `hot`                       | HMR support                                            |
| ui                   | `compat`                    | UI/Handlebars backward-compat aliases                  |
| _(new)_              | `meteor`                    | Tracker adapter + Meteor bridge                        |
| _(new)_              | `wasm`                      | Optional WASM accelerators (Rust)                      |

---

## Phase 0: Monorepo Scaffolding

- [x] Initialize pnpm workspace (`pnpm-workspace.yaml`, root `package.json`)
- [x] Create `tsconfig.base.json` (strict TypeScript)
- [x] Create shared `tsup.config.base.ts`
- [x] Configure Vitest (`vitest.config.ts`)
- [x] Set up ESLint 9 + Prettier
- [x] Scaffold all 16 packages (package.json, tsconfig.json, src/index.ts)
- [x] Verify: `pnpm install`, `pnpm build`, `pnpm test`, `pnpm lint` all work

---

## Phase 1: Foundation Layer (no Meteor deps)

### 1a. `@blaze-ng/htmljs`

- [x] Port `HTML.Tag` class with typed properties
- [x] Port `HTML.Attrs` class
- [x] Port `HTML.CharRef`, `HTML.Comment`, `HTML.Raw`
- [x] Port element constructors (143 HTML + 81 SVG elements)
- [x] Port visitor pattern (TransformingVisitor, ToTextVisitor, ToHTMLVisitor)
- [x] Define `HTMLNode` union type and related types
- [x] Port 4 original tests → Vitest
- [x] Verify: all tests pass, package builds

### 1b. `@blaze-ng/blaze-tools`

- [x] Port token parsers (`parseNumber`, `parseIdentifierName`, `parseExtendedIdentifierName`, `parseStringLiteral`)
- [x] Port `toJS()` / `toObjectLiteralKey()` utilities
- [x] Port 1 original test → Vitest
- [x] Verify: all tests pass, package builds

### 1c. `@blaze-ng/observe-sequence`

- [x] Define `ReactiveSystem` interface (`autorun`, `nonReactive`, `ReactiveVar<T>`)
- [x] Port `ObserveSequence.observe()` with generic reactive system
- [x] Port sequence type detection (array, cursor-like, iterable)
- [x] Port 19 tests → Vitest (mock reactive system)
- [x] Verify: all tests pass, package builds

---

## Phase 2: Parser & Compiler Layer

### 2a. `@blaze-ng/html-tools` (depends on 1a)

- [x] Port Scanner class (character-by-character parsing)
- [x] Port HTML tokenizer (getComment, getDoctype, getHTMLToken)
- [x] Port character reference decoder
- [x] Port HTML parser (parseFragment, getContent)
- [x] Port 7 original tests → Vitest (49 tests)
- [x] Verify: all tests pass

### 2b. `@blaze-ng/spacebars-compiler` (depends on 2a, 1b)

- [x] Port TemplateTag model (stache tags, block tags)
- [x] Port Spacebars parser
- [x] Port code generator (codeGen → JS string)
- [x] Port optimizer (tree compaction)
- [x] Drop uglify-js dependency
- [x] Port 4 original tests → Vitest (83 tests)
- [x] Verify: can compile template strings to JS

### 2c. `@blaze-ng/templating-tools` (depends on 2b)

- [x] Port HTML scanner (`scanHtmlForTags`)
- [x] Port tag compilation (`compileTagsWithSpacebars`)
- [x] Port code generation (`generateTemplateJS`, `generateBodyJS`)
- [x] Port 1 original test → Vitest (23 tests)
- [x] Verify: all tests pass

---

## Phase 3: Core Runtime

### 3a. Reactivity Interface (in `@blaze-ng/core`)

- [x] Define `ReactiveSystem` interface
- [x] Define `Computation`, `ReactiveVar<T>` interfaces
- [x] Global reactive system registration: `Blaze.setReactiveSystem()`
- [x] Simple in-memory reactive system for testing (no Tracker dep)

### 3b. View System (depends on 3a)

- [x] Port `Blaze.View` class (~1,100 lines → fully typed)
- [x] Port lifecycle: created → rendered → ready → destroyed
- [x] Port scope bindings and view hierarchy
- [x] Port autorun via ReactiveSystem interface
- [x] Port 3 view tests → Vitest

### 3c. DOM Backend (parallel with 3b)

- [x] Native `parseHTML(html)` → DocumentFragment
- [x] Native event delegation via `addEventListener`
- [x] Element teardown via `WeakMap`
- [x] Drop jQuery entirely

### 3d. DOMRange (depends on 3c)

- [x] Port DOMRange class with typed members
- [x] Port attach/detach/move operations
- [x] Use modern `Element.after()`, `Element.before()`, `Element.replaceWith()`
- [x] Drop IE8 comment fallback

### 3e. Materializer (depends on 3b, 3d)

- [x] Port work-stack based HTMLjs→DOM materialization
- [x] Port content equality checking
- [x] Port Promise attribute handling

### 3f. Attribute Handlers (depends on 3c)

- [x] Port `AttributeHandler` base class
- [x] Port `ClassHandler` using `classList` API (perf win)
- [x] Port `StyleHandler` using `style.setProperty()` (perf win)
- [x] Port `BooleanHandler`, `URLHandler`, `XlinkHandler`

### 3g. Events (depends on 3c, 3d)

- [x] Port event delegation with capture/bubble detection
- [x] Port `HandlerRec` tracking
- [x] Native addEventListener/removeEventListener

### 3h. Template & Lookup (depends on 3b, 3g)

- [x] Port Template class (helpers, events, lifecycle callbacks)
- [x] Port HelperMap with typed entries
- [x] Port lookup chain (template → lexical → data → global)
- [x] Port built-in helpers: `@pending`, `@resolved`, `@rejected`
- [x] Port 13 render tests → Vitest

### 3i. Builtins (depends on 3h)

- [x] Port `Blaze.With`, `Blaze.If`, `Blaze.Unless`, `Blaze.Each`, `Blaze.Let`
- [x] Port promise/async binding support
- [x] Port `InOuterTemplateScope`

---

## Phase 4: Spacebars Runtime & Templating

- [x] **4a. `@blaze-ng/spacebars`** — Port include/mustache/attrMustache/makeRaw/call/dot. Port 32 tests.
- [x] **4b. `@blaze-ng/templating-runtime`** — Port Template.body, \_\_checkName, renderToDocument, dynamic templates, HMR. Port 16 tests.
- [x] **4c. `@blaze-ng/templating-compiler`** — Port .html build plugin.
- [x] **4d. `@blaze-ng/templating`** — Meta-package (runtime + compiler).
- [x] **4e. `@blaze-ng/html-templates`** — Meta-package (core + templating).

---

## Phase 5: Meteor Adapter

- [x] **5a. `@blaze-ng/meteor`** — TrackerAdapter implementing ReactiveSystem with Meteor Tracker
- [x] **5b. `@blaze-ng/hot`** — HMR template tracking, re-rendering, module cleanup
- [x] **5c. `@blaze-ng/compat`** — UI/Handlebars namespace aliases with deprecation warnings

---

## Phase 6: Integration Tests & Full Compatibility

- [x] Expand observe-sequence tests: 19 → 35 (array transitions, movedTo, edge cases)
- [x] Expand core tests: 31 → 46 (view GC, reactive attrs, template lifecycle, Each, helpers, renderWithData)
- **331 tests passing across 12 test files**
- [ ] Port remaining spacebars-tests integration suite (~197 DOM tests requiring compiled templates)
- [ ] Run original test-app with Puppeteer against new packages
- [ ] Side-by-side compatibility tests (old Blaze vs new)
- [ ] Fix any behavioral differences

---

## Phase 7: WASM Accelerators (parallel with Phase 6)

- [ ] Set up Rust + wasm-pack in `packages/wasm/rust/`
- [ ] Implement HTML tokenizer in Rust → WASM
- [ ] Implement sequence differ in Rust → WASM
- [ ] JS wrapper with feature detection + fallback
- [ ] Benchmark: only ship if >2x improvement

---

## Phase 8: Docs App & Marketing

- [ ] Meteor app with React 19 + Tailwind 4 + Rspack
- [ ] Animated landing page (hero, features, benchmarks)
- [ ] Live Playground: edit Spacebars, see rendered output
- [ ] Migration guide
- [ ] SSR-rendered API docs from TSDoc
- [ ] Dark mode, responsive, glass-morphism (wormhole style)

---

## Phase 9: Polish & Release

- [ ] Performance benchmark suite
- [ ] Bundle size analysis (<15KB gzipped core target)
- [ ] CHANGELOG + per-package READMEs
- [ ] Publish to npm (`@blaze-ng/*`) and Atmosphere (`wreiske:blaze-ng-*`)

---

## Performance Targets

| Metric             | Original Blaze            | Target                |
| ------------------ | ------------------------- | --------------------- |
| First render       | baseline                  | ≤ baseline            |
| Reactive update    | baseline                  | 2-5x faster           |
| Bundle size (core) | ~25KB gzip                | <15KB gzip            |
| Dependencies       | jQuery, lodash, uglify-js | **zero runtime deps** |

---

## Key Performance Wins

1. `classList.add/remove` instead of class string parsing
2. `style.setProperty/removeProperty` instead of style string parsing
3. Native `addEventListener` — no jQuery wrapper
4. Zero lodash — native `Object.hasOwn`, `Array.isArray`
5. TypeScript shapes → V8 hidden class optimization
6. `WeakRef`/`FinalizationRegistry` for view cleanup
7. WASM sequence diffing for large `{{#each}}` (1000+ items)
