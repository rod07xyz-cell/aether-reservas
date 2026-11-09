// Página «Tu cita»: abrir el enlace solo consulta (ver_reserva). Cancelar requiere pulsar dos botones (POST).
(function () {
  'use strict';

  var R = window.Reservas;
  var $ = R.$, $$ = R.$$;
  var token = (R.params.get('t') || '').trim().toLowerCase();
  var tokenValido = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(token);
  var demoCita = null;

  function mostrar(vista) {
    $$('[data-vista]').forEach(function (s) { s.hidden = s.getAttribute('data-vista') !== vista; });
    var h = $('[data-vista="' + vista + '"] h1');
    if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); }
  }

  function enviar(accion) {
    if (R.demo) {
      if (!demoCita) {
        var d = new Date(); d.setDate(d.getDate() + 3);
        while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
        var hueco = R.isoDia(d) + 'T10:00';
        demoCita = { ok: true, tipo: 'reserva', estado: 'confirmada', hueco: hueco, fecha_texto: R.textoHueco(hueco), servicio: 'Fisioterapia general', nombre: 'Lucía', cancelable: true };
      }
      if (accion === 'cancelar') { demoCita.estado = 'cancelada'; demoCita.cancelable = false; return R.esperar(700, { status: 200, body: { ok: true, fecha_texto: demoCita.fecha_texto } }); }
      return R.esperar(400, { status: 200, body: demoCita });
    }
    return R.post('reservas-enlace', { accion: accion, token: token });
  }

  function error(texto) { $('#errorTexto').textContent = texto; mostrar('error'); }

  function pintar(c) {
    $('#cCuando').textContent = c.fecha_texto;
    $('#cServicio').textContent = c.servicio;
    $('#zonaCancelar').hidden = !c.cancelable;
    if (c.estado === 'confirmada' && c.cancelable) {
      $('#citaTitulo').textContent = (c.nombre ? c.nombre + ', te' : 'Te') + ' esperamos';
      $('#citaTexto').textContent = 'Si no puedes venir, cancela aquí: así otra persona de la lista de espera puede aprovechar el hueco.';
    } else if (c.estado === 'confirmada') {
      $('#citaTitulo').textContent = 'Esta cita ya ha pasado';
      $('#citaTexto').textContent = 'Si necesitas otra, puedes reservarla en nuestra página.';
    } else {
      $('#citaTitulo').textContent = 'Esta cita está cancelada';
      $('#citaTexto').textContent = 'No tienes que hacer nada más. Si quieres otra cita, puedes reservarla cuando quieras.';
    }
    mostrar('cita');
  }

  $('#pedirCancelar').addEventListener('click', function () {
    $('#paso1').hidden = true;
    $('#paso2').hidden = false;
    $('#confirmarCancelar').focus();
  });
  $('#noCancelar').addEventListener('click', function () {
    $('#paso2').hidden = true;
    $('#paso1').hidden = false;
    $('#pedirCancelar').focus();
  });
  $('#confirmarCancelar').addEventListener('click', function () {
    var b = this;
    var err = $('#errorCancelar');
    err.hidden = true;
    b.disabled = true;
    b.textContent = 'Cancelando…';
    enviar('cancelar').then(function (r) {
      b.disabled = false;
      b.textContent = 'Sí, cancelar la cita';
      if (r.status === 200 && r.body.ok) { mostrar('cancelada'); return; }
      err.textContent = r.status === 0 ? R.fallo() : (r.body.message || 'No hemos podido cancelar la cita.');
      err.hidden = false;
    });
  });

  R.pintarMarca();
  if (!R.demo && !tokenValido) { error('Este enlace no es válido. Comprueba que lo has copiado entero desde el email.'); return; }
  enviar('ver_reserva').then(function (r) {
    if (r.status === 200 && r.body.ok) pintar(r.body);
    else if (r.status === 0) error(R.fallo());
    else error(r.body.message || 'Este enlace no es válido.');
  });
})();
