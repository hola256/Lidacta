import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import respondHandler, { generateContextualCoachReply } from '../api/mentor/respond';
import {
  CANONICAL_LEADERSHIP_SKILLS,
  buildStage2EvidenceContext,
  consolidateSkillEntries,
  isValidStage2ObservableEvidence,
  mapToCanonicalSkill,
} from '../src/utils/skillsConsolidator';
import {
  executeTransactionalStageTransition,
  reconcileStage2SkillEntries,
} from '../src/context/LidactaContext';
import { MentorshipSession, NotificationItem, UserProfile } from '../src/types/lidacta';

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

async function invokeProdStage2(
  reqBody: any,
  geminiResponseFactory: (url: string, init?: any) => Response | Promise<Response>,
  apiKey: string | null = 'dummy-f3-prod-key'
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

async function invokeDevStage2(
  reqBody: any,
  geminiResponseFactory: (url: string, init?: any) => Response | Promise<Response>,
  apiKey: string | null = 'dummy-f3-dev-key'
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

  const modUrl = new URL(`../server.ts?f3=${Date.now()}-${Math.random()}`, import.meta.url).href;
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

function makeGeminiStage2Response(overrides: {
  replyText?: string;
  readyToAdvance?: boolean;
  advancePrompt?: string | null;
  identifiedSkills?: any[];
}) {
  return new Response(
    JSON.stringify({
      candidates: [
        {
          content: {
            parts: [
              {
                text: JSON.stringify({
                  replyText:
                    overrides.replyText ??
                    'Analicemos cómo impacta esta situación en ambas partes.',
                  readyToAdvance: overrides.readyToAdvance ?? false,
                  advancePrompt: overrides.advancePrompt ?? null,
                  identifiedSkills: overrides.identifiedSkills ?? [],
                  detectedTheme: 'Perspectivas y Habilidades',
                  isTherapeuticCase: false,
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

const baseLeaderProfile: UserProfile = {
  id: 'leader_f3',
  name: 'Sofía Méndez',
  email: 'sofia@empresa.com',
  role: 'Líder',
  position: 'Gerente de Operaciones',
  area: 'Logística',
  directReports: 12,
  companyId: 'comp_f3',
};

const baseCompanyContext = {
  id: 'comp_f3',
  name: 'Logística del Norte',
  industry: 'Distribución',
  areas: ['Logística', 'Calidad'],
  employeesCount: 240,
};

function createBaseStage2ReqBody(overrides: Record<string, any> = {}) {
  const caseId = overrides.sessionData?.id || overrides.caseId || 'case_f3_stage2';
  const conversationHistory = overrides.conversationHistory || [
    {
      id: 'm1',
      caseId,
      sender: 'leader',
      stage: 1,
      text: 'Mi coordinador Marcos entrega tarde los cortes diarios y cuando algo urge termino haciendo yo los reportes para no discutir con él.',
    },
    {
      id: 'm2',
      caseId,
      sender: 'lidacta',
      stage: 1,
      text: 'Entiendo, Sofía. ¿Qué ocurre cuando prefieres hacer tú los reportes?',
    },
    {
      id: 'm3',
      caseId,
      sender: 'leader',
      stage: 2,
      text: 'La verdad es que me da temor que se ponga a la defensiva si lo confronto, así que me quedo callada y absorbo su trabajo.',
    },
  ];
  return {
    caseId,
    mentorshipId: caseId,
    stage: 2,
    activeStage: 2,
    leaderProfile: baseLeaderProfile,
    companyContext: baseCompanyContext,
    conversationHistory,
    userMessage:
      overrides.userMessage ??
      'Me frustra quedarme hasta tarde corrigiendo sus entregas por evitar una conversación incómoda.',
    sessionData: {
      id: caseId,
      title: 'Retrasos en entregas de almacén',
      initialChallenge:
        'Marcos entrega tarde los reportes diarios de recepción y yo termino absorbiendo sus pendientes.',
      identifiedSkills: [],
      skillEntries: [],
      ...(overrides.sessionData || {}),
    },
    ...overrides,
  };
}

describe('Frente 3 — Calidad del diagnóstico de habilidades en Etapa 2', () => {
  it('1. Habilidad respaldada por evidencia narrativa concreta (cita o paráfrasis fiel) se identifica y guarda como vigente', async () => {
    const reqBody = createBaseStage2ReqBody();
    const geminiFactory = () =>
      makeGeminiStage2Response({
        replyText:
          'Se observa con claridad que evitar hablar con Marcos te lleva a absorber sus tareas.',
        readyToAdvance: true,
        advancePrompt: 'Avanzar a Etapa 3: Diseñar alternativas',
        identifiedSkills: [
          {
            skill: 'Comunicación Asertiva y Firmeza Empática',
            evidenceText:
              'Reconoce que se queda callada por temor a que Marcos se ponga a la defensiva y prefiere evitar la conversación incómoda.',
          },
          {
            skill: 'Delegación Efectiva y Empoderamiento',
            evidenceText: 'Termina haciendo ella misma los reportes de Marcos y absorbiendo su trabajo.',
          },
        ],
      });

    const prodRes = await invokeProdStage2(reqBody, geminiFactory);
    const devRes = await invokeDevStage2(reqBody, geminiFactory);

    assert.equal(prodRes.statusCode, 200);
    assert.equal(devRes.statusCode, 200);

    for (const payload of [prodRes.body?.data, devRes.body?.data]) {
      assert.deepEqual(payload.identifiedSkills, [
        'Comunicación Asertiva y Firmeza Empática',
        'Delegación Efectiva y Empoderamiento',
      ]);
      assert.equal(payload.skillEntries.length, 2);
      assert.equal(payload.skillEntries[0].status, 'vigente');
      assert.equal(payload.skillEntries[0].evidenceHistory[0].sourceType, 'experiencia_relatada');
      assert.equal(payload.skillEntries[0].evidenceHistory[0].stage, 2);
      assert.ok(payload.skillEntries[0].evidenceHistory[0].evidenceText.includes('temor'));
    }

    // Verificar persistencia en cliente (LidactaContext.tsx) al transicionar a Etapa 2
    let sessionState: MentorshipSession = {
      id: 'case_f3_client_1',
      title: 'Retrasos en entregas de almacén',
      leaderId: baseLeaderProfile.id,
      companyId: baseCompanyContext.id,
      currentStage: 1,
      status: 'active',
      createdAt: '2026-03-01T10:00:00Z',
      lastActiveAt: '2026-03-01T10:10:00Z',
      initialChallenge: reqBody.sessionData.initialChallenge,
      identifiedSkills: [],
      skillEntries: [],
      messages: reqBody.conversationHistory as any,
      stageHistory: [{ stage: 1, enteredAt: '2026-03-01T10:00:00Z' }],
    };

    const ok = await executeTransactionalStageTransition({
      activeCaseId: sessionState.id,
      targetStage: 2,
      getSessionById: () => sessionState,
      commitMentorships: (updater) => {
        sessionState = updater([sessionState])[0];
      },
      activeCaseOperationsRef: { current: new Map() },
      setCaseAdvancing: () => {},
      companies: [baseCompanyContext as any],
      currentUser: baseLeaderProfile,
      setNotifications: (_n: React.SetStateAction<NotificationItem[]>) => {},
      dispatchFinalFeedbackReportEmail: async () => {},
      recordResourceRecommendation: () => {},
      autoDetectAndLogResources: () => {},
      showToast: () => {},
      fetchImpl: (async () =>
        new Response(JSON.stringify(prodRes.body), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })) as any,
    });

    assert.equal(ok, true);
    assert.equal(sessionState.currentStage, 2);
    assert.deepEqual(sessionState.identifiedSkills, [
      'Comunicación Asertiva y Firmeza Empática',
      'Delegación Efectiva y Empoderamiento',
    ]);
    assert.equal(sessionState.skillEntries?.length, 2);
  });

  it('2. Habilidad sin evidencia suficiente (vacía, solo título, especulación, conducta fabricada o relato insuficiente) NO se guarda como vigente', async () => {
    const context = buildStage2EvidenceContext({
      caseTitle: 'Problemas con el equipo de almacén',
      initialChallenge: 'Tengo problemas con el equipo de almacén.',
      history: [
        {
          sender: 'leader',
          stage: 1,
          text: 'Tengo problemas con el equipo de almacén.',
        },
      ],
      latestUserMessage: '[Avanzando a Etapa 2]',
    });

    // a) Solo título del problema sin hechos concretos
    assert.equal(
      isValidStage2ObservableEvidence('Problemas con el equipo de almacén', context),
      false
    );
    // b) Evidencia vacía o demasiado corta
    assert.equal(isValidStage2ObservableEvidence('', context), false);
    assert.equal(isValidStage2ObservableEvidence('Falta apoyo', context), false);
    // c) Especulación sin sustento
    assert.equal(
      isValidStage2ObservableEvidence(
        'Probablemente el líder evita hablar porque seguramente no confía en su criterio',
        context
      ),
      false
    );

    // d) Conducta fabricada completamente ajena al relato real del líder
    const realNarrativeContext = buildStage2EvidenceContext({
      caseTitle: 'Conflictos en turnos nocturnos',
      initialChallenge: 'Dos supervisores discuten por la asignación de guardias nocturnas.',
      history: [
        {
          sender: 'leader',
          stage: 1,
          text: 'Pedro y Luis discuten cada viernes sobre quién cubre el turno de noche y no logro que acuerden reglas.',
        },
      ],
    });
    assert.equal(
      isValidStage2ObservableEvidence(
        'El líder gritó e insultó al cliente durante una auditoría financiera externa.',
        realNarrativeContext
      ),
      false
    );

    // e) En consolidateSkillEntries: candidatos en string o con evidencia fabricada/especulativa no se guardan
    const consolidated = consolidateSkillEntries(
      [],
      [
        'Comunicación Asertiva',
        { skill: 'Delegación Efectiva', evidenceText: '' },
        {
          skill: 'Inteligencia Emocional',
          evidenceText: 'Probablemente reacciona con enojo ante auditorías financieras externas.',
        },
      ],
      2,
      undefined,
      '2026-03-01T10:00:00Z',
      { requireEvidenceInStage2: true, stage2EvidenceContext: realNarrativeContext }
    );
    assert.equal(consolidated.length, 0);

    // f) End-to-end Prod & Dev: si Gemini propone habilidades sin evidencia válida, se rechazan y no permite avanzar
    const reqBody = createBaseStage2ReqBody({
      conversationHistory: [
        {
          id: 'm1',
          caseId: 'case_f3_no_ev',
          sender: 'leader',
          stage: 1,
          text: 'Problemas en el área de ventas.',
        },
      ],
      userMessage: 'No sé cómo describirlo todavía, apenas vamos viendo.',
      sessionData: {
        id: 'case_f3_no_ev',
        title: 'Problemas en el área de ventas',
        initialChallenge: 'Problemas en el área de ventas.',
        identifiedSkills: [],
        skillEntries: [],
      },
    });

    const geminiUnverified = () =>
      makeGeminiStage2Response({
        replyText: 'Podríamos trabajar varias cosas aquí.',
        readyToAdvance: true,
        advancePrompt: 'Avanzar a Etapa 3',
        identifiedSkills: [
          { skill: 'Comunicación Asertiva', evidenceText: 'Problemas en el área de ventas.' },
          {
            skill: 'Delegación Efectiva',
            evidenceText: 'Seguramente no confía en su equipo y microgestiona las llamadas.',
          },
          'Inteligencia Emocional',
        ],
      });

    const prodRes = await invokeProdStage2(reqBody, geminiUnverified);
    const devRes = await invokeDevStage2(reqBody, geminiUnverified);

    for (const payload of [prodRes.body?.data, devRes.body?.data]) {
      assert.deepEqual(payload.identifiedSkills, []);
      assert.deepEqual(payload.skillEntries, []);
      assert.equal(payload.readyToAdvance, false);
      assert.equal(payload.advancePrompt, null);
      assert.ok(payload.replyText.includes('?'));
    }

    // g) Fallback determinístico (Prod: generateContextualCoachReply | Dev: sin API key) tampoco inventa habilidades sin evidencia previa
    const prodFallbackReply = generateContextualCoachReply(
      2,
      reqBody.userMessage,
      baseLeaderProfile.name,
      reqBody.conversationHistory,
      reqBody.sessionData
    );
    const devFallback = await invokeDevStage2(reqBody, geminiUnverified, null);
    for (const payload of [prodFallbackReply, devFallback.body?.data]) {
      assert.deepEqual(payload.identifiedSkills, []);
      assert.equal(payload.readyToAdvance, false);
      assert.equal(payload.advancePrompt, null);
    }

    // h) Cliente LidactaContext no persiste skillEntries de Etapa 2 si llegan sin evidencia verificable
    const clientReconciled = reconcileStage2SkillEntries(
      [],
      [
        {
          skill: 'Comunicación Asertiva y Firmeza Empática',
          cluster: 'comunicacion',
          status: 'vigente',
          initialStage: 2,
          lastUpdatedStage: 2,
          createdAt: '2026-03-01T10:00:00Z',
          updatedAt: '2026-03-01T10:00:00Z',
          evidenceHistory: [
            {
              id: 'ev_fake',
              stage: 2,
              sourceType: 'experiencia_relatada',
              evidenceText: 'Problemas en el área de ventas.',
              timestamp: '2026-03-01T10:00:00Z',
            },
          ],
        },
      ],
      {
        caseTitle: 'Problemas en el área de ventas',
        initialChallenge: 'Problemas en el área de ventas.',
        history: reqBody.conversationHistory,
        latestUserMessage: reqBody.userMessage,
      }
    );
    assert.deepEqual(clientReconciled, []);
  });

  it('3. Habilidad válida fuera del catálogo de 9 clústeres NO se descarta y se conservan los 9 clústeres exactos', async () => {
    assert.equal(CANONICAL_LEADERSHIP_SKILLS.length, 9);
    assert.deepEqual(
      CANONICAL_LEADERSHIP_SKILLS.map((c) => c.canonicalName),
      [
        'Comunicación Asertiva y Firmeza Empática',
        'Escucha Activa e Indagación',
        'Gestión y Clarificación de Acuerdos',
        'Delegación Efectiva y Empoderamiento',
        'Inteligencia y Regulación Emocional',
        'Resolución Constructiva de Conflictos',
        'Retroalimentación Basada en Hechos',
        'Motivación y Desarrollo de Equipos',
        'Pensamiento Estratégico y Priorización',
      ]
    );

    const customMapped = mapToCanonicalSkill('negociación colaborativa con sindicato');
    assert.ok(customMapped);
    assert.equal(customMapped.canonicalName, 'Negociación Colaborativa con Sindicato');
    assert.ok(
      !CANONICAL_LEADERSHIP_SKILLS.some((c) => c.cluster === customMapped.cluster),
      'No debe forzar una habilidad personalizada dentro de un clúster canónico existente'
    );

    const reqBody = createBaseStage2ReqBody({
      conversationHistory: [
        {
          id: 'm1',
          caseId: 'case_f3_custom',
          sender: 'leader',
          stage: 1,
          text: 'El representante sindical bloqueó los cambios de horario y no logré proponer concesiones mutuas durante la mesa de negociación.',
        },
      ],
      userMessage:
        'En la mesa de negociación cedí demasiado rápido sin establecer límites ni explorar intereses mutuos.',
      sessionData: {
        id: 'case_f3_custom',
        title: 'Bloqueo de horarios con sindicato',
        initialChallenge:
          'El representante sindical bloqueó los cambios de horario en la planta.',
        identifiedSkills: [],
        skillEntries: [],
      },
    });

    const geminiCustom = () =>
      makeGeminiStage2Response({
        replyText: 'Queda muy claro lo que ocurrió en la mesa de negociación.',
        readyToAdvance: true,
        advancePrompt: 'Avanzar a Etapa 3',
        identifiedSkills: [
          {
            skill: 'Negociación Colaborativa',
            evidenceText:
              'Relata que en la mesa de negociación cedió rápido sin proponer concesiones mutuas ni explorar intereses.',
          },
          {
            skill: 'Establecimiento de Límites Laborales',
            evidenceText: 'Señala que aceptó condiciones del sindicato sin establecer límites claros.',
          },
        ],
      });

    const prodRes = await invokeProdStage2(reqBody, geminiCustom);
    const devRes = await invokeDevStage2(reqBody, geminiCustom);

    for (const payload of [prodRes.body?.data, devRes.body?.data]) {
      assert.deepEqual(payload.identifiedSkills, [
        'Negociación Colaborativa',
        'Establecimiento de Límites Laborales',
      ]);
      assert.equal(payload.skillEntries.length, 2);
      assert.equal(payload.skillEntries[0].status, 'vigente');
      assert.equal(payload.skillEntries[1].status, 'vigente');
    }
  });

  it('4. Coincidencias ambiguas, parciales o multiclúster NO fuerzan clasificación errónea en un clúster canónico', async () => {
    // Subcadenas cortas o genéricas ya NO hacen match inverso por includes()
    const control = mapToCanonicalSkill('Control operativo');
    assert.ok(control);
    assert.equal(control.canonicalName, 'Control Operativo');
    assert.notEqual(control.cluster, 'delegacion');

    const liderazgo = mapToCanonicalSkill('Liderazgo situacional');
    assert.ok(liderazgo);
    assert.equal(liderazgo.canonicalName, 'Liderazgo Situacional');
    assert.notEqual(liderazgo.cluster, 'motivacion');

    // Coincidencia múltiple simultánea (comunicacion + escucha, o escucha + delegacion) NO se colapsa a un solo clúster
    const multiCluster1 = mapToCanonicalSkill('Comunicación clara y escucha activa');
    assert.ok(multiCluster1);
    assert.equal(multiCluster1.canonicalName, 'Comunicación Clara y Escucha Activa');
    assert.notEqual(multiCluster1.cluster, 'comunicacion');
    assert.notEqual(multiCluster1.cluster, 'escucha');

    const multiCluster2 = mapToCanonicalSkill('Escuchar y delegar en piso');
    assert.ok(multiCluster2);
    assert.equal(multiCluster2.canonicalName, 'Escuchar y Delegar en Piso');
    assert.notEqual(multiCluster2.cluster, 'escucha');
    assert.notEqual(multiCluster2.cluster, 'delegacion');

    // Coincidencia unívoca clara sí normaliza al clúster canónico
    const clearMatch = mapToCanonicalSkill('Dar retroalimentación');
    assert.deepEqual(clearMatch, {
      canonicalName: 'Retroalimentación Basada en Hechos',
      cluster: 'retroalimentacion',
    });

    // Paridad Prod / Dev ante habilidad multiclúster con evidencia real
    const reqBody = createBaseStage2ReqBody();
    const geminiMulti = () =>
      makeGeminiStage2Response({
        replyText: 'Veo ambos patrones combinados en tu intervención.',
        readyToAdvance: true,
        advancePrompt: 'Avanzar a Etapa 3',
        identifiedSkills: [
          {
            skill: 'Comunicación clara y escucha activa',
            evidenceText:
              'Prefiere quedarse callada y absorber los reportes antes que conversar con Marcos.',
          },
        ],
      });

    const prodRes = await invokeProdStage2(reqBody, geminiMulti);
    const devRes = await invokeDevStage2(reqBody, geminiMulti);

    for (const payload of [prodRes.body?.data, devRes.body?.data]) {
      assert.deepEqual(payload.identifiedSkills, ['Comunicación Clara y Escucha Activa']);
      assert.notEqual(payload.skillEntries[0].cluster, 'comunicacion');
      assert.notEqual(payload.skillEntries[0].cluster, 'escucha');
    }
  });

  it('5. Habilidades históricas y personalizadas de sesiones existentes se conservan intactas', async () => {
    const historicalEntries = [
      {
        skill: 'Negociación Sindical',
        cluster: 'negociacion sindical',
        status: 'vigente' as const,
        initialStage: 2 as const,
        lastUpdatedStage: 2 as const,
        createdAt: '2026-02-01T10:00:00Z',
        updatedAt: '2026-02-01T10:00:00Z',
        evidenceHistory: [
          {
            id: 'ev_hist_1',
            stage: 2 as const,
            sourceType: 'experiencia_relatada' as const,
            evidenceText: 'Evitó fijar postura en la mesa sindical de enero.',
            timestamp: '2026-02-01T10:00:00Z',
          },
        ],
      },
    ];

    const reqBody = createBaseStage2ReqBody({
      sessionData: {
        id: 'case_f3_hist',
        title: 'Retrasos en entregas de almacén',
        initialChallenge:
          'Marcos entrega tarde los reportes diarios y en enero hubo tensión sindical.',
        identifiedSkills: ['Negociación Sindical'],
        skillEntries: historicalEntries,
      },
    });

    // Caso A: Gemini devuelve un candidato nuevo sin evidencia -> el histórico se conserva intacto
    const geminiUnverifiedNew = () =>
      makeGeminiStage2Response({
        replyText: 'Sigamos profundizando en la reunión con Marcos.',
        readyToAdvance: false,
        advancePrompt: null,
        identifiedSkills: [
          { skill: 'Delegación Efectiva', evidenceText: 'Retrasos en entregas de almacén' },
        ],
      });

    const prodRes = await invokeProdStage2(reqBody, geminiUnverifiedNew);
    const devRes = await invokeDevStage2(reqBody, geminiUnverifiedNew);

    for (const payload of [prodRes.body?.data, devRes.body?.data]) {
      assert.deepEqual(payload.identifiedSkills, ['Negociación Sindical']);
      assert.equal(payload.skillEntries.length, 1);
      assert.equal(payload.skillEntries[0].skill, 'Negociación Sindical');
      assert.equal(payload.skillEntries[0].evidenceHistory[0].id, 'ev_hist_1');
    }

    // Caso B: Fallback determinístico en Prod y Dev conserva skillEntries y identifiedSkills legadas
    const prodFallbackReply = generateContextualCoachReply(
      2,
      reqBody.userMessage,
      baseLeaderProfile.name,
      reqBody.conversationHistory,
      reqBody.sessionData
    );
    const devFallback = await invokeDevStage2(reqBody, geminiUnverifiedNew, null);
    for (const payload of [prodFallbackReply, devFallback.body?.data]) {
      assert.deepEqual(payload.identifiedSkills, ['Negociación Sindical']);
    }

    // Caso C: Cliente LidactaContext conserva entradas históricas aunque lleguen candidatos nuevos inválidos
    const clientMerged = reconcileStage2SkillEntries(
      historicalEntries,
      [
        {
          skill: 'Liderazgo Inválido',
          cluster: 'liderazgo invalido',
          status: 'vigente',
          initialStage: 2,
          lastUpdatedStage: 2,
          createdAt: '2026-03-01T10:00:00Z',
          updatedAt: '2026-03-01T10:00:00Z',
          evidenceHistory: [],
        },
      ],
      {
        caseTitle: 'Retrasos en entregas de almacén',
        initialChallenge: reqBody.sessionData.initialChallenge,
        history: reqBody.conversationHistory,
        latestUserMessage: reqBody.userMessage,
      }
    );
    assert.equal(clientMerged.length, 1);
    assert.equal(clientMerged[0].skill, 'Negociación Sindical');
  });

  it('6. El diagnóstico usa el contexto completo del caso (desafío inicial + Etapa 1 + Etapa 2 + perfil), no solo el último mensaje', async () => {
    const reqBody = createBaseStage2ReqBody({
      conversationHistory: [
        {
          id: 'm1',
          caseId: 'case_f3_ctx',
          sender: 'leader',
          stage: 1,
          text: 'Cada vez que Ana llega tarde a la junta de arranque prefiero no decirle nada frente al equipo y luego resuelvo sus pendientes.',
        },
        {
          id: 'm2',
          caseId: 'case_f3_ctx',
          sender: 'lidacta',
          stage: 1,
          text: '¿Qué impacto tiene eso en tu carga y en el equipo?',
        },
        {
          id: 'm3',
          caseId: 'case_f3_ctx',
          sender: 'leader',
          stage: 2,
          text: 'Los demás ya notaron que le cubro sus retrasos.',
        },
      ],
      // Último mensaje meramente operativo/breve
      userMessage: '[Avanzando a Etapa 2]',
      sessionData: {
        id: 'case_f3_ctx',
        title: 'Impuntualidad en juntas de arranque',
        initialChallenge:
          'Ana llega tarde a las juntas diarias de piso y el líder absorbe sus tareas sin señalar la falta.',
        identifiedSkills: [],
        skillEntries: [],
      },
    });

    let capturedProdPrompt = '';
    let capturedDevPrompt = '';

    const prodRes = await invokeProdStage2(reqBody, (_url, init) => {
      const parsed = JSON.parse(String(init?.body || '{}'));
      capturedProdPrompt = parsed?.contents?.[parsed.contents.length - 1]?.parts?.[0]?.text || '';
      return makeGeminiStage2Response({
        replyText: 'Considerando lo que relataste desde el inicio sobre Ana, se identifican dos focos.',
        readyToAdvance: true,
        advancePrompt: 'Avanzar a Etapa 3',
        identifiedSkills: [
          {
            skill: 'Comunicación Asertiva y Firmeza Empática',
            evidenceText:
              'Prefiere no decirle nada a Ana cuando llega tarde a la junta de arranque y termina cubriendo sus pendientes.',
          },
        ],
      });
    });

    const devRes = await invokeDevStage2(reqBody, (_url, init) => {
      const parsed = JSON.parse(String(init?.body || '{}'));
      capturedDevPrompt = parsed?.contents?.[parsed.contents.length - 1]?.parts?.[0]?.text || '';
      return makeGeminiStage2Response({
        replyText: 'Considerando lo que relataste desde el inicio sobre Ana, se identifican dos focos.',
        readyToAdvance: true,
        advancePrompt: 'Avanzar a Etapa 3',
        identifiedSkills: [
          {
            skill: 'Comunicación Asertiva y Firmeza Empática',
            evidenceText:
              'Prefiere no decirle nada a Ana cuando llega tarde a la junta de arranque y termina cubriendo sus pendientes.',
          },
        ],
      });
    });

    for (const promptText of [capturedProdPrompt, capturedDevPrompt]) {
      assert.ok(promptText.includes('REGLA LOCAL DE ETAPA 2'));
      assert.ok(promptText.includes('Impuntualidad en juntas de arranque'));
      assert.ok(promptText.includes('Ana llega tarde a las juntas diarias de piso'));
      assert.ok(promptText.includes('prefiero no decirle nada frente al equipo'));
      assert.ok(promptText.includes('Los demás ya notaron que le cubro sus retrasos'));
      assert.ok(promptText.includes('Gerente de Operaciones'));
    }

    assert.deepEqual(prodRes.body?.data?.identifiedSkills, [
      'Comunicación Asertiva y Firmeza Empática',
    ]);
    assert.deepEqual(devRes.body?.data?.identifiedSkills, [
      'Comunicación Asertiva y Firmeza Empática',
    ]);
  });

  it('7. Paridad estricta entre producción (api/mentor/respond.ts) y desarrollo (server.ts)', async () => {
    const reqBody = createBaseStage2ReqBody();
    const geminiShared = () =>
      makeGeminiStage2Response({
        replyText: 'Se distinguen claramente los patrones de evitación y centralización operativa.',
        readyToAdvance: true,
        advancePrompt: 'Avanzar a Etapa 3',
        identifiedSkills: [
          {
            skill: 'Comunicación directa',
            evidenceText:
              'Se queda callada por temor a que Marcos se ponga a la defensiva y evita la conversación incómoda.',
          },
          {
            skill: 'Negociación de Prioridades Operativas',
            evidenceText:
              'Termina haciendo ella misma los reportes de Marcos cuando algo urge en el turno.',
          },
          {
            skill: 'Inteligencia Emocional',
            evidenceText: 'Retrasos en entregas de almacén', // debe rechazarse en ambos entornos
          },
        ],
      });

    const prodRes = await invokeProdStage2(reqBody, geminiShared);
    const devRes = await invokeDevStage2(reqBody, geminiShared);

    assert.equal(prodRes.statusCode, 200);
    assert.equal(devRes.statusCode, 200);

    const prodData = prodRes.body.data;
    const devData = devRes.body.data;

    assert.deepEqual(prodData.identifiedSkills, devData.identifiedSkills);
    assert.deepEqual(prodData.identifiedSkills, [
      'Comunicación Asertiva y Firmeza Empática',
      'Negociación de Prioridades Operativas',
    ]);

    assert.equal(prodData.skillEntries.length, devData.skillEntries.length);
    for (let i = 0; i < prodData.skillEntries.length; i++) {
      assert.equal(prodData.skillEntries[i].skill, devData.skillEntries[i].skill);
      assert.equal(prodData.skillEntries[i].cluster, devData.skillEntries[i].cluster);
      assert.equal(prodData.skillEntries[i].status, devData.skillEntries[i].status);
      assert.equal(
        prodData.skillEntries[i].evidenceHistory[0]?.sourceType,
        devData.skillEntries[i].evidenceHistory[0]?.sourceType
      );
      assert.equal(
        prodData.skillEntries[i].evidenceHistory[0]?.evidenceText,
        devData.skillEntries[i].evidenceHistory[0]?.evidenceText
      );
    }
  });
});
