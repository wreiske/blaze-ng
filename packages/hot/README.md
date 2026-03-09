# @blaze-ng/hot

Hot Module Replacement (HMR) support for Blaze-NG. Enables live-reloading of templates during development without full page refreshes.

## Installation

```bash
npm install @blaze-ng/hot
```

## Usage

This package is automatically used by the Blaze-NG build tooling. It tracks rendered views and applies template changes when `.html` files are modified.

```ts
import { getTemplateModule, setTemplateModule, _markHMRActive } from '@blaze-ng/hot';

// Mark HMR as active (done by build plugin)
_markHMRActive();

// Track template modules for replacement
setTemplateModule('myTemplate', module);
```

## Exports

| Export                | Description                                   |
| --------------------- | --------------------------------------------- |
| `getTemplateModule`   | Get the module for a registered template      |
| `setTemplateModule`   | Register a template's module for HMR tracking |
| `trackRenderedView`   | Track a rendered view for live updates        |
| `untrackRenderedView` | Stop tracking a rendered view                 |
| `_markHMRActive`      | Enable HMR mode                               |

## License

MIT
