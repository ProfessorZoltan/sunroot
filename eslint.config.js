import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'coverage'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': 'error',
    },
  },
  {
    // Working rule: the simulation is pure and deterministic. No clock, no
    // ambient randomness, no rendering or browser APIs.
    files: ['src/sim/**/*.ts'],
    languageOptions: { globals: {} },
    rules: {
      'no-restricted-globals': [
        'error',
        { name: 'Date', message: 'The simulation has no clock.' },
        { name: 'performance', message: 'The simulation has no clock.' },
        { name: 'setTimeout', message: 'The simulation has no clock.' },
        { name: 'setInterval', message: 'The simulation has no clock.' },
        { name: 'window', message: 'The simulation is headless.' },
        { name: 'document', message: 'The simulation is headless.' },
      ],
      'no-restricted-properties': [
        'error',
        { object: 'Math', property: 'random', message: 'Use the seeded Rng from src/sim/rng.ts.' },
      ],
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/render/**', '**/ui/**', 'pixi.js', 'preact', 'preact/*'],
              message: 'The simulation must not depend on rendering or UI.',
            },
          ],
        },
      ],
    },
  },
);
