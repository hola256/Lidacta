import { Resend } from 'resend';
import { loadUsers, persistUsers, UserProfile } from './users';

export const config = {
  maxDuration: 15,
};

// Vercel Serverless Function for /api/register
// Dedicated registration controller with mandatory Resend email delivery
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
      message: 'Método HTTP no permitido. Utiliza POST para registrar usuarios.',
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

    const cleanEmail = (body.email || '').trim().toLowerCase();
    const cleanName = (body.name || '').trim();

    if (!cleanName || cleanName.length < 2) {
      return res.status(400).json({
        success: false,
        message: 'El nombre completo es obligatorio para el registro.',
      });
    }

    if (!cleanEmail || !cleanEmail.includes('@')) {
      return res.status(400).json({
        success: false,
        message: 'El correo electrónico corporativo es obligatorio y debe ser válido.',
      });
    }

    const { users } = await loadUsers();

    // Check duplicate
    const existingIndex = users.findIndex((u) => u.email.toLowerCase() === cleanEmail);
    if (existingIndex !== -1) {
      return res.status(400).json({
        success: false,
        message: 'Ya existe una cuenta registrada con este correo electrónico. Por favor inicia sesión.',
      });
    }

    const newUser: UserProfile = {
      id: body.id || `user_${Date.now()}`,
      name: cleanName,
      email: cleanEmail,
      role: body.role || 'leader',
      companyId: body.companyId || 'comp_nexus',
      companyName: body.companyName || 'Industrias Nexus Automotriz',
      position: body.position || 'Líder Operativo',
      area: body.area || '',
      birthDate: body.birthDate || '',
      directReports: body.directReports !== undefined ? Number(body.directReports) : undefined,
      whatsapp: body.whatsapp || '',
      isProfileCompleted: body.isProfileCompleted ?? (body.role === 'admin'),
      isProfileComplete: body.isProfileComplete ?? (body.role === 'admin'),
      createdAt: new Date().toISOString().split('T')[0],
      status: body.status || 'active',
      password: body.password || '',
    };

    // Configuration Fallbacks for Resend
    const resendApiKey = process.env.RESEND_API_KEY;
    const fromEmail = process.env.RESEND_FROM_EMAIL || 'Lidacta <notificaciones@taniapadierna.com>';
    const replyToEmail = process.env.RESEND_REPLY_TO || 'hola@taniapadierna.com';

    console.log(`[API /api/register] ==========================================`);
    console.log(`[API /api/register] 🚀 Iniciando registro de usuario: ${cleanName} (${cleanEmail})`);
    console.log(`[API /api/register] Remitente Oficial (From): ${fromEmail}`);
    console.log(`[API /api/register] Responder a (Reply-To): ${replyToEmail}`);
    console.log(`[API /api/register] RESEND_API_KEY activa: ${resendApiKey ? 'SÍ' : 'NO'}`);

    if (!resendApiKey) {
      console.error('[API /api/register] ❌ ERROR CRÍTICO: RESEND_API_KEY no está configurada en las variables de entorno de Vercel.');
      return res.status(500).json({
        success: false,
        error: 'RESEND_API_KEY no está configurada en las variables de entorno de Vercel.',
        message: 'Error de configuración: Falta definir la variable RESEND_API_KEY en Vercel para autorizar el despacho de correos.',
      });
    }

    const resend = new Resend(resendApiKey);
    const emailSubject = `¡Te damos la bienvenida a Lidacta, ${newUser.name}!`;

    const emailHtml = `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><title>${emailSubject}</title></head>
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
        <h2 style="font-size: 20px; color: #2D1B4E; margin: 0 0 16px 0;">¡Hola ${newUser.name}!</h2>
        <p style="font-size: 14px; line-height: 1.6; color: #4A3F55; margin: 0 0 16px 0;">
          Te damos una cálida bienvenida a <strong>Lidacta</strong>. Tu cuenta ha sido creada exitosamente asociada a <strong>${newUser.companyName}</strong>.
        </p>
        <p style="font-size: 14px; line-height: 1.6; color: #4A3F55; margin: 0 0 20px 0;">
          Lidacta es tu espacio seguro, confidencial y práctico para abordar retos reales de liderazgo, entrenar conversaciones difíciles y consolidar planes de acción con autonomía.
        </p>
        <div style="background-color: #FFF7EF; border-left: 4px solid #F7B538; padding: 16px; border-radius: 8px; margin: 0 0 24px 0;">
          <p style="font-size: 13px; font-weight: 700; color: #2D1B4E; margin: 0 0 6px 0;">🔒 Confidencialidad Absoluta Garantizada</p>
          <p style="font-size: 12px; line-height: 1.5; color: #4A3F55; margin: 0;">
            El contenido de tus conversaciones y casos es estrictamente privado. Recursos Humanos únicamente recibe métricas agregadas de participación.
          </p>
        </div>
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

    const emailText = `¡Hola ${newUser.name}!\n\nTe damos una cálida bienvenida a Lidacta: Desarrollo de Liderazgo en Acción.\nTu cuenta ha sido creada exitosamente asociada a ${newUser.companyName}.\n\nAtentamente,\nEl Equipo de Lidacta\nResponder a: ${replyToEmail}`;

    console.log(`[API /api/register] 🚀 Invocando resend.emails.send() obligatorio para: ${cleanEmail}...`);
    const resendResult = await resend.emails.send({
      from: fromEmail,
      to: [cleanEmail],
      replyTo: replyToEmail,
      subject: emailSubject,
      html: emailHtml,
      text: emailText,
    });

    console.log('[API /api/register] 📥 Respuesta directa de Resend API:', JSON.stringify(resendResult, null, 2));

    // Si Resend falla, devolver HTTP 500 con el error exacto
    if (resendResult.error) {
      console.error('[API /api/register] ❌ Error retornado por Resend API:', resendResult.error);
      return res.status(500).json({
        success: false,
        error: resendResult.error.message || 'Error al enviar correo con Resend',
        details: resendResult.error,
        message: `Fallo en Resend: ${resendResult.error.message || 'Error desconocido al entregar el correo a ' + cleanEmail}`,
      });
    }

    // Persistir usuario solo si el correo fue aceptado por Resend
    users.unshift(newUser);
    await persistUsers(users);

    console.log(`[API /api/register] ✅ Usuario creado y correo enviado con ID de Resend: ${resendResult.data?.id}`);
    console.log(`[API /api/register] ==========================================`);

    return res.status(201).json({
      success: true,
      user: newUser,
      users,
      emailId: resendResult.data?.id,
      message: 'Usuario registrado exitosamente y correo de bienvenida despachado.',
    });
  } catch (error: any) {
    console.error('[API /api/register] ❌ Excepción crítica en el servidor:', error);
    return res.status(500).json({
      success: false,
      error: error?.message || 'Error interno del servidor durante el registro',
      message: `Error interno del servidor: ${error?.message || 'Error desconocido'}`,
    });
  }
}
