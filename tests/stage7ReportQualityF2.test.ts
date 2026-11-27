import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import respondHandler, {
  claimsActionAlreadyExecuted,
  extractRegisteredStage5Actions,
  extractRegisteredStage6Learnings,
  extractStructuredStage6Learnings,
  indicatesPendingOrUnexecutedAction,
  resolveStage7ChosenActions,
} from '../api/mentor/respond';
import {
  buildStage7FinalFeedbackReport,
  executeTransactionalStageTransition,
  CaseOperationKind,
} from '../src/context/LidactaContext';
import {
  CompanyContext,
  FinalFeedbackReport,
  MentorshipSession,
  NotificationItem,
  UserProfile,
} from '../src/types/lidacta';

function createMockRes() {
  const res: any = {
    statusCode: 200,
    headers: {} as Record<string, string>,
    body: null as any,
    setHeader(k: string, v: string) {
      this.headers[k] = v;
    },
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: any) {
      this.body = payload;
      return this;
    },
    end() {
      return this;
    },
  };
  return res;
}

async function invokeProdStage7(
  reqBody: any,
  geminiResponseFactory: (url: string, init?: any) => Response | Promise<Response>,
  apiKey: string | null = 'dummy-f2-prod-key'
) {
  const originalFetch = globalThis.fetch;
  const prevKey = process.env.GEMINI_API_KEY;
  const prevApi = process.env.API_KEY;
  const prevGoogle = process.env.GOOGLE_API_KEY;

  if (apiKey === null) {
    delete process.env.GEMINI_API_KEY;
    delete process.env.API_KEY;
    delete process.env.GOOGLE_API_KEY;
  } else {
    process.env.GEMINI_API_KEY = apiKey;
  }

  globalThis.fetch = (async (input: any, init?: any) =>
    geminiResponseFactory(typeof input === 'string' ? input : input?.url || '', init)) as any;

  try {
    const res = createMockRes();
    await respondHandler({ method: 'POST', body: reqBody }, res);
    return res;
  } finally {
    globalThis.fetch = originalFetch;
    if (prevKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = prevKey;
    if (prevApi === undefined) delete process.env.API_KEY;
    else process.env.API_KEY = prevApi;
    if (prevGoogle === undefined) delete process.env.GOOGLE_API_KEY;
    else process.env.GOOGLE_API_KEY = prevGoogle;
  }
}

async function invokeDevStage7(
  reqBody: any,
  geminiResponseFactory: (url: string, init?: any) => Response | Promise<Response>,
  apiKey: string | null = 'dummy-f2-dev-key'
) {
  const originalFetch = globalThis.fetch;
  const prevKey = process.env.GEMINI_API_KEY;
  const prevApi = process.env.API_KEY;
  const prevGoogle = process.env.GOOGLE_API_KEY;

  if (apiKey === null) {
    delete process.env.GEMINI_API_KEY;
    delete process.env.API_KEY;
    delete process.env.GOOGLE_API_KEY;
  } else {
    process.env.GEMINI_API_KEY = apiKey;
  }

  const modUrl = new URL(`../server.ts?f2=${Date.now()}-${Math.random()}`, import.meta.url).href;
  const { app } = await import(modUrl);

  globalThis.fetch = (async (input: any, init?: any) => {
    const url = typeof input === 'string' ? input : input?.url || '';
    if (url.startsWith('http://127.0.0.1:')) return originalFetch(input, init);
    return geminiResponseFactory(url, init);
  }) as any;

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const address = server.address() as any;

  try {
    const resp = await originalFetch(`http://127.0.0.1:${address.port}/api/mentor/respond`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Connection: 'close' },
      body: JSON.stringify(reqBody),
    });
    const body = await resp.json();
    return { statusCode: resp.status, body };
  } finally {
    globalThis.fetch = originalFetch;
    (server as any).closeAllConnections?.();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    if (prevKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = prevKey;
    if (prevApi === undefined) delete process.env.API_KEY;
    else process.env.API_KEY = prevApi;
    if (prevGoogle === undefined) delete process.env.GOOGLE_API_KEY;
    else process.env.GOOGLE_API_KEY = prevGoogle;
  }
}

