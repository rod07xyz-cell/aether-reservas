// Utilidades compartidas por las páginas del paciente (sin dependencias).
(function () {
  'use strict';

  var cfg = window.RESERVAS_CONFIG || {};
  var params = new URLSearchParams(location.search);
  var demo = params.has('demo') || !cfg.apiBase;

  function $(sel, raiz) { return (raiz || document).querySelector(sel); }
  function $$(sel, raiz) { return Array.prototype.slice.call((raiz || document).querySelectorAll(sel)); }

  // POST a un webhook de n8n. Devuelve { status, body }; status 0 si no hay conexión.
  function post(ruta, datos) {
    var ctrl = 'AbortController' in window ? new AbortController() : null;
    var t = setTimeout(function () { if (ctrl) ctrl.abort(); }, 25000);
    return fetch(cfg.apiBase.replace(/\/$/, '') + '/' + ruta, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(datos),
      signal: ctrl ? ctrl.signal : undefined
    }).then(function (r) {
      clearTimeout(t);
      return r.json().catch(function () { return {}; }).then(function (b) { return { status: r.status, body: b }; });
    }).catch(function () {
      clearTimeout(t);
      return { status: 0, body: {} };
    });
  }

  function fallo() {
    return 'No hemos podido conectar. Comprueba tu conexión e inténtalo de nuevo' +
      (cfg.telefono ? ', o llámanos al ' + cfg.telefono + '.' : '.');
  }

  function esperar(ms, valor) { return new Promise(function (ok) { setTimeout(function () { ok(valor); }, ms); }); }

  // Fecha local "YYYY-MM-DD" sin desfases de zona.
  function isoDia(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function deIso(s) { var p = s.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }

  var fmtDia = new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
  function textoHueco(hueco) {
    var d = deIso(hueco.slice(0, 10));
    return fmtDia.format(d) + ' a las ' + hueco.slice(11, 16);
  }

  function pintarMarca() {
    $$('[data-clinica]').forEach(function (el) { el.textContent = cfg.clinica || ''; });
    $$('[data-direccion]').forEach(function (el) { el.textContent = cfg.direccion || ''; });
    $$('[data-telefono]').forEach(function (el) { el.textContent = cfg.telefono || ''; });
    $$('[data-privacidad]').forEach(function (el) { el.href = cfg.privacidadUrl || '#'; });
    $$('[data-sello]').forEach(function (el) { el.textContent = (cfg.clinica || 'F').charAt(0); });
    if (demo) $$('[data-demo]').forEach(function (el) { el.hidden = false; });
  }

  window.Reservas = {
    cfg: cfg, params: params, demo: demo,
    $: $, $$: $$, post: post, fallo: fallo, esperar: esperar,
    isoDia: isoDia, deIso: deIso, textoHueco: textoHueco, pintarMarca: pintarMarca
  };
})();
