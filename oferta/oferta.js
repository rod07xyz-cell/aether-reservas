// Página de la oferta de la lista de espera. Abrir el enlace no reserva nada (ver_oferta);
// la cita solo se crea al pulsar «Lo quiero» (POST aceptar). El enlace sirve una sola vez.
(function () {
  'use strict';

  var R = window.Reservas;
  var $ = R.$, $$ = R.$$;
  var token = (R.params.get('t') || '').trim().toLowerCase();
  var tokenValido = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(token);
  var oferta = null;
  var temporizador = null;
  var demoOferta = null;

  function mostrar(vista) {
    $$('[data-vista]').forEach(function (s) { s.hidden = s.getAttribute('data-vista') !== vista; });
    var h = $('[data-vista="' + vista + '"] h1');
    if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); }
  }

  function error(titulo, texto) {
    $('#errorTitulo').textContent = titulo;
    $('#errorTexto').textContent = texto;
    mostrar('error');
  }

  function enviar(accion, extra) {
    if (R.demo) {
      if (!demoOferta) {
        var d = new Date(); d.setDate(d.getDate() + 1);
        while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
        var hueco = R.isoDia(d) + 'T17:00';
        var caduca = new Date(Date.now() + (107 * 60 + 12) * 1000);
        demoOferta = { ok: true, tipo: 'oferta', vigente: true, estado: 'ofrecido', hueco: hueco, fecha_texto: R.textoHueco(hueco), servicio: 'Punción seca', nombre: 'Carla', caduca_en: caduca.toISOString() };
      }
      if (accion === 'aceptar') return R.esperar(700, { status: 200, body: { ok: true, fecha_texto: demoOferta.fecha_texto, servicio: demoOferta.servicio } });
      if (accion === 'rechazar') return R.esperar(600, { status: 200, body: { ok: true, seguir: extra.seguir } });
      return R.esperar(400, { status: 200, body: demoOferta });
    }
    var datos = { accion: accion, token: token };
    if (extra) Object.keys(extra).forEach(function (k) { datos[k] = extra[k]; });
    return R.post('reservas-enlace', datos);
  }

  var fmtHora = new Intl.DateTimeFormat('es-ES', { hour: '2-digit', minute: '2-digit', timeZone: (R.cfg.zonaHoraria || 'Europe/Madrid') });

  function tic() {
    var resta = new Date(oferta.caduca_en).getTime() - Date.now();
    if (resta <= 0) {
      clearInterval(temporizador);
      error('El plazo ha terminado', 'Este hueco ha pasado a la siguiente persona. Sigues en la lista de espera: si se libera otro, te avisaremos.');
      return;
    }
    var min = Math.floor(resta / 60000);
    var h = Math.floor(min / 60);
    $('#oQueda').textContent = 'quedan ' + (h ? h + ' h ' : '') + (min % 60) + ' min';
  }

  function pintar(o) {
    oferta = o;
    if (!o.vigente) {
      if (o.estado === 'aceptada') error('Ya aceptaste este hueco', 'Tu cita está confirmada. Tienes los detalles en el email de confirmación.');
      else error('El plazo ha terminado', 'Este hueco ha pasado a la siguiente persona. Sigues en la lista de espera: si se libera otro, te avisaremos.');
      return;
    }
    $('#ofertaTitulo').textContent = (o.nombre ? o.nombre + ', se' : 'Se') + ' ha liberado un hueco para ti';
    $('#oCuando').textContent = o.fecha_texto;
    $('#oServicio').textContent = o.servicio;
    $('#oHasta').textContent = fmtHora.format(new Date(o.caduca_en));
    tic();
    temporizador = setInterval(tic, 15000);
    mostrar('oferta');
  }

  function bloquear(si) { ['#aceptar', '#rechazar', '#salir'].forEach(function (s) { $(s).disabled = si; }); }

  function fallo(r) {
    var err = $('#errorOferta');
    if (r.status === 410 || r.status === 404) { clearInterval(temporizador); error('Este enlace ya no sirve', r.body.message || 'El plazo ha terminado.'); return; }
    err.textContent = r.status === 0 ? R.fallo() : (r.body.message || 'No hemos podido guardar tu respuesta.');
    err.hidden = false;
  }

  $('#aceptar').addEventListener('click', function () {
    var b = this;
    $('#errorOferta').hidden = true;
    bloquear(true);
    b.textContent = 'Reservando…';
    enviar('aceptar').then(function (r) {
      bloquear(false);
      b.textContent = 'Lo quiero';
      if (r.status === 200 && r.body.ok) {
        clearInterval(temporizador);
        $('#aCuando').textContent = r.body.fecha_texto || oferta.fecha_texto;
        $('#aServicio').textContent = r.body.servicio || oferta.servicio;
        mostrar('aceptada');
        return;
      }
      if (r.status === 409) { clearInterval(temporizador); error('El hueco ya no está disponible', r.body.message || 'Sigues en la lista de espera.'); return; }
      fallo(r);
    });
  });

  function rechazar(seguir) {
    $('#errorOferta').hidden = true;
    bloquear(true);
    enviar('rechazar', { seguir: seguir }).then(function (r) {
      bloquear(false);
      if (r.status === 200 && r.body.ok) {
        clearInterval(temporizador);
        $('#rechazadaTitulo').textContent = seguir ? 'Se lo ofrecemos a otra persona' : 'Te hemos quitado de la lista';
        $('#rechazadaTexto').textContent = seguir
          ? 'Gracias por responder. Sigues en la lista de espera de ese día: si se libera otro hueco, te avisaremos.'
          : 'Gracias por responder. Ya no recibirás más avisos para ese día.';
        mostrar('rechazada');
        return;
      }
      fallo(r);
    });
  }
  $('#rechazar').addEventListener('click', function () { rechazar(true); });
  $('#salir').addEventListener('click', function () { rechazar(false); });

  R.pintarMarca();
  if (!R.demo && !tokenValido) { error('Este enlace no es válido', 'Comprueba que lo has copiado entero desde el email.'); return; }
  enviar('ver_oferta').then(function (r) {
    if (r.status === 200 && r.body.ok) pintar(r.body);
    else if (r.status === 0) error('Sin conexión', R.fallo());
    else error('Este enlace ya no sirve', r.body.message || 'Este enlace ya se ha usado o no es válido.');
  });
})();
