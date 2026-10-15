'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { options } = require('./helpers');
const { checkOptions } = require('../scripts/validate');

test('options.json is internally consistent', () => {
  assert.deepEqual(checkOptions(options), []);
});

test('fields are in the specified order', () => {
  assert.deepEqual(options.fields.map((f) => f.key), [
    'date', 'assistant', 'assistant_other', 'model_version', 'account_type', 'task_domain', 'features_on',
    'custom_instructions', 'trigger_prompt', 'behavior_type', 'behavior_type_secondary', 'severity', 'excerpt',
    'chat_link', 'reproduced', 'notes'
  ]);
});

test('required fields match the spec', () => {
  assert.deepEqual(options.fields.filter((f) => f.required).map((f) => f.key), [
    'date', 'assistant', 'account_type', 'trigger_prompt', 'behavior_type', 'severity', 'excerpt', 'reproduced'
  ]);
  assert.equal(options.fields.find((f) => f.key === 'excerpt').maxLength, 1500);
});

test('behavior types use the exact labels', () => {
  assert.deepEqual(options.lists.behavior_type.map((o) => o.label), [
    'Instruction drift', 'Fabrication', 'Odd refusal / over-caution', 'Self-contradiction',
    'Caving / reversal under pushback', 'Identity / persona / tone'
  ]);
  for (const o of options.lists.behavior_type) assert.ok(o.definition.length > 20);
});

test('dropdown lists match the spec', () => {
  const L = (n) => options.lists[n].map((o) => o.label);
  assert.deepEqual(L('assistant'), ['ChatGPT', 'Claude', 'Claude Code', 'Codex', 'Copilot', 'Gemini', 'WoS RA', 'Other']);
  assert.deepEqual(L('account_type'), ['Paid', 'Free', 'Academic / Institutional']);
  assert.deepEqual(L('severity'), ['Minor', 'Moderate', 'Major']);
  assert.deepEqual(L('reproduced'), ['Reproduced', 'Not reproduced', 'Untested']);
  assert.deepEqual(L('task_domain'), ['Research', 'Reference / fact-check', 'Coding', 'Writing / editing', 'Data analysis', 'General chat', 'Other']);
});
