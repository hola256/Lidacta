import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import respondHandler, {
  detectStage6ExecutionCorrection as detectCorrectionApi,
  generateContextualCoachReply,
} from '../api/mentor/respond';
import {
  buildStage7FinalFeedbackReport,
  detectStage6ExecutionCorrection as detectCorrectionClient,
  executeTransactionalStageTransition,
  isNonSubstantiveNonExecutionNote,
  reconcileStage6ExecutionState,
  resolveStage6ExecutionStatus,
  CaseOperationKind,
} from '../src/context/LidactaContext';
import {
  CompanyContext,
  MentorshipActionPlan,
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

const mockLeader: UserProfile = {
  id: 'leader_f1_1',
  name: 'Carlos Mendoza',
  email: 'carlos.mendoza@empresa-demo.com',
  role: 'leader',
  companyId: 'comp_f1',
  companyName: 'Empresa Demo S.A.',
  area: 'Logística',
  position: 'Jefe de Turno',
  createdAt: '2026-01-01T10:00:00.000Z',
};

const mockCompanies: CompanyContext[] = [
  {
    id: 'comp_f1',
    name: 'Empresa Demo S.A.',
    industry: 'Distribución',
    values: 'Claridad y respeto',
    philosophy: 'Liderazgo en acción',
    expectedCompetencies: ['Comunicación Asertiva y Firmeza Empática'],
    culture: 'Directa',
    workRhythm: 'Operativo',
    webLinks: [],
    attachments: [],
    updatedAt: '2026-01-01',
  },
];

const stage5PlanFixture: MentorshipActionPlan = {
  what: 'Conversar 1 a 1 con Luis sobre los tiempos de entrega del turno matutino',
  when: 'Viernes a las 09:00 AM',
  withWhom: 'Luis Herrera (Coordinador de Embarques)',
  how: 'Presentando hechos observables de esta semana y pidiendo su perspectiva antes de acordar ajustes',
  careReminders: 'Mantener tono sereno, escuchar sin interrumpir y validar el acuerdo por escrito',
  isCommitmentConfirmed: true,
  isCompleted: true,
  completedAt: '2026-02-01T10:00:00.000Z',
};

function createStage6Session(overrides: Partial<MentorshipSession> = {}): MentorshipSession {
  return {
    id: 'case_f1_stage6',
    leaderId: mockLeader.id,
    leaderName: mockLeader.name,
    companyId: 'comp_f1',
    companyName: 'Empresa Demo S.A.',
    leaderArea: 'Logística',
    title: 'Alineación de entregas con Luis',
    initialChallenge: 'Luis acumula retrasos en los despachos matutinos y evita reportarlos a tiempo.',
    currentStage: 6,
    theme: 'Comunicación Asertiva y Acuerdos',
    status: 'active',
    priority: 'alta',
    startedAt: '2026-01-25T10:00:00.000Z',
    lastActiveAt: '2026-02-01T10:05:00.000Z',
    actionPlanExecutionStatus: 'executed',
    stage6ExecutionVerified: true,
    stageHistory: [
      { stage: 1, stageName: 'Detectar qué sucede', enteredAt: '2026-01-25T10:00:00Z', completedAt: '2026-01-25T10:15:00Z' },
      { stage: 2, stageName: 'Analizar perspectivas y habilidades', enteredAt: '2026-01-25T10:15:00Z', completedAt: '2026-01-25T10:30:00Z' },
      { stage: 3, stageName: 'Diseñar alternativas', enteredAt: '2026-01-25T10:30:00Z', completedAt: '2026-01-25T10:45:00Z' },
      { stage: 4, stageName: 'Practicar antes de actuar', enteredAt: '2026-01-25T10:45:00Z', completedAt: '2026-01-25T11:00:00Z' },
      { stage: 5, stageName: 'Actuar (Plan de Acción)', enteredAt: '2026-01-25T11:00:00Z', completedAt: '2026-01-25T11:15:00Z' },
      { stage: 6, stageName: 'Aprender y reflexionar', enteredAt: '2026-02-01T10:00:00Z' },
    ],
    messages: [
      {
        id: 'm1',
        caseId: 'case_f1_stage6',
        mentorshipId: 'case_f1_stage6',
        sender: 'leader',
        text: 'Luis acumula retrasos en los despachos matutinos y evita reportarlos a tiempo.',
        timestamp: '2026-01-25T10:00:00Z',
        stage: 1,
      },
      {
        id: 'm6_yes',
        caseId: 'case_f1_stage6',
        mentorshipId: 'case_f1_stage6',
        sender: 'leader',
        text: 'Sí, ya ejecuté mi Plan de Acción.',
        timestamp: '2026-02-01T10:00:00Z',
        stage: 6,
      },
    ],
    identifiedSkills: ['Comunicación Asertiva y Firmeza Empática'],
    skillEntries: [
      {
        skill: 'Comunicación Asertiva y Firmeza Empática',
        cluster: 'comunicacion',
        status: 'vigente',
        initialStage: 2,
        lastUpdatedStage: 2,
        createdAt: '2026-01-25T10:20:00Z',
        updatedAt: '2026-01-25T10:20:00Z',
        evidenceHistory: [
          {
            id: 'ev_1',
            stage: 2,
            sourceType: 'experiencia_relatada',
            evidenceText: 'Evita confrontar el retraso matutino de Luis por temor a desgastar la relación.',
            timestamp: '2026-01-25T10:20:00Z',
          },
        ],
      },
    ],
    actionPlan: { ...stage5PlanFixture },
    ...overrides,
  };
}

async function invokeProdRespond(
  reqBody: any,
  geminiResponseFactory?: (url: string, init?: any) => Response | Promise<Response>,
  apiKey: string | null = 'dummy-f1-key'
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

  if (geminiResponseFactory) {
    globalThis.fetch = (async (input: any, init?: any) =>
      geminiResponseFactory(typeof input === 'string' ? input : input?.url || '', init)) as any;
  }

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

async function invokeDevServerRespond(
  reqBody: any,
  geminiResponseFactory?: (url: string, init?: any) => Response | Promise<Response>,
  apiKey: string | null = 'dummy-f1-dev-key'
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

  const modUrl = new URL(`../server.ts?f1=${Date.now()}-${Math.random()}`, import.meta.url).href;
  const { app } = await import(modUrl);

  if (geminiResponseFactory) {
    globalThis.fetch = (async (input: any, init?: any) => {
      const url = typeof input === 'string' ? input : input?.url || '';
      if (url.startsWith('http://127.0.0.1:')) return originalFetch(input, init);
      return geminiResponseFactory(url, init);
    }) as any;
  }

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

describe('Frente 1 — Etapa 6: Reconocimiento del estado real del compromiso del líder', () => {
  it('1. Si el líder eligió Sí por error y luego aclara en chat que no ejecutó, corrige el estado real a not_executed y responde sin pedir resultados post-ejecución', async () => {
    const clarificationMsg =
      'La verdad me equivoqué al presionar el botón, no he ejecutado la acción aún.';
    const sessionBefore = createStage6Session({
      actionPlanExecutionStatus: 'executed',
      actionPlan: { ...stage5PlanFixture, isCompleted: true },
    });

    // Detector puro alineado en cliente y backend
    assert.equal(detectCorrectionClient(clarificationMsg, 'executed'), 'not_executed');
    assert.equal(detectCorrectionApi(clarificationMsg, 'executed'), 'not_executed');

    // Contextual coach reply (fallback determinístico) también corrige sin juzgar
    const coachFallback = generateContextualCoachReply(
      6,
      'Carlos',
      clarificationMsg,
      sessionBefore.messages,
      {
        actionPlan: sessionBefore.actionPlan,
        actionPlanExecutionStatus: 'executed',
      }
    );
    assert.equal((coachFallback as any).correctedExecutionStatus, 'not_executed');
    assert.match(coachFallback.replyText, /no pasa nada|pendiente|obstáculos|siguiente paso/i);
    assert.ok(!coachFallback.replyText.toLowerCase().includes('¿qué ocurrió después de tu acción?'));

    // Paridad HTTP en api/mentor/respond.ts y server.ts con Gemini devolviendo respuesta pendiente
    let capturedGeminiPrompt = '';
    const geminiPendingFactory = (_url: string, init?: any) => {
      const parsedBody = JSON.parse(String(init?.body || '{}'));
      capturedGeminiPrompt = parsedBody?.contents?.[0]?.parts?.[0]?.text || '';
      return new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      replyText:
                        'Gracias por aclararlo, Carlos; no pasa nada. Dejamos tu plan de conversar 1 a 1 con Luis como pendiente de ejecución. ¿Qué te ha impedido sostener esa conversación y cuál sería tu siguiente paso realista?',
                      readyToAdvance: false,
                      advancePrompt: null,
                      identifiedSkills: [],
                      detectedTheme: 'Comunicación Asertiva y Acuerdos',
                      isTherapeuticCase: false,
                      correctedExecutionStatus: 'not_executed',
                    }),
                  },
                ],
              },
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    };

    const reqBody = {
      caseId: sessionBefore.id,
      mentorshipId: sessionBefore.id,
      stage: 6,
      activeStage: 6,
      leaderProfile: mockLeader,
      companyContext: mockCompanies[0],
      conversationHistory: sessionBefore.messages,
      history: sessionBefore.messages,
      userMessage: clarificationMsg,
      currentMessage: clarificationMsg,
      message: clarificationMsg,
      sessionData: {
        id: sessionBefore.id,
        actionPlan: sessionBefore.actionPlan,
        actionPlanExecutionStatus: 'executed',
        stage6ExecutionVerified: true,
      },
    };

    const prodRes = await invokeProdRespond(reqBody, geminiPendingFactory);
    assert.equal(prodRes.statusCode, 200);
    assert.equal(prodRes.body.correctedExecutionStatus, 'not_executed');
    assert.equal(prodRes.body.data.correctedExecutionStatus, 'not_executed');
    assert.match(
      capturedGeminiPrompt,
      /ACLARACIÓN DE NO EJECUCIÓN DETECTADA|correctedExecutionStatus/i,
      'El turno local debe instruir a Gemini a reconocer la aclaración sin modificar el systemPrompt global'
    );

    const devRes = await invokeDevServerRespond(reqBody, geminiPendingFactory);
    assert.equal(devRes.statusCode, 200);
    assert.equal(devRes.body.correctedExecutionStatus, 'not_executed');
    assert.equal(devRes.body.data.correctedExecutionStatus, 'not_executed');

    // Reconciliación del estado de sesión en LidactaContext
    const reconciled = reconcileStage6ExecutionState(sessionBefore, 'not_executed');
    assert.equal(resolveStage6ExecutionStatus(reconciled), 'not_executed');
    assert.equal(reconciled.actionPlanExecutionStatus, 'not_executed');
    assert.equal(reconciled.stage6ExecutionVerified, true);
    assert.equal(reconciled.actionPlan?.isCompleted, false);
    assert.equal(reconciled.actionPlan?.completedAt, undefined);

    // Verificar que sendMessageInActiveSession valida y aplica correctedExecutionStatus === 'not_executed'
    const contextSrc = fs.readFileSync(
      path.resolve(process.cwd(), 'src/context/LidactaContext.tsx'),
      'utf8'
    );
    assert.match(
      contextSrc,
      /rawStructuredCorrection === 'not_executed'/,
      'LidactaContext debe validar explícitamente correctedExecutionStatus === "not_executed"'
    );
    assert.match(
      contextSrc,
      /reconcileStage6ExecutionState\(m,\s*'not_executed'\)/,
      'LidactaContext debe reconciliar el estado vivo de la sesión al recibir la corrección'
    );

    // Verificar que LeaderView solo muestra el formulario post-ejecución en Estado B (executed) y muestra acompañamiento pendiente en Estado C (not_executed)
    const leaderViewSrc = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/LeaderView.tsx'),
      'utf8'
    );
    assert.ok(leaderViewSrc.includes("{stage6ExecutionStatus === 'executed' && ("));
    assert.ok(leaderViewSrc.includes("{stage6ExecutionStatus === 'not_executed' && ("));
  });

  it('2. Al cambiar manualmente de Sí a No, conserva íntegro el Plan de Acción de Etapa 5 y marca isCompleted = false', () => {
    const executedSession = createStage6Session({
      actionPlanExecutionStatus: 'executed',
      actionPlan: { ...stage5PlanFixture, isCompleted: true },
    });

    const corrected = reconcileStage6ExecutionState(executedSession, 'not_executed');

    assert.equal(corrected.actionPlanExecutionStatus, 'not_executed');
    assert.equal(corrected.stage6ExecutionVerified, true);
    assert.equal(corrected.actionPlan?.isCompleted, false);
    assert.equal(corrected.actionPlan?.completedAt, undefined);
    // Todos los campos del Plan de Acción de Etapa 5 permanecen intactos
    assert.equal(corrected.actionPlan?.what, stage5PlanFixture.what);
    assert.equal(corrected.actionPlan?.when, stage5PlanFixture.when);
    assert.equal(corrected.actionPlan?.withWhom, stage5PlanFixture.withWhom);
    assert.equal(corrected.actionPlan?.how, stage5PlanFixture.how);
    assert.equal(corrected.actionPlan?.careReminders, stage5PlanFixture.careReminders);
    assert.equal(corrected.actionPlan?.isCommitmentConfirmed, true);

    // Verificar que LeaderView tiene el botón simétrico en Estado B para corregir a No y en Estado C para cambiar a Sí
    const leaderViewSrc = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/LeaderView.tsx'),
      'utf8'
    );
    assert.ok(
      leaderViewSrc.includes('onClick={() => respondStage6ExecutionCheck(false)}') &&
        leaderViewSrc.includes('Aún no he ejecutado mi Plan de Acción (cambiar a No)'),
      'LeaderView debe exponer el botón visible para cambiar de Sí a No en Estado B'
    );
    assert.ok(
      leaderViewSrc.includes('onClick={() => respondStage6ExecutionCheck(true)}') &&
        leaderViewSrc.includes('Ya ejecuté mi Plan de Acción (cambiar a Sí)'),
      'LeaderView debe mantener el botón visible para cambiar de No a Sí en Estado C'
    );
  });

  it('3. Excluye frases de relleno o error de botón de stageSixLearnings cuando no ejecutó, sin aplicar filtros ciegos a reflexiones válidas ni al flujo ejecutado', () => {
    assert.equal(isNonSubstantiveNonExecutionNote('Aún no lo sé'), true);
    assert.equal(
      isNonSubstantiveNonExecutionNote(
        'La verdad me equivoqué al presionar el botón, no he ejecutado la acción aún.'
      ),
      true
    );
    // Una reflexión sustantiva sobre obstáculos o siguiente paso cuando NO ejecutó SÍ debe conservarse
    assert.equal(
      isNonSubstantiveNonExecutionNote(
        'No pude sostener la conversación por una urgencia operativa, pero decidí reprogramarla para el martes y preparar mis puntos clave.'
      ),
      false
    );

    const validReflectionWhenNotExecuted =
      'Reconozco que postergué la conversación por evitar incomodidad; decidí agendarla como prioridad el martes a primera hora.';
    const sessionNotExecuted = createStage6Session({
      actionPlanExecutionStatus: 'not_executed',
      actionPlan: { ...stage5PlanFixture, isCompleted: false, completedAt: undefined },
      learnings: {
        whatHappened: 'Aún no lo sé',
        whatWorked: 'No aplica',
        whatDidnt: '',
        insights: 'La verdad me equivoqué al presionar el botón, no he ejecutado la acción aún.',
        futureAdjustments: validReflectionWhenNotExecuted,
      },
    });

    const reportNotExecuted = buildStage7FinalFeedbackReport(
      {
        detectedStrengths: ['Honestidad para reconocer el estado real de su compromiso'],
        stageTwoSkills: ['Comunicación Asertiva y Firmeza Empática'],
        chosenActions: [],
        stageSixLearnings: [
          'Aún no lo sé',
          'La verdad me equivoqué al presionar el botón, no he ejecutado la acción aún.',
          validReflectionWhenNotExecuted,
        ],
        recommendationsForAutonomy: ['Confirmar el espacio de 15 minutos con Luis el martes'],
      },
      sessionNotExecuted.skillEntries,
      sessionNotExecuted.identifiedSkills,
      '2026-02-02T10:00:00.000Z',
      {
        actionPlan: sessionNotExecuted.actionPlan,
        learnings: sessionNotExecuted.learnings,
        actionPlanExecutionStatus: 'not_executed',
      }
    );

    assert.ok(reportNotExecuted);
    assert.deepEqual(reportNotExecuted.stageSixLearnings, [validReflectionWhenNotExecuted]);

    // Cuando SÍ fue ejecutada la acción, frases que mencionen "me equivoqué" o "no sé" dentro de un aprendizaje real NO deben ser bloqueadas por un filtro ciego
    const executedReflectionWithPhrase =
      'Al inicio no sabía cómo reaccionaría Luis y me equivoqué al apurar el cierre, pero aprendí a escucharlo primero antes de acordar fechas.';
    const reportExecuted = buildStage7FinalFeedbackReport(
      {
        detectedStrengths: ['Capacidad de autocrítica en la conversación'],
        stageTwoSkills: ['Comunicación Asertiva y Firmeza Empática'],
        chosenActions: [stage5PlanFixture.what],
        stageSixLearnings: [executedReflectionWithPhrase],
        recommendationsForAutonomy: ['Dar seguimiento en la junta semanal'],
      },
      sessionNotExecuted.skillEntries,
      sessionNotExecuted.identifiedSkills,
      '2026-02-02T10:00:00.000Z',
      {
        actionPlan: { ...stage5PlanFixture, isCompleted: true },
        learnings: {
          whatHappened: 'Luis escuchó los hechos y reconoció los retrasos',
          whatWorked: 'Abrir con hechos sin juzgar',
          whatDidnt: '',
          insights: executedReflectionWithPhrase,
          futureAdjustments: '',
        },
        actionPlanExecutionStatus: 'executed',
      }
    );

    assert.ok(reportExecuted);
    assert.deepEqual(reportExecuted.stageSixLearnings, [executedReflectionWithPhrase]);
  });

  it('4. En Etapa 7 cuando la acción quedó not_executed, distingue acción diseñada, programación, estado pendiente y siguiente paso', async () => {
    const sessionNotExecuted = createStage6Session({
      actionPlanExecutionStatus: 'not_executed',
      stage6ExecutionVerified: true,
      actionPlan: { ...stage5PlanFixture, isCompleted: false, completedAt: undefined },
      messages: [
        ...createStage6Session().messages,
        {
          id: 'm6_clarify',
          caseId: 'case_f1_stage6',
          mentorshipId: 'case_f1_stage6',
          sender: 'leader',
          text: 'Me equivoqué al presionar el botón, no he ejecutado la acción aún. La reprogramaré para el martes.',
          timestamp: '2026-02-01T10:02:00Z',
          stage: 6,
        },
      ],
      learnings: {
        whatHappened: '',
        whatWorked: '',
        whatDidnt: '',
        insights: 'Decidí preparar mis tres hechos clave antes de reunirme el martes con Luis.',
        futureAdjustments: 'Siguiente paso: agendar la reunión 1 a 1 de 15 minutos para el martes 9:00 AM.',
      },
    });

    let capturedStage7Prompt = '';
    const geminiStage7PendingFactory = (_url: string, init?: any) => {
      const parsedBody = JSON.parse(String(init?.body || '{}'));
      capturedStage7Prompt = parsedBody?.contents?.[0]?.parts?.[0]?.text || '';
      return new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      replyText:
                        'Cerramos esta mentoría reconociendo con honestidad tu punto actual: diseñaste conversar 1 a 1 con Luis (programada para el viernes a las 09:00 AM), la cual permanece pendiente de ejecución. Te llevas claro tu siguiente paso para concretarla el martes.',
                      readyToAdvance: false,
                      advancePrompt: null,
                      identifiedSkills: [],
                      detectedTheme: 'Comunicación Asertiva y Acuerdos',
                      isTherapeuticCase: false,
                      finalFeedback: {
                        detectedStrengths: [
                          'Claridad y honestidad para identificar el estado real de tu compromiso sin evadir el siguiente paso',
                        ],
                        stageTwoSkills: ['Comunicación Asertiva y Firmeza Empática'],
                        // Incluso si el modelo omite indicar "pendiente de ejecución", el ensamblador debe preservar acción + programación + estado pendiente
                        chosenActions: [stage5PlanFixture.what],
                        stageSixLearnings: [
                          'Aún no lo sé',
                          'Decidí preparar mis tres hechos clave antes de reunirme el martes con Luis.',
                        ],
                        recommendationsForAutonomy: [
                          'Siguiente paso pendiente: confirmar hoy la cita del martes 9:00 AM con Luis.',
                        ],
                      },
                    }),
                  },
                ],
              },
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    };

    const reqBody = {
      caseId: sessionNotExecuted.id,
      mentorshipId: sessionNotExecuted.id,
      stage: 7,
      activeStage: 7,
      leaderProfile: mockLeader,
      companyContext: mockCompanies[0],
      conversationHistory: sessionNotExecuted.messages,
      history: sessionNotExecuted.messages,
      userMessage: '[Avanzando a Etapa 7]',
      sessionData: {
        id: sessionNotExecuted.id,
        skillEntries: sessionNotExecuted.skillEntries,
        identifiedSkills: sessionNotExecuted.identifiedSkills,
        actionPlan: sessionNotExecuted.actionPlan,
        actionPlanExecutionStatus: 'not_executed',
        learnings: sessionNotExecuted.learnings,
      },
    };

    const prodRes = await invokeProdRespond(reqBody, geminiStage7PendingFactory);
    assert.equal(prodRes.statusCode, 200);
    assert.match(capturedStage7Prompt, /pendiente de ejecución|no ejecutó/i);
    assert.match(prodRes.body.data.finalFeedback.chosenActions[0], /Viernes a las 09:00 AM/);
    assert.match(prodRes.body.data.finalFeedback.chosenActions[0], /pendiente de ejecución/i);
    assert.deepEqual(prodRes.body.data.finalFeedback.stageSixLearnings, [
      'Decidí preparar mis tres hechos clave antes de reunirme el martes con Luis.',
    ]);
    assert.match(
      prodRes.body.data.finalFeedback.recommendationsForAutonomy[0],
      /siguiente paso/i
    );

    const devRes = await invokeDevServerRespond(reqBody, geminiStage7PendingFactory);
    assert.equal(devRes.statusCode, 200);
    assert.match(devRes.body.data.finalFeedback.chosenActions[0], /pendiente de ejecución/i);

    // Transición completa en frontend con executeTransactionalStageTransition
    let sessions: MentorshipSession[] = [sessionNotExecuted];
    const notifications: NotificationItem[] = [];
    const opsMap = new Map<string, CaseOperationKind>();

    const ok = await executeTransactionalStageTransition({
      activeCaseId: sessionNotExecuted.id,
      targetStage: 7,
      getSessionById: (id) => sessions.find((s) => s.id === id),
      commitMentorships: (updater) => {
        sessions = updater(sessions);
        return sessions;
      },
      activeCaseOperationsRef: { current: opsMap },
      setCaseAdvancing: () => {},
      companies: mockCompanies,
      currentUser: mockLeader,
      setNotifications: (updater) => {
        const next = updater(notifications);
        notifications.splice(0, notifications.length, ...next);
      },
      dispatchFinalFeedbackReportEmail: async () => ({ success: true }),
      recordResourceRecommendation: () => {},
      autoDetectAndLogResources: () => {},
      showToast: () => {},
      fetchImpl: async () =>
        new Response(JSON.stringify(prodRes.body), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
    });

    assert.equal(ok, true);
    assert.equal(sessions[0].currentStage, 7);
    assert.equal(sessions[0].status, 'completed');
    assert.equal(sessions[0].actionPlan?.isCompleted, false);
    assert.match(
      sessions[0].finalFeedbackReport?.chosenActions[0] || '',
      /pendiente de ejecución/i
    );
  });

  it('5. Conserva intacto el flujo normal cuando la acción SÍ fue ejecutada', async () => {
    const sessionExecuted = createStage6Session({
      actionPlanExecutionStatus: 'executed',
      stage6ExecutionVerified: true,
      actionPlan: { ...stage5PlanFixture, isCompleted: true },
      learnings: {
        whatHappened: 'Luis presentó el estatus real de embarques y acordamos alertas tempranas.',
        whatWorked: 'Abrir la conversación con datos concretos sin reproches.',
        whatDidnt: '',
        insights: 'Pedir su perspectiva primero redujo su postura defensiva.',
        futureAdjustments: 'Revisar indicadores cada lunes 10 minutos.',
      },
    });

    const geminiStage7ExecutedFactory = () =>
      new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      replyText:
                        '¡Excelente cierre, Carlos! Llevaste a la práctica tu conversación 1 a 1 con Luis y consolidaste acuerdos medibles.',
                      readyToAdvance: false,
                      advancePrompt: null,
                      identifiedSkills: [],
                      detectedTheme: 'Comunicación Asertiva y Acuerdos',
                      isTherapeuticCase: false,
                      finalFeedback: {
                        detectedStrengths: ['Capacidad de sostener acuerdos con firmeza empática'],
                        stageTwoSkills: ['Comunicación Asertiva y Firmeza Empática'],
                        chosenActions: [stage5PlanFixture.what],
                        stageSixLearnings: [
                          'Pedir su perspectiva primero redujo su postura defensiva.',
                          'Abrir la conversación con datos concretos sin reproches.',
                        ],
                        recommendationsForAutonomy: [
                          'Sostener la revisión breve de cada lunes para consolidar el hábito.',
                        ],
                      },
                    }),
                  },
                ],
              },
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );

    const reqBody = {
      caseId: sessionExecuted.id,
      mentorshipId: sessionExecuted.id,
      stage: 7,
      activeStage: 7,
      leaderProfile: mockLeader,
      companyContext: mockCompanies[0],
      conversationHistory: sessionExecuted.messages,
      history: sessionExecuted.messages,
      userMessage: '[Avanzando a Etapa 7]',
      sessionData: {
        id: sessionExecuted.id,
        skillEntries: sessionExecuted.skillEntries,
        identifiedSkills: sessionExecuted.identifiedSkills,
        actionPlan: sessionExecuted.actionPlan,
        actionPlanExecutionStatus: 'executed',
        learnings: sessionExecuted.learnings,
      },
    };

    const prodRes = await invokeProdRespond(reqBody, geminiStage7ExecutedFactory);
    assert.equal(prodRes.statusCode, 200);
    assert.deepEqual(prodRes.body.data.finalFeedback.chosenActions, [stage5PlanFixture.what]);
    assert.equal(prodRes.body.data.finalFeedback.stageSixLearnings.length, 2);

    // También cuando Gemini devuelve stageSixLearnings vacío en una sesión ejecutada, recupera todos los campos (incluyendo whatHappened y whatWorked)
    const fallbackBuilt = buildStage7FinalFeedbackReport(
      {
        detectedStrengths: ['Firmeza empática'],
        stageTwoSkills: ['Comunicación Asertiva y Firmeza Empática'],
        chosenActions: [],
        stageSixLearnings: [],
        recommendationsForAutonomy: ['Sostener seguimiento semanal'],
      },
      sessionExecuted.skillEntries,
      sessionExecuted.identifiedSkills,
      '2026-02-02T10:00:00.000Z',
      {
        actionPlan: sessionExecuted.actionPlan,
        learnings: sessionExecuted.learnings,
        actionPlanExecutionStatus: 'executed',
      }
    );

    assert.ok(fallbackBuilt);
    assert.deepEqual(fallbackBuilt.chosenActions, [stage5PlanFixture.what]);
    assert.ok(
      fallbackBuilt.stageSixLearnings.includes(
        'Luis presentó el estatus real de embarques y acordamos alertas tempranas.'
      )
    );
    assert.ok(
      fallbackBuilt.stageSixLearnings.includes(
        'Abrir la conversación con datos concretos sin reproches.'
      )
    );
  });

  it('6. Ajuste 1: distingue aclaración pura de reflexión sustantiva sin depender de una lista fija de raíces', () => {
    // Aclaraciones puras / error de botón sin sustancia reflexiva -> se excluyen
    assert.equal(
      isNonSubstantiveNonExecutionNote('La verdad me equivoqué al presionar el botón, no he ejecutado la acción aún.'),
      true
    );
    assert.equal(
      isNonSubstantiveNonExecutionNote('Presioné Sí por error, todavía no lo hago.'),
      true
    );
    assert.equal(isNonSubstantiveNonExecutionNote('Aún no he ejecutado mi plan de acción.'), true);

    // Reflexión sustantiva con vocabulario distinto a raíces fijas -> se conserva
    const customVocabReflection =
      'No he ejecutado la acción aún porque mi jefe canceló la junta semanal y prefiero esperar a que vuelva de viaje el jueves.';
    assert.equal(isNonSubstantiveNonExecutionNote(customVocabReflection), false);

    const workloadReflection =
      'No pude hacerlo porque tuve que cubrir un cierre urgente de almacén y moví la charla para mañana.';
    assert.equal(isNonSubstantiveNonExecutionNote(workloadReflection), false);

    const report = buildStage7FinalFeedbackReport(
      {
        detectedStrengths: ['Claridad para priorizar el momento adecuado'],
        stageTwoSkills: ['Comunicación Asertiva y Firmeza Empática'],
        chosenActions: [],
        stageSixLearnings: [
          'La verdad me equivoqué al presionar el botón, no he ejecutado la acción aún.',
          customVocabReflection,
        ],
        recommendationsForAutonomy: ['Sostener la conversación el jueves al regreso de tu jefe'],
      },
      createStage6Session().skillEntries,
      createStage6Session().identifiedSkills,
      '2026-02-02T10:00:00.000Z',
      {
        actionPlan: { ...stage5PlanFixture, isCompleted: false, completedAt: undefined },
        actionPlanExecutionStatus: 'not_executed',
      }
    );
    assert.ok(report);
    assert.deepEqual(report.stageSixLearnings, [customVocabReflection]);
  });

  it('7. Ajuste 2: en Etapa 7 busca la aclaración más reciente en el historial de Etapa 6 sin que un mensaje inocuo posterior la anule', async () => {
    const historyWithInnocuousTrailingMsg = [
      {
        id: 'm1',
        caseId: 'case_f1_stage6',
        sender: 'leader',
        stage: 1,
        text: 'Luis acumula retrasos en los despachos matutinos.',
      },
      {
        id: 'm6_btn_yes',
        caseId: 'case_f1_stage6',
        sender: 'leader',
        stage: 6,
        text: 'Sí, ya ejecuté mi Plan de Acción.',
      },
      {
        id: 'm6_clarify',
        caseId: 'case_f1_stage6',
        sender: 'leader',
        stage: 6,
        text: 'Me equivoqué al presionar el botón, no he ejecutado la acción aún.',
      },
      {
        id: 'm6_innocuous',
        caseId: 'case_f1_stage6',
        sender: 'leader',
        stage: 6,
        text: 'Entendido, gracias. Pasemos al cierre.',
      },
    ];

    let capturedPrompt = '';
    const geminiStage7Factory = (_url: string, init?: any) => {
      const parsedBody = JSON.parse(String(init?.body || '{}'));
      capturedPrompt = parsedBody?.contents?.[0]?.parts?.[0]?.text || '';
      return new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      replyText: 'Cierre realista reconociendo que la acción sigue pendiente.',
                      readyToAdvance: false,
                      advancePrompt: null,
                      identifiedSkills: [],
                      detectedTheme: 'Comunicación Asertiva y Acuerdos',
                      isTherapeuticCase: false,
                      finalFeedback: {
                        detectedStrengths: ['Honestidad para aclarar el estado real de su compromiso'],
                        stageTwoSkills: ['Comunicación Asertiva y Firmeza Empática'],
                        chosenActions: [stage5PlanFixture.what],
                        stageSixLearnings: [],
                        recommendationsForAutonomy: ['Agendar la conversación con Luis para el martes'],
                      },
                    }),
                  },
                ],
              },
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    };

    // Caso A: estado persistido aún venía en 'executed' (sin actualizar), pero en el historial de Etapa 6 hubo aclaración seguida de un mensaje inocuo
    const staleReqBody = {
      caseId: 'case_f1_stage6',
      mentorshipId: 'case_f1_stage6',
      stage: 7,
      activeStage: 7,
      leaderProfile: mockLeader,
      companyContext: mockCompanies[0],
      conversationHistory: historyWithInnocuousTrailingMsg,
      history: historyWithInnocuousTrailingMsg,
      userMessage: '[Avanzando a Etapa 7]',
      sessionData: {
        id: 'case_f1_stage6',
        skillEntries: createStage6Session().skillEntries,
        identifiedSkills: createStage6Session().identifiedSkills,
        actionPlan: { ...stage5PlanFixture, isCompleted: true },
        actionPlanExecutionStatus: 'executed',
      },
    };

    const prodStale = await invokeProdRespond(staleReqBody, geminiStage7Factory);
    assert.equal(prodStale.statusCode, 200);
    assert.match(capturedPrompt, /PENDIENTE DE EJECUCIÓN/);
    assert.match(prodStale.body.data.finalFeedback.chosenActions[0], /pendiente de ejecución/i);

    const devStale = await invokeDevServerRespond(staleReqBody, geminiStage7Factory);
    assert.equal(devStale.statusCode, 200);
    assert.match(devStale.body.data.finalFeedback.chosenActions[0], /pendiente de ejecución/i);

    // Caso B: si después de una aclaración previa el líder SÍ ejecutó y lo confirmó después (cambiar a Sí) + mensaje inocuo, se respeta el estado 'executed'
    const reExecutedHistory = [
      ...historyWithInnocuousTrailingMsg,
      {
        id: 'm6_re_executed',
        caseId: 'case_f1_stage6',
        sender: 'leader',
        stage: 6,
        text: 'Sí, ya ejecuté mi Plan de Acción.',
      },
      {
        id: 'm6_close',
        caseId: 'case_f1_stage6',
        sender: 'leader',
        stage: 6,
        text: 'Gracias, vamos al cierre.',
      },
    ];
    const prodReExecuted = await invokeProdRespond(
      { ...staleReqBody, conversationHistory: reExecutedHistory, history: reExecutedHistory },
      geminiStage7Factory
    );
    assert.equal(prodReExecuted.statusCode, 200);
    assert.match(capturedPrompt, /Estado real de ejecución: EJECUTADA/);
    assert.deepEqual(prodReExecuted.body.data.finalFeedback.chosenActions, [stage5PlanFixture.what]);
  });

  it('8. Ajuste 3: el correo de cierre a RH refleja acción programada/pendiente cuando not_executed y acción implementada cuando executed', async () => {
    const runTransitionWithStatus = async (status: 'not_executed' | 'executed') => {
      const session = createStage6Session({
        actionPlanExecutionStatus: status,
        stage6ExecutionVerified: true,
        actionPlan: { ...stage5PlanFixture, isCompleted: status === 'executed' },
      });
      let sessions: MentorshipSession[] = [session];
      const notifications: NotificationItem[] = [];
      const opsMap = new Map<string, CaseOperationKind>();

      const ok = await executeTransactionalStageTransition({
        activeCaseId: session.id,
        targetStage: 7,
        getSessionById: (id) => sessions.find((s) => s.id === id),
        commitMentorships: (updater) => {
          sessions = updater(sessions);
          return sessions;
        },
        activeCaseOperationsRef: { current: opsMap },
        setCaseAdvancing: () => {},
        companies: mockCompanies,
        currentUser: mockLeader,
        setNotifications: (updater) => {
          const next = updater(notifications);
          notifications.splice(0, notifications.length, ...next);
        },
        dispatchFinalFeedbackReportEmail: async () => ({ success: true }),
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
              reply: 'Cierre completado.',
              data: {
                reply: 'Cierre completado.',
                responseSource: 'gemini',
                isFallback: false,
                isGeminiVerified: true,
                finalFeedback: {
                  detectedStrengths: ['Claridad en el seguimiento de acuerdos'],
                  stageTwoSkills: ['Comunicación Asertiva y Firmeza Empática'],
                  chosenActions: [stage5PlanFixture.what],
                  stageSixLearnings: [],
                  recommendationsForAutonomy: ['Mantener revisión semanal'],
                },
              },
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          ),
      });
      assert.equal(ok, true);
      return notifications;
    };

    const notExecutedNotifs = await runTransitionWithStatus('not_executed');
    const hrBodyPending = notExecutedNotifs[0]?.emailSimulated?.bodyText || '';
    assert.ok(!hrBodyPending.includes('Acción implementada:'));
    assert.match(hrBodyPending, /Acción programada \(pendiente de ejecución\):/);
    assert.ok(hrBodyPending.includes(stage5PlanFixture.what));
    assert.ok(hrBodyPending.includes(stage5PlanFixture.when));

    const executedNotifs = await runTransitionWithStatus('executed');
    const hrBodyExecuted = executedNotifs[0]?.emailSimulated?.bodyText || '';
    assert.match(hrBodyExecuted, /Acción implementada:/);
    assert.ok(hrBodyExecuted.includes(stage5PlanFixture.what));
  });
});
