// Copies the Analytics Engine glossary from a local cal-adapt-guidance checkout,
// so definitions in this app match the guidance site. Re-run after the
// glossary changes:
//   node scripts/sync-glossary.mjs [path/to/cal-adapt-guidance]
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const repo = resolve(process.argv[2] ?? "../cal-adapt-guidance");
const terms = JSON.parse(readFileSync(`${repo}/glossary/glossary-data.json`, "utf8"));
const out = Object.fromEntries(terms.map((t) => [t.slug, { term: t.term, definition: t.definition }]));
writeFileSync("src/data/glossary.json", JSON.stringify(out, null, 2) + "\n");
console.log(`Wrote ${terms.length} terms to src/data/glossary.json`);
