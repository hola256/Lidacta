import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import respondHandler, {
  calibrateStage7DetectedStrengths as prodCalibrateStage7DetectedStrengths,
  extractRegisteredStage5Actions as prodExtractRegisteredStage5Actions,
} from '../api/mentor/respond';
import {
  calibrateStage7DetectedStrengths,
  INSUFFICIENT_EVIDENCE_MESSAGE,
} from '../src/utils/skillsConsolidator';
import {
  buildStage7FinalFeedbackReport,
  executeTransactionalStageTransition,
  CaseOperationKind,
} from '../src/context/LidactaContext';
import {
  CompanyContext,
  FinalFeedbackReport,
  LeadershipSkillEntry,
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
  apiKey: string | null = 'dummy-f3b2-prod-key'
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
  apiKey: string | null = 'dummy-f3b2-dev-key'
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

  const modUrl = new URL(`../server.ts?f3b2=${Date.now()}-${Math.random()}`, import.meta.url).href;
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

function makeGeminiResponse(
  finalFeedback: any,
  extras?: {
    replyText?: string;
    identifiedSkills?: string[];
    skillsReconsideration?: any;
  }
) {
  return new Response(
    JSON.stringify({
      candidates: [
        {
          content: {
            parts: [
              {
                text: JSON.stringify({
                  replyText:
                    extras?.replyText ||
                    'Cierre sintetizado con coherencia respecto a habilidades y evidencias.',
                  readyToAdvance: false,
                  advancePrompt: null,
                  identifiedSkills: extras?.identifiedSkills || [],
                  skillsReconsideration: extras?.skillsReconsideration,
                  detectedTheme: 'Delegación y Retroalimentación',
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

const delegationSkillEntry: LeadershipSkillEntry = {
  skill: 'Delegación Efectiva y Empoderamiento',
  cluster: 'delegacion',
  status: 'vigente',
  initialStage: 2,
  lastUpdatedStage: 2,
  createdAt: '2026-03-01T10:00:00Z',
  updatedAt: '2026-03-01T10:15:00Z',
  evidenceHistory: [
    {
      id: 'ev_del_1',
      stage: 2,
      sourceType: 'experiencia_relatada',
      evidenceText: 'Termina resolviendo personalmente las urgencias de sus coordinadores por temor a errores.',
      timestamp: '2026-03-01T10:15:00Z',
    },
  ],
};

const feedbackSkillEntry: LeadershipSkillEntry = {
  skill: 'Retroalimentación Constructiva y Conversaciones Difíciles',
  cluster: 'retroalimentacion',
  status: 'vigente',
  initialStage: 2,
  lastUpdatedStage: 4,
  createdAt: '2026-03-01T10:00:00Z',
  updatedAt: '2026-03-01T10:30:00Z',
  evidenceHistory: [
    {
      id: 'ev_fb_2',
      stage: 2,
      sourceType: 'experiencia_relatada',
      evidenceText: 'Evita señalar los incumplimientos puntuales por miedo a deteriorar el ambiente.',
      timestamp: '2026-03-01T10:15:00Z',
    },
    {
      id: 'ev_fb_4',
      stage: 4,
      sourceType: 'simulacion_practica',
      evidenceText: 'En el ensayo práctico expuso dos hechos concretos sin tono punitivo.',
      timestamp: '2026-03-01T10:30:00Z',
    },
  ],
};

describe('Frente 3 Bloque 3B.2 — Coherencia y calibración de fortalezas en Etapa 7', () => {
  it('1. Rechaza dominio consolidado en detectedStrengths cuando contradice habilidad activa de stageTwoSkills', async () => {
    const contradictoryStrength = 'Dominio consolidado en delegación efectiva y empoderamiento';
    const validProcessStrength = 'Claridad para delimitar qué decisiones puede delegar desde el lunes';

    const directCalibrated = calibrateStage7DetectedStrengths(
      [contradictoryStrength, validProcessStrength],
      {
        skillEntries: [delegationSkillEntry],
        identifiedSkills: [delegationSkillEntry.skill],
        actionPlan: {
          what: 'Delegar el reporte diario de incidencias con criterios de revisión',
          when: 'Lunes 09:00 AM',
          isCompleted: true,
        },
        actionPlanExecutionStatus: 'executed',
      }
    );

    assert.deepEqual(directCalibrated, [validProcessStrength]);
    assert.deepEqual(
      prodCalibrateStage7DetectedStrengths(
        [contradictoryStrength, validProcessStrength],
        {
          skillEntries: [delegationSkillEntry],
          identifiedSkills: [delegationSkillEntry.skill],
          actionPlan: {
            what: 'Delegar el reporte diario de incidencias con criterios de revisión',
            when: 'Lunes 09:00 AM',
            isCompleted: true,
          },
          actionPlanExecutionStatus: 'executed',
        }
      ),
      directCalibrated
    );

    const reqBody = {
      caseId: 'case_f3b2_1',
      stage: 7,
      leaderProfile: { name: 'Sofía Méndez', position: 'Gerente de Operaciones' },
      companyContext: { name: 'Operadora Norte' },
      conversationHistory: [
        {
          id: 'm1',
          caseId: 'case_f3b2_1',
          sender: 'leader',
          stage: 2,
          text: 'Acabo absorbiendo todo porque siento que si delego se van a equivocar.',
        },
      ],
      userMessage: '[Avanzando a Etapa 7]',
      sessionData: {
        id: 'case_f3b2_1',
        title: 'Saturación por falta de delegación',
        skillEntries: [delegationSkillEntry],
        identifiedSkills: [delegationSkillEntry.skill],
        actionPlan: {
          what: 'Delegar el reporte diario de incidencias con criterios de revisión',
          when: 'Lunes 09:00 AM',
          isCompleted: true,
        },
        actionPlanExecutionStatus: 'executed',
        learnings: {
          whatHappened: 'El coordinador entregó el primer corte diario a tiempo.',
          whatWorked: 'Definir tres criterios de alerta temprana antes de delegar.',
          whatDidnt: 'Faltó aclarar el horario máximo de envío.',
          insights: 'Acompañar con criterios claros reduce mi necesidad de intervenir en todo.',
          futureAdjustments: 'Fijar hora límite de envío a las 17:00.',
        },
      },
    };

    const geminiFactory = () =>
      makeGeminiResponse({
        detectedStrengths: [contradictoryStrength, validProcessStrength],
        stageTwoSkills: [delegationSkillEntry.skill],
        chosenActions: ['Delegó el reporte diario de incidencias con criterios de revisión'],
        stageSixLearnings: ['Definir criterios claros reduce la necesidad de intervenir en todo.'],
        recommendationsForAutonomy: ['Mantener el corte diario a las 17:00.'],
      });

    const prodRes = await invokeProdStage7(reqBody, geminiFactory);
    const devRes = await invokeDevStage7(reqBody, geminiFactory);

    for (const r of [prodRes, devRes]) {
      assert.equal(r.statusCode, 200);
      assert.deepEqual(r.body.data.finalFeedback.detectedStrengths, [validProcessStrength]);
    }
  });

  it('2. Conserva conductas positivas observables relacionadas con la habilidad activa y reformula cuando mezclan maestría con conducta real', () => {
    const pureObservableConduct =
      'Disposición para pedir primero la propuesta del equipo antes de dar instrucciones';
    const mixedColonStrength =
      'Dominio consolidado en comunicación asertiva: expuso hechos concretos de la quincena sin emitir juicios personales';
    const mixedAlStrength =
      'Maestría en delegación efectiva al pedir primero la propuesta de solución a sus supervisores';

    const commEntry: LeadershipSkillEntry = {
      skill: 'Comunicación Asertiva y Escucha Activa',
      cluster: 'comunicacion',
      status: 'vigente',
      initialStage: 2,
      lastUpdatedStage: 4,
      createdAt: '2026-03-01T10:00:00Z',
      updatedAt: '2026-03-01T10:25:00Z',
      evidenceHistory: [
        {
          id: 'ev_com_2',
          stage: 2,
          sourceType: 'experiencia_relatada',
          evidenceText: 'Suele interrumpir o resolver rápido en juntas tensas.',
          timestamp: '2026-03-01T10:10:00Z',
        },
      ],
    };

    const result = calibrateStage7DetectedStrengths(
      [pureObservableConduct, mixedColonStrength, mixedAlStrength],
      {
        skillEntries: [delegationSkillEntry, commEntry],
        identifiedSkills: [delegationSkillEntry.skill, commEntry.skill],
        actionPlan: {
          what: 'Sostener junta de alineación pidiendo primero propuestas del equipo',
          when: 'Jueves 10:00 AM',
          isCompleted: false,
        },
        actionPlanExecutionStatus: 'not_executed',
      }
    );

    assert.equal(result.length, 3);
    assert.equal(result[0], pureObservableConduct);
    assert.equal(result[1], 'Expuso hechos concretos de la quincena sin emitir juicios personales');
    assert.equal(
      result[2],
      'Disposición observada al pedir primero la propuesta de solución a sus supervisores'
    );
    for (const s of result) {
      assert.ok(!/dominio consolidado|maestr[ií]a/i.test(s));
    }
  });

  it('3. Rechaza atribuciones de desempeño habitual en piso/trabajo diario cuando solo hay evidencia de simulación de Etapa 4', () => {
    const simOnlyEntry: LeadershipSkillEntry = {
      skill: 'Retroalimentación Constructiva y Conversaciones Difíciles',
      cluster: 'retroalimentacion',
      status: 'vigente',
      initialStage: 2,
      lastUpdatedStage: 4,
      createdAt: '2026-03-01T10:00:00Z',
      updatedAt: '2026-03-01T10:30:00Z',
      evidenceHistory: [
        {
          id: 'ev_sim_only_4',
          stage: 4,
          sourceType: 'simulacion_practica',
          evidenceText: 'En la simulación estructuró hechos observables sin juicios.',
          timestamp: '2026-03-01T10:30:00Z',
        },
      ],
    };

    const workplaceOverclaim1 =
      'Aplica retroalimentación constructiva habitualmente en su trabajo diario con resultados sostenidos';
    const workplaceOverclaim2 =
      'Desempeño sólido en piso aplicando escucha activa de forma permanente con todo su equipo';
    const permanentOverclaim3 =
      'Capacidad permanente para regular conversaciones difíciles en todas sus interacciones laborales';

    const result = calibrateStage7DetectedStrengths(
      [workplaceOverclaim1, workplaceOverclaim2, permanentOverclaim3],
      {
        skillEntries: [simOnlyEntry],
        identifiedSkills: [simOnlyEntry.skill],
        conversationHistory: [
          {
            sender: 'leader',
            stage: 4,
            text: 'En el ensayo le diría a Luis: en tres entregas de la semana pasada faltó el checklist.',
          },
        ],
        actionPlan: {
          what: 'Conversar 1 a 1 con Luis usando el guion practicado',
          when: 'Viernes 09:00 AM',
          isCompleted: false,
        },
        actionPlanExecutionStatus: 'not_executed',
        isPracticeMode: true,
      }
    );

    assert.deepEqual(result, []);
  });

  it('4. Acepta observación positiva fielmente acotada a la simulación práctica de Etapa 4', async () => {
    const scopedSimStrength =
      'En la simulación estructuró hechos observables sin emitir juicios personales';

    const reqBody = {
      caseId: 'case_f3b2_4',
      stage: 7,
      leaderProfile: { name: 'Andrés Silva', position: 'Jefe de Turno' },
      companyContext: { name: 'Manufactura Sur' },
      isPracticeMode: true,
      conversationHistory: [
        {
          id: 'm4',
          caseId: 'case_f3b2_4',
          sender: 'leader',
          stage: 4,
          text: 'En el ensayo le diría: el lunes y el miércoles el cierre salió sin firma.',
        },
      ],
      userMessage: '[Avanzando a Etapa 7]',
      sessionData: {
        id: 'case_f3b2_4',
        title: 'Conversación de desempeño en turno',
        skillEntries: [feedbackSkillEntry],
        identifiedSkills: [feedbackSkillEntry.skill],
        actionPlan: {
          what: 'Conversar 1 a 1 con el supervisor de cierre',
          when: 'Lunes 08:00 AM',
          isCompleted: false,
        },
        actionPlanExecutionStatus: 'not_executed',
      },
    };

    const geminiFactory = () =>
      makeGeminiResponse({
        detectedStrengths: [scopedSimStrength],
        stageTwoSkills: [feedbackSkillEntry.skill],
        chosenActions: ['Conversar 1 a 1 con el supervisor de cierre — Pendiente de ejecución'],
        stageSixLearnings: ['Aún pendiente de llevar el guion practicado a la conversación real.'],
        recommendationsForAutonomy: ['Sostener la conversación el lunes a las 08:00 AM.'],
      });

    const prodRes = await invokeProdStage7(reqBody, geminiFactory);
    const devRes = await invokeDevStage7(reqBody, geminiFactory);

    for (const r of [prodRes, devRes]) {
      assert.equal(r.statusCode, 200);
      assert.deepEqual(r.body.data.finalFeedback.detectedStrengths, [scopedSimStrength]);
    }
  });

  it('5. Bloquea afirmaciones de resultados o ejecución en detectedStrengths, chosenActions y stageSixLearnings cuando el plan está pendiente', async () => {
    const falseExecutionStrength =
      'Ejecutó con éxito el plan de acción en piso logrando que el equipo cumpliera todas las entregas';
    const validDesignStrength =
      'Claridad al diseñar criterios concretos y verificables antes de conversar con el equipo';

    const reqBody = {
      caseId: 'case_f3b2_5',
      stage: 7,
      leaderProfile: { name: 'Carlos Mendoza', position: 'Supervisor' },
      companyContext: { name: 'Logística Central' },
      conversationHistory: [
        {
          id: 'm2',
          caseId: 'case_f3b2_5',
          sender: 'leader',
          stage: 2,
          text: 'Postergo dar retroalimentación cuando el turno viene pesado.',
        },
        {
          id: 'm6',
          caseId: 'case_f3b2_5',
          sender: 'leader',
          stage: 6,
          text: 'Todavía no he ejecutado la conversación porque se cruzó auditoría.',
        },
      ],
      userMessage: '[Avanzando a Etapa 7]',
      sessionData: {
        id: 'case_f3b2_5',
        title: 'Seguimiento pendiente con supervisor',
        skillEntries: [feedbackSkillEntry],
        identifiedSkills: [feedbackSkillEntry.skill],
        actionPlan: {
          what: 'Sostener reunión 1 a 1 con Luis sobre cortes tardíos',
          when: 'Martes 08:30 AM',
          withWhom: 'Luis Herrera',
          isCompleted: false,
        },
        actionPlanExecutionStatus: 'not_executed',
        learnings: {
          whatHappened: 'Todavía no ejecutado.',
          whatWorked: 'Pendiente.',
          whatDidnt: 'La auditoría absorbió el arranque del turno.',
          insights: 'Necesito bloquear 15 minutos antes de iniciar operación.',
          futureAdjustments: 'Reagendar para el martes a las 08:30 AM.',
        },
      },
    };

    const geminiFactory = () =>
      makeGeminiResponse({
        detectedStrengths: [falseExecutionStrength, validDesignStrength],
        stageTwoSkills: [feedbackSkillEntry.skill],
        chosenActions: ['La reunión 1 a 1 con Luis ya se ejecutó con éxito el lunes.'],
        stageSixLearnings: [
          'La conversación ya se realizó y dio excelentes resultados.',
          'Necesito bloquear 15 minutos antes de iniciar operación.',
        ],
        recommendationsForAutonomy: ['Proteger el espacio del martes 08:30 AM en calendario.'],
      });

    const prodRes = await invokeProdStage7(reqBody, geminiFactory);
    const devRes = await invokeDevStage7(reqBody, geminiFactory);

    for (const r of [prodRes, devRes]) {
      assert.equal(r.statusCode, 200);
      assert.deepEqual(r.body.data.finalFeedback.detectedStrengths, [validDesignStrength]);
      assert.match(r.body.data.finalFeedback.chosenActions[0], /pendiente de ejecución/i);
      assert.ok(!/ya se ejecut[oó]/i.test(r.body.data.finalFeedback.chosenActions[0]));
      assert.ok(
        !r.body.data.finalFeedback.stageSixLearnings.some((l: string) =>
          /ya se realiz[oó]/i.test(l)
        )
      );
      assert.ok(
        r.body.data.finalFeedback.stageSixLearnings.includes(
          'Necesito bloquear 15 minutos antes de iniciar operación.'
        )
      );
    }
  });

  it('6. Diferencia explícitamente acción diseñada (sin fecha), programada (con fecha) y ejecutada en prod, dev y cliente', () => {
    const designedOnly = prodExtractRegisteredStage5Actions(
      {
        actionPlan: {
          what: 'Acordar tablero semanal de seguimiento',
          withWhom: 'Equipo de recepción',
          isCompleted: false,
        },
        actionPlanExecutionStatus: 'not_executed',
      },
      'not_executed'
    );
    assert.match(designedOnly[0], /diseñada \(sin fecha programada\), pendiente de ejecución/i);

    const scheduledPending = prodExtractRegisteredStage5Actions(
      {
        actionPlan: {
          what: 'Acordar tablero semanal de seguimiento',
          when: 'Jueves 11:00 AM',
          withWhom: 'Equipo de recepción',
          isCompleted: false,
        },
        actionPlanExecutionStatus: 'not_executed',
      },
      'not_executed'
    );
    assert.match(scheduledPending[0], /Programada: Jueves 11:00 AM/i);
    assert.match(scheduledPending[0], /Estado: pendiente de ejecución/i);
    assert.ok(!/diseñada \(sin fecha/i.test(scheduledPending[0]));

    const executed = prodExtractRegisteredStage5Actions(
      {
        actionPlan: {
          what: 'Acordar tablero semanal de seguimiento',
          when: 'Jueves 11:00 AM',
          withWhom: 'Equipo de recepción',
          isCompleted: true,
        },
        actionPlanExecutionStatus: 'executed',
      },
      'executed'
    );
    assert.deepEqual(executed, ['Acordar tablero semanal de seguimiento']);

    const unverified = prodExtractRegisteredStage5Actions(
      {
        actionPlan: {
          what: 'Acordar tablero semanal de seguimiento',
          when: 'Jueves 11:00 AM',
          withWhom: 'Equipo de recepción',
        },
      },
      undefined
    );
    assert.deepEqual(unverified, ['Acordar tablero semanal de seguimiento']);

    const clientDesigned = buildStage7FinalFeedbackReport(
      {
        detectedStrengths: ['Claridad al definir el tablero semanal antes de ejecutar'],
        stageTwoSkills: [feedbackSkillEntry.skill],
        chosenActions: [],
        stageSixLearnings: ['Aún sin fecha confirmada para el arranque.'],
        recommendationsForAutonomy: ['Asignar fecha y hora en calendario.'],
        deliveredAt: '2026-03-01T12:00:00.000Z',
      },
      [feedbackSkillEntry],
      [feedbackSkillEntry.skill],
      '2026-03-01T12:00:00.000Z',
      {
        actionPlan: {
          what: 'Acordar tablero semanal de seguimiento',
          withWhom: 'Equipo de recepción',
          isCompleted: false,
        },
        actionPlanExecutionStatus: 'not_executed',
      }
    );
    assert.ok(clientDesigned);
    assert.deepEqual(clientDesigned.chosenActions, designedOnly);

    const clientExecuted = buildStage7FinalFeedbackReport(
      {
        detectedStrengths: ['Claridad al definir el tablero semanal'],
        stageTwoSkills: [feedbackSkillEntry.skill],
        chosenActions: [],
        stageSixLearnings: ['El equipo adoptó el tablero semanal en recepción.'],
        recommendationsForAutonomy: ['Revisar cumplimiento los lunes.'],
        deliveredAt: '2026-03-01T12:00:00.000Z',
      },
      [feedbackSkillEntry],
      [feedbackSkillEntry.skill],
      '2026-03-01T12:00:00.000Z',
      {
        actionPlan: {
          what: 'Acordar tablero semanal de seguimiento',
          when: 'Jueves 11:00 AM',
          withWhom: 'Equipo de recepción',
          isCompleted: true,
        },
        actionPlanExecutionStatus: 'executed',
      }
    );
    assert.ok(clientExecuted);
    assert.deepEqual(clientExecuted.chosenActions, executed);
  });

  it('7. Acepta fortalezas válidas respaldadas por evidencia suficiente aunque no correspondan a stageTwoSkills', async () => {
    const unrelatedValidStrength =
      'Disposición para cuestionar sus propios supuestos y asumir corresponsabilidad operativa';

    const reqBody = {
      caseId: 'case_f3b2_7',
      stage: 7,
      leaderProfile: { name: 'Elena Vargas', position: 'Jefa de Calidad' },
      companyContext: { name: 'Alimentos del Valle' },
      conversationHistory: [
        {
          id: 'm2',
          caseId: 'case_f3b2_7',
          sender: 'leader',
          stage: 2,
          text: 'Me cuesta delegar inspecciones críticas pero reconozco que tampoco dejé criterios por escrito.',
        },
      ],
      userMessage: '[Avanzando a Etapa 7]',
      sessionData: {
        id: 'case_f3b2_7',
        title: 'Criterios de inspección en calidad',
        skillEntries: [delegationSkillEntry],
        identifiedSkills: [delegationSkillEntry.skill],
        actionPlan: {
          what: 'Documentar tres criterios mínimos de inspección con la supervisora',
          when: 'Miércoles 10:00 AM',
          isCompleted: true,
        },
        actionPlanExecutionStatus: 'executed',
      },
    };

    const geminiFactory = () =>
      makeGeminiResponse({
        detectedStrengths: [unrelatedValidStrength],
        stageTwoSkills: [delegationSkillEntry.skill],
        chosenActions: ['Documentó tres criterios mínimos de inspección con la supervisora'],
        stageSixLearnings: ['Los criterios escritos redujeron las consultas urgentes.'],
        recommendationsForAutonomy: ['Revisar el cumplimiento de los criterios cada viernes.'],
      });

    const prodRes = await invokeProdStage7(reqBody, geminiFactory);
    const devRes = await invokeDevStage7(reqBody, geminiFactory);

    for (const r of [prodRes, devRes]) {
      assert.equal(r.statusCode, 200);
      assert.deepEqual(r.body.data.finalFeedback.detectedStrengths, [unrelatedValidStrength]);
    }
  });

  it('8. Conserva detectedStrengths: [] cuando Gemini devuelve [] y vacía fortalezas inventadas cuando no hay evidencia sustantiva', async () => {
    const inventedStrengths = [
      'Excelente capacidad de comunicación y liderazgo en todo momento',
      'Disposición para escuchar activamente a su equipo durante el cierre',
    ];

    // 8a) Sin evidencia sustantiva en sesión -> debe devolver [] sin inventar fortalezas
    const emptyEvidenceResult = calibrateStage7DetectedStrengths(inventedStrengths, {
      skillEntries: [],
      identifiedSkills: [],
      stageTwoSkills: [INSUFFICIENT_EVIDENCE_MESSAGE],
      conversationHistory: [
        { sender: 'leader', stage: 1, text: 'Hola' },
        { sender: 'leader', stage: 2, text: 'Ok, avancemos' },
      ],
      actionPlan: undefined,
      chosenAlternative: undefined,
      learnings: { whatHappened: 'Pendiente', whatWorked: 'No sé' },
    });
    assert.deepEqual(emptyEvidenceResult, []);

    // 8b) Cuando Gemini devuelve [] explícitamente en una sesión real, se preserva [] (sin rellenar artificialmente)
    const reqBody = {
      caseId: 'case_f3b2_8',
      stage: 7,
      leaderProfile: { name: 'Raúl Ortega', position: 'Coordinador' },
      companyContext: { name: 'Servicios Norte' },
      conversationHistory: [
        {
          id: 'm1',
          caseId: 'case_f3b2_8',
          sender: 'leader',
          stage: 1,
          text: 'Tengo retrasos con un analista y ya armé mi plan.',
        },
      ],
      userMessage: '[Avanzando a Etapa 7]',
      sessionData: {
        id: 'case_f3b2_8',
        title: 'Seguimiento con analista',
        skillEntries: [feedbackSkillEntry],
        identifiedSkills: [feedbackSkillEntry.skill],
        actionPlan: {
          what: 'Revisar entregables semanales cada lunes',
          when: 'Lunes 09:00 AM',
          isCompleted: false,
        },
        actionPlanExecutionStatus: 'not_executed',
      },
    };

    const geminiFactory = () =>
      makeGeminiResponse({
        detectedStrengths: [],
        stageTwoSkills: [feedbackSkillEntry.skill],
        chosenActions: ['Revisar entregables semanales cada lunes (Programada: Lunes 09:00 AM) — Estado: pendiente de ejecución'],
        stageSixLearnings: ['Aún pendiente de ejecutar la primera revisión semanal.'],
        recommendationsForAutonomy: ['Realizar la primera revisión el próximo lunes.'],
      });

    const prodRes = await invokeProdStage7(reqBody, geminiFactory);
    const devRes = await invokeDevStage7(reqBody, geminiFactory);

    for (const r of [prodRes, devRes]) {
      assert.equal(r.statusCode, 200);
      assert.deepEqual(r.body.data.finalFeedback.detectedStrengths, []);
    }
  });

  it('9. Evita filtrado indiscriminado: conserva fortalezas válidas que comparten palabras clave con habilidades activas', () => {
    const validStrengthsSharingKeywords = [
      'Apertura para recibir retroalimentación durante el acompañamiento sin ponerse a la defensiva',
      'Capacidad de expresar hechos concretos sin caer en reproches personales en la simulación',
      'Disposición para comunicar con mayor claridad los acuerdos antes de cerrar la reunión',
      'Autoconciencia para identificar su propia frustración antes de responder al equipo',
    ];

    const multiActiveEntries: LeadershipSkillEntry[] = [
      feedbackSkillEntry,
      {
        skill: 'Comunicación Asertiva y Escucha Activa',
        cluster: 'comunicacion',
        status: 'vigente',
        initialStage: 2,
        lastUpdatedStage: 2,
        createdAt: '2026-03-01T10:00:00Z',
        updatedAt: '2026-03-01T10:15:00Z',
        evidenceHistory: [
          {
            id: 'ev_com_9',
            stage: 2,
            sourceType: 'experiencia_relatada',
            evidenceText: 'Da instrucciones generales sin verificar comprensión.',
            timestamp: '2026-03-01T10:15:00Z',
          },
        ],
      },
      {
        skill: 'Regulación Emocional e Inteligencia Emocional',
        cluster: 'regulacion_emocional',
        status: 'vigente',
        initialStage: 2,
        lastUpdatedStage: 2,
        createdAt: '2026-03-01T10:00:00Z',
        updatedAt: '2026-03-01T10:15:00Z',
        evidenceHistory: [
          {
            id: 'ev_emo_9',
            stage: 2,
            sourceType: 'experiencia_relatada',
            evidenceText: 'Responde impulsivamente cuando hay reclamos del cliente.',
            timestamp: '2026-03-01T10:15:00Z',
          },
        ],
      },
    ];

    const calibrated = calibrateStage7DetectedStrengths(validStrengthsSharingKeywords, {
      skillEntries: multiActiveEntries,
      identifiedSkills: multiActiveEntries.map((e) => e.skill),
      isPracticeMode: true,
      actionPlan: {
        what: 'Confirmar acuerdos por escrito al cierre de junta',
        when: 'Martes 10:00 AM',
        isCompleted: false,
      },
      actionPlanExecutionStatus: 'not_executed',
    });

    assert.deepEqual(calibrated, validStrengthsSharingKeywords);
  });

  it('10. Paridad integral prod/dev/cliente y refuerzo exclusivo en stage7LocalRule sin alterar systemPrompt global', async () => {
    const reqBody = {
      caseId: 'case_f3b2_10',
      stage: 7,
      leaderProfile: { name: 'Mariana Cruz', position: 'Gerente Regional' },
      companyContext: { name: 'Retail Pacífico' },
      isPracticeMode: true,
      conversationHistory: [
        {
          id: 'm2',
          caseId: 'case_f3b2_10',
          sender: 'leader',
          stage: 2,
          text: 'Me cuesta delegar los cierres de tienda y termino haciéndolos yo.',
        },
        {
          id: 'm4',
          caseId: 'case_f3b2_10',
          sender: 'leader',
          stage: 4,
          text: 'En el ensayo definí qué indicadores revisar con el subgerente.',
        },
      ],
      userMessage: '[Avanzando a Etapa 7]',
      sessionData: {
        id: 'case_f3b2_10',
        title: 'Delegación de cierres de tienda',
        skillEntries: [delegationSkillEntry],
        identifiedSkills: [delegationSkillEntry.skill],
        chosenAlternative: 'Delegar con checklist de tres puntos',
        actionPlan: {
          what: 'Delegar el cierre del viernes al subgerente con checklist de tres puntos',
          withWhom: 'Subgerente de sucursal',
          isCompleted: false,
        },
        actionPlanExecutionStatus: 'not_executed',
        learnings: {
          whatDidnt: 'Faltó confirmar fecha de inicio por inventario.',
          insights: 'Transferir responsabilidad exige acordar qué revisar sin intervenir.',
          futureAdjustments: 'Definir fecha de arranque en el calendario del lunes.',
        },
      },
    };

    let prodSystemInstruction = '';
    let devSystemInstruction = '';
    let prodUserPrompt = '';
    let devUserPrompt = '';

    const mixedRawStrengths = [
      'Dominio consolidado en delegación efectiva y empoderamiento',
      'Maestría en delegación efectiva al pedir primero la propuesta del subgerente',
      'En la simulación definió criterios claros de seguimiento antes de actuar',
      'Aplica delegación efectiva habitualmente en su trabajo diario con todo el equipo',
    ];

    const prodRes = await invokeProdStage7(reqBody, (_url, init) => {
      const parsed = JSON.parse(String(init?.body || '{}'));
      prodSystemInstruction = parsed?.systemInstruction?.parts?.[0]?.text || '';
      prodUserPrompt = parsed?.contents?.[parsed.contents.length - 1]?.parts?.[0]?.text || '';
      return makeGeminiResponse({
        detectedStrengths: mixedRawStrengths,
        stageTwoSkills: [delegationSkillEntry.skill],
        chosenActions: [],
        stageSixLearnings: [],
        recommendationsForAutonomy: ['Definir fecha de arranque en el calendario del lunes.'],
      });
    });

    const devRes = await invokeDevStage7(reqBody, (_url, init) => {
      const parsed = JSON.parse(String(init?.body || '{}'));
      devSystemInstruction = parsed?.systemInstruction?.parts?.[0]?.text || '';
      devUserPrompt = parsed?.contents?.[parsed.contents.length - 1]?.parts?.[0]?.text || '';
      return makeGeminiResponse({
        detectedStrengths: mixedRawStrengths,
        stageTwoSkills: [delegationSkillEntry.skill],
        chosenActions: [],
        stageSixLearnings: [],
        recommendationsForAutonomy: ['Definir fecha de arranque en el calendario del lunes.'],
      });
    });

    assert.equal(prodRes.statusCode, 200);
    assert.equal(devRes.statusCode, 200);
    assert.deepEqual(prodRes.body.data.finalFeedback, devRes.body.data.finalFeedback);

    // El cliente (buildStage7FinalFeedbackReport) debe producir exactamente el mismo finalFeedback calibrado
    const clientBuilt = buildStage7FinalFeedbackReport(
      {
        detectedStrengths: mixedRawStrengths,
        stageTwoSkills: [delegationSkillEntry.skill],
        chosenActions: [],
        stageSixLearnings: [],
        recommendationsForAutonomy: ['Definir fecha de arranque en el calendario del lunes.'],
        deliveredAt: prodRes.body.data.finalFeedback.deliveredAt,
      },
      [delegationSkillEntry],
      [delegationSkillEntry.skill],
      prodRes.body.data.finalFeedback.deliveredAt,
      {
        actionPlan: reqBody.sessionData.actionPlan,
        actionPlanExecutionStatus: 'not_executed',
        chosenAlternative: reqBody.sessionData.chosenAlternative,
        learnings: reqBody.sessionData.learnings,
        conversationHistory: reqBody.conversationHistory,
        isPracticeMode: true,
      }
    );

    assert.ok(clientBuilt);
    assert.deepEqual(
      clientBuilt.detectedStrengths,
      prodRes.body.data.finalFeedback.detectedStrengths
    );
    assert.deepEqual(clientBuilt.chosenActions, prodRes.body.data.finalFeedback.chosenActions);
    assert.deepEqual(clientBuilt.stageTwoSkills, prodRes.body.data.finalFeedback.stageTwoSkills);

    // La regla local de Etapa 7 se reforzó y systemPrompt global permanece sin referencias específicas de calibración Etapa 7
    for (const sysPrompt of [prodSystemInstruction, devSystemInstruction]) {
      assert.ok(sysPrompt.length > 100);
      assert.ok(!sysPrompt.includes('Calibración obligatoria de "detectedStrengths"'));
    }
    for (const localPrompt of [prodUserPrompt, devUserPrompt]) {
      assert.match(localPrompt, /Calibración obligatoria de "detectedStrengths"/);
      assert.match(localPrompt, /Si la única evidencia proviene de simulación en Etapa 4/);
    }
  });

  it('11. Preserva reglas previas de integridad en Etapa 7: sin nuevas/mutadas skills, sin resucitar descartadas y con cierre transaccional', async () => {
    const discardedEntry: LeadershipSkillEntry = {
      skill: 'Pensamiento Estratégico y Visión de Negocio',
      cluster: 'pensamiento_estrategico',
      status: 'descartada',
      initialStage: 2,
      lastUpdatedStage: 3,
      createdAt: '2026-03-01T10:00:00Z',
      updatedAt: '2026-03-01T10:20:00Z',
      evidenceHistory: [
        {
          id: 'ev_disc_1',
          stage: 2,
          sourceType: 'experiencia_relatada',
          evidenceText: 'Mencionó presión del trimestre en la primera conversación.',
          timestamp: '2026-03-01T10:05:00Z',
        },
      ],
      reconsiderationHistory: [
        {
          stage: 3,
          reconsiderationReason: 'El líder aclaró que el reto es de delegación operativa, no de estrategia.',
          timestamp: '2026-03-01T10:20:00Z',
        },
      ],
    };

    const sessionEntries = [delegationSkillEntry, discardedEntry];

    const clientLeader: UserProfile = {
      id: 'leader_f3b2_11',
      name: 'Mariana Cruz',
      email: 'mariana.cruz@retail.com',
      role: 'leader',
      companyId: 'comp_f3b2',
      companyName: 'Retail Pacífico',
      area: 'Operaciones',
      position: 'Gerente Regional',
      createdAt: '2026-01-01T10:00:00.000Z',
    };

    const clientCompanies: CompanyContext[] = [
      {
        id: 'comp_f3b2',
        name: 'Retail Pacífico',
        industry: 'Retail',
        values: 'Claridad y corresponsabilidad',
        philosophy: 'Liderazgo práctico',
        expectedCompetencies: ['Delegación Efectiva y Empoderamiento'],
        culture: 'Directa',
        workRhythm: 'Operativo',
        webLinks: [],
        attachments: [],
        updatedAt: '2026-01-01',
      },
    ];

    const sessionActive: MentorshipSession = {
      id: 'case_f3b2_11',
      leaderId: clientLeader.id,
      leaderName: clientLeader.name,
      companyId: 'comp_f3b2',
      companyName: 'Retail Pacífico',
      leaderArea: 'Operaciones',
      title: 'Delegación de cierres',
      initialChallenge: 'Todo lo cierro yo mismo.',
      currentStage: 6,
      stageHistory: [
        { stage: 5, stageName: 'Actuar', enteredAt: '2026-03-01T10:00:00Z', completedAt: '2026-03-01T10:20:00Z' },
        { stage: 6, stageName: 'Aprender y reflexionar', enteredAt: '2026-03-02T10:00:00Z' },
      ],
      messages: [
        {
          id: 'm2',
          caseId: 'case_f3b2_11',
          sender: 'leader',
          text: 'Termino resolviendo las urgencias por temor a errores.',
          timestamp: '2026-03-01T10:15:00Z',
          stage: 2,
        },
        {
          id: 'm6',
          caseId: 'case_f3b2_11',
          sender: 'leader',
          text: 'Ya delegué el cierre del viernes con checklist.',
          timestamp: '2026-03-02T10:15:00Z',
          stage: 6,
        },
      ],
      theme: 'Delegación',
      status: 'active',
      startedAt: '2026-03-01T10:00:00Z',
      lastActiveAt: '2026-03-02T10:15:00Z',
      identifiedSkills: [delegationSkillEntry.skill],
      skillEntries: sessionEntries,
      actionPlan: {
        what: 'Delegar el cierre del viernes con checklist de tres puntos',
        when: 'Viernes 18:00',
        withWhom: 'Subgerente de tienda',
        how: 'Validando criterios antes del cierre',
        careReminders: 'No intervenir si cumple el checklist',
        isCommitmentConfirmed: true,
        isCompleted: true,
      },
      actionPlanExecutionStatus: 'executed',
      stage6ExecutionVerified: true,
    };

    const reqBody = {
      caseId: sessionActive.id,
      stage: 7,
      leaderProfile: clientLeader,
      companyContext: clientCompanies[0],
      conversationHistory: sessionActive.messages,
      userMessage: '[Avanzando a Etapa 7]',
      sessionData: {
        id: sessionActive.id,
        title: sessionActive.title,
        skillEntries: sessionEntries,
        identifiedSkills: [delegationSkillEntry.skill],
        actionPlan: sessionActive.actionPlan,
        actionPlanExecutionStatus: 'executed',
      },
    };

    // Gemini intenta resucitar habilidad descartada, agregar otra en Etapa 7 y meter dominio consolidado en strengths
    const geminiFactory = () =>
      makeGeminiResponse(
        {
          detectedStrengths: [
            'Dominio consolidado en delegación efectiva y empoderamiento',
            'Disposición para definir criterios observables de cierre antes de delegar',
          ],
          stageTwoSkills: [
            'Pensamiento Estratégico y Visión de Negocio',
            'Motivación y Desarrollo del Equipo',
          ],
          chosenActions: ['Delegó el cierre del viernes con checklist de tres puntos'],
          stageSixLearnings: ['El checklist dio seguridad al subgerente para cerrar autónomamente.'],
          recommendationsForAutonomy: ['Repetir el esquema en la apertura del lunes.'],
        },
        {
          identifiedSkills: [
            'Pensamiento Estratégico y Visión de Negocio',
            'Motivación y Desarrollo del Equipo',
          ],
          skillsReconsideration: {
            reactivate: [
              {
                skill: 'Pensamiento Estratégico y Visión de Negocio',
                evidence: 'Intento indebido en Etapa 7',
                newEvidenceText: 'Intento indebido en Etapa 7',
              },
            ],
          },
        }
      );

    const prodRes = await invokeProdStage7(reqBody, geminiFactory);
    const devRes = await invokeDevStage7(reqBody, geminiFactory);

    for (const r of [prodRes, devRes]) {
      assert.equal(r.statusCode, 200);
      assert.deepEqual(r.body.data.identifiedSkills, []);
      assert.equal(r.body.data.skillEntries.length, 2);
      const disc = r.body.data.skillEntries.find(
        (e: any) => e.cluster === 'pensamiento_estrategico'
      );
      assert.equal(disc.status, 'descartada');
      assert.equal(r.body.data.finalFeedback.stageTwoSkills.length, 1);
      assert.match(
        r.body.data.finalFeedback.stageTwoSkills[0],
        /Delegación Efectiva y Empoderamiento — Evidencia en experiencia laboral \(Etapa 2\):/
      );
      assert.deepEqual(r.body.data.finalFeedback.detectedStrengths, [
        'Disposición para definir criterios observables de cierre antes de delegar',
      ]);
    }

    // Flujo transaccional completo de cliente también calibra y preserva integridad
    let sessions = [sessionActive];
    const notifications: NotificationItem[] = [];
    const emailedReports: FinalFeedbackReport[] = [];
    const opsMap = new Map<string, CaseOperationKind>();

    const ok = await executeTransactionalStageTransition({
      activeCaseId: sessionActive.id,
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
            reply: 'Cierre completado con coherencia de fortalezas y habilidades.',
            data: prodRes.body.data,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        ),
    });

    assert.equal(ok, true);
    assert.deepEqual(sessions[0].finalFeedbackReport?.detectedStrengths, [
      'Disposición para definir criterios observables de cierre antes de delegar',
    ]);
    assert.deepEqual(emailedReports[0]?.detectedStrengths, [
      'Disposición para definir criterios observables de cierre antes de delegar',
    ]);
    assert.equal(sessions[0].skillEntries?.length, 2);
    assert.deepEqual(sessions[0].identifiedSkills, [delegationSkillEntry.skill]);
  });
});
