'use strict';
// Parse + validate an issue body. Used by the workflows and by tests.
const crypto = require('crypto');
const { core, loadOptions } = require('./repo');
const { parseIssueBody } = require('./issue-parser');
const { createValidator } = require('./validate-entry');

/**
 * @param {string} body issue body (untrusted)
 * @param {{ issueNumber?: number, id?: string }} [opts]
 * @returns {{ ok: boolean, entry: object, problems: {field,label,message}[] }}
 */
function checkIssue(body, opts = {}) {
  const options = loadOptions();
  const { entry, errors } = parseIssueBody(body, options);
  const problems = [...errors];
  if (!errors.some((e) => e.field === '(issue)')) {
    if (core.isRealDate(entry.date || '')) {
      entry.id = opts.id || core.makeId(entry.date, (n) => crypto.randomBytes(n));
    }
    if (opts.issueNumber) entry.source_issue = opts.issueNumber;
    const validate = createValidator(options);
    for (const e of validate(entry)) {
      // An id problem is a consequence of a bad date; don't double-report.
      if (e.field === 'id' && !entry.id) continue;
      problems.push(e);
    }
  }
  const labelOf = (key) => {
    const f = core.fieldByKey(options, key);
    return f ? f.label : key === options.consent.key ? options.consent.label : key;
  };
  return {
    ok: problems.length === 0,
    entry,
    problems: problems.map((p) => ({ ...p, label: labelOf(p.field) }))
  };
}

module.exports = { checkIssue };
