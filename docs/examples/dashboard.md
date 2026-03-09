# Example: Dynamic Dashboard

A data dashboard with filterable charts, real-time updates, and responsive card layout.

## Templates

```handlebars
<template name="dashboard">
  <div class="dashboard">
    <header class="dashboard-header">
      <h1>Analytics Dashboard</h1>
      <div class="controls">
        <select class="period-select">
          {{#each period in periods}}
            <option value="{{period.value}}"
                    {{#if (eq period.value selectedPeriod)}}selected{{/if}}>
              {{period.label}}
            </option>
          {{/each}}
        </select>
        <button class="btn-refresh" {{#if isRefreshing}}disabled{{/if}}>
          {{#if isRefreshing}}↻ Refreshing...{{else}}↻ Refresh{{/if}}
        </button>
      </div>
    </header>

    <div class="stats-grid">
      {{#each stat in stats}}
        {{> statCard stat=stat}}
      {{/each}}
    </div>

    <div class="charts-grid">
      {{> chartCard title="Revenue Over Time" chart=revenueChart}}
      {{> chartCard title="Users by Source" chart=usersChart}}
    </div>

    <div class="table-section">
      <div class="table-header">
        <h2>Recent Activity</h2>
        <input type="text" class="search-input"
               placeholder="Search activity..."
               value="{{searchQuery}}">
      </div>
      {{> activityTable activities=filteredActivities}}
    </div>
  </div>
</template>

<template name="statCard">
  <div class="stat-card">
    <div class="stat-icon" style="background: {{stat.color}}20; color: {{stat.color}}">
      {{stat.icon}}
    </div>
    <div class="stat-content">
      <span class="stat-label">{{stat.label}}</span>
      <span class="stat-value">{{stat.value}}</span>
      <span class="stat-change {{#if stat.isPositive}}positive{{else}}negative{{/if}}">
        {{#if stat.isPositive}}↑{{else}}↓{{/if}} {{stat.change}}%
      </span>
    </div>
  </div>
</template>

<template name="chartCard">
  <div class="chart-card">
    <h3>{{title}}</h3>
    <div class="chart-body">
      {{#if chart.type "bar"}}
        {{> barChart data=chart.data}}
      {{else}}
        {{> donutChart data=chart.data}}
      {{/if}}
    </div>
  </div>
</template>

<template name="barChart">
  <div class="bar-chart">
    {{#each bar in data}}
      <div class="bar-column">
        <div class="bar" style="height: {{bar.height}}%; background: {{bar.color}}">
          <span class="bar-tooltip">{{bar.label}}: {{bar.value}}</span>
        </div>
        <span class="bar-label">{{bar.month}}</span>
      </div>
    {{/each}}
  </div>
</template>

<template name="donutChart">
  <div class="donut-chart">
    <svg viewBox="0 0 100 100">
      {{#each segment in data}}
        <circle
          cx="50" cy="50" r="40"
          fill="none"
          stroke="{{segment.color}}"
          stroke-width="12"
          stroke-dasharray="{{segment.dashArray}}"
          stroke-dashoffset="{{segment.dashOffset}}"
          transform="rotate(-90 50 50)">
        </circle>
      {{/each}}
    </svg>
    <div class="donut-legend">
      {{#each segment in data}}
        <div class="legend-item">
          <span class="legend-dot" style="background: {{segment.color}}"></span>
          {{segment.label}} — {{segment.value}}%
        </div>
      {{/each}}
    </div>
  </div>
</template>

<template name="activityTable">
  <table class="activity-table">
    <thead>
      <tr>
        <th class="sortable" data-field="user">User</th>
        <th class="sortable" data-field="action">Action</th>
        <th class="sortable" data-field="target">Target</th>
        <th class="sortable" data-field="time">Time</th>
        <th>Status</th>
      </tr>
    </thead>
    <tbody>
      {{#each activity in activities}}
        <tr>
          <td>
            <div class="user-cell">
              <div class="user-avatar" style="background: {{activity.avatarColor}}">
                {{activity.initials}}
              </div>
              {{activity.user}}
            </div>
          </td>
          <td>{{activity.action}}</td>
          <td class="mono">{{activity.target}}</td>
          <td>{{timeAgo activity.time}}</td>
          <td>
            <span class="status-badge {{activity.status}}">
              {{activity.status}}
            </span>
          </td>
        </tr>
      {{else}}
        <tr>
          <td colspan="5" class="empty-state">No matching activities</td>
        </tr>
      {{/each}}
    </tbody>
  </table>
</template>
```

## JavaScript

