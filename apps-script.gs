// ============================================================
// GOOGLE APPS SCRIPT — Bambu Lab Inauguración 2026
// ============================================================
// SERVICIOS REQUERIDOS:
//   → Calendar API (Servicios → + → Google Calendar API → Agregar)
// ============================================================

const CONFIG = {
  SPREADSHEET_ID: '1ia5tz-1cRLPLRHPIHMbJnMrcoLX0WBDVu8SfwvuJqyg',
  SHEET_NAME:     'Registros',
  CALENDAR_ID:    'primary',
  EVENT_START:    '2026-03-28T10:00:00-03:00',
  EVENT_END:      '2026-03-28T20:00:00-03:00',
  TOTAL_PASSES:   300,
};

// -------------------------------------------------------
// doPost: recibe datos del formulario
// -------------------------------------------------------
function doPost(e) {
  try {
    const data      = JSON.parse(e.postData.contents);
    const nombre    = (data.nombre   || '').trim();
    const email     = (data.email    || '').trim();
    const telefono  = (data.telefono || '').trim();
    const novedades = data.novedades ? 'Sí' : 'No';

    const count = guardarEnSheet(nombre, email, telefono, novedades);

    // UID compartido entre el evento de Calendar y el ICS del email
    const uid       = Utilities.getUuid() + '@3dinsumos';
    const actualUid = crearEvento(nombre, email, telefono, uid); // devuelve el UID real de Google
    enviarEmailConfirmacion(nombre, email, count, actualUid || uid);

    return ContentService
      .createTextOutput(JSON.stringify({ success: true, count: count }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    Logger.log('ERROR en doPost: ' + err.toString());
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// -------------------------------------------------------
// doGet: devuelve conteo para la barra de progreso
// -------------------------------------------------------
function doGet() {
  try {
    const ss    = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
    const count = sheet ? Math.max(0, sheet.getLastRow() - 1) : 0;
    return ContentService
      .createTextOutput(JSON.stringify({ success: true, count: count, total: CONFIG.TOTAL_PASSES }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, count: 0, total: CONFIG.TOTAL_PASSES }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// -------------------------------------------------------
// guardarEnSheet
// -------------------------------------------------------
function guardarEnSheet(nombre, email, telefono, novedades) {
  const ss  = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  let sheet = ss.getSheetByName(CONFIG.SHEET_NAME);

  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.SHEET_NAME);
    sheet.appendRow(['Fecha', 'Nombre', 'Email', 'Teléfono', 'Acepta Novedades']);
    sheet.getRange(1, 1, 1, 5).setFontWeight('bold');
  }

  const fecha = Utilities.formatDate(new Date(), 'America/Argentina/Buenos_Aires', 'dd/MM/yyyy HH:mm');
  sheet.appendRow([fecha, nombre, email, telefono, novedades]);
  return sheet.getLastRow() - 1;
}

// crearEvento: usa Calendar.Events.import() con UID explícito
// para que el ICS del email y el evento queden vinculados
// -------------------------------------------------------
function crearEvento(nombre, email, telefono, uid) {
  const titulo = `Inauguracion Bambu Lab Buenos Aires - ${nombre}`;
  const desc   = [
    'Registro para la apertura de Bambu Lab Buenos Aires.',
    '',
    nombre,
    email,
    telefono || '-',
    '',
    'Av. Francisco Beiro 5785, Villa Real, CABA, CP 1419',
    'Entrada libre y gratuita',
  ].join('\n');

  const evento = {
    summary:     titulo,
    description: desc,
    location:    'Av. Francisco Beiro 5785, Villa Real, CABA, CP 1419',
    start:       { dateTime: CONFIG.EVENT_START, timeZone: 'America/Argentina/Buenos_Aires' },
    end:         { dateTime: CONFIG.EVENT_END,   timeZone: 'America/Argentina/Buenos_Aires' },
    iCalUID:     uid,                        // mismo UID que el ICS del email
    attendees:   [{ email: email, responseStatus: 'needsAction' }],
  };

  try {
    const created = Calendar.Events.insert(evento, CONFIG.CALENDAR_ID, {
      conferenceDataVersion: 0,
      sendUpdates: 'none',     // sin email de Google, lo mandamos nosotros
    });
    Logger.log('iCalUID real de Google: ' + created.iCalUID);
    return created.iCalUID;
  } catch (e) {
    Logger.log('ERROR al crear evento: ' + e.toString());
    return null;
  }
}

// enviarEmailConfirmacion: ICS con el mismo UID del evento de Calendar
// -------------------------------------------------------
function enviarEmailConfirmacion(nombre, email, numRegistro, uid) {
  const asunto = 'Tu lugar esta reservado — Inauguracion Bambu Lab Buenos Aires';

  // ── Generar ICS ──────────────────────────────────────────
  const organizerEmail = Session.getActiveUser().getEmail();

  const dtstamp  = Utilities.formatDate(new Date(), 'UTC', "yyyyMMdd'T'HHmmss'Z'");

  const icsLines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'CALSCALE:GREGORIAN',
    'PRODID:-//3D Insumos//Bambu Lab//ES',
    'METHOD:REQUEST',
    'BEGIN:VEVENT',
    'UID:' + uid,
    'DTSTAMP:' + dtstamp,
    'DTSTART:20260328T130000Z',
    'DTEND:20260328T230000Z',
    'SUMMARY:Inauguracion Bambu Lab Buenos Aires',
    'DESCRIPTION:Primera tienda oficial de Bambu Lab en Argentina. Entrada libre y gratuita.',
    'ORGANIZER;CN=3D Insumos:mailto:' + organizerEmail,
    'ATTENDEE;CUTYPE=INDIVIDUAL;ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE;CN=' + nombre + ':mailto:' + email,
    'SEQUENCE:0',
    'STATUS:CONFIRMED',
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  const icsBlob = Utilities.newBlob(icsLines.join('\r\n'), 'text/calendar;method=REQUEST', 'invite.ics');

  // ── HTML que aparece DEBAJO del bloque de Calendar ───────
  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:'Helvetica Neue',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:32px 20px;">
  <tr><td align="center">
    <table width="560" cellpadding="0" cellspacing="0" style="background:#111;border-radius:16px;overflow:hidden;border:1px solid #1e1e1e;">

      <!-- Header -->
      <tr>
        <td style="padding:36px 40px 28px;border-bottom:1px solid #1e1e1e;background:linear-gradient(135deg,#161616,#111);">
          <p style="margin:0 0 8px;color:#555;font-size:10px;font-weight:700;letter-spacing:3px;text-transform:uppercase;">Bambu Lab × 3D Insumos</p>
          <h1 style="margin:0;color:#fff;font-size:26px;font-weight:800;line-height:1.15;">Tu lugar está reservado.<br><span style="color:#00ae42;">Confirmá tu asistencia arriba.</span></h1>
        </td>
      </tr>

      <!-- Instrucción -->
      <tr>
        <td style="padding:28px 40px 0;">
          <table cellpadding="12" cellspacing="0" width="100%" style="background:#0d1f13;border:1px solid #1a3d20;border-radius:10px;">
            <tr>
              <td>
                <p style="margin:0 0 4px;color:#00ae42;font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;">Como confirmar</p>
                <p style="margin:0;color:#ccc;font-size:14px;line-height:1.6;">Mira la invitacion de calendario que aparece <strong style="color:#fff;">al principio de este email</strong>. Toca <strong style="color:#00ae42;">Si</strong> para confirmar tu asistencia y agregar el evento a tu calendario.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>

      <!-- Badge fecha + saludo -->
      <tr>
        <td style="padding:28px 40px 0;">
          <table cellpadding="0" cellspacing="0">
            <tr>
              <td style="background:#fff;border-radius:10px;padding:16px 22px;text-align:center;vertical-align:top;">
                <p style="margin:0;color:#000;font-size:30px;font-weight:800;letter-spacing:-1px;line-height:1;">28.03</p>
                <p style="margin:4px 0 0;color:#555;font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;">Apertura · Libre</p>
              </td>
              <td style="padding-left:20px;vertical-align:top;">
                <p style="margin:0 0 6px;color:#fff;font-size:17px;font-weight:700;">Hola, ${nombre}.</p>
                <p style="margin:0;color:#666;font-size:13px;line-height:1.5;">Sos el visitante <strong style="color:#fff;">#${numRegistro}</strong> de 300.<br>Entrada libre y gratuita.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>

      <!-- Detalles del evento -->
      <tr>
        <td style="padding:24px 40px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="padding:12px 0;border-bottom:1px solid #1a1a1a;">
                <p style="margin:0 0 3px;color:#555;font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;">DONDE</p>
                <p style="margin:0;color:#ccc;font-size:13px;">Av. Francisco Beiro 5785, Villa Real, CABA, CP 1419</p>
              </td>
            </tr>
            <tr>
              <td style="padding:12px 0;border-bottom:1px solid #1a1a1a;">
                <p style="margin:0 0 3px;color:#555;font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;">CUANDO</p>
                <p style="margin:0;color:#ccc;font-size:13px;">Sabado 28 de marzo de 2026 · 10:00 a 20:00 hs</p>
              </td>
            </tr>
            <tr>
              <td style="padding:12px 0;">
                <p style="margin:0 0 3px;color:#555;font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;">EL ESPACIO</p>
                <p style="margin:0;color:#ccc;font-size:13px;">Dos pisos · Showroom completo · Ver, probar y comprar</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>

      <!-- Maps link -->
      <tr>
        <td style="padding:0 40px 36px;">
          <a href="https://maps.google.com/?q=-34.61749912465096,-58.530168067538725" target="_blank"
             style="display:inline-block;color:#555;text-decoration:none;font-size:12px;border-bottom:1px solid #333;padding-bottom:2px;">
            Ver ubicación en Google Maps →
          </a>
        </td>
      </tr>

      <!-- Footer -->
      <tr>
        <td style="background:#0a0a0a;padding:18px 40px;border-top:1px solid #1a1a1a;">
          <p style="margin:0;color:#333;font-size:11px;">© 2026 · 3D Insumos · Bambu Lab Argentina · Authorized Retail Store</p>
        </td>
      </tr>

    </table>
  </td></tr>
</table>
</body>
</html>`;

  GmailApp.sendEmail(email, asunto, '', {
    htmlBody:    html,
    name:        '3D Insumos × Bambu Lab',
    attachments: [icsBlob],   // ← Gmail muestra Sí/No/Quizás arriba automáticamente
  });
}

// -------------------------------------------------------
// testManual: prueba completa — cambiá el email
// -------------------------------------------------------
function testManual() {
  const nombre   = 'Test Usuario';
  const email    = Session.getActiveUser().getEmail();
  const telefono = '1155551234';

  Logger.log('=== INICIANDO TEST ===');
  Logger.log('Spreadsheet ID: ' + CONFIG.SPREADSHEET_ID);

  const uid = Utilities.getUuid() + '@3dinsumos';

  try {
    Logger.log('Intentando abrir Sheet...');
    const count = guardarEnSheet(nombre, email, telefono, 'Si');
    Logger.log('OK Sheet — registro #' + count);
  } catch(e) { Logger.log('ERROR en Sheet: ' + e.toString()); return; }

  try {
    Logger.log('Intentando crear evento en Calendar...');
    crearEvento(nombre, email, telefono, uid);
    Logger.log('OK Calendar');
  } catch(e) { Logger.log('ERROR en Calendar: ' + e.toString()); }

  try {
    Logger.log('Intentando enviar email...');
    enviarEmailConfirmacion(nombre, email, 1, uid);
    Logger.log('OK Email enviado a: ' + email);
  } catch(e) { Logger.log('ERROR en Email: ' + e.toString()); }
}

// -------------------------------------------------------
// limpiarEventosDeclinados: elimina eventos cuyo invitado dijo No
// Se ejecuta automáticamente cada hora via trigger
// -------------------------------------------------------
function limpiarEventosDeclinados() {
  try {
    const ahora     = new Date();
    const resultado = Calendar.Events.list(CONFIG.CALENDAR_ID, {
      timeMin:      ahora.toISOString(),
      singleEvents: true,
      maxResults:   500,
    });

    if (!resultado.items || resultado.items.length === 0) return;

    let eliminados = 0;
    for (const evento of resultado.items) {
      if (!evento.attendees) continue;
      // Si todos los invitados declinaron → eliminar
      const todosDeclinaron = evento.attendees.every(a => a.responseStatus === 'declined');
      if (todosDeclinaron) {
        Calendar.Events.remove(CONFIG.CALENDAR_ID, evento.id);
        Logger.log('Evento eliminado (declino): ' + evento.summary);
        eliminados++;
      }
    }
    Logger.log('Limpieza completada. Eliminados: ' + eliminados);
  } catch(e) {
    Logger.log('ERROR en limpiarEventosDeclinados: ' + e.toString());
  }
}

// -------------------------------------------------------
// crearTrigger: ejecutar UNA SOLA VEZ para activar la limpieza automática
// Luego se puede borrar esta función
// -------------------------------------------------------
function crearTrigger() {
  // Evitar duplicados
  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() === 'limpiarEventosDeclinados') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('limpiarEventosDeclinados')
    .timeBased()
    .everyMinutes(15)
    .create();
  Logger.log('Trigger creado: limpiarEventosDeclinados cada 15 minutos');
}
