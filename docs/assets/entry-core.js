/*
 * Shared entry logic used by the browser (Contribute/Browse pages) and by the
 * Node scripts (validator, issue parser, CSV builder). Plain ES2020, no deps.
 * Everything here treats entry text as untrusted data: it is never evaluated
 * and the site only renders it via textContent.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.EntryCore = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var ID_RE = /^\d{4}-\d{2}-\d{2}-[a-z0-9]{6}$/;
  var DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
  var ID_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';
  // GitHub answers over-long URLs with "414 URI Too Long". The exact server
  // limit is undocumented; stay well below the commonly observed ~8 KB.
  var MAX_ISSUE_URL_LENGTH = 7000;

  /** Normalize newlines, drop control characters (keep \n and \t), trim. */
  function normalizeText(value) {
    if (value === undefined || value === null) return '';
    return String(value)
      .replace(/\r\n?/g, '\n')
      // eslint-disable-next-line no-control-regex
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F​‌‎‏‪-‮⁦-⁩﻿]/g, '')
      .trim();
  }

  /** Length in Unicode code points (matches JSON Schema maxLength semantics). */
  function charCount(value) {
    return Array.from(value || '').length;
  }

  function isRealDate(value) {
    if (!DATE_RE.test(value)) return false;
    var parts = value.split('-').map(Number);
    var d = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
    return d.getUTCFullYear() === parts[0] && d.getUTCMonth() === parts[1] - 1 && d.getUTCDate() === parts[2];
  }

  /** Allow one day of slack for time zones. */
  function isFutureDate(value, now) {
    var limit = new Date((now || new Date()).getTime() + 36 * 3600 * 1000).toISOString().slice(0, 10);
    return value > limit;
  }

  function listLabels(options, listName) {
    return (options.lists[listName] || []).map(function (o) { return o.label; });
  }

  function fieldByKey(options, key) {
    for (var i = 0; i < options.fields.length; i++) if (options.fields[i].key === key) return options.fields[i];
    return null;
  }

  function isRequired(field, entry) {
    if (field.required) return true;
    if (field.requiredIf) return entry[field.requiredIf.field] === field.requiredIf.equals;
    return false;
  }

  /**
   * Keep only known fields, normalize text, drop empty optional values.
   * Returns a new object in canonical field order.
   */
  function cleanEntry(raw, options) {
    var out = {};
    if (raw.id) out.id = normalizeText(raw.id);
    options.fields.forEach(function (f) {
      var v = normalizeText(raw[f.key]);
      if (v !== '') out[f.key] = v;
    });
    if (out.assistant !== 'Other') delete out.assistant_other;
    if (raw.example === true) out.example = true;
    if (Number.isInteger(raw.source_issue)) out.source_issue = raw.source_issue;
    return out;
  }

  /**
   * Field-level checks shared by the web form and the Node validator.
   * Returns [{ field, message }]. Does not check id (see validateId).
   */
  function validateFields(entry, options, now) {
    var errors = [];
    function err(field, message) { errors.push({ field: field, message: message }); }

    options.fields.forEach(function (f) {
      var v = entry[f.key];
      var present = v !== undefined && v !== null && v !== '';
      if (!present) {
        if (isRequired(f, entry)) {
          err(f.key, f.requiredIf ? f.label + ' is required when ' + fieldByKey(options, f.requiredIf.field).label + ' is ' + f.requiredIf.equals + '.' : f.label + ' is required.');
        }
        return;
      }
      if (typeof v !== 'string') { err(f.key, f.label + ' must be text.'); return; }
      if (f.type === 'dropdown') {
        var labels = listLabels(options, f.list);
        if (labels.indexOf(v) === -1) err(f.key, f.label + ' must be one of: ' + labels.join(', ') + '.');
      }
      if (f.type === 'date') {
        if (!isRealDate(v)) err(f.key, f.label + ' must be a real date in YYYY-MM-DD format.');
        else if (isFutureDate(v, now)) err(f.key, f.label + ' cannot be in the future.');
      }
      if (f.type === 'url') {
        var ok = false;
        try { ok = /^https:\/\/[^\s]+$/.test(v) && new URL(v).protocol === 'https:'; } catch (e) { ok = false; }
        if (!ok) err(f.key, f.label + ' must be a single https:// link.');
      }
      if (f.maxLength && charCount(v) > f.maxLength) {
        err(f.key, f.label + ' is ' + charCount(v).toLocaleString('en-US') + ' characters; the limit is ' + f.maxLength.toLocaleString('en-US') + '.');
      }
    });

    if (entry.assistant !== 'Other' && entry.assistant_other) {
      err('assistant_other', 'Assistant name (if Other) should be empty unless Assistant is Other.');
    }
    if (entry.behavior_type && entry.behavior_type_secondary && entry.behavior_type === entry.behavior_type_secondary) {
      err('behavior_type_secondary', 'Behavior type (secondary) must differ from the primary type.');
    }
    return errors;
  }

  function validateId(entry) {
    if (!ID_RE.test(entry.id || '')) return [{ field: 'id', message: 'id must look like YYYY-MM-DD-xxxxxx (6 lowercase letters/digits).' }];
    if (entry.date && entry.id.slice(0, 10) !== entry.date) return [{ field: 'id', message: 'id must start with the entry date (' + entry.date + ').' }];
    return [];
  }

  /** id = date + "-" + 6 random [a-z0-9]. randomBytes: function(n) -> Uint8Array. */
  function makeId(date, randomBytes) {
    var bytes = randomBytes(6);
    var s = '';
    for (var i = 0; i < 6; i++) s += ID_ALPHABET[bytes[i] % ID_ALPHABET.length];
    return date + '-' + s;
  }

  /**
   * Build a prefilled GitHub issue-form URL. Params are keyed by field id;
   * dropdown values must equal option labels exactly. If the URL would be too
   * long, the longest text fields are left out (largest first) and returned in
   * `omitted` so the UI can offer copy buttons for them.
   */
  function buildIssueUrl(entry, options, repo, maxLength) {
    var limit = maxLength || MAX_ISSUE_URL_LENGTH;
    var base = 'https://github.com/' + repo + '/issues/new';
    var title = issueTitle(entry, options);
    var keys = options.fields.map(function (f) { return f.key; }).filter(function (k) { return entry[k]; });
    var omitted = [];

    function make() {
      var parts = ['template=' + encodeURIComponent(options.project.issue_template), 'title=' + encodeURIComponent(title)];
      keys.forEach(function (k) {
        if (omitted.indexOf(k) === -1) parts.push(encodeURIComponent(k) + '=' + encodeURIComponent(entry[k]));
      });
      return base + '?' + parts.join('&');
    }

    var url = make();
    var droppable = options.fields
      .filter(function (f) { return (f.type === 'longtext' || f.type === 'text' || f.type === 'url') && entry[f.key]; })
      .sort(function (a, b) { return encodeURIComponent(entry[b.key]).length - encodeURIComponent(entry[a.key]).length; });
    while (url.length > limit && droppable.length) {
      omitted.push(droppable.shift().key);
      url = make();
    }
    return { url: url, omitted: omitted, tooLong: url.length > limit };
  }

  function issueTitle(entry, options) {
    var who = entry.assistant === 'Other' && entry.assistant_other ? entry.assistant_other : entry.assistant;
    return options.project.issue_title_prefix + ' ' + [who || '?', entry.behavior_type || '?', entry.date || '?'].join(' / ');
  }

  // CSV ---------------------------------------------------------------------

  function csvCell(value) {
    var s = value === undefined || value === null ? '' : String(value);
    // Neutralize spreadsheet formula injection (=, +, -, @, tab, CR).
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    if (/[",\n\r]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
    return s;
  }

  function csvColumns(options) {
    return ['id'].concat(options.fields.map(function (f) { return f.key; }));
  }

  /** Examples (example: true) are excluded. */
  function toCsv(entries, options) {
    var cols = csvColumns(options);
    var lines = [cols.join(',')];
    entries.filter(function (e) { return e.example !== true; }).forEach(function (e) {
      lines.push(cols.map(function (c) { return csvCell(e[c]); }).join(','));
    });
    return lines.join('\r\n') + '\r\n';
  }

  return {
    ID_RE: ID_RE,
    MAX_ISSUE_URL_LENGTH: MAX_ISSUE_URL_LENGTH,
    normalizeText: normalizeText,
    charCount: charCount,
    isRealDate: isRealDate,
    isFutureDate: isFutureDate,
    listLabels: listLabels,
    fieldByKey: fieldByKey,
    isRequired: isRequired,
    cleanEntry: cleanEntry,
    validateFields: validateFields,
    validateId: validateId,
    makeId: makeId,
    buildIssueUrl: buildIssueUrl,
    issueTitle: issueTitle,
    csvCell: csvCell,
    csvColumns: csvColumns,
    toCsv: toCsv
  };
});
