import js from '@eslint/js';
import ts from 'typescript-eslint';
import svelte from 'eslint-plugin-svelte';
import prettier from 'eslint-config-prettier';
import globals from 'globals';
import svelteConfig from './svelte.config.js';

export default ts.config(
  { ignores: ['dist/', 'node_modules/', 'legacy/', 'playwright-report/', 'test-results/'] },
  js.configs.recommended,
  ...ts.configs.strict,
  ...svelte.configs.recommended,
  prettier,
  ...svelte.configs.prettier,
  {
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },
  {
    files: ['**/*.svelte', '**/*.svelte.ts'],
    languageOptions: { parserOptions: { parser: ts.parser, svelteConfig } },
  },
  {
    // Le moteur reste pur : ni DOM, ni interface, ni stockage, ni three.js.
    files: ['src/core/**/*.ts'],
    languageOptions: { globals: { ...globals.es2022 } },
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['svelte', 'svelte/*', 'three', 'three/*', 'idb', 'idb/*'], message: 'core est pur.' },
            {
              group: ['**/state/**', '**/storage/**', '**/render/**', '**/ui/**', '**/workers/**'],
              message: 'core ne dépend que de core.',
            },
          ],
        },
      ],
      'no-restricted-globals': ['error', 'window', 'document', 'localStorage', 'navigator', 'self'],
    },
  },
);
