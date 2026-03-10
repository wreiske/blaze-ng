import DefaultTheme from 'vitepress/theme';
import type { Theme } from 'vitepress';
import BlazePlayground from './components/BlazePlayground.vue';
import './playground.css';

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component('BlazePlayground', BlazePlayground);
  },
} satisfies Theme;
