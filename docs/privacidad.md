# Privacidad desde el diseño

Notas técnicas de cómo tratan los datos los workflows y las páginas. **No son asesoramiento jurídico**: cada clínica debe revisar su política de privacidad y su registro de actividades con su asesor.

## Qué datos se usan

- **Reserva**: nombre, email, teléfono (opcional), servicio, día y hora.
- **Lista de espera**: nombre, email, teléfono (opcional), servicio, día y franja.

No se pregunta el motivo de la consulta ni ningún dato clínico. Aun así, saber que alguien tiene cita en una clínica de fisioterapia, y para qué servicio, dice algo de su salud. Por eso:

- Los emails dicen el servicio y la hora, pero nada más.
- La página pública **nunca muestra datos de otros pacientes**: la consulta de huecos solo devuelve qué horas están libres u ocupadas.
- El panel de recepción, que sí muestra nombres y contactos, va protegido con una clave.

## Qué sale hacia cada proveedor

| Dato | n8n (alojamiento de la clínica) | Correo de la clínica | Google Calendar de la clínica | Páginas (alojamiento web) |
|---|---|---|---|---|
| Nombre, email y teléfono | Sí | Sí (destinatario y aviso interno) | Sí (título y descripción del evento) | Solo pasan por el navegador del paciente hacia n8n |
| Servicio, día y hora | Sí | Sí | Sí | Igual que arriba |

Las páginas no guardan nada en el servidor, no usan cookies, ni analítica, ni fuentes o scripts externos. El panel guarda la clave solo mientras la pestaña está abierta (`sessionStorage`).

No interviene ninguna IA.

## Base y aviso al paciente

- La base es la **gestión de la cita que el propio paciente pide**. La casilla de la página enlaza a la política de privacidad de la clínica.
- Los emails son **transaccionales** (confirmación, cancelación y aviso de hueco que el paciente ha pedido), no publicidad.
- Al apuntarse a la lista de espera, el paciente sabe que se le escribirá solo para ofrecerle un hueco. Desde cualquier oferta puede salir de la lista con un clic.

## Conservación

- La lista de espera se cierra sola (`caducada`) cuando pasa el día que pedía.
- Recomendación para el cliente: borrar o anonimizar periódicamente las reservas antiguas y las esperas cerradas según el plazo que fije su asesor (por ejemplo, una tarea de n8n mensual con la operación «Delete rows»).

## Protecciones

- **Tokens aleatorios** (UUID v4) en los enlaces. El de la oferta es de un solo uso y se vacía al aceptar, rechazar o caducar.
- **Los enlaces del email no escriben nada** (GET); solo los botones de las páginas cambian datos (POST).
- **Reservas dobles imposibles**: guardar y comprobar, gana la primera.
- **Entradas validadas** en n8n: acciones de una lista cerrada, servicios y horas del horario, textos recortados y sin `<` ni `>`, campo trampa contra robots.
- **CORS** limitado al dominio de las páginas.
