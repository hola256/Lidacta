import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import respondHandler from '../api/mentor/respond';
import {
  buildStage7FinalFeedbackReport,
  executeTransactionalStageTransition,
  isValidStage7FinalFeedbackReport,
  isVerifiedGeminiResponse,
  parseAndValidateMentorApiResponse,
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

const mockUser: UserProfile = {
  id: 'leader_b3a4_1',
  name: 'Laura Gómez',
  email: 'laura.gomez@empresa-demo.com',
  role: 'leader',
  companyId: 'comp_1',
  companyName: 'Empresa Demo S.A.',
  area: 'Operaciones',
  position: 'Gerente de Planta',
  createdAt: '2026-01-01T10:00:00.000Z',
};

const mockCompanies: CompanyContext[] = [
  {
    id: 'comp_1',
    name: 'Empresa Demo S.A.',
    industry: 'Manufactura',
    values: 'Respeto y rendición de cuentas',
    philosophy: 'Liderazgo en acción',
    expectedCompetencies: ['Delegación', 'Comunicación'],
    culture: 'Colaborativa',
    workRhythm: 'Ágil',
    webLinks: [],
    attachments: [],
    updatedAt: '2026-01-01',
  },
];

function createStage6Session(overrides: Partial<MentorshipSession> = {}): MentorshipSession {
  return {
    id: 'case_b3a4_1',
    leaderId: mockUser.id,
    leaderName: mockUser.name,
    companyId: 'comp_1',
    companyName: 'Empresa Demo S.A.',
    leaderArea: 'Operaciones',
    title: 'Seguimiento semanal con supervisor',
    initialChallenge: 'Mi supervisor evita tomar decisiones operativas.',
    currentStage: 6,
    theme: 'Delegación y Autonomía',
    status: 'active',
    priority: 'alta',
    startedAt: '2026-01-01T10:00:00.000Z',
    lastActiveAt: '2026-01-06T10:05:00.000Z',
    stageHistory: [
      { stage: 1, stageName: 'Detectar qué sucede', enteredAt: '2026-01-01T10:00:00Z', completedAt: '2026-01-01T10:15:00Z' },
      { stage: 2, stageName: 'Analizar perspectivas y habilidades', enteredAt: '2026-01-01T10:15:00Z', completedAt: '2026-01-01T10:30:00Z' },
      { stage: 3, stageName: 'Diseñar alternativas', enteredAt: '2026-01-01T10:30:00Z', completedAt: '2026-01-01T10:45:00Z' },
      { stage: 4, stageName: 'Practicar antes de actuar', enteredAt: '2026-01-01T10:45:00Z', completedAt: '2026-01-01T11:00:00Z' },
      { stage: 5, stageName: 'Actuar (Plan de Acción)', enteredAt: '2026-01-01T11:00:00Z', completedAt: '2026-01-01T11:15:00Z' },
      { stage: 6, stageName: 'Aprender y reflexionar', enteredAt: '2026-01-05T10:00:00Z' },
    ],
    messages: [
      {
        id: 'msg_1',
        caseId: 'case_b3a4_1',
        mentorshipId: 'case_b3a4_1',
        sender: 'leader',
        text: 'Mi supervisor evita tomar decisiones operativas.',
        timestamp: '2026-01-01T10:00:00Z',
        stage: 1,
      },
      {
        id: 'msg_6',
        caseId: 'case_b3a4_1',
        mentorshipId: 'case_b3a4_1',
        sender: 'leader',
        text: 'Sí ejecuté la reunión 1 a 1 y acordamos umbrales de decisión.',
        timestamp: '2026-01-06T10:00:00Z',
        stage: 6,
      },
    ],
    identifiedSkills: ['Delegación Efectiva y Empoderamiento'],
    skillEntries: [
      {
        skill: 'Delegación Efectiva y Empoderamiento',
        cluster: 'delegacion',
        status: 'vigente',
        initialStage: 2,
        lastUpdatedStage: 4,
        createdAt: '2026-01-01T10:20:00Z',
        updatedAt: '2026-01-01T10:55:00Z',
        evidenceHistory: [
          {
            id: 'ev_2',
            stage: 2,
            sourceType: 'experiencia_relatada',
            evidenceText: 'Resuelve emergencias en lugar de delimitar criterios con el supervisor.',
            timestamp: '2026-01-01T10:20:00Z',
          },
        ],
      },
    ],
    actionPlan: {
      what: 'Definir umbrales de decisión autónoma y revisión semanal de 15 min',
      when: 'Lunes 9:00 AM',
      withWhom: 'Supervisor de Turno',
      how: 'Checklist compartido con ejemplos',
      careReminders: 'Escuchar primero su propuesta',
      isCommitmentConfirmed: true,
      isCompleted: true,
    },
    actionPlanExecutionStatus: 'executed',
    stage6ExecutionVerified: true,
    learnings: {
      whatHappened: 'El supervisor propuso sus propios criterios de escalamiento.',
      whatWorked: 'Preguntar antes de corregir.',
      whatDidnt: '',
      insights: 'Clarificar umbrales evita que todo escale al gerente.',
      futureAdjustments: 'Chequeo semanal breve los lunes.',
      sharedLearningWithHR: '',
    },
    ...overrides,
  };
}

function createClosureHarness(
  initialSession: MentorshipSession,
  emailImpl?: (session: MentorshipSession, report: FinalFeedbackReport) => Promise<{ success: boolean; message?: string }>
) {
  let mentorships = [structuredClone(initialSession)];
  let notifications: NotificationItem[] = [];
  const activeCaseOperationsRef = { current: new Map<string, CaseOperationKind>() };
  const advancingState: Record<string, boolean> = {};
  const toasts: Array<{ message: string; type?: string }> = [];
  const emailCalls: Array<{ sessionId: string; isTestSession?: boolean; report: FinalFeedbackReport }> = [];

  return {
    getSession: (id: string) => mentorships.find((m) => m.id === id),
    getNotifications: () => notifications,
    activeCaseOperationsRef,
    advancingState,
    toasts,
    emailCalls,
    runStage7Closure: (fetchImpl: typeof fetch, timeoutMs = 500) =>
      executeTransactionalStageTransition({
        activeCaseId: initialSession.id,
        targetStage: 7,
        getSessionById: (id) => mentorships.find((m) => m.id === id),
        commitMentorships: (updater) => {
          mentorships = updater(mentorships);
          return mentorships;
        },
        activeCaseOperationsRef,
        setCaseAdvancing: (caseId, adv) => {
          if (adv) advancingState[caseId] = true;
          else delete advancingState[caseId];
        },
        companies: mockCompanies,
        currentUser: mockUser,
        setNotifications: (updater) => {
          notifications = updater(notifications);
        },
        dispatchFinalFeedbackReportEmail: async (session, report) => {
          emailCalls.push({ sessionId: session.id, isTestSession: session.isTestSession, report });
          if (emailImpl) return emailImpl(session, report);
          return { success: true };
        },
        recordResourceRecommendation: () => {},
        autoDetectAndLogResources: () => {},
        showToast: (message, type) => toasts.push({ message: String(message), type }),
        fetchImpl,
        timeoutMs,
      }),
  };
}

const validGeminiStage7Raw = {
  replyText: '¡Felicidades Laura! Has completado tu proceso de mentoría consolidando acuerdos claros de delegación.',
  readyToAdvance: false,
  advancePrompt: null,
  identifiedSkills: [],
  detectedTheme: 'Delegación y Autonomía',
  isTherapeuticCase: false,
  finalFeedback: {
    detectedStrengths: ['Claridad al definir umbrales operativos sin microgestión'],
    stageTwoSkills: ['Delegación Efectiva y Empoderamiento'],
    chosenActions: ['Definir umbrales de decisión autónoma y revisión semanal de 15 min'],
    stageSixLearnings: ['Clarificar umbrales evita que todo escale al gerente.'],
    recommendationsForAutonomy: ['Sostener preguntas de reflexión antes de resolver por el supervisor'],
  },
};

const baseStage7ReqBody = {
  caseId: 'case_b3a4_1',
  mentorshipId: 'case_b3a4_1',
  stage: 7,
  activeStage: 7,
  currentStage: 7,
  leaderProfile: { name: 'Laura Gómez', position: 'Gerente de Planta' },
  companyContext: { name: 'Empresa Demo S.A.' },
  conversationHistory: [
    { id: 'm1', caseId: 'case_b3a4_1', sender: 'leader', stage: 1, text: 'Mi supervisor evita tomar decisiones.' },
    { id: 'm6', caseId: 'case_b3a4_1', sender: 'leader', stage: 6, text: 'Acordamos umbrales de decisión.' },
  ],
  userMessage: '[Avanzando a Etapa 7]',
  sessionData: {
    id: 'case_b3a4_1',
    title: 'Seguimiento semanal con supervisor',
    skillEntries: createStage6Session().skillEntries,
    identifiedSkills: ['Delegación Efectiva y Empoderamiento'],
    actionPlan: createStage6Session().actionPlan,
    learnings: createStage6Session().learnings,
  },
};

async function invokeProdStage7(reqBody: any, geminiResponseFactory?: () => Response | Promise<Response>, apiKey: string | null = 'dummy-b3a4-key') {
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
    globalThis.fetch = (async () => geminiResponseFactory()) as any;
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

async function invokeDevServer(reqBody: any, geminiResponseFactory?: () => Response | Promise<Response>, apiKey: string | null = 'dummy-b3a4-dev-key') {
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

  const modUrl = new URL(`../server.ts?b3a4=${Date.now()}-${Math.random()}`, import.meta.url).href;
  const { app } = await import(modUrl);

  if (geminiResponseFactory) {
    globalThis.fetch = (async (input: any, init?: any) => {
      const url = typeof input === 'string' ? input : input?.url || '';
      if (url.startsWith('http://127.0.0.1:')) return originalFetch(input, init);
      return geminiResponseFactory();
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

describe('Bloque 3A.4 — Integridad del cierre y reporte final de Lidacta', () => {
  it('1. Cierre exitoso con respuesta verificada de Gemini en producción, desarrollo y frontend', async () => {
    const geminiOkFactory = () =>
      new Response(
        JSON.stringify({
          candidates: [{ content: { parts: [{ text: JSON.stringify(validGeminiStage7Raw) }] } }],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );

    const prodRes = await invokeProdStage7(baseStage7ReqBody, geminiOkFactory);
    const devRes = await invokeDevServer(baseStage7ReqBody, geminiOkFactory);

    for (const r of [prodRes, devRes]) {
      assert.equal(r.statusCode, 200);
      assert.equal(r.body.success, true);
      assert.equal(r.body.responseSource, 'gemini');
      assert.equal(r.body.isFallback, false);
      assert.equal(r.body.isGeminiVerified, true);
      assert.ok(r.body.model);
      assert.equal(r.body.data.responseSource, 'gemini');
      assert.equal(r.body.data.isFallback, false);
      assert.equal(r.body.data.isGeminiVerified, true);
      assert.equal(isVerifiedGeminiResponse(r.body, { requireExplicitVerification: true }), true);
      assert.equal(isValidStage7FinalFeedbackReport(r.body.data.finalFeedback), true);
    }

    // Frontend: cerrar mentoría consumiendo respuesta verificada
    const h = createClosureHarness(createStage6Session());
    const closed = await h.runStage7Closure((async () =>
      new Response(JSON.stringify(prodRes.body), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })) as any);

    assert.equal(closed, true);
    const sessionAfter = h.getSession('case_b3a4_1')!;
    assert.equal(sessionAfter.currentStage, 7);
    assert.equal(sessionAfter.status, 'completed');
    assert.ok(sessionAfter.completedAt);
    assert.ok(isValidStage7FinalFeedbackReport(sessionAfter.finalFeedbackReport));
    assert.equal(h.getNotifications().length, 1);
    assert.equal(h.getNotifications()[0].type, 'case_completed');
    assert.equal(h.emailCalls.length, 1);
  });

  it('2. Etapas 1-6 dev fallback se distingue explícitamente de Gemini, y Etapa 7 jamás usa fallback ni en prod ni en dev', async () => {
    // 2a. server.ts en Etapa 1 sin API key etiqueta explícitamente fallback determinístico (no Gemini)
    const devStage1Fallback = await invokeDevServer(
      { ...baseStage7ReqBody, stage: 1, activeStage: 1, currentStage: 1, userMessage: 'Hola Lidacta' },
      undefined,
      null
    );
    assert.equal(devStage1Fallback.statusCode, 200);
    assert.equal(devStage1Fallback.body.responseSource, 'deterministic_fallback');
    assert.equal(devStage1Fallback.body.isFallback, true);
    assert.equal(devStage1Fallback.body.isGeminiVerified, false);
    assert.equal(isVerifiedGeminiResponse(devStage1Fallback.body, { requireExplicitVerification: true }), false);

    // 2b. Sin API Key en Etapa 7: tanto producción como desarrollo devuelven error 500 limpio (nunca HTTP 200 fallback)
    const prodNoKey = await invokeProdStage7(baseStage7ReqBody, undefined, null);
    const devNoKey = await invokeDevServer(baseStage7ReqBody, undefined, null);
    for (const r of [prodNoKey, devNoKey]) {
      assert.equal(r.statusCode, 500);
      assert.equal(r.body.success, false);
      assert.equal(r.body.responseSource, 'error');
      assert.equal(r.body.isGeminiVerified, false);
      assert.equal(r.body.data?.finalFeedback, undefined);
    }

    // 2c. Fallo 503 de Gemini en Etapa 7: tanto producción como desarrollo devuelven error 503 limpio
    const fail503Factory = () => new Response('UNAVAILABLE', { status: 503 });
    const prod503 = await invokeProdStage7(baseStage7ReqBody, fail503Factory);
    const dev503 = await invokeDevServer(baseStage7ReqBody, fail503Factory);
    for (const r of [prod503, dev503]) {
      assert.equal(r.statusCode, 503);
      assert.equal(r.body.success, false);
      assert.equal(r.body.responseSource, 'error');
      assert.equal(r.body.isGeminiVerified, false);
      assert.equal(r.body.data?.finalFeedback, undefined);
    }

    // 2d. En frontend, incluso un HTTP 200 marcado como fallback o sin isGeminiVerified: true jamás permite cerrar Etapa 7
    const spoofedFallbackPayloads = [
      {
        success: true,
        responseSource: 'deterministic_fallback',
        isFallback: true,
        isGeminiVerified: false,
        reply: 'Cierre fallback disfrazado',
        data: {
          replyText: 'Cierre fallback disfrazado',
          responseSource: 'deterministic_fallback',
          isFallback: true,
          isGeminiVerified: false,
          finalFeedback: validGeminiStage7Raw.finalFeedback,
        },
      },
      {
        success: true,
        reply: 'Respuesta 200 sin verificación de Gemini',
        data: {
          replyText: 'Respuesta 200 sin verificación de Gemini',
          finalFeedback: validGeminiStage7Raw.finalFeedback,
        },
      },
    ];

    for (const payload of spoofedFallbackPayloads) {
      const h = createClosureHarness(createStage6Session());
      const ok = await h.runStage7Closure((async () =>
        new Response(JSON.stringify(payload), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })) as any);

      assert.equal(ok, false);
      const after = h.getSession('case_b3a4_1')!;
      assert.equal(after.currentStage, 6);
      assert.equal(after.status, 'active');
      assert.equal(after.completedAt, undefined);
      assert.equal(after.finalFeedbackReport, undefined);
      assert.equal(h.getNotifications().length, 0);
      assert.equal(h.emailCalls.length, 0);
    }
  });

  it('3. Respuesta vacía, incompleta, malformada o técnica aborta el cierre sin generar reporte sustituto genérico', async () => {
    const badGeminiTexts = [
      { label: 'JSON malformado', text: 'Lo siento no soy JSON {{{' },
      { label: 'replyText vacío', text: JSON.stringify({ ...validGeminiStage7Raw, replyText: '   ' }) },
      {
        label: 'sin finalFeedback',
        text: JSON.stringify({ replyText: 'Gracias por concluir.', readyToAdvance: false }),
      },
      {
        label: 'stageSixLearnings faltante',
        text: JSON.stringify({
          ...validGeminiStage7Raw,
          finalFeedback: {
            detectedStrengths: [],
            stageTwoSkills: ['Delegación Efectiva'],
            chosenActions: ['Reunión 1 a 1'],
            recommendationsForAutonomy: ['Seguimiento semanal'],
          },
        }),
      },
      {
        label: 'texto técnico en finalFeedback',
        text: JSON.stringify({
          ...validGeminiStage7Raw,
          finalFeedback: {
            ...validGeminiStage7Raw.finalFeedback,
            recommendationsForAutonomy: ['ERROR DE SERVIDOR (Gemini 503)'],
          },
        }),
      },
    ];

    for (const scenario of badGeminiTexts) {
      const factory = () =>
        new Response(
          JSON.stringify({ candidates: [{ content: { parts: [{ text: scenario.text }] } }] }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      const prodRes = await invokeProdStage7(baseStage7ReqBody, factory);
      const devRes = await invokeDevServer(baseStage7ReqBody, factory);

      for (const r of [prodRes, devRes]) {
        assert.equal(r.statusCode, 502, `Producción/Dev deben rechazar ${scenario.label} con 502`);
        assert.equal(r.body.success, false);
        assert.equal(r.body.responseSource, 'error');
        assert.equal(r.body.isGeminiVerified, false);
        assert.equal(r.body.data?.finalFeedback, undefined);
      }
    }

    // Reporte completamente vacío (todas las secciones sin contenido ni datos de sesión) debe rechazarse con 502
    const emptySessionReqBody = {
      ...baseStage7ReqBody,
      sessionData: {
        id: 'case_b3a4_empty',
        title: 'Caso sin evidencia',
        skillEntries: [],
        identifiedSkills: [],
        actionPlan: null,
        learnings: null,
      },
    };
    const completelyEmptyFactory = () =>
      new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      ...validGeminiStage7Raw,
                      finalFeedback: {
                        detectedStrengths: [],
                        stageTwoSkills: [],
                        chosenActions: [],
                        stageSixLearnings: [],
                        recommendationsForAutonomy: [],
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
    const prodEmptyRes = await invokeProdStage7(emptySessionReqBody, completelyEmptyFactory);
    const devEmptyRes = await invokeDevServer(emptySessionReqBody, completelyEmptyFactory);
    for (const r of [prodEmptyRes, devEmptyRes]) {
      assert.equal(r.statusCode, 502, 'Producción/Dev deben rechazar reporte completamente vacío con 502');
      assert.equal(r.body.success, false);
      assert.equal(r.body.responseSource, 'error');
      assert.equal(r.body.isGeminiVerified, false);
      assert.equal(r.body.data?.finalFeedback, undefined);
    }

    // Frontend también rechaza reportes completamente vacíos o con textos técnicos sin crear sustituto genérico
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
    assert.equal(
      buildStage7FinalFeedbackReport(
        {
          detectedStrengths: [],
          stageTwoSkills: ['Delegación'],
          chosenActions: ['Lidacta no pudo responder en este momento. Por favor reintenta.'],
          stageSixLearnings: ['Aprendizaje'],
          recommendationsForAutonomy: ['Recomendación'],
          deliveredAt: new Date().toISOString(),
        },
        [],
        ['Delegación']
      ),
      undefined
    );

    const h = createClosureHarness(createStage6Session());
    const validation = await parseAndValidateMentorApiResponse(
      {
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          responseSource: 'gemini',
          isFallback: false,
          isGeminiVerified: true,
          reply: 'Cierre parcial',
          data: {
            replyText: 'Cierre parcial',
            responseSource: 'gemini',
            isFallback: false,
            isGeminiVerified: true,
            finalFeedback: {
              detectedStrengths: [],
              chosenActions: [],
              stageSixLearnings: ['Algo'],
              recommendationsForAutonomy: ['Algo'],
            },
          },
        }),
      },
      { isStage7Closure: true }
    );
    assert.equal(validation.valid, false);
    assert.equal(validation.reason, 'invalid_final_feedback');

    const closed = await h.runStage7Closure((async () =>
      new Response(
        JSON.stringify({
          success: true,
          responseSource: 'gemini',
          isFallback: false,
          isGeminiVerified: true,
          reply: 'Cierre sin reporte',
          data: { replyText: 'Cierre sin reporte', responseSource: 'gemini', isGeminiVerified: true },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )) as any);
    assert.equal(closed, false);
    assert.equal(h.getSession('case_b3a4_1')?.status, 'active');
    assert.equal(h.getSession('case_b3a4_1')?.finalFeedbackReport, undefined);
    assert.equal(h.getNotifications().length, 0);
    assert.equal(h.emailCalls.length, 0);
  });

  it('4. Error HTTP o timeout en cierre preserva todos los datos y permite reintento limpio exitoso', async () => {
    const initial = createStage6Session();
    const snapshotBefore = structuredClone(initial);
    const h = createClosureHarness(initial);

    // Intento 1: timeout controlado
    const firstAttempt = await h.runStage7Closure(
      ((_url: any, init: any) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            const err: any = new Error('Timeout');
            err.name = 'AbortError';
            reject(err);
          });
        })) as any,
      20
    );

    assert.equal(firstAttempt, false);
    assert.deepEqual(h.getSession('case_b3a4_1'), snapshotBefore);
    assert.equal(h.activeCaseOperationsRef.current.has('case_b3a4_1'), false);
    assert.equal(Boolean(h.advancingState['case_b3a4_1']), false);
    assert.equal(h.getNotifications().length, 0);
    assert.equal(h.emailCalls.length, 0);

    // Intento 2 (reintento): respuesta verificada de Gemini concluye limpiamente sin pérdida de datos
    const secondAttempt = await h.runStage7Closure((async () =>
      new Response(
        JSON.stringify({
          success: true,
          responseSource: 'gemini',
          isFallback: false,
          isGeminiVerified: true,
          model: 'gemini-3.8-flash',
          reply: validGeminiStage7Raw.replyText,
          data: {
            ...validGeminiStage7Raw,
            responseSource: 'gemini',
            isFallback: false,
            isGeminiVerified: true,
            model: 'gemini-3.8-flash',
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )) as any);

    assert.equal(secondAttempt, true);
    const afterRetry = h.getSession('case_b3a4_1')!;
    assert.equal(afterRetry.currentStage, 7);
    assert.equal(afterRetry.status, 'completed');
    assert.deepEqual(afterRetry.actionPlan, snapshotBefore.actionPlan);
    assert.deepEqual(afterRetry.learnings, snapshotBefore.learnings);
    assert.deepEqual(afterRetry.skillEntries, snapshotBefore.skillEntries);
    assert.ok(isValidStage7FinalFeedbackReport(afterRetry.finalFeedbackReport));
    assert.equal(h.getNotifications().length, 1);
    assert.equal(h.emailCalls.length, 1);
  });

  it('5. Fallo en el envío de correo después de cierre confirmado no pierde datos ni revierte la conclusión', async () => {
    const h = createClosureHarness(createStage6Session(), async () => {
      throw new Error('Resend 503 temporary outage');
    });

    const closed = await h.runStage7Closure((async () =>
      new Response(
        JSON.stringify({
          success: true,
          responseSource: 'gemini',
          isFallback: false,
          isGeminiVerified: true,
          model: 'gemini-3.8-flash',
          reply: validGeminiStage7Raw.replyText,
          data: {
            ...validGeminiStage7Raw,
            responseSource: 'gemini',
            isFallback: false,
            isGeminiVerified: true,
            model: 'gemini-3.8-flash',
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )) as any);

    assert.equal(closed, true);
    const after = h.getSession('case_b3a4_1')!;
    assert.equal(after.currentStage, 7);
    assert.equal(after.status, 'completed');
    assert.ok(after.completedAt);
    assert.ok(isValidStage7FinalFeedbackReport(after.finalFeedbackReport));
    assert.equal(h.getNotifications().length, 1);
    assert.equal(h.emailCalls.length, 1);
  });

  it('6. Aislamiento QA: sesión de prueba concluye Etapa 7 sin notificar a RH ni enviar correo', async () => {
    const qaSession = createStage6Session({ id: 'qa_b3a4_stage6', isTestSession: true });
    const h = createClosureHarness(qaSession);

    const closed = await executeTransactionalStageTransition({
      activeCaseId: 'qa_b3a4_stage6',
      targetStage: 7,
      getSessionById: () => qaSession,
      commitMentorships: (updater) => updater([qaSession]),
      activeCaseOperationsRef: h.activeCaseOperationsRef,
      setCaseAdvancing: () => {},
      companies: mockCompanies,
      currentUser: mockUser,
      setNotifications: (updater) => h.getNotifications().push(...updater([])),
      dispatchFinalFeedbackReportEmail: async (s, r) => {
        h.emailCalls.push({ sessionId: s.id, isTestSession: s.isTestSession, report: r });
        return { success: true };
      },
      recordResourceRecommendation: () => {},
      autoDetectAndLogResources: () => {},
      showToast: (m, t) => h.toasts.push({ message: String(m), type: t }),
      fetchImpl: (async () =>
        new Response(
          JSON.stringify({
            success: true,
            responseSource: 'gemini',
            isFallback: false,
            isGeminiVerified: true,
            reply: validGeminiStage7Raw.replyText,
            data: {
              ...validGeminiStage7Raw,
              responseSource: 'gemini',
              isFallback: false,
              isGeminiVerified: true,
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )) as any,
    });

    assert.equal(closed, true);
    assert.equal(h.getNotifications().length, 0, 'Sesión QA no debe emitir notificación a RH');
    assert.equal(h.emailCalls.length, 0, 'Sesión QA no debe despachar correo de Etapa 7');
  });

  it('7. sendMessageInActiveSession referencia exclusivamente committedTargetSession/targetSession en post-commit (sin activeMentorship obsoleto)', () => {
    const contextSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/context/LidactaContext.tsx'), 'utf8');
    const fnStart = contextSrc.indexOf('const sendMessageInActiveSession =');
    const fnEnd = contextSrc.indexOf('const dispatchFinalFeedbackReportEmail =', fnStart);
    assert.ok(fnStart > 0 && fnEnd > fnStart, 'Debe localizarse sendMessageInActiveSession');

    const fnBody = contextSrc.slice(fnStart, fnEnd);
    const afterFetchIdx = fnBody.indexOf("await fetch('/api/mentor/respond'");
    assert.ok(afterFetchIdx > 0);
    const postFetchBody = fnBody.slice(afterFetchIdx);

    assert.equal(
      postFetchBody.includes('activeMentorship'),
      false,
      'El procesamiento post-respuesta de sendMessageInActiveSession nunca debe leer activeMentorship obsoleto'
    );
    assert.ok(
      postFetchBody.includes('const resolvedTargetSession = committedTargetSession || targetSession;'),
      'Debe usar committedTargetSession || targetSession para correo, recursos y alertas'
    );
    assert.equal(
      postFetchBody.includes('Practicar la retroalimentación continua en lugar de esperar'),
      false,
      'sendMessageInActiveSession no debe fabricar reporte genérico de Etapa 7'
    );
  });

  it('8. Cierre legítimo con evidencia insuficiente en chosenActions o stageSixLearnings (incluyendo not_executed) sin inventar datos', async () => {
    const partialSession = createStage6Session({
      id: 'case_b3a4_partial',
      actionPlan: undefined,
      actionPlanExecutionStatus: 'not_executed',
      learnings: undefined,
    });

    const partialReqBody = {
      ...baseStage7ReqBody,
      caseId: 'case_b3a4_partial',
      mentorshipId: 'case_b3a4_partial',
      sessionData: {
        id: 'case_b3a4_partial',
        title: partialSession.title,
        skillEntries: partialSession.skillEntries,
        identifiedSkills: partialSession.identifiedSkills,
        actionPlan: null,
        actionPlanExecutionStatus: 'not_executed',
        learnings: null,
      },
    };

    const geminiPartialFactory = () =>
      new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      replyText: 'Cerramos tu acompañamiento con transparencia sobre los avances observados y los pendientes por retomar.',
                      readyToAdvance: false,
                      advancePrompt: null,
                      identifiedSkills: [],
                      detectedTheme: 'Delegación y Autonomía',
                      isTherapeuticCase: false,
                      finalFeedback: {
                        detectedStrengths: ['Honestidad al reconocer obstáculos operativos antes de ejecutar'],
                        stageTwoSkills: ['Delegación Efectiva y Empoderamiento'],
                        chosenActions: [],
                        stageSixLearnings: [],
                        recommendationsForAutonomy: [
                          'Definir un primer acuerdo acotado con fecha realista antes de la próxima reunión semanal',
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

    const prodPartial = await invokeProdStage7(partialReqBody, geminiPartialFactory);
    const devPartial = await invokeDevServer(partialReqBody, geminiPartialFactory);

    for (const r of [prodPartial, devPartial]) {
      assert.equal(r.statusCode, 200);
      assert.equal(r.body.success, true);
      assert.equal(r.body.isGeminiVerified, true);
      assert.deepEqual(r.body.data.finalFeedback.chosenActions, []);
      assert.deepEqual(r.body.data.finalFeedback.stageSixLearnings, []);
      assert.equal(r.body.data.finalFeedback.recommendationsForAutonomy.length, 1);
      assert.equal(isValidStage7FinalFeedbackReport(r.body.data.finalFeedback), true);
    }

    const h = createClosureHarness(partialSession);
    const closed = await h.runStage7Closure((async () =>
      new Response(JSON.stringify(prodPartial.body), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })) as any);

    assert.equal(closed, true);
    const after = h.getSession('case_b3a4_partial')!;
    assert.equal(after.status, 'completed');
    assert.equal(after.currentStage, 7);
    assert.deepEqual(after.finalFeedbackReport?.chosenActions, []);
    assert.deepEqual(after.finalFeedbackReport?.stageSixLearnings, []);
    assert.equal(h.getNotifications().length, 1);
    assert.equal(h.emailCalls.length, 1);
  });

  it('9. Conserva actionPlan (Etapa 5) y learnings (Etapa 6) reales cuando existen y Gemini omite alguna sección en finalFeedback', async () => {
    const geminiOmittedFactory = () =>
      new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      replyText: 'Cierre concluido recuperando tus compromisos y aprendizajes reales.',
                      readyToAdvance: false,
                      advancePrompt: null,
                      identifiedSkills: [],
                      detectedTheme: 'Delegación y Autonomía',
                      isTherapeuticCase: false,
                      finalFeedback: {
                        detectedStrengths: [],
                        stageTwoSkills: ['Delegación Efectiva y Empoderamiento'],
                        chosenActions: [],
                        stageSixLearnings: [],
                        recommendationsForAutonomy: [],
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

    const prodRes = await invokeProdStage7(baseStage7ReqBody, geminiOmittedFactory);
    const devRes = await invokeDevServer(baseStage7ReqBody, geminiOmittedFactory);

    for (const r of [prodRes, devRes]) {
      assert.equal(r.statusCode, 200);
      assert.deepEqual(r.body.data.finalFeedback.chosenActions, [
        'Definir umbrales de decisión autónoma y revisión semanal de 15 min',
      ]);
      assert.ok(
        r.body.data.finalFeedback.stageSixLearnings.includes(
          'Clarificar umbrales evita que todo escale al gerente.'
        )
      );
      assert.deepEqual(r.body.data.finalFeedback.recommendationsForAutonomy, []);
    }

    const builtFromContext = buildStage7FinalFeedbackReport(
      {
        detectedStrengths: [],
        stageTwoSkills: ['Delegación Efectiva y Empoderamiento'],
        chosenActions: [],
        stageSixLearnings: [],
        recommendationsForAutonomy: [],
        deliveredAt: new Date().toISOString(),
      },
      createStage6Session().skillEntries,
      ['Delegación Efectiva y Empoderamiento'],
      new Date().toISOString(),
      {
        actionPlan: createStage6Session().actionPlan,
        learnings: createStage6Session().learnings,
      }
    );
    assert.ok(builtFromContext);
    assert.deepEqual(builtFromContext?.chosenActions, [
      'Definir umbrales de decisión autónoma y revisión semanal de 15 min',
    ]);
    assert.ok(
      builtFromContext?.stageSixLearnings.includes(
        'Clarificar umbrales evita que todo escale al gerente.'
      )
    );
    assert.deepEqual(builtFromContext?.recommendationsForAutonomy, []);
  });

  it('10. Protección contra notificaciones y correos duplicados cuando la mentoría ya está completed (incluyendo concurrencia)', async () => {
    // 10a. Doble ejecución secuencial sobre sesión recién cerrada
    const h = createClosureHarness(createStage6Session());
    let fetchCalls = 0;
    const okFetch = (async () => {
      fetchCalls += 1;
      return new Response(
        JSON.stringify({
          success: true,
          responseSource: 'gemini',
          isFallback: false,
          isGeminiVerified: true,
          model: 'gemini-3.8-flash',
          reply: validGeminiStage7Raw.replyText,
          data: {
            ...validGeminiStage7Raw,
            responseSource: 'gemini',
            isFallback: false,
            isGeminiVerified: true,
            model: 'gemini-3.8-flash',
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }) as any;

    const firstClose = await h.runStage7Closure(okFetch);
    const secondClose = await h.runStage7Closure(okFetch);

    assert.equal(firstClose, true);
    assert.equal(secondClose, false, 'Una mentoría ya completed no debe volver a cerrarse');
    assert.equal(fetchCalls, 1, 'No debe volver a consultar al servidor si latestSession ya está completed');
    assert.equal(h.getNotifications().length, 1, 'Solo debe existir una notificación case_completed');
    assert.equal(h.emailCalls.length, 1, 'Solo debe despacharse un correo de cierre');
    assert.equal(
      h.getSession('case_b3a4_1')?.messages.filter((m) => m.stage === 7).length,
      1,
      'No debe duplicar el mensaje de cierre de Etapa 7'
    );

    // 10b. Condición de carrera: snapshot inicial active al iniciar, pero estado vivo ya completed al momento de commitMentorships
    const staleSnapshot = createStage6Session({ id: 'case_b3a4_race', status: 'active' });
    const liveCompletedSession = createStage6Session({
      id: 'case_b3a4_race',
      currentStage: 7,
      status: 'completed',
      completedAt: '2026-01-06T12:00:00.000Z',
      finalReportEmailSent: true,
    });
    let liveMentorships = [structuredClone(liveCompletedSession)];
    let raceNotifications: NotificationItem[] = [];
    const raceEmailCalls: string[] = [];
    const raceOpsRef = { current: new Map<string, CaseOperationKind>() };

    const raceResult = await executeTransactionalStageTransition({
      activeCaseId: 'case_b3a4_race',
      targetStage: 7,
      getSessionById: () => staleSnapshot,
      commitMentorships: (updater) => {
        liveMentorships = updater(liveMentorships);
        return liveMentorships;
      },
      activeCaseOperationsRef: raceOpsRef,
      setCaseAdvancing: () => {},
      companies: mockCompanies,
      currentUser: mockUser,
      setNotifications: (updater) => {
        raceNotifications = updater(raceNotifications);
      },
      dispatchFinalFeedbackReportEmail: async (s) => {
        raceEmailCalls.push(s.id);
        return { success: true };
      },
      recordResourceRecommendation: () => {},
      autoDetectAndLogResources: () => {},
      showToast: () => {},
      fetchImpl: okFetch,
    });

    assert.equal(raceResult, false, 'El commit atómico debe abortar si el estado vivo ya está completed');
    assert.equal(raceNotifications.length, 0, 'No debe emitir notificación duplicada por carrera');
    assert.equal(raceEmailCalls.length, 0, 'No debe enviar correo duplicado por carrera');
    assert.equal(liveMentorships[0].messages.length, liveCompletedSession.messages.length);
  });
});
