import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import respondHandler from '../api/mentor/respond';
import sendEmailHandler from '../api/send-email';
import { buildStage7FinalFeedbackReport } from '../src/context/LidactaContext';
import {
  INSUFFICIENT_EVIDENCE_MESSAGE,
  LeadershipSkillEntry,
  consolidateSkillEntries,
  formatStageTwoSkillsWithEvidence,
  normalizeExistingSessionSkills,
  resolveConsolidatedStageTwoSkills,
} from '../src/utils/skillsConsolidator';
import { FinalFeedbackReport } from '../src/types/lidacta';

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

async function invokeProdStage7WithMockGemini(reqBody: any, geminiReplyObj: Record<string, any>) {
  const originalFetch = globalThis.fetch;
  const originalApiKey = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = 'test-block2-prod-dummy-key';

  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({
        candidates: [
          {
            content: {
              parts: [{ text: JSON.stringify(geminiReplyObj) }],
            },
          },
        ],
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )) as any;

  try {
    const req = { method: 'POST', body: reqBody };
    const res = createMockRes();
    await respondHandler(req, res);
    return res;
  } finally {
    globalThis.fetch = originalFetch;
    if (originalApiKey === undefined) {
      delete process.env.GEMINI_API_KEY;
    } else {
      process.env.GEMINI_API_KEY = originalApiKey;
    }
  }
}

async function invokeDevStage7WithMockGemini(reqBody: any, geminiReplyObj: Record<string, any>) {
  const originalFetch = globalThis.fetch;
  const originalApiKey = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = 'test-block2-dev-dummy-key';

  const modUrl = new URL(`../server.ts?block2Dev=${Date.now()}-${Math.random()}`, import.meta.url).href;
  const { app } = await import(modUrl);

  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({
        candidates: [
          {
            content: {
              parts: [{ text: JSON.stringify(geminiReplyObj) }],
            },
          },
        ],
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )) as any;

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const address = server.address() as any;
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    const resp = await originalFetch(`${baseUrl}/api/mentor/respond`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Connection: 'close' },
      body: JSON.stringify(reqBody),
    });
    const json = await resp.json();
    return { statusCode: resp.status, body: json };
  } finally {
    globalThis.fetch = originalFetch;
    (server as any).closeAllConnections?.();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    if (originalApiKey === undefined) {
      delete process.env.GEMINI_API_KEY;
    } else {
      process.env.GEMINI_API_KEY = originalApiKey;
    }
  }
}

