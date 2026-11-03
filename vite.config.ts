import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import {defineConfig, loadEnv} from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  const appTarget = process.env.APP_TARGET; // 'clientes' | 'repartidores' | 'admin'

  let rollupInput: Record<string, string> = {
    main: path.resolve(__dirname, 'index.html'),
    clientes: path.resolve(__dirname, 'clientes.html'),
    repartidores: path.resolve(__dirname, 'repartidores.html'),
    admin: path.resolve(__dirname, 'admin.html'),
  };

  let outDir = 'dist';

  if (appTarget === 'clientes') {
    rollupInput = {
      clientes: path.resolve(__dirname, 'clientes.html'),
    };
    outDir = 'dist/clientes';
  } else if (appTarget === 'repartidores') {
    rollupInput = {
      repartidores: path.resolve(__dirname, 'repartidores.html'),
    };
    outDir = 'dist/repartidores';
  } else if (appTarget === 'admin') {
    rollupInput = {
      admin: path.resolve(__dirname, 'admin.html'),
    };
    outDir = 'dist/admin';
  }

  return {
    plugins: [
      react(), 
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.png', 'apple-touch-icon.png', 'logo.svg', 'pwa-192x192.png', 'pwa-512x512.png', 'pwa-maskable-512x512.png'],
        manifest: {
          id: appTarget ? `/${appTarget}` : '/',
          name: appTarget === 'repartidores' 
            ? 'Rayo Repartidores - Riders' 
            : appTarget === 'admin' 
              ? 'Rayo Administración - Master' 
              : 'Rayo Delivery - Clientes',
          short_name: appTarget === 'repartidores' 
            ? 'Rayo Rider' 
            : appTarget === 'admin' 
              ? 'Rayo Admin' 
              : 'Rayo Delivery',
          description: appTarget === 'repartidores' 
            ? 'Operaciones y entregas ultra-rápidas para repartidores' 
            : appTarget === 'admin' 
              ? 'Panel de control y administración general de Rayo Delivery' 
              : 'Delivery ultra-rápido de comida y productos para Guatemala',
          theme_color: '#000000',
          background_color: '#000000',
          display: 'standalone',
          orientation: 'portrait',
          start_url: '/',
          scope: '/',
          icons: [
            {
              src: '/pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any'
            },
            {
              src: '/pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any'
            },
            {
              src: '/pwa-maskable-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable'
            },
            {
              src: '/logo.svg',
              sizes: '512x512',
              type: 'image/svg+xml',
              purpose: 'any'
            }
          ]
        },
        workbox: {
          cacheId: `rayo-${appTarget || 'app'}`,
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}']
        },
        devOptions: {
          enabled: true
        }
      }),
      {
        name: 'html-entry-normalizer',
        closeBundle() {
          if (appTarget) {
            const targetHtml = path.resolve(__dirname, outDir, `${appTarget}.html`);
            const indexHtml = path.resolve(__dirname, outDir, 'index.html');
            if (fs.existsSync(targetHtml) && !fs.existsSync(indexHtml)) {
              fs.copyFileSync(targetHtml, indexHtml);
            }
          }
        }
      }
    ],
    build: {
      outDir,
      emptyOutDir: true,
      rollupOptions: {
        input: rollupInput,
      },
    },
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.APP_TARGET': JSON.stringify(appTarget || 'all'),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
