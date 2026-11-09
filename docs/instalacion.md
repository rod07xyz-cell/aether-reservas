# Instalación

Todo se instala en las cuentas de la clínica. Prueba siempre con datos ficticios y con tu propio email antes de enlazar la página desde la web de la clínica.

## 1. Tablas

En n8n → *Data tables*, crea dos tablas (los campos `id`, `createdAt` y `updatedAt` los añade n8n solo):

**`reservas`**

| Columna | Tipo | Notas |
|---|---|---|
| `hueco` | string | Día y hora en hora de la clínica, `AAAA-MM-DDTHH:mm`. Es la clave para detectar reservas dobles. |
| `inicio` | date | Lo mismo, como fecha. |
| `servicio` | string | |
| `nombre` | string | |
| `email` | string | Puede ir vacío en citas creadas en recepción. |
| `telefono` | string | Opcional. |
| `estado` | string | `confirmada`, `cancelada`, `anulada` (reserva doble descartada), `asistio` o `no_asistio`. |
| `origen` | string | `web`, `lista_espera` o `panel`. |
| `token` | string | Para el enlace «Ver o cancelar mi cita». |
| `gcal_event_id` | string | ID del evento en Google Calendar. |
| `cancelada_en` | date | |
| `notas` | string | |

**`lista_espera`**

| Columna | Tipo | Notas |
|---|---|---|
| `servicio` | string | |
| `dia` | string | `AAAA-MM-DD`. |
| `franja` | string | `manana`, `tarde` o `cualquiera`. |
| `nombre`, `email`, `telefono` | string | |
| `estado` | string | `esperando`, `ofrecido`, `aceptada`, `retirada` o `caducada` (el día pasó). |
| `token_oferta` | string | Enlace de un solo uso; se vacía al responder o caducar. |
| `hueco_ofrecido` | string | |
| `oferta_caduca_en` | date | |
| `huecos_descartados` | string | Huecos que ya rechazó o dejó pasar, separados por comas (no se le vuelven a ofrecer). |
| `reserva_id` | number | Reserva creada al aceptar. |
| `notas` | string | |

## 2. Credenciales en n8n

- **SMTP** con el correo de la clínica.
- **Google Calendar OAuth2** con la cuenta de Google de la clínica. En Google Cloud: crea un proyecto, activa **Google Calendar API** (no «Calendar MCP API»), configura la pantalla de consentimiento y crea un ID de cliente OAuth de tipo «Aplicación web» con la URI de redirección `https://TU-N8N/rest/oauth2-credential/callback`. Con la app en modo de prueba, Google pide volver a conectar la credencial cada 7 días; para uso real, publica la app.
- **Header Auth** para el panel: nombre de cabecera `X-Panel-Clave` y, como valor, una clave larga y aleatoria. Es la que escribirá recepción al entrar en el panel.

## 3. Workflows

Importa los workflows en este orden (los tres primeros son subworkflows que usan los demás):

1. `crear-reserva.json`
2. `cancelar-reserva.json`
3. `ofrecer-hueco.json`
4. `api-reservas.json`
5. `enlaces-emails.json`
6. `caducidad-ofertas.json`
7. `panel-api.json`

En cada uno, sustituye:

| Valor | Por |
|---|---|
| `CONFIGURAR_ID_TABLA_RESERVAS`, `CONFIGURAR_ID_TABLA_LISTA_ESPERA` | Los IDs de las tablas (en la URL de cada tabla). |
| `CONFIGURAR_ID_CREDENCIAL_…` | Elige la credencial en cada nodo (SMTP, Google Calendar, clave del panel). |
| `CONFIGURAR_ID_WORKFLOW_…` | En los nodos «Execute Workflow», elige el subworkflow correspondiente. |
| `CONFIGURAR_ID_CALENDARIO` | El ID del calendario (Google Calendar → configuración del calendario → «Integrar el calendario»). |
| `hola@tu-clinica.es` | Remitente y buzón que recibe los avisos de la clínica. |
| `https://tu-clinica.es/reservas` | La dirección donde publiques las páginas. Aparece en los emails y en el nodo «Validar hueco». |
| `https://tu-clinica.es` (CORS) | El dominio de la página, en las opciones de cada webhook. |

Revisa también:

- **Horario y servicios**: en los nodos de código «Validar hueco» (Crear reserva), «Validar petición» y «Calcular huecos» (API de reservas). Deben coincidir con `comun/config.js` y `panel/config.js`.
- **Plazo de la oferta**: en «Calcular plazo» (Ofrecer hueco). Por defecto, 2 horas y siempre 1 hora antes de la cita.

Publica primero los subworkflows y después el resto.

## 4. Páginas

1. Edita `comun/config.js`: nombre, dirección y teléfono de la clínica, `apiBase` (URL de los webhooks de n8n), enlace a la política de privacidad, servicios y horas.
2. Edita `panel/config.js`: nombre, `apiBase`, servicios y horas.
3. Publica las carpetas `comun/`, `reservar/`, `gestionar/`, `oferta/` y `panel/` en el dominio de la clínica, en la misma ruta que pusiste en los workflows.
4. Enlaza `reservar/` desde la web de la clínica («Pide cita»). El panel no se enlaza: recepción lo guarda en favoritos.

## 5. Prueba

1. Abre `reservar/`, reserva un hueco con tu email y comprueba el email y el evento en el calendario.
2. Apúntate con otro email a la lista de espera de ese mismo día.
3. Cancela la primera cita desde el enlace del email: el evento desaparece y el segundo email recibe la oferta.
4. Acepta la oferta y comprueba la cita nueva en el panel.
5. Lanza `node scripts/prueba-concurrencia.js` contra un hueco libre: una reserva entra y la otra recibe 409.
6. Borra las filas de prueba de las dos tablas y los eventos del calendario.
