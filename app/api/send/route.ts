import { Resend } from 'resend';

// Route Handler for Next.js App Router (/app/api/send/route.ts)
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      leaderName,
      message,
      transcript,
      date,
      leaderPosition,
      companyName,
      currentStage,
      caseTitle,
      isVoiceAudio,
    } = body || {};

    const apiKey = process.env.RESEND_API_KEY;
    const targetEmail = process.env.ADMIN_EMAIL || 'hola@taniapadierna.com';
    const effectiveLeaderName = leaderName || 'Líder';
    const effectiveMessage = transcript || message || '(Sin mensaje especificado)';
    const effectiveDate = date || new Date().toLocaleString('es-MX', { timeZone: 'America/Mexico_City' });

    console.log('[API /api/send (app route)] 📩 Recibida solicitud para:', {
      leaderName: effectiveLeaderName,
      targetEmail,
      date: effectiveDate,
    });

    if (!apiKey) {
      console.warn('[API /api/send (app route)] ⚠️ RESEND_API_KEY no configurada');
      return new Response(
        JSON.stringify({
          success: false,
          error: 'RESEND_API_KEY no configurada en variables de entorno',
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const resend = new Resend(apiKey);
    const subject = `🚨 [Asesoría 1:1] Solicitud de ${effectiveLeaderName} - ${effectiveDate}`;

    const fromEmail = process.env.RESEND_FROM_EMAIL || 'Lidacta <notificaciones@taniapadierna.com>';
    const replyToEmail = process.env.RESEND_REPLY_TO || 'hola@taniapadierna.com';

    const data = await resend.emails.send({
      from: fromEmail,
      to: [targetEmail],
      replyTo: 'hola@taniapadierna.com',
      subject,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background: #FFF7EF; border: 1px solid #FFD3BF; border-radius: 16px; color: #2D1B4E;">
          <h2 style="color: #2D1B4E; margin-top: 0; font-size: 20px;">🚨 Solicitud de Asesoría 1:1 - Lidacta</h2>
          <p><strong>Líder:</strong> ${effectiveLeaderName}</p>
          ${leaderPosition ? `<p><strong>Puesto:</strong> ${leaderPosition}</p>` : ''}
          ${companyName ? `<p><strong>Empresa:</strong> ${companyName}</p>` : ''}
          ${currentStage ? `<p><strong>Etapa actual:</strong> Etapa ${currentStage}</p>` : ''}
          ${caseTitle ? `<p><strong>Caso/Reto:</strong> ${caseTitle}</p>` : ''}
          <p><strong>Fecha:</strong> ${effectiveDate}</p>
          <div style="background: #ffffff; padding: 16px; border-radius: 8px; border-left: 4px solid #BF3A1B; margin: 20px 0;">
            <p style="margin: 0; font-weight: bold; color: #BF3A1B;">
              ${isVoiceAudio ? '🎙️ Mensaje / Transcripción de Nota de Voz:' : '📝 Mensaje del Líder:'}
            </p>
            <p style="margin: 8px 0 0 0; font-style: italic; white-space: pre-line;">"${effectiveMessage}"</p>
          </div>
          <hr style="border: none; border-top: 1px solid #FFD3BF; margin: 20px 0;" />
          <p style="font-size: 11px; color: #777; text-align: center; margin: 0;">
            Despachado automáticamente a ${targetEmail} por Lidacta.
          </p>
        </div>
      `,
      text: `🚨 Solicitud de Asesoría 1:1 en Lidacta\n\nLíder: ${effectiveLeaderName}\nFecha: ${effectiveDate}\nMensaje/Transcripción:\n"${effectiveMessage}"\n\nDestinatario: ${targetEmail}`,
    });

    if (data.error) {
      console.error('[API /api/send (app route)] ❌ Error de Resend API:', data.error);
      return new Response(JSON.stringify({ success: false, error: data.error }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    console.log('[API /api/send (app route)] ✅ Correo enviado con éxito. ID:', data.data?.id);
    return new Response(
      JSON.stringify({
        success: true,
        id: data.data?.id,
        message: 'Correo enviado exitosamente',
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[API /api/send (app route)] ❌ Error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error?.message || 'Error del servidor',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