```ts
import { Template } from '@blaze-ng/templating-runtime';
import { Blaze, SimpleReactiveSystem } from '@blaze-ng/core';

Blaze.setReactiveSystem(new SimpleReactiveSystem());

// ── Data Generation ─────────────────────────────────────

function generateStats() {
  return [
    { label: 'Revenue', value: '$48,295', change: 12.5, isPositive: true, icon: '💰', color: '#22c55e' },
    { label: 'Users', value: '2,847', change: 8.3, isPositive: true, icon: '👥', color: '#3b82f6' },
    { label: 'Orders', value: '1,205', change: 3.1, isPositive: true, icon: '📦', color: '#8b5cf6' },
    { label: 'Bounce Rate', value: '24.8%', change: 2.4, isPositive: false, icon: '📉', color: '#ef4444' },
  ];
}

function generateRevenueChart() {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
  const values = [3200, 4100, 3800, 5200, 4800, 6100];
  const max = Math.max(...values);
  return {
    type: 'bar',
    data: months.map((month, i) => ({
      month,
      value: `$${values[i]}`,
      height: (values[i] / max) * 100,
      color: '#4f46e5',
      label: month,
    })),
  };
}

function generateUsersChart() {
  const segments = [
    { label: 'Organic', value: 45, color: '#4f46e5' },
    { label: 'Social', value: 25, color: '#22c55e' },
    { label: 'Referral', value: 18, color: '#f59e0b' },
    { label: 'Direct', value: 12, color: '#ef4444' },
  ];
  
  let offset = 0;
  return {
    type: 'donut',
    data: segments.map(s => {
      const circumference = 2 * Math.PI * 40;
      const length = (s.value / 100) * circumference;
      const dashArray = `${length} ${circumference - length}`;
      const dashOffset = -offset;
      offset += length;
      return { ...s, dashArray, dashOffset };
    }),
  };
}

function generateActivities() {
  return [
    { user: 'Alice Chen', initials: 'AC', avatarColor: '#4f46e5', action: 'Deployed', target: 'v2.4.1', time: Date.now() - 120000, status: 'success' },
    { user: 'Bob Smith', initials: 'BS', avatarColor: '#22c55e', action: 'Merged PR', target: '#847', time: Date.now() - 300000, status: 'success' },
    { user: 'Carol Wu', initials: 'CW', avatarColor: '#f59e0b', action: 'Opened Issue', target: '#848', time: Date.now() - 600000, status: 'pending' },
    { user: 'David Kim', initials: 'DK', avatarColor: '#ef4444', action: 'Failed Build', target: 'main', time: Date.now() - 900000, status: 'error' },
    { user: 'Eve Jones', initials: 'EJ', avatarColor: '#8b5cf6', action: 'Reviewed PR', target: '#845', time: Date.now() - 1200000, status: 'success' },
    { user: 'Frank Lee', initials: 'FL', avatarColor: '#06b6d4', action: 'Created Branch', target: 'feat/auth', time: Date.now() - 1800000, status: 'success' },
  ];
}

// ── Dashboard Template ──────────────────────────────────

Template.dashboard.onCreated(function () {
  this.selectedPeriod = new ReactiveVar('7d');
  this.stats = new ReactiveVar(generateStats());
  this.revenueChart = new ReactiveVar(generateRevenueChart());
  this.usersChart = new ReactiveVar(generateUsersChart());
  this.activities = new ReactiveVar(generateActivities());
  this.searchQuery = new ReactiveVar('');
  this.sortField = new ReactiveVar('time');
  this.sortDirection = new ReactiveVar(-1);
  this.isRefreshing = new ReactiveVar(false);
  
  // Auto-refresh every 30 seconds
  this.refreshInterval = setInterval(() => {
    this.stats.set(generateStats());
  }, 30000);
});

Template.dashboard.onDestroyed(function () {
  clearInterval(this.refreshInterval);
});

Template.dashboard.helpers({
  periods() {
    return [
      { value: '24h', label: 'Last 24 Hours' },
      { value: '7d', label: 'Last 7 Days' },
      { value: '30d', label: 'Last 30 Days' },
      { value: '90d', label: 'Last 90 Days' },
    ];
  },
  selectedPeriod() { return Template.instance().selectedPeriod.get(); },
  stats() { return Template.instance().stats.get(); },
  revenueChart() { return Template.instance().revenueChart.get(); },
  usersChart() { return Template.instance().usersChart.get(); },
  isRefreshing() { return Template.instance().isRefreshing.get(); },
  searchQuery() { return Template.instance().searchQuery.get(); },
  filteredActivities() {
    const instance = Template.instance();
    const query = instance.searchQuery.get().toLowerCase();
    const field = instance.sortField.get();
    const dir = instance.sortDirection.get();
    
    let activities = instance.activities.get();
    
    if (query) {
      activities = activities.filter(a =>
        a.user.toLowerCase().includes(query) ||
        a.action.toLowerCase().includes(query) ||
        a.target.toLowerCase().includes(query)
      );
    }
    
    return activities.sort((a, b) => {
      if (a[field] < b[field]) return -dir;
      if (a[field] > b[field]) return dir;
      return 0;
    });
  },
});

Template.dashboard.events({
  'change .period-select'(event, instance) {
    instance.selectedPeriod.set(event.target.value);
    // In real app: re-fetch data for new period
  },
  'click .btn-refresh'(event, instance) {
    instance.isRefreshing.set(true);
    setTimeout(() => {
      instance.stats.set(generateStats());
      instance.activities.set(generateActivities());
      instance.isRefreshing.set(false);
    }, 1000);
  },
  'input .search-input'(event, instance) {
    instance.searchQuery.set(event.target.value);
  },
});

Template.activityTable.events({
  'click .sortable'(event, instance) {
    const field = event.currentTarget.dataset.field;
    const dashboard = instance.view.parentView.templateInstance();
    
    if (dashboard.sortField.get() === field) {
      dashboard.sortDirection.set(dashboard.sortDirection.get() * -1);
    } else {
      dashboard.sortField.set(field);
      dashboard.sortDirection.set(1);
    }
  },
});

// ── Global Helpers ──────────────────────────────────────

Template.registerHelper('eq', (a, b) => a === b);

Template.registerHelper('timeAgo', (timestamp) => {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
});
```

