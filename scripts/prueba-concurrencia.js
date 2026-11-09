// Prueba de reservas simultáneas: lanza dos reservas del mismo hueco a la vez.
// Lo esperado: una responde 200 (reservada) y la otra 409 («Ese hueco acaba de ocuparse»).
//
// Uso (Node 18 o superior):
//   node scripts/prueba-concurrencia.js https://TU-N8N/webhook 2026-11-20T10:00 tu-email@ejemplo.com
//
// Usa siempre datos ficticios y un email tuyo. Después, cancela la reserva desde el email o el panel.
const [apiBase, hueco, email] = process.argv.slice(2);
if (!apiBase || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(hueco || '') || !email) {
  console.error('Uso: node scripts/prueba-concurrencia.js <apiBase> <AAAA-MM-DDTHH:mm> <email>');
  process.exit(1);
}

function reservar(nombre) {
  return fetch(apiBase.replace(/\/$/, '') + '/reservas-api', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accion: 'reservar', hueco, servicio: 'Fisioterapia general', nombre, email, privacidad: true })
  }).then(async (r) => ({ nombre, status: r.status, body: await r.json().catch(() => ({})) }));
}

Promise.all([reservar('Prueba Ana'), reservar('Prueba Berta')]).then((res) => {
  res.forEach((r) => console.log(r.nombre.padEnd(14), r.status, r.body.ok ? 'reservada' : r.body.message));
  const ok = res.filter((r) => r.status === 200).length;
  const ocupado = res.filter((r) => r.status === 409).length;
  console.log(ok === 1 && ocupado === 1 ? '\nCorrecto: solo una reserva se ha quedado el hueco.' : '\nRevisa el resultado: se esperaba un 200 y un 409.');
});
