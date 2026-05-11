import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY || env.CUSTOM_GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY || env.CUSTOM_GEMINI_API_KEY),
        'process.env.CUSTOM_GEMINI_API_KEY': JSON.stringify(env.CUSTOM_GEMINI_API_KEY),
        'process.env.MAPILLARY_ACCESS_TOKEN': JSON.stringify(env.MAPILLARY_ACCESS_TOKEN),
        'process.env.SITE_PASSWORD': JSON.stringify(env.SITE_PASSWORD || '')
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
