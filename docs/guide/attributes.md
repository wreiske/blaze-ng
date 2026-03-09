# Dynamic Attributes

Control HTML attributes dynamically using Spacebars expressions.

## Basic Dynamic Attributes

```handlebars
<a href="{{url}}" title="{{tooltip}}">{{label}}</a>
<img src="{{imageUrl}}" alt="{{altText}}" width="{{width}}">
<input type="text" value="{{currentValue}}" placeholder="{{placeholder}}">
```

## Dynamic Classes

### Conditional Classes

```handlebars
<div class="btn {{#if isPrimary}}btn-primary{{else}}btn-secondary{{/if}}">
  {{label}}
</div>

<li class="nav-item {{#if isActive}}active{{/if}} {{#if isDisabled}}disabled{{/if}}">
  <a href="{{url}}">{{title}}</a>
</li>

<div class="card {{statusClass}} {{#if isSelected}}selected{{/if}} {{sizeClass}}">
  {{> Template.contentBlock}}
</div>
```

### Class Helper

```ts
Template.registerHelper('classNames', function (...args) {
  const options = args.pop();
  const classes = [...args];
  
  // Add conditional classes from hash
  Object.entries(options.hash).forEach(([className, condition]) => {
    if (condition) classes.push(className);
  });
  
  return classes.filter(Boolean).join(' ');
});
```

```handlebars
<div class="{{classNames 'card' active=isActive highlighted=isHighlighted large=isLarge}}">
  {{content}}
</div>
```

## Dynamic Styles

### Inline Styles

```handlebars
<div style="color: {{textColor}}; background: {{bgColor}}; font-size: {{fontSize}}px">
  {{content}}
</div>

<div class="progress-bar" style="width: {{percentage}}%">
  {{percentage}}%
</div>

<div class="avatar" style="background-image: url('{{avatarUrl}}')">
  {{initials}}
</div>
```

### Style Helper

```ts
Template.registerHelper('style', function (options) {
  return Object.entries(options.hash)
    .filter(([, value]) => value != null && value !== false)
    .map(([prop, value]) => {
      // Convert camelCase to kebab-case
      const cssProp = prop.replace(/([A-Z])/g, '-$1').toLowerCase();
      return `${cssProp}: ${value}`;
    })
    .join('; ');
});
```

```handlebars
<div style="{{style color=textColor backgroundColor=bgColor fontSize=fontSizePx}}">
  {{content}}
</div>
```

## Boolean Attributes

HTML boolean attributes are present or absent — not `true`/`false`:

```handlebars
<input type="checkbox" {{#if isChecked}}checked{{/if}}>
<button {{#if isDisabled}}disabled{{/if}}>Submit</button>
<input type="text" {{#if isReadOnly}}readonly{{/if}}>
<select {{#if allowMultiple}}multiple{{/if}}>
  {{#each option in options}}
    <option value="{{option.value}}" {{#if option.selected}}selected{{/if}}>
      {{option.label}}
    </option>
  {{/each}}
</select>
<details {{#if isOpen}}open{{/if}}>
  <summary>{{title}}</summary>
  {{content}}
</details>
<video {{#if shouldAutoplay}}autoplay{{/if}} {{#if showControls}}controls{{/if}}>
  <source src="{{videoUrl}}" type="video/mp4">
</video>
```

## Attribute Spread

Return an object from a helper to set multiple attributes at once:

```ts
Template.myInput.helpers({
  attrs() {
    return {
      type: this.type || 'text',
      class: `form-input ${this.size || 'md'}`,
      placeholder: this.placeholder || '',
      'aria-label': this.label,
      'data-field': this.fieldName,
      ...(this.required ? { required: '' } : {}),
      ...(this.disabled ? { disabled: '' } : {}),
      ...(this.maxLength ? { maxlength: String(this.maxLength) } : {}),
    };
  },
});
```

```handlebars
<input {{attrs}}>
```

This renders all the key-value pairs as HTML attributes.

## Data Attributes

```handlebars
<div class="item" 
     data-id="{{_id}}" 
     data-type="{{type}}" 
     data-index="{{@index}}">
  {{name}}
</div>

<button class="action" 
        data-action="{{action}}" 
        data-target="{{targetId}}">
  {{label}}
</button>
```

Access in event handlers:

```ts
Template.itemList.events({
  'click .item'(event) {
    const id = event.currentTarget.dataset.id;
    const type = event.currentTarget.dataset.type;
    Router.go(`/${type}/${id}`);
  },
  'click .action'(event) {
    const { action, target } = event.currentTarget.dataset;
    performAction(action, target);
  },
});
```

## ARIA Attributes

Build accessible components:

```handlebars
<template name="accordion">
  {{#each section in sections}}
    <div class="accordion-section">
      <button class="accordion-trigger"
              id="trigger-{{section._id}}"
              aria-expanded="{{section.isOpen}}"
              aria-controls="panel-{{section._id}}">
        {{section.title}}
        <span class="chevron">{{#if section.isOpen}}▲{{else}}▼{{/if}}</span>
      </button>
      {{#if section.isOpen}}
        <div class="accordion-panel"
             id="panel-{{section._id}}"
             role="region"
             aria-labelledby="trigger-{{section._id}}">
          {{section.content}}
        </div>
      {{/if}}
    </div>
  {{/each}}
</template>
```

