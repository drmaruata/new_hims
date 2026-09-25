// Shared ESLint flat config for the HIMS monorepo.
//
// One rule set for every package, so a rule cannot be tightened in one package
// and quietly left off in another. Per-package `eslint.config.mjs` files are a
// few lines each: they pick a runtime, say whether the package has JSX, and
// re-export this. A rule change lands in one file and applies everywhere.
//
// Four deliberate choices:
//
//  * `tseslint.configs.recommended`, not `recommendedTypeChecked`. Type-aware
//    linting needs a project per file, and this repo has 14 of them, so
//    enabling it would give every package a second, separately configured
//    linter. Type errors are `tsc`'s job and it is much better at them; the
//    linter's value is the rules TypeScript has no opinion about: unused code,
//    hook misuse, unsafe escapes, floating promises.
//
//  * `eslint-config-prettier` is applied last, so it switches off every
//    formatting rule the recommended sets enable. Prettier owns formatting
//    here (`pnpm format`); two formatters disagreeing is a lint error that
//    never gets fixed, only suppressed.
//
//  * Unused vars and unused imports are errors. An unused import in a clinical
//    calculation path is a bug somebody meant to fix.
//
//  * `no-undef` is off for TypeScript. TS already resolves identifiers, and its
//    answer is authoritative; ESLint's is strictly worse and produces
//    duplicates. It stays on for plain JavaScript, which is what the repo's
//    build and codegen scripts are.
import js from '@eslint/js';
import nextConfig from 'eslint-config-next';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import unusedImports from 'eslint-plugin-unused-imports';
import prettier from 'eslint-config-prettier';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/**
 * Which global set applies to a package.
 *
 * Not cosmetic: a `process.env` read inside a React component is a
 * build-time constant inlined at compile time, so treating the browser runtime
 * as having `process` would type-check a credential leak.
 */
export const RUNTIMES = {
  /** NestJS API and the libraries it is built on. */
  node: 'node',
  /** Next.js client and server components. */
  browser: 'browser',
  /** Expo / React Native. */
  'react-native': 'react-native',
};

const RUNTIME_GLOBALS = {
  node: globals.node,
  browser: { ...globals.browser, ...globals.node },
  'react-native': { ...globals.es2021, ...globals.browser },
};

/**
 * Build the shared config for one package.
 *
 * @param {object} options
 * @param {'node' | 'browser' | 'react-native'} options.runtime Global set to
 *   apply.
 * @param {boolean} [options.react] Whether the package has JSX or React hooks.
 *   Enables the React, hooks and jsx-a11y rule sets.
 * @param {boolean} [options.next] Whether the package is a Next.js app.
 *   Requires `react` and adds Next's own rules, which know about the App
 *   Router, `next/link` and the core-web-vitals set.
 * @param {string[]} [options.extraIgnores] Package-specific paths to skip.
 * @returns {import('eslint').Linter.Config[]}
 */
