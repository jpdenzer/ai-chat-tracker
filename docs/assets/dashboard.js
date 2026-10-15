(function () {
  'use strict';
  var el = Site.el;
  var charts = [];
  var model = null;

  function $(id) { return document.getElementById(id); }

  function countBy(entries, labels, getter) {
    var counts = labels.map(function () { return 0; });
    entries.forEach(function (e) {
      var i = labels.indexOf(getter(e));
      if (i !== -1) counts[i]++;
    });
    return counts;
  }

  function monthRange(entries) {
    if (!entries.length) return [];
    var months = entries.map(function (e) { return e.date.slice(0, 7); }).sort();
    var out = [];
    var y = Number(months[0].slice(0, 4)), m = Number(months[0].slice(5, 7));
    var last = months[months.length - 1];
    for (;;) {
      var key = y + '-' + String(m).padStart(2, '0');
      out.push(key);
      if (key >= last || out.length > 600) break;
      m++; if (m > 12) { m = 1; y++; }
    }
    return out;
  }

  function monthLabel(key) {
    var d = new Date(Date.UTC(Number(key.slice(0, 4)), Number(key.slice(5, 7)) - 1, 1));
    return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
  }

  function buildModel(options, all) {
    var entries = all.filter(function (e) { return !e.example; });
    var L = function (n) { return options.lists[n].map(function (o) { return o.label; }); };
    var assistants = L('assistant'), types = L('behavior_type'), sev = L('severity');
    var months = monthRange(entries);
    return {
      entries: entries,
      assistant: { labels: assistants, counts: countBy(entries, assistants, function (e) { return e.assistant; }) },
      behavior: {
        labels: types,
        primary: countBy(entries, types, function (e) { return e.behavior_type; }),
        secondary: countBy(entries, types, function (e) { return e.behavior_type_secondary; })
      },
      severity: { labels: sev, counts: countBy(entries, sev, function (e) { return e.severity; }) },
      month: { keys: months, labels: months.map(monthLabel), counts: countBy(entries, months, function (e) { return e.date.slice(0, 7); }) },
      pivot: assistants.map(function (a) {
        return types.map(function (t) { return entries.filter(function (e) { return e.assistant === a && e.behavior_type === t; }).length; });
      }),
      types: types,
      assistants: assistants
    };
  }

  // Tables (always rendered: the accessible view of every chart) --------------
  function table(caption, head, rows, totalRow) {
    var t = el('table', null, [
      el('caption', { class: 'visually-hidden', text: caption }),
      el('thead', null, [el('tr', null, head.map(function (h, i) { return el('th', { scope: 'col', class: i ? 'num' : null, text: h }); }))]),
      el('tbody', null, rows.map(function (r) {
        return el('tr', null, r.map(function (c, i) { return i ? el('td', { class: 'num', text: String(c) }) : el('th', { scope: 'row', text: c }); }));
      }))
    ]);
    if (totalRow) t.appendChild(el('tfoot', null, [el('tr', null, totalRow.map(function (c, i) { return i ? el('td', { class: 'num', text: String(c) }) : el('th', { scope: 'row', text: c }); }))]));
    return t;
  }
  function sum(a) { return a.reduce(function (x, y) { return x + y; }, 0); }

  function renderTables(m) {
    $('t-assistant').replaceChildren(table('Reports per assistant', ['Assistant', 'Reports'],
      m.assistant.labels.map(function (l, i) { return [l, m.assistant.counts[i]]; }), ['Total', sum(m.assistant.counts)]));
    $('t-behavior').replaceChildren(table('Behavior type mentions', ['Behavior type', 'Primary', 'Secondary', 'Total mentions'],
      m.behavior.labels.map(function (l, i) { return [l, m.behavior.primary[i], m.behavior.secondary[i], m.behavior.primary[i] + m.behavior.secondary[i]]; }),
      ['Total', sum(m.behavior.primary), sum(m.behavior.secondary), sum(m.behavior.primary) + sum(m.behavior.secondary)]));
    $('t-severity').replaceChildren(table('Reports per severity', ['Severity', 'Reports'],
      m.severity.labels.map(function (l, i) { return [l, m.severity.counts[i]]; }), ['Total', sum(m.severity.counts)]));
    $('t-month').replaceChildren(table('Reports per month', ['Month', 'Reports'],
      m.month.labels.map(function (l, i) { return [l, m.month.counts[i]]; }), ['Total', sum(m.month.counts)]));
    var pivotRows = m.assistants.map(function (a, i) { return [a].concat(m.pivot[i]).concat([sum(m.pivot[i])]); });
    var colTotals = m.types.map(function (t, j) { return sum(m.pivot.map(function (r) { return r[j]; })); });
    $('t-pivot').replaceChildren(table('Reports by assistant and primary behavior type', ['Assistant'].concat(m.types).concat(['Total']), pivotRows,
      ['Total'].concat(colTotals).concat([sum(colTotals)])));
  }

  function renderStats(m) {
    var total = m.entries.length;
    var major = m.severity.counts[m.severity.labels.indexOf('Major')] || 0;
    var reproduced = m.entries.filter(function (e) { return e.reproduced === 'Reproduced'; }).length;
    var assistantsSeen = m.assistant.counts.filter(function (c) { return c > 0; }).length;
    var tiles = [
      [String(total), 'Reports'],
      [String(assistantsSeen), 'Assistants with reports'],
      [String(major), 'Major severity'],
      [String(reproduced), 'Reproduced']
    ];
    $('stats').replaceChildren.apply($('stats'), tiles.map(function (t) {
      return el('div', { class: 'stat' }, [el('div', { class: 'value', text: t[0] }), el('div', { class: 'label', text: t[1] })]);
    }));
  }

  // Charts ---------------------------------------------------------------------
  function themeColors() {
    return {
      s1: Site.cssVar('--series-1'), s2: Site.cssVar('--series-2'),
      text: Site.cssVar('--text-2'), grid: Site.cssVar('--grid'), surface: Site.cssVar('--surface'),
      font: Site.cssVar('--font') || 'system-ui'
    };
  }

  function baseOptions(c, horizontal, stacked) {
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var valueAxis = { beginAtZero: true, stacked: !!stacked, ticks: { precision: 0, color: c.text }, grid: { color: c.grid }, border: { display: false } };
    var catAxis = { stacked: !!stacked, ticks: { color: c.text, autoSkip: false }, grid: { display: false }, border: { color: c.grid } };
    return {
      indexAxis: horizontal ? 'y' : 'x',
      responsive: true,
      maintainAspectRatio: false,
      animation: reduce ? false : { duration: 300 },
      plugins: {
        legend: { display: false },
        tooltip: { intersect: false, mode: 'index', displayColors: !!stacked }
      },
      scales: horizontal ? { x: valueAxis, y: catAxis } : { x: catAxis, y: valueAxis },
      font: { family: c.font }
    };
  }

  function bar(color, surface, horizontal) {
    return {
      backgroundColor: color,
      borderColor: surface,
      borderWidth: horizontal ? { right: 0, top: 1, bottom: 1 } : { top: 0, left: 1, right: 1 },
      borderRadius: 4,
      borderSkipped: 'start',
      maxBarThickness: 28
    };
  }

  function renderCharts(m) {
    charts.forEach(function (ch) { ch.destroy(); });
    charts = [];
    if (typeof Chart === 'undefined') return;
    var c = themeColors();
    Chart.defaults.font.family = c.font;
    Chart.defaults.color = c.text;

    charts.push(new Chart($('c-assistant'), {
      type: 'bar',
      data: { labels: m.assistant.labels, datasets: [Object.assign({ label: 'Reports', data: m.assistant.counts }, bar(c.s1, c.surface, true))] },
      options: baseOptions(c, true)
    }));

    var behaviorOpts = baseOptions(c, true, true);
    var secondaryBar = bar(c.s2, c.surface, true);
    var primaryBar = bar(c.s1, c.surface, true);
    primaryBar.borderRadius = 0; // only the outer (secondary) end is rounded
    primaryBar.borderWidth = { right: 2, top: 1, bottom: 1 };
    charts.push(new Chart($('c-behavior'), {
      type: 'bar',
      data: {
        labels: m.behavior.labels,
        datasets: [
          Object.assign({ label: 'Primary', data: m.behavior.primary }, primaryBar),
          Object.assign({ label: 'Secondary', data: m.behavior.secondary }, secondaryBar)
        ]
      },
      options: behaviorOpts
    }));
    $('legend-behavior').replaceChildren(
      el('li', null, [el('span', { class: 'swatch', 'data-series': '1' }), 'Primary']),
      el('li', null, [el('span', { class: 'swatch', 'data-series': '2' }), 'Secondary'])
    );

    charts.push(new Chart($('c-severity'), {
      type: 'bar',
      data: { labels: m.severity.labels, datasets: [Object.assign({ label: 'Reports', data: m.severity.counts }, bar(c.s1, c.surface, false))] },
      options: baseOptions(c, false)
    }));

    charts.push(new Chart($('c-month'), {
      type: 'bar',
      data: { labels: m.month.labels, datasets: [Object.assign({ label: 'Reports', data: m.month.counts }, bar(c.s1, c.surface, false))] },
      options: (function () { var o = baseOptions(c, false); o.scales.x.ticks.autoSkip = true; o.scales.x.ticks.maxRotation = 0; return o; })()
    }));
  }

  Promise.all([Site.loadConfig(), Site.loadJson('data/index.json')]).then(function (r) {
    model = buildModel(r[0].options, r[1].entries || []);
    renderStats(model);
    renderTables(model);
    renderCharts(model);
    document.addEventListener('themechange', function () { renderCharts(model); });
  }).catch(function (err) {
    Site.showError($('stats'), 'Could not load data (' + err.message + '). If you are running locally, use `npm run serve`.');
  });
})();
