/* ═══════════════════════════════════════════
   Panel de recepción (reservas): agenda, asistencia, cancelaciones,
   citas nuevas y lista de espera.
   Habla con el workflow «Panel API (reservas)» de n8n; sin API arranca en modo demostración.
   Adaptado del panel del proyecto «Recordatorios por WhatsApp».
═══════════════════════════════════════════ */
(function () {
  'use strict';

  var CFG = Object.assign({
    clinica: 'Clínica', apiBase: '', servicios: [], horas: [], zonaHoraria: 'Europe/Madrid', refrescoSegundos: 30
  }, window.PANEL_CONFIG || {});

  var CLAVE_KEY = 'panelReservasClave';   // sessionStorage: se borra al cerrar la pestaña
  var TEMA_KEY = 'panelTema';             // localStorage: preferencia del navegador

  var state = {
    demo: false, clave: '', rango: 'hoy', filtro: 'todas', busqueda: '',
    citas: [], espera: [], abierta: null, timer: null, cargando: false
  };

  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $$(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function store(kind, key, val) {
    try {
      var s = kind === 'local' ? window.localStorage : window.sessionStorage;
      if (val === undefined) return s.getItem(key);
      if (val === null) s.removeItem(key); else s.setItem(key, val);
    } catch (e) { return null; }
  }

  /* ══════════ Estados ══════════ */
  // Coinciden con la columna «estado» de la tabla reservas (las anuladas no llegan al panel).
  var ESTADOS = {
    confirmada: { label: 'Confirmada',     color: '--st-ok' },
    asistio:    { label: 'Ha venido',      color: '--st-done' },
    no_asistio: { label: 'No se presentó', color: '--st-error' },
    cancelada:  { label: 'Cancelada',      color: '--st-off' }
  };
  var ORIGEN = { web: 'Reservada online', lista_espera: 'Desde la lista de espera', panel: 'Creada en recepción' };
  function estadoDe(c) { return ESTADOS[c.estado] ? c.estado : 'confirmada'; }
  function colorDe(key) { return 'var(' + ESTADOS[key].color + ')'; }
  var FUERA = { cancelada: 1 };

  /* ══════════ Fechas ══════════ */
  function fmt(d, opts) { return new Intl.DateTimeFormat('es-ES', Object.assign({ timeZone: CFG.zonaHoraria }, opts)).format(d); }
  function hora(d) { return fmt(d, { hour: '2-digit', minute: '2-digit' }); }
  function diaLargo(d) { var s = fmt(d, { weekday: 'long', day: 'numeric', month: 'long' }); return s.charAt(0).toUpperCase() + s.slice(1); }
  function claveDia(d) { return fmt(d, { year: 'numeric', month: '2-digit', day: '2-digit' }); }
  function inicioDia(offset) { var d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + offset); return d; }
  function isoLocal(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function deIso(s) { var p = String(s).split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function rangoFechas() {
    if (state.rango === 'manana') return [inicioDia(1), inicioDia(2)];
    if (state.rango === 'semana') return [inicioDia(0), inicioDia(7)];
    return [inicioDia(0), inicioDia(1)];
  }
  function haceCuanto(d) {
    var s = Math.round((Date.now() - d.getTime()) / 1000);
    if (s < 10) return 'ahora mismo';
    if (s < 60) return 'hace ' + s + ' s';
    return 'hace ' + Math.round(s / 60) + ' min';
  }

  /* ══════════ API (n8n) ══════════ */
  function api(path, opts) {
    opts = opts || {};
    return fetch(CFG.apiBase.replace(/\/$/, '') + '/' + path, {
      method: opts.method || 'GET',
      headers: Object.assign({ 'X-Panel-Clave': state.clave }, opts.body ? { 'Content-Type': 'application/json' } : {}),
      body: opts.body ? JSON.stringify(opts.body) : undefined
    }).then(function (res) {
      if (res.status === 401 || res.status === 403) { var e = new Error('clave'); e.clave = true; throw e; }
      return res.json().catch(function () { return {}; }).then(function (json) {
        if (!res.ok) { var e2 = new Error(json.message || 'HTTP ' + res.status); e2.status = res.status; e2.mensaje = json.message; throw e2; }
        return json;
      });
    });
  }

  /* ══════════ Datos de demostración ══════════ */
  var demoDB = null, demoEspera = null;
  // En la demo, «hoy» siempre tiene agenda; los días siguientes saltan el fin de semana.
  function laborable(n) {
    var d = inicioDia(0);
    for (var i = 0; i < n; i++) { do { d.setDate(d.getDate() + 1); } while (d.getDay() === 0 || d.getDay() === 6); }
    return d;
  }
  function crearDemo() {
    var nombres = ['Laura Martín', 'Carlos Rodríguez', 'Elena Suárez', 'Marcos Fernández', 'Lucía Álvarez', 'Javier Menéndez', 'Paula García', 'Andrés Llaneza', 'Sara Iglesias', 'Diego Prieto', 'Nuria Cuesta', 'Hugo Rubio', 'Marta Pérez', 'Iván Castro', 'Alba Díaz', 'Raúl Fuentes'];
    var servicios = CFG.servicios.length ? CFG.servicios : ['Fisioterapia general'];
    var plan = [
      [0, '09:00', 'asistio', 'web'], [0, '10:00', 'asistio', 'panel'], [0, '11:00', 'no_asistio', 'web'], [0, '12:00', 'confirmada', 'lista_espera'],
      [0, '13:00', 'cancelada', 'web'], [0, '16:00', 'confirmada', 'web'], [0, '17:00', 'confirmada', 'web'], [0, '18:00', 'confirmada', 'panel'], [0, '19:00', 'confirmada', 'web'],
      [1, '09:00', 'confirmada', 'web'], [1, '10:00', 'confirmada', 'lista_espera'], [1, '11:00', 'confirmada', 'web'], [1, '12:00', 'confirmada', 'web'], [1, '13:00', 'confirmada', 'panel'],
      [1, '16:00', 'cancelada', 'web'], [1, '17:00', 'confirmada', 'web'], [2, '10:00', 'confirmada', 'web'], [3, '16:00', 'confirmada', 'web'], [4, '09:00', 'confirmada', 'panel']
    ];
    demoDB = plan.map(function (p, i) {
      var d = laborable(p[0]); var hm = p[1].split(':'); d.setHours(+hm[0], +hm[1]);
      return {
        id: i + 1, paciente: nombres[i % nombres.length], telefono: i % 3 ? '6' + String(10000000 + i * 7391).slice(0, 8) : '',
        email: i % 4 === 1 ? '' : nombres[i % nombres.length].split(' ')[0].toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '') + '@example.com',
        servicio: servicios[i % servicios.length], inicio: d.toISOString(), estado: p[2], origen: p[3],
        creada: new Date(d.getTime() - (3 + i) * 24 * 3600e3).toISOString(),
        cancelada_en: p[2] === 'cancelada' ? new Date(Date.now() - 2 * 3600e3).toISOString() : null,
        notas: p[2] === 'cancelada' ? 'Cancelada por el paciente' : (p[3] === 'lista_espera' ? 'Desde la lista de espera' : '')
      };
    });
    var hoy = isoLocal(laborable(0)), man = isoLocal(laborable(1)), pas = isoLocal(laborable(2));
    demoEspera = [
      { id: 1, nombre: 'Rosa Valdés', dia: hoy, franja: 'tarde', servicio: 'Punción seca', estado: 'ofrecido', hueco_ofrecido: hoy + 'T19:00', oferta_caduca_en: new Date(Date.now() + 74 * 60e3).toISOString() },
      { id: 2, nombre: 'Tomás Vigil', dia: man, franja: 'cualquiera', servicio: 'Fisioterapia general', estado: 'esperando' },
      { id: 3, nombre: 'Inés Granda', dia: man, franja: 'manana', servicio: 'Suelo pélvico', estado: 'esperando' },
      { id: 4, nombre: 'Pablo Noval', dia: pas, franja: 'tarde', servicio: 'Fisioterapia deportiva', estado: 'esperando' }
    ];
  }
  function demoListar(desde, hasta) {
    return Promise.resolve({
      reservas: demoDB.filter(function (c) { var t = new Date(c.inicio); return t >= desde && t < hasta; }),
      espera: demoEspera.filter(function (e) { return e.estado === 'esperando' || e.estado === 'ofrecido'; })
    });
  }
  function demoAccion(id, accion, notas) {
    var c = demoDB.filter(function (x) { return x.id === id; })[0];
    if (!c) return Promise.reject(new Error('No existe'));
    if (accion === 'notas') c.notas = notas;
    else if (accion === 'cancelar') { c.estado = 'cancelada'; c.cancelada_en = new Date().toISOString(); c.notas = 'Cancelada desde el panel'; }
    else c.estado = { asistio: 'asistio', no_asistio: 'no_asistio', reabrir: 'confirmada' }[accion];
    return Promise.resolve({ ok: true });
  }

  /* ══════════ Carga y refresco ══════════ */
  var ultimaCarga = null;
  function cargar(silencioso) {
    if (state.cargando) return;
    state.cargando = true;
    var r = rangoFechas();
    if (!silencioso && !state.citas.length) pintarEsqueleto();
    setSync('loading', 'Actualizando…');
    var p = state.demo ? demoListar(r[0], r[1]) : api('panel-reservas?desde=' + encodeURIComponent(r[0].toISOString()) + '&hasta=' + encodeURIComponent(r[1].toISOString()));
    p.then(function (json) {
      state.citas = (json.reservas || []).filter(function (c) { return c && c.inicio; }).sort(function (a, b) { return new Date(a.inicio) - new Date(b.inicio); });
      state.espera = (json.espera || []).sort(function (a, b) { return a.dia < b.dia ? -1 : a.dia > b.dia ? 1 : a.id - b.id; });
      ultimaCarga = new Date();
      setSync('ok');
      pintar();
      pintarEspera();
      if (state.abierta) {
        var c = buscar(state.abierta);
        if (c) pintarFicha(c); else cerrarFicha();
      }
    }).catch(function (err) {
      if (err.clave) return salir('La clave de acceso no es correcta o ha caducado.');
      setSync('error', 'Sin conexión con el servidor. Reintentando…');
      if (!state.citas.length) pintarVacio('No se ha podido cargar la agenda. Comprueba la conexión; se reintenta sola en unos segundos.');
    }).then(function () { state.cargando = false; });
  }
  function setSync(kind, txt) {
    $('#syncDot').className = 'sync-dot' + (kind === 'error' ? ' is-error' : kind === 'loading' ? ' is-loading' : '');
    $('#syncTxt').textContent = txt || ('Actualizado ' + haceCuanto(ultimaCarga));
  }
  function programarRefresco() {
    clearInterval(state.timer);
    state.timer = setInterval(function () {
      if (document.hidden) return;
      cargar(true);
    }, Math.max(10, CFG.refrescoSegundos) * 1000);
  }
  setInterval(function () { if (ultimaCarga && !state.cargando && $('#syncDot').className === 'sync-dot') setSync('ok'); }, 5000);

  function buscar(id) { return state.citas.filter(function (c) { return c.id === id; })[0]; }

  /* ══════════ Pintado ══════════ */
  function pintar() {
    var r = rangoFechas();
    var t = $('#titulo');
    t.textContent = state.rango === 'semana' ? 'Próximos 7 días' : diaLargo(r[0]);
    var sub = el('small', null, state.rango === 'hoy' ? 'Hoy' : state.rango === 'manana' ? 'Mañana' : diaLargo(r[0]) + ' – ' + diaLargo(new Date(r[1].getTime() - 1)));
    t.appendChild(sub);
    var activas = state.citas.filter(function (c) { return !FUERA[estadoDe(c)]; });
    pintarResumen(activas);
    pintarContadores(activas);
    pintarAgenda();
  }

  function pintarResumen(activas) {
    var cuenta = {};
    activas.forEach(function (c) { var k = estadoDe(c); cuenta[k] = (cuenta[k] || 0) + 1; });
    var bar = $('#stripBar'); bar.innerHTML = '';
    var leg = $('#stripLegend'); leg.innerHTML = '';
    var partes = [];
    ['asistio', 'confirmada', 'no_asistio'].forEach(function (k) {
      if (!cuenta[k]) return;
      var seg = el('span', 'strip-seg');
      seg.style.flexGrow = cuenta[k];
      seg.style.background = colorDe(k);
      bar.appendChild(seg);
      var li = el('li');
      var dot = el('span', 'dot'); dot.style.background = colorDe(k);
      li.appendChild(dot);
      li.appendChild(el('b', null, String(cuenta[k])));
      li.appendChild(document.createTextNode(ESTADOS[k].label.toLowerCase()));
      leg.appendChild(li);
      partes.push(cuenta[k] + ' ' + ESTADOS[k].label.toLowerCase());
    });
    // En un solo día, el hueco que queda en la barra son las horas libres.
    var libres = Math.max(0, CFG.horas.length - activas.length);
    if (state.rango !== 'semana' && CFG.horas.length) {
      var segL = el('span', 'strip-seg'); segL.style.flexGrow = libres; segL.style.background = 'transparent'; bar.appendChild(segL);
      var liL = el('li'); liL.appendChild(el('b', null, String(libres))); liL.appendChild(document.createTextNode(libres === 1 ? 'hueco libre' : 'huecos libres')); leg.appendChild(liL);
      partes.push(libres + ' huecos libres');
    } else if (!activas.length) {
      var li0 = el('li'); li0.appendChild(el('b', null, '0')); li0.appendChild(document.createTextNode('citas en estas fechas')); leg.appendChild(li0);
    }
    bar.setAttribute('aria-label', activas.length + ' citas: ' + (partes.join(', ') || 'ninguna'));
  }

  function pintarContadores(activas) {
    var n = {
      todas: activas.length,
      web: activas.filter(function (c) { return c.origen === 'web'; }).length,
      lista: activas.filter(function (c) { return c.origen === 'lista_espera'; }).length,
      canceladas: state.citas.filter(function (c) { return estadoDe(c) === 'cancelada'; }).length
    };
    $$('[data-filtro]').forEach(function (b) {
      var k = b.getAttribute('data-filtro');
      var span = b.querySelector('.n') || b.appendChild(el('span', 'n'));
      span.textContent = n[k];
    });
  }

  function visibles() {
    var q = state.busqueda.trim().toLowerCase();
    return state.citas.filter(function (c) {
      var k = estadoDe(c);
      if (state.filtro === 'canceladas') { if (k !== 'cancelada') return false; }
      else if (k === 'cancelada' && state.filtro !== 'todas') return false;
      if (state.filtro === 'web' && c.origen !== 'web') return false;
      if (state.filtro === 'lista' && c.origen !== 'lista_espera') return false;
      if (q && (String(c.paciente) + ' ' + String(c.servicio)).toLowerCase().indexOf(q) === -1) return false;
      return true;
    });
  }

  function pintarAgenda() {
    var cont = $('#agenda'); cont.innerHTML = '';
    var lista = visibles();
    if (!lista.length) {
      var msg = state.citas.length ? 'Ninguna cita coincide con este filtro.' : (state.rango === 'hoy' ? 'Hoy no hay citas en la agenda.' : 'No hay citas en estas fechas.');
      return pintarVacio(msg, !state.citas.length);
    }
    var grupos = {}; var orden = [];
    lista.forEach(function (c) {
      var k = claveDia(new Date(c.inicio));
      if (!grupos[k]) { grupos[k] = []; orden.push(k); }
      grupos[k].push(c);
    });
    var hoyK = claveDia(new Date());
    orden.forEach(function (k) {
      var sec = el('section', 'day');
      if (state.rango === 'semana') {
        var h = el('h2', 'day-title', diaLargo(new Date(grupos[k][0].inicio)));
        h.appendChild(el('span', null, grupos[k].length === 1 ? '1 cita' : grupos[k].length + ' citas'));
        sec.appendChild(h);
      }
      var ul = el('ol', 'rows');
      var ahoraPuesto = k !== hoyK;
      grupos[k].forEach(function (c) {
        var t = new Date(c.inicio);
        if (!ahoraPuesto && t > new Date()) { ul.appendChild(marcaAhora()); ahoraPuesto = true; }
        ul.appendChild(fila(c));
      });
      if (!ahoraPuesto && k === hoyK) ul.appendChild(marcaAhora());
      sec.appendChild(ul);
      cont.appendChild(sec);
    });
  }

  function marcaAhora() {
    var li = el('li', 'now'); li.setAttribute('aria-hidden', 'true');
    li.appendChild(el('span', 'now-label', hora(new Date())));
    li.appendChild(el('span', 'now-line'));
    return li;
  }

  var TICK = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>';

  function fila(c) {
    var k = estadoDe(c);
    var t = new Date(c.inicio);
    var li = el('li', 'row' + (t < new Date() ? ' is-past' : '') + (FUERA[k] ? ' is-off' : ''));
    li.style.setProperty('--st', colorDe(k));
    li.setAttribute('data-id', String(c.id));
    li.appendChild(el('time', 'row-time', hora(t))).setAttribute('datetime', c.inicio);
    var axis = el('span', 'row-axis'); axis.appendChild(el('span', 'row-node')); li.appendChild(axis);

    var main = el('button', 'row-main');
    main.type = 'button';
    main.appendChild(el('span', 'row-name', c.paciente || 'Sin nombre'));
    main.appendChild(el('span', 'row-service', (c.servicio || '') + (c.origen === 'lista_espera' ? ', desde la lista de espera' : '')));
    main.setAttribute('aria-label', 'Abrir ficha de ' + (c.paciente || 'la cita') + ', ' + hora(t));
    main.addEventListener('click', function () { abrirFicha(c.id, main); });
    li.appendChild(main);

    var st = el('span', 'row-status');
    st.appendChild(el('span', 'dot')).style.background = colorDe(k);
    st.appendChild(document.createTextNode(ESTADOS[k].label));
    li.appendChild(st);

    // Sello: marcar «ha venido» de un toque.
    var seal = el('button', 'seal' + (k === 'asistio' ? ' is-on' : ''));
    seal.type = 'button';
    seal.innerHTML = TICK;
    if (k === 'asistio') {
      seal.setAttribute('aria-label', 'Ha venido');
      seal.setAttribute('aria-disabled', 'true');
    } else if (k !== 'confirmada') {
      seal.disabled = true;
      seal.setAttribute('aria-hidden', 'true');
    } else {
      seal.setAttribute('aria-label', 'Marcar que ' + (c.paciente || 'el paciente') + ' ha venido');
      seal.title = 'Ha venido';
      seal.addEventListener('click', function () { accion(c.id, 'asistio', null, seal); });
    }
    li.appendChild(seal);
    return li;
  }

  function pintarVacio(msg, conBoton) {
    var cont = $('#agenda'); cont.innerHTML = '';
    var box = el('div', 'empty');
    box.appendChild(el('p', null, msg));
    if (conBoton) {
      var b = el('button', 'btn btn-quiet', 'Añadir una cita');
      b.type = 'button';
      b.addEventListener('click', abrirNueva);
      box.appendChild(b);
    }
    cont.appendChild(box);
  }
  function pintarEsqueleto() {
    var cont = $('#agenda'); cont.innerHTML = '';
    for (var i = 0; i < 4; i++) cont.appendChild(el('div', 'skeleton'));
  }

  /* ══════════ Lista de espera ══════════ */
  var FRANJA = { manana: 'por la mañana', tarde: 'por la tarde', cualquiera: 'a cualquier hora' };
  function pintarEspera() {
    $('#esperaN').textContent = String(state.espera.length);
    var cont = $('#esperaLista'); cont.innerHTML = '';
    if (!state.espera.length) { cont.appendChild(el('p', 'hint', 'Nadie espera hueco en los próximos días.')); return; }
    var dias = {}; var orden = [];
    state.espera.forEach(function (e) { if (!dias[e.dia]) { dias[e.dia] = []; orden.push(e.dia); } dias[e.dia].push(e); });
    orden.forEach(function (d) {
      var h = el('h3', 'day-title', diaLargo(deIso(d)));
      h.appendChild(el('span', null, dias[d].length === 1 ? '1 persona' : dias[d].length + ' personas'));
      cont.appendChild(h);
      var ol = el('ol', 'history');
      dias[d].forEach(function (e) {
        var li = el('li', e.estado === 'ofrecido' ? null : 'is-pending');
        li.appendChild(document.createTextNode(e.nombre + ', ' + e.servicio + ' ' + FRANJA[e.franja]));
        var info = e.estado === 'ofrecido'
          ? 'Tiene ofrecido el hueco de las ' + String(e.hueco_ofrecido || '').slice(11, 16) + ' hasta las ' + hora(new Date(e.oferta_caduca_en))
          : 'Esperando hueco';
        li.appendChild(el('time', null, info));
        ol.appendChild(li);
      });
      cont.appendChild(ol);
    });
  }
  var volverFocoEspera = null;
  function abrirEspera() {
    volverFocoEspera = $('#verEspera');
    $('#scrim').hidden = false;
    $('#esperaDrawer').hidden = false;
    $('#esperaDrawer [data-cerrar]').focus();
  }
  function cerrarEspera() {
    if ($('#esperaDrawer').hidden) return;
    $('#esperaDrawer').hidden = true;
    if ($('#drawer').hidden) $('#scrim').hidden = true;
    if (volverFocoEspera) volverFocoEspera.focus();
  }

  /* ══════════ Acciones ══════════ */
  var MENSAJE = { asistio: 'Marcada como «ha venido»', no_asistio: 'Marcada como «no se presentó»', cancelar: 'Cita cancelada: el hueco se ofrece a la lista de espera', reabrir: 'Cita vuelta a «confirmada»', notas: 'Notas guardadas' };

  function accion(id, tipo, notas, boton) {
    if (boton) boton.disabled = true;
    var p = state.demo ? demoAccion(id, tipo, notas) : api('panel-reservas-accion', { method: 'POST', body: { id: id, accion: tipo, notas: notas } });
    return p.then(function () {
      if (state.demo) {
        var c = demoDB.filter(function (x) { return x.id === id; })[0];
        state.citas = state.citas.map(function (x) { return x.id === id ? Object.assign({}, c) : x; });
        pintar();
        if (state.abierta === id) pintarFicha(buscar(id));
      }
      if (tipo === 'asistio') {
        var sello = $('.row[data-id="' + id + '"] .seal');
        if (sello) sello.classList.add('is-stamp');
      }
      toast(MENSAJE[tipo]);
      if (!state.demo) cargar(true);
    }).catch(function (err) {
      if (err.clave) return salir('La clave de acceso no es correcta o ha caducado.');
      toast(err.mensaje || 'No se ha guardado el cambio. Vuelve a intentarlo.', true);
      if (boton) boton.disabled = false;
    });
  }

  /* ══════════ Ficha ══════════ */
  var volverFoco = null;
  function abrirFicha(id, origen) {
    var c = buscar(id); if (!c) return;
    state.abierta = id;
    volverFoco = origen || null;
    pintarFicha(c);
    $('#scrim').hidden = false;
    $('#drawer').hidden = false;
    $('#drawer [data-cerrar]').focus();
  }
  function cerrarFicha() {
    state.abierta = null;
    if ($('#drawer').hidden) return;
    $('#drawer').hidden = true;
    if ($('#esperaDrawer').hidden) $('#scrim').hidden = true;
    if (volverFoco && document.body.contains(volverFoco)) volverFoco.focus();
  }
  function pintarFicha(c) {
    var k = estadoDe(c); var t = new Date(c.inicio);
    var futura = t > new Date();
    $('#drawerCuando').textContent = diaLargo(t) + ', ' + hora(t);
    $('#drawerNombre').textContent = c.paciente || 'Sin nombre';
    $('#drawerServicio').textContent = c.servicio || '';
    var est = $('#drawerEstado'); est.innerHTML = ''; est.style.setProperty('--st', colorDe(k));
    est.appendChild(el('span', 'dot')).style.background = colorDe(k);
    est.appendChild(document.createTextNode(ESTADOS[k].label));

    var hist = $('#drawerHistoria'); hist.innerHTML = '';
    function paso(txt, fecha, pendiente) {
      var li = el('li', pendiente ? 'is-pending' : null, txt);
      if (fecha) { var tm = el('time', null, diaLargo(new Date(fecha)) + ', ' + hora(new Date(fecha))); tm.setAttribute('datetime', fecha); li.appendChild(tm); }
      hist.appendChild(li);
    }
    paso(ORIGEN[c.origen] || 'Reservada', c.creada);
    if (k === 'confirmada' && futura) paso(c.email ? 'Tiene en su email el enlace para cancelar' : 'Sin email: si cancela, será por teléfono', null, true);
    if (k === 'asistio') paso('Ha venido a la cita', null);
    if (k === 'no_asistio') paso('No se presentó', null);
    if (k === 'cancelada') paso(/panel/i.test(c.notas) ? 'Cancelada desde recepción' : 'Cancelada por el paciente', c.cancelada_en);

    var tel = String(c.telefono || '').replace(/[^\d+]/g, '');
    var dd = $('#drawerTel'); dd.innerHTML = '';
    if (tel) { var a = el('a', null, tel); a.href = 'tel:' + tel; dd.appendChild(a); } else dd.textContent = '—';
    var de = $('#drawerEmail'); de.innerHTML = '';
    if (c.email) { var m = el('a', null, c.email); m.href = 'mailto:' + c.email; de.appendChild(m); } else de.textContent = '—';

    var acc = $('#drawerAcciones'); acc.innerHTML = '';
    var opciones = [];
    if (k === 'confirmada') opciones.push(['asistio', 'Ha venido', 'btn-brass'], ['no_asistio', 'No se presentó', 'btn-quiet']);
    if (k === 'confirmada' && futura) opciones.push(['cancelar', 'Cancelar cita', 'btn-quiet']);
    if (k === 'asistio' || k === 'no_asistio') opciones.push(['reabrir', 'Volver a confirmada', 'btn-quiet']);
    opciones.forEach(function (o) {
      var b = el('button', 'btn ' + o[2], o[1]); b.type = 'button';
      b.addEventListener('click', function () {
        if (o[0] === 'cancelar' && !window.confirm('¿Cancelar la cita de ' + c.paciente + '? El hueco se ofrecerá a la lista de espera' + (c.email ? ' y le llegará un email de cancelación.' : '.'))) return;
        accion(c.id, o[0], null, b);
      });
      acc.appendChild(b);
    });

    var notas = $('#drawerNotas');
    if (document.activeElement !== notas) notas.value = c.notas || '';
  }

  /* ══════════ Nueva cita ══════════ */
  function abrirNueva() {
    var f = $('#nuevaForm'); f.reset(); $('#nuevaError').textContent = '';
    var iso = isoLocal(new Date());
    $('#nDia').value = iso; $('#nDia').min = iso;
    $('#modal').hidden = false;
    $('#nPaciente').focus();
  }
  function cerrarNueva() { $('#modal').hidden = true; $('#nuevaCita').focus(); }
  function guardarNueva(e) {
    e.preventDefault();
    var err = $('#nuevaError');
    var paciente = $('#nPaciente').value.trim();
    var telefono = $('#nTelefono').value.trim();
    var email = $('#nEmail').value.trim();
    var servicio = $('#nServicio').value;
    var dia = $('#nDia').value, h = $('#nHora').value;
    if (paciente.length < 2) { err.textContent = 'Escribe el nombre del paciente.'; return $('#nPaciente').focus(); }
    if (telefono && telefono.replace(/\D/g, '').length < 9) { err.textContent = 'El teléfono debe tener al menos 9 cifras.'; return $('#nTelefono').focus(); }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { err.textContent = 'El email no parece válido.'; return $('#nEmail').focus(); }
    if (!dia || !h) { err.textContent = 'Elige el día y la hora.'; return $('#nDia').focus(); }
    var inicio = new Date(dia + 'T' + h);
    var sem = inicio.getDay();
    if (isNaN(inicio) || inicio < new Date()) { err.textContent = 'La cita tiene que ser en el futuro.'; return $('#nHora').focus(); }
    if (sem === 0 || sem === 6) { err.textContent = 'La clínica no abre los fines de semana.'; return $('#nDia').focus(); }
    err.textContent = '';
    var btn = $('#nuevaForm [type=submit]'); btn.disabled = true;
    var datos = { paciente: paciente, telefono: telefono, email: email, servicio: servicio, hueco: dia + 'T' + h };
    var p;
    if (state.demo) {
      var ocupado = demoDB.some(function (c) { return c.estado !== 'cancelada' && new Date(c.inicio).getTime() === inicio.getTime(); });
      p = ocupado ? Promise.reject(Object.assign(new Error('ocupado'), { mensaje: 'Ese hueco ya está reservado. Elige otra hora.' }))
        : Promise.resolve().then(function () { demoDB.push({ id: demoDB.length + 1, paciente: paciente, telefono: telefono, email: email, servicio: servicio, inicio: inicio.toISOString(), estado: 'confirmada', origen: 'panel', creada: new Date().toISOString(), notas: '' }); });
    } else p = api('panel-reservas-nueva', { method: 'POST', body: datos });
    p.then(function () {
      cerrarNueva();
      toast('Cita guardada para el ' + diaLargo(inicio).toLowerCase() + ' a las ' + hora(inicio));
      cargar(true);
    }).catch(function (e2) {
      if (e2.clave) return salir('La clave de acceso no es correcta o ha caducado.');
      err.textContent = e2.mensaje || 'No se ha guardado la cita. Vuelve a intentarlo.';
    }).then(function () { btn.disabled = false; });
  }

  /* ══════════ Toast ══════════ */
  var toastTimer;
  function toast(msg, esError) {
    var t = $('#toast');
    t.textContent = msg; t.className = 'toast' + (esError ? ' is-error' : ''); t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.hidden = true; }, 3600);
  }

  /* ══════════ Acceso ══════════ */
  function entrar(demo) {
    state.demo = demo;
    if (demo && !demoDB) crearDemo();
    $('#login').hidden = true;
    $('#app').hidden = false;
    $('#demoBanner').hidden = !demo;
    cargar();
    programarRefresco();
  }
  function salir(motivo) {
    clearInterval(state.timer);
    store('session', CLAVE_KEY, null);
    state.clave = ''; state.citas = []; state.espera = [];
    cerrarFicha(); cerrarEspera();
    $('#app').hidden = true;
    $('#login').hidden = false;
    $('#loginError').textContent = motivo || '';
    $('#loginKey').value = '';
    $('#loginKey').focus();
  }

  /* ══════════ Tema ══════════ */
  function aplicarTema(t) {
    document.documentElement.setAttribute('data-theme', t);
    $('meta[name="theme-color"]').content = t === 'noche' ? '#0E1A16' : '#1F3A33';
  }

  /* ══════════ Arranque ══════════ */
  function init() {
    $$('[data-clinica]').forEach(function (n) { n.textContent = CFG.clinica; });
    $$('[data-monogram]').forEach(function (n) { n.textContent = CFG.clinica.trim().charAt(0).toUpperCase(); });
    document.title = 'Agenda · ' + CFG.clinica;
    var sel = $('#nServicio');
    (CFG.servicios.length ? CFG.servicios : ['Cita']).forEach(function (s) { sel.appendChild(el('option', null, s)).value = s; });
    var selH = $('#nHora');
    CFG.horas.forEach(function (h) { selH.appendChild(el('option', null, h)).value = h; });

    var tema = store('local', TEMA_KEY) || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'noche' : 'dia');
    aplicarTema(tema);
    $('#themeToggle').addEventListener('click', function () {
      var t = document.documentElement.getAttribute('data-theme') === 'noche' ? 'dia' : 'noche';
      aplicarTema(t); store('local', TEMA_KEY, t);
    });

    $$('[data-rango]').forEach(function (b) {
      b.addEventListener('click', function () {
        state.rango = b.getAttribute('data-rango');
        $$('[data-rango]').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
        state.citas = [];
        cargar();
      });
    });
    $$('[data-filtro]').forEach(function (b) {
      b.addEventListener('click', function () {
        state.filtro = b.getAttribute('data-filtro');
        $$('[data-filtro]').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
        pintarAgenda();
      });
    });
    $('#buscar').addEventListener('input', function (e) { state.busqueda = e.target.value; pintarAgenda(); });

    $('#nuevaCita').addEventListener('click', abrirNueva);
    $('#verEspera').addEventListener('click', abrirEspera);
    $('#nuevaForm').addEventListener('submit', guardarNueva);
    $('#modal').addEventListener('click', function (e) { if (e.target.id === 'modal') cerrarNueva(); });
    $('#scrim').addEventListener('click', function () { cerrarFicha(); cerrarEspera(); });
    $$('[data-cerrar]').forEach(function (b) {
      b.addEventListener('click', function () {
        if (b.closest('#modal')) cerrarNueva();
        else if (b.closest('#esperaDrawer')) cerrarEspera();
        else cerrarFicha();
      });
    });
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      if (!$('#modal').hidden) cerrarNueva();
      else if (!$('#drawer').hidden) cerrarFicha();
      else if (!$('#esperaDrawer').hidden) cerrarEspera();
    });
    $('#guardarNotas').addEventListener('click', function () {
      if (state.abierta) accion(state.abierta, 'notas', $('#drawerNotas').value.trim().slice(0, 300), $('#guardarNotas'));
    });
    $('#guardarNotas').addEventListener('blur', function () { $('#guardarNotas').disabled = false; });

    $('#loginForm').addEventListener('submit', function (e) {
      e.preventDefault();
      var k = $('#loginKey').value.trim();
      if (!k) return;
      state.clave = k;
      store('session', CLAVE_KEY, k);
      $('#loginError').textContent = '';
      entrar(false);
    });
    $('#loginDemo').addEventListener('click', function () { entrar(true); });
    $('#logout').addEventListener('click', function () { if (state.demo) { state.demo = false; } salir(); });
    document.addEventListener('visibilitychange', function () { if (!document.hidden && !$('#app').hidden) cargar(true); });

    var params = new URLSearchParams(location.search);
    if (params.has('demo') || !CFG.apiBase) return entrar(true);
    var guardada = store('session', CLAVE_KEY);
    if (guardada) { state.clave = guardada; entrar(false); } else { $('#login').hidden = false; $('#loginKey').focus(); }
  }

  init();
})();
