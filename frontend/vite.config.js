import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

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