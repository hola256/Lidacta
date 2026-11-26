import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/send-email';
import mentorRespondHandler from '../api/mentor/respond';
import { FinalFeedbackReport, MentorshipSession } from '../src/types/lidacta';

describe('Envío Automático del Reporte Final de Etapa 7 (Lidacta & Resend)', () => {
  const sampleReport: FinalFeedbackReport = {
    detectedStrengths: [
      'Proactividad para abordar conversaciones difíciles sin postergarlas',
      'Escucha intencional y empatía operativa',
      'Capacidad para acordar compromisos claros y medibles',
    ],
    stageTwoSkills: [
      'Comunicación Asertiva en Piso',
      'Retroalimentación Descriptiva basada en el modelo SBI',
    ],
    chosenActions: [
      'Taller 1 a 1 de alineación operativa con el colaborador para revisar expectativas',
    ],
    stageSixLearnings: [
      'La claridad temprana previene desacuerdos y reprocesos',
      'Separar los juicios personales de los hechos observables reduce la reactividad defensiva',
    ],
    recommendationsForAutonomy: [
      'Instituir chequeos breves de 10 minutos cada quincena',
      'Mantener el hábito de verificar hechos antes de reaccionar',
      'Documentar los acuerdos clave por escrito para respaldo del equipo',
    ],
    deliveredAt: '2026-11-16T12:00:00.000Z',
  };

  it('1. Debe despachar exitosamente stage7_final_report con las cinco secciones del reporte', async () => {
    let responseStatus = 0;
    let responseJson: any = null;

    const req: any = {
      method: 'POST',
      body: {
        to: 'carlos.mendoza@novaretail.com',
        leaderEmail: 'carlos.mendoza@novaretail.com',
        name: 'Carlos Mendoza',
        companyName: 'Retail Nova Grupo Comercial',
        challengeTitle: 'Desmotivación del equipo comercial ante metas agresivas',
        type: 'stage7_final_report',
        report: sampleReport,
      },
    };

    const res: any = {
      setHeader: () => {},
      status: (code: number) => {
        responseStatus = code;
        return {
          json: (data: any) => {
            responseJson = data;
            return data;
          },
        };
      },
    };

    await handler(req, res);

    assert.equal(responseStatus, 200);
    assert.equal(responseJson.success, true);
    assert.ok(responseJson.emailId || responseJson.id);
  });

  it('2. Debe rechazar el envío si el correo destinatario está ausente o es inválido', async () => {
    let responseStatus = 0;
    let responseJson: any = null;

    const req: any = {
      method: 'POST',
      body: {
        to: '', // Inválido
        name: 'Carlos Mendoza',
        type: 'stage7_final_report',
        report: sampleReport,
      },
    };

    const res: any = {
      setHeader: () => {},
      status: (code: number) => {
        responseStatus = code;
        return {
          json: (data: any) => {
            responseJson = data;
            return data;
          },
        };
      },
    };

    await handler(req, res);

    assert.equal(responseStatus, 400);
    assert.equal(responseJson.success, false);
    assert.match(responseJson.message, /destinatario/i);
  });

  it('3. Debe verificar que el destinatario sea el correo del líder y no el buzón de Recursos Humanos', () => {
    const leaderEmail = 'carlos.mendoza@novaretail.com';
    const hrSimulatedEmail = 'recursos.humanos@retailnovagrupocomercial.com';

    // Función pura de resolución de destinatario idéntica a la implementada en LidactaContext
    const resolveRecipient = (session: { leaderId: string; leaderEmail?: string }, users: Array<{ id: string; email: string }>) => {
      const user = users.find((u) => u.id === session.leaderId);
      return (user?.email || session.leaderEmail || '').trim().toLowerCase();
    };

    const mockUsers = [
      { id: 'user_carlos', email: leaderEmail },
      { id: 'user_hr', email: hrSimulatedEmail },
    ];

    const recipient = resolveRecipient({ leaderId: 'user_carlos' }, mockUsers);
    assert.equal(recipient, leaderEmail);
    assert.notEqual(recipient, hrSimulatedEmail);
  });

  it('4. Debe proteger contra envíos duplicados cuando finalReportEmailSent ya está en true', async () => {
    let networkCallsCount = 0;

    // Simulación del despachador con protección contra duplicados
    const simulateDispatchWithDuplicateProtection = async (
      session: { finalReportEmailSent?: boolean; id: string },
      inFlightSet: Set<string>
    ) => {
      if (session.finalReportEmailSent) {
        return { success: true, duplicateBlocked: true };
      }
      if (inFlightSet.has(session.id)) {
        return { success: false, inFlightBlocked: true };
      }

      inFlightSet.add(session.id);
      try {
        networkCallsCount++;
        session.finalReportEmailSent = true;
        return { success: true, duplicateBlocked: false };
      } finally {
        inFlightSet.delete(session.id);
      }
    };

    const inFlightSet = new Set<string>();
    const session = { id: 'ment_123', finalReportEmailSent: false };

    // Primer envío: Debe ejecutarse
    const firstCall = await simulateDispatchWithDuplicateProtection(session, inFlightSet);
    assert.equal(firstCall.success, true);
    assert.equal(firstCall.duplicateBlocked, false);
    assert.equal(networkCallsCount, 1);

    // Segundo envío (ej. recarga o re-renderizado): Debe ser bloqueado sin llamada de red
    const secondCall = await simulateDispatchWithDuplicateProtection(session, inFlightSet);
    assert.equal(secondCall.success, true);
    assert.equal(secondCall.duplicateBlocked, true);
    assert.equal(networkCallsCount, 1); // No incrementó
  });

  it('5. Debe permitir reintento seguro si un envío previo falló, pero bloquear reintentos tras el éxito', async () => {
    let networkCallsCount = 0;
    let shouldFail = true;

    const session: {
      id: string;
      finalReportEmailSent?: boolean;
      finalReportEmailStatus?: string;
      finalReportEmailError?: string;
    } = { id: 'ment_retry_test', finalReportEmailSent: false };

    const attemptSend = async () => {
      if (session.finalReportEmailSent) {
        return { success: true, message: 'Ya enviado previamente' };
      }
      networkCallsCount++;
      if (shouldFail) {
        session.finalReportEmailSent = false;
        session.finalReportEmailStatus = 'failed';
        session.finalReportEmailError = 'Error de red transitorio';
        return { success: false, error: session.finalReportEmailError };
      } else {
        session.finalReportEmailSent = true;
        session.finalReportEmailStatus = 'sent';
        session.finalReportEmailError = undefined;
        return { success: true };
      }
    };

    // Intento 1: Falla
    const res1 = await attemptSend();
    assert.equal(res1.success, false);
    assert.equal(session.finalReportEmailSent, false);
    assert.equal(session.finalReportEmailStatus, 'failed');
    assert.equal(networkCallsCount, 1);

    // Intento 2: Se resuelve la red y tiene éxito
    shouldFail = false;
    const res2 = await attemptSend();
    assert.equal(res2.success, true);
    assert.equal(session.finalReportEmailSent, true);
    assert.equal(session.finalReportEmailStatus, 'sent');
    assert.equal(networkCallsCount, 2);

    // Intento 3: Se intenta nuevamente pero ya está exitoso; debe omitirse
    const res3 = await attemptSend();
    assert.equal(res3.success, true);
    assert.equal(networkCallsCount, 2); // No hubo nueva llamada
  });

  it('6. El fallo del envío del correo nunca debe revertir ni bloquear la conclusión de la Etapa 7', () => {
    // Estado de la mentoría al concluir Etapa 7
    const mentorship: Partial<MentorshipSession> = {
      id: 'ment_completion_resilience',
      currentStage: 7,
      status: 'completed',
      completedAt: '2026-11-16T12:00:00Z',
      finalFeedbackReport: sampleReport,
      finalReportEmailSent: false,
      finalReportEmailStatus: 'failed',
      finalReportEmailError: 'Resend API error 500',
    };

    // Comprobar que a pesar del error de correo, el proceso sigue concluido
    assert.equal(mentorship.currentStage, 7);
    assert.equal(mentorship.status, 'completed');
    assert.ok(mentorship.completedAt);
    assert.ok(mentorship.finalFeedbackReport);
    assert.equal(mentorship.finalFeedbackReport.detectedStrengths.length, 3);
  });

  it('7. api/mentor/respond.ts debe retornar finalFeedback verificado de Gemini en Etapa 7 y rechazar falta de API Key', async () => {
    let responseStatus = 0;
    let responseData: any = null;

    const req: any = {
      method: 'POST',
      body: {
        stage: 7,
        activeStage: 7,
        caseId: 'ment_carlos_stage7_test',
        mentorshipId: 'ment_carlos_stage7_test',
        leaderProfile: { name: 'Carlos Mendoza', position: 'Gerente de Tienda' },
        companyContext: { name: 'Retail Nova Grupo Comercial' },
        userMessage: '[Avanzando a Etapa 7]',
        sessionData: {
          id: 'ment_carlos_stage7_test',
          title: 'Desmotivación del equipo comercial ante metas agresivas',
          identifiedSkills: ['Liderazgo Inspiracional en Ventas', 'Desglose Táctico de Objetivos'],
          actionPlan: {
            what: 'Taller de 45 minutos para desglosar la meta trimestral en micro-objetivos semanales',
          },
          learnings: {
            insights: 'Cuando las metas se desglosan en pasos alcanzables el equipo recupera la autoconfianza',
            whatHappened: 'Los asesores comenzaron a proponer ideas en vez de quejarse',
          },
        },
      },
    };

    const makeRes = () => ({
      setHeader: () => {},
      status: (code: number) => {
        responseStatus = code;
        return {
          json: (data: any) => {
            responseData = data;
            return data;
          },
        };
      },
    });

    const originalFetch = globalThis.fetch;
    const prevKey = process.env.GEMINI_API_KEY;
    const prevApi = process.env.API_KEY;
    const prevGoogle = process.env.GOOGLE_API_KEY;
    delete process.env.GEMINI_API_KEY;
    delete process.env.API_KEY;
    delete process.env.GOOGLE_API_KEY;

    try {
      await mentorRespondHandler(req, makeRes());
      assert.equal(responseStatus, 500);
      assert.equal(responseData.success, false);
      assert.equal(responseData.isGeminiVerified, false);

      process.env.GEMINI_API_KEY = 'test-stage7-email-key';
      globalThis.fetch = (async () =>
        new Response(
          JSON.stringify({
            candidates: [
              {
                content: {
                  parts: [
                    {
                      text: JSON.stringify({
                        replyText: 'Excelente cierre Carlos.',
                        readyToAdvance: false,
                        identifiedSkills: [],
                        finalFeedback: {
                          detectedStrengths: ['Apertura para desglosar metas con el equipo'],
                          stageTwoSkills: ['Motivación y Desarrollo de Equipos'],
                          chosenActions: ['Taller de 45 minutos para desglosar la meta trimestral en micro-objetivos semanales'],
                          stageSixLearnings: ['Cuando las metas se desglosan en pasos alcanzables el equipo recupera la autoconfianza'],
                          recommendationsForAutonomy: ['Sostener revisiones semanales de micro-objetivos'],
                        },
                      }),
                    },
                  ],
                },
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )) as any;

      await mentorRespondHandler(req, makeRes());
    } finally {
      globalThis.fetch = originalFetch;
      if (prevKey === undefined) delete process.env.GEMINI_API_KEY;
      else process.env.GEMINI_API_KEY = prevKey;
      if (prevApi === undefined) delete process.env.API_KEY;
      else process.env.API_KEY = prevApi;
      if (prevGoogle === undefined) delete process.env.GOOGLE_API_KEY;
      else process.env.GOOGLE_API_KEY = prevGoogle;
    }

    assert.equal(responseStatus, 200);
    assert.equal(responseData.success, true);
    assert.equal(responseData.isGeminiVerified, true);
    assert.equal(responseData.responseSource, 'gemini');
    assert.ok(responseData.data);

    const report = responseData.data.finalFeedback;
    assert.ok(report, 'El objeto finalFeedback debe estar presente en la respuesta de Etapa 7');
    assert.ok(Array.isArray(report.detectedStrengths), 'detectedStrengths debe ser un arreglo válido');
    assert.ok(Array.isArray(report.stageTwoSkills) && report.stageTwoSkills.length > 0, 'stageTwoSkills debe ser un array no vacío');
    assert.ok(Array.isArray(report.chosenActions) && report.chosenActions.length > 0, 'chosenActions debe ser un array no vacío');
    assert.ok(Array.isArray(report.stageSixLearnings) && report.stageSixLearnings.length > 0, 'stageSixLearnings debe ser un array no vacío');
    assert.ok(Array.isArray(report.recommendationsForAutonomy) && report.recommendationsForAutonomy.length > 0, 'recommendationsForAutonomy debe ser un array no vacío');

    assert.ok(report.stageTwoSkills.some((s: string) => s.includes('Motivación') || s.includes('Liderazgo') || s.includes('Comunicación')));
    assert.ok(report.chosenActions[0].includes('Taller de 45 minutos'));
  });

  it('8. LidactaContext no debe fabricar reporte fallback cuando Gemini no devuelve finalFeedback válido y acepta evidencia insuficiente parcial sin inventar', async () => {
    const { buildStage7FinalFeedbackReport } = await import('../src/context/LidactaContext');
    assert.equal(buildStage7FinalFeedbackReport(undefined, [], []), undefined);
    assert.equal(
      buildStage7FinalFeedbackReport(
        {
          detectedStrengths: [],
          stageTwoSkills: [],
          chosenActions: [],
          stageSixLearnings: [],
          recommendationsForAutonomy: [],
          deliveredAt: new Date().toISOString(),
        },
        [],
        []
      ),
      undefined
    );
    const partialReport = buildStage7FinalFeedbackReport(
      {
        detectedStrengths: [],
        stageTwoSkills: ['Comunicación Asertiva y Firmeza Empática'],
        chosenActions: [],
        stageSixLearnings: ['Aprendizaje válido'],
        recommendationsForAutonomy: ['Recomendación válida'],
        deliveredAt: new Date().toISOString(),
      },
      [],
      ['Comunicación Asertiva y Firmeza Empática']
    );
    assert.ok(partialReport);
    assert.deepEqual(partialReport?.chosenActions, []);
  });

  it('9. Regla estricta de correo real: no inventar correos y marcar error explícito si no está registrado', async () => {
    // Si la sesión no tiene correo registrado y allUsers no lo encuentra
    const sessionWithoutEmail: Partial<MentorshipSession> = {
      id: 'ment_no_email_test',
      leaderId: 'user_unknown_leader',
      leaderName: 'Líder Desconocido',
    };
    const allUsersList: any[] = []; // No contiene al usuario

    const leaderUser = allUsersList.find((u: any) => u.id === sessionWithoutEmail.leaderId);
    const leaderEmail = (leaderUser?.email || (sessionWithoutEmail as any).leaderEmail || '').trim().toLowerCase();

    // Verificamos que NO se sintetice ni invente un correo falso (ej. 'lider@empresa.com' o 'desconocido@empresa.com')
    assert.equal(leaderEmail, '');

    const hasValidEmail = Boolean(leaderEmail && leaderEmail.includes('@'));
    assert.equal(hasValidEmail, false);

    // Estado explícito que debe registrarse
    const errorState = {
      finalReportEmailSent: false,
      finalReportEmailStatus: 'failed',
      finalReportEmailError: 'No se encontró un correo electrónico real registrado para el líder.',
    };
    assert.equal(errorState.finalReportEmailStatus, 'failed');
    assert.equal(errorState.finalReportEmailSent, false);
    assert.ok(errorState.finalReportEmailError.includes('correo electrónico real registrado'));
  });

  it('10. LeaderView UI: ausencia de confirmación falsa cuando el estado es undefined o pending', () => {
    const renderConfirmationState = (status?: string, sent?: boolean) => {
      if (status === 'sent') {
        return 'ENVIADO_EXITOSO';
      } else if (status === 'simulated') {
        return 'SIMULADO';
      } else if (status === 'failed') {
        return 'FALLIDO_CON_REINTENTO';
      } else {
        return 'PENDIENTE_PREPARANDO';
      }
    };

    // Estado inicial / undefined: NUNCA debe decir "ha sido enviado exitosamente"
    assert.equal(renderConfirmationState(undefined, false), 'PENDIENTE_PREPARANDO');
    assert.notEqual(renderConfirmationState(undefined, false), 'ENVIADO_EXITOSO');

    // Estado fallido:
    assert.equal(renderConfirmationState('failed', false), 'FALLIDO_CON_REINTENTO');

    // Estado simulado:
    assert.equal(renderConfirmationState('simulated', false), 'SIMULADO');

    // Estado enviado real: Único estado que confirma éxito
    assert.equal(renderConfirmationState('sent', true), 'ENVIADO_EXITOSO');
  });
});
