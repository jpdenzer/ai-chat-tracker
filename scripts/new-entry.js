#!/usr/bin/env node
'use strict';
// Interactive CLI: prompts for each field (choices come from options.json),
// validates, and writes data/entries/<id>.json.
// Usage: npm run new-entry            (or: node scripts/new-entry.js --out data/examples)
// Long text: type it on one line, using \n for line breaks.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const readline = require('readline/promises');
const { P, core, loadOptions, serializeEntry } = require('./lib/repo');
const { createValidator } = require('./lib/validate-entry');

async function main() {
  const options = loadOptions();
  const validate = createValidator(options);
  const outIdx = process.argv.indexOf('--out');
  const outDir = outIdx > -1 ? path.resolve(process.argv[outIdx + 1]) : P.entries;
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  console.log(`\n${options.project.name}: new entry\n`);
  console.log(`PRIVACY: ${options.privacy_warning}\n`);

  const entry = {};
  for (const f of options.fields) {
    if (f.requiredIf && entry[f.requiredIf.field] !== f.requiredIf.equals) continue;
    const req = core.isRequired(f, entry);
    for (;;) {
      let answer;
      if (f.type === 'dropdown') {
        const labels = core.listLabels(options, f.list);
        console.log(`\n${f.label}${req ? ' *' : ''}: ${f.help}`);
        labels.forEach((l, i) => console.log(`  ${i + 1}. ${l}`));
        const raw = (await rl.question(req ? '> number: ' : '> number (Enter to skip): ')).trim();
        answer = raw === '' ? '' : labels[Number(raw) - 1];
        if (answer === undefined) { console.log('  Pick a number from the list.'); continue; }
      } else {
        const limit = f.maxLength ? ` [max ${f.maxLength} chars]` : '';
        answer = (await rl.question(`\n${f.label}${req ? ' *' : ''}${limit}: ${f.help}\n> `)).replace(/\\n/g, '\n');
      }
      entry[f.key] = core.normalizeText(answer);
      const errs = core.validateFields(core.cleanEntry(entry, options), options).filter((e) => e.field === f.key);
      if (errs.length) { errs.forEach((e) => console.log('  ✗ ' + e.message)); continue; }
      break;
    }
  }

  const consent = (await rl.question(`\n${options.consent.text} (yes/no) `)).trim().toLowerCase();
  rl.close();
  if (consent !== 'yes' && consent !== 'y') {
    console.log('Not saved: consent is required.');
    process.exit(1);
  }

  const clean = core.cleanEntry(entry, options);
  clean.id = core.makeId(clean.date, (n) => crypto.randomBytes(n));
  const errors = validate(clean);
  if (errors.length) {
    errors.forEach((e) => console.error(`✗ ${e.field}: ${e.message}`));
    process.exit(1);
  }
  fs.mkdirSync(outDir, { recursive: true });
  const file = path.join(outDir, `${clean.id}.json`);
  fs.writeFileSync(file, serializeEntry(clean, options), { flag: 'wx' });
  console.log(`\n✓ wrote ${path.relative(process.cwd(), file)}\nNext: npm test, then commit and open a pull request.`);
}

main().catch((e) => { console.error(e.message); process.exit(1); });
