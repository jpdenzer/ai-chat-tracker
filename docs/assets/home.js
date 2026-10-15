(function () {
  'use strict';
  var el = Site.el;
  function fill(tbodyId, list) {
    var tbody = document.getElementById(tbodyId);
    tbody.replaceChildren.apply(tbody, list.map(function (o) {
      return el('tr', null, [el('th', { scope: 'row', text: o.label }), el('td', { text: o.definition || '' })]);
    }));
  }
  Site.loadConfig().then(function (cfg) {
    fill('types-body', cfg.options.lists.behavior_type);
    fill('severity-body', cfg.options.lists.severity);
  }).catch(function () {
    ['types-body', 'severity-body'].forEach(function (id) {
      document.getElementById(id).replaceChildren(el('tr', null, [el('td', { colspan: '2', text: 'Could not load definitions.' })]));
    });
  });
})();
