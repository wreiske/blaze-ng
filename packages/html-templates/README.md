# @blaze-ng/html-templates

Default template system meta-package for Blaze-NG. Re-exports the core engine and the full templating stack.

## Installation

```bash
npm install @blaze-ng/html-templates
```

## Usage

```ts
import { Blaze, Template } from '@blaze-ng/html-templates';

// Everything from @blaze-ng/core and @blaze-ng/templating is available
Blaze.render(Template.myTemplate, document.getElementById('app'));
```

## What's Included

This package re-exports everything from:

- `@blaze-ng/core` — View engine, rendering, DOM, events
- `@blaze-ng/templating` — Template runtime + compiler

Use this as a convenience import when you want the full Blaze-NG stack.

## License

MIT
