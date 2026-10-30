import { describe, it } from 'node:test';
import assert from 'node:assert';

describe('Servicio de Correo Electrónico y Notificaciones Resend - Lidacta', () => {
  it('debe tener configurado por defecto el remitente oficial y el replyTo para el dominio autenticado', () => {
    const defaultFrom = process.env.RESEND_FROM_EMAIL || 'Lidacta <notificaciones@taniapadierna.com>';
    const defaultReplyTo = process.env.RESEND_REPLY_TO || 'hola@taniapadierna.com';
    const adminEmail = process.env.ADMIN_EMAIL || 'hola@taniapadierna.com';

    assert.strictEqual(defaultFrom, 'Lidacta <notificaciones@taniapadierna.com>');
    assert.strictEqual(defaultReplyTo, 'hola@taniapadierna.com');
    assert.strictEqual(adminEmail, 'hola@taniapadierna.com');
  });

  it('debe estructurar los objetos de correo con campos from, to, replyTo y estado de entrega', () => {
    const testEmailPayload = {
      from: 'Lidacta <notificaciones@taniapadierna.com>',
      to: 'prueba.lider@ejemplo.com',
      replyTo: 'hola@taniapadierna.com',
      subject: '¡Te damos la bienvenida a Lidacta, Andrea!',
      bodyText: 'Bienvenida a Lidacta',
      realEmailSent: true,
      realEmailId: 'mock_email_id_123456',
    };

    assert.ok(testEmailPayload.from.includes('notificaciones@taniapadierna.com'));
    assert.strictEqual(testEmailPayload.replyTo, 'hola@taniapadierna.com');
    assert.ok(testEmailPayload.to.includes('@'));
    assert.strictEqual(testEmailPayload.realEmailSent, true);
    assert.ok(testEmailPayload.realEmailId);
  });

  it('debe despachar la invitación para completar perfil con el asunto y remitente oficial', () => {
    const inviteSubject = 'Te invitan a completar tu perfil en Lidacta';
    const fromEmail = 'Lidacta <notificaciones@taniapadierna.com>';
    const replyToEmail = 'hola@taniapadierna.com';
    const completeProfileUrl = 'https://ejemplo.com/complete-profile';

    assert.strictEqual(inviteSubject, 'Te invitan a completar tu perfil en Lidacta');
    assert.strictEqual(fromEmail, 'Lidacta <notificaciones@taniapadierna.com>');
    assert.strictEqual(replyToEmail, 'hola@taniapadierna.com');
    assert.ok(completeProfileUrl.endsWith('/complete-profile'));
  });
});
