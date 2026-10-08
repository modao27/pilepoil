import { readdirSync } from 'node:fs';
import js from '@eslint/js';
import ts from 'typescript-eslint';
import svelte from 'eslint-plugin-svelte';
import prettier from 'eslint-config-prettier';
import globals from 'globals';
import svelteConfig from './svelte.config.js';

/** Modules présents dans src/modules (un dossier = un module). */
const modules = readdirSync('src/modules', { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name);

/** Moteur pur : ni DOM, ni interface, ni stockage, ni three.js. */
const pure = [
  { group: ['svelte', 'svelte/*', 'three', 'three/*', 'idb', 'idb/*'], message: 'Le moteur est pur.' },
  {
    group: ['**/state/**', '**/storage/**', '**/render/**', '**/ui/**', '**/workers/**'],
    message: 'Le moteur ne dépend que de core.',
  },
];
const pureGlobals = ['error', 'window', 'document', 'localStorage', 'navigator', 'self'];

/** Hors d'un module, on n'en importe que le point d'entrée index.ts (engine.ts : seulement engines.ts). */
const onlyIndex = {
  regex: '(^|/)modules/[^/]+/(?!index([.]ts)?$)',
  message: 'Importer un module par son index.ts seulement.',
};

/** Un module n'importe jamais un autre module. */
const otherModules = (m) =>
  modules
    .filter((o) => o !== m)
    .map((o) => ({ regex: `(^|/)${o}(/|$)`, message: 'Un module n’importe jamais un autre module.' }));

export default ts.config(
  { ignores: ['dist/', 'node_modules/', 'legacy/', 'playwright-report/', 'test-results/', '**/*.local.ts'] },
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
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', ignoreRestSiblings: true }],
    },
  },
  {
    files: ['**/*.svelte', '**/*.svelte.ts'],
    languageOptions: { parserOptions: { parser: ts.parser, svelteConfig } },
  },
  {
    // Coquille : pas d'import interne d'un module (les tests, hors de src, le peuvent).
    files: ['src/**/*.{ts,svelte}'],
    ignores: ['src/modules/**'],
    rules: { 'no-restricted-imports': ['error', { patterns: [onlyIndex] }] },
  },
  {
    // Registre : seulement les index.ts des modules.
    files: ['src/modules/*.ts'],
    ignores: ['src/modules/engines.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: [{ regex: '^[.]/[^/]+/(?!index([.]ts)?$)', message: onlyIndex.message }] },
      ],
    },
  },
  {
    // Moteurs (importés par le worker) : seulement les engine.ts des modules, purs.
    files: ['src/modules/engines.ts'],
    languageOptions: { globals: { ...globals.es2022 } },
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            ...pure,
            { regex: '^[.]/[^/]+/(?!engine([.]ts)?$)', message: 'Le worker n’importe que les engine.ts.' },
          ],
        },
      ],
      'no-restricted-globals': pureGlobals,
    },
  },
  {
    files: ['src/core/**/*.ts'],
    languageOptions: { globals: { ...globals.es2022 } },
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: [...pure, { regex: '(^|/)modules(/|$)', message: 'core n’importe pas les modules.' }] },
      ],
      'no-restricted-globals': pureGlobals,
    },
  },
  ...modules.flatMap((m) => [
    {
      files: [`src/modules/${m}/**/*.{ts,svelte}`],
      ignores: [`src/modules/${m}/core/**`, `src/modules/${m}/engine.ts`],
      rules: { 'no-restricted-imports': ['error', { patterns: otherModules(m) }] },
    },
    {
      // Moteur du module et sa face exportée au worker.
      files: [`src/modules/${m}/core/**/*.ts`, `src/modules/${m}/engine.ts`],
      languageOptions: { globals: { ...globals.es2022 } },
      rules: {
        'no-restricted-imports': ['error', { patterns: [...pure, ...otherModules(m)] }],
        'no-restricted-globals': pureGlobals,
      },
    },
  ]),
);
