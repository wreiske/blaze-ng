<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, nextTick } from 'vue';
import { useData } from 'vitepress';
import { presets, getPreset } from '../playground-presets';

const props = withDefaults(
  defineProps<{
    preset?: string;
    template?: string;
    javascript?: string;
    css?: string;
    height?: string;
    mini?: boolean;
  }>(),
  {
    preset: 'counter',
    height: '560px',
    mini: false,
  },
);

const { isDark } = useData();

const templateEditorEl = ref<HTMLElement | null>(null);
const jsEditorEl = ref<HTMLElement | null>(null);
const cssEditorEl = ref<HTMLElement | null>(null);
const previewContainer = ref<HTMLElement | null>(null);

const error = ref<string>('');
const activePreset = ref(props.preset);
const templateCode = ref('');
const jsCode = ref('');
const cssCode = ref('');

let templateEditor: any = null;
let jsEditor: any = null;
let cssEditor: any = null;
let cmModules: any = null;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let blazeRuntime: any = null;
let currentView: any = null;

function loadPreset(name: string) {
  const p = getPreset(name);
  if (!p) return;
  activePreset.value = name;
  templateCode.value = p.template;
  jsCode.value = p.javascript;
  cssCode.value = p.css || '';
  if (templateEditor && cmModules) {
    templateEditor.dispatch({
      changes: { from: 0, to: templateEditor.state.doc.length, insert: p.template },
    });
  }
  if (jsEditor && cmModules) {
    jsEditor.dispatch({
      changes: { from: 0, to: jsEditor.state.doc.length, insert: p.javascript },
    });
  }
  if (cssEditor && cmModules) {
    cssEditor.dispatch({
      changes: { from: 0, to: cssEditor.state.doc.length, insert: p.css || '' },
    });
  }
  scheduleRun();
}

function scheduleRun() {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(runPreview, 300);
}

function runPreview() {
  error.value = '';
  const container = previewContainer.value;
  if (!container || !blazeRuntime) return;

  const {
    Template,
    View,
    Each,
    If,
    Unless,
    With,
    Let,
    _TemplateWith,
    _InOuterTemplateScope,
    render,
    remove,
    setReactiveSystem,
    registerHelper,
    SimpleReactiveSystem,
    ObserveSequence,
    compile,
    Spacebars,
    HTML: _HTML,
    __define__,
    getRegisteredTemplate,
    _resetRegistry,
  } = blazeRuntime;

  try {
    if (currentView) {
      remove(currentView, container.querySelector('[data-playground-app]'));
    }
  } catch {
    // ignore cleanup errors
  }
  container.innerHTML = '';
  currentView = null;

  // Clear template registry so re-runs don't throw "duplicate template" errors
  _resetRegistry();

  const HTML = Object.create(_HTML);
  HTML.Raw = (...a: any[]) => new _HTML.Raw(...a);
  HTML.CharRef = (...a: any[]) => new _HTML.CharRef(...a);
  HTML.Comment = (...a: any[]) => new _HTML.Comment(...a);

  const Blaze = {
    View: (...a: any[]) => new View(...a),
    Each,
    If,
    Unless,
    With,
    Let,
    _TemplateWith,
    _InOuterTemplateScope,
  };

  const reactive = new SimpleReactiveSystem();
  setReactiveSystem(reactive);
  ObserveSequence.setReactiveSystem(reactive);

  const tpl = templateCode.value;
  const js = jsCode.value;
  const css = cssCode.value;

  const subTemplates: { name: string; body: string }[] = [];
  const tplRegex = /<template\s+name=["']([^"']+)["']\s*>([\s\S]*?)<\/template>/gi;
  let match;
  while ((match = tplRegex.exec(tpl)) !== null) {
    subTemplates.push({ name: match[1], body: match[2].trim() });
  }
  const mainTemplate = tpl.replace(tplRegex, '').trim();

  function compileAndRegister(name: string, source: string) {
    const code = compile(source, { isTemplate: true });
    const renderFunc = new Function('HTML', 'Spacebars', 'Blaze', 'return ' + code)(
      HTML,
      Spacebars,
      Blaze,
    );
    __define__(name, renderFunc);
    Template[name] = getRegisteredTemplate(name);
  }

  try {
    const styleEl = document.createElement('style');
    styleEl.setAttribute('data-playground', 'true');
    styleEl.textContent = css;
    container.appendChild(styleEl);

    const appEl = document.createElement('div');
    appEl.setAttribute('data-playground-app', '');
    container.appendChild(appEl);

    compileAndRegister('demo', mainTemplate);
    for (const sub of subTemplates) {
      compileAndRegister(sub.name, sub.body);
    }

    const userFn = new Function('Template', 'reactive', 'registerHelper', js);
    userFn(Template, reactive, registerHelper);

    currentView = render(Template.demo, appEl);
    reactive.flush();
  } catch (e: any) {
    error.value = e.message || String(e);
    container.innerHTML =
      '<pre style="color:#cc3333;padding:1rem;font-family:monospace;white-space:pre-wrap;font-size:0.85rem;margin:0">' +
      String(e.message || e).replace(/</g, '&amp;lt;') +
      '</pre>';
  }
}

