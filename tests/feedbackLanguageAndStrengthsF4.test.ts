import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import respondHandler, {
  buildFeedbackLanguageLocalRule as prodBuildFeedbackLanguageLocalRule,
  calibrateStage7DetectedStrengths as prodCalibrateStage7DetectedStrengths,
  generateContextualCoachReply,
} from '../api/mentor/respond';
import { generateDeterministicCoaching } from '../server';
import {
  buildFeedbackLanguageLocalRule,
  calibrateStage7DetectedStrengths,
} from '../src/utils/skillsConsolidator';
import { buildStage7FinalFeedbackReport } from '../src/context/LidactaContext';
import { getStageTriggerQuestion } from '../src/utils/stageQuestions';
import { LeadershipSkillEntry } from '../src/types/lidacta';

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

async function invokeProd(
  reqBody: any,
  geminiResponseFactory: (url: string, init?: any) => Response | Promise<Response>
) {
  const originalFetch = globalThis.fetch;
  const prevKey = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = 'dummy-f4-prod-key';
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
  }
}

async function invokeDev(
  reqBody: any,
  geminiResponseFactory: (url: string, init?: any) => Response | Promise<Response>
) {
  const originalFetch = globalThis.fetch;
  const prevKey = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = 'dummy-f4-dev-key';

  const modUrl = new URL(`../server.ts?f4=${Date.now()}-${Math.random()}`, import.meta.url).href;
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
  }
}

