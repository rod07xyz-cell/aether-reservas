# Qué recibe el cliente

La herramienta se instala **en las cuentas del cliente** y se le entrega funcionando. AetherLabsAI no aloja ni gestiona sus datos ni los de sus pacientes.

## Funcionando en sus cuentas

- [ ] Los siete workflows importados y publicados en **su** n8n.
- [ ] Tablas `reservas` y `lista_espera` creadas en **su** n8n.
- [ ] Credencial SMTP con **su** correo; remitente con el nombre de la clínica.
- [ ] Credencial de Google Calendar con **su** cuenta de Google y su calendario de citas.
- [ ] Clave del panel generada para la clínica (y solo para ella).
- [ ] Páginas publicadas en **su** dominio, con su horario, sus servicios y su política de privacidad.
- [ ] CORS de los webhooks limitado a ese dominio.

## Documentación

- [ ] Manual de una página para recepción: cómo dar una cita por teléfono desde el panel, cómo marcar «ha venido» o «no se presentó», cómo cancelar (el hueco va solo a la lista de espera) y qué significa cada estado de la lista.
- [ ] Qué hacer si cambia el horario o se añade un servicio (dónde se cambia en las páginas y en n8n).
- [ ] Lista de cuentas y credenciales creadas, con quién es el titular de cada una.
- [ ] Lista de proveedores que tratan datos (n8n o su alojamiento, correo, Google y alojamiento de la web) con el enlace a su acuerdo de tratamiento de datos.
- [ ] Texto para la política de privacidad (ver [`privacidad.md`](privacidad.md)).

## Pruebas hechas con el cliente

- [ ] Reserva desde el móvil de la clínica: email de confirmación y evento en su calendario.
- [ ] Dos reservas a la vez del mismo hueco: una entra y la otra recibe el aviso.
- [ ] Cancelación desde el enlace del email y desde el panel: el evento desaparece.
- [ ] Lista de espera: oferta recibida, rechazo (pasa al siguiente), plazo vencido (pasa al siguiente) y aceptación (cita nueva).
- [ ] Panel en el ordenador de recepción con la clave.

## Traspaso

- [ ] Accesos de desarrollo revocados al terminar (n8n, Google Cloud y alojamiento de las páginas).
- [ ] Sin copias de datos reales en equipos de AetherLabsAI (el desarrollo se hace con datos ficticios).

## Recurrente (opcional)

- **Mantenimiento**: cambios de horario, servicios o textos y revisión de incidencias. Si incluye acceso a su n8n, se firma un contrato de encargado del tratamiento limitado al mantenimiento.
- **Correo y Google**: los de sus propias cuentas, sin coste adicional en el uso normal de una clínica.
