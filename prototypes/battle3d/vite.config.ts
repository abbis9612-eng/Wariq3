import { defineConfig } from 'vite';
// المجسمات والأصوات والقوام تنقرا من ../theater (مجمّد، D-023) بدون نسخ
export default defineConfig({
  base: './',
  server: { fs: { allow: ['..'] } },
  build: {
    target: 'es2022', assetsInlineLimit: 0, chunkSizeWarningLimit: 9000,
    rollupOptions: { output: { inlineDynamicImports: true } },
  },
});
