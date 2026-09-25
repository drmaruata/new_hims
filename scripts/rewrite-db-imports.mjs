// Point every `apps/api` import of the database service at `@hims/database`.
//
// Development tool, run once when the service was extracted from
// `apps/api/src/core/database` into a shared package. It rewrites the three
// specifier shapes the API used, and refuses to touch anything else, so a
// re-run after the migration is a no-op rather than a second migration.
//
//   node scripts/rewrite-db-imports.mjs
//
// Kept in the repo rather than discarded: the next time a shared type moves
// between packages, the same three-line diff has to be applied across thirty
// files, and doing it by hand is how one gets missed.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = 'apps/api/src';

/** [pattern, replacement] pairs, applied in order. */
const REWRITES = [
  // Any relative specifier that ends in `database/database.{service,module}.js`,
  // with an optional `core/` segment and any number of `../` before it. Matching
  // the tail rather than the full path is what makes this robust to a file
  // moving between directories — which is the whole reason this is a script and
  // not a thirty-line find-and-replace done by hand.
  [
    /(['"])(?:\.\.\/|\.\/)*(?:core\/)?database\/database\.(?:service|module)\.js\1/g,
    "$1@hims/database$1",
  ],
];

function* walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walk(full);
    } else if (entry.name.endsWith('.ts')) {
      yield full;
    }
  }
}

let changedFiles = 0;

for (const file of walk(ROOT)) {
  const before = readFileSync(file, 'utf8');
  let after = before;

  for (const [pattern, replacement] of REWRITES) {
    after = after.replace(pattern, replacement);
  }

  if (after !== before) {
    writeFileSync(file, after);
    changedFiles += 1;
    console.log(`rewrote ${file}`);
  }
}

console.log(`\n${changedFiles} file(s) rewritten`);
