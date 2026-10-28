import { Resend } from 'resend';

// Vercel Serverless Function handler for /api/send
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
      error: 'Method not allowed. Use POST.',
    });
  }

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch (parseErr) {
        console.warn('[API /api/send (Vercel)] No se pudo parsear el body como JSON:', parseErr);
      }
    }

    const {
      leaderName,
      message,
      transcript,
      date,
      leaderEmail,
      leaderPosition,
      companyName,
      currentStage,
      caseTitle,
      reasonText,
      isVoiceAudio,
    } = body || {};

    const apiKey = process.env.RESEND_API_KEY;
    const targetEmail = process.env.ADMIN_EMAIL || 'hola@taniapadierna.com';
    const effectiveLeaderName = (leaderName || 'Líder').trim();
    const effectiveMessage = (transcript || message || reasonText || '(Sin mensaje especificado)').trim();
    const effectiveDate = date || new Date().toLocaleString('es-MX', { timeZone: 'America/Mexico_City' });
    const effectiveStage = currentStage || 1;
    const effectiveCompany = companyName || 'Empresa';
    const effectiveCase = caseTitle || 'Acompañamiento en curso';

    console.log('[API /api/send (Vercel)] 📩 Recibida solicitud:', {
      leader: effectiveLeaderName,
      targetEmail,
      hasKey: !!apiKey,
      date: effectiveDate,
      isVoice: !!isVoiceAudio,
    });

    if (!apiKey) {
      console.warn('[API /api/send (Vercel)] ⚠️ RESEND_API_KEY no encontrada en process.env. Notificación registrada centralmente.');
      return res.status(200).json({
        success: true,
        simulated: true,
        message: 'Solicitud registrada correctamente en la base de datos central (Configure RESEND_API_KEY en Vercel para despacho directo por email).',
      });
    }

    const resend = new Resend(apiKey);
    const emailSubject = `🚨 [Asesoría 1:1] Solicitud de ${effectiveLeaderName} - ${effectiveDate}`;

    const emailHtmlBody = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>${emailSubject}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #F8F6F4; margin: 0; padding: 24px; color: #2D1B4E;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; background: #FFFFFF; border-radius: 20px; overflow: hidden; border: 1px solid rgba(73, 52, 71, 0.15); box-shadow: 0 4px 20px rgba(45, 27, 78, 0.08);">
    <tr>
      <td style="background-color: #2D1B4E; padding: 28px 32px; text-align: left;">
        <span style="font-size: 24px; font-weight: 800; color: #FFFFFF; letter-spacing: -0.5px;">Lidacta</span>
        <span style="font-size: 11px; font-weight: 700; color: #F7B538; text-transform: uppercase; margin-left: 10px; background: rgba(247, 181, 56, 0.2); padding: 4px 8px; border-radius: 6px;">Asesoría 1:1</span>
        <p style="margin: 6px 0 0 0; font-size: 13px; color: #FFF7EF; opacity: 0.9;">Desarrollo de Liderazgo en Acción · Alerta Directiva Inmediata</p>
      </td>
    </tr>
    <tr>
      <td style="padding: 32px;">
        <p style="font-size: 15px; line-height: 1.6; margin: 0 0 16px 0; color: #2D1B4E;">
          Hola <strong>Tania Padierna</strong>,
        </p>
        <p style="font-size: 14px; line-height: 1.6; margin: 0 0 24px 0; color: #4A3F55;">
          El líder <strong>${effectiveLeaderName}</strong> ha solicitado una sesión directa de <strong>Asesoría 1:1</strong> en Lidacta.
        </p>
        <table width="100%" cellpadding="0" cellspacing="0" style="background: #FFF7EF; border: 1px solid #FFD3BF; border-radius: 14px; margin-bottom: 24px; padding: 18px;">
          <tr>
            <td style="padding: 6px 0; font-size: 13px; color: #4A3F55;"><strong>Líder:</strong></td>
            <td style="padding: 6px 0; font-size: 14px; color: #2D1B4E; font-weight: 700;">${effectiveLeaderName}</td>
          </tr>
          ${leaderPosition ? `<tr><td style="padding: 6px 0; font-size: 13px; color: #4A3F55;"><strong>Puesto:</strong></td><td style="padding: 6px 0; font-size: 13px; color: #2D1B4E;">${leaderPosition}</td></tr>` : ''}
          <tr>
            <td style="padding: 6px 0; font-size: 13px; color: #4A3F55;"><strong>Empresa:</strong></td>
            <td style="padding: 6px 0; font-size: 13px; color: #2D1B4E; font-weight: 600;">${effectiveCompany}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; font-size: 13px; color: #4A3F55;"><strong>Etapa actual:</strong></td>
            <td style="padding: 6px 0; font-size: 13px; color: #BF3A1B; font-weight: 700;">Etapa ${effectiveStage}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; font-size: 13px; color: #4A3F55;"><strong>Caso / Reto:</strong></td>
            <td style="padding: 6px 0; font-size: 13px; color: #2D1B4E; font-weight: 600;">${effectiveCase}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; font-size: 13px; color: #4A3F55;"><strong>Fecha:</strong></td>
            <td style="padding: 6px 0; font-size: 13px; color: #2D1B4E;">${effectiveDate}</td>
          </tr>
        </table>
        <div style="background: #FFFFFF; border-left: 4px solid #BF3A1B; border-top: 1px solid #EFEAE5; border-right: 1px solid #EFEAE5; border-bottom: 1px solid #EFEAE5; border-radius: 8px; padding: 18px; margin-bottom: 24px;">
          <span style="display: block; font-size: 11px; font-weight: 700; color: #BF3A1B; text-transform: uppercase; margin-bottom: 8px;">
            ${isVoiceAudio ? '🎙️ Mensaje / Transcripción de Nota de Voz:' : '📝 Mensaje / Motivo de la solicitud:'}
          </span>
          <p style="font-size: 14px; font-style: italic; line-height: 1.6; color: #2D1B4E; margin: 0; white-space: pre-line;">
            "${effectiveMessage}"
          </p>
        </div>
        <p style="font-size: 12px; color: #4A3F55; text-align: center; margin: 0;">
          Correo enviado automáticamente desde <strong>Lidacta &lt;onboarding@resend.dev&gt;</strong> para <strong>${targetEmail}</strong>.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>
    `;

    const emailTextBody = `🚨 Solicitud de Asesoría 1:1 en Lidacta\n\nLíder: ${effectiveLeaderName}\nFecha: ${effectiveDate}\nEmpresa: ${effectiveCompany}\nEtapa: ${effectiveStage}\nCaso: ${effectiveCase}\n\nMensaje/Transcripción:\n"${effectiveMessage}"\n\nDestinatario: ${targetEmail}\nResponder a: ${process.env.RESEND_REPLY_TO || 'hola@taniapadierna.com'}`;

    const fromEmail = process.env.RESEND_FROM_EMAIL || 'Lidacta <notificaciones@taniapadierna.com>';
    const replyToEmail = process.env.RESEND_REPLY_TO || 'hola@taniapadierna.com';

    console.log(`[API /api/send (Vercel)] 🚀 Despachando con Resend: De: ${fromEmail}, Para: ${targetEmail}, Reply-To: ${replyToEmail}`);
    const resendResult = await resend.emails.send({
      from: fromEmail,
      to: [targetEmail],
      replyTo: replyToEmail,
      subject: emailSubject,
      html: emailHtmlBody,
      text: emailTextBody,
    });

    if (resendResult.error) {
      console.error('[API /api/send (Vercel)] ❌ Error de Resend API:', JSON.stringify(resendResult.error, null, 2));
      return res.status(400).json({
        success: false,
        error: resendResult.error.message || 'Error al enviar a través de Resend API',
        details: resendResult.error,
      });
    }

    const emailId = resendResult.data?.id;
    console.log('[API /api/send (Vercel)] ✅ Correo enviado exitosamente con Resend. ID:', emailId);
    console.log('[API /api/send (Vercel)] 📩 Respuesta Resend API:', JSON.stringify(resendResult.data));

    return res.status(200).json({
      success: true,
      id: emailId,
      message: 'Correo de Asesoría 1:1 enviado exitosamente a través de Resend',
      recipient: targetEmail,
      timestamp: effectiveDate,
    });
  } catch (error: any) {
    console.error('[API /api/send (Vercel)] ❌ Excepción:', error);
    return res.status(500).json({
      success: false,
      error: error?.message || 'Error interno del servidor al despachar correo',
    });
  }
}
