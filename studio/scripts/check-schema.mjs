/**
 * Fails if a schema references a document type that is not registered.
 *
 * WHY THIS EXISTS. `sanity build` compiles the Studio without resolving type
 * references, so a reference field pointing at an unregistered type builds
 * clean, deploys clean, and then shows the editor a red "Schema errors /
 * Unknown type" screen instead of the Studio. There is no earlier signal.
 *
 * That happened. `service.ts` was written and never added to the array in
 * `schemas/index.ts`, so the type did not exist as far as the Studio was
 * concerned. Every reference to it — the disciplines' `services`, a service's
 * own `related` — dangled, and the whole Studio refused to load. The website
 * was fine throughout, because the documents were written straight to the API
 * and the site reads them over GROQ. Only the editing UI broke, which is the
 * half nobody builds locally.
 *
 * It also checks FIELD GROUPS, for the same reason and after the same
 * failure: the shared `seoFields` all carry `group: 'seo'`, and `role.ts`
 * already had a groups array of its own, so the step that added the tab to
 * the other schemas skipped it. Sanity builds that happily and then throws
 * "Field group 'seo' is not defined in schema for type 'role'" at runtime —
 * again with the whole Studio down, and again invisible to every check that
 * only looks at the website.
 *
 * Reads the files as TEXT rather than importing them: `schemas/index.ts` uses
 * extensionless imports, which bundlers accept and Node's ESM resolver does
 * not. A regex over our own source is the cheap, dependency-free option, and
 * it only has to be right about two patterns.
 */
import { readdir, readFile } from 'node:fs/promises';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCHEMAS = join(dirname(fileURLToPath(import.meta.url)), '..', 'schemas');

const files = (await readdir(SCHEMAS)).filter((f) => f.endsWith('.ts') && f !== 'index.ts');
const index = await readFile(join(SCHEMAS, 'index.ts'), 'utf8');

/* Which identifiers actually made it into the exported array. An import alone
   is not registration — that is exactly the mistake this guards against. */
const arrayBody = index.slice(index.indexOf('export const schemaTypes'));
const registeredIdents = new Set(
  [...arrayBody.matchAll(/^\s{2}([A-Za-z_$][\w$]*),\s*$/gm)].map((m) => m[1])
);
const spreadsBlocks = /\.\.\.blockTypes/.test(arrayBody);

/* Every type each file defines, every type it references, and every field
   group it declares or uses. */
const defined = new Map(); // typeName -> file
const referenced = []; // { type, where }
const groupsDeclared = new Map(); // file -> Set of group names
const groupsUsed = new Map(); // file -> Set of group names

for (const file of files) {
  const src = await readFile(join(SCHEMAS, file), 'utf8');
  const ident = basename(file, '.ts');

  for (const m of src.matchAll(/defineType\(\{\s*\n\s*name:\s*'([^']+)'/g)) {
    defined.set(m[1], { file, ident });
  }
  for (const m of src.matchAll(/to:\s*\[\s*\{\s*type:\s*'([^']+)'/g)) {
    referenced.push({ type: m[1], where: file });
  }

  /* Groups this file declares in its `groups:` array. */
  const declared = new Set();
  const groupsBlock = /groups:\s*\[([\s\S]*?)\n\s*\],/.exec(src);
  if (groupsBlock) {
    for (const m of groupsBlock[1].matchAll(/name:\s*'([^']+)'/g)) declared.add(m[1]);
  }
  groupsDeclared.set(file, declared);

  /* Groups any field in this file claims membership of. */
  const used = new Set();
  for (const m of src.matchAll(/^\s*group:\s*'([^']+)'/gm)) used.add(m[1]);

  /*
   * The shared field helpers carry their own `group`, so a schema that
   * spreads one inherits that requirement without the word appearing
   * anywhere in its own text. That is exactly how `role.ts` ended up with
   * SEO fields pointing at a group it had never declared.
   */
  for (const [helper, group] of Object.entries({ seoFields: 'seo' })) {
    if (src.includes('...' + helper)) used.add(group);
  }

  groupsUsed.set(file, used);
}

/* A type counts as registered if its file's default export is in the array,
   or if it comes from blocks.ts and the array spreads blockTypes. */
const isRegistered = (typeName) => {
  const d = defined.get(typeName);
  if (!d) return false;
  if (d.ident === 'blocks') return spreadsBlocks;
  return registeredIdents.has(d.ident);
};

const problems = [];
for (const { type, where } of referenced) {
  if (!defined.has(type)) {
    problems.push(`${where}: references "${type}", which no schema defines.`);
  } else if (!isRegistered(type)) {
    const d = defined.get(type);
    problems.push(
      `${where}: references "${type}", defined in ${d.file} but NOT listed in schemas/index.ts.`
    );
  }
}

/* A file that defines a document type nobody registered is almost always the
   same mistake caught one step earlier. */
for (const [typeName, d] of defined) {
  if (d.ident === 'blocks' || d.ident === 'seoFields') continue;
  if (!registeredIdents.has(d.ident)) {
    problems.push(`${d.file}: defines "${typeName}" but is not in schemas/index.ts — it will not appear in the Studio.`);
  }
}

/* A field pointing at a group the schema never declared takes the Studio
   down as surely as a dangling reference does. */
for (const [file, used] of groupsUsed) {
  /* The shared helpers are field fragments, not schemas — they legitimately
     name a group they do not declare, because the schema that spreads them
     is what declares it. Checking them would flag the fix as the bug. */
  if (file === 'seoFields.ts') continue;

  const declared = groupsDeclared.get(file) ?? new Set();
  /* A schema with no groups at all is fine; `group` is simply ignored. It is
     the half-configured case — some groups declared, one missing — that
     brings the Studio down. */
  if (declared.size === 0) continue;
  for (const g of used) {
    if (!declared.has(g)) {
      problems.push(`${file}: fields use group "${g}", which its groups array does not declare.`);
    }
  }
}

if (problems.length) {
  console.error('\nSchema problems — the Studio would fail to load:\n');
  for (const p of [...new Set(problems)]) console.error('  ' + p);
  console.error(
    '\nWriting a schema file is not enough. It has to be imported in\n' +
      'schemas/index.ts AND added to the schemaTypes array.\n'
  );
  process.exit(1);
}

console.log(`Schema OK — ${defined.size} types, every reference resolves.`);
