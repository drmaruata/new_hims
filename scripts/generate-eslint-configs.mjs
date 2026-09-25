// Generate the per-package `eslint.config.mjs` files.
//
// Every library package in this workspace has the same lint shape: server-side
// Node, no JSX. Writing the same six lines nine times is how one of them ends up
// on a different rule set, so the shape is generated from a single list and the
// generator is the review gate for "which packages are which kind".
//
//   node scripts/generate-eslint-configs.mjs
//
// Re-run it after adding a package, and after changing the *kind* of an existing
// one. Changing the rule set itself is `eslint.config.base.mjs` and needs no
// regeneration.
import { existsSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * The kinds of package the base config knows how to build. A new kind means a
 * new runtime in `RUNTIMES` first, then an entry here.
 */
const KINDS = {
  node: {
    options: "runtime: RUNTIMES.node",
    doc: 'server-side Node, no JSX',
  },
  'node-react': {
    options: "runtime: RUNTIMES.browser, react: true",
    doc: 'browser-rendered React library, no Next.js',
  },
  'react-native': {
    options: "runtime: RUNTIMES['react-native'], react: true",
    doc: 'Expo / React Native',
  },
  next: {
    options: 'runtime: RUNTIMES.browser, react: true, next: true',
    doc: 'Next.js app: browser runtime, JSX and Next own rules',
  },
};

/**
 * Every workspace package that has source to lint, and what kind it is.
 *
 * `@hims/ui` is `node-react` rather than plain `node` because it is rendered in
 * the browser and in Next server components, so it needs both global sets.
 */
const PACKAGES = {
  'apps/api': 'node',
  'apps/web': 'next',
  'apps/patient-mobile': 'react-native',
  'apps/clinician-mobile': 'react-native',
  'apps/worker': 'node',
  'apps/integration-worker': 'node',
  'packages/api-client': 'node',
  'packages/auth': 'node',
  'packages/clinical-safety': 'node',
  'packages/config': 'node',
  'packages/database': 'node',
  'packages/date-time': 'node',
  'packages/domain-types': 'node',
  'packages/localization': 'node',
  'packages/telemetry': 'node',
  'packages/ui': 'node-react',
  'packages/validation': 'node',
};

const template = (options, doc) => `// This package is ${doc}.
//
// The rule set itself lives in the workspace root so every package shares one
// set; see \`eslint.config.base.mjs\` for why.
import { himsConfig, RUNTIMES } from '../../eslint.config.base.mjs';

export default himsConfig({ ${options} });
`;

let written = 0;
for (const [pkgDir, kind] of Object.entries(PACKAGES)) {
  const dir = resolve(ROOT, pkgDir);
  if (!existsSync(dir)) {
    console.error(`  skipped ${pkgDir}: directory does not exist`);
    continue;
  }
  const { options, doc } = KINDS[kind];
  writeFileSync(resolve(dir, 'eslint.config.mjs'), template(options, doc));
  written++;
}

console.log(`wrote ${written} eslint.config.mjs file(s) from ${Object.keys(KINDS).length} kinds`);
