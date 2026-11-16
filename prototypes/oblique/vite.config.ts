import { defineConfig } from 'vite';
export default defineConfig({ base: './', server: { fs: { allow: ['..'] } }, build: { target: 'es2022', assetsInlineLimit: 0, chunkSizeWarningLimit: 9000 } });