function makeGeminiResponse(finalFeedback: any, replyText = 'Cierre sintetizado con fidelidad al proceso real.') {
  return new Response(
    JSON.stringify({
      candidates: [
        {
          content: {
            parts: [
              {
                text: JSON.stringify({
                  replyText,
                  readyToAdvance: false,
                  advancePrompt: null,
                  identifiedSkills: [],
                  detectedTheme: 'Comunicación Asertiva y Acuerdos',
                  isTherapeuticCase: false,
                  finalFeedback,
                }),
              },
            ],
          },
        },
      ],
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
}

const baseSkillEntries = [
  {
    skill: 'Retroalimentación Constructiva y Conversaciones Difíciles',
    cluster: 'retroalimentacion',
    status: 'vigente',
    initialStage: 2,
    lastUpdatedStage: 2,
    createdAt: '2026-02-01T10:00:00Z',
    updatedAt: '2026-02-01T10:20:00Z',
    evidenceHistory: [
      {
        id: 'ev_f2_1',
        stage: 2,
        sourceType: 'experiencia_relatada',
        evidenceText: 'Evita abordar los retrasos recurrentes en entregas para no generar incomodidad.',
        timestamp: '2026-02-01T10:20:00Z',
      },
    ],
  },
];

describe('Frente 2 — Calidad y fidelidad de síntesis del reporte final de Etapa 7', () => {
  it('1. Plan ejecutado: diferencia acción ejecutada, resultados reales, obstáculos (whatDidnt) y aprendizajes sustantivos', async () => {
    const sessionData = {
      id: 'case_f2_exec',
      title: 'Retrasos en entregas de almacén',
      skillEntries: baseSkillEntries,
      identifiedSkills: ['Retroalimentación Constructiva y Conversaciones Difíciles'],
      chosenAlternative: 'Aplicar retroalimentación SBI en junta breve',
      actionPlan: {
        what: 'Sostener reunión 1 a 1 con Marcos usando hechos observables de la última quincena',
        when: 'Miércoles 08:30 AM',
        withWhom: 'Marcos Ruiz',
        how: 'Con registro de tres entregas tardías y preguntas abiertas',
        careReminders: 'Cuidar tono calmado y validar acuerdos por escrito',
        isCompleted: true,
      },
      actionPlanExecutionStatus: 'executed',
      learnings: {
        whatHappened: 'Marcos reconoció dos cuellos de botella en recepción y acordó corte diario a las 16:00.',
        whatWorked: 'Presentar los datos concretos antes de pedir propuestas.',
        whatDidnt: 'Faltó confirmar en el momento quién cubriría su turno durante el corte diario.',
        insights: 'Cuando separo hechos de juicios, Marcos asume corresponsabilidad en lugar de defenderse.',
        futureAdjustments: 'Definir responsable de respaldo y revisar el avance el próximo lunes.',
      },
    };

    const structured = extractStructuredStage6Learnings(sessionData, 'executed');
    assert.deepEqual(structured.results, [
      'Marcos reconoció dos cuellos de botella en recepción y acordó corte diario a las 16:00.',
      'Presentar los datos concretos antes de pedir propuestas.',
    ]);
    assert.deepEqual(structured.obstacles, [
      'Faltó confirmar en el momento quién cubriría su turno durante el corte diario.',
    ]);
    assert.deepEqual(structured.insights, [
      'Cuando separo hechos de juicios, Marcos asume corresponsabilidad en lugar de defenderse.',
    ]);
    assert.deepEqual(structured.futureAdjustments, [
      'Definir responsable de respaldo y revisar el avance el próximo lunes.',
    ]);

    const fallbackLearnings = extractRegisteredStage6Learnings(sessionData, 'executed');
    assert.ok(
      fallbackLearnings.includes(
        'Obstáculo identificado: Faltó confirmar en el momento quién cubriría su turno durante el corte diario.'
      ),
      'extractRegisteredStage6Learnings debe incluir whatDidnt sustantivo como obstáculo'
    );

    const reqBody = {
      caseId: sessionData.id,
      stage: 7,
      leaderProfile: { name: 'Ana Torres', position: 'Gerente de Operaciones' },
      companyContext: { name: 'Logística Norte' },
      conversationHistory: [
        { id: 'm1', caseId: sessionData.id, sender: 'leader', stage: 1, text: 'Marcos entrega tarde los reportes.' },
        { id: 'm6', caseId: sessionData.id, sender: 'leader', stage: 6, text: 'Ya ejecuté la reunión con Marcos.' },
      ],
      userMessage: '[Avanzando a Etapa 7]',
      sessionData,
    };

    let capturedPromptProd = '';
    const geminiFactory = (_url: string, init?: any) => {
      const parsed = JSON.parse(String(init?.body || '{}'));
      const text =
        parsed?.contents?.[parsed.contents.length - 1]?.parts?.[0]?.text || '';
      if (text.includes('safeSessionContext') || text.includes('ESTADO REAL DEL COMPROMISO')) {
        capturedPromptProd = text;
      }
      return makeGeminiResponse({
        detectedStrengths: ['Preparación objetiva con hechos concretos antes de conversar'],
        stageTwoSkills: ['Retroalimentación Constructiva y Conversaciones Difíciles'],
        chosenActions: [
          'Ejecutada reunión 1 a 1 con Marcos con hechos de la quincena, definiendo corte diario a las 16:00',
        ],
        stageSixLearnings: [
          'Resultado obtenido: Marcos asumió los retrasos y propuso un corte diario a las 16:00.',
          'Obstáculo pendiente: quedó por definir quién cubre el turno durante ese corte.',
          'Aprendizaje: presentar datos observables reduce la defensividad.',
        ],
        recommendationsForAutonomy: [
          'Confirmar mañana el respaldo de turno y validar el primer corte semanal el lunes.',
        ],
      });
    };

    const prodRes = await invokeProdStage7(reqBody, geminiFactory);
    const devRes = await invokeDevStage7(reqBody, geminiFactory);

    assert.match(capturedPromptProd, /"results":\["Marcos reconoció/);
    assert.match(capturedPromptProd, /"obstacles":\["Faltó confirmar/);
    assert.match(capturedPromptProd, /Resultados reales reportados \(Etapa 6\):/);
    assert.match(capturedPromptProd, /Obstáculos o qué no funcionó \(Etapa 6\):/);

    for (const r of [prodRes, devRes]) {
      assert.equal(r.statusCode, 200);
      assert.equal(r.body.isGeminiVerified, true);
      assert.match(r.body.data.finalFeedback.chosenActions[0], /Marcos/);
      assert.equal(r.body.data.finalFeedback.stageSixLearnings.length, 3);
    }
  });

  it('2. Plan no ejecutado con obstáculos y aprendizajes válidos: conserva obstáculos/aprendizajes sin fabricar resultados', async () => {
    const sessionData = {
      id: 'case_f2_noexec_obs',
      title: 'Conversación difícil pendiente',
      skillEntries: baseSkillEntries,
      identifiedSkills: ['Retroalimentación Constructiva y Conversaciones Difíciles'],
      actionPlan: {
        what: 'Conversar 1 a 1 con Valeria sobre coordinación de entregas',
        when: 'Viernes 10:00 AM',
        withWhom: 'Valeria Soto',
        how: 'Modelo SBI en sala privada',
        isCompleted: false,
      },
      actionPlanExecutionStatus: 'not_executed',
      learnings: {
        whatHappened: 'Aún no lo sé',
        whatWorked: 'No aplica',
        whatDidnt: 'Se atravesó una auditoría externa en planta y no pudimos coincidir en horario.',
        insights: 'Me di cuenta de que necesito bloquear el espacio en agenda desde inicios de semana.',
        futureAdjustments: 'Reprogramar la charla para el martes 09:00 AM.',
      },
    };

    const structured = extractStructuredStage6Learnings(sessionData, 'not_executed');
    assert.deepEqual(structured.results, [], 'No deben extraerse resultados si no hubo ejecución');
    assert.deepEqual(structured.obstacles, [
      'Se atravesó una auditoría externa en planta y no pudimos coincidir en horario.',
    ]);
    assert.deepEqual(structured.insights, [
      'Me di cuenta de que necesito bloquear el espacio en agenda desde inicios de semana.',
    ]);
    assert.deepEqual(structured.futureAdjustments, [
      'Reprogramar la charla para el martes 09:00 AM.',
    ]);

    const fallbackLearnings = extractRegisteredStage6Learnings(sessionData, 'not_executed');
    assert.ok(!fallbackLearnings.some((l) => /aún no lo sé|no aplica/i.test(l)));
    assert.ok(
      fallbackLearnings.some((l) =>
        l.includes('Se atravesó una auditoría externa en planta y no pudimos coincidir en horario.')
      )
    );
    assert.ok(
      fallbackLearnings.some((l) =>
        l.includes('Me di cuenta de que necesito bloquear el espacio en agenda desde inicios de semana.')
      )
    );

    const reqBody = {
      caseId: sessionData.id,
      stage: 7,
      leaderProfile: { name: 'Ana Torres', position: 'Gerente' },
      companyContext: { name: 'Logística Norte' },
      conversationHistory: [
        { id: 'm1', caseId: sessionData.id, sender: 'leader', stage: 1, text: 'Tengo pendiente hablar con Valeria.' },
        { id: 'm6', caseId: sessionData.id, sender: 'leader', stage: 6, text: 'Todavía no la ejecuto por la auditoría externa.' },
      ],
      userMessage: '[Avanzando a Etapa 7]',
      sessionData,
    };

    const geminiFactory = () =>
      makeGeminiResponse({
        detectedStrengths: ['Reconocimiento honesto del obstáculo operativo sin evadir el compromiso'],
        stageTwoSkills: ['Retroalimentación Constructiva y Conversaciones Difíciles'],
        chosenActions: [],
        stageSixLearnings: [
          'Obstáculo operativo: la auditoría externa impidió sostener la reunión prevista con Valeria.',
          'Aprendizaje: agendar conversaciones críticas desde el lunes evita que la operación las desplace.',
        ],
        recommendationsForAutonomy: ['Confirmar hoy la cita del martes 09:00 AM con Valeria.'],
      });

    const prodRes = await invokeProdStage7(reqBody, geminiFactory);
    const devRes = await invokeDevStage7(reqBody, geminiFactory);

    for (const r of [prodRes, devRes]) {
      assert.equal(r.statusCode, 200);
      assert.match(r.body.data.finalFeedback.chosenActions[0], /pendiente de ejecución/i);
      assert.equal(r.body.data.finalFeedback.stageSixLearnings.length, 2);
      assert.match(r.body.data.finalFeedback.stageSixLearnings[0], /auditoría externa/i);
    }
  });

  it('3. Plan no ejecutado sin resultados inventados: bloquea resultados ficticios o afirmaciones de ejecución falsa y rechaza reportes solo con error de botón', async () => {
    const staleSessionData = {
      id: 'case_f2_noexec_guard',
      title: 'Alineación pendiente',
      skillEntries: baseSkillEntries,
      identifiedSkills: ['Retroalimentación Constructiva y Conversaciones Difíciles'],
      actionPlan: {
        what: 'Revisar indicadores semanales con equipo de empaque',
        when: 'Jueves 11:00 AM',
        withWhom: 'Equipo de empaque',
        isCompleted: true,
      },
      // Estado crudo obsoleto en executed, pero historial de Etapa 6 aclara que no ejecutó
      actionPlanExecutionStatus: 'executed',
      learnings: {
        whatHappened: 'El equipo reaccionó muy bien tras la reunión.',
        whatWorked: 'Mostrar gráficas.',
        whatDidnt: '',
        insights: 'Me equivoqué al presionar el botón, no he ejecutado la acción aún.',
        futureAdjustments: '',
      },
    };

    const reqBody = {
      caseId: staleSessionData.id,
      stage: 7,
      leaderProfile: { name: 'Ana Torres', position: 'Gerente' },
      companyContext: { name: 'Logística Norte' },
      conversationHistory: [
        { id: 'm1', caseId: staleSessionData.id, sender: 'leader', stage: 1, text: 'Falta seguimiento en empaque.' },
        { id: 'm6_yes', caseId: staleSessionData.id, sender: 'leader', stage: 6, text: 'Sí, ya ejecuté mi Plan de Acción.' },
        { id: 'm6_corr', caseId: staleSessionData.id, sender: 'leader', stage: 6, text: 'Perdón, presioné Sí por error, aún no he ejecutado el plan.' },
        { id: 'm6_ok', caseId: staleSessionData.id, sender: 'leader', stage: 6, text: 'Gracias, continuemos.' },
      ],
      userMessage: '[Avanzando a Etapa 7]',
      sessionData: staleSessionData,
    };

    let capturedSystem = '';
    let capturedUserPrompt = '';
    const contradictingGeminiFactory = (_url: string, init?: any) => {
      const parsed = JSON.parse(String(init?.body || '{}'));
      capturedSystem = parsed?.systemInstruction?.parts?.[0]?.text || '';
      capturedUserPrompt = parsed?.contents?.[parsed.contents.length - 1]?.parts?.[0]?.text || '';
      return makeGeminiResponse({
        detectedStrengths: ['Honestidad para corregir el estado real de su plan'],
        stageTwoSkills: ['Retroalimentación Constructiva y Conversaciones Difíciles'],
        // Gemini contradice el estado real diciendo que ya se ejecutó
        chosenActions: ['La reunión con el equipo de empaque ya se ejecutó con éxito el jueves.'],
        stageSixLearnings: [
          'La reunión ya se realizó con éxito y el equipo reaccionó bien.',
          'Me equivoqué al presionar el botón, no he ejecutado la acción aún.',
        ],
        recommendationsForAutonomy: ['Definir nueva fecha realista esta semana.'],
      });
    };

    const prodRes = await invokeProdStage7(reqBody, contradictingGeminiFactory);
    const devRes = await invokeDevStage7(reqBody, contradictingGeminiFactory);

    // El contexto enviado a Gemini (system dinámico + safeSessionContext) debe usar el estado reconciliado not_executed y NO arrastrar whatHappened/whatWorked
    assert.ok(!capturedSystem.includes('Estado de ejecución del Plan de Acción (Etapa 6): executed'));
    assert.match(capturedSystem, /Estado de ejecución del Plan de Acción \(Etapa 6\): not_executed/);
    assert.ok(!capturedUserPrompt.includes('El equipo reaccionó muy bien tras la reunión.'));
    assert.match(capturedUserPrompt, /"actionPlanExecutionStatus":"not_executed"/);

    for (const r of [prodRes, devRes]) {
      assert.equal(r.statusCode, 200);
      assert.match(r.body.data.finalFeedback.chosenActions[0], /pendiente de ejecución/i);
      assert.ok(!r.body.data.finalFeedback.chosenActions[0].includes('ya se ejecutó con éxito'));
      assert.deepEqual(
        r.body.data.finalFeedback.stageSixLearnings,
        [],
        'No debe quedar ni la disculpa del botón ni resultados inventados de ejecución'
      );
    }

    // Si además no hay habilidades ni acciones ni recomendaciones, un reporte cuyo único texto es error de botón debe rechazarse (502)
    const emptyWithButtonNoteReq = {
      caseId: 'case_f2_empty_btn',
      stage: 7,
      leaderProfile: { name: 'Ana' },
      companyContext: { name: 'Logística' },
      conversationHistory: [],
      userMessage: '[Avanzando a Etapa 7]',
      sessionData: {
        id: 'case_f2_empty_btn',
        skillEntries: [],
        identifiedSkills: [],
        actionPlan: null,
        actionPlanExecutionStatus: 'not_executed',
        learnings: null,
      },
    };
    const invalidOnlyButtonFactory = () =>
      makeGeminiResponse({
        detectedStrengths: [],
        stageTwoSkills: [],
        chosenActions: [],
        stageSixLearnings: ['Me equivoqué al presionar el botón, no he ejecutado la acción aún.'],
        recommendationsForAutonomy: [],
      });

    const prodInvalid = await invokeProdStage7(emptyWithButtonNoteReq, invalidOnlyButtonFactory);
    const devInvalid = await invokeDevStage7(emptyWithButtonNoteReq, invalidOnlyButtonFactory);
    assert.equal(prodInvalid.statusCode, 502);
    assert.equal(devInvalid.statusCode, 502);
  });

  it('4. Plan reprogramado: conserva la acción y su estado pendiente', async () => {
    const sessionData = {
      id: 'case_f2_rescheduled',
      title: 'Reprogramación de retroalimentación',
      skillEntries: baseSkillEntries,
      identifiedSkills: ['Retroalimentación Constructiva y Conversaciones Difíciles'],
      actionPlan: {
        what: 'Realizar sesión de retroalimentación SBI con Carlos sobre puntualidad',
        when: 'Viernes 12:00 PM',
        withWhom: 'Carlos Vega',
        isCompleted: false,
      },
      actionPlanExecutionStatus: 'not_executed',
      learnings: {
        whatHappened: '',
        whatWorked: '',
        whatDidnt: 'Carlos estuvo incapacitado el viernes.',
        insights: 'Preparé los ejemplos concretos para no improvisar cuando retomemos.',
        futureAdjustments: 'Reprogramada para el próximo martes a las 10:00 AM.',
      },
    };

    const reqBody = {
      caseId: sessionData.id,
      stage: 7,
      leaderProfile: { name: 'Ana Torres' },
      companyContext: { name: 'Logística Norte' },
      conversationHistory: [
        { id: 'm6', caseId: sessionData.id, sender: 'leader', stage: 6, text: 'Carlos se ausentó y la reprogramamos para el martes.' },
      ],
      userMessage: '[Avanzando a Etapa 7]',
      sessionData,
    };

    const geminiFactory = () =>
      makeGeminiResponse({
        detectedStrengths: ['Continuidad en la preparación del encuentro'],
        stageTwoSkills: ['Retroalimentación Constructiva y Conversaciones Difíciles'],
        chosenActions: [
          'Sesión de retroalimentación SBI con Carlos Vega (prevista inicialmente para el viernes 12:00 PM), reprogramada para el próximo martes 10:00 AM (pendiente de ejecución).',
        ],
        stageSixLearnings: [
          'Obstáculo: incapacidad de Carlos el viernes.',
          'Preparación lograda: ejemplos concretos listos para la nueva fecha del martes.',
        ],
        recommendationsForAutonomy: ['Confirmar el martes a las 10:00 AM el espacio privado con Carlos.'],
      });

    const prodRes = await invokeProdStage7(reqBody, geminiFactory);
    const devRes = await invokeDevStage7(reqBody, geminiFactory);

    for (const r of [prodRes, devRes]) {
      assert.equal(r.statusCode, 200);
      assert.match(r.body.data.finalFeedback.chosenActions[0], /Carlos Vega/);
      assert.match(r.body.data.finalFeedback.chosenActions[0], /reprogramada.*martes|pendiente/i);
    }
  });

  it('5. Alternativa elegida en Etapa 3 distinta de la acción finalmente programada en Etapa 5: ambas se preservan sin confundirse', async () => {
    const sessionData = {
      id: 'case_f2_alt_diff',
      title: 'Separar alternativa elegida de acción programada',
      skillEntries: baseSkillEntries,
      identifiedSkills: ['Retroalimentación Constructiva y Conversaciones Difíciles'],
      chosenAlternative: 'Enviar primero un resumen escrito de expectativas por correo',
      actionPlan: {
        what: 'Sostener conversación presencial de 20 minutos para co-crear checklist de entrega',
        when: 'Lunes 09:00 AM',
        withWhom: 'Sofía Méndez',
        how: 'Revisando el flujo paso a paso en pizarra',
        isCompleted: false,
      },
      actionPlanExecutionStatus: 'not_executed',
      learnings: {
        whatHappened: '',
        whatWorked: '',
        whatDidnt: '',
        insights: 'Preferí pasar de un correo unilateral a una charla presencial para evitar malentendidos.',
        futureAdjustments: 'Sostener la reunión el lunes 09:00 AM.',
      },
    };

    const extractedActions = extractRegisteredStage5Actions(sessionData, 'not_executed');
    assert.equal(extractedActions.length, 2);
    assert.match(extractedActions[0], /conversación presencial de 20 minutos/i);
    assert.match(extractedActions[0], /pendiente de ejecución/i);
    assert.match(extractedActions[1], /Alternativa elegida en Etapa 3.*resumen escrito de expectativas por correo/i);

    const reqBody = {
      caseId: sessionData.id,
      stage: 7,
      leaderProfile: { name: 'Ana Torres' },
      companyContext: { name: 'Logística Norte' },
      conversationHistory: [],
      userMessage: '[Avanzando a Etapa 7]',
      sessionData,
    };

    let capturedPrompt = '';
    const geminiOmittedActionsFactory = (_url: string, init?: any) => {
      const parsed = JSON.parse(String(init?.body || '{}'));
      capturedPrompt = parsed?.contents?.[parsed.contents.length - 1]?.parts?.[0]?.text || '';
      return makeGeminiResponse({
        detectedStrengths: ['Criterio para ajustar el canal de comunicación hacia un diálogo más efectivo'],
        stageTwoSkills: ['Retroalimentación Constructiva y Conversaciones Difíciles'],
        chosenActions: [],
        stageSixLearnings: [],
        recommendationsForAutonomy: ['Sostener la conversación el lunes a las 09:00 AM con el checklist en mano.'],
      });
    };

    const prodRes = await invokeProdStage7(reqBody, geminiOmittedActionsFactory);
    const devRes = await invokeDevStage7(reqBody, geminiOmittedActionsFactory);

    assert.match(capturedPrompt, /Alternativa elegida en Etapa 3: Enviar primero un resumen escrito/);
    assert.match(capturedPrompt, /Acción diseñada \(Etapa 5\): Sostener conversación presencial/);

    for (const r of [prodRes, devRes]) {
      assert.equal(r.statusCode, 200);
      assert.equal(r.body.data.finalFeedback.chosenActions.length, 2);
      assert.match(r.body.data.finalFeedback.chosenActions[0], /conversación presencial.*pendiente de ejecución/i);
      assert.match(r.body.data.finalFeedback.chosenActions[1], /Etapa 3.*resumen escrito/i);
    }
  });

  it('6. Síntesis válida de Gemini sin usar las 4 palabras clave literales antiguas se preserva intacta en prod y dev', async () => {
    // Ninguna de estas frases contiene "pendiente", "no ejecutad", "por ejecutar" ni "reprogram"
    const synthesisWithoutOldKeywords =
      'Conversación 1 a 1 con Luis agendada para el martes a las 09:00 AM (aún sin concretar por cierre de turno).';
    const synthesisPaused =
      'Reunión de alineación con equipo operativo en espera hasta confirmar disponibilidad el jueves.';

    assert.equal(indicatesPendingOrUnexecutedAction(synthesisWithoutOldKeywords), true);
    assert.equal(indicatesPendingOrUnexecutedAction(synthesisPaused), true);
    assert.equal(claimsActionAlreadyExecuted(synthesisWithoutOldKeywords), false);

    // Síntesis válida sin marcador explícito tampoco debe destruirse ni sobrescribirse con el texto crudo
    const bareSynthesis = 'Alinear expectativas con Luis en charla de 15 minutos enfocada en tiempos de entrega';
    const annotated = resolveStage7ChosenActions(
      [bareSynthesis],
      ['Plan crudo — Estado: pendiente de ejecución'],
      { actionPlan: { what: 'Otro texto diferente', when: 'Martes 9:00 AM' } },
      true
    );
    assert.ok(annotated[0].startsWith(bareSynthesis), 'Debe conservar la síntesis de Gemini');
    assert.match(annotated[0], /Martes 9:00 AM/);
    assert.match(annotated[0], /Estado: pendiente de ejecución/);

    const sessionData = {
      id: 'case_f2_no_keywords',
      title: 'Alineación con Luis',
      skillEntries: baseSkillEntries,
      identifiedSkills: ['Retroalimentación Constructiva y Conversaciones Difíciles'],
      actionPlan: {
        what: 'Conversar 1 a 1 con Luis sobre entregas',
        when: 'Viernes 09:00 AM',
        withWhom: 'Luis Herrera',
        isCompleted: false,
      },
      actionPlanExecutionStatus: 'not_executed',
      learnings: {
        whatHappened: '',
        whatWorked: '',
        whatDidnt: 'Cierre de turno extendido impidió la charla del viernes.',
        insights: 'Necesito proteger 15 minutos al inicio del turno para conversaciones clave.',
        futureAdjustments: 'Mover al martes 09:00 AM.',
      },
    };

    const reqBody = {
      caseId: sessionData.id,
      stage: 7,
      leaderProfile: { name: 'Carlos' },
      companyContext: { name: 'Logística' },
      conversationHistory: [],
      userMessage: '[Avanzando a Etapa 7]',
      sessionData,
    };

    const geminiFactory = () =>
      makeGeminiResponse({
        detectedStrengths: ['Claridad al identificar la causa operativa del aplazamiento'],
        stageTwoSkills: ['Retroalimentación Constructiva y Conversaciones Difíciles'],
        chosenActions: [synthesisWithoutOldKeywords],
        stageSixLearnings: [
          'El cierre de turno del viernes impidió la conversación; conviene reservar 15 minutos al inicio del turno.',
        ],
        recommendationsForAutonomy: ['Sostener la charla el martes a primera hora sin postergarla.'],
      });

    const prodRes = await invokeProdStage7(reqBody, geminiFactory);
    const devRes = await invokeDevStage7(reqBody, geminiFactory);

    for (const r of [prodRes, devRes]) {
      assert.equal(r.statusCode, 200);
      assert.deepEqual(r.body.data.finalFeedback.chosenActions, [synthesisWithoutOldKeywords]);
    }
  });

  it('7. Paridad integral entre producción (api/mentor/respond.ts) y desarrollo (server.ts)', async () => {
    const sessionData = {
      id: 'case_f2_parity',
      title: 'Delegación operativa',
      skillEntries: baseSkillEntries,
      identifiedSkills: ['Retroalimentación Constructiva y Conversaciones Difíciles'],
      chosenAlternative: 'Matriz RACI semanal',
      actionPlan: {
        what: 'Definir reglas de escalamiento en junta breve de inicio de turno',
        when: 'Lunes 08:00 AM',
        withWhom: 'Supervisores de línea',
        how: 'Acordando tres criterios de decisión autónoma',
        isCompleted: true,
      },
      actionPlanExecutionStatus: 'executed',
      learnings: {
        whatHappened: 'Los supervisores propusieron los umbrales de paro de línea.',
        whatWorked: 'Pedirles criterios antes de imponer reglas.',
        whatDidnt: 'Quedó sin documentar el umbral para turno nocturno.',
        insights: 'Incluir al equipo en la definición acelera su autonomía.',
        futureAdjustments: 'Completar el criterio nocturno el miércoles.',
      },
    };

    const reqBody = {
      caseId: sessionData.id,
      stage: 7,
      leaderProfile: { name: 'Laura Gómez', position: 'Gerente de Planta' },
      companyContext: { name: 'Planta Centro' },
      conversationHistory: [
        { id: 'm1', caseId: sessionData.id, sender: 'leader', stage: 1, text: 'Todo me lo escalan en turno.' },
        { id: 'm6', caseId: sessionData.id, sender: 'leader', stage: 6, text: 'Sí la ejecuté el lunes.' },
      ],
      userMessage: '[Avanzando a Etapa 7]',
      sessionData,
    };

    let prodPrompt = '';
    let devPrompt = '';

    const prodRes = await invokeProdStage7(reqBody, (_url, init) => {
      const parsed = JSON.parse(String(init?.body || '{}'));
      prodPrompt = parsed?.contents?.[parsed.contents.length - 1]?.parts?.[0]?.text || '';
      return makeGeminiResponse({
        detectedStrengths: ['Apertura para co-crear criterios con los supervisores'],
        stageTwoSkills: ['Retroalimentación Constructiva y Conversaciones Difíciles'],
        chosenActions: [],
        stageSixLearnings: [],
        recommendationsForAutonomy: ['Cerrar el criterio de turno nocturno este miércoles.'],
      });
    });

    const devRes = await invokeDevStage7(reqBody, (_url, init) => {
      const parsed = JSON.parse(String(init?.body || '{}'));
      devPrompt = parsed?.contents?.[parsed.contents.length - 1]?.parts?.[0]?.text || '';
      return makeGeminiResponse({
        detectedStrengths: ['Apertura para co-crear criterios con los supervisores'],
        stageTwoSkills: ['Retroalimentación Constructiva y Conversaciones Difíciles'],
        chosenActions: [],
        stageSixLearnings: [],
        recommendationsForAutonomy: ['Cerrar el criterio de turno nocturno este miércoles.'],
      });
    });

    assert.equal(prodRes.statusCode, 200);
    assert.equal(devRes.statusCode, 200);
    assert.deepEqual(prodRes.body.data.finalFeedback, devRes.body.data.finalFeedback);

    // Ambos prompts reciben safeSessionContext con learnings estructurado y stage7LocalRule completo
    for (const prompt of [prodPrompt, devPrompt]) {
      assert.match(prompt, /"obstacles":\["Quedó sin documentar el umbral para turno nocturno\."\]/);
      assert.match(prompt, /Alternativa elegida en Etapa 3: Matriz RACI semanal/);
      assert.match(prompt, /Obstáculos o qué no funcionó \(Etapa 6\): Quedó sin documentar/);
    }
  });
});

describe('Frente 2 (Cliente) — Armonización de buildStage7FinalFeedbackReport en LidactaContext.tsx', () => {
  const clientLeader: UserProfile = {
    id: 'leader_f2_cli',
    name: 'Carlos Mendoza',
    email: 'carlos.mendoza@logistica-norte.com',
    role: 'leader',
    companyId: 'comp_f2',
    companyName: 'Logística Norte',
    area: 'Operaciones',
    position: 'Jefe de Turno',
    createdAt: '2026-01-01T10:00:00.000Z',
  };

  const clientCompanies: CompanyContext[] = [
    {
      id: 'comp_f2',
      name: 'Logística Norte',
      industry: 'Logística',
      values: 'Claridad y respeto',
      philosophy: 'Liderazgo en acción',
      expectedCompetencies: ['Retroalimentación Constructiva y Conversaciones Difíciles'],
      culture: 'Directa',
      workRhythm: 'Operativo',
      webLinks: [],
      attachments: [],
      updatedAt: '2026-01-01',
    },
  ];

  const baseStage5ActionPlan = {
    what: 'Conversar 1 a 1 con Luis sobre entregas del turno matutino',
    when: 'Viernes 09:00 AM',
    withWhom: 'Luis Herrera',
    how: 'Presentando hechos observables y pidiendo su perspectiva',
    careReminders: 'Escuchar sin interrumpir',
    isCommitmentConfirmed: true,
    isCompleted: false,
  };

  it('8. Cliente: acción pendiente con síntesis válida sin palabras clave literales se conserva íntegra (directo y en cierre transaccional)', async () => {
    const synthesisWithoutKeywords =
      'Conversación 1 a 1 con Luis agendada para el martes a las 09:00 AM (aún sin concretar por cierre operativo).';

    const directBuilt = buildStage7FinalFeedbackReport(
      {
        detectedStrengths: ['Claridad para reconocer el obstáculo operativo'],
        stageTwoSkills: ['Retroalimentación Constructiva y Conversaciones Difíciles'],
        chosenActions: [synthesisWithoutKeywords],
        stageSixLearnings: [
          'El cierre operativo desplazó la charla; conviene reservar 15 minutos al inicio del turno.',
        ],
        recommendationsForAutonomy: ['Confirmar el espacio del martes a las 09:00 AM con Luis.'],
        deliveredAt: '2026-02-02T10:00:00.000Z',
      },
      baseSkillEntries as any,
      ['Retroalimentación Constructiva y Conversaciones Difíciles'],
      '2026-02-02T10:00:00.000Z',
      {
        actionPlan: baseStage5ActionPlan,
        actionPlanExecutionStatus: 'not_executed',
      }
    );

    assert.ok(directBuilt);
    assert.deepEqual(directBuilt.chosenActions, [synthesisWithoutKeywords]);

    // También en flujo completo executeTransactionalStageTransition (cierre real)
    const sessionPending: MentorshipSession = {
      id: 'case_f2_cli_pending',
      leaderId: clientLeader.id,
      leaderName: clientLeader.name,
      companyId: 'comp_f2',
      companyName: 'Logística Norte',
      leaderArea: 'Operaciones',
      title: 'Alineación con Luis',
      initialChallenge: 'Luis acumula retrasos en turno matutino.',
      currentStage: 6,
      stageHistory: [
        { stage: 5, stageName: 'Actuar', enteredAt: '2026-01-25T10:00:00Z', completedAt: '2026-01-25T10:30:00Z' },
        { stage: 6, stageName: 'Aprender y reflexionar', enteredAt: '2026-02-01T10:00:00Z' },
      ],
      messages: [
        { id: 'm6', caseId: 'case_f2_cli_pending', sender: 'leader', text: 'Aún no he sostenido la reunión.', timestamp: '2026-02-01T10:05:00Z', stage: 6 },
      ],
      theme: 'Comunicación',
      status: 'active',
      startedAt: '2026-01-25T10:00:00Z',
      lastActiveAt: '2026-02-01T10:05:00Z',
      identifiedSkills: ['Retroalimentación Constructiva y Conversaciones Difíciles'],
      skillEntries: baseSkillEntries as any,
      actionPlan: baseStage5ActionPlan,
      actionPlanExecutionStatus: 'not_executed',
      stage6ExecutionVerified: true,
    };

    let sessions = [sessionPending];
    const notifications: NotificationItem[] = [];
    const emailedReports: FinalFeedbackReport[] = [];
    const opsMap = new Map<string, CaseOperationKind>();

    const ok = await executeTransactionalStageTransition({
      activeCaseId: sessionPending.id,
      targetStage: 7,
      getSessionById: (id) => sessions.find((s) => s.id === id),
      commitMentorships: (updater) => {
        sessions = updater(sessions);
        return sessions;
      },
      activeCaseOperationsRef: { current: opsMap },
      setCaseAdvancing: () => {},
      companies: clientCompanies,
      currentUser: clientLeader,
      setNotifications: (updater) => {
        const next = updater(notifications);
        notifications.splice(0, notifications.length, ...next);
      },
      dispatchFinalFeedbackReportEmail: async (_s, r) => {
        emailedReports.push(r);
        return { success: true };
      },
      recordResourceRecommendation: () => {},
      autoDetectAndLogResources: () => {},
      showToast: () => {},
      fetchImpl: async () =>
        new Response(
          JSON.stringify({
            success: true,
            responseSource: 'gemini',
            isFallback: false,
            isGeminiVerified: true,
            reply: 'Cierre completado respetando que la reunión quedó agendada para el martes.',
            data: {
              reply: 'Cierre completado respetando que la reunión quedó agendada para el martes.',
              responseSource: 'gemini',
              isFallback: false,
              isGeminiVerified: true,
              finalFeedback: {
                detectedStrengths: ['Claridad para reconocer el obstáculo operativo'],
                stageTwoSkills: ['Retroalimentación Constructiva y Conversaciones Difíciles'],
                chosenActions: [synthesisWithoutKeywords],
                stageSixLearnings: [
                  'El cierre operativo desplazó la charla; conviene reservar 15 minutos al inicio del turno.',
                ],
                recommendationsForAutonomy: ['Confirmar el espacio del martes a las 09:00 AM con Luis.'],
              },
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        ),
    });

    assert.equal(ok, true);
    assert.deepEqual(sessions[0].finalFeedbackReport?.chosenActions, [synthesisWithoutKeywords]);
    assert.deepEqual(emailedReports[0]?.chosenActions, [synthesisWithoutKeywords]);
  });

  it('9. Cliente: acción pendiente con afirmación falsa de ejecución rechaza la afirmación falsa y respalda con estado pendiente real', () => {
    const built = buildStage7FinalFeedbackReport(
      {
        detectedStrengths: ['Honestidad para aclarar que aún no ejecuta el plan'],
        stageTwoSkills: ['Retroalimentación Constructiva y Conversaciones Difíciles'],
        chosenActions: ['La reunión con Luis ya se ejecutó con éxito el viernes.'],
        stageSixLearnings: [
          'La conversación ya se realizó y Luis reaccionó muy bien.',
          'Me equivoqué al presionar el botón, no he ejecutado la acción aún.',
        ],
        recommendationsForAutonomy: ['Reagendar la conversación para el martes a primera hora.'],
        deliveredAt: '2026-02-02T10:00:00.000Z',
      },
      baseSkillEntries as any,
      ['Retroalimentación Constructiva y Conversaciones Difíciles'],
      '2026-02-02T10:00:00.000Z',
      {
        actionPlan: baseStage5ActionPlan,
        actionPlanExecutionStatus: 'not_executed',
        learnings: {
          whatHappened: 'Reaccionó muy bien.',
          whatWorked: 'Todo excelente.',
          whatDidnt: 'Se cruzó una auditoría de embarques.',
          insights: 'Debo apartar los 15 minutos antes de iniciar turno.',
          futureAdjustments: 'Mover al martes 09:00 AM.',
        },
      }
    );

    assert.ok(built);
    assert.match(built.chosenActions[0], /Viernes 09:00 AM/);
    assert.match(built.chosenActions[0], /Estado: pendiente de ejecución/i);
    assert.ok(!built.chosenActions[0].includes('ya se ejecutó con éxito'));
    assert.ok(!built.stageSixLearnings.some((l) => l.includes('ya se realizó')));
    assert.ok(!built.stageSixLearnings.some((l) => l.includes('Me equivoqué al presionar')));
    assert.ok(
      built.stageSixLearnings.includes('Debo apartar los 15 minutos antes de iniciar turno.')
    );
    assert.ok(
      built.stageSixLearnings.includes(
        'Obstáculo identificado: Se cruzó una auditoría de embarques.'
      )
    );
  });

  it('10. Cliente: acción ejecutada conserva la síntesis y recupera resultados/obstáculos/aprendizajes sin marcarla pendiente', () => {
    const executedPlan = { ...baseStage5ActionPlan, isCompleted: true };
    const synthesizedExecutedAction =
      'Conversación 1 a 1 sostenida con Luis el viernes a las 09:00 AM acordando checklist diario.';

    const builtWithSynthesis = buildStage7FinalFeedbackReport(
      {
        detectedStrengths: ['Firmeza empática durante la conversación'],
        stageTwoSkills: ['Retroalimentación Constructiva y Conversaciones Difíciles'],
        chosenActions: [synthesizedExecutedAction],
        stageSixLearnings: [
          'Luis asumió el seguimiento diario de entregas y acordamos revisión semanal.',
        ],
        recommendationsForAutonomy: ['Mantener chequeo breve de 10 minutos cada lunes.'],
        deliveredAt: '2026-02-02T10:00:00.000Z',
      },
      baseSkillEntries as any,
      ['Retroalimentación Constructiva y Conversaciones Difíciles'],
      '2026-02-02T10:00:00.000Z',
      {
        actionPlan: executedPlan,
        actionPlanExecutionStatus: 'executed',
      }
    );

    assert.ok(builtWithSynthesis);
    assert.deepEqual(builtWithSynthesis.chosenActions, [synthesizedExecutedAction]);
    assert.ok(!/pendiente de ejecución/i.test(builtWithSynthesis.chosenActions[0]));
  });

  it('11. Cliente: conserva íntegramente la información registrada en Etapa 5 (what, when, withWhom) y distingue chosenAlternative cuando difiere', () => {
    const builtFromEmptyGemini = buildStage7FinalFeedbackReport(
      {
        detectedStrengths: ['Claridad en los acuerdos definidos'],
        stageTwoSkills: ['Retroalimentación Constructiva y Conversaciones Difíciles'],
        chosenActions: [],
        stageSixLearnings: [],
        recommendationsForAutonomy: ['Confirmar el espacio de reunión en calendario.'],
        deliveredAt: '2026-02-02T10:00:00.000Z',
      },
      baseSkillEntries as any,
      ['Retroalimentación Constructiva y Conversaciones Difíciles'],
      '2026-02-02T10:00:00.000Z',
      {
        actionPlan: baseStage5ActionPlan,
        actionPlanExecutionStatus: 'not_executed',
        chosenAlternative: 'Enviar primero un correo formal con métricas',
      }
    );

    assert.ok(builtFromEmptyGemini);
    assert.equal(builtFromEmptyGemini.chosenActions.length, 2);
    assert.ok(builtFromEmptyGemini.chosenActions[0].includes(baseStage5ActionPlan.what));
    assert.ok(builtFromEmptyGemini.chosenActions[0].includes(baseStage5ActionPlan.when));
    assert.ok(builtFromEmptyGemini.chosenActions[0].includes(baseStage5ActionPlan.withWhom));
    assert.match(builtFromEmptyGemini.chosenActions[0], /Estado: pendiente de ejecución/i);
    assert.match(
      builtFromEmptyGemini.chosenActions[1],
      /Alternativa elegida en Etapa 3.*correo formal con métricas/i
    );
  });
});
