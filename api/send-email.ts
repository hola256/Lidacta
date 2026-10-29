import { Resend } from 'resend';
import { loadUsers } from './users';

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
    const finalSubject = subject || `¡Te damos la bienvenida a Lidacta, ${name || 'Líder'}!`;
    const finalHtml = html || `<!DOCTYPE html><html><body><h2>¡Hola ${name || 'Líder'}!</h2><p>Bienvenido/a a Lidacta.</p></body></html>`;
    const finalText = text || `¡Hola ${name || 'Líder'}!\n\nBienvenido/a a Lidacta.`;

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
