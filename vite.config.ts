import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    build: {
      // Render is configured to publish the `build/` directory.
      outDir: 'build',
      emptyOutDir: true,
      target: ['es2018', 'chrome64', 'edge79', 'firefox67', 'safari12'],
      cssTarget: 'chrome61',
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      port: 3000,
      host: true,
    },
  };
});
