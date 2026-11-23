import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import http from 'http';
import { app } from '../server';
import vercelSendHandler from '../api/send';
import vercelSendEmailHandler from '../api/send-email';
import vercelNotificationsHandler from '../api/notifications';
import {
  QA_TEST_LEADER_ID,
  QA_TEST_LEADER_PROFILE,
  buildTestSessionForStage,
} from '../src/utils/testSessionFixtures';
import {
  QA_MENTOR_REQUEST_BLOCKED_MESSAGE,
  evaluateMentorRequestFrontendGuard,
  isQaMentorContext,
  isQaRequestPayload,
} from '../src/utils/qaIsolation';

function createMockRes() {
  let statusCode = 0;
  let jsonBody: any = null;
  const res: any = {
    setHeader: () => {},
    status: (code: number) => {
      statusCode = code;
      return {
        json: (data: any) => {
          jsonBody = data;
          return data;
        },
        end: () => {},
      };
    },
    json: (data: any) => {
      statusCode = statusCode || 200;
      jsonBody = data;
      return data;
    },
  };
  return {
    res,
    getStatus: () => statusCode,
    getJson: () => jsonBody,
  };
}

describe('Corrección B1: Aislamiento de Asesoría 1:1 en Sesiones QA', () => {
  let server: http.Server;
  let baseUrl = '';
  let originalResendKey: string | undefined;
  let originalFetch: typeof globalThis.fetch;
  let resendOutboundCalls = 0;

  before(async () => {
    originalResendKey = process.env.RESEND_API_KEY;
    originalFetch = globalThis.fetch;

    // Intercepta cualquier intento saliente hacia api.resend.com incluso con RESEND_API_KEY configurada
    globalThis.fetch = (async (input: any, init?: any) => {
      const url = typeof input === 'string' ? input : input?.url || '';
      if (url.includes('resend.com')) {
        resendOutboundCalls += 1;
        return new Response(JSON.stringify({ id: `mock_resend_${resendOutboundCalls}` }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return originalFetch(input, init);
    }) as typeof globalThis.fetch;

    await new Promise<void>((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        const addr = server.address();
        if (addr && typeof addr !== 'string') {
          baseUrl = `http://127.0.0.1:${addr.port}`;
        }
        resolve();
      });
    });
  });

  after(async () => {
    globalThis.fetch = originalFetch;
    if (originalResendKey === undefined) {
      delete process.env.RESEND_API_KEY;
    } else {
      process.env.RESEND_API_KEY = originalResendKey;
    }
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  it('1. Frontend (RequestMentorModal y helpers): bloquea sesiones QA por formulario y nota de voz antes de fetch(/api/send)', () => {
    const qaSession = buildTestSessionForStage(3);
    const realSession = {
      id: 'ment_real_100',
      isTestSession: false,
    };
    const realUser = {
      id: 'user_real_carlos',
      email: 'carlos.mendoza@novaretail.com',
      name: 'Carlos Mendoza',
    };

    // Guardias por sesión QA o usuario QA
    assert.equal(isQaMentorContext({ activeMentorship: qaSession, currentUser: realUser }), true);
    assert.equal(isQaMentorContext({ activeMentorship: realSession, currentUser: QA_TEST_LEADER_PROFILE }), true);
    assert.equal(
      isQaMentorContext({
        activeMentorship: realSession,
        currentUser: { id: QA_TEST_LEADER_ID, email: 'otro@empresa.com' },
      }),
      true
    );
    assert.equal(isQaMentorContext({ activeMentorship: realSession, currentUser: realUser }), false);

    const qaGuard = evaluateMentorRequestFrontendGuard({
      activeMentorship: qaSession,
      currentUser: QA_TEST_LEADER_PROFILE,
    });
    assert.equal(qaGuard.allowed, false);
    assert.equal(qaGuard.blockedMessage, QA_MENTOR_REQUEST_BLOCKED_MESSAGE);

    const realGuard = evaluateMentorRequestFrontendGuard({
      activeMentorship: realSession,
      currentUser: realUser,
    });
    assert.equal(realGuard.allowed, true);

    // Verifica que RequestMentorModal.tsx bloquea handleSubmit, handleVoiceSendDirect y dispatchRealEmail antes de fetch('/api/send')
    const modalSrc = fs.readFileSync('src/components/RequestMentorModal.tsx', 'utf-8');
    const fetchIdx = modalSrc.indexOf("fetch('/api/send'");
    const submitIdx = modalSrc.indexOf('const handleSubmit');
    const voiceIdx = modalSrc.indexOf('const handleVoiceSendDirect');
    const dispatchIdx = modalSrc.indexOf('const dispatchRealEmail');

    assert.ok(fetchIdx > -1 && submitIdx > -1 && voiceIdx > -1 && dispatchIdx > -1);
    assert.ok(
      modalSrc.slice(dispatchIdx, fetchIdx).includes('if (isQaSession)'),
      'dispatchRealEmail debe bloquear QA antes de llamar a fetch(/api/send)'
    );
    assert.ok(
      modalSrc.slice(submitIdx, submitIdx + 350).includes('if (isQaSession)'),
      'handleSubmit debe bloquear QA al inicio antes de cualquier envío'
    );
    assert.ok(
      modalSrc.slice(voiceIdx, voiceIdx + 350).includes('if (isQaSession)'),
      'handleVoiceSendDirect debe bloquear QA al inicio antes de cualquier envío'
    );
    assert.ok(modalSrc.includes('QA_TEST_LEADER_ID'));
    assert.ok(modalSrc.includes('activeMentorship?.isTestSession === true'));
    assert.ok(modalSrc.includes('qa-mentor-request-blocked'));
  });

  it('2. Backend Express (/api/send y /api/mentor/request): bloquea formulario QA sin enviar correo ni crear notificaciones mentor_request', async () => {
    process.env.RESEND_API_KEY = 're_test_qa_must_not_send';
    const callsBefore = resendOutboundCalls;

    const notifBeforeRes = await originalFetch(`${baseUrl}/api/notifications`);
    const notifBeforeData: any = await notifBeforeRes.json();
    const countBefore = notifBeforeData.notifications.length;

    const qaFormPayload = {
      leaderId: QA_TEST_LEADER_ID,
      sessionId: 'ment_qa_s4_12345',
      isTestSession: true,
      leaderName: QA_TEST_LEADER_PROFILE.name,
      leaderEmail: QA_TEST_LEADER_PROFILE.email,
      leaderPosition: QA_TEST_LEADER_PROFILE.position,
      companyName: QA_TEST_LEADER_PROFILE.companyName,
      currentStage: 4,
      caseTitle: 'Caso de prueba QA',
      reasonText: 'Solicitud de prueba por formulario en sesión QA',
      message: 'Solicitud de prueba por formulario en sesión QA',
      isVoiceAudio: false,
    };

    const sendRes = await originalFetch(`${baseUrl}/api/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(qaFormPayload),
    });
    const sendJson: any = await sendRes.json();

    assert.equal(sendRes.status, 403);
    assert.equal(sendJson.success, false);
    assert.equal(sendJson.blockedByQa, true);

    const mentorReqRes = await originalFetch(`${baseUrl}/api/mentor/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(qaFormPayload),
    });
    const mentorReqJson: any = await mentorReqRes.json();

    assert.equal(mentorReqRes.status, 403);
    assert.equal(mentorReqJson.success, false);
    assert.equal(mentorReqJson.blockedByQa, true);

    // Ningún correo real ni notificación mentor_request generada
    assert.equal(resendOutboundCalls, callsBefore, 'No debe invocarse Resend para formulario QA');

    const notifAfterRes = await originalFetch(`${baseUrl}/api/notifications`);
    const notifAfterData: any = await notifAfterRes.json();
    assert.equal(notifAfterData.notifications.length, countBefore);
    assert.equal(
      notifAfterData.notifications.some((n: any) => n.mentorRequestDetails?.leaderId === QA_TEST_LEADER_ID),
      false
    );
  });

  it('3. Backend Express (/api/send y /api/mentor/request): bloquea nota de voz QA incluso sin flag isTestSession explícito (por email/perfil/id QA)', async () => {
    process.env.RESEND_API_KEY = 're_test_qa_must_not_send';
    const callsBefore = resendOutboundCalls;

    const notifBeforeRes = await originalFetch(`${baseUrl}/api/notifications`);
    const notifBeforeData: any = await notifBeforeRes.json();
    const countBefore = notifBeforeData.notifications.length;

    const qaVoicePayload = {
      leaderName: QA_TEST_LEADER_PROFILE.name,
      leaderEmail: QA_TEST_LEADER_PROFILE.email,
      companyName: 'Industrias Nexus Automotriz',
      currentStage: 5,
      caseTitle: 'Caso de prueba QA',
      transcript: 'Nota de voz de prueba en sesión QA',
      reasonText: '[Nota de Voz] Nota de voz de prueba en sesión QA',
      isVoiceAudio: true,
    };

    const sendRes = await originalFetch(`${baseUrl}/api/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(qaVoicePayload),
    });
    const sendJson: any = await sendRes.json();

    assert.equal(sendRes.status, 403);
    assert.equal(sendJson.success, false);
    assert.equal(sendJson.blockedByQa, true);

    const mentorReqRes = await originalFetch(`${baseUrl}/api/mentor/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(qaVoicePayload),
    });
    const mentorReqJson: any = await mentorReqRes.json();

    assert.equal(mentorReqRes.status, 403);
    assert.equal(mentorReqJson.success, false);
    assert.equal(mentorReqJson.blockedByQa, true);

    assert.equal(resendOutboundCalls, callsBefore, 'No debe invocarse Resend para nota de voz QA');

    const notifAfterRes = await originalFetch(`${baseUrl}/api/notifications`);
    const notifAfterData: any = await notifAfterRes.json();
    assert.equal(notifAfterData.notifications.length, countBefore);
  });

  it('4. Handlers Vercel (api/send.ts, api/send-email.ts, api/notifications.ts): bloquean sesiones QA y permiten flujos reales', async () => {
    process.env.RESEND_API_KEY = 're_test_qa_must_not_send';
    const callsBefore = resendOutboundCalls;

    // A) api/send.ts bloquea QA (formulario y nota de voz)
    const qaSendMock = createMockRes();
    await vercelSendHandler(
      {
        method: 'POST',
        body: {
          isTestSession: true,
          leaderId: QA_TEST_LEADER_ID,
          leaderName: QA_TEST_LEADER_PROFILE.name,
          leaderEmail: QA_TEST_LEADER_PROFILE.email,
          reasonText: 'Prueba QA',
          isVoiceAudio: true,
        },
      },
      qaSendMock.res
    );
    assert.equal(qaSendMock.getStatus(), 403);
    assert.equal(qaSendMock.getJson().blockedByQa, true);
    assert.equal(resendOutboundCalls, callsBefore);

    // B) api/send-email.ts bloquea QA (p.ej. stage7_final_report o welcome con datos QA)
    const qaEmailMock = createMockRes();
    await vercelSendEmailHandler(
      {
        method: 'POST',
        body: {
          to: QA_TEST_LEADER_PROFILE.email,
          name: QA_TEST_LEADER_PROFILE.name,
          type: 'stage7_final_report',
          isTestSession: true,
        },
      },
      qaEmailMock.res
    );
    assert.equal(qaEmailMock.getStatus(), 403);
    assert.equal(qaEmailMock.getJson().blockedByQa, true);
    assert.equal(resendOutboundCalls, callsBefore);

    // C) api/notifications.ts bloquea POST QA
    const qaNotifMock = createMockRes();
    await vercelNotificationsHandler(
      {
        method: 'POST',
        body: {
          title: 'Solicitud QA',
          message: 'No debe guardarse',
          type: 'mentor_request',
          mentorRequestDetails: { leaderId: QA_TEST_LEADER_ID },
        },
      },
      qaNotifMock.res
    );
    assert.equal(qaNotifMock.getStatus(), 403);
    assert.equal(qaNotifMock.getJson().blockedByQa, true);

    // D) Usuario real sigue funcionando en api/send.ts y api/send-email.ts
    delete process.env.RESEND_API_KEY;
    const realSendMock = createMockRes();
    await vercelSendHandler(
      {
        method: 'POST',
        body: {
          leaderId: 'user_carlos_real',
          isTestSession: false,
          leaderName: 'Carlos Mendoza',
          leaderEmail: 'carlos.mendoza@novaretail.com',
          companyName: 'Retail Nova Grupo Comercial',
          currentStage: 3,
          caseTitle: 'Alineación de equipo de piso',
          reasonText: 'Necesito orientar una conversación con un supervisor.',
          isVoiceAudio: false,
        },
      },
      realSendMock.res
    );
    assert.equal(realSendMock.getStatus(), 200);
    assert.equal(realSendMock.getJson().success, true);

    const realEmailMock = createMockRes();
    await vercelSendEmailHandler(
      {
        method: 'POST',
        body: {
          to: 'carlos.mendoza@novaretail.com',
          name: 'Carlos Mendoza',
          type: 'welcome',
        },
      },
      realEmailMock.res
    );
    assert.equal(realEmailMock.getStatus(), 200);
    assert.equal(realEmailMock.getJson().success, true);
  });

  it('5. Backend Express: solicitud legítima de un usuario real sigue enviando correo y registrando mentor_request en serverNotifications', async () => {
    process.env.RESEND_API_KEY = 're_test_real_flow';
    const callsBefore = resendOutboundCalls;

    const notifBeforeRes = await originalFetch(`${baseUrl}/api/notifications`);
    const notifBeforeData: any = await notifBeforeRes.json();
    const countBefore = notifBeforeData.notifications.length;

    const realPayload = {
      leaderId: 'user_real_sofia',
      sessionId: 'ment_real_999',
      isTestSession: false,
      leaderName: 'Sofía Ramírez',
      leaderEmail: 'sofia.ramirez@empresa-real.com',
      leaderPosition: 'Gerente de Operaciones',
      companyName: 'Industrias Nexus Automotriz',
      currentStage: 4,
      caseTitle: 'Delegación efectiva en turno vespertino',
      reasonText: 'Quiero revisar cómo manejar objeciones de mi coordinador.',
      isVoiceAudio: false,
    };

    const sendRes = await originalFetch(`${baseUrl}/api/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(realPayload),
    });
    const sendJson: any = await sendRes.json();

    assert.equal(sendRes.status, 200);
    assert.equal(sendJson.success, true);
    assert.ok(sendJson.notification);
    assert.equal(sendJson.notification.type, 'mentor_request');
    assert.equal(sendJson.notification.mentorRequestDetails.leaderId, 'user_real_sofia');
    assert.equal(resendOutboundCalls, callsBefore + 1);

    const mentorReqRes = await originalFetch(`${baseUrl}/api/mentor/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(realPayload),
    });
    const mentorReqJson: any = await mentorReqRes.json();

    assert.equal(mentorReqRes.status, 200);
    assert.equal(mentorReqJson.success, true);
    assert.equal(resendOutboundCalls, callsBefore + 2);

    const notifAfterRes = await originalFetch(`${baseUrl}/api/notifications`);
    const notifAfterData: any = await notifAfterRes.json();
    assert.equal(notifAfterData.notifications.length, countBefore + 2);

    // Verifica que isQaRequestPayload no produce falsos positivos incluso con nombres similares reales
    assert.equal(
      isQaRequestPayload({
        leaderId: 'user_laura_real',
        leaderName: 'Laura Méndez',
        leaderEmail: 'laura.mendez@empresa.com',
        sessionId: 'ment_real_456',
      }).isQa,
      false
    );
  });
});
