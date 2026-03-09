# @blaze-ng/templating-runtime

Template registration, body content management, dynamic templates, and HMR support.

## Installation

```bash
npm install @blaze-ng/templating-runtime
```

## Template Registration

### `__define__()`

Register a named template with a render function.

```ts
function __define__(name: string, renderFunc: () => unknown): void;
```

```ts
import { __define__ } from '@blaze-ng/templating-runtime';

__define__('myComponent', function () {
  const view = this;
  return HTML.DIV({ class: 'component' }, Spacebars.mustache(view.lookup('content')));
});
```

### `__checkName()`

Validate a template name is not already registered.

```ts
function __checkName(name: string): void;
```

Throws if the template name is already in use.

### `getRegisteredTemplate()`

Retrieve a registered template by name.

```ts
function getRegisteredTemplate(name: string): Template | undefined;
```

```ts
import { getRegisteredTemplate } from '@blaze-ng/templating-runtime';

const tmpl = getRegisteredTemplate('myComponent');
if (tmpl) {
  Blaze.render(tmpl, document.body);
}
```

## Body Content

### `addBodyContent()`

Add content to the document body template.

```ts
function addBodyContent(renderFunc: () => unknown): void;
```

### `renderToDocument()`

Render all registered body content into the document.

```ts
function renderToDocument(): void;
```

### `getBodyView()`

Get the view for the rendered body content.

```ts
function getBodyView(): View | null;
```

### `body`

The `Template.body` template instance for body content.

```ts
const body: Template;
```

## Dynamic Templates

### `__dynamic`

Helper for `{{> Template.dynamic}}`:

```handlebars
{{> Template.dynamic template=templateName}}
{{> Template.dynamic template=templateName data=dataContext}}
```

### `__dynamicWithDataContext`

Helper for dynamic templates with explicit data context:

```handlebars
{{> Template.dynamic template=templateName data=getData}}
```

## HMR (Hot Module Replacement)

### `_applyHmrChanges()`

Apply hot module replacement changes to templates.

```ts
function _applyHmrChanges(templateName?: string): void;
```

### `_migrateTemplate()`

Migrate a template to a new version during HMR.

```ts
function _migrateTemplate(templateName: string, newTemplate: Template): void;
```

### `_markPendingReplacement()`

Mark a template as pending replacement during HMR.

```ts
function _markPendingReplacement(name: string): void;
```

## Testing

### `_resetRegistry()`

Clear all registered templates. Useful for test cleanup.

```ts
function _resetRegistry(): void;
```

```ts
import { _resetRegistry } from '@blaze-ng/templating-runtime';

afterEach(() => {
  _resetRegistry();
});
```
