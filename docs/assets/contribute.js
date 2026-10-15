(function () {
  'use strict';
  var el = Site.el;
  var C = EntryCore;
  var DRAFT_KEY = 'entry-draft';
  var cfg = null;
  var touched = {};

  function $(id) { return document.getElementById(id); }
  function ctl(key) { return $('fld-' + key); }

  function today() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  // Build the form from options.json -------------------------------------------
  function buildField(f) {
    var id = 'fld-' + f.key;
    var helpId = id + '-help', errId = id + '-err';
    var required = !!f.required;
    var describedBy = helpId + ' ' + errId;
    var control;
    if (f.type === 'dropdown') {
      control = el('select', { id: id, name: f.key, required: required, 'aria-describedby': describedBy },
        [el('option', { value: '', text: required ? 'Choose…' : '(none)' })].concat(
          cfg.options.lists[f.list].map(function (o) { return el('option', { value: o.label, text: o.label }); })));
    } else if (f.type === 'longtext') {
      control = el('textarea', { id: id, name: f.key, required: required, rows: f.key === 'excerpt' || f.key === 'trigger_prompt' ? '7' : '4', 'aria-describedby': describedBy + (f.maxLength ? ' ' + id + '-count' : ''), spellcheck: 'true' });
    } else {
      control = el('input', {
        id: id, name: f.key, required: required, 'aria-describedby': describedBy,
        type: f.type === 'date' ? 'date' : f.type === 'url' ? 'url' : 'text',
        max: f.type === 'date' ? today() : null,
        placeholder: f.placeholder || null,
        inputmode: f.type === 'url' ? 'url' : null,
        autocomplete: 'off'
      });
    }
    var help = f.help;
    if (f.list === 'behavior_type' && f.key === 'behavior_type') help += ' See definitions below the field.';
    var children = [
      el('label', { for: id }, [f.label, required ? el('span', { class: 'req', 'aria-hidden': 'true', text: ' *' }) : null, required ? el('span', { class: 'visually-hidden', text: ' (required)' }) : null]),
      el('p', { class: 'help', id: helpId, text: help }),
      control
    ];
    if (f.maxLength && f.type === 'longtext') children.push(el('div', { class: 'counter', id: id + '-count', 'aria-live': 'polite' }));
    children.push(el('p', { class: 'error', id: errId, hidden: true }));
    if (f.key === 'behavior_type') {
      children.push(el('details', null, [
        el('summary', { text: 'Behavior type definitions' }),
        el('dl', { class: 'detail-list' }, cfg.options.lists.behavior_type.reduce(function (acc, o) {
          return acc.concat([el('dt', { text: o.label }), el('dd', { text: o.definition })]);
        }, []))
      ]));
    }
    if (f.key === 'severity') {
      children.push(el('details', null, [
        el('summary', { text: 'Severity definitions' }),
        el('dl', { class: 'detail-list' }, cfg.options.lists.severity.reduce(function (acc, o) {
          return acc.concat([el('dt', { text: o.label }), el('dd', { text: o.definition })]);
        }, []))
      ]));
    }
    var wide = f.type === 'longtext' || f.type === 'url';
    return el('div', { class: 'field' + (wide ? ' full' : ''), id: 'wrap-' + f.key }, children);
  }

  function buildForm() {
    var container = $('fields');
    container.replaceChildren.apply(container, cfg.options.fields.map(buildField));
    var c = cfg.options.consent;
    $('consent-wrap').replaceChildren(
      el('div', { class: 'field' }, [
        el('label', { class: 'check', for: 'fld-consent' }, [
          el('input', { type: 'checkbox', id: 'fld-consent', name: 'consent', required: true, 'aria-describedby': 'fld-consent-err' }),
          el('span', null, [el('strong', { text: c.text }), el('span', { class: 'req', 'aria-hidden': 'true', text: ' *' })])
        ]),
        el('p', { class: 'error', id: 'fld-consent-err', hidden: true })
      ])
    );
  }

  // Read / validate --------------------------------------------------------------
  function readRaw() {
    var raw = {};
    cfg.options.fields.forEach(function (f) { raw[f.key] = ctl(f.key).value; });
    return raw;
  }

  function currentEntry() {
    return C.cleanEntry(readRaw(), cfg.options);
  }

  function validateAll() {
    var entry = currentEntry();
    var errors = C.validateFields(entry, cfg.options);
    if (!$('fld-consent').checked) errors.push({ field: 'consent', message: 'Please confirm the consent statement.' });
    // A date input with unparseable text reports an empty value; say so plainly.
    var dateCtl = ctl('date');
    if (dateCtl.validity && dateCtl.validity.badInput) {
      errors = errors.filter(function (e) { return e.field !== 'date'; });
      errors.unshift({ field: 'date', message: 'Date must be a real date in YYYY-MM-DD format.' });
    }
    return { entry: entry, errors: errors };
  }

  function showFieldErrors(errors, onlyTouched) {
    var byField = {};
    errors.forEach(function (e) { (byField[e.field] = byField[e.field] || []).push(e.message); });
    cfg.options.fields.map(function (f) { return f.key; }).concat(['consent']).forEach(function (k) {
      var input = $('fld-' + k);
      var err = $('fld-' + k + '-err');
      var msgs = onlyTouched && !touched[k] ? null : byField[k];
      if (msgs) {
        err.textContent = msgs.join(' ');
        err.hidden = false;
        input.setAttribute('aria-invalid', 'true');
      } else {
        err.textContent = '';
        err.hidden = true;
        input.removeAttribute('aria-invalid');
      }
    });
  }

  function showSummary(errors) {
    var box = $('error-summary');
    if (!errors.length) { box.hidden = true; return; }
    var list = $('error-list');
    list.replaceChildren.apply(list, errors.map(function (e) {
      return el('li', null, [el('a', { href: '#fld-' + e.field, text: e.message, onclick: function (ev) { ev.preventDefault(); $('fld-' + e.field).focus(); } })]);
    }));
    box.hidden = false;
    box.focus();
  }

  function updateConditional() {
    var show = ctl('assistant').value === 'Other';
    var wrap = $('wrap-assistant_other');
    wrap.hidden = !show;
    ctl('assistant_other').required = show;
    if (!show) ctl('assistant_other').value = '';
  }

  function updateCounters() {
    cfg.options.fields.forEach(function (f) {
      var counter = $('fld-' + f.key + '-count');
      if (!counter) return;
      var n = C.charCount(C.normalizeText(ctl(f.key).value));
      counter.textContent = n.toLocaleString('en-US') + ' / ' + f.maxLength.toLocaleString('en-US') + ' characters' + (n > f.maxLength ? ' (' + (n - f.maxLength).toLocaleString('en-US') + ' over the limit)' : '');
      counter.classList.toggle('over', n > f.maxLength);
    });
  }

  // Draft (sessionStorage only; this tab) ----------------------------------------
  function saveDraft() {
    try { sessionStorage.setItem(DRAFT_KEY, JSON.stringify(readRaw())); } catch (e) { /* ignore */ }
  }
  function loadDraft() {
    try {
      var raw = JSON.parse(sessionStorage.getItem(DRAFT_KEY) || 'null');
      if (!raw) return;
      cfg.options.fields.forEach(function (f) { if (typeof raw[f.key] === 'string') ctl(f.key).value = raw[f.key]; });
    } catch (e) { /* ignore */ }
  }
  function clearDraft() { try { sessionStorage.removeItem(DRAFT_KEY); } catch (e) { /* ignore */ } }

  // Actions --------------------------------------------------------------------------
  function copyText(text, button) {
    function done(ok) {
      var old = button.textContent;
      button.textContent = ok ? 'Copied ✓' : 'Copy failed: select the text below';
      setTimeout(function () { button.textContent = old; }, 2000);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { done(true); }, function () { done(false); });
    } else {
      done(false);
    }
  }

  function renderStatus(nodes) {
    var s = $('status');
    s.replaceChildren.apply(s, nodes);
  }

  function submitIssue(ev) {
    ev.preventDefault();
    cfg.options.fields.forEach(function (f) { touched[f.key] = true; });
    touched.consent = true;
    var v = validateAll();
    showFieldErrors(v.errors, false);
    showSummary(v.errors);
    if (v.errors.length) { renderStatus([]); return; }

    var built = C.buildIssueUrl(v.entry, cfg.options, cfg.repo);
    var link = el('a', { href: built.url, target: '_blank', rel: 'noopener noreferrer', class: 'button primary', text: 'Open the prefilled issue on GitHub' });

    if (!built.omitted.length) {
      renderStatus([
        el('div', { class: 'callout' }, [
          el('p', null, [el('strong', { text: 'Almost done.' }), ' A GitHub tab should have opened with your report filled in. Check the consent box there, review everything once more, and click ', el('em', { text: 'Create' }), '.']),
          el('p', null, ['If no tab opened (pop-up blocked), use this link: ', link])
        ])
      ]);
      window.open(built.url, '_blank', 'noopener');
      return;
    }

    // Too long for one URL: prefill what fits, offer copy buttons for the rest.
    var labels = {};
    cfg.options.fields.forEach(function (f) { labels[f.key] = f.label; });
    var manual = el('textarea', { class: 'manual-copy', readonly: true, 'aria-label': 'Left-out fields, for manual copying' });
    manual.value = built.omitted.map(function (k) { return '### ' + labels[k] + '\n\n' + v.entry[k]; }).join('\n\n');
    renderStatus([
      el('div', { class: 'callout warn' }, [
        el('p', null, [el('strong', { text: 'Your report is too long to prefill completely.' }), ' GitHub limits how long a link can be, so these fields were left out of the prefilled issue. Nothing was cut short.']),
        el('ol', null, [
          el('li', null, ['Open the issue: ', link]),
          el('li', { text: 'For each field below, click Copy and paste it into the matching box on GitHub.' }),
          el('li', { text: 'Check the consent box on GitHub and click Create.' })
        ]),
        el('ul', { class: 'omitted-list' }, built.omitted.map(function (k) {
          var btn = el('button', { type: 'button', text: 'Copy ' + labels[k] });
          btn.addEventListener('click', function () { copyText(v.entry[k], btn); });
          return el('li', null, [el('span', null, [el('strong', { text: labels[k] }), ' (' + C.charCount(v.entry[k]).toLocaleString('en-US') + ' characters)']), btn]);
        })),
        built.tooLong ? el('p', { text: 'Even without these fields the link is long; if GitHub shows “414 URI Too Long”, open the blank issue form instead and paste every field.' }) : null,
        el('details', null, [el('summary', { text: 'Show all left-out text (to copy by hand)' }), manual])
      ])
    ]);
    $('status').scrollIntoView({ block: 'start' });
  }

  function downloadJson() {
    cfg.options.fields.forEach(function (f) { touched[f.key] = true; });
    touched.consent = true;
    var v = validateAll();
    showFieldErrors(v.errors, false);
    showSummary(v.errors);
    if (v.errors.length) return;
    var entry = v.entry;
    entry.id = C.makeId(entry.date, function (n) { return crypto.getRandomValues(new Uint8Array(n)); });
    var ordered = { id: entry.id };
    cfg.options.fields.forEach(function (f) { if (entry[f.key] !== undefined) ordered[f.key] = entry[f.key]; });
    var json = JSON.stringify(ordered, null, 2) + '\n';
    var url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    var a = el('a', { href: url, download: entry.id + '.json' });
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    renderStatus([el('div', { class: 'callout' }, [
      el('p', null, ['Downloaded ', el('code', { text: entry.id + '.json' }), '. Add it to ', el('code', { text: 'data/entries/' }), ' in your fork, run ', el('code', { text: 'npm test' }), ', and open a pull request.'])
    ])]);
  }

  function clearForm() {
    $('entry-form').reset();
    clearDraft();
    touched = {};
    showFieldErrors([], true);
    $('error-summary').hidden = true;
    renderStatus([]);
    updateConditional();
    updateCounters();
  }

  function onChange(ev) {
    var key = ev.target && ev.target.name;
    if (key === 'assistant') updateConditional();
    updateCounters();
    saveDraft();
    if (key && touched[key]) showFieldErrors(validateAll().errors, true);
  }

  function onBlur(ev) {
    var key = ev.target && ev.target.name;
    if (!key) return;
    touched[key] = true;
    showFieldErrors(validateAll().errors, true);
  }

  Site.loadConfig().then(function (c) {
    cfg = c;
    buildForm();
    loadDraft();
    updateConditional();
    updateCounters();
    var form = $('entry-form');
    form.addEventListener('input', onChange);
    form.addEventListener('change', onChange);
    form.addEventListener('focusout', onBlur);
    form.addEventListener('submit', submitIssue);
    $('download-json').addEventListener('click', downloadJson);
    $('clear-form').addEventListener('click', clearForm);
  }).catch(function (err) {
    Site.showError($('fields'), 'Could not load the form (' + err.message + '). You can still use the GitHub issue form directly.');
  });
})();
