import { defineConfig } from 'vite';
// ملف JS واحد (Babylon يتقسم لمئات القطع بدونها) حتى يصير النشر أبسط
export default defineConfig({ base: './', server: { fs: { allow: ['..'] } }, build: { target: 'es2022', assetsInlineLimit: 0, chunkSizeWarningLimit: 9000, modulePreload: false, rollupOptions: { output: { inlineDynamicImports: true } } } });
