// Página de reserva: servicio → día → hora → datos. Si el día está completo, lista de espera.
(function () {
  'use strict';

  var R = window.Reservas;
  var cfg = R.cfg, $ = R.$, $$ = R.$$;
  var estado = { servicio: '', dias: [], dia: '', hueco: '', ocupadoDemo: {} };
  var fmtSemana = new Intl.DateTimeFormat('es-ES', { weekday: 'short' });
  var fmtMes = new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric' });
  var fmtLargo = new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });

  // ── Vistas ──
  function mostrar(vista) {
    $$('[data-vista]').forEach(function (s) { s.hidden = s.getAttribute('data-vista') !== vista; });
    var h = $('[data-vista="' + vista + '"] h1');
    if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); }
    window.scrollTo(0, 0);
  }

  function aviso(el, texto) { el.textContent = texto || ''; el.hidden = !texto; }

  // ── Resguardo de la columna ──
  function resguardo() {
    var d = estado.dia ? fmtLargo.format(R.deIso(estado.dia)) : '';
    [['#rServicio', estado.servicio], ['#rDia', d], ['#rHora', estado.hueco ? estado.hueco.slice(11, 16) : '']].forEach(function (p) {
      var el = $(p[0]);
      el.textContent = p[1] || 'Sin elegir';
      el.classList.toggle('vacio', !p[1]);
    });
  }

  function desbloquear(id, si) {
    var el = $(id);
    el.classList.toggle('paso--bloqueado', !si);
    el.setAttribute('aria-disabled', si ? 'false' : 'true');
  }

  // ── Paso 1: servicios ──
  function pintarServicios() {
    var cont = $('#servicios');
    (cfg.servicios || []).forEach(function (s, i) {
      var l = document.createElement('label');
      l.className = 'servicio';
      l.innerHTML = '<input type="radio" name="servicio">' +
        '<span class="servicio__marca" aria-hidden="true"></span>' +
        '<span class="servicio__texto"><span class="servicio__nombre"></span><span class="servicio__detalle"></span></span>' +
        '<span class="servicio__min"></span>';
      var input = l.querySelector('input');
      input.value = s.nombre;
      input.id = 'servicio' + i;
      l.querySelector('.servicio__nombre').textContent = s.nombre;
      l.querySelector('.servicio__detalle').textContent = s.detalle || '';
      l.querySelector('.servicio__min').textContent = (s.minutos || 45) + ' min';
      input.addEventListener('change', function () {
        var primera = !estado.servicio;
        estado.servicio = s.nombre;
        $('#pasoServicio').classList.add('paso--hecho');
        desbloquear('#pasoHora', true);
        resguardo();
        if (primera && window.innerWidth < 900) $('#pasoHora').scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
      cont.appendChild(l);
    });
  }

  // ── Huecos ──
  function huecosDemo() {
    var dias = [];
    var hoy = new Date();
    var minimo = new Date(Date.now() + 2 * 3600 * 1000);
    var n = 0;
    for (var i = 0; i <= 30; i++) {
      var d = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + i);
      if (d.getDay() === 0 || d.getDay() === 6) continue;
      n++;
      var iso = R.isoDia(d);
      var semilla = d.getDate() * 7 + d.getMonth() * 3;
      var huecos = cfg.horas.map(function (h, j) {
        var ini = new Date(d.getFullYear(), d.getMonth(), d.getDate(), +h.slice(0, 2), +h.slice(3, 5));
        var ocupado = n === 3 || n === 6 || ((semilla * 31 + j * 17 + n * 7) % 11 < 4 + (n % 3));
        return { hueco: iso + 'T' + h, hora: h, libre: ini >= minimo && !ocupado && !estado.ocupadoDemo[iso + 'T' + h] };
      });
      dias.push({ fecha: iso, libres: huecos.filter(function (x) { return x.libre; }).length, huecos: huecos });
    }
    return R.esperar(450, { status: 200, body: { ok: true, dias: dias } });
  }

  function cargarHuecos() {
    aviso($('#errorHuecos'), '');
    var p = R.demo ? huecosDemo() : R.post('reservas-api', { accion: 'huecos' });
    return p.then(function (r) {
      if (r.status !== 200 || !r.body.dias) {
        $('#dias').innerHTML = '';
        aviso($('#errorHuecos'), R.fallo());
        return;
      }
      estado.dias = r.body.dias;
      pintarDias();
      if (estado.dia) pintarHoras();
    });
  }

  // ── Paso 2: tira de días ──
  function pintarDias() {
    var cont = $('#dias');
    cont.innerHTML = '';
    estado.dias.forEach(function (d) {
      var f = R.deIso(d.fecha);
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'dia' + (d.libres ? '' : ' dia--lleno');
      b.setAttribute('aria-pressed', d.fecha === estado.dia ? 'true' : 'false');
      b.dataset.fecha = d.fecha;
      var barra = d.huecos.map(function (h) { return '<i class="' + (h.libre ? 'libre' : '') + '"></i>'; }).join('');
      b.innerHTML = '<span class="dia__semana"></span><span class="dia__num"></span>' +
        '<span class="dia__barra" aria-hidden="true">' + barra + '</span><span class="dia__estado"></span>';
      b.querySelector('.dia__semana').textContent = fmtSemana.format(f).replace('.', '');
      b.querySelector('.dia__num').textContent = f.getDate();
      b.querySelector('.dia__estado').textContent = d.libres ? (d.libres === 1 ? '1 hueco' : d.libres + ' huecos') : 'Completo';
      b.setAttribute('aria-label', fmtLargo.format(f) + ', ' + (d.libres ? d.libres + ' huecos libres' : 'completo, lista de espera'));
      b.addEventListener('click', function () { elegirDia(d.fecha); });
      cont.appendChild(b);
    });
    actualizarMes();
  }

  function actualizarMes() {
    var cont = $('#dias');
    var primero = cont.querySelector('.dia');
    if (!primero) return;
    var ancho = primero.getBoundingClientRect().width + 8;
    var idx = Math.min(estado.dias.length - 1, Math.round(cont.scrollLeft / ancho));
    var mes = fmtMes.format(R.deIso(estado.dias[idx].fecha));
    $('#diasMes').textContent = mes.charAt(0).toUpperCase() + mes.slice(1);
    $('#diasAtras').disabled = cont.scrollLeft < 4;
    $('#diasAdelante').disabled = cont.scrollLeft + cont.clientWidth >= cont.scrollWidth - 4;
  }

  function elegirDia(fecha) {
    estado.dia = fecha;
    estado.hueco = '';
    $$('.dia').forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.fecha === fecha ? 'true' : 'false'); });
    desbloquear('#pasoDatos', false);
    $('#pasoHora').classList.remove('paso--hecho');
    resguardo();
    pintarHoras();
  }

  function pintarHoras() {
    var d = estado.dias.filter(function (x) { return x.fecha === estado.dia; })[0];
    var cont = $('#horas');
    cont.innerHTML = '';
    if (!d) { $('#esperaEnlace').hidden = true; return; }
    if (!d.libres) {
      var b = document.createElement('div');
      b.className = 'bloque bloque--espera aparece';
      b.style.marginTop = '18px';
      b.innerHTML = '<h3 class="bloque__titulo" style="font:600 1.125rem/1.3 var(--serif)">Este día está completo</h3>' +
        '<p class="bloque__texto">Apúntate a la lista de espera: si alguien cancela, te ofreceremos su hueco por email.</p>' +
        '<button type="button" class="boton boton--laton" data-abrir-espera>Apuntarme a la lista de espera</button>';
      cont.appendChild(b);
      $('#esperaEnlace').hidden = true;
      return;
    }
    [['Mañana', function (h) { return +h.slice(0, 2) < 14; }], ['Tarde', function (h) { return +h.slice(0, 2) >= 14; }]].forEach(function (fr) {
      var lista = d.huecos.filter(function (h) { return fr[1](h.hora); });
      if (!lista.length) return;
      var bloque = document.createElement('div');
      bloque.className = 'franja';
      bloque.innerHTML = '<p class="franja__titulo"></p><div class="horas"></div>';
      bloque.querySelector('.franja__titulo').textContent = fr[0];
      lista.forEach(function (h) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'hora';
        btn.textContent = h.hora;
        btn.disabled = !h.libre;
        btn.setAttribute('aria-pressed', h.hueco === estado.hueco ? 'true' : 'false');
        btn.setAttribute('aria-label', h.hora + (h.libre ? '' : ', ocupado'));
        btn.addEventListener('click', function () { elegirHora(h.hueco); });
        bloque.querySelector('.horas').appendChild(btn);
      });
      cont.appendChild(bloque);
    });
    $('#esperaEnlace').hidden = false;
  }

  function elegirHora(hueco) {
    estado.hueco = hueco;
    $$('.hora').forEach(function (b) { b.setAttribute('aria-pressed', estado.dia + 'T' + b.textContent === hueco ? 'true' : 'false'); });
    $('#pasoHora').classList.add('paso--hecho');
    desbloquear('#pasoDatos', true);
    resguardo();
    if (window.innerWidth < 900) $('#pasoDatos').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // ── Validación de datos ──
  function errorCampo(input, texto) {
    var span = input.closest('.campo').querySelector('.error-campo');
    span.textContent = texto || '';
    span.hidden = !texto;
    input.setAttribute('aria-invalid', texto ? 'true' : 'false');
  }

  function leerDatos(form, pref) {
    var nombre = $('#' + pref + 'Nombre'), email = $('#' + pref + 'Email'), tel = $('#' + pref + 'Telefono'), priv = $('#' + pref + 'Privacidad');
    var ok = true, primero = null;
    function marca(input, texto) { errorCampo(input, texto); if (texto) { ok = false; primero = primero || input; } }
    marca(nombre, nombre.value.trim().length < 2 ? 'Escribe tu nombre.' : '');
    marca(email, /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim()) ? '' : 'Escribe un email válido: te enviaremos ahí la confirmación.');
    var digitos = tel.value.replace(/\D/g, '');
    marca(tel, tel.value.trim() && digitos.length < 9 ? 'El teléfono debe tener al menos 9 cifras.' : '');
    var pe = $('#' + pref + 'PrivacidadError');
    pe.textContent = priv.checked ? '' : 'Tienes que aceptar la política de privacidad para continuar.';
    pe.hidden = priv.checked;
    if (!priv.checked) { ok = false; primero = primero || priv; }
    if (primero) primero.focus();
    return ok ? {
      nombre: nombre.value.trim(), email: email.value.trim(), telefono: tel.value.trim(),
      privacidad: true, website: form.querySelector('[name="website"]').value
    } : null;
  }

  function copiarDatos(de, a) {
    ['Nombre', 'Email', 'Telefono'].forEach(function (c) { if (!$('#' + a + c).value) $('#' + a + c).value = $('#' + de + c).value; });
  }

  // ── Reservar ──
  function reservarDemo(datos) {
    if (datos.hueco.slice(11) === '12:00' && !estado.ocupadoDemo[datos.hueco]) {
      estado.ocupadoDemo[datos.hueco] = true;
      return R.esperar(700, { status: 409, body: { ok: false, error: 'ocupado', message: 'Ese hueco acaba de ocuparse. Elige otra hora.' } });
    }
    return R.esperar(700, { status: 200, body: { ok: true, hueco: datos.hueco, fecha_texto: R.textoHueco(datos.hueco), servicio: datos.servicio } });
  }

  $('#formReserva').addEventListener('submit', function (e) {
    e.preventDefault();
    var errorEl = $('#errorReserva');
    aviso(errorEl, '');
    if (!estado.servicio || !estado.hueco) { aviso(errorEl, 'Elige servicio, día y hora antes de confirmar.'); return; }
    var datos = leerDatos(this, 'r');
    if (!datos) return;
    datos.accion = 'reservar';
    datos.servicio = estado.servicio;
    datos.hueco = estado.hueco;
    var boton = $('#rEnviar');
    boton.disabled = true;
    boton.textContent = 'Reservando…';
    (R.demo ? reservarDemo(datos) : R.post('reservas-api', datos)).then(function (r) {
      boton.disabled = false;
      boton.textContent = 'Confirmar cita';
      if (r.status === 200 && r.body.ok) {
        $('#hCuando').textContent = r.body.fecha_texto || R.textoHueco(datos.hueco);
        $('#hServicio').textContent = r.body.servicio || datos.servicio;
        mostrar('hecho');
        return;
      }
      if (r.status === 409) {
        estado.hueco = '';
        desbloquear('#pasoDatos', false);
        $('#pasoHora').classList.remove('paso--hecho');
        resguardo();
        cargarHuecos().then(function () {
          aviso($('#errorHuecos'), (r.body.message || 'Ese hueco acaba de ocuparse.') + ' Tus datos siguen guardados.');
          $('#pasoHora').scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
        return;
      }
      aviso(errorEl, r.status === 0 ? R.fallo() : (r.body.message || 'No hemos podido reservar. Inténtalo de nuevo.'));
    });
  });

  // ── Lista de espera ──
  function abrirEspera() {
    if (!estado.dia) return;
    $('#esperaTitulo').textContent = 'Lista de espera del ' + fmtLargo.format(R.deIso(estado.dia));
    $('#esperaPlazo').textContent = (cfg.plazoOfertaHoras || 2) + ' horas';
    $('#esperaServicio').textContent = estado.servicio ? 'Servicio: ' + estado.servicio + '.' : '';
    copiarDatos('r', 'e');
    mostrar('espera');
  }

  document.addEventListener('click', function (e) {
    if (e.target.closest('[data-abrir-espera]')) abrirEspera();
    if (e.target.closest('[data-volver]')) { copiarDatos('e', 'r'); mostrar('reserva'); }
  });

  $('#formEspera').addEventListener('submit', function (e) {
    e.preventDefault();
    var errorEl = $('#errorEspera');
    aviso(errorEl, '');
    var datos = leerDatos(this, 'e');
    if (!datos) return;
    datos.accion = 'apuntarse';
    datos.servicio = estado.servicio;
    datos.dia = estado.dia;
    datos.franja = this.querySelector('[name="franja"]:checked').value;
    var boton = $('#eEnviar');
    boton.disabled = true;
    boton.textContent = 'Apuntando…';
    var p = R.demo ? R.esperar(600, { status: 200, body: { ok: true, dia: datos.dia, franja: datos.franja, repetido: false } }) : R.post('reservas-api', datos);
    p.then(function (r) {
      boton.disabled = false;
      boton.textContent = 'Apuntarme a la lista de espera';
      if (r.status === 200 && r.body.ok) {
        var franja = { cualquiera: 'a cualquier hora', manana: 'por la mañana', tarde: 'por la tarde' }[datos.franja];
        $('#ehTexto').textContent = (r.body.repetido ? 'Ya estabas apuntado' : 'Te hemos apuntado') + ' para el ' +
          fmtLargo.format(R.deIso(datos.dia)) + ', ' + franja + '. Si alguien cancela, te avisaremos por email.';
        mostrar('espera-hecha');
        return;
      }
      aviso(errorEl, r.status === 0 ? R.fallo() : (r.body.message || 'No hemos podido apuntarte. Inténtalo de nuevo.'));
    });
  });

  // ── Arranque ──
  $('#dias').addEventListener('scroll', function () { window.requestAnimationFrame(actualizarMes); }, { passive: true });
  $('#diasAtras').addEventListener('click', function () { $('#dias').scrollBy({ left: -$('#dias').clientWidth * 0.8, behavior: 'smooth' }); });
  $('#diasAdelante').addEventListener('click', function () { $('#dias').scrollBy({ left: $('#dias').clientWidth * 0.8, behavior: 'smooth' }); });

  R.pintarMarca();
  pintarServicios();
  resguardo();
  cargarHuecos();
})();