describe('Bloque 2: Integridad Metodológica de Etapa 7 (stageTwoSkills)', () => {
  const baseReqBody = {
    caseId: 'case_b2_stage7',
    mentorshipId: 'case_b2_stage7',
    stage: 7,
    activeStage: 7,
    currentStage: 7,
    leaderProfile: { name: 'Sofía Martínez', position: 'Gerente de Operaciones' },
    companyContext: { name: 'Empresa Demo' },
    conversationHistory: [
      { id: 'm1', caseId: 'case_b2_stage7', sender: 'leader', stage: 1, text: 'Tengo un reto con entregas.' },
      { id: 'm2', caseId: 'case_b2_stage7', sender: 'lidacta', stage: 6, text: '¿Qué aprendiste?' },
    ],
    userMessage: '[Avanzando a Etapa 7]',
  };

  it('Prueba 1. Bloqueo de habilidades inventadas por Gemini en producción y desarrollo', async () => {
    const geminiInventedReply = {
      replyText: 'Cierre de mentoría completado.',
      readyToAdvance: false,
      advancePrompt: null,
      identifiedSkills: ['Negociación Estratégica Inventada', 'Visión Política'],
      detectedTheme: 'Liderazgo',
      isTherapeuticCase: false,
      finalFeedback: {
        detectedStrengths: ['Apertura reflexiva durante el cierre'],
        stageTwoSkills: [
          'Negociación Estratégica Inventada — Evidencia inventada en etapa 7',
          'Liderazgo Transformacional',
        ],
        chosenActions: ['Reunión 1 a 1 de seguimiento'],
        stageSixLearnings: ['Clarificar compromisos desde el inicio'],
        recommendationsForAutonomy: ['Sostener chequeos quincenales'],
      },
    };

    const reqBody = {
      ...baseReqBody,
      sessionData: {
        id: 'case_b2_stage7',
        title: 'Seguimiento operativo',
        initialChallenge: 'Tengo un reto con entregas.',
        skillEntries: [],
        identifiedSkills: [],
        actionPlan: { what: 'Reunión 1 a 1 de seguimiento' },
      },
    };

    const prodRes = await invokeProdStage7WithMockGemini(reqBody, geminiInventedReply);
    assert.equal(prodRes.statusCode, 200);
    assert.deepEqual(prodRes.body.data.identifiedSkills, []);
    assert.deepEqual(prodRes.body.data.skillEntries, []);
    assert.deepEqual(prodRes.body.data.finalFeedback.stageTwoSkills, [INSUFFICIENT_EVIDENCE_MESSAGE]);

    const devRes = await invokeDevStage7WithMockGemini(reqBody, geminiInventedReply);
    assert.equal(devRes.statusCode, 200);
    assert.deepEqual(devRes.body.data.identifiedSkills, []);
    assert.deepEqual(devRes.body.data.skillEntries, []);
    assert.deepEqual(devRes.body.data.finalFeedback.stageTwoSkills, [INSUFFICIENT_EVIDENCE_MESSAGE]);

    // Frontend: tampoco permite que coachReply.finalFeedback.stageTwoSkills introduzca habilidades
    const frontendReport = buildStage7FinalFeedbackReport(
      prodRes.body.data.finalFeedback,
      reqBody.sessionData.skillEntries,
      reqBody.sessionData.identifiedSkills
    );
    assert.ok(frontendReport);
    assert.deepEqual(frontendReport.stageTwoSkills, [INSUFFICIENT_EVIDENCE_MESSAGE]);
  });

  it('Prueba 2. Bloqueo de resurrección de habilidades descartadas o sustituidas sin reemplazo vigente', async () => {
    const discardedAndReplacedEntries: LeadershipSkillEntry[] = [
      {
        skill: 'Resolución Constructiva de Conflictos',
        cluster: 'conflicto',
        status: 'descartada',
        initialStage: 2,
        evidenceHistory: [
          {
            id: 'ev-1',
            stage: 2,
            sourceType: 'experiencia_relatada',
            evidenceText: 'Mencionó desacuerdos iniciales en el turno.',
            timestamp: '2026-11-25T10:00:00.000Z',
          },
        ],
        reconsiderationHistory: [
          {
            stage: 3,
            reconsiderationReason: 'El origen era un bloqueo normativo externo al líder.',
            timestamp: '2026-11-25T10:10:00.000Z',
          },
        ],
        lastUpdatedStage: 3,
        createdAt: '2026-11-25T10:00:00.000Z',
        updatedAt: '2026-11-25T10:10:00.000Z',
      },
      {
        skill: 'Inteligencia y Regulación Emocional',
        cluster: 'emocional',
        status: 'sustituida',
        initialStage: 2,
        evidenceHistory: [],
        reconsiderationHistory: [
          {
            stage: 3,
            reconsiderationReason: 'Sustituida sin reemplazo activo posterior.',
            timestamp: '2026-11-25T10:12:00.000Z',
          },
        ],
        lastUpdatedStage: 3,
        createdAt: '2026-11-25T10:00:00.000Z',
        updatedAt: '2026-11-25T10:12:00.000Z',
      },
    ];

    const geminiResurrectingReply = {
      replyText: 'Cierre de mentoría.',
      readyToAdvance: false,
      identifiedSkills: ['Resolución Constructiva de Conflictos'],
      finalFeedback: {
        detectedStrengths: [],
        stageTwoSkills: [
          'Resolución Constructiva de Conflictos',
          'Inteligencia y Regulación Emocional',
        ],
        chosenActions: ['Revisar protocolo con RRHH'],
        stageSixLearnings: ['Distinguir causas normativas de habilidades personales'],
        recommendationsForAutonomy: ['Escalar bloqueos estructurales a tiempo'],
      },
    };

    const reqBody = {
      ...baseReqBody,
      sessionData: {
        id: 'case_b2_stage7',
        skillEntries: discardedAndReplacedEntries,
        identifiedSkills: [],
      },
    };

    const prodRes = await invokeProdStage7WithMockGemini(reqBody, geminiResurrectingReply);
    assert.equal(prodRes.statusCode, 200);
    assert.deepEqual(prodRes.body.data.identifiedSkills, []);
    assert.deepEqual(prodRes.body.data.finalFeedback.stageTwoSkills, [INSUFFICIENT_EVIDENCE_MESSAGE]);

    const devRes = await invokeDevStage7WithMockGemini(reqBody, geminiResurrectingReply);
    assert.equal(devRes.statusCode, 200);
    assert.deepEqual(devRes.body.data.identifiedSkills, []);
    assert.deepEqual(devRes.body.data.finalFeedback.stageTwoSkills, [INSUFFICIENT_EVIDENCE_MESSAGE]);

    const frontendReport = buildStage7FinalFeedbackReport(
      geminiResurrectingReply.finalFeedback as FinalFeedbackReport,
      discardedAndReplacedEntries,
      ['Resolución Constructiva de Conflictos'] // Incluso si quedara un rastro legado obsoleto
    );
    assert.ok(frontendReport);
    assert.deepEqual(frontendReport.stageTwoSkills, [INSUFFICIENT_EVIDENCE_MESSAGE]);
  });

  it('Prueba 3. Protección del mensaje oficial de evidencia insuficiente sin TitleCase ni sufijos', async () => {
    // 3a. Función directa en skillsConsolidator
    assert.deepEqual(
      formatStageTwoSkillsWithEvidence([INSUFFICIENT_EVIDENCE_MESSAGE]),
      [INSUFFICIENT_EVIDENCE_MESSAGE]
    );
    assert.deepEqual(
      formatStageTwoSkillsWithEvidence([`  ${INSUFFICIENT_EVIDENCE_MESSAGE.toLowerCase()}  `]),
      [INSUFFICIENT_EVIDENCE_MESSAGE]
    );
    assert.deepEqual(normalizeExistingSessionSkills([INSUFFICIENT_EVIDENCE_MESSAGE]), []);
    assert.deepEqual(
      consolidateSkillEntries([], [INSUFFICIENT_EVIDENCE_MESSAGE], 2),
      []
    );

    // 3b. Respuesta de Etapa 7 cuando Gemini devuelve el mensaje oficial siguiendo su prompt
    const geminiOfficialInsufficientReply = {
      replyText: 'Cierre concluido.',
      readyToAdvance: false,
      identifiedSkills: [],
      finalFeedback: {
        detectedStrengths: [],
        stageTwoSkills: [INSUFFICIENT_EVIDENCE_MESSAGE],
        chosenActions: ['Alinear entregables semanales'],
        stageSixLearnings: ['Documentar acuerdos con claridad'],
        recommendationsForAutonomy: ['Sostener reuniones breves de seguimiento'],
      },
    };

    const reqBody = {
      ...baseReqBody,
      sessionData: {
        id: 'case_b2_stage7',
        skillEntries: [],
        identifiedSkills: [],
      },
    };

    const prodRes = await invokeProdStage7WithMockGemini(reqBody, geminiOfficialInsufficientReply);
    const devRes = await invokeDevStage7WithMockGemini(reqBody, geminiOfficialInsufficientReply);

    for (const resBody of [prodRes.body, devRes.body]) {
      assert.deepEqual(resBody.data.finalFeedback.stageTwoSkills, [INSUFFICIENT_EVIDENCE_MESSAGE]);
      assert.equal(resBody.data.finalFeedback.stageTwoSkills[0].includes('No Se Cuenta'), false);
      assert.equal(
        resBody.data.finalFeedback.stageTwoSkills[0].includes('Habilidad previamente identificada'),
        false
      );
    }

    // 3c. Procesamiento en frontend (LidactaContext)
    const contextReport = buildStage7FinalFeedbackReport(
      prodRes.body.data.finalFeedback,
      [],
      []
    );
    assert.ok(contextReport);
    assert.deepEqual(contextReport.stageTwoSkills, [INSUFFICIENT_EVIDENCE_MESSAGE]);
    assert.equal(contextReport.stageTwoSkills[0], INSUFFICIENT_EVIDENCE_MESSAGE);

    // Verificar que todos los bloques de Etapa 7 en LidactaContext.tsx delegan en buildStage7FinalFeedbackReport
    const contextSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/context/LidactaContext.tsx'), 'utf8');
    const builderCalls = (contextSrc.match(/buildStage7FinalFeedbackReport\(/g) || []).length;
    assert.equal(builderCalls, 5, 'Debe existir 1 definición y los 4 flujos de coachReply.finalFeedback usando buildStage7FinalFeedbackReport(');
  });

  it('Prueba 4. Conservación de sesiones legadas (identifiedSkills sin evidenceHistory) ignorando habilidades nuevas del modelo', async () => {
    const legacySkills = ['comunicacion asertiva', 'Liderazgo Inspiracional en Ventas'];
    const geminiDifferentSkillsReply = {
      replyText: 'Cierre completo.',
      readyToAdvance: false,
      identifiedSkills: ['Habilidad Inventada en Etapa 7'],
      finalFeedback: {
        detectedStrengths: ['Claridad al analizar su contexto'],
        stageTwoSkills: ['Habilidad Inventada en Etapa 7 — Evidencia inventada'],
        chosenActions: ['Implementar reunión semanal'],
        stageSixLearnings: ['Pedir confirmación de entendimiento'],
        recommendationsForAutonomy: ['Dar seguimiento oportuno'],
      },
    };

    const reqBody = {
      ...baseReqBody,
      sessionData: {
        id: 'case_b2_stage7',
        skillEntries: [],
        identifiedSkills: legacySkills,
      },
    };

    const prodRes = await invokeProdStage7WithMockGemini(reqBody, geminiDifferentSkillsReply);
    const devRes = await invokeDevStage7WithMockGemini(reqBody, geminiDifferentSkillsReply);

    for (const body of [prodRes.body, devRes.body]) {
      assert.deepEqual(body.data.identifiedSkills, []);
      const reported: string[] = body.data.finalFeedback.stageTwoSkills;
      assert.equal(reported.length, 2);
      assert.equal(
        reported[0],
        'Comunicación Asertiva y Firmeza Empática — Habilidad previamente identificada (sin registro de evidencia textual conservado).'
      );
      assert.equal(
        reported[1],
        'Motivación y Desarrollo de Equipos — Habilidad previamente identificada (sin registro de evidencia textual conservado).'
      );
      assert.equal(reported.some((s) => s.includes('Inventada')), false);
    }

    const frontendReport = buildStage7FinalFeedbackReport(
      geminiDifferentSkillsReply.finalFeedback as FinalFeedbackReport,
      [],
      legacySkills
    );
    assert.ok(frontendReport);
    assert.equal(frontendReport.stageTwoSkills.length, 2);
    assert.ok(frontendReport.stageTwoSkills[0].includes('Comunicación Asertiva y Firmeza Empática — Habilidad previamente identificada'));
    assert.ok(frontendReport.stageTwoSkills[1].includes('Motivación y Desarrollo de Equipos — Habilidad previamente identificada'));
    assert.equal(frontendReport.stageTwoSkills.some((s) => s.includes('Inventada')), false);
  });

  it('Prueba 5. Integridad de habilidades con evidencia real de Etapas 2 y 4 frente a alteraciones del modelo y entrada descartada', async () => {
    const sessionSkillEntries: LeadershipSkillEntry[] = [
      {
        skill: 'Comunicación Asertiva y Firmeza Empática',
        cluster: 'comunicacion',
        status: 'vigente',
        initialStage: 2,
        evidenceHistory: [
          {
            id: 'ev-2',
            stage: 2,
            sourceType: 'experiencia_relatada',
            evidenceText: 'Evitó plantear directamente el incumplimiento al supervisor.',
            timestamp: '2026-11-25T10:00:00.000Z',
          },
          {
            id: 'ev-4',
            stage: 4,
            sourceType: 'simulacion_practica',
            evidenceText: 'En el ensayo formuló la petición con firmeza y respeto.',
            timestamp: '2026-11-25T10:20:00.000Z',
          },
        ],
        lastUpdatedStage: 4,
        createdAt: '2026-11-25T10:00:00.000Z',
        updatedAt: '2026-11-25T10:20:00.000Z',
      },
      {
        skill: 'Delegación Efectiva y Empoderamiento',
        cluster: 'delegacion',
        status: 'descartada',
        initialStage: 2,
        evidenceHistory: [
          {
            id: 'ev-d',
            stage: 2,
            sourceType: 'experiencia_relatada',
            evidenceText: 'Hipótesis inicial de sobrecarga.',
            timestamp: '2026-11-25T10:05:00.000Z',
          },
        ],
        reconsiderationHistory: [
          {
            stage: 3,
            reconsiderationReason: 'El equipo ya tenía autonomía; faltaba alineación directa.',
            timestamp: '2026-11-25T10:15:00.000Z',
          },
        ],
        lastUpdatedStage: 3,
        createdAt: '2026-11-25T10:05:00.000Z',
        updatedAt: '2026-11-25T10:15:00.000Z',
      },
    ];

    const geminiAlteredReply = {
      replyText: 'Cierre de acompañamiento.',
      readyToAdvance: false,
      identifiedSkills: ['Delegación Efectiva y Empoderamiento', 'Pensamiento Estratégico y Priorización'],
      finalFeedback: {
        detectedStrengths: ['Honestidad al revisar su estilo de comunicación'],
        stageTwoSkills: [
          'Delegación Efectiva y Empoderamiento — Reintroducida por el modelo',
          'Pensamiento Estratégico y Priorización — Inventada en Etapa 7',
        ],
        chosenActions: ['Conversación 1 a 1 con acuerdos escritos'],
        stageSixLearnings: ['Hablar a tiempo reduce fricciones'],
        recommendationsForAutonomy: ['Sostener retroalimentación continua'],
      },
    };

    const reqBody = {
      ...baseReqBody,
      sessionData: {
        id: 'case_b2_stage7',
        skillEntries: sessionSkillEntries,
        identifiedSkills: ['Comunicación Asertiva y Firmeza Empática'],
      },
    };

    const prodRes = await invokeProdStage7WithMockGemini(reqBody, geminiAlteredReply);
    const devRes = await invokeDevStage7WithMockGemini(reqBody, geminiAlteredReply);

    const expectedLine =
      'Comunicación Asertiva y Firmeza Empática — Evidencia en experiencia laboral (Etapa 2): Evitó plantear directamente el incumplimiento al supervisor. | Evidencia en simulación (Etapa 4): En el ensayo formuló la petición con firmeza y respeto.';

    for (const body of [prodRes.body, devRes.body]) {
      assert.deepEqual(body.data.identifiedSkills, []);
      assert.deepEqual(body.data.finalFeedback.stageTwoSkills, [expectedLine]);
    }

    const frontendReport = buildStage7FinalFeedbackReport(
      geminiAlteredReply.finalFeedback as FinalFeedbackReport,
      sessionSkillEntries,
      ['Comunicación Asertiva y Firmeza Empática']
    );
    assert.ok(frontendReport);
    assert.deepEqual(frontendReport.stageTwoSkills, [expectedLine]);
    assert.deepEqual(resolveConsolidatedStageTwoSkills(sessionSkillEntries, []), [expectedLine]);
  });

  it('Prueba 6. Operatividad completa del cierre sin evidencia suficiente (Gemini exitoso, fallback determinístico y compatibilidad de email sin envíos reales)', async () => {
    const geminiSuccessReply = {
      replyText: 'Gracias por concluir tu proceso de mentoría.',
      readyToAdvance: false,
      identifiedSkills: [],
      finalFeedback: {
        detectedStrengths: [],
        stageTwoSkills: [INSUFFICIENT_EVIDENCE_MESSAGE],
        chosenActions: ['Conversación semanal de alineación de metas'],
        stageSixLearnings: ['Validar acuerdos por escrito evita ambigüedades'],
        recommendationsForAutonomy: [
          'Mantener conversaciones breves de seguimiento',
          'Documentar compromisos operativos',
        ],
      },
    };

    const reqBody = {
      ...baseReqBody,
      sessionData: {
        id: 'case_b2_stage7',
        title: 'Alineación operativa',
        skillEntries: [],
        identifiedSkills: [],
        actionPlan: { what: 'Conversación semanal de alineación de metas' },
        learnings: { insights: 'Validar acuerdos por escrito evita ambigüedades' },
      },
    };

    // Ruta 1: Gemini exitoso en producción y desarrollo
    const prodSuccess = await invokeProdStage7WithMockGemini(reqBody, geminiSuccessReply);
    const devSuccess = await invokeDevStage7WithMockGemini(reqBody, geminiSuccessReply);

    for (const payload of [prodSuccess.body, devSuccess.body]) {
      assert.equal(payload.success, true);
      const fb = payload.data.finalFeedback;
      assert.ok(Array.isArray(fb.detectedStrengths));
      assert.deepEqual(fb.stageTwoSkills, [INSUFFICIENT_EVIDENCE_MESSAGE]);
      assert.ok(Array.isArray(fb.chosenActions) && fb.chosenActions.length > 0);
      assert.ok(Array.isArray(fb.stageSixLearnings) && fb.stageSixLearnings.length > 0);
      assert.ok(Array.isArray(fb.recommendationsForAutonomy) && fb.recommendationsForAutonomy.length > 0);
    }

    // Ruta 2: Fallback determinístico en producción y desarrollo (sin llamadas reales a Gemini)
    const originalFetch = globalThis.fetch;
    const prevKey = process.env.GEMINI_API_KEY;
    const prevApiKey = process.env.API_KEY;
    const prevGoogleKey = process.env.GOOGLE_API_KEY;
    delete process.env.GEMINI_API_KEY;
    delete process.env.API_KEY;
    delete process.env.GOOGLE_API_KEY;

    let prodFallbackRes: any;
    let devFallbackRes: any;
    try {
      globalThis.fetch = (async (input: any, init?: any) => {
        const url = typeof input === 'string' ? input : input?.url || '';
        if (url.startsWith('http://127.0.0.1:')) {
          return originalFetch(input, init);
        }
        throw new Error('Simulated network failure for deterministic fallback');
      }) as any;

      prodFallbackRes = createMockRes();
      await respondHandler({ method: 'POST', body: reqBody }, prodFallbackRes);

      const modUrl = new URL(`../server.ts?block2Fallback=${Date.now()}`, import.meta.url).href;
      const { app } = await import(modUrl);
      const server = http.createServer(app);
      await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
      const address = server.address() as any;
      try {
        const resp = await originalFetch(`http://127.0.0.1:${address.port}/api/mentor/respond`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Connection: 'close' },
          body: JSON.stringify(reqBody),
        });
        devFallbackRes = { statusCode: resp.status, body: await resp.json() };
      } finally {
        (server as any).closeAllConnections?.();
        await new Promise<void>((resolve) => server.close(() => resolve()));
      }
    } finally {
      globalThis.fetch = originalFetch;
      if (prevKey !== undefined) process.env.GEMINI_API_KEY = prevKey;
      if (prevApiKey !== undefined) process.env.API_KEY = prevApiKey;
      if (prevGoogleKey !== undefined) process.env.GOOGLE_API_KEY = prevGoogleKey;
    }

    assert.equal(prodFallbackRes.statusCode, 200);
    assert.equal(devFallbackRes.statusCode, 200);
    for (const fb of [
      prodFallbackRes.body.data.finalFeedback,
      devFallbackRes.body.data.finalFeedback,
    ]) {
      assert.ok(Array.isArray(fb.detectedStrengths));
      assert.deepEqual(fb.stageTwoSkills, [INSUFFICIENT_EVIDENCE_MESSAGE]);
      assert.ok(Array.isArray(fb.chosenActions) && fb.chosenActions.length > 0);
      assert.ok(Array.isArray(fb.stageSixLearnings) && fb.stageSixLearnings.length > 0);
      assert.ok(Array.isArray(fb.recommendationsForAutonomy) && fb.recommendationsForAutonomy.length > 0);
    }

    // Ruta 3: Compatibilidad con flujo de envío de correo en modo simulado (sin envío real)
    const prevResendKey = process.env.RESEND_API_KEY;
    delete process.env.RESEND_API_KEY;
    try {
      const emailRes = createMockRes();
      await sendEmailHandler(
        {
          method: 'POST',
          body: {
            to: 'sofia.martinez@empresa-demo.test',
            leaderEmail: 'sofia.martinez@empresa-demo.test',
            name: 'Sofía Martínez',
            companyName: 'Empresa Demo',
            challengeTitle: 'Alineación operativa',
            type: 'stage7_final_report',
            report: prodSuccess.body.data.finalFeedback,
          },
        },
        emailRes
      );
      assert.equal(emailRes.statusCode, 200);
      assert.equal(emailRes.body.success, true);
      assert.equal(emailRes.body.simulated, true);
    } finally {
      if (prevResendKey !== undefined) process.env.RESEND_API_KEY = prevResendKey;
    }
  });
});
