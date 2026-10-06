import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import electron from 'vite-plugin-electron';
import renderer from 'vite-plugin-electron-renderer';
import { resolve } from 'path';
import { execSync } from 'child_process';

// Ensure preload is compiled to pure CommonJS (.cjs) using esbuild
function buildPreload() {
  try {
    execSync('npx esbuild electron/preload/index.ts --bundle --outfile=dist-electron/preload/index.cjs --platform=node --format=cjs --external:electron', { stdio: 'inherit' });
  } catch (err) {
    console.error('Failed to build preload script:', err);
  }
}

// Build once before vite configuration starts
buildPreload();

export default defineConfig({
  plugins: [
    react(),
    electron([
      {
        // Main process
        entry: 'electron/main/index.ts',
        onstart(args) {
          buildPreload();
          if (args.startup) {
            args.startup(['--inspect=5858', '.'], {
              env: {
                ...process.env,
                VITE_DEV_SERVER_URL: process.env.VITE_DEV_SERVER_URL,
              },
            });
          }
        },
        vite: {
          build: {
            sourcemap: true,
            minify: false,
            outDir: 'dist-electron/main',
            rollupOptions: {
              external: [
                'electron',
                'better-sqlite3',
                'pdf-parse',
                'mammoth',
                '@google/generative-ai',
              ],
            },
          },
        },
      },
    ]),
    renderer(),
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      external: ['better-sqlite3'],
    },
  },
});
