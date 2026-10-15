(function () {
  'use strict';
  var el = Site.el;
  var state = { entries: [], options: null, sort: { key: 'date', dir: 'desc' } };
  var EXCERPT_PREVIEW = 140;

  var COLUMNS = [
    { key: 'date', label: 'Date' },
    { key: 'assistant', label: 'Assistant' },
    { key: 'behavior_type', label: 'Behavior type' },
    { key: 'severity', label: 'Severity' },
    { key: 'account_type', label: 'Account' },
    { key: 'reproduced', label: 'Reproduced' },
    { key: 'excerpt', label: 'Excerpt', sortable: false }
  ];

  var FILTERS = {
    assistant: { select: 'f-assistant', list: 'assistant' },
    behavior: { select: 'f-behavior', list: 'behavior_type' },
    severity: { select: 'f-severity', list: 'severity' },
    account: { select: 'f-account', list: 'account_type' },
    reproduced: { select: 'f-reproduced', list: 'reproduced' }
  };

  function $(id) { return document.getElementById(id); }

  function assistantName(e) {
    return e.assistant === 'Other' && e.assistant_other ? e.assistant_other + ' (Other)' : e.assistant;
  }

  function orderIndex(listName, value) {
    var labels = EntryCore.listLabels(state.options, listName);
    var i = labels.indexOf(value);
    return i === -1 ? labels.length : i;
  }

  function compare(a, b, key) {
    if (key === 'severity') return orderIndex('severity', a.severity) - orderIndex('severity', b.severity);
    if (key === 'reproduced') return orderIndex('reproduced', a.reproduced) - orderIndex('reproduced', b.reproduced);
    var va = key === 'assistant' ? assistantName(a) : a[key] || '';
    var vb = key === 'assistant' ? assistantName(b) : b[key] || '';
    return va.localeCompare(vb, undefined, { sensitivity: 'base' });
  }

  function readFilters() {
    var f = $('filters');
    return {
      q: f.q.value.trim().toLowerCase(),
      assistant: f.assistant.value,
      behavior: f.behavior.value,
      severity: f.severity.value,
      account: f.account.value,
      reproduced: f.reproduced.value,
      from: f.from.value,
      to: f.to.value,
      secondary: f.secondary.checked,
      examples: f.examples.checked
    };
  }

  function matches(e, f) {
    if (!f.examples && e.example) return false;
    if (f.assistant && e.assistant !== f.assistant) return false;
    if (f.behavior && e.behavior_type !== f.behavior && !(f.secondary && e.behavior_type_secondary === f.behavior)) return false;
    if (f.severity && e.severity !== f.severity) return false;
    if (f.account && e.account_type !== f.account) return false;
    if (f.reproduced && e.reproduced !== f.reproduced) return false;
    if (f.from && e.date < f.from) return false;
    if (f.to && e.date > f.to) return false;
    if (f.q) {
      var hay = state.options.fields.map(function (fd) { return e[fd.key] || ''; }).concat(e.id).join('\n').toLowerCase();
      var terms = f.q.split(/\s+/);
      for (var i = 0; i < terms.length; i++) if (hay.indexOf(terms[i]) === -1) return false;
    }
    return true;
  }

  function filtered() {
    var f = readFilters();
    var key = state.sort.key, dir = state.sort.dir === 'asc' ? 1 : -1;
    return state.entries.filter(function (e) { return matches(e, f); }).sort(function (a, b) {
      return compare(a, b, key) * dir || b.date.localeCompare(a.date) || a.id.localeCompare(b.id);
    });
  }

  function syncUrl() {
    var f = readFilters();
    var params = new URLSearchParams();
    ['q', 'assistant', 'behavior', 'severity', 'account', 'reproduced', 'from', 'to'].forEach(function (k) { if (f[k]) params.set(k, f[k]); });
    if (!f.secondary) params.set('secondary', '0');
    if (!f.examples) params.set('examples', '0');
    if (state.sort.key !== 'date' || state.sort.dir !== 'desc') params.set('sort', state.sort.key + ':' + state.sort.dir);
    var qs = params.toString();
    history.replaceState(null, '', location.pathname + (qs ? '?' + qs : '') + location.hash);
  }

  function restoreFromUrl() {
    var p = new URLSearchParams(location.search);
    var f = $('filters');
    ['q', 'from', 'to'].forEach(function (k) { if (p.has(k)) f[k].value = p.get(k); });
    Object.keys(FILTERS).forEach(function (k) {
      var v = p.get(k);
      if (v && EntryCore.listLabels(state.options, FILTERS[k].list).indexOf(v) !== -1) f[k].value = v;
    });
    if (p.get('secondary') === '0') f.secondary.checked = false;
    if (p.get('examples') === '0') f.examples.checked = false;
    var s = (p.get('sort') || '').split(':');
    if (COLUMNS.some(function (c) { return c.key === s[0] && c.sortable !== false; }) && (s[1] === 'asc' || s[1] === 'desc')) {
      state.sort = { key: s[0], dir: s[1] };
    }
  }

  function renderHead() {
    var row = $('head-row');
    row.replaceChildren.apply(row, COLUMNS.map(function (c) {
      var th = el('th', { scope: 'col' });
      if (c.sortable === false) { th.textContent = c.label; return th; }
      var active = state.sort.key === c.key;
      th.setAttribute('aria-sort', active ? (state.sort.dir === 'asc' ? 'ascending' : 'descending') : 'none');
      th.appendChild(el('button', {
        type: 'button',
        class: 'sort-btn',
        onclick: function () {
          state.sort = { key: c.key, dir: active && state.sort.dir === 'asc' ? 'desc' : active ? 'asc' : (c.key === 'date' || c.key === 'severity' ? 'desc' : 'asc') };
          render();
          var btn = $('head-row').querySelectorAll('button')[COLUMNS.filter(function (x) { return x.sortable !== false; }).indexOf(c)];
          if (btn) btn.focus();
        }
      }, [c.label, el('span', { class: 'sort-ind', 'aria-hidden': 'true', text: active ? (state.sort.dir === 'asc' ? '▲' : '▼') : '↕' })]));
      return th;
    }));
  }

  function truncate(s, n) {
    var chars = Array.from(s || '');
    return chars.length > n ? chars.slice(0, n).join('') + '…' : s || '';
  }

  function renderRows(list) {
    var tbody = $('rows');
    if (!list.length) {
      tbody.replaceChildren(el('tr', null, [el('td', { colspan: String(COLUMNS.length), class: 'muted', text: state.entries.length ? 'No entries match these filters.' : 'No entries yet.' })]));
      return;
    }
    tbody.replaceChildren.apply(tbody, list.map(function (e) {
      var behavior = [el('span', { text: e.behavior_type })];
      if (e.behavior_type_secondary) behavior.push(el('br'), el('small', { class: 'muted', text: '+ ' + e.behavior_type_secondary }));
      return el('tr', null, [
        el('td', null, [
          el('button', { type: 'button', class: 'link-btn', 'aria-label': 'View details for entry ' + e.id, onclick: function () { openDetail(e.id, true); }, text: e.date }),
          e.example ? el('span', null, [' ', el('span', { class: 'badge', text: 'Example' })]) : null
        ]),
        el('td', { 'data-label': 'Assistant', text: assistantName(e) }),
        el('td', { 'data-label': 'Behavior' }, behavior),
        el('td', { 'data-label': 'Severity' }, [el('span', { class: 'sev', 'data-sev': e.severity, text: e.severity })]),
        el('td', { 'data-label': 'Account', text: e.account_type }),
        el('td', { 'data-label': 'Reproduced', text: e.reproduced }),
        el('td', { class: 'excerpt', 'data-label': 'Excerpt', text: truncate(e.excerpt, EXCERPT_PREVIEW) })
      ]);
    }));
  }

  function render() {
    var list = filtered();
    renderHead();
    renderRows(list);
    var total = state.entries.filter(function (e) { return !e.example; }).length;
    $('result-count').textContent = 'Showing ' + list.length + ' of ' + state.entries.length + ' entries (' + total + ' reports, excluding format examples).';
    syncUrl();
  }

  // Detail dialog ------------------------------------------------------------
  var lastFocus = null;

  function openDetail(id, pushHash) {
    var e = state.entries.filter(function (x) { return x.id === id; })[0];
    if (!e) return;
    lastFocus = document.activeElement;
    $('detail-title').textContent = assistantName(e) + ' · ' + e.behavior_type;
    $('detail-sub').replaceChildren(e.id + ' · ' + e.date, e.example ? el('span', null, [' ', el('span', { class: 'badge', text: 'Format example' })]) : '');
    var dl = $('detail-list');
    var items = [];
    state.options.fields.forEach(function (f) {
      var v = e[f.key];
      if (!v) return;
      var dd;
      if (f.type === 'url') {
        dd = el('dd', null, [el('a', { href: v, rel: 'nofollow noopener noreferrer ugc', target: '_blank', text: v })]);
      } else if (f.type === 'longtext') {
        dd = el('dd', null, [el('pre', { text: v })]);
      } else {
        dd = el('dd', { text: v });
      }
      items.push(el('dt', { text: f.label }), dd);
    });
    if (e.source_issue) {
      items.push(el('dt', { text: 'Source' }), el('dd', null, [el('a', { 'data-repo-href': '/issues/' + e.source_issue, href: 'https://github.com/' + state.repo + '/issues/' + e.source_issue, text: 'Issue #' + e.source_issue })]));
    }
    items.push(el('dt', { text: 'Permalink' }), el('dd', null, [el('a', { href: 'browse.html#' + e.id, text: 'browse.html#' + e.id })]));
    dl.replaceChildren.apply(dl, items);
    if (pushHash) history.replaceState(null, '', location.pathname + location.search + '#' + e.id);
    var d = $('detail');
    if (!d.open) d.showModal();
    $('detail-close').focus();
  }

  function closeDetail() {
    var d = $('detail');
    if (d.open) d.close();
  }

  function downloadFiltered() {
    var csv = EntryCore.toCsv(filtered(), state.options);
    var url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    var a = el('a', { href: url, download: 'ai-chat-anomaly-log-filtered.csv' });
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  function fillSelects() {
    Object.keys(FILTERS).forEach(function (k) {
      var sel = $(FILTERS[k].select);
      EntryCore.listLabels(state.options, FILTERS[k].list).forEach(function (l) { sel.appendChild(el('option', { value: l, text: l })); });
    });
  }

  function init() {
    Promise.all([Site.loadConfig(), Site.loadJson('data/index.json')]).then(function (r) {
      state.options = r[0].options;
      state.repo = r[0].repo;
      state.entries = r[1].entries || [];
      fillSelects();
      restoreFromUrl();
      var form = $('filters');
      form.addEventListener('input', render);
      form.addEventListener('change', render);
      form.addEventListener('submit', function (ev) { ev.preventDefault(); });
      form.addEventListener('reset', function () { setTimeout(function () { state.sort = { key: 'date', dir: 'desc' }; render(); }, 0); });
      $('download-filtered').addEventListener('click', downloadFiltered);
      $('detail-close').addEventListener('click', closeDetail);
      $('detail').addEventListener('close', function () {
        history.replaceState(null, '', location.pathname + location.search);
        if (lastFocus && document.body.contains(lastFocus)) lastFocus.focus();
      });
      $('detail').addEventListener('click', function (ev) { if (ev.target === $('detail')) closeDetail(); });
      render();
      var hash = decodeURIComponent(location.hash.slice(1));
      if (EntryCore.ID_RE.test(hash)) openDetail(hash, false);
    }).catch(function (err) {
      Site.showError($('rows').closest('.table-wrap'), 'Could not load entries (' + err.message + '). If you are running locally, use `npm run serve`.');
      $('result-count').textContent = '';
    });
  }

  init();
})();
