/* Configuración de las páginas del paciente. Solo valores públicos: no pongas claves aquí.
   El horario y los servicios deben coincidir con los nodos de configuración de los workflows
   «API de reservas» y «Crear reserva». */
window.RESERVAS_CONFIG = {
  clinica: 'Fisio Movimiento',
  direccion: 'Calle Uría 00, Oviedo',
  telefono: '985 000 000',
  emailClinica: 'hola@tu-clinica.es',

  // Base de los webhooks de n8n (sin barra final). Vacío = las páginas funcionan solo en modo demostración.
  apiBase: 'https://n8n.aetherlabsai.tech/webhook',

  // Política de privacidad de la clínica.
  privacidadUrl: 'https://github.com/rod07xyz-cell/aether-reservas/blob/main/docs/privacidad.md',

  servicios: [
    { nombre: 'Primera valoración', detalle: 'Exploración y plan de tratamiento', minutos: 45 },
    { nombre: 'Fisioterapia general', detalle: 'Dolor de espalda, cuello, hombro…', minutos: 45 },
    { nombre: 'Fisioterapia deportiva', detalle: 'Lesiones y readaptación', minutos: 45 },
    { nombre: 'Punción seca', detalle: 'Puntos gatillo y contracturas', minutos: 45 },
    { nombre: 'Suelo pélvico', detalle: 'Embarazo, posparto e incontinencia', minutos: 45 },
    { nombre: 'Pilates terapéutico', detalle: 'Sesión individual guiada', minutos: 45 }
  ],

  zonaHoraria: 'Europe/Madrid',
  horas: ['09:00', '10:00', '11:00', '12:00', '13:00', '16:00', '17:00', '18:00', '19:00'],
  plazoOfertaHoras: 2
};
