'use strict';
// Runs the github-script entry points against a mock Octokit.
const test = require('node:test');
const assert = require('node:assert/strict');
const { fixture, issueBody, validEntry } = require('./helpers');
const intake = require('../scripts/workflows/issue-intake');
const approve = require('../scripts/workflows/issue-approve');
const { createValidator } = require('../scripts/lib/validate-entry');

function mockGithub({ permission = 'write', existingComments = [], openPrs = [] } = {}) {
  const calls = [];
  const rec = (name, ret) => async (args) => { calls.push({ name, args }); return { data: typeof ret === 'function' ? ret(args) : ret }; };
  const github = {
    paginate: async (fn, args) => (await fn(args)).data,
    rest: {
      issues: {
        listComments: rec('listComments', existingComments),
        createComment: rec('createComment', {}),
        updateComment: rec('updateComment', {}),
        addLabels: rec('addLabels', {}),
        removeLabel: async (args) => { calls.push({ name: 'removeLabel', args }); const e = new Error('nf'); e.status = 404; throw e; },
        update: rec('update', {})
      },
      repos: {
        getCollaboratorPermissionLevel: rec('getPermission', { permission, role_name: permission }),
        createOrUpdateFileContents: rec('createFile', { commit: { sha: 'abc' } })
      },
      git: {
        getRef: rec('getRef', { object: { sha: 'base-sha' } }),
        createRef: rec('createRef', {}),
        updateRef: rec('updateRef', {})
      },
      pulls: {
        list: rec('listPulls', openPrs),
        create: rec('createPull', { number: 99 })
      }
    }
  };
  return { github, calls };
}

function ctx(body, { labels = ['submission'], sender = 'maint', number = 5 } = {}) {
  return {
    repo: { owner: 'o', repo: 'r' },
    payload: {
      issue: { number, body, labels: labels.map((name) => ({ name })) },
      sender: { login: sender },
      repository: { default_branch: 'main' }
    }
  };
}
const core = { info() {}, setFailed(m) { this.failed = m; }, failed: null };
const names = (calls) => calls.map((c) => c.name);

test('intake: valid issue -> needs-review + success comment', async () => {
  const { github, calls } = mockGithub();
  await intake({ github, context: ctx(fixture('issue-valid.md')), core });
  const add = calls.find((c) => c.name === 'addLabels');
  assert.deepEqual(add.args.labels, ['needs-review']);
  const comment = calls.find((c) => c.name === 'createComment');
  assert.ok(comment.args.body.startsWith(intake.MARKER));
  assert.match(comment.args.body, /Automatic checks passed/);
});

test('intake: invalid issue -> invalid label, problems listed, no user text echoed', async () => {
  const { github, calls } = mockGithub();
  const body = issueBody(validEntry({ severity: '<img src=x onerror=alert(1)>', excerpt: '@everyone ' + 'x'.repeat(2000) }), { consent: false });
  await intake({ github, context: ctx(body), core });
  assert.deepEqual(calls.find((c) => c.name === 'addLabels').args.labels, ['invalid']);
  const text = calls.find((c) => c.name === 'createComment').args.body;
  assert.match(text, /\*\*Severity\*\*/);
  assert.match(text, /\*\*Excerpt\*\*/);
  assert.match(text, /\*\*Consent\*\*/);
  assert.doesNotMatch(text, /onerror|@everyone|xxxxxxxx/);
});

test('intake: malicious fixture never leaks payload into the comment', async () => {
  const { github, calls } = mockGithub();
  await intake({ github, context: ctx(fixture('issue-malicious.md')), core });
  const text = calls.find((c) => c.name === 'createComment').args.body;
  assert.doesNotMatch(text, /curl|script|secrets|evil|DROP/);
});

test('intake: updates its existing comment instead of adding another', async () => {
  const { github, calls } = mockGithub({ existingComments: [{ id: 1, user: { type: 'Bot' }, body: intake.MARKER + '\nold' }] });
  await intake({ github, context: ctx(fixture('issue-valid.md')), core });
  assert.ok(names(calls).includes('updateComment'));
  assert.ok(!names(calls).includes('createComment'));
});

test('intake: skips issues already approved', async () => {
  const { github, calls } = mockGithub();
  await intake({ github, context: ctx(fixture('issue-valid.md'), { labels: ['submission', 'approved'] }), core });
  assert.deepEqual(calls, []);
});

test('approve: sender without write access -> label removed, nothing created', async () => {
  for (const permission of ['read', 'triage', 'none']) {
    const { github, calls } = mockGithub({ permission });
    const c = { ...core, failed: null };
    await approve({ github, context: ctx(fixture('issue-valid.md'), { labels: ['submission', 'approved'] }), core: c });
    assert.ok(c.failed, permission);
    assert.ok(names(calls).includes('removeLabel'));
    assert.ok(!names(calls).some((n) => ['createFile', 'createPull', 'createRef'].includes(n)), permission);
  }
});

test('approve: maintainer -> branch, valid entry file, PR, comment, close', async () => {
  const { github, calls } = mockGithub({ permission: 'maintain' });
  await approve({ github, context: ctx(fixture('issue-malicious.md'), { labels: ['submission', 'approved'], number: 12 }), core: { ...core } });
  assert.deepEqual(names(calls).filter((n) => n !== 'removeLabel'),
    ['getPermission', 'listPulls', 'getRef', 'createRef', 'createFile', 'createPull', 'createComment', 'update']);
  const ref = calls.find((c) => c.name === 'createRef').args;
  assert.equal(ref.ref, 'refs/heads/entry/issue-12');
  const file = calls.find((c) => c.name === 'createFile').args;
  assert.match(file.path, /^data\/entries\/2026-09-30-[a-z0-9]{6}\.json$/);
  const entry = JSON.parse(Buffer.from(file.content, 'base64').toString('utf8'));
  assert.deepEqual(createValidator()(entry), []);
  assert.equal(entry.source_issue, 12);
  assert.equal(file.path, `data/entries/${entry.id}.json`);
  const pr = calls.find((c) => c.name === 'createPull').args;
  for (const s of [pr.title, pr.body, file.message]) assert.doesNotMatch(s, /curl|script|evil|secrets/);
  assert.deepEqual(calls.find((c) => c.name === 'update').args, { owner: 'o', repo: 'r', issue_number: 12, state: 'closed', state_reason: 'completed' });
});

test('approve: invalid submission -> not approved, labeled invalid', async () => {
  const { github, calls } = mockGithub();
  const c = { ...core, failed: null };
  await approve({ github, context: ctx(issueBody(validEntry({ severity: 'nope' }))), core: c });
  assert.ok(c.failed);
  assert.deepEqual(calls.find((x) => x.name === 'addLabels').args.labels, ['invalid']);
  assert.ok(!names(calls).includes('createPull'));
});

test('approve: commit mode writes straight to the default branch', async () => {
  const { github, calls } = mockGithub();
  process.env.APPROVAL_MODE = 'commit';
  try {
    await approve({ github, context: ctx(fixture('issue-valid.md')), core: { ...core } });
  } finally {
    delete process.env.APPROVAL_MODE;
  }
  assert.equal(calls.find((c) => c.name === 'createFile').args.branch, 'main');
  assert.ok(!names(calls).includes('createPull'));
});

test('approve: open PR already exists -> no duplicate', async () => {
  const { github, calls } = mockGithub({ openPrs: [{ number: 3 }] });
  await approve({ github, context: ctx(fixture('issue-valid.md')), core: { ...core } });
  assert.ok(!names(calls).includes('createPull'));
  assert.ok(!names(calls).includes('update'));
});
