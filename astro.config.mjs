import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// Demo hébergée sur GitHub Pages. Remplacer site/base par le domaine définitif.
export default defineConfig({
  site: 'https://brico87.github.io',
  base: '/verny-charpente',
  integrations: [sitemap()],
});
