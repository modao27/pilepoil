import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  plugins: [svelte()],
  test: {
    include: ['tests/unit/**/*.test.ts', 'tests/parity/**/*.test.ts'],
    environment: 'node',
    passWithNoTests: true,
  },
});
