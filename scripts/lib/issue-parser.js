'use strict';
// Parses the Markdown body GitHub generates from the chat-incident issue form:
//
//   ### <Field label>
//
//   <value | _No response_>
//
// The body is untrusted user input. This module only does string slicing; it
// never evaluates, shells out, or renders anything. Values are normalized by
// entry-core (control/bidi characters stripped) and validated afterwards.
const { core } = require('./repo');

const MAX_BODY_LENGTH = 65536; // GitHub's own issue body limit
const EMPTY_VALUES = new Set(['_No response_', 'None']);

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * @returns {{ entry: object, consent: boolean, errors: {field,message}[] }}
 *   `errors` here are structural (missing/duplicate sections, size); run the
 *   entry validator on `entry` for field-level checks.
 */
function parseIssueBody(body, options) {
  const errors = [];
  if (typeof body !== 'string' || !body.trim()) {
    return { entry: {}, consent: false, errors: [{ field: '(issue)', message: 'The issue body is empty. Please use the "Report an incident" form.' }] };
  }
  if (body.length > MAX_BODY_LENGTH) {
    return { entry: {}, consent: false, errors: [{ field: '(issue)', message: `The issue body is longer than ${MAX_BODY_LENGTH} characters.` }] };
  }
  const text = body.replace(/\r\n?/g, '\n');
  const sections = [...options.fields.map((f) => ({ key: f.key, label: f.label })), { key: options.consent.key, label: options.consent.label }];

  // Locate every heading line that exactly matches a known label.
  const found = [];
  for (const s of sections) {
    const re = new RegExp('^### ' + escapeRe(s.label) + '[ \\t]*$', 'gm');
    const hits = [...text.matchAll(re)];
    if (hits.length === 0) {
      errors.push({ field: s.key, message: `Section "${s.label}" is missing. Please use the "Report an incident" form without removing headings.` });
    } else if (hits.length > 1) {
      // A user value containing a line like "### Severity" would make the
      // body ambiguous. Refuse rather than guess.
      errors.push({ field: s.key, message: `The heading "### ${s.label}" appears ${hits.length} times. Remove any lines in your text that start with "### ${s.label}".` });
    } else {
      found.push({ key: s.key, start: hits[0].index, end: hits[0].index + hits[0][0].length });
    }
  }
  found.sort((a, b) => a.start - b.start);

  const raw = {};
  found.forEach((s, i) => {
    const stop = i + 1 < found.length ? found[i + 1].start : text.length;
    raw[s.key] = text.slice(s.end, stop).replace(/^\n+|\s+$/g, '');
  });

  let consent = false;
  if (raw[options.consent.key] !== undefined) {
    const box = new RegExp('^- \\[[xX]\\] ' + escapeRe(options.consent.text) + '\\s*$', 'm');
    consent = box.test(raw[options.consent.key]);
    delete raw[options.consent.key];
  }
  if (!consent) errors.push({ field: options.consent.key, message: 'The consent box is not checked.' });

  for (const k of Object.keys(raw)) {
    if (EMPTY_VALUES.has(raw[k].trim())) raw[k] = '';
  }
  const entry = core.cleanEntry(raw, options);
  return { entry, consent, errors };
}

module.exports = { parseIssueBody, MAX_BODY_LENGTH };
