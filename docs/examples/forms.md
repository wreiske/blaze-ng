# Example: Form Validation

A comprehensive form system with real-time validation, dynamic fields, and multi-step wizards.

## Basic Validated Form

### Template

```handlebars
<template name="signupForm">
  <form class="form" novalidate>
    <h2>Create Account</h2>

    {{> formField
        name="username"
        label="Username"
        type="text"
        value=fields.username.value
        error=fields.username.error
        placeholder="Choose a username"}}

    {{> formField
        name="email"
        label="Email"
        type="email"
        value=fields.email.value
        error=fields.email.error
        placeholder="you@example.com"}}

    {{> formField
        name="password"
        label="Password"
        type="password"
        value=fields.password.value
        error=fields.password.error
        placeholder="Min. 8 characters"}}

    {{> formField
        name="confirmPassword"
        label="Confirm Password"
        type="password"
        value=fields.confirmPassword.value
        error=fields.confirmPassword.error
        placeholder="Repeat your password"}}

    {{#if formError}}
      <div class="form-error">{{formError}}</div>
    {{/if}}

    <button type="submit" class="submit-btn" {{#if isSubmitting}}disabled{{/if}}>
      {{#if isSubmitting}}Creating Account...{{else}}Create Account{{/if}}
    </button>
  </form>
</template>

<template name="formField">
  <div class="field {{#if error}}has-error{{/if}}">
    <label for="field-{{name}}">{{label}}</label>
    <input
      id="field-{{name}}"
      name="{{name}}"
      type="{{type}}"
      value="{{value}}"
      placeholder="{{placeholder}}"
      class="input">
    {{#if error}}
      <span class="error-message">{{error}}</span>
    {{/if}}
  </div>
</template>
```

### JavaScript

```ts
import { Template } from '@blaze-ng/templating-runtime';
import { Blaze, SimpleReactiveSystem } from '@blaze-ng/core';

Blaze.setReactiveSystem(new SimpleReactiveSystem());

// ── Validation Rules ────────────────────────────────────

const validators = {
  required: (value, label) => (value.trim() ? null : `${label} is required`),

  minLength: (min) => (value, label) =>
    value.length >= min ? null : `${label} must be at least ${min} characters`,

  maxLength: (max) => (value, label) =>
    value.length <= max ? null : `${label} must be at most ${max} characters`,

  pattern: (regex, message) => (value) => (regex.test(value) ? null : message),

  email: (value) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? null : 'Please enter a valid email address',

  match: (fieldName, label) => (value, _, fields) =>
    value === fields[fieldName]?.value ? null : `Must match ${label}`,
};

// ── Field Configuration ─────────────────────────────────

const fieldConfig = {
  username: {
    label: 'Username',
    rules: [
      validators.required,
      validators.minLength(3),
      validators.maxLength(20),
      validators.pattern(/^[a-zA-Z0-9_]+$/, 'Only letters, numbers, and underscores'),
    ],
  },
  email: {
    label: 'Email',
    rules: [validators.required, validators.email],
  },
  password: {
    label: 'Password',
    rules: [
      validators.required,
      validators.minLength(8),
      validators.pattern(/[A-Z]/, 'Must contain at least one uppercase letter'),
      validators.pattern(/[0-9]/, 'Must contain at least one number'),
    ],
  },
  confirmPassword: {
    label: 'Confirm Password',
    rules: [validators.required, validators.match('password', 'Password')],
  },
};

// ── Template Logic ──────────────────────────────────────

Template.signupForm.onCreated(function () {
  const fields = {};
  for (const [name, config] of Object.entries(fieldConfig)) {
    fields[name] = { value: '', error: null, touched: false };
  }
  this.fields = new ReactiveVar(fields);
  this.formError = new ReactiveVar(null);
  this.isSubmitting = new ReactiveVar(false);
});

function validateField(name, fields) {
  const config = fieldConfig[name];
  const value = fields[name].value;

  for (const rule of config.rules) {
    const error = rule(value, config.label, fields);
    if (error) return error;
  }
  return null;
}

function validateAll(fields) {
  let valid = true;
  for (const name of Object.keys(fieldConfig)) {
    const error = validateField(name, fields);
    fields[name].error = error;
    fields[name].touched = true;
    if (error) valid = false;
  }
  return valid;
}

Template.signupForm.helpers({
  fields() {
    return Template.instance().fields.get();
  },
  formError() {
    return Template.instance().formError.get();
  },
  isSubmitting() {
    return Template.instance().isSubmitting.get();
  },
});

Template.signupForm.events({
  'input .input'(event, instance) {
    const { name, value } = event.target;
    const fields = { ...instance.fields.get() };
    fields[name] = { ...fields[name], value };

    // Validate on input if field was already touched
    if (fields[name].touched) {
      fields[name].error = validateField(name, fields);
    }

    instance.fields.set(fields);
    instance.formError.set(null);
  },

  'blur .input'(event, instance) {
    const { name } = event.target;
    const fields = { ...instance.fields.get() };
    fields[name] = {
      ...fields[name],
      touched: true,
      error: validateField(name, fields),
    };
    instance.fields.set(fields);
  },

  'submit form'(event, instance) {
    event.preventDefault();
    const fields = { ...instance.fields.get() };

    if (!validateAll(fields)) {
      instance.fields.set(fields);
      return;
    }

    instance.isSubmitting.set(true);

    // Simulate API call
    setTimeout(() => {
      instance.isSubmitting.set(false);
      console.log('Account created:', {
        username: fields.username.value,
        email: fields.email.value,
      });
    }, 1500);
  },
});
```