export function himsConfig({ runtime, react: hasReact = false, next = false, extraIgnores = [] }) {
  const config = [
    {
      // Build output, caches and generated types. A glob picks `dist` up first,
      // so it has to be ignored even though no package commits it.
      ignores: [
        '**/dist/**',
        '**/build/**',
        '**/.next/**',
        '**/.expo/**',
        '**/.turbo/**',
        '**/coverage/**',
        '**/node_modules/**',
        ...extraIgnores,
      ],
    },

    js.configs.recommended,
    // Spread, not push: typescript-eslint's presets are arrays of flat configs,
    // and pushing one nests an array inside the config, which ESLint reports as
    // `TypeError: Unexpected array` from inside @eslint/config-array.
    ...tseslint.configs.recommended,

    {
      languageOptions: {
        globals: RUNTIME_GLOBALS[runtime],
        parserOptions: { ecmaFeatures: { jsx: hasReact } },
      },
    },

    {
      // The repo's own tooling: build scripts, config files, codegen. Genuinely
      // Node, and the only place `no-undef` stays switched on.
      files: ['**/*.{js,cjs,mjs}'],
      languageOptions: { globals: globals.node },
    },

    {
      files: ['**/*.{ts,tsx,mts,cts}'],
      rules: {
        // TypeScript resolves identifiers; see the header comment.
        'no-undef': 'off',
        // Replaced below by unused-imports/no-unused-vars, which understands
        // `import type` erasure. Core's rule does not, and neither does the
        // TypeScript plugin's copy of it — both are switched off so one rule
        // owns the question and each finding is reported once, with the
        // allowances below rather than the defaults.
        'no-unused-vars': 'off',
        '@typescript-eslint/no-unused-vars': 'off',
        'no-empty-function': 'off',
      },
    },

    {
      files: ['**/*.{ts,tsx,mts,cts}'],
      plugins: { 'unused-imports': unusedImports },
      rules: {
        'unused-imports/no-unused-imports': 'error',
        'unused-imports/no-unused-vars': [
          'error',
          {
            argsIgnorePattern: '^_',
            varsIgnorePattern: '^_',
            // An empty catch is how a best-effort side effect is written. The
            // swallow is the point, and a comment should say why.
            caughtErrors: 'none',
            // A destructured parameter is almost always a deliberate omission
            // in a positional callback, not a mistake.
            ignoreRestSiblings: true,
          },
        ],
        'no-empty': ['error', { allowEmptyCatch: true }],
        eqeqeq: ['error', 'smart'],
        'prefer-const': 'error',
        'no-var': 'error',
        'object-shorthand': 'error',
        'no-implicit-coercion': 'error',
        'no-param-reassign': 'error',
      },
    },
  ];

  // `eslint-config-next` already registers eslint-plugin-react,
  // -react-hooks and -jsx-a11y. Adding the same plugins again is an error
  // (`Cannot redefine plugin "jsx-a11y"`), not a merge, so the explicit React
  // block below is only for React packages that are *not* Next apps.
  if (hasReact && !next) {
    config.push(
      {
        files: ['**/*.{jsx,tsx}'],
        ...react.configs.flat.recommended,
        settings: { react: { version: 'detect' } },
        rules: {
          ...react.configs.flat.recommended.rules,
          // React 19 and every current bundler emit the automatic JSX runtime,
          // so `React` does not have to be in scope and the runtime import is a
          // build-time detail. The recommended set still carries the
          // classic-runtime pair, which fails on every file that correctly
          // omits it — every screen in the Expo apps, for instance.
          'react/jsx-uses-react': 'off',
          'react/react-in-jsx-scope': 'off',
          // Props are typed. `prop-types` would be a second, unchecked schema
          // for the same props, and one that nothing at runtime validates here.
          'react/prop-types': 'off',
        },
      },
      {
        files: ['**/*.{jsx,tsx}'],
        plugins: { 'react-hooks': reactHooks },
        rules: {
          // The plugin ships exhaustive-deps off by default: React Compiler
          // tracks dependencies itself, so enabling it produces false
          // positives on correctly written code. It stays opt-in.
          ...reactHooks.configs.recommended.rules,
        },
      },
      {
        files: ['**/*.{jsx,tsx}'],
        plugins: { 'jsx-a11y': jsxA11y },
        rules: { ...jsxA11y.flatConfigs.recommended.rules },
      },
    );
  }

  if (next) {
    // Imported at the top rather than lazily: a static import keeps this
    // function synchronous, and its cost is a dev-only config load. The rules
    // are only *applied* when `next` is set, so a Node package never gets
    // Next's rule set.
    config.push(
      ...nextConfig,
      {
        files: ['**/*.{ts,tsx}'],
        rules: {
          // Next's config assumes a single app root and resolves pages from
          // its own route manifest. This is a monorepo whose components are
          // published from @hims/ui, so the resolution rules cannot work and
          // report every workspace import as unresolved.
          'import/no-unresolved': 'off',
          '@next/next/no-html-link-for-pages': 'error',
          '@next/next/no-img-element': 'error',
        },
      },
    );
  }

  // Last, so it can switch off anything the recommended sets turned on.
  config.push(prettier);

  return config;
}
