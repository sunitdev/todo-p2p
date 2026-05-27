// Shared ESLint flat-config preset for todo-p2p.
// Consumed by /eslint.config.js at repo root.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default [
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/target/**',
      'apps/desktop/src-tauri/gen/**',
      'apps/mobile/**',
      // Generated wasm-bindgen glue (built by scripts/build-wasm.sh).
      'packages/iroh-wasm/pkg/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    },
  },
];
