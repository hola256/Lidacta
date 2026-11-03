import { Resend } from 'resend';

export const config = {
  maxDuration: 15,
};

// Vercel Serverless Function for /api/send-email
export default async function handler(req: any, res: any) {
  // CORS Configuration
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      message: 'Método no permitido. Utiliza POST.',
    });
  }

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {}
    }
    body = body || {};

    const { to, email, subject, html, text, type, name, role, companyName } = body;
    const targetEmail = (to || email || '').trim().toLowerCase();

    if (!targetEmail || !targetEmail.includes('@')) {
      return res.status(400).json({
        success: false,
        message: 'Destinatario de correo inválido o ausente.',
      });
    }

    const resendApiKey = process.env.RESEND_API_KEY;
    const fromEmail = process.env.RESEND_FROM_EMAIL || 'Lidacta <notificaciones@taniapadierna.com>';
    const replyToEmail = process.env.RESEND_REPLY_TO || 'hola@taniapadierna.com';

    console.log(`[API /api/send-email] 🚀 Despachando correo a ${targetEmail} (Tipo: "${type || 'standard'}", Asunto: "${subject || 'Notificación Lidacta'}")`);
    console.log(`[API /api/send-email] Remitente: ${fromEmail}, Reply-To: ${replyToEmail}`);

    if (!resendApiKey || !resendApiKey.trim()) {
      console.warn('[API /api/send-email] ⚠️ RESEND_API_KEY no configurada. Simulando despacho exitoso en entorno local/test.');
      return res.status(200).json({
        success: true,
        emailId: `sim_${Date.now()}`,
        id: `sim_${Date.now()}`,
        simulated: true,
        message: 'Correo simulado exitosamente (RESEND_API_KEY no configurada en este entorno).',
      });
    }

    const resend = new Resend(resendApiKey.trim());
    const recipientName = name || body.leaderName || 'Líder';
    const compName = companyName || body.companyName || 'Industrias Nexus Automotriz';
    const challengeTitle = body.challengeTitle || 'Desafío de Liderazgo en Acción';
    const plan = body.actionPlan || {};
    const actionWhat = plan.what || body.actionWhat || 'Conversación 1 a 1 de alineación operativa';
    const actionWhen = plan.when || body.actionWhen || 'Esta semana';
    const actionWithWhom = plan.withWhom || body.actionWithWhom || 'Equipo / Colaborador';
    const actionCare = plan.careReminders || body.careReminders || 'Escucha activa y foco en hechos observables';
    const lastActiveFormatted = body.lastActiveFormatted || body.lastActiveAt || new Date().toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    const leaderPosition = body.leaderPosition || 'Líder Operativo';
    const leaderArea = body.leaderArea || 'Operaciones';
    const leaderWhatsapp = body.leaderWhatsapp || body.whatsapp || 'No registrado';
    const targetLeaderEmail = body.leaderEmail || targetEmail;

    let defaultHtml: string;
    let defaultText: string;
    let finalSubject: string;

    // 1. CORREO DE ACOMPAÑAMIENTO EN ETAPA 5 (A LAS 48 HORAS)
    if (type === 'stage5_48h') {
      finalSubject = subject || 'Apoyo continuo para revisar el primer paso de tu compromiso en Lidacta';
      defaultHtml = `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><title>${finalSubject}</title></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #F8F6F4; margin: 0; padding: 24px; color: #2D1B4E;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(45, 27, 78, 0.08); border: 1px solid #EADBCE;">
    <tr>
      <td style="background-color: #2D1B4E; padding: 32px 24px; text-align: center;">
        <h1 style="color: #FFF7EF; font-size: 24px; margin: 0 0 8px 0; font-weight: 800;">LIDACTA</h1>
        <p style="color: #F7B538; font-size: 13px; margin: 0; font-weight: 600; text-transform: uppercase;">Acompañamiento Etapa 5 · Primeras 48 Horas</p>
      </td>
    </tr>
    <tr>
      <td style="padding: 32px 28px;">
        <span style="display: inline-block; padding: 4px 12px; background-color: #FFD3BF; color: #BF3A1B; border-radius: 20px; font-size: 11px; font-weight: 700; text-transform: uppercase; margin-bottom: 12px;">Apoyo Continuo Lidacta</span>
        <h2 style="font-size: 20px; color: #2D1B4E; margin: 0 0 16px 0;">¡Hola ${recipientName}!</h2>
        <p style="font-size: 14px; line-height: 1.6; color: #4A3F55; margin: 0 0 16px 0;">
          Han transcurrido <strong>48 horas</strong> desde que definiste tu plan de acción en Lidacta para tu desafío: <em>"${challengeTitle}"</em>.
        </p>
        <p style="font-size: 14px; line-height: 1.6; color: #4A3F55; margin: 0 0 20px 0;">
          Queremos recordarte que cuentas con este espacio para dar ese primer paso con tranquilidad, claridad y enfoque. Revisemos los puntos clave de tu compromiso:
        </p>
        <div style="background-color: #FFF7EF; border: 1px solid #EADBCE; padding: 20px; border-radius: 12px; margin: 0 0 24px 0;">
          <h4 style="font-size: 13px; font-weight: 800; color: #2D1B4E; margin: 0 0 12px 0; text-transform: uppercase;">📋 Ficha de tu Plan de Acción:</h4>
          <p style="font-size: 13px; color: #4A3F55; margin: 0 0 8px 0;">• <strong>¿Qué harás?:</strong> ${actionWhat}</p>
          <p style="font-size: 13px; color: #4A3F55; margin: 0 0 8px 0;">• <strong>¿Cuándo?:</strong> ${actionWhen}</p>
          <p style="font-size: 13px; color: #4A3F55; margin: 0 0 8px 0;">• <strong>¿Con quién?:</strong> ${actionWithWhom}</p>
          <p style="font-size: 13px; color: #4A3F55; margin: 0;">• <strong>Aspecto clave a cuidar:</strong> ${actionCare}</p>
        </div>
        <div style="background-color: #F8F6F4; border-left: 4px solid #F7B538; padding: 14px 18px; border-radius: 8px; margin: 0 0 24px 0;">
          <p style="font-size: 13px; line-height: 1.6; color: #2D1B4E; margin: 0; font-style: italic;">
            "Recuerda que el liderazgo efectivo se forja en las conversaciones reales del día a día. No busques una conversación perfecta; busca una conversación intencional, abierta y basada en hechos observables."
          </p>
        </div>
        <p style="font-size: 13px; line-height: 1.6; color: #4A3F55; margin: 0 0 24px 0;">
          En cuanto lleves a cabo tu acción o si necesitas ajustar algún detalle antes de ejecutarla, ingresa a Lidacta para avanzar con tu mentor.
        </p>
        <div style="border-top: 1px solid #EADBCE; padding-top: 16px; margin-top: 20px;">
          <p style="font-size: 14px; font-weight: 800; color: #2D1B4E; margin: 0 0 4px 0;">Lidacta</p>
          <p style="font-size: 12px; color: #BF3A1B; margin: 0; font-weight: 600;">Desarrollo de Liderazgo en Acción</p>
        </div>
      </td>
    </tr>
    <tr>
      <td style="background-color: #FFF7EF; padding: 20px 24px; text-align: center; border-top: 1px solid #EADBCE;">
        <p style="font-size: 11px; color: #4A3F55; margin: 0;">🔒 Tu proceso es 100% confidencial · Lidacta © ${new Date().getFullYear()}</p>
      </td>
    </tr>
  </table>
</body>
</html>`;
      defaultText = `¡Hola ${recipientName}!\n\nHan transcurrido 48 horas desde que definiste tu plan de acción en Lidacta para tu desafío: "${challengeTitle}".\n\nEste es un recordatorio de apoyo continuo para acompañarte a dar ese primer paso con tranquilidad y enfoque:\n\n• ¿Qué harás?: ${actionWhat}\n• ¿Cuándo?: ${actionWhen}\n• ¿Con quién?: ${actionWithWhom}\n• Qué vas a cuidar: ${actionCare}\n\nRecuerda: El liderazgo se forja en las conversaciones reales del día a día. No busques la perfección, busca una conversación intencional y basada en hechos observables.\n\nEn cuanto ejecutes tu acción, regresa a Lidacta para registrar qué ocurrió en la Etapa 6.\n\nAtentamente,\nEl Equipo de Lidacta\nResponder a: ${replyToEmail}`;

    // 2. CORREO DE SEGUIMIENTO EN ETAPA 5 (A LOS 5 DÍAS)
    } else if (type === 'stage5_5d') {
      finalSubject = subject || 'Seguimiento de tu plan de acción en Lidacta: consolidando avances hacia la Etapa 6';
      defaultHtml = `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><title>${finalSubject}</title></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #F8F6F4; margin: 0; padding: 24px; color: #2D1B4E;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(45, 27, 78, 0.08); border: 1px solid #EADBCE;">
    <tr>
      <td style="background-color: #2D1B4E; padding: 32px 24px; text-align: center;">
        <h1 style="color: #FFF7EF; font-size: 24px; margin: 0 0 8px 0; font-weight: 800;">LIDACTA</h1>
        <p style="color: #F7B538; font-size: 13px; margin: 0; font-weight: 600; text-transform: uppercase;">Acompañamiento Etapa 5 · Consolidación Día 5</p>
      </td>
    </tr>
    <tr>
      <td style="padding: 32px 28px;">
        <span style="display: inline-block; padding: 4px 12px; background-color: #C9BDF2; color: #2D1B4E; border-radius: 20px; font-size: 11px; font-weight: 700; text-transform: uppercase; margin-bottom: 12px;">Consolidación de Avances</span>
        <h2 style="font-size: 20px; color: #2D1B4E; margin: 0 0 16px 0;">¡Hola ${recipientName}!</h2>
        <p style="font-size: 14px; line-height: 1.6; color: #4A3F55; margin: 0 0 16px 0;">
          Han transcurrido <strong>5 días</strong> desde que estableciste tu plan de acción en Lidacta para tu desafío: <em>"${challengeTitle}"</em>.
        </p>
        <div style="background-color: #FFF7EF; border: 1px solid #EADBCE; padding: 18px; border-radius: 12px; margin: 0 0 20px 0;">
          <p style="font-size: 13px; font-weight: 800; color: #2D1B4E; margin: 0 0 8px 0;">📌 Tu Compromiso Registrado:</p>
          <p style="font-size: 13px; color: #4A3F55; margin: 0 0 6px 0;">• <strong>Acción:</strong> ${actionWhat}</p>
          <p style="font-size: 13px; color: #4A3F55; margin: 0 0 6px 0;">• <strong>Programada para:</strong> ${actionWhen}</p>
          <p style="font-size: 13px; color: #4A3F55; margin: 0;">• <strong>Con:</strong> ${actionWithWhom}</p>
        </div>
        <p style="font-size: 14px; line-height: 1.6; color: #4A3F55; margin: 0 0 16px 0;">
          Es un excelente momento para hacer una pausa previa: ¿pudiste llevar a cabo la acción acordada?, ¿qué funcionó y qué respuestas observaste en tu colaborador o equipo?
        </p>
        <p style="font-size: 14px; line-height: 1.6; color: #4A3F55; margin: 0 0 24px 0;">
          Te invitamos a ingresar a Lidacta para concluir tu plan de acción y avanzar a la <strong>Etapa 6 (Aprender y reflexionar tras la acción)</strong>, donde extraerás reflexiones esenciales que fortalecerán tu autonomía como líder.
        </p>
        <div style="border-top: 1px solid #EADBCE; padding-top: 16px; margin-top: 20px;">
          <p style="font-size: 14px; font-weight: 800; color: #2D1B4E; margin: 0 0 4px 0;">Lidacta</p>
          <p style="font-size: 12px; color: #BF3A1B; margin: 0; font-weight: 600;">Desarrollo de Liderazgo en Acción</p>
        </div>
      </td>
    </tr>
    <tr>
      <td style="background-color: #FFF7EF; padding: 20px 24px; text-align: center; border-top: 1px solid #EADBCE;">
        <p style="font-size: 11px; color: #4A3F55; margin: 0;">🔒 Tu proceso es 100% confidencial · Lidacta © ${new Date().getFullYear()}</p>
      </td>
    </tr>
  </table>
</body>
</html>`;
      defaultText = `¡Hola ${recipientName}!\n\nHan transcurrido 5 días desde que estableciste tu plan de acción en Lidacta para tu desafío: "${challengeTitle}".\n\nTu compromiso:\n• Acción: ${actionWhat}\n• Programada: ${actionWhen}\n• Con: ${actionWithWhom}\n\nEs un excelente momento para hacer una pausa de seguimiento previo: ¿pudiste llevar a cabo la acción acordada? ¿Qué respuestas observaste en tu equipo?\n\nTe invitamos a ingresar a Lidacta para concluir la Etapa 5 y pasar a la Etapa 6 (Aprender y reflexionar tras la acción) para consolidar tus aprendizajes clave.\n\nAtentamente,\nEl Equipo de Lidacta\nResponder a: ${replyToEmail}`;

    // 3. ALERTA DE INACTIVIDAD PARA LA ADMINISTRADORA (A PARTIR DEL DÍA 8)
    } else if (type === 'stage5_inactivity_admin') {
      finalSubject = subject || `🚨 Alerta de Inactividad (Día 8): ${recipientName} (${compName}) sin avances en Etapa 5`;
      defaultHtml = `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><title>${finalSubject}</title></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #F8F6F4; margin: 0; padding: 24px; color: #2D1B4E;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(45, 27, 78, 0.08); border: 2px solid #BF3A1B;">
    <tr>
      <td style="background-color: #2D1B4E; padding: 32px 24px; text-align: center;">
        <h1 style="color: #FFF7EF; font-size: 24px; margin: 0 0 8px 0; font-weight: 800;">LIDACTA</h1>
        <p style="color: #F7B538; font-size: 13px; margin: 0; font-weight: 700; text-transform: uppercase;">Alerta de Monitoreo Directivo · Día 8</p>
      </td>
    </tr>
    <tr>
      <td style="padding: 32px 28px;">
        <span style="display: inline-block; padding: 4px 12px; background-color: #FDE8E8; color: #9B1C1C; border-radius: 20px; font-size: 11px; font-weight: 800; text-transform: uppercase; margin-bottom: 12px;">🚨 Alerta de Inactividad</span>
        <h2 style="font-size: 20px; color: #2D1B4E; margin: 0 0 16px 0;">Estimada Tania:</h2>
        <p style="font-size: 14px; line-height: 1.6; color: #4A3F55; margin: 0 0 16px 0;">
          El sistema de monitoreo de Lidacta ha detectado que han transcurrido <strong>8 días calendario</strong> desde que el siguiente líder finalizó su compromiso en la <strong>Etapa 5</strong> sin que haya ingresado a la plataforma ni registrado avances hacia la Etapa 6:
        </p>

        <!-- Ficha de Datos del Líder -->
        <div style="background-color: #FFF7EF; border: 1px solid #EADBCE; padding: 20px; border-radius: 12px; margin: 0 0 20px 0;">
          <h4 style="font-size: 13px; font-weight: 800; color: #2D1B4E; margin: 0 0 12px 0; text-transform: uppercase; border-bottom: 1px solid #EADBCE; padding-bottom: 6px;">📋 Datos del Líder e Inactividad:</h4>
          <p style="font-size: 13px; color: #4A3F55; margin: 0 0 8px 0;">• <strong>Nombre del Líder:</strong> <span style="color: #2D1B4E; font-weight: 700;">${recipientName}</span></p>
          <p style="font-size: 13px; color: #4A3F55; margin: 0 0 8px 0;">• <strong>Empresa:</strong> <span style="color: #2D1B4E; font-weight: 700;">${compName}</span></p>
          <p style="font-size: 13px; color: #4A3F55; margin: 0 0 8px 0;">• <strong>Puesto / Área:</strong> ${leaderPosition} (Área: ${leaderArea})</p>
          <p style="font-size: 13px; color: #4A3F55; margin: 0 0 8px 0;">• <strong>Fecha del último acceso:</strong> <span style="color: #BF3A1B; font-weight: 700;">${lastActiveFormatted}</span></p>
          <p style="font-size: 13px; color: #4A3F55; margin: 0 0 8px 0;">• <strong>Etapa actual:</strong> <span style="background-color: #FFD3BF; color: #BF3A1B; padding: 2px 8px; border-radius: 6px; font-weight: 700;">Etapa 5 (Compromiso y Plan de Acción)</span></p>
          <p style="font-size: 13px; color: #4A3F55; margin: 0;">• <strong>Desafío en curso:</strong> "${challengeTitle}"</p>
        </div>

        <!-- Resumen Breve de su Compromiso No Finalizado -->
        <div style="background-color: #F8F6F4; border-left: 4px solid #BF3A1B; padding: 16px; border-radius: 8px; margin: 0 0 20px 0;">
          <h4 style="font-size: 13px; font-weight: 800; color: #BF3A1B; margin: 0 0 8px 0; text-transform: uppercase;">⚠️ Resumen Breve de su Compromiso No Finalizado:</h4>
          <p style="font-size: 13px; color: #2D1B4E; margin: 0 0 6px 0;">• <strong>Acción comprometida:</strong> ${actionWhat}</p>
          <p style="font-size: 13px; color: #2D1B4E; margin: 0 0 6px 0;">• <strong>Fecha prevista:</strong> ${actionWhen}</p>
          <p style="font-size: 13px; color: #2D1B4E; margin: 0 0 6px 0;">• <strong>Con quién:</strong> ${actionWithWhom}</p>
          <p style="font-size: 13px; color: #2D1B4E; margin: 0;">• <strong>Aspectos a cuidar:</strong> ${actionCare}</p>
        </div>

        <!-- Contacto Directo -->
        <div style="background-color: #FFF7EF; border: 1px solid #EADBCE; padding: 16px; border-radius: 12px; margin: 0 0 24px 0;">
          <p style="font-size: 13px; font-weight: 700; color: #2D1B4E; margin: 0 0 6px 0;">📞 Datos de Contacto Directo:</p>
          <p style="font-size: 13px; color: #4A3F55; margin: 0 0 4px 0;">• <strong>Correo electrónico:</strong> <a href="mailto:${targetLeaderEmail}" style="color: #BF3A1B; text-decoration: underline;">${targetLeaderEmail}</a></p>
          <p style="font-size: 13px; color: #4A3F55; margin: 0;">• <strong>WhatsApp:</strong> ${leaderWhatsapp}</p>
        </div>

        <p style="font-size: 13px; line-height: 1.6; color: #4A3F55; margin: 0 0 20px 0;">
          <strong>Recomendación de intervención:</strong> Te sugerimos contactar al líder para apoyarlo a resolver posibles dudas, indagar si enfrentó algún obstáculo no previsto e invitarlo a retomar su proceso en la Etapa 6 de Lidacta.
        </p>

        <div style="border-top: 1px solid #EADBCE; padding-top: 16px; margin-top: 20px;">
          <p style="font-size: 14px; font-weight: 800; color: #2D1B4E; margin: 0 0 4px 0;">Lidacta</p>
          <p style="font-size: 12px; color: #BF3A1B; margin: 0; font-weight: 600;">Sistema Automatizado de Monitoreo de Acompañamiento</p>
        </div>
      </td>
    </tr>
    <tr>
      <td style="background-color: #FFF7EF; padding: 18px 24px; text-align: center; border-top: 1px solid #EADBCE;">
        <p style="font-size: 11px; color: #4A3F55; margin: 0;">Alerta interna generada automáticamente para la administración · hola@taniapadierna.com</p>
      </td>
    </tr>
  </table>
</body>
</html>`;
      defaultText = `Estimada Tania:\n\nSe ha detectado inactividad de 8 días calendario tras finalizar la Etapa 5 en Lidacta.\n\n• Nombre del Líder: ${recipientName}\n• Empresa: ${compName}\n• Puesto / Área: ${leaderPosition} (${leaderArea})\n• Fecha del último acceso: ${lastActiveFormatted}\n• Etapa actual: Etapa 5 (Compromiso y Plan de Acción)\n• Desafío en curso: "${challengeTitle}"\n\nResumen breve de su compromiso no finalizado:\n• Acción comprometida: ${actionWhat}\n• Fecha prevista: ${actionWhen}\n• Con quién: ${actionWithWhom}\n• Aspectos a cuidar: ${actionCare}\n\nContacto del líder:\n• Email: ${targetLeaderEmail}\n• WhatsApp: ${leaderWhatsapp}\n\nTe sugerimos contactar al líder vía correo o WhatsApp para verificar cómo le fue con su acción, resolver posibles dudas y animarlo a ingresar a Lidacta para concluir su reflexión en la Etapa 6.\n\nAtentamente,\nSistema Automatizado de Monitoreo Lidacta`;

    // 4. ALERTA DE LÍMITE TERAPÉUTICO (A LA ADMINISTRADORA: hola@taniapadierna.com)
    } else if (type === 'therapeutic_alert') {
      finalSubject = subject || '[ALERTA LIDACTA] Detección de Caso con Naturaleza Terapéutica';
      const stageNameText = body.stageName || (body.currentStage ? `Etapa ${body.currentStage}` : 'Etapa 1');
      const dateTimeText = body.dateTimeFormatted || body.timestamp || new Date().toLocaleString('es-MX', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
      const contextSummary = body.contextSummary || body.reason || body.summary || 'El líder ha abordado temas de índole terapéutica, diagnósticos psicológicos o crisis emocionales personales que exceden el alcance del desarrollo de liderazgo laboral.';

      defaultHtml = `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><title>${finalSubject}</title></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #F8F6F4; margin: 0; padding: 24px; color: #2D1B4E;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(45, 27, 78, 0.08); border: 2px solid #842029;">
    <tr>
      <td style="background-color: #2D1B4E; padding: 32px 24px; text-align: center;">
        <h1 style="color: #FFF7EF; font-size: 24px; margin: 0 0 8px 0; font-weight: 800;">LIDACTA</h1>
        <p style="color: #F7B538; font-size: 13px; margin: 0; font-weight: 700; text-transform: uppercase;">Alerta de Límite Terapéutico · Monitoreo Ético</p>
      </td>
    </tr>
    <tr>
      <td style="padding: 32px 28px;">
        <span style="display: inline-block; padding: 4px 12px; background-color: #F8D7DA; color: #842029; border-radius: 20px; font-size: 11px; font-weight: 800; text-transform: uppercase; margin-bottom: 12px;">🚨 Límite Terapéutico Detectado</span>
        <h2 style="font-size: 20px; color: #2D1B4E; margin: 0 0 16px 0;">Estimada Tania:</h2>
        <p style="font-size: 14px; line-height: 1.6; color: #4A3F55; margin: 0 0 16px 0;">
          El sistema de supervisión de Lidacta ha detectado una consulta o intervención de un líder que aborda temas de <strong>naturaleza terapéutica, diagnósticos psicológicos o crisis emocionales personales</strong>, excediendo los límites metodológicos de mentoría laboral:
        </p>

        <!-- Ficha de Datos del Caso -->
        <div style="background-color: #FFF7EF; border: 1px solid #EADBCE; padding: 20px; border-radius: 12px; margin: 0 0 20px 0;">
          <h4 style="font-size: 13px; font-weight: 800; color: #2D1B4E; margin: 0 0 12px 0; text-transform: uppercase; border-bottom: 1px solid #EADBCE; padding-bottom: 6px;">📋 Datos del Caso Detectado:</h4>
          <p style="font-size: 13px; color: #4A3F55; margin: 0 0 8px 0;">• <strong>Nombre del Líder:</strong> <span style="color: #2D1B4E; font-weight: 700;">${recipientName}</span></p>
          <p style="font-size: 13px; color: #4A3F55; margin: 0 0 8px 0;">• <strong>Empresa:</strong> <span style="color: #2D1B4E; font-weight: 700;">${compName}</span></p>
          <p style="font-size: 13px; color: #4A3F55; margin: 0 0 8px 0;">• <strong>Fecha/Hora:</strong> <span style="color: #2D1B4E; font-weight: 700;">${dateTimeText}</span></p>
          <p style="font-size: 13px; color: #4A3F55; margin: 0 0 8px 0;">• <strong>Etapa actual:</strong> <span style="background-color: #FFD3BF; color: #BF3A1B; padding: 2px 8px; border-radius: 6px; font-weight: 700;">${stageNameText}</span></p>
          <p style="font-size: 13px; color: #4A3F55; margin: 0;">• <strong>Correo del Líder:</strong> <a href="mailto:${targetLeaderEmail}" style="color: #BF3A1B;">${targetLeaderEmail}</a></p>
        </div>

        <!-- Resumen Contextual Breve -->
        <div style="background-color: #F8F6F4; border-left: 4px solid #842029; padding: 16px; border-radius: 8px; margin: 0 0 20px 0;">
          <h4 style="font-size: 13px; font-weight: 800; color: #842029; margin: 0 0 8px 0; text-transform: uppercase;">⚠️ Resumen Contextual de la Situación Detectada:</h4>
          <p style="font-size: 13px; color: #2D1B4E; margin: 0; line-height: 1.6; font-style: italic;">
            "${contextSummary}"
          </p>
        </div>

        <!-- Acción Realizada en Chat -->
        <div style="background-color: #E2F7E1; border: 1px solid #A3D9A5; padding: 14px 18px; border-radius: 10px; margin: 0 0 20px 0;">
          <p style="font-size: 12px; color: #1E4620; margin: 0; line-height: 1.5;">
            <strong>✓ Protocolo de Contención Aplicado:</strong> Lidacta respondió con calidez y respeto, derivando amablemente al líder hacia profesionales de la salud mental o al área de Recursos Humanos/PAE, manteniendo el flujo sin bloquear la interfaz.
          </p>
        </div>

        <div style="border-top: 1px solid #EADBCE; padding-top: 16px; margin-top: 20px;">
          <p style="font-size: 14px; font-weight: 800; color: #2D1B4E; margin: 0 0 4px 0;">Lidacta</p>
          <p style="font-size: 12px; color: #BF3A1B; margin: 0; font-weight: 600;">Protocolo Ético de Supervisión y Límites de Rol</p>
        </div>
      </td>
    </tr>
    <tr>
      <td style="background-color: #FFF7EF; padding: 18px 24px; text-align: center; border-top: 1px solid #EADBCE;">
        <p style="font-size: 11px; color: #4A3F55; margin: 0;">Alerta confidencial para la administradora · hola@taniapadierna.com</p>
      </td>
    </tr>
  </table>
</body>
</html>`;
      defaultText = `[ALERTA LIDACTA] Detección de Caso con Naturaleza Terapéutica\n\nEstimada Tania:\n\nEl sistema de Lidacta ha detectado una consulta o intervención con naturaleza terapéutica, diagnósticos psicológicos o crisis emocionales personales.\n\n📋 DATOS DEL CASO:\n• Nombre del Líder: ${recipientName}\n• Empresa: ${compName}\n• Fecha/Hora: ${dateTimeText}\n• Etapa actual: ${stageNameText}\n• Correo del Líder: ${targetLeaderEmail}\n\n⚠️ RESUMEN CONTEXTUAL DE LA SITUACIÓN DETECTADA:\n"${contextSummary}"\n\n✓ Protocolo aplicado: Lidacta respondió amablemente orientando al líder hacia un profesional de la salud mental adecuado o al programa de bienestar de su empresa, continuando el flujo sin bloquear la interfaz.\n\nAtentamente,\nSistema de Supervisión Ética Lidacta`;

    // 5. BIENVENIDA RECURSOS HUMANOS / LÍDER
    } else {
      finalSubject = subject || `¡Te damos la bienvenida a Lidacta, ${recipientName}!`;
      const normalizedRole = (role || '')
        .toString()
        .toLowerCase()
        .trim()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');

      const isHR =
        normalizedRole.includes('hr') ||
        normalizedRole.includes('rh') ||
        normalizedRole.includes('recursos');

      if (isHR) {
        defaultHtml = `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><title>${finalSubject}</title></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #F8F6F4; margin: 0; padding: 24px; color: #2D1B4E;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(45, 27, 78, 0.08); border: 1px solid #EADBCE;">
    <tr>
      <td style="background-color: #2D1B4E; padding: 32px 24px; text-align: center;">
        <h1 style="color: #FFF7EF; font-size: 24px; margin: 0 0 8px 0; font-weight: 800;">LIDACTA</h1>
        <p style="color: #F7B538; font-size: 13px; margin: 0; font-weight: 600; text-transform: uppercase;">Desarrollo de Liderazgo en Acción</p>
      </td>
    </tr>
    <tr>
      <td style="padding: 32px 28px;">
        <h2 style="font-size: 20px; color: #2D1B4E; margin: 0 0 16px 0;">Hola, ${recipientName}:</h2>
        <h3 style="font-size: 16px; color: #BF3A1B; margin: 0 0 16px 0; font-weight: 700;">¡Nos alegra darte la bienvenida a Lidacta!</h3>
        <p style="font-size: 14px; line-height: 1.6; color: #4A3F55; margin: 0 0 16px 0;">
          Gracias por confiar en este espacio para impulsar el desarrollo de tus líderes.
        </p>
        <p style="font-size: 14px; line-height: 1.6; color: #4A3F55; margin: 0 0 16px 0;">
          Sabemos que desarrollar habilidades de liderazgo va más allá de ofrecer capacitación. También implica acompañar a las personas en los retos cotidianos que enfrentan al dirigir, gestionar y trabajar con sus equipos.
        </p>
        <p style="font-size: 14px; line-height: 1.6; color: #4A3F55; margin: 0 0 16px 0;">
          Lidacta busca contribuir a ese proceso, ofreciendo a tus líderes un espacio de acompañamiento para analizar situaciones reales de gestión de personas, explorar alternativas y encontrar nuevas formas de actuar.
        </p>
        <p style="font-size: 14px; line-height: 1.6; color: #4A3F55; margin: 0 0 16px 0;">
          Desde tu perfil de Recursos Humanos podrás consultar indicadores de uso y progreso de tus líderes, que te permitirán dar seguimiento a su participación y conocer cómo avanzan en su experiencia dentro de la plataforma.
        </p>
        <p style="font-size: 14px; line-height: 1.6; color: #4A3F55; margin: 0 0 20px 0;">
          Te invitamos a explorar Lidacta, familiarizarte con sus indicadores y descubrir cómo esta herramienta puede complementar tus iniciativas de desarrollo de liderazgo.
        </p>
        <p style="font-size: 14px; font-weight: 700; color: #2D1B4E; margin: 0 0 20px 0;">
          ¡Gracias por ser parte de este proyecto!
        </p>
        <div style="border-top: 1px solid #EADBCE; padding-top: 16px; margin-top: 20px;">
          <p style="font-size: 14px; font-weight: 800; color: #2D1B4E; margin: 0 0 4px 0;">Lidacta</p>
          <p style="font-size: 12px; color: #BF3A1B; margin: 0; font-weight: 600;">Desarrollo de Liderazgo en Acción</p>
        </div>
      </td>
    </tr>
    <tr>
      <td style="background-color: #FFF7EF; padding: 20px 24px; text-align: center; border-top: 1px solid #EADBCE;">
        <p style="font-size: 11px; color: #4A3F55; margin: 0;">Lidacta © ${new Date().getFullYear()} · Desarrollo de Liderazgo en Acción</p>
      </td>
    </tr>
  </table>
</body>
</html>`;
        defaultText = `Hola, ${recipientName}:\n\n¡Nos alegra darte la bienvenida a Lidacta!\n\nGracias por confiar en este espacio para impulsar el desarrollo de tus líderes.\n\nSabemos que desarrollar habilidades de liderazgo va más allá de ofrecer capacitación. También implica acompañar a las personas en los retos cotidianos que enfrentan al dirigir, gestionar y trabajar con sus equipos.\n\nLidacta busca contribuir a ese proceso, ofreciendo a tus líderes un espacio de acompañamiento para analizar situaciones reales de gestión de personas, explorar alternativas y encontrar nuevas formas de actuar.\n\nDesde tu perfil de Recursos Humanos podrás consultar indicadores de uso y progreso de tus líderes, que te permitirán dar seguimiento a su participación y conocer cómo avanzan en su experiencia dentro de la plataforma.\n\nTe invitamos a explorar Lidacta, familiarizarte con sus indicadores y descubrir cómo esta herramienta puede complementar tus iniciativas de desarrollo de liderazgo.\n\n¡Gracias por ser parte de este proyecto!\n\nLidacta\nDesarrollo de Liderazgo en Acción`;
      } else {
        defaultHtml = `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><title>${finalSubject}</title></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #F8F6F4; margin: 0; padding: 24px; color: #2D1B4E;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(45, 27, 78, 0.08); border: 1px solid #EADBCE;">
    <tr>
      <td style="background-color: #2D1B4E; padding: 32px 24px; text-align: center;">
        <h1 style="color: #FFF7EF; font-size: 24px; margin: 0 0 8px 0; font-weight: 800;">LIDACTA</h1>
        <p style="color: #F7B538; font-size: 13px; margin: 0; font-weight: 600; text-transform: uppercase;">Desarrollo de Liderazgo en Acción</p>
      </td>
    </tr>
    <tr>
      <td style="padding: 32px 28px;">
        <h2 style="font-size: 20px; color: #2D1B4E; margin: 0 0 16px 0;">¡Hola ${recipientName}!</h2>
        <p style="font-size: 14px; line-height: 1.6; color: #4A3F55; margin: 0 0 16px 0;">
          Te damos una cálida bienvenida a <strong>Lidacta</strong>. Tu cuenta ha sido creada exitosamente.
        </p>
        <p style="font-size: 14px; line-height: 1.6; color: #4A3F55; margin: 0 0 20px 0;">
          Lidacta es tu espacio seguro, confidencial y práctico en el que tendrás un mentor para acompañarte y ayudarte a resolver los retos relacionados con el manejo de personas. Podrás también encontrar herramientas y establecer acciones que fortalezcan tu autonomía como líder.
        </p>
      </td>
    </tr>
    <tr>
      <td style="background-color: #FFF7EF; padding: 20px 24px; text-align: center; border-top: 1px solid #EADBCE;">
        <p style="font-size: 11px; color: #4A3F55; margin: 0;">Lidacta © ${new Date().getFullYear()} · Desarrollo de Liderazgo Operativo</p>
      </td>
    </tr>
  </table>
</body>
</html>`;
        defaultText = `¡Hola ${recipientName}!\n\nTe damos una cálida bienvenida a Lidacta: Desarrollo de Liderazgo en Acción.\n\nLidacta es tu espacio seguro, confidencial y práctico en el que tendrás un mentor para acompañarte y ayudarte a resolver los retos relacionados con el manejo de personas. Podrás también encontrar herramientas y establecer acciones que fortalezcan tu autonomía como líder.\n\nAtentamente,\nEl Equipo de Lidacta\nResponder a: ${replyToEmail}`;
      }
    }

    const finalHtml = html || defaultHtml;
    const finalText = text || defaultText;

    const resendResult = await resend.emails.send({
      from: fromEmail,
      to: [targetEmail],
      replyTo: replyToEmail,
      subject: finalSubject,
      html: finalHtml,
      text: finalText,
    });

    console.log('[API /api/send-email] 📥 Respuesta Resend:', JSON.stringify(resendResult, null, 2));

    if (resendResult.error) {
      console.error('[API /api/send-email] ❌ Resend respondió con error:', resendResult.error);
      return res.status(500).json({
        success: false,
        error: resendResult.error.message || 'Error al enviar correo con Resend',
        details: resendResult.error,
        message: `Fallo al enviar correo a ${targetEmail}: ${resendResult.error.message || 'Error de entrega'}`,
      });
    }

    return res.status(200).json({
      success: true,
      emailId: resendResult.data?.id,
      id: resendResult.data?.id,
      realSent: true,
      message: 'Correo enviado exitosamente vía Resend API',
    });
  } catch (error: any) {
    console.error('[API /api/send-email] ❌ Excepción:', error);
    return res.status(500).json({
      success: false,
      error: error?.message || 'Error interno del servidor',
    });
  }
}
