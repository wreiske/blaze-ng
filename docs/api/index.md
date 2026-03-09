# API Reference

Blaze-ng is organized as a collection of focused packages. Each package has a single responsibility and can be used independently.

## Core Packages

| Package                                                 | Description                                             |
| ------------------------------------------------------- | ------------------------------------------------------- |
| [@blaze-ng/core](./core.md)                             | Core rendering engine — View, Template, render, toHTML  |
| [@blaze-ng/htmljs](./htmljs.md)                         | HTML object model — structured HTML representation      |
| [@blaze-ng/spacebars](./spacebars.md)                   | Spacebars template runtime — mustache, include, helpers |
| [@blaze-ng/spacebars-compiler](./spacebars-compiler.md) | Spacebars compiler — template string to render function |
| [@blaze-ng/templating-runtime](./templating-runtime.md) | Template registration, body content, HMR support        |
| [@blaze-ng/observe-sequence](./observe-sequence.md)     | Reactive list observation and diffing                   |

## Build Tools

| Package                                                   | Description                                      |
| --------------------------------------------------------- | ------------------------------------------------ |
| [@blaze-ng/templating-tools](./templating-tools.md)       | HTML scanning and template compilation utilities |
| [@blaze-ng/templating-compiler](./templating-compiler.md) | High-level template compilation API              |
| [@blaze-ng/html-tools](./html-tools.md)                   | HTML tokenizer and parser                        |
| [@blaze-ng/blaze-tools](./blaze-tools.md)                 | Scanner and code generation utilities            |

## Integration

| Package                         | Description                                             |
| ------------------------------- | ------------------------------------------------------- |
| [@blaze-ng/meteor](./meteor.md) | Meteor Tracker reactive system adapter                  |
| [@blaze-ng/wasm](./wasm.md)     | Optional WASM accelerators for diffing and tokenization |

## Quick Links

- [Blaze.render()](./core.md#render) — Render a template into a DOM element
- [Blaze.toHTML()](./core.md#tohtml) — Render to HTML string (SSR)
- [Template.helpers()](./core.md#template-helpers) — Define template helpers
- [Template.events()](./core.md#template-events) — Define event handlers
- [Template.onCreated()](./core.md#lifecycle-callbacks) — Lifecycle callback
- [SpacebarsCompiler.compile()](./spacebars-compiler.md#compile) — Compile template string
- [HTML.DIV()](./htmljs.md#tag-functions) — Create HTML elements