## Styles

```css
.dashboard {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
  font-family: system-ui, sans-serif;
}

.dashboard-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
}

.controls { display: flex; gap: 0.75rem; }

.period-select, .btn-refresh {
  padding: 0.5rem 1rem;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: white;
  font-size: 0.875rem;
  cursor: pointer;
}

/* Stats Grid */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1.5rem;
  margin-bottom: 2rem;
}

.stat-card {
  background: white;
  border-radius: 12px;
  padding: 1.5rem;
  display: flex;
  gap: 1rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
}

.stat-icon {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
}

.stat-label { display: block; font-size: 0.875rem; color: #64748b; }
.stat-value { display: block; font-size: 1.5rem; font-weight: 700; }

.stat-change {
  font-size: 0.8125rem;
  font-weight: 500;
}
.stat-change.positive { color: #22c55e; }
.stat-change.negative { color: #ef4444; }

/* Charts */
.charts-grid {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 1.5rem;
  margin-bottom: 2rem;
}

.chart-card {
  background: white;
  border-radius: 12px;
  padding: 1.5rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
}

.bar-chart {
  display: flex;
  align-items: flex-end;
  gap: 0.75rem;
  height: 200px;
  padding-top: 1rem;
}

.bar-column {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  height: 100%;
  justify-content: flex-end;
}

.bar {
  width: 100%;
  border-radius: 4px 4px 0 0;
  position: relative;
  transition: height 0.3s ease;
}

.bar-tooltip {
  position: absolute;
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%);
  background: #1e293b;
  color: white;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
  white-space: nowrap;
  opacity: 0;
  transition: opacity 0.15s;
}

.bar:hover .bar-tooltip { opacity: 1; }
.bar-label { font-size: 0.75rem; color: #64748b; margin-top: 0.5rem; }

.donut-chart { display: flex; align-items: center; gap: 1.5rem; }
.donut-chart svg { width: 140px; height: 140px; }

.legend-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  margin-bottom: 0.5rem;
}

.legend-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

/* Table */
.table-section {
  background: white;
  border-radius: 12px;
  padding: 1.5rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
}

.table-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.search-input {
  padding: 0.5rem 1rem;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  width: 250px;
}

.activity-table {
  width: 100%;
  border-collapse: collapse;
}

.activity-table th {
  text-align: left;
  padding: 0.75rem;
  border-bottom: 2px solid #e2e8f0;
  font-size: 0.8125rem;
  color: #64748b;
  text-transform: uppercase;
}

.activity-table td {
  padding: 0.75rem;
  border-bottom: 1px solid #f1f5f9;
}

.sortable { cursor: pointer; }
.sortable:hover { color: #4f46e5; }

.user-cell { display: flex; align-items: center; gap: 0.75rem; }

.user-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 0.75rem;
  font-weight: 600;
}

.mono { font-family: 'SF Mono', monospace; font-size: 0.875rem; }

.status-badge {
  padding: 0.25rem 0.5rem;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 500;
}
.status-badge.success { background: #dcfce7; color: #16a34a; }
.status-badge.pending { background: #fef3c7; color: #d97706; }
.status-badge.error { background: #fef2f2; color: #dc2626; }

.empty-state {
  text-align: center;
  color: #94a3b8;
  padding: 2rem;
}

@media (max-width: 768px) {
  .stats-grid { grid-template-columns: repeat(2, 1fr); }
  .charts-grid { grid-template-columns: 1fr; }
}
```

## What This Demonstrates

- **Complex template composition** — dashboard built from small, reusable components
- **Dynamic SVG rendering** — donut chart segments calculated with stroke-dash
- **Reactive filtering and sorting** — activity table with search and column sort
- **Periodic data refresh** — auto-refresh with cleanup on destroy
- **Responsive grid layouts** — CSS Grid with media query breakpoints
- **`{{else}}` with `{{#each}}`** — empty state for no matching activities
- **Inline styles from data** — colors computed from data as style attributes
- **Event delegation** — sortable headers, period selector, refresh button
- **`onDestroyed` cleanup** — clearing intervals to prevent memory leaks
