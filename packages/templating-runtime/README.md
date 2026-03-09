# @blaze-ng/templating-runtime

Template runtime for compiled `.html` templates in Blaze-NG. Handles template registration, body content, dynamic template rendering, and HMR support.

## Installation

```bash
npm install @blaze-ng/templating-runtime
```

## Usage

```ts
import { Template, __define__, __checkName, getRegisteredTemplate } from '@blaze-ng/templating-runtime';

// Register a template (called by compiled .html output)
__checkName('myTemplate');
__define__('myTemplate', renderFunction);

// Look up a registered template
const tmpl = getRegisteredTemplate('myTemplate');

// Define helpers and events
Template.myTemplate.helpers({
  greeting() { return 'Hello!'; },
});

Template.myTemplate.events({
  'click .btn'(event, instance) { /* ... */ },
});
```

## Exports

| Export | Description |
|--------|-------------|
| `Template` | Template registry with helper/event/lifecycle registration |
| `__define__` | Register a compiled template render function |
| `__checkName` | Validate a template name is available |
| `getRegisteredTemplate` | Look up a template by name |
| `body` | The body pseudo-template |
| `addBodyContent` | Add content to the body template |
| `renderToDocument` | Render the body template to the document |
| `_migrateTemplate` | Migrate template state during HMR |
| `_markPendingReplacement` | Mark a template for HMR replacement |
| `_applyHmrChanges` | Apply pending HMR changes |

## License

MIT