## Multi-Step Wizard

### Template

```handlebars
<template name="wizard">
  <div class="wizard">
    <div class="wizard-progress">
      {{#each step in steps}}
        <div class="step-indicator {{stepClass step @index}}">
          <div class="step-number">
            {{#if (isCompleted @index)}}✓{{else}}{{math @index "+" 1}}{{/if}}
          </div>
          <span class="step-label">{{step.title}}</span>
        </div>
      {{/each}}
    </div>

    <div class="wizard-body">
      {{> Template.dynamic template=currentStepTemplate data=stepData}}
    </div>

    <div class="wizard-footer">
      {{#unless isFirstStep}}
        <button class="btn-back" type="button">Back</button>
      {{/unless}}
      <div class="spacer"></div>
      {{#if isLastStep}}
        <button class="btn-submit" type="button" {{#if isSubmitting}}disabled{{/if}}>
          {{#if isSubmitting}}Processing...{{else}}Submit{{/if}}
        </button>
      {{else}}
        <button class="btn-next" type="button">Next</button>
      {{/if}}
    </div>
  </div>
</template>

<template name="wizardStepProfile">
  <div class="step-content">
    <h3>Personal Information</h3>
    <div class="field-row">
      <div class="field">
        <label>First Name</label>
        <input name="firstName" value="{{data.firstName}}" class="input">
      </div>
      <div class="field">
        <label>Last Name</label>
        <input name="lastName" value="{{data.lastName}}" class="input">
      </div>
    </div>
    <div class="field">
      <label>Bio</label>
      <textarea name="bio" class="input textarea">{{data.bio}}</textarea>
    </div>
  </div>
</template>

<template name="wizardStepPlan">
  <div class="step-content">
    <h3>Choose Your Plan</h3>
    <div class="plan-grid">
      {{#each plan in plans}}
        <div class="plan-card {{#if (eq plan.id ../data.selectedPlan)}}selected{{/if}}"
             data-plan="{{plan.id}}">
          <h4>{{plan.name}}</h4>
          <div class="price">{{plan.price}}</div>
          <ul>
            {{#each feature in plan.features}}
              <li>✓ {{feature}}</li>
            {{/each}}
          </ul>
        </div>
      {{/each}}
    </div>
  </div>
</template>

<template name="wizardStepReview">
  <div class="step-content">
    <h3>Review & Confirm</h3>
    <dl class="review-list">
      <dt>Name</dt>
      <dd>{{data.firstName}} {{data.lastName}}</dd>
      <dt>Bio</dt>
      <dd>{{data.bio}}</dd>
      <dt>Plan</dt>
      <dd>{{selectedPlanName}}</dd>
    </dl>
  </div>
</template>
```

### JavaScript

