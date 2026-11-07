import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  // CCM public API (Paris team contract, /api/v1). Locally: their mock_server.py.
  // Set CCM_PUBLIC_API_URL / CCM_PUBLIC_API_TOKEN in frontend/.env to point at
  // another server. No VITE_ prefix, so the token never reaches the browser bundle.
  const ccmPublicApiUrl = env.CCM_PUBLIC_API_URL || 'http://127.0.0.1:5058';
  const ccmPublicApiToken = env.CCM_PUBLIC_API_TOKEN || 'demo-token';

  return {
    base: '/master/',
    plugins: [
      react({
        jsxRuntime: 'automatic',
        babel: {
          presets: ['@babel/preset-react'],
        },
      }),
    ],
    esbuild: {
      loader: 'jsx',
      include: /src\/.*\.js$/,
    },
    optimizeDeps: {
      esbuildOptions: {
        loader: {
          '.js': 'jsx',
        },
      },
    },
    server: {
      host: true,
      port: parseInt(env.VITE_PORT) || 5000,
      allowedHosts: ['erm-stag.systra.info'],
      proxy: {
        // Must stay above '/api': the first matching prefix wins.
        '/api/v1': {
          target: ccmPublicApiUrl,
          changeOrigin: true,
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq, req) => {
              // Add the token unless the caller sent one (the API console's token override).
              if (!req.headers.authorization) {
                proxyReq.setHeader('Authorization', `Bearer ${ccmPublicApiToken}`);
              }
            });
          },
        },
        '/api': {
          target: 'http://127.0.0.1:8000',
          changeOrigin: true,
        },
        '/common': {
          target: 'http://127.0.0.1:8000',
          changeOrigin: true,
        },
        '/verifyDbConnection': {
          target: 'http://127.0.0.1:8000',
          changeOrigin: true,
        },
        '/health': {
          target: 'http://127.0.0.1:8000',
          changeOrigin: true,
        },
        '/email': {
          target: 'http://127.0.0.1:8000',
          changeOrigin: true,
        },
        '/file': {
          target: 'http://127.0.0.1:8000',
          changeOrigin: true,
        },
        '/metrics': {
          target: 'http://127.0.0.1:8000',
          changeOrigin: true,
        },
      },
      https:
        env.USE_HTTPS === 'true'
          ? {
              key: env.VITE_SERVER_PRIVATE_KEY
                ? fs.readFileSync(path.resolve(env.VITE_SERVER_PRIVATE_KEY))
                : undefined,
              cert: env.VITE_SERVER_CERTIFICATE
                ? fs.readFileSync(path.resolve(env.VITE_SERVER_CERTIFICATE))
                : undefined,
              ca: env.VITE_SERVER_ROOT_CA
                ? fs.readFileSync(path.resolve(env.VITE_SERVER_ROOT_CA))
                : undefined,
            }
          : false,
        // Enforce TLS 1.3 only
        minVersion: 'TLSv1.3',
        maxVersion: 'TLSv1.3',
        // Optionally, specify modern ciphers
        ciphers: [
          'TLS_AES_256_GCM_SHA384',
          'TLS_CHACHA20_POLY1305_SHA256',
          'TLS_AES_128_GCM_SHA256'
        ].join(':')
    },
    preview: {
      host: true,
      port: parseInt(env.VITE_PORT) || 5000, // 👈 added for preview
    },
    build: {
      outDir: 'build',
      emptyOutDir: true,
    },
  };
});