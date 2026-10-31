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

    console.log(`[API /api/send-email] 🚀 Despachando correo a ${targetEmail} (Asunto: "${subject || 'Notificación Lidacta'}")`);
    console.log(`[API /api/send-email] Remitente: ${fromEmail}, Reply-To: ${replyToEmail}`);

    if (!resendApiKey) {
      console.error('[API /api/send-email] ❌ ERROR: RESEND_API_KEY no configurada en Vercel.');
      return res.status(500).json({
        success: false,
        error: 'RESEND_API_KEY no está configurada en las variables de entorno de Vercel.',
        message: 'Falta variable RESEND_API_KEY en el servidor.',
      });
    }

    const resend = new Resend(resendApiKey);
    const recipientName = name || 'Líder';
    const finalSubject = subject || `¡Te damos la bienvenida a Lidacta, ${recipientName}!`;

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

    let defaultHtml: string;
    let defaultText: string;

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
