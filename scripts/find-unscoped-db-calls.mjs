// Find database calls that pass no tenant context.
//
// Development tool, not part of the build. `db.query(sql, params)` and
// `db.one(sql, params)` run with no `app.tenant_id` set, which under row-level
// security means zero rows — a bug that looks like "the data is missing" rather
// than like a security mistake. This lists every such call site.
//
//   node scripts/find-unscoped-db-calls.mjs
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOTS = process.argv.slice(2);
if (ROOTS.length === 0) {
  console.error('usage: node scripts/find-unscoped-db-calls.mjs <dir> [...dir]');
  process.exit(1);
}

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

let findings = 0;

for (const root of ROOTS) {
  for (const file of walk(root)) {
    const source = readFileSync(file, 'utf8');
    const call = /\b(?:this\.)?db\.(?:query|one)\(/g;

    for (let match = call.exec(source); match; match = call.exec(source)) {
      // Walk forward to the matching close paren so a call containing nested
      // parens — `db.query(`SELECT coalesce('(', $1)`)` — is counted correctly.
      let index = call.lastIndex;
      let depth = 1;
      while (index < source.length && depth > 0) {
        const char = source[index];
        if (char === '(') depth += 1;
        else if (char === ')') depth -= 1;
        index += 1;
      }

      const args = source.slice(call.lastIndex, index - 1);
      // A top-level comma means a third argument (the context) was supplied.
      const hasContext = args.split(',').length - 1 >= 2;

      if (!hasContext) {
        findings += 1;
        const line = source.slice(0, match.index).split('\n').length;
        const text = source.slice(match.index, index).replace(/\s+/g, ' ');
        console.log(`${file}:${line}  ${text.slice(0, 120)}`);
      }
    }
  }
}

console.log(`\n${findings} call site(s) with no tenant context`);
