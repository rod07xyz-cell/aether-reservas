/* Configuración del panel. Es lo único que cambia de una clínica a otra.
   No pongas aquí la clave de acceso: se escribe al entrar y solo vive en la pestaña. */
window.PANEL_CONFIG = {
  clinica: 'Fisio Movimiento',

  // Base de los endpoints del workflow «Panel API (reservas)» de n8n (sin barra final).
  // Vacío = el panel arranca directamente en modo demostración.
  apiBase: 'https://n8n.aetherlabsai.tech/webhook',

  servicios: [
    'Primera valoración',
    'Fisioterapia general',
    'Fisioterapia deportiva',
    'Punción seca',
    'Suelo pélvico',
    'Pilates terapéutico'
  ],

  // Debe coincidir con el horario de los workflows.
  horas: ['09:00', '10:00', '11:00', '12:00', '13:00', '16:00', '17:00', '18:00', '19:00'],

  zonaHoraria: 'Europe/Madrid',
  refrescoSegundos: 30
};
