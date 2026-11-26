import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // Caminhos relativos: o build funciona em qualquer subpasta (GitHub Pages, servidor estático).
  base: './',
  plugins: [react()],
  define: { __APP_VERSION__: JSON.stringify(process.env.npm_package_version ?? '1.4.2') },
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 4000,
    // Menos memória no build (computadores com pouca RAM): sem cálculo de gzip no relatório
    // e menos arquivos processados em paralelo.
    reportCompressedSize: false,
    sourcemap: false,
    rollupOptions: {
      maxParallelFileOps: 2,
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    css: { modules: { classNameStrategy: 'non-scoped' } },
  },
});