async function loadBlazeRuntime() {
  const [core, testing, compiler, spacebars, htmljs, templating, observeSeq] = await Promise.all([
    import('@blaze-ng/core'),
    import('@blaze-ng/core/testing'),
    import('@blaze-ng/spacebars-compiler'),
    import('@blaze-ng/spacebars'),
    import('@blaze-ng/htmljs'),
    import('@blaze-ng/templating-runtime'),
    import('@blaze-ng/observe-sequence'),
  ]);

  blazeRuntime = {
    Template: core.Template,
    View: core.View,
    Each: core.Each,
    If: core.If,
    Unless: core.Unless,
    With: core.With,
    Let: core.Let,
    _TemplateWith: core._TemplateWith,
    _InOuterTemplateScope: core._InOuterTemplateScope,
    render: core.render,
    remove: core.remove,
    setReactiveSystem: core.setReactiveSystem,
    registerHelper: core.registerHelper,
    SimpleReactiveSystem: testing.SimpleReactiveSystem,
    ObserveSequence: observeSeq.ObserveSequence,
    compile: compiler.compile,
    Spacebars: spacebars.Spacebars,
    HTML: htmljs.HTML,
    __define__: templating.__define__,
    getRegisteredTemplate: templating.getRegisteredTemplate,
    _resetRegistry: templating._resetRegistry,
  };
}

async function initEditors() {
  const [cm, { html }, { javascript }, { oneDark }] = await Promise.all([
    import('codemirror'),
    import('@codemirror/lang-html'),
    import('@codemirror/lang-javascript'),
    import('@codemirror/theme-one-dark'),
  ]);

  const { EditorView, basicSetup } = cm as any;

  cmModules = { EditorView, oneDark };

  const themeExt = isDark.value ? [oneDark] : [];

  const updateListener = (setter: (val: string) => void) =>
    EditorView.updateListener.of((update: any) => {
      if (update.docChanged) {
        setter(update.state.doc.toString());
        scheduleRun();
      }
    });

  if (templateEditorEl.value) {
    templateEditor = new EditorView({
      doc: templateCode.value,
      extensions: [
        basicSetup,
        ...themeExt,
        html(),
        EditorView.lineWrapping,
        updateListener((v) => (templateCode.value = v)),
      ],
      parent: templateEditorEl.value,
    });
  }

  if (jsEditorEl.value) {
    jsEditor = new EditorView({
      doc: jsCode.value,
      extensions: [
        basicSetup,
        ...themeExt,
        javascript(),
        EditorView.lineWrapping,
        updateListener((v) => (jsCode.value = v)),
      ],
      parent: jsEditorEl.value,
    });
  }

  if (cssEditorEl.value) {
    cssEditor = new EditorView({
      doc: cssCode.value,
      extensions: [
        basicSetup,
        ...themeExt,
        html(),
        EditorView.lineWrapping,
        updateListener((v) => (cssCode.value = v)),
      ],
      parent: cssEditorEl.value,
    });
  }
}

onMounted(async () => {
  const p = getPreset(props.preset) || presets[0];
  templateCode.value = props.template || p.template;
  jsCode.value = props.javascript || p.javascript;
  cssCode.value = props.css || p.css || '';

  await loadBlazeRuntime();
  await nextTick();
  await initEditors();
  runPreview();
});

onUnmounted(() => {
  if (debounceTimer) clearTimeout(debounceTimer);
  templateEditor?.destroy();
  jsEditor?.destroy();
  cssEditor?.destroy();
});

watch(isDark, async () => {
  const tpl = templateCode.value;
  const js = jsCode.value;
  const css = cssCode.value;
  templateEditor?.destroy();
  jsEditor?.destroy();
  cssEditor?.destroy();
  templateEditor = null;
  jsEditor = null;
  cssEditor = null;
  await nextTick();
  await initEditors();
  templateCode.value = tpl;
  jsCode.value = js;
  cssCode.value = css;
});

function resetToPreset() {
  loadPreset(activePreset.value);
}

const activeTab = ref<'template' | 'js' | 'css'>('template');
</script>

<template>
  <ClientOnly>
    <div class="playground" :class="{ 'playground-mini': mini }" :style="{ height }">
      <div class="playground-toolbar">
        <div class="toolbar-left">
          <span class="playground-title">{{
            mini ? '⚡ Try it live' : '⚡ Blaze Playground'
          }}</span>
          <select
            class="preset-select"
            :value="activePreset"
            @change="loadPreset(($event.target as HTMLSelectElement).value)"
          >
            <option v-for="p in presets" :key="p.name" :value="p.name">{{ p.label }}</option>
          </select>
        </div>
        <div class="toolbar-right">
          <button class="toolbar-btn" title="Reset" @click="resetToPreset">↺ Reset</button>
        </div>
      </div>
      <div class="playground-body">
        <div class="playground-editors">
          <div class="editor-tabs">
            <button
              class="editor-tab"
              :class="{ active: activeTab === 'template' }"
              @click="activeTab = 'template'"
            >
              Template
            </button>
            <button
              class="editor-tab"
              :class="{ active: activeTab === 'js' }"
              @click="activeTab = 'js'"
            >
              JavaScript
            </button>
            <button
              class="editor-tab"
              :class="{ active: activeTab === 'css' }"
              @click="activeTab = 'css'"
            >
              CSS
            </button>
          </div>
          <div
            class="editor-container"
            v-show="activeTab === 'template'"
            ref="templateEditorEl"
          ></div>
          <div class="editor-container" v-show="activeTab === 'js'" ref="jsEditorEl"></div>
          <div class="editor-container" v-show="activeTab === 'css'" ref="cssEditorEl"></div>
        </div>
        <div class="playground-preview">
          <div class="preview-header">Preview</div>
          <div ref="previewContainer" class="preview-container"></div>
          <div v-if="error" class="preview-error">{{ error }}</div>
        </div>
      </div>
    </div>
  </ClientOnly>
</template>
