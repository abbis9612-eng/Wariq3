import { defineConfig } from 'vite';
export default defineConfig({
  base: './',
  assetsInclude: ['**/*.glb'],
  build: {
    target: 'es2022', assetsInlineLimit: 0, chunkSizeWarningLimit: 9000,
    // ملف JS واحد (للنشر كصفحة واحدة)؛ بالمشروع الحقيقي نستورد أجزاء Babylon اللي نحتاجها بس
    rollupOptions: { output: { inlineDynamicImports: true } },
  },
});
