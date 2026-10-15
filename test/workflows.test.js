'use strict';
// Static security checks on .github/workflows/*.yml.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { P } = require('../scripts/lib/repo');

const dir = path.join(P.root, '.github', 'workflows');
const files = fs.readdirSync(dir).filter((f) => /\.ya?ml$/.test(f));
const load = (f) => ({ name: f, text: fs.readFileSync(path.join(dir, f), 'utf8'), doc: yaml.load(fs.readFileSync(path.join(dir, f), 'utf8')) });

// Expressions that expand to attacker-controlled text.
const UNTRUSTED = /\$\{\{[^}]*github\.event\.(issue\.(title|body)|comment\.body|pull_request\.(title|body|head\.ref|head\.label)|review\.body|head_commit\.message|commits)|\$\{\{[^}]*github\.head_ref/;

test('there are workflows to check', () => {
  assert.ok(files.length >= 4);
});

for (const f of files.map(load)) {
  test(`${f.name}: no untrusted text in expressions`, () => {
    assert.doesNotMatch(f.text, UNTRUSTED);
  });

  test(`${f.name}: run steps contain no expressions at all`, () => {
    for (const [jobName, job] of Object.entries(f.doc.jobs)) {
      for (const step of job.steps || []) {
        if (step.run) assert.doesNotMatch(step.run, /\$\{\{/, `${jobName}: ${step.run}`);
        if (step.with && step.with.script) assert.doesNotMatch(step.with.script, /\$\{\{/, `${jobName}: script`);
      }
    }
  });

  test(`${f.name}: actions are pinned to full commit SHAs`, () => {
    for (const job of Object.values(f.doc.jobs)) {
      for (const step of job.steps || []) {
        if (step.uses) assert.match(step.uses, /^[\w.-]+\/[\w.-]+@[0-9a-f]{40}$/, step.uses);
      }
    }
  });

  test(`${f.name}: declares top-level permissions and avoids pull_request_target`, () => {
    assert.ok(f.doc.permissions, 'top-level permissions block');
    assert.ok(!('pull_request_target' in (f.doc.on || f.doc[true] || {})), 'pull_request_target');
    assert.doesNotMatch(f.text, /permissions:\s*write-all/);
  });
}
