import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  // Vite only exposes VITE_* variables to the client at build time. Render
  // deployments may provide the credentials under either naming convention,
  // so normalise them here before bundling.
  const env = loadEnv(mode, process.cwd(), '');
  const telegramToken =
    env.VITE_TELEGRAM_TOKEN || env.VITE_TELEGRAM_BOT_TOKEN || env.TELEGRAM_BOT_TOKEN || '';
  const telegramChatId = env.VITE_TELEGRAM_CHAT_ID || env.TELEGRAM_CHAT_ID || '';

  return {
    plugins: [react(), tailwindcss()],
    define: {
      'import.meta.env.VITE_TELEGRAM_TOKEN': JSON.stringify(telegramToken),
      'import.meta.env.VITE_TELEGRAM_CHAT_ID': JSON.stringify(telegramChatId),
    },
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
