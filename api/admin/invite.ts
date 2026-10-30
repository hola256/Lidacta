import { Resend } from 'resend';

export const config = {
  maxDuration: 15,
};

function generateInviteEmailHtml(user: { name: string; email: string; companyName?: string }, directUrl: string): string {
  const currentYear = new Date().getFullYear();
  const userName = user.name || 'Líder Lidacta';
  const company = user.companyName || 'Industrias Nexus Automotriz';

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>Te invitan a completar tu perfil en Lidacta</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #F8F6F4; margin: 0; padding: 24px; color: #2D1B4E;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(45, 27, 78, 0.08); border: 1px solid #EADBCE;">
    <!-- Encabezado Corporativo Violeta Lidacta (#2D1B4E) -->
    <tr>
      <td style="background-color: #2D1B4E; padding: 32px 24px; text-align: center;">
        <h1 style="color: #FFF7EF; font-size: 24px; margin: 0 0 8px 0; font-weight: 800; letter-spacing: -0.5px;">LIDACTA</h1>
        <p style="color: #F7B538; font-size: 13px; margin: 0; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">Invitación de Onboarding Directivo</p>
      </td>
    </tr>
    <!-- Contenido Principal -->
    <tr>
      <td style="padding: 32px 28px;">
        <span style="display: inline-block; padding: 4px 12px; background-color: #FFD3BF; color: #BF3A1B; border-radius: 20px; font-size: 11px; font-weight: 700; text-transform: uppercase; margin-bottom: 12px;">Paso Requerido</span>
        <h2 style="font-size: 20px; color: #2D1B4E; margin: 0 0 16px 0; font-weight: 700;">¡Hola ${userName}!</h2>
        <p style="font-size: 14px; line-height: 1.6; color: #4A3F55; margin: 0 0 16px 0;">
          La administración de <strong>${company}</strong> te ha invitado a formar parte del programa directivo en <strong>Lidacta</strong>.
        </p>
        <p style="font-size: 14px; line-height: 1.6; color: #4A3F55; margin: 0 0 20px 0;">
          Para habilitar tu acceso seguro y comenzar tu proceso de acompañamiento directivo personalizado, por favor ingresa al siguiente enlace y completa los datos de tu entorno operativo (Área, Puesto, WhatsApp y Personas a Cargo):
        </p>
        <div style="background-color: #FFF7EF; border: 1px solid #EADBCE; padding: 18px; border-radius: 12px; margin: 0 0 24px 0; text-align: left;">
          <p style="font-size: 13px; font-weight: 700; color: #2D1B4E; margin: 0 0 6px 0;">📋 Tus datos de acceso:</p>
          <p style="font-size: 13px; color: #4A3F55; margin: 0 0 4px 0;">• <strong>Usuario:</strong> ${user.email}</p>
          <p style="font-size: 13px; color: #4A3F55; margin: 0;">• <strong>Empresa:</strong> ${company}</p>
        </div>
        <!-- Botón de Acción Principal con Redirección a Completar Perfil -->
        <div style="text-align: center; margin: 28px 0 24px 0;">
          <a href="${directUrl}" style="background-color: #F7B538; color: #2D1B4E; padding: 14px 28px; font-size: 14px; font-weight: 800; text-decoration: none; border-radius: 12px; display: inline-block; box-shadow: 0 4px 12px rgba(247, 181, 56, 0.35);">
            Completar Mi Perfil en Lidacta →
          </a>
        </div>
        <!-- Aviso de Privacidad y Confidencialidad -->
        <div style="background-color: #FFF7EF; border-left: 4px solid #F7B538; padding: 14px 16px; border-radius: 8px; margin: 0 0 20px 0;">
          <p style="font-size: 12px; font-weight: 700; color: #2D1B4E; margin: 0 0 4px 0;">🔒 Confidencialidad Absoluta Garantizada</p>
          <p style="font-size: 11px; line-height: 1.5; color: #4A3F55; margin: 0;">
            El contenido de tus conversaciones, casos y simulaciones es estrictamente privado y confidencial. Recursos Humanos únicamente recibe métricas agregadas de participación.
          </p>
        </div>
        <p style="font-size: 12px; color: #4A3F55; text-align: center; margin: 16px 0 0 0;">
          Si el botón no funciona, copia y pega este enlace en tu navegador:<br>
          <a href="${directUrl}" style="color: #BF3A1B; text-decoration: underline; word-break: break-all;">${directUrl}</a>
        </p>
      </td>
    </tr>
    <!-- Footer -->
    <tr>
      <td style="background-color: #FFF7EF; padding: 20px 24px; text-align: center; border-top: 1px solid #EADBCE;">
        <p style="font-size: 11px; color: #4A3F55; margin: 0;">Lidacta © ${currentYear} · Desarrollo de Liderazgo Operativo</p>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// Vercel Serverless Function for /api/admin/invite
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
    return res.status(200).json({
      success: false,
      error: 'Método no permitido. Utiliza POST para enviar invitaciones.',
      message: 'Método no permitido. Utiliza POST para enviar invitaciones.',
    });
  }

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch (parseErr) {
        console.error('[INVITE_ERROR]: Error al parsear JSON del cuerpo:', parseErr);
        body = {};
      }
    }
    body = body || {};

    const cleanEmail = (body.email || body.to || '').trim().toLowerCase();
    const cleanName = (body.name || '').trim() || 'Líder Lidacta';
    const companyName = (body.companyName || '').trim() || 'Industrias Nexus Automotriz';
    const rawInviteUrl = (body.inviteUrl || '').trim();

    if (!cleanEmail || !cleanEmail.includes('@')) {
      return res.status(200).json({
        success: false,
        error: 'El correo electrónico del destinatario es obligatorio y debe ser válido.',
        message: 'El correo electrónico del destinatario es obligatorio y debe ser válido.',
      });
    }

    // Direct URL resolution to /complete-profile
    let directUrl = rawInviteUrl || 'https://ais-dev-5pctfozdv244x3okeqjryq-710027895954.us-east1.run.app';
    if (!directUrl.includes('/complete-profile')) {
      directUrl = `${directUrl.replace(/\/+$/, '')}/complete-profile`;
    }

    const emailSubject = 'Te invitan a completar tu perfil en Lidacta';
    const fromEmail = 'Lidacta <notificaciones@taniapadierna.com>';
    const replyToEmail = 'hola@taniapadierna.com';

    const emailHtml = generateInviteEmailHtml(
      { name: cleanName, email: cleanEmail, companyName },
      directUrl
    );

    const emailText = `¡Hola ${cleanName}!\n\nLa administración de ${companyName} te ha invitado a formar parte del programa directivo en Lidacta.\n\nPara habilitar tu acceso seguro y comenzar tu proceso de acompañamiento directivo personalizado, por favor ingresa al siguiente enlace y completa los datos de tu entorno operativo (Área, Puesto, WhatsApp y Personas a Cargo):\n\n${directUrl}\n\nDatos de acceso:\nUsuario: ${cleanEmail}\nEmpresa: ${companyName}\n\nEl contenido de tus conversaciones es privado y confidencial.\nPuedes responder directamente a este correo o escribir a ${replyToEmail}.\n\nAtentamente,\nEl Equipo de Lidacta`;

    const resendApiKey = process.env.RESEND_API_KEY;

    console.log(`[API /api/admin/invite] 🚀 Iniciando envío de invitación para: ${cleanEmail}`);
    console.log(`[API /api/admin/invite] De: ${fromEmail} | Reply-To: ${replyToEmail} | Asunto: "${emailSubject}"`);

    if (!resendApiKey || !resendApiKey.trim()) {
      console.warn('[API /api/admin/invite] ⚠️ RESEND_API_KEY no configurada. Simulando despacho local.');
      return res.status(200).json({
        success: true,
        message: `Invitación simulada para ${cleanEmail} (sin clave de Resend configurada).`,
        simulated: true,
      });
    }

    // Native awaited Resend SDK call inside dedicated try/catch
    try {
      const resend = new Resend(resendApiKey.trim());
      const resendResult = await resend.emails.send({
        from: fromEmail,
        to: [cleanEmail],
        replyTo: replyToEmail,
        subject: emailSubject,
        html: emailHtml,
        text: emailText,
      });

      if (resendResult.error) {
        const resendErr: any = resendResult.error;
        const resendErrMsg = typeof resendErr === 'string'
          ? resendErr
          : (resendErr?.message || String(resendErr));
        console.error('[INVITE_ERROR]: Resend delivery failed:', resendErrMsg);
        return res.status(200).json({
          success: false,
          error: resendErrMsg,
          message: resendErrMsg,
        });
      }

      const emailId = resendResult.data?.id;
      console.log(`[API /api/admin/invite] ✅ Correo de invitación despachado exitosamente vía Resend ID: ${emailId}`);

      return res.status(200).json({
        success: true,
        emailId,
        message: `Correo de invitación para completar perfil enviado a ${cleanEmail}`,
      });
    } catch (resendSdkErr: any) {
      const sdkErrMsg = typeof resendSdkErr === 'string'
        ? resendSdkErr
        : (resendSdkErr?.message || String(resendSdkErr));
      console.error('[INVITE_ERROR]: Excepción en llamada a Resend SDK:', sdkErrMsg);
      return res.status(200).json({
        success: false,
        error: sdkErrMsg,
        message: sdkErrMsg,
      });
    }
  } catch (error: any) {
    const errorMsg = typeof error === 'string' ? error : (error?.message || String(error));
    console.error('[API /api/admin/invite] ❌ Error general no controlado:', errorMsg);
    return res.status(200).json({
      success: false,
      error: errorMsg,
      message: errorMsg,
    });
  }
}