function makeGeminiJsonResponse(payload: Record<string, unknown>) {
  return new Response(
    JSON.stringify({
      candidates: [
        {
          content: {
            parts: [{ text: JSON.stringify(payload) }],
          },
        },
      ],
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
}

const sampleSkillEntry: LeadershipSkillEntry = {
  skill: 'Retroalimentación Constructiva y Conversaciones Difíciles',
  cluster: 'retroalimentacion',
  status: 'vigente',
  initialStage: 2,
  lastUpdatedStage: 4,
  createdAt: '2026-04-01T10:00:00Z',
  updatedAt: '2026-04-01T10:25:00Z',
  evidenceHistory: [
    {
      id: 'ev_f4_1',
      stage: 2,
      sourceType: 'experiencia_relatada',
      evidenceText: 'Evita señalar retrasos por temor a generar incomodidad en el turno.',
      timestamp: '2026-04-01T10:10:00Z',
    },
    {
      id: 'ev_f4_2',
      stage: 4,
      sourceType: 'simulacion_practica',
      evidenceText: 'En el ensayo planteó hechos específicos del lunes y miércoles sin reproches.',
      timestamp: '2026-04-01T10:25:00Z',
    },
  ],
};

describe('Frente 4 — Fortalezas y lenguaje de retroalimentación', () => {
  it('1. Presencia y paridad de la regla local en producción y desarrollo sin alterar el System Prompt global', async () => {
    const devRule = buildFeedbackLanguageLocalRule();
    const prodRule = prodBuildFeedbackLanguageLocalRule();

    assert.equal(prodRule, devRule);
    assert.match(devRule, /REGLA LOCAL DE LENGUAJE DE RETROALIMENTACIÓN Y RECONOCIMIENTO/);
    assert.match(devRule, /Evita elogios vacíos, superlativos y aprobaciones automáticas/);
    assert.match(devRule, /Evita atribuciones generales de personalidad o carácter/);
    assert.match(devRule, /validación emocional legítima/);
    assert.match(devRule, /No fuerces reconocimientos en cada intervención/);
    assert.match(devRule, /tono humano, cálido, cercano, respetuoso y natural/);
    assert.match(
      devRule,
      /intención, una decisión elegida, una acción diseñada, una acción programada \(con fecha\) y una acción efectivamente ejecutada/
    );

    // Verificar inyección en turnos conversacionales (ej. Etapa 3) y cierre (Etapa 7), sin tocar systemPrompt global
    for (const stage of [3, 7]) {
      let prodSystemPrompt = '';
      let devSystemPrompt = '';
      let prodLocalPrompt = '';
      let devLocalPrompt = '';

      const reqBody =
        stage === 3
          ? {
              caseId: 'case_f4_parity_3',
              stage: 3,
              leaderProfile: { name: 'Lucía Paredes', position: 'Jefa de Turno' },
              companyContext: { name: 'Logística Sur' },
              conversationHistory: [
                {
                  sender: 'leader',
                  stage: 1,
                  text: 'Un coordinador entrega tarde sus cortes y me cuesta confrontarlo.',
                },
              ],
              userMessage: 'Creo que podría conversar 1 a 1 con él antes del cierre.',
              sessionData: {
                id: 'case_f4_parity_3',
                skillEntries: [sampleSkillEntry],
                identifiedSkills: [sampleSkillEntry.skill],
              },
            }
          : {
              caseId: 'case_f4_parity_7',
              stage: 7,
              leaderProfile: { name: 'Lucía Paredes', position: 'Jefa de Turno' },
              companyContext: { name: 'Logística Sur' },
              isPracticeMode: true,
              conversationHistory: [
                {
                  sender: 'leader',
                  stage: 2,
                  text: 'Postergo la retroalimentación cuando el ambiente está tenso.',
                },
              ],
              userMessage: '[Avanzando a Etapa 7]',
              sessionData: {
                id: 'case_f4_parity_7',
                skillEntries: [sampleSkillEntry],
                identifiedSkills: [sampleSkillEntry.skill],
                actionPlan: {
                  what: 'Conversar 1 a 1 con el coordinador sobre los cortes del lunes',
                  when: 'Jueves 09:00 AM',
                  isCompleted: false,
                },
                actionPlanExecutionStatus: 'not_executed',
              },
            };

      const makeMockReply = () =>
        stage === 3
          ? makeGeminiJsonResponse({
              replyText:
                'Tomar esa conversación en privado antes del cierre te permite abordar los retrasos sin exponerlo frente al equipo. ¿Qué reacción esperas de su parte?',
              readyToAdvance: false,
              advancePrompt: null,
              identifiedSkills: [],
            })
          : makeGeminiJsonResponse({
              replyText: 'Cierre sintetizado con base en la evidencia disponible de la sesión.',
              readyToAdvance: false,
              advancePrompt: null,
              identifiedSkills: [],
              finalFeedback: {
                detectedStrengths: [
                  'En la simulación estructuró hechos específicos del lunes y miércoles sin reproches',
                ],
                stageTwoSkills: [sampleSkillEntry.skill],
                chosenActions: [],
                stageSixLearnings: [],
                recommendationsForAutonomy: [
                  'Sostener la conversación agendada para el jueves a las 09:00 AM.',
                ],
              },
            });

      const prodRes = await invokeProd(reqBody, (_url, init) => {
        const parsed = JSON.parse(String(init?.body || '{}'));
        prodSystemPrompt = parsed?.systemInstruction?.parts?.[0]?.text || '';
        prodLocalPrompt = parsed?.contents?.[parsed.contents.length - 1]?.parts?.[0]?.text || '';
        return makeMockReply();
      });

      const devRes = await invokeDev(reqBody, (_url, init) => {
        const parsed = JSON.parse(String(init?.body || '{}'));
        devSystemPrompt = parsed?.systemInstruction?.parts?.[0]?.text || '';
        devLocalPrompt = parsed?.contents?.[parsed.contents.length - 1]?.parts?.[0]?.text || '';
        return makeMockReply();
      });

      assert.equal(prodRes.statusCode, 200);
      assert.equal(devRes.statusCode, 200);

      // La regla local debe estar presente únicamente en el prompt local, no en el System Prompt global
      assert.ok(!prodSystemPrompt.includes('REGLA LOCAL DE LENGUAJE DE RETROALIMENTACIÓN'));
      assert.ok(!devSystemPrompt.includes('REGLA LOCAL DE LENGUAJE DE RETROALIMENTACIÓN'));
      assert.ok(prodLocalPrompt.includes(prodRule));
      assert.ok(devLocalPrompt.includes(devRule));
    }
  });

  it('2. Ausencia de elogios genéricos y atribuciones personales no sustentadas en las plantillas determinísticas modificadas', () => {
    const forbiddenPattern =
      /excelente nivel de autoconciencia|liderazgo maduro|gran capacidad para pasar de la duda a la acci[oó]n decidida|^perfecto,|^muy bien(?:\s+planteado)?,/i;

    // 2a. server.ts Etapa 2 con habilidades ya identificadas
    const devStage2 = generateDeterministicCoaching({
      stage: 2,
      leaderProfile: { name: 'Lucía Paredes', position: 'Jefa de Turno' },
      companyContext: { name: 'Logística Sur' },
      userMessage: 'Reconozco que he dejado pasar los retrasos para evitar fricción.',
      conversationHistory: [],
      sessionData: {
        id: 'case_f4_tpl_2',
        skillEntries: [sampleSkillEntry],
        identifiedSkills: [sampleSkillEntry.skill],
      },
    });
    assert.ok(!forbiddenPattern.test(devStage2.replyText));
    assert.match(devStage2.replyText, /Gracias por compartir esa reflexión/i);
    assert.match(devStage2.replyText, /evitar fricción/i);
    assert.equal(devStage2.readyToAdvance, true);

    // 2b. Etapa 3 (1 alternativa, 2+ alternativas, selección explícita) en Prod y Dev
    const stage3History = [
      {
        sender: 'lidacta',
        role: 'model',
        stage: 3,
        text: 'Para diseñar las posibles salidas, Lucía, quiero escucharte a ti primero...',
      },
    ];

    const oneAltMsg = '1. Hablar en privado con Carlos para acordar horario fijo.';
    const twoAltsMsg =
      '1. Hablar en privado con Carlos para acordar horario fijo. 2. Implementar un tablero semanal los miércoles.';
    const selectMsg = 'Me quedo con la primera opción de hablar en privado con Carlos.';

    for (const [msg, hist] of [
      [oneAltMsg, stage3History],
      [twoAltsMsg, stage3History],
      [
        selectMsg,
        [
          ...stage3History,
          { sender: 'leader', role: 'user', stage: 3, text: twoAltsMsg },
        ],
      ],
    ] as const) {
      const prodOut = generateContextualCoachReply(
        3,
        'Lucía',
        msg,
        hist as any,
        { leaderAlternatives: [] }
      );
      const devOut = generateDeterministicCoaching({
        stage: 3,
        leaderProfile: { name: 'Lucía Paredes', position: 'Jefa de Turno' },
        companyContext: { name: 'Logística Sur' },
        userMessage: msg,
        conversationHistory: hist as any,
        sessionData: { id: 'case_f4_tpl_3', leaderAlternatives: [] },
      });

      for (const reply of [prodOut.replyText, devOut.replyText]) {
        assert.ok(!forbiddenPattern.test(reply), `Plantilla Etapa 3 contiene elogio prohibido: ${reply}`);
      }
      if (msg === selectMsg) {
        assert.ok(devOut.replyText.includes('tú eres quien decide y conduce la acción'));
      }
    }

    // 2c. Etapa 7 determinística en Prod y Dev (sin afirmar ejecución)
    const prodStage7 = generateContextualCoachReply(
      7,
      'Lucía',
      '[Avanzando a Etapa 7]',
      [],
      { skillEntries: [sampleSkillEntry], actionPlanExecutionStatus: 'not_executed' }
    );
    const devStage7 = generateDeterministicCoaching({
      stage: 7,
      leaderProfile: { name: 'Lucía Paredes', position: 'Jefa de Turno' },
      companyContext: { name: 'Logística Sur' },
      userMessage: '[Avanzando a Etapa 7]',
      conversationHistory: [],
      sessionData: {
        id: 'case_f4_tpl_7',
        skillEntries: [sampleSkillEntry],
        actionPlanExecutionStatus: 'not_executed',
      },
    });

    for (const reply of [prodStage7.replyText, devStage7.replyText]) {
      assert.ok(!forbiddenPattern.test(reply));
      assert.match(reply, /ordenando los hechos de tu caso, reflexionando sobre las habilidades en juego y diseñando pasos concretos/i);
      assert.ok(!/gran capacidad/i.test(reply));
      assert.ok(!/acci[oó]n decidida/i.test(reply));
    }
  });

  it('3. Descarta atribuciones personales vacías y sustantivos abstractos aislados en detectedStrengths', async () => {
    const emptyTraitsAndAbstracts = [
      'Demuestras una gran madurez',
      'Has mostrado mucha valentía',
      'Es una excelente decisión',
      'Gran temple y carácter ejemplar',
      'Excelente criterio personal',
      'Liderazgo maduro',
      'Apertura y honestidad en la sesión',
      'Autoconciencia durante el acompañamiento',
      'Honestidad',
    ];

    const calibrationCtx = {
      skillEntries: [sampleSkillEntry],
      identifiedSkills: [sampleSkillEntry.skill],
      conversationHistory: [
        {
          sender: 'leader',
          stage: 2,
          text: 'Evito señalar los retrasos porque temo que se moleste.',
        },
      ],
      actionPlan: {
        what: 'Conversar 1 a 1 con el colaborador el jueves',
        when: 'Jueves 09:00 AM',
        isCompleted: false,
      },
      actionPlanExecutionStatus: 'not_executed',
    };

    const devCalibrated = calibrateStage7DetectedStrengths(emptyTraitsAndAbstracts, calibrationCtx);
    const prodCalibrated = prodCalibrateStage7DetectedStrengths(
      emptyTraitsAndAbstracts,
      calibrationCtx
    );
    assert.deepEqual(devCalibrated, []);
    assert.deepEqual(prodCalibrated, []);

    // Paridad end-to-end prod/dev/cliente
    const reqBody = {
      caseId: 'case_f4_discard_3',
      stage: 7,
      leaderProfile: { name: 'Lucía Paredes', position: 'Jefa de Turno' },
      companyContext: { name: 'Logística Sur' },
      conversationHistory: calibrationCtx.conversationHistory,
      userMessage: '[Avanzando a Etapa 7]',
      sessionData: {
        id: 'case_f4_discard_3',
        skillEntries: [sampleSkillEntry],
        identifiedSkills: [sampleSkillEntry.skill],
        actionPlan: calibrationCtx.actionPlan,
        actionPlanExecutionStatus: 'not_executed',
      },
    };

    const geminiFactory = () =>
      makeGeminiJsonResponse({
        replyText: 'Cierre de acompañamiento con foco en hechos y acuerdos pendientes.',
        readyToAdvance: false,
        advancePrompt: null,
        identifiedSkills: [],
        finalFeedback: {
          detectedStrengths: emptyTraitsAndAbstracts,
          stageTwoSkills: [sampleSkillEntry.skill],
          chosenActions: [],
          stageSixLearnings: [],
          recommendationsForAutonomy: ['Preparar dos hechos observables antes de la charla del jueves.'],
        },
      });

    const prodRes = await invokeProd(reqBody, geminiFactory);
    const devRes = await invokeDev(reqBody, geminiFactory);
    assert.equal(prodRes.statusCode, 200);
    assert.equal(devRes.statusCode, 200);
    assert.deepEqual(prodRes.body.data.finalFeedback.detectedStrengths, []);
    assert.deepEqual(devRes.body.data.finalFeedback.detectedStrengths, []);

    const clientBuilt = buildStage7FinalFeedbackReport(
      prodRes.body.data.finalFeedback,
      [sampleSkillEntry],
      [sampleSkillEntry.skill],
      '2026-04-01T12:00:00.000Z',
      {
        actionPlan: calibrationCtx.actionPlan,
        actionPlanExecutionStatus: 'not_executed',
        conversationHistory: calibrationCtx.conversationHistory,
      }
    );
    assert.ok(clientBuilt);
    assert.deepEqual(clientBuilt.detectedStrengths, []);
  });

  it('4. Conserva conductas observables concretas cuando se acompañan de expresiones valorativas', () => {
    const mixedInputs = [
      'Demuestra gran madurez al reconocer que evitó la conversación por temor al conflicto',
      'Es una excelente decisión acordar un horario fijo de entrega con el coordinador',
      'Gran valentía: planteó en la simulación los tres retrasos sin tono punitivo',
      'Gran temple cuando pausó la reacción impulsiva y escuchó la versión del coordinador',
    ];

    const ctx = {
      skillEntries: [sampleSkillEntry],
      identifiedSkills: [sampleSkillEntry.skill],
      isPracticeMode: true,
      conversationHistory: [
        {
          sender: 'leader',
          stage: 2,
          text: 'Reconozco que evité la conversación por temor a generar conflicto.',
        },
        {
          sender: 'leader',
          stage: 4,
          text: 'En la simulación le mencionaría los tres retrasos sin reclamos.',
        },
      ],
      actionPlan: {
        what: 'Acordar horario fijo de entrega con el coordinador',
        when: 'Lunes 09:00 AM',
        isCompleted: false,
      },
      actionPlanExecutionStatus: 'not_executed',
    };

    const devOut = calibrateStage7DetectedStrengths(mixedInputs, ctx);
    const prodOut = prodCalibrateStage7DetectedStrengths(mixedInputs, ctx);

    assert.deepEqual(devOut, prodOut);
    assert.deepEqual(devOut, [
      'Disposición observada al reconocer que evitó la conversación por temor al conflicto',
      'Acordar un horario fijo de entrega con el coordinador',
      'Planteó en la simulación los tres retrasos sin tono punitivo',
      'Pausó la reacción impulsiva y escuchó la versión del coordinador',
    ]);
    for (const item of devOut) {
      assert.ok(!/gran madurez|excelente decisi[oó]n|gran valent[ií]a|gran temple/i.test(item));
    }
  });

  it('5. Conserva reconocimientos válidos de proceso del Bloque 3B.2 sustentados en conductas concretas', () => {
    const validProcessStrengths = [
      'Apertura para recibir retroalimentación durante el acompañamiento sin ponerse a la defensiva',
      'Autoconciencia para identificar su propia frustración antes de responder al equipo',
      'Honestidad para reconocer hábitos propios que alimentan la dependencia del equipo',
      'Disposición para definir criterios observables de cierre antes de delegar',
    ];

    const ctx = {
      skillEntries: [sampleSkillEntry],
      identifiedSkills: [sampleSkillEntry.skill],
      conversationHistory: [
        {
          sender: 'leader',
          stage: 2,
          text: 'Noto que mi frustración me lleva a intervenir antes de escuchar.',
        },
      ],
      actionPlan: {
        what: 'Definir criterios de cierre antes de delegar',
        when: 'Martes 10:00 AM',
        isCompleted: false,
      },
      actionPlanExecutionStatus: 'not_executed',
    };

    const devOut = calibrateStage7DetectedStrengths(validProcessStrengths, ctx);
    const prodOut = prodCalibrateStage7DetectedStrengths(validProcessStrengths, ctx);

    assert.deepEqual(devOut, validProcessStrengths);
    assert.deepEqual(prodOut, validProcessStrengths);
  });

  it('6. Impide atribuciones de ejecución o resultados cuando el plan sigue pendiente o no ejecutado, incluso mezcladas con elogios', () => {
    const unexecutedOverclaims = [
      'Excelente decisión al ejecutar con éxito la reunión en piso logrando resultados positivos',
      'Demuestra gran madurez porque ya implementó el plan en su área resolviendo el conflicto',
      'En la simulación definió dos hechos concretos sin emitir juicios personales',
    ];

    const ctx = {
      skillEntries: [sampleSkillEntry],
      identifiedSkills: [sampleSkillEntry.skill],
      isPracticeMode: true,
      conversationHistory: [
        {
          sender: 'leader',
          stage: 4,
          text: 'En el ensayo definí dos hechos concretos de la semana.',
        },
        {
          sender: 'leader',
          stage: 6,
          text: 'Aún no he podido ejecutar la reunión porque se cruzó auditoría.',
        },
      ],
      actionPlan: {
        what: 'Sostener reunión 1 a 1 con hechos concretos',
        when: 'Viernes 09:00 AM',
        isCompleted: false,
      },
      actionPlanExecutionStatus: 'not_executed',
    };

    const devOut = calibrateStage7DetectedStrengths(unexecutedOverclaims, ctx);
    const prodOut = prodCalibrateStage7DetectedStrengths(unexecutedOverclaims, ctx);

    assert.deepEqual(devOut, [
      'En la simulación definió dos hechos concretos sin emitir juicios personales',
    ]);
    assert.deepEqual(prodOut, devOut);
  });

  it('7. La pregunta inicial de Etapa 7 funciona tanto con planes ejecutados como con planes no ejecutados o pendientes', () => {
    const triggerExecuted = getStageTriggerQuestion(
      7,
      {
        id: 'case_exec',
        title: 'Acuerdos de entrega',
        identifiedSkills: [sampleSkillEntry.skill],
      },
      'Lucía Paredes'
    );
    const triggerPending = getStageTriggerQuestion(
      7,
      {
        id: 'case_pend',
        title: 'Conversación pendiente',
        identifiedSkills: [sampleSkillEntry.skill],
      },
      'Lucía Paredes'
    );

    assert.equal(triggerExecuted, triggerPending);
    assert.ok(!/habilidades que has puesto en pr[aá]ctica/i.test(triggerPending));
    assert.ok(!/ya ejecutaste/i.test(triggerPending));
    assert.match(triggerPending, /Etapa 7 \(Cierre y retroalimentación\)/);
    assert.match(triggerPending, /estado real de tu plan/i);
    assert.match(triggerPending, /habilidades identificadas para fortalecer/i);
  });
});
