import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import wasm from 'vite-plugin-wasm';

const PORT = 5173;

/**
 * Dev-only: relaxes the production CSP in index.html so Vite's HMR
 * websocket can connect and HMR-injected <style> tags can render.
 * Never runs in `vite build`.
 */
function devCspPlugin(): Plugin {
  return {
    name: 'todo-p2p:dev-csp',
    apply: 'serve',
    transformIndexHtml(html) {
      const connectDev = `connect-src 'self' ws://localhost:${PORT} http://localhost:${PORT};`;
      const styleDev = `style-src 'self' 'unsafe-inline';`;
      return html
        .replace(/connect-src 'self';/, connectDev)
        .replace(/style-src 'self';/, styleDev);
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), wasm(), devCspPlugin()],
  server: {
    host: true,
    port: PORT,
    strictPort: true,
    hmr: { clientPort: PORT },
  },
  build: {
    target: 'es2022',
    sourcemap: true,
  },
});
