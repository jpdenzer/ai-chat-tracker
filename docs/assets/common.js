/* Shared helpers for all pages. No tracking, no third-party requests. */
(function () {
  'use strict';

  /**
   * Create an element. Children may be strings (inserted as text, never HTML)
   * or nodes. This is the only way pages put entry data into the DOM.
   */
  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      var v = attrs[k];
      if (v === undefined || v === null || v === false) return;
      if (k === 'text') node.textContent = v;
      else if (k === 'class') node.className = v;
      else if (k.slice(0, 2) === 'on' && typeof v === 'function') node.addEventListener(k.slice(2), v);
      else node.setAttribute(k, v === true ? '' : v);
    });
    [].concat(children || []).forEach(function (c) {
      if (c === undefined || c === null || c === false) return;
      node.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
    });
    return node;
  }

  function loadJson(url) {
    return fetch(url, { cache: 'no-cache' }).then(function (r) {
      if (!r.ok) throw new Error(url + ': HTTP ' + r.status);
      return r.json();
    });
  }

  function storageGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function storageSet(k, v) { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { /* ignore */ } }

  // Theme toggle: Auto (OS) -> Light -> Dark.
  var THEMES = ['auto', 'light', 'dark'];
  var THEME_LABEL = { auto: 'Theme: auto', light: 'Theme: light', dark: 'Theme: dark' };
  function currentTheme() {
    var t = document.documentElement.getAttribute('data-theme');
    return t === 'light' || t === 'dark' ? t : 'auto';
  }
  function applyTheme(t) {
    if (t === 'auto') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', t);
    storageSet('theme', t === 'auto' ? null : t);
    document.dispatchEvent(new CustomEvent('themechange'));
  }
  function initThemeToggle() {
    var btn = document.querySelector('.theme-toggle');
    if (!btn) return;
    var sync = function () { btn.textContent = THEME_LABEL[currentTheme()]; };
    btn.addEventListener('click', function () {
      applyTheme(THEMES[(THEMES.indexOf(currentTheme()) + 1) % THEMES.length]);
      sync();
    });
    sync();
    if (window.matchMedia) {
      var mq = window.matchMedia('(prefers-color-scheme: dark)');
      var fire = function () { document.dispatchEvent(new CustomEvent('themechange')); };
      if (mq.addEventListener) mq.addEventListener('change', fire);
    }
  }

  function cssVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  var configPromise;
  function loadConfig() {
    if (!configPromise) {
      configPromise = Promise.all([loadJson('options.json'), loadJson('config.json').catch(function () { return {}; })])
        .then(function (r) {
          var options = r[0];
          var repo = (r[1] && r[1].repository) || options.project.repository;
          return { options: options, repo: repo };
        });
    }
    return configPromise;
  }

  function showError(container, message) {
    container.replaceChildren(el('div', { class: 'callout warn', role: 'alert' }, [el('p', { text: message })]));
  }

  // Fill links whose href depends on the repository slug.
  function fillRepoLinks() {
    loadConfig().then(function (cfg) {
      document.querySelectorAll('[data-repo-href]').forEach(function (a) {
        a.setAttribute('href', 'https://github.com/' + cfg.repo + a.getAttribute('data-repo-href'));
      });
    }).catch(function () { /* links keep their fallback href */ });
  }

  document.addEventListener('DOMContentLoaded', function () {
    initThemeToggle();
    fillRepoLinks();
  });

  window.Site = { el: el, loadJson: loadJson, loadConfig: loadConfig, cssVar: cssVar, showError: showError, storageGet: storageGet, storageSet: storageSet };
})();