```ts
const steps = [
  { title: 'Profile', template: 'wizardStepProfile' },
  { title: 'Plan', template: 'wizardStepPlan' },
  { title: 'Review', template: 'wizardStepReview' },
];

const plans = [
  { id: 'free', name: 'Free', price: '$0/mo', features: ['5 projects', '1GB storage'] },
  {
    id: 'pro',
    name: 'Pro',
    price: '$12/mo',
    features: ['Unlimited projects', '100GB storage', 'Priority support'],
  },
  {
    id: 'team',
    name: 'Team',
    price: '$29/mo',
    features: ['Everything in Pro', 'Team management', 'SSO', 'Audit logs'],
  },
];

Template.wizard.onCreated(function () {
  this.currentStep = new ReactiveVar(0);
  this.isSubmitting = new ReactiveVar(false);
  this.formData = new ReactiveVar({
    firstName: '',
    lastName: '',
    bio: '',
    selectedPlan: 'free',
  });
});

Template.wizard.helpers({
  steps() {
    return steps;
  },
  currentStepTemplate() {
    return steps[Template.instance().currentStep.get()].template;
  },
  stepData() {
    return {
      data: Template.instance().formData.get(),
      plans,
    };
  },
  stepClass(step, index) {
    const current = Template.instance().currentStep.get();
    if (index < current) return 'completed';
    if (index === current) return 'active';
    return '';
  },
  isFirstStep() {
    return Template.instance().currentStep.get() === 0;
  },
  isLastStep() {
    return Template.instance().currentStep.get() === steps.length - 1;
  },
  isSubmitting() {
    return Template.instance().isSubmitting.get();
  },
  isCompleted(index) {
    return index < Template.instance().currentStep.get();
  },
});

Template.wizard.events({
  'click .btn-next'(event, instance) {
    const step = instance.currentStep.get();
    if (step < steps.length - 1) {
      instance.currentStep.set(step + 1);
    }
  },
  'click .btn-back'(event, instance) {
    const step = instance.currentStep.get();
    if (step > 0) {
      instance.currentStep.set(step - 1);
    }
  },
  'click .btn-submit'(event, instance) {
    instance.isSubmitting.set(true);
    const data = instance.formData.get();
    setTimeout(() => {
      instance.isSubmitting.set(false);
      console.log('Wizard submitted:', data);
    }, 1500);
  },
  'input .input, input .textarea'(event, instance) {
    const { name, value } = event.target;
    const data = { ...instance.formData.get(), [name]: value };
    instance.formData.set(data);
  },
});

// Step-specific events
Template.wizardStepPlan.events({
  'click .plan-card'(event) {
    const planId = event.currentTarget.dataset.plan;
    const wizard = Template.instance().view.parentView.parentView.templateInstance();
    const data = { ...wizard.formData.get(), selectedPlan: planId };
    wizard.formData.set(data);
  },
});

Template.wizardStepReview.helpers({
  selectedPlanName() {
    const plan = plans.find((p) => p.id === this.data.selectedPlan);
    return plan ? plan.name : 'None';
  },
});

// Global helpers
Template.registerHelper('math', (a, op, b) => {
  if (op === '+') return Number(a) + Number(b);
  if (op === '-') return Number(a) - Number(b);
  return a;
});

Template.registerHelper('eq', (a, b) => a === b);
```

## Styles

```css
/* Form */
.form {
  max-width: 480px;
  margin: 2rem auto;
  padding: 2rem;
  background: white;
  border-radius: 12px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.1);
}

.field {
  margin-bottom: 1.25rem;
}

.field label {
  display: block;
  margin-bottom: 0.375rem;
  font-weight: 500;
  font-size: 0.875rem;
}

.input {
  width: 100%;
  padding: 0.75rem;
  border: 2px solid #e2e8f0;
  border-radius: 8px;
  font-size: 1rem;
  transition: border-color 0.15s;
}

.input:focus {
  border-color: #4f46e5;
  outline: none;
}

.has-error .input {
  border-color: #ef4444;
}

.error-message {
  display: block;
  color: #ef4444;
  font-size: 0.8125rem;
  margin-top: 0.25rem;
}

.form-error {
  background: #fef2f2;
  border: 1px solid #fecaca;
  color: #dc2626;
  padding: 0.75rem;
  border-radius: 8px;
  margin-bottom: 1rem;
}

.submit-btn {
  width: 100%;
  padding: 0.875rem;
  background: #4f46e5;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
}

.submit-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* Wizard */
.wizard {
  max-width: 640px;
  margin: 2rem auto;
  background: white;
  border-radius: 12px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.1);
  overflow: hidden;
}

.wizard-progress {
  display: flex;
  padding: 1.5rem 2rem;
  background: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
  gap: 2rem;
  justify-content: center;
}

.step-indicator {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  opacity: 0.4;
}
.step-indicator.active {
  opacity: 1;
}
.step-indicator.completed {
  opacity: 0.7;
}

.step-number {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: #e2e8f0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.875rem;
  font-weight: 600;
}

.active .step-number {
  background: #4f46e5;
  color: white;
}
.completed .step-number {
  background: #22c55e;
  color: white;
}

.wizard-body {
  padding: 2rem;
}

.wizard-footer {
  display: flex;
  padding: 1.5rem 2rem;
  border-top: 1px solid #e2e8f0;
}
.spacer {
  flex: 1;
}

.field-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.plan-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1rem;
}

.plan-card {
  padding: 1.5rem;
  border: 2px solid #e2e8f0;
  border-radius: 12px;
  cursor: pointer;
  text-align: center;
}
.plan-card.selected {
  border-color: #4f46e5;
  background: #eef2ff;
}
.plan-card .price {
  font-size: 1.5rem;
  font-weight: 700;
  margin: 0.5rem 0;
}

.review-list dt {
  font-weight: 600;
  margin-top: 0.75rem;
}
.review-list dd {
  margin-left: 0;
  color: #475569;
}
```

## What This Demonstrates

- **Reusable form field components** — `formField` template with validation display
- **Real-time validation** — validates on blur and on input after first touch
- **Composable validators** — small, pure validation functions
- **Multi-step wizards** — `Template.dynamic` for step switching
- **Shared state across steps** — parent template holds form data
- **Reactive progress indicators** — step status computed from current step
- **Cross-field validation** — password confirmation checks against password field