```handlebars
<template name="tabList">
  <div role="tablist" aria-label="{{label}}">
    {{#each tab in tabs}}
      <button role="tab"
              id="tab-{{tab.id}}"
              aria-selected="{{#if (eq activeTab tab.id)}}true{{else}}false{{/if}}"
              aria-controls="panel-{{tab.id}}"
              class="tab {{#if (eq activeTab tab.id)}}active{{/if}}">
        {{tab.label}}
      </button>
    {{/each}}
  </div>
  
  {{#each tab in tabs}}
    {{#if (eq activeTab tab.id)}}
      <div role="tabpanel"
           id="panel-{{tab.id}}"
           aria-labelledby="tab-{{tab.id}}">
        {{> Template.dynamic template=tab.template data=tab.data}}
      </div>
    {{/if}}
  {{/each}}
</template>
```

## SVG Attributes

Blaze handles SVG namespacing automatically:

```handlebars
<template name="progressRing">
  <svg width="{{size}}" height="{{size}}" viewBox="0 0 {{size}} {{size}}">
    {{!-- Background circle --}}
    <circle cx="{{half}}" cy="{{half}}" r="{{radius}}"
            fill="none" stroke="#e5e7eb" stroke-width="{{strokeWidth}}"/>
    {{!-- Progress arc --}}
    <circle cx="{{half}}" cy="{{half}}" r="{{radius}}"
            fill="none" stroke="{{color}}" stroke-width="{{strokeWidth}}"
            stroke-dasharray="{{circumference}}"
            stroke-dashoffset="{{offset}}"
            stroke-linecap="round"
            transform="rotate(-90 {{half}} {{half}})"/>
    {{!-- Center text --}}
    <text x="50%" y="50%" text-anchor="middle" dominant-baseline="central"
          font-size="{{fontSize}}" fill="{{textColor}}">
      {{percentage}}%
    </text>
  </svg>
</template>
```

```ts
Template.progressRing.helpers({
  half() { return this.size / 2; },
  radius() { return (this.size - this.strokeWidth) / 2; },
  circumference() {
    const r = (this.size - this.strokeWidth) / 2;
    return 2 * Math.PI * r;
  },
  offset() {
    const r = (this.size - this.strokeWidth) / 2;
    const c = 2 * Math.PI * r;
    return c - (this.percentage / 100) * c;
  },
});
```

## Complete Example: Dynamic Form Builder

```handlebars
<template name="dynamicForm">
  <form class="dynamic-form" novalidate>
    {{#each field in fields}}
      <div class="form-group {{#if (fieldError field.name)}}has-error{{/if}}">
        <label for="field-{{field.name}}">
          {{field.label}}
          {{#if field.required}}<span class="required">*</span>{{/if}}
        </label>
        
        {{#if (eq field.type "text")}}
          <input id="field-{{field.name}}"
                 type="text"
                 name="{{field.name}}"
                 value="{{fieldValue field.name}}"
                 placeholder="{{field.placeholder}}"
                 {{#if field.required}}required{{/if}}
                 {{#if field.maxLength}}maxlength="{{field.maxLength}}"{{/if}}
                 class="form-input">
        {{/if}}
        
        {{#if (eq field.type "textarea")}}
          <textarea id="field-{{field.name}}"
                    name="{{field.name}}"
                    placeholder="{{field.placeholder}}"
                    rows="{{field.rows}}"
                    {{#if field.required}}required{{/if}}
                    class="form-input">{{fieldValue field.name}}</textarea>
        {{/if}}
        
        {{#if (eq field.type "select")}}
          <select id="field-{{field.name}}"
                  name="{{field.name}}"
                  {{#if field.required}}required{{/if}}
                  class="form-input">
            <option value="">{{field.placeholder}}</option>
            {{#each option in field.options}}
              <option value="{{option.value}}" 
                      {{#if (eq (fieldValue ../field.name) option.value)}}selected{{/if}}>
                {{option.label}}
              </option>
            {{/each}}
          </select>
        {{/if}}
        
        {{#if (eq field.type "checkbox")}}
          <label class="checkbox-label">
            <input type="checkbox"
                   name="{{field.name}}"
                   {{#if (fieldValue field.name)}}checked{{/if}}>
            {{field.checkboxLabel}}
          </label>
        {{/if}}
        
        {{#if field.helpText}}
          <small class="help-text">{{field.helpText}}</small>
        {{/if}}
        {{#if (fieldError field.name)}}
          <small class="error-text">{{fieldError field.name}}</small>
        {{/if}}
      </div>
    {{/each}}
    
    <div class="form-actions">
      {{> button label="Submit" variant="primary" type="submit" loading=isSubmitting}}
      {{> button label="Reset" variant="ghost" class="reset-btn"}}
    </div>
  </form>
</template>
```

```ts
Template.dynamicForm.onCreated(function () {
  this.values = new ReactiveDict();
  this.errors = new ReactiveDict();
  this.isSubmitting = new ReactiveVar(false);
  
  // Set initial values
  this.data.fields.forEach(field => {
    if (field.defaultValue != null) {
      this.values.set(field.name, field.defaultValue);
    }
  });
});

Template.dynamicForm.helpers({
  fieldValue(name) { return Template.instance().values.get(name); },
  fieldError(name) { return Template.instance().errors.get(name); },
  isSubmitting() { return Template.instance().isSubmitting.get(); },
});

Template.dynamicForm.events({
  'input .form-input, change .form-input'(event, instance) {
    const { name, value, type, checked } = event.target;
    instance.values.set(name, type === 'checkbox' ? checked : value);
    instance.errors.set(name, null); // Clear error on change
  },
  'submit form'(event, instance) {
    event.preventDefault();
    // Validate and submit...
  },
  'click .reset-btn'(event, instance) {
    instance.data.fields.forEach(field => {
      instance.values.set(field.name, field.defaultValue || '');
      instance.errors.set(field.name, null);
    });
  },
});
```
