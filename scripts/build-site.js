#!/usr/bin/env node
'use strict';
// Assembles the deployable site in _site/:
//   docs/*                -> _site/
//   schema/options.json   -> _site/options.json
//   data/index.json, .csv -> _site/data/
//   site config           -> _site/config.json (repository slug for issue links)
// Run build-data first.
const fs = require('fs');
const path = require('path');
const { P, loadOptions } = require('./lib/repo');

function build() {
  const options = loadOptions();
  if (!fs.existsSync(P.index)) throw new Error('data/index.json missing; run `npm run build:data` first');
  fs.rmSync(P.site, { recursive: true, force: true });
  fs.cpSync(P.docs, P.site, { recursive: true });
  fs.mkdirSync(path.join(P.site, 'data'), { recursive: true });
  fs.copyFileSync(P.index, path.join(P.site, 'data', 'index.json'));
  fs.copyFileSync(P.csv, path.join(P.site, 'data', 'entries.csv'));
  fs.copyFileSync(P.options, path.join(P.site, 'options.json'));
  fs.copyFileSync(path.join(P.root, 'schema', 'entry.schema.json'), path.join(P.site, 'entry.schema.json'));
  // In Actions, GITHUB_REPOSITORY is "owner/repo", so the placeholder in
  // options.json never needs editing for the deployed site.
  const repo = /^[\w.-]+\/[\w.-]+$/.test(process.env.GITHUB_REPOSITORY || '') ? process.env.GITHUB_REPOSITORY : options.project.repository;
  fs.writeFileSync(path.join(P.site, 'config.json'), JSON.stringify({ repository: repo }, null, 2) + '\n');
  fs.writeFileSync(path.join(P.site, '.nojekyll'), '');
  return repo;
}

if (require.main === module) {
  const repo = build();
  console.log(`assembled _site/ (issue links -> ${repo})`);
}
module.exports = { build };
