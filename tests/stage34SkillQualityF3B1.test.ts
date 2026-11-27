import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import respondHandler from '../api/mentor/respond';
import {
  buildStage34EvidenceContext,
  consolidateSkillEntries,
  getActiveSkillEntries,
  getActiveSkillNames,
  isValidReconsiderationJustification,
  isValidStage34ContextualEvidence,
} from '../src/utils/skillsConsolidator';
import { LeadershipSkillEntry, UserProfile } from '../src/types/lidacta';

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

async function invokeProdHandler(
  reqBody: any,
  geminiResponseFactory: (url: string, init?: any) => Response | Promise<Response>,
  apiKey: string | null = 'dummy-f3b1-prod-key'
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

async function invokeDevServer(
  reqBody: any,
  geminiResponseFactory: (url: string, init?: any) => Response | Promise<Response>,
  apiKey: string | null = 'dummy-f3b1-dev-key'
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

  const modUrl = new URL(`../server.ts?f3b1=${Date.now()}-${Math.random()}`, import.meta.url).href;
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

function makeGeminiJsonResponse(payload: {
  replyText?: string;
  readyToAdvance?: boolean;
  advancePrompt?: string | null;
  identifiedSkills?: any[];
  skillsReconsideration?: any;
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
                    payload.replyText ??
                    'Revisemos cómo se conecta esto con tu desafío y las opciones que ves.',
                  readyToAdvance: payload.readyToAdvance ?? false,
                  advancePrompt: payload.advancePrompt ?? null,
                  identifiedSkills: payload.identifiedSkills ?? [],
                  ...(payload.skillsReconsideration
                    ? { skillsReconsideration: payload.skillsReconsideration }
                    : {}),
                  detectedTheme: 'Liderazgo',
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
  id: 'leader_f3b1',
  name: 'Sofía Méndez',
  email: 'sofia@empresa.com',
  role: 'leader',
  companyId: 'comp_f3b1',
  companyName: 'Logística del Norte',
  position: 'Gerente de Operaciones',
  area: 'Logística',
  directReports: 12,
  createdAt: '2026-11-20T09:00:00Z',
};

const baseCompanyContext = {
  id: 'comp_f3b1',
  name: 'Logística del Norte',
  industry: 'Distribución',
};

const baseStage123History = [
  {
    id: 'm1',
    sender: 'leader',
    stage: 1,
    text: 'Mi coordinador Marcos entrega tarde los cortes diarios y cuando algo urge termino haciendo yo sus reportes para evitar roces.',
  },
  {
    id: 'm2',
    sender: 'lidacta',
    stage: 1,
    text: 'Entiendo la carga operativa que te genera absorber sus pendientes.',
  },
  {
    id: 'm3',
    sender: 'leader',
    stage: 2,
    text: 'Me da temor que se ponga a la defensiva si lo confronto y por eso prefiero resolverlo yo sola.',
  },
  {
    id: 'm4',
    sender: 'lidacta',
    stage: 2,
    text: 'Ahí aparece tanto la conversación postergada como la tendencia a absorber su tarea.',
  },
  {
    id: 'm5',
    sender: 'leader',
    stage: 3,
    text: 'Cuando reviso mis alternativas veo que siempre termino aprobando cambios urgentes de último minuto sin consultar si alguien más puede cubrirlos, y me saturo.',
  },
];

function makeExistingSkillEntry(
  overrides: Partial<LeadershipSkillEntry> & Pick<LeadershipSkillEntry, 'skill' | 'cluster'>
): LeadershipSkillEntry {
  return {
    status: 'vigente',
    initialStage: 2,
    evidenceHistory: [
      {
        id: 'ev-init-1',
        stage: 2,
        sourceType: 'experiencia_relatada',
        evidenceText: 'Evitó hablar con Marcos por temor a que se ponga a la defensiva.',
        timestamp: '2026-11-20T10:00:00Z',
      },
    ],
    reconsiderationHistory: [],
    lastUpdatedStage: 2,
    createdAt: '2026-11-20T10:00:00Z',
    updatedAt: '2026-11-20T10:00:00Z',
    ...overrides,
  };
}

describe('Frente 3 Bloque 3B.1 — Calidad y trazabilidad del diagnóstico de habilidades en Etapas 3 y 4', () => {
  it('1. Rechaza habilidades nuevas propuestas sin evidencia suficiente en Etapa 3', () => {
    const existing = [
      makeExistingSkillEntry({
        skill: 'Comunicación Asertiva y Firmeza Empática',
        cluster: 'comunicacion',
      }),
    ];

    const stage3Context = buildStage34EvidenceContext({
      caseTitle: 'Retrasos en entregas de almacén',
      initialChallenge: 'Marcos entrega tarde los cortes diarios y absorbo sus pendientes.',
      history: baseStage123History,
      latestUserMessage: 'Estoy evaluando cómo hablar con él sin absorber su reporte.',
      currentStage: 3,
    });

    const updated = consolidateSkillEntries(
      existing,
      [
        'Pensamiento Estratégico y Priorización', // string sin evidencia
        { skill: 'Motivación y Desarrollo de Equipos', evidenceText: '' }, // evidencia vacía
        {
          skill: 'Inteligencia y Regulación Emocional',
          evidenceText: 'Seguramente le falta inteligencia emocional en su puesto', // especulativa
        },
        {
          skill: 'Gestión y Clarificación de Acuerdos',
          evidenceText: 'Retrasos en entregas de almacén', // solo repite el título
        },
        {
          skill: 'Finanzas Corporativas',
          evidenceText: 'No domina estados financieros contables ante accionistas', // ajeno sin sustento en el caso
        },
      ],
      3,
      undefined,
      '2026-11-27T12:00:00Z',
      { requireEvidenceInStages34: true, stage34EvidenceContext: stage3Context }
    );

    assert.deepEqual(getActiveSkillNames(updated), ['Comunicación Asertiva y Firmeza Empática']);
    assert.equal(updated.length, 1);
  });

  it('2. Rechaza habilidades nuevas propuestas sin evidencia suficiente en Etapa 4', () => {
    const existing = [
      makeExistingSkillEntry({
        skill: 'Comunicación Asertiva y Firmeza Empática',
        cluster: 'comunicacion',
      }),
    ];

    const stage4Context = buildStage34EvidenceContext({
      caseTitle: 'Retrasos en entregas de almacén',
      initialChallenge: 'Marcos entrega tarde los cortes diarios.',
      history: [
        ...baseStage123History,
        {
          id: 'm6',
          sender: 'leader',
          stage: 4,
          text: 'Marcos, necesito que revisemos juntos la hora de corte de los reportes diarios.',
        },
      ],
      latestUserMessage: '¿Qué te parece si acordamos entregarlo antes de las 4 pm?',
      currentStage: 4,
    });

    const updated = consolidateSkillEntries(
      existing,
      [
        'Resolución Constructiva de Conflictos',
        { skill: 'Motivación y Desarrollo de Equipos', evidenceText: 'Sin evidencia suficiente en el caso' },
        { skill: 'Pensamiento Estratégico y Priorización', evidenceText: 'Probablemente requiere priorizar mejor' },
        { skill: 'Competencia Directiva General', evidenceText: 'Es importante mejorar esta habilidad en general' },
      ],
      4,
      undefined,
      '2026-11-27T12:10:00Z',
      { requireEvidenceInStages34: true, stage34EvidenceContext: stage4Context }
    );

    assert.deepEqual(getActiveSkillNames(updated), ['Comunicación Asertiva y Firmeza Empática']);
    assert.equal(updated.length, 1);
  });

  it('3. Conserva y consolida habilidades cuando aparece evidencia contextual pertinente con paráfrasis o vocabulario distinto', () => {
    const existing = [
      makeExistingSkillEntry({
        skill: 'Comunicación Asertiva y Firmeza Empática',
        cluster: 'comunicacion',
      }),
    ];

    const stage3Context = buildStage34EvidenceContext({
      caseTitle: 'Retrasos en entregas de almacén',
      initialChallenge: 'Marcos entrega tarde los cortes diarios y termino haciéndolos yo.',
      history: baseStage123History,
      latestUserMessage:
        'Me doy cuenta de que siempre termino aprobando cambios de último minuto sin consultar si alguien más puede cubrirlos.',
      currentStage: 3,
    });

    // Paráfrasis con vocabulario distinto: "centraliza las decisiones operativas" en vez de "haciendo sus reportes / aprobando cambios"
    const paraphraseEvidence =
      'Centraliza las decisiones operativas de cierre en lugar de distribuir responsabilidades entre su personal.';
    assert.equal(isValidStage34ContextualEvidence(paraphraseEvidence, stage3Context), true);

    // También habilidad personalizada fuera de los 9 clústeres canónicos
    const customSkillEvidence =
      'Durante la revisión de opciones aceptó que asume cargas operativas urgentes sin redistribuir turnos.';

    const updated = consolidateSkillEntries(
      existing,
      [
        {
          skill: 'Delegación Efectiva y Empoderamiento',
          evidenceText: paraphraseEvidence,
        },
        {
          skill: 'Balanceo Operativo de Cargas de Turno',
          evidenceText: customSkillEvidence,
        },
      ],
      3,
      undefined,
      '2026-11-27T12:20:00Z',
      { requireEvidenceInStages34: true, stage34EvidenceContext: stage3Context }
    );

    const activeNames = getActiveSkillNames(updated);
    assert.ok(activeNames.includes('Comunicación Asertiva y Firmeza Empática'));
    assert.ok(activeNames.includes('Delegación Efectiva y Empoderamiento'));
    assert.ok(activeNames.includes('Balanceo Operativo de Cargas de Turno'));
    assert.equal(updated.length, 3);
    assert.equal(updated[1].evidenceHistory[0].sourceType, 'experiencia_relatada');
    assert.equal(updated[2].cluster, 'balanceo operativo de cargas de turno');
  });

  it('4. Registra correctamente simulacion_practica en Etapa 4 y acepta paráfrasis de comportamiento simulado', () => {
    const existing = [
      makeExistingSkillEntry({
        skill: 'Comunicación Asertiva y Firmeza Empática',
        cluster: 'comunicacion',
      }),
    ];

    const stage4Context = buildStage34EvidenceContext({
      caseTitle: 'Retrasos en entregas de almacén',
      initialChallenge: 'Marcos entrega tarde los cortes diarios.',
      history: baseStage123History,
      latestUserMessage:
        'Mira Marcos, ya no hay margen para explicaciones, a partir de mañana haces exactamente lo que te puse en el correo o tendré que escalarlo con Dirección.',
      currentStage: 4,
    });

    const updated = consolidateSkillEntries(
      existing,
      [
        {
          skill: 'Escucha Activa e Indagación',
          // Paráfrasis sin coincidencia literal con palabras de la simulación
          evidenceText:
            'En el ensayo de conversación adoptó un tono punitivo y ultimátum en lugar de indagar causas o abrir diálogo.',
          // Aunque el payload intente marcar experiencia_relatada, el motor debe forzar simulacion_practica en Etapa 4
          sourceType: 'experiencia_relatada',
        },
      ],
      4,
      undefined,
      '2026-11-27T12:30:00Z',
      { requireEvidenceInStages34: true, stage34EvidenceContext: stage4Context }
    );

    const listening = updated.find((e) => e.cluster === 'escucha');
    assert.ok(listening);
    assert.equal(listening.status, 'vigente');
    assert.equal(listening.initialStage, 4);
    assert.equal(listening.evidenceHistory.length, 1);
    assert.equal(listening.evidenceHistory[0].stage, 4);
    assert.equal(listening.evidenceHistory[0].sourceType, 'simulacion_practica');
  });

  it('5. Ejecuta discard justificado sobre habilidad personalizada mediante coincidencia por nombre normalizado aunque el clúster difiera', () => {
    const customEntry = makeExistingSkillEntry({
      skill: 'Negociación con Sindicato Local',
      cluster: 'custom_legacy_cluster_1', // clúster distinto al generado por mapToCanonicalSkill
      evidenceHistory: [
        {
          id: 'ev-custom-1',
          stage: 2,
          sourceType: 'experiencia_relatada',
          evidenceText: 'Mencionó tensiones con representantes sindicales en el turno nocturno.',
          timestamp: '2026-11-27T10:00:00Z',
        },
      ],
    });

    const stage3Context = buildStage34EvidenceContext({
      caseTitle: 'Ajuste de turnos en planta',
      initialChallenge: 'Tensiones por el cambio de turnos y tabulador.',
      history: [
        {
          sender: 'leader',
          stage: 3,
          text: 'En realidad, el líder aclaró que el acuerdo sindical lo maneja exclusivamente Relaciones Laborales corporativas y queda fuera de mi alcance.',
        },
      ],
      currentStage: 3,
    });

    const updated = consolidateSkillEntries(
      [customEntry],
      [],
      3,
      {
        discard: [
          {
            // Sin acento y en minúsculas: debe coincidir por nombre normalizado aunque el cluster guardado sea distinto
            skill: 'negociacion con sindicato local',
            evidence:
              'En Etapa 3 el líder aclaró que los acuerdos sindicales competen exclusivamente a Relaciones Laborales corporativas fuera de su alcance.',
          },
        ],
      },
      '2026-11-27T12:40:00Z',
      { requireEvidenceInStages34: true, stage34EvidenceContext: stage3Context }
    );

    assert.equal(updated.length, 1);
    assert.equal(updated[0].status, 'descartada');
    assert.deepEqual(getActiveSkillNames(updated), []);
    assert.equal(updated[0].evidenceHistory.length, 1);
    assert.equal(updated[0].reconsiderationHistory?.length, 1);
  });

  it('6. Ejecuta replace válido cuando la habilidad origen existe y está activa', () => {
    const existing = [
      makeExistingSkillEntry({
        skill: 'Comunicación Asertiva y Firmeza Empática',
        cluster: 'comunicacion',
      }),
    ];

    const stage3Context = buildStage34EvidenceContext({
      caseTitle: 'Retrasos en entregas de almacén',
      initialChallenge: 'Marcos entrega tarde los cortes diarios.',
      history: [
        ...baseStage123History,
        {
          sender: 'leader',
          stage: 3,
          text: 'Pensándolo bien sí le dije que era importante, pero nunca fijamos una hora límite escrita ni revisamos criterios de seguimiento.',
        },
      ],
      currentStage: 3,
    });

    const updated = consolidateSkillEntries(
      existing,
      [],
      3,
      {
        replace: [
          {
            from: 'Comunicación Asertiva y Firmeza Empática',
            to: 'Gestión y Clarificación de Acuerdos',
            evidence:
              'El líder sí expresó la importancia del tema, pero no estableció fechas compromiso ni reglas claras de seguimiento.',
          },
        ],
      },
      '2026-11-27T12:50:00Z',
      { requireEvidenceInStages34: true, stage34EvidenceContext: stage3Context }
    );

    const oldEntry = updated.find((e) => e.cluster === 'comunicacion');
    const newEntry = updated.find((e) => e.cluster === 'acuerdos');
    assert.ok(oldEntry);
    assert.ok(newEntry);
    assert.equal(oldEntry.status, 'sustituida');
    assert.equal(newEntry.status, 'precisada');
    assert.equal(oldEntry.reconsiderationHistory?.[0]?.replacedBySkill, 'Gestión y Clarificación de Acuerdos');
    assert.equal(newEntry.reconsiderationHistory?.[0]?.replacesSkill, 'Comunicación Asertiva y Firmeza Empática');
    assert.deepEqual(getActiveSkillNames(updated), ['Gestión y Clarificación de Acuerdos']);
  });

  it('7. Rechaza replace cuando la habilidad origen NO existe o no está activa', () => {
    const discardedSource = makeExistingSkillEntry({
      skill: 'Resolución Constructiva de Conflictos',
      cluster: 'conflicto',
      status: 'descartada',
      reconsiderationHistory: [
        {
          stage: 3,
          reconsiderationReason: 'Descartada previamente por causa presupuestaria externa.',
          timestamp: '2026-11-27T11:00:00Z',
        },
      ],
    });

    const activeOther = makeExistingSkillEntry({
      skill: 'Comunicación Asertiva y Firmeza Empática',
      cluster: 'comunicacion',
    });

    const stage3Context = buildStage34EvidenceContext({
      caseTitle: 'Retrasos en entregas de almacén',
      initialChallenge: 'Marcos entrega tarde los cortes diarios.',
      history: baseStage123History,
      currentStage: 3,
    });

    const updated = consolidateSkillEntries(
      [discardedSource, activeOther],
      [],
      3,
      {
        replace: [
          {
            // Origen inexistente en la sesión
            from: 'Delegación Efectiva y Empoderamiento',
            to: 'Pensamiento Estratégico y Priorización',
            evidence: 'El líder absorbe decisiones operativas de cierre sin distribuir pendientes.',
          },
          {
            // Origen existente pero inactivo (descartada)
            from: 'Resolución Constructiva de Conflictos',
            to: 'Retroalimentación Basada en Hechos',
            evidence: 'Durante la conversación dio señalamientos generales sobre las entregas de Marcos.',
          },
        ],
      },
      '2026-11-27T13:00:00Z',
      { requireEvidenceInStages34: true, stage34EvidenceContext: stage3Context }
    );

    // Ninguno de los dos replace debe crear habilidades destino ni alterar la sesión
    assert.equal(updated.find((e) => e.cluster === 'estrategia'), undefined);
    assert.equal(updated.find((e) => e.cluster === 'retroalimentacion'), undefined);
    assert.deepEqual(getActiveSkillNames(updated), ['Comunicación Asertiva y Firmeza Empática']);
  });

  it('8. Rechaza reactivación de habilidad descartada sin nueva evidencia (ni por mención casual ni reactivate sin evidencia nueva)', () => {
    const discardedEntry = makeExistingSkillEntry({
      skill: 'Delegación Efectiva y Empoderamiento',
      cluster: 'delegacion',
      status: 'descartada',
      evidenceHistory: [
        {
          id: 'ev-del-1',
          stage: 2,
          sourceType: 'experiencia_relatada',
          evidenceText: 'Terminó elaborando los reportes semanales de Marcos cuando hubo urgencia.',
          timestamp: '2026-11-27T10:00:00Z',
        },
      ],
      reconsiderationHistory: [
        {
          stage: 3,
          reconsiderationReason: 'El líder aclaró que fue una contingencia única por incapacidad médica.',
          timestamp: '2026-11-27T11:00:00Z',
        },
      ],
    });

    const stage4Context = buildStage34EvidenceContext({
      caseTitle: 'Retrasos en entregas de almacén',
      initialChallenge: 'Marcos entrega tarde los cortes diarios.',
      history: baseStage123History,
      latestUserMessage: 'Practiquemos la conversación de acuerdos con Marcos.',
      currentStage: 4,
    });

    // Intento A: mención casual en incomingCandidates + intento B: reactivate sin newEvidenceText + intento C: reactivate repitiendo evidencia vieja
    const updated = consolidateSkillEntries(
      [discardedEntry],
      [
        {
          skill: 'Delegación Efectiva y Empoderamiento',
          evidenceText: 'En el ensayo volvió a mencionar los reportes de Marcos.',
        },
      ],
      4,
      {
        reactivate: [
          {
            skill: 'Delegación Efectiva y Empoderamiento',
            evidence: 'Conviene retomarla porque en la práctica sigue siendo relevante para los reportes.',
            newEvidenceText: '',
          },
          {
            skill: 'Delegación Efectiva y Empoderamiento',
            evidence: 'En la práctica el líder volvió a mencionar que hace los reportes.',
            // Repite exactamente evidencia histórica ya existente
            newEvidenceText: 'Terminó elaborando los reportes semanales de Marcos cuando hubo urgencia.',
          },
        ],
      },
      '2026-11-27T13:10:00Z',
      { requireEvidenceInStages34: true, stage34EvidenceContext: stage4Context }
    );

    assert.equal(updated.length, 1);
    assert.equal(updated[0].status, 'descartada');
    assert.deepEqual(getActiveSkillNames(updated), []);
    assert.equal(updated[0].evidenceHistory.length, 1);
    assert.equal(updated[0].reconsiderationHistory?.length, 1);
  });

  it('9. Permite recuperación válida de habilidad descartada únicamente con nueva evidencia y justificación explícita', () => {
    const discardedEntry = makeExistingSkillEntry({
      skill: 'Delegación Efectiva y Empoderamiento',
      cluster: 'delegacion',
      status: 'descartada',
      evidenceHistory: [
        {
          id: 'ev-del-1',
          stage: 2,
          sourceType: 'experiencia_relatada',
          evidenceText: 'Terminó elaborando los reportes semanales de Marcos cuando hubo urgencia.',
          timestamp: '2026-11-27T10:00:00Z',
        },
      ],
      reconsiderationHistory: [
        {
          stage: 3,
          reconsiderationReason: 'El líder aclaró que fue una contingencia única por incapacidad médica.',
          timestamp: '2026-11-27T11:00:00Z',
        },
      ],
    });

    const stage4Context = buildStage34EvidenceContext({
      caseTitle: 'Retrasos en entregas de almacén',
      initialChallenge: 'Marcos entrega tarde los cortes diarios.',
      history: baseStage123History,
      latestUserMessage:
        'Durante el roleplay: Mejor mándame el archivo en borrador y yo termino de armar y aprobar todo el cierre para no arriesgarme.',
      currentStage: 4,
    });

    const updated = consolidateSkillEntries(
      [discardedEntry],
      [],
      4,
      {
        reactivate: [
          {
            skill: 'Delegación Efectiva y Empoderamiento',
            evidence:
              'La práctica evidenció que no fue una excepción aislada: el líder vuelve a centralizar la ejecución cuando siente riesgo operativo.',
            newEvidenceText:
              'En la simulación pidió recibir el borrador para terminar de armar y aprobar todo el cierre personalmente.',
          },
        ],
      },
      '2026-11-27T13:20:00Z',
      { requireEvidenceInStages34: true, stage34EvidenceContext: stage4Context }
    );

    assert.equal(updated.length, 1);
    assert.equal(updated[0].status, 'precisada');
    assert.deepEqual(getActiveSkillNames(updated), ['Delegación Efectiva y Empoderamiento']);
    assert.equal(updated[0].evidenceHistory.length, 2);
    assert.equal(updated[0].evidenceHistory[1].sourceType, 'simulacion_practica');
    assert.equal(updated[0].reconsiderationHistory?.length, 2);
  });

  it('10. Conserva evidenceHistory y reconsiderationHistory separados y sin sobrescrituras destructivas a través de Etapas 2, 3 y 4', () => {
    const stage2Context = undefined;
    const stage2 = consolidateSkillEntries(
      [],
      [
        {
          skill: 'Comunicación Asertiva y Firmeza Empática',
          evidenceText: 'Evitó confrontar a Marcos por temor a una reacción defensiva.',
        },
      ],
      2,
      undefined,
      '2026-11-27T10:00:00Z',
      { requireEvidenceInStage2: false, stage2EvidenceContext: stage2Context }
    );

    const stage3Context = buildStage34EvidenceContext({
      caseTitle: 'Retrasos en entregas de almacén',
      initialChallenge: 'Marcos entrega tarde los cortes diarios.',
      history: [
        ...baseStage123History,
        {
          sender: 'leader',
          stage: 3,
          text: 'En realidad el horario límite nunca quedó definido en un acuerdo claro y por eso cada quien entrega cuando puede.',
        },
      ],
      currentStage: 3,
    });

    // En Etapa 3: primero descartamos Comunicación Asertiva por evidencia de contexto y consolidamos Gestión de Acuerdos
    const stage3 = consolidateSkillEntries(
      stage2,
      [
        {
          skill: 'Gestión y Clarificación de Acuerdos',
          evidenceText:
            'El líder reconoció que nunca formalizó un horario límite de corte ni reglas de seguimiento.',
        },
      ],
      3,
      {
        discard: [
          {
            skill: 'Comunicación Asertiva y Firmeza Empática',
            evidence:
              'La revisión de Etapa 3 mostró que no había evitación comunicativa sino ausencia de criterios y acuerdos operativos claros.',
          },
        ],
      },
      '2026-11-27T11:00:00Z',
      { requireEvidenceInStages34: true, stage34EvidenceContext: stage3Context }
    );

    // En Etapa 4: reactivamos Comunicación Asertiva con nueva evidencia en simulación + añadimos evidencia en simulación a Acuerdos
    const stage4Context = buildStage34EvidenceContext({
      caseTitle: 'Retrasos en entregas de almacén',
      initialChallenge: 'Marcos entrega tarde los cortes diarios.',
      history: baseStage123History,
      latestUserMessage:
        'En el ensayo: Bueno Marcos, si ves que te cuesta mucho no te preocupes, luego vemos cómo lo ajustamos aunque quede pendiente.',
      currentStage: 4,
    });

    const stage4 = consolidateSkillEntries(
      stage3,
      [
        {
          skill: 'Gestión y Clarificación de Acuerdos',
          evidenceText:
            'En la simulación dejó el horario de entrega abierto sin fecha ni responsable definido.',
        },
      ],
      4,
      {
        reactivate: [
          {
            skill: 'Comunicación Asertiva y Firmeza Empática',
            evidence:
              'Durante la simulación volvió a ceder ante la incomodidad sin sostener una postura firme.',
            newEvidenceText:
              'En el ensayo cedió diciendo que no se preocupara y dejó el ajuste abierto para evitar incomodidad.',
          },
        ],
      },
      '2026-11-27T12:00:00Z',
      { requireEvidenceInStages34: true, stage34EvidenceContext: stage4Context }
    );

    const comm = stage4.find((e) => e.cluster === 'comunicacion')!;
    const agreements = stage4.find((e) => e.cluster === 'acuerdos')!;

    assert.equal(comm.status, 'precisada');
    assert.equal(comm.evidenceHistory.length, 2);
    assert.equal(comm.evidenceHistory[0].stage, 2);
    assert.equal(comm.evidenceHistory[0].sourceType, 'experiencia_relatada');
    assert.equal(comm.evidenceHistory[1].stage, 4);
    assert.equal(comm.evidenceHistory[1].sourceType, 'simulacion_practica');

    // reconsiderationHistory conserva tanto el descarte de Etapa 3 como la reactivación de Etapa 4 sin borrar ni mezclar con evidenceHistory
    assert.equal(comm.reconsiderationHistory?.length, 2);
    assert.equal(comm.reconsiderationHistory?.[0].stage, 3);
    assert.equal(comm.reconsiderationHistory?.[1].stage, 4);
    assert.ok(
      comm.evidenceHistory.every(
        (ev) => !comm.reconsiderationHistory?.some((r) => r.reconsiderationReason === ev.evidenceText)
      )
    );

    assert.equal(agreements.evidenceHistory.length, 2);
    assert.equal(agreements.evidenceHistory[0].sourceType, 'experiencia_relatada');
    assert.equal(agreements.evidenceHistory[1].sourceType, 'simulacion_practica');
    assert.equal(agreements.reconsiderationHistory?.length, 0);
  });

  it('11. Mantiene paridad exacta entre producción (api/mentor/respond.ts) y desarrollo (server.ts) en Etapas 3 y 4', async () => {
    const initialEntries = [
      makeExistingSkillEntry({
        skill: 'Comunicación Asertiva y Firmeza Empática',
        cluster: 'comunicacion',
      }),
      makeExistingSkillEntry({
        skill: 'Negociación con Sindicato Local',
        cluster: 'custom_legacy_sindical',
      }),
    ];

    // Turno Etapa 3: Gemini intenta proponer una habilidad SIN evidencia + descarta habilidad personalizada por nombre normalizado + reemplaza skill activa
    const stage3ReqBody = {
      caseId: 'case_f3b1_parity_3',
      mentorshipId: 'case_f3b1_parity_3',
      stage: 3,
      activeStage: 3,
      leaderProfile: baseLeaderProfile,
      companyContext: baseCompanyContext,
      conversationHistory: baseStage123History,
      userMessage:
        'Aclarando el contexto, el tema sindical lo lleva Relaciones Laborales corporativas y con Marcos el problema real es que nunca fijamos acuerdos escritos ni horarios de corte.',
      sessionData: {
        id: 'case_f3b1_parity_3',
        title: 'Retrasos en entregas de almacén',
        initialChallenge: 'Marcos entrega tarde los cortes diarios y absorbo sus pendientes.',
        identifiedSkills: getActiveSkillNames(initialEntries),
        skillEntries: initialEntries,
        leaderAlternatives: ['Fijar acuerdos semanales con Marcos'],
      },
    };

    const capturedPromptsStage3: string[] = [];
    const stage3GeminiFactory = (_url: string, init?: any) => {
      if (init?.body) capturedPromptsStage3.push(String(init.body));
      return makeGeminiJsonResponse({
        replyText: 'Qué buena aclaración para enfocar el acuerdo operativo con Marcos.',
        readyToAdvance: false,
        identifiedSkills: [
          { skill: 'Pensamiento Estratégico y Priorización', evidenceText: '' }, // debe rechazarse
          {
            skill: 'Delegación Efectiva y Empoderamiento',
            evidenceText:
              'Centraliza aprobaciones urgentes de cierre en lugar de distribuir responsabilidades.',
          },
        ],
        skillsReconsideration: {
          discard: [
            {
              skill: 'negociacion con sindicato local',
              evidence:
                'El líder aclaró en Etapa 3 que lo sindical corresponde a Relaciones Laborales corporativas.',
            },
          ],
          replace: [
            {
              from: 'Comunicación Asertiva y Firmeza Empática',
              to: 'Gestión y Clarificación de Acuerdos',
              evidence:
                'El análisis mostró que nunca fijaron acuerdos escritos ni horarios de corte claros.',
            },
            {
              from: 'Motivación y Desarrollo de Equipos', // NO existe en sesión: debe rechazarse sin crear destino
              to: 'Retroalimentación Basada en Hechos',
              evidence: 'El líder comentó los retrasos de Marcos.',
            },
          ],
        },
      });
    };

    const prodStage3Res = await invokeProdHandler(stage3ReqBody, stage3GeminiFactory);
    const devStage3Res = await invokeDevServer(stage3ReqBody, stage3GeminiFactory);

    assert.equal(prodStage3Res.statusCode, 200);
    assert.equal(devStage3Res.statusCode, 200);

    // Verificar inyección de reglas locales de Etapa 3 fuera del systemPrompt global
    assert.ok(capturedPromptsStage3[0].includes('REGLA LOCAL DE ETAPA 3'));
    assert.ok(capturedPromptsStage3[1].includes('REGLA LOCAL DE ETAPA 3'));

    assert.deepEqual(
      prodStage3Res.body.data.identifiedSkills,
      devStage3Res.body.data.identifiedSkills
    );
    assert.deepEqual(prodStage3Res.body.data.identifiedSkills, [
      'Gestión y Clarificación de Acuerdos',
      'Delegación Efectiva y Empoderamiento',
    ]);
    assert.equal(
      prodStage3Res.body.data.skillEntries.find((e: LeadershipSkillEntry) => e.cluster === 'retroalimentacion'),
      undefined
    );
    assert.equal(
      devStage3Res.body.data.skillEntries.find((e: LeadershipSkillEntry) => e.cluster === 'retroalimentacion'),
      undefined
    );

    // Turno Etapa 4: comprobar regla local de Etapa 4, simulacion_practica y bloqueo de reactivación sin nueva evidencia
    const stage3Entries = prodStage3Res.body.data.skillEntries as LeadershipSkillEntry[];
    const stage4ReqBody = {
      caseId: 'case_f3b1_parity_4',
      mentorshipId: 'case_f3b1_parity_4',
      stage: 4,
      activeStage: 4,
      isPracticeMode: true,
      leaderProfile: baseLeaderProfile,
      companyContext: baseCompanyContext,
      conversationHistory: baseStage123History,
      userMessage:
        'En el roleplay: Marcos, a partir de mañana haces exactamente lo que te puse en el correo sin margen de explicación o lo escalo.',
      sessionData: {
        id: 'case_f3b1_parity_4',
        title: 'Retrasos en entregas de almacén',
        initialChallenge: 'Marcos entrega tarde los cortes diarios y absorbo sus pendientes.',
        identifiedSkills: getActiveSkillNames(stage3Entries),
        skillEntries: stage3Entries,
      },
    };

    const capturedPromptsStage4: string[] = [];
    const stage4GeminiFactory = (_url: string, init?: any) => {
      if (init?.body) capturedPromptsStage4.push(String(init.body));
      return makeGeminiJsonResponse({
        replyText: 'Observemos el tono empleado en el ensayo antes de seguir.',
        readyToAdvance: false,
        identifiedSkills: [
          {
            skill: 'Escucha Activa e Indagación',
            evidenceText:
              'En el ensayo de conversación adoptó un tono punitivo y ultimátum en lugar de indagar causas.',
          },
          {
            skill: 'Negociación con Sindicato Local', // descartada previamente: NO debe reactivarse por mención casual
            evidenceText: 'Mención casual sindical en el ensayo.',
          },
        ],
        skillsReconsideration: {
          reactivate: [
            {
              skill: 'Negociación con Sindicato Local',
              evidence: 'Intento sin nueva evidencia real.',
              newEvidenceText: '',
            },
          ],
        },
      });
    };

    const prodStage4Res = await invokeProdHandler(stage4ReqBody, stage4GeminiFactory);
    const devStage4Res = await invokeDevServer(stage4ReqBody, stage4GeminiFactory);

    assert.equal(prodStage4Res.statusCode, 200);
    assert.equal(devStage4Res.statusCode, 200);

    assert.ok(capturedPromptsStage4[0].includes('REGLA LOCAL DE ETAPA 4'));
    assert.ok(capturedPromptsStage4[1].includes('REGLA LOCAL DE ETAPA 4'));

    assert.deepEqual(
      prodStage4Res.body.data.identifiedSkills,
      devStage4Res.body.data.identifiedSkills
    );
    assert.deepEqual(prodStage4Res.body.data.identifiedSkills, [
      'Gestión y Clarificación de Acuerdos',
      'Delegación Efectiva y Empoderamiento',
      'Escucha Activa e Indagación',
    ]);

    const prodListening = getActiveSkillEntries(prodStage4Res.body.data.skillEntries).find(
      (e) => e.cluster === 'escucha'
    );
    const devListening = getActiveSkillEntries(devStage4Res.body.data.skillEntries).find(
      (e) => e.cluster === 'escucha'
    );
    assert.equal(prodListening?.evidenceHistory[0].sourceType, 'simulacion_practica');
    assert.equal(devListening?.evidenceHistory[0].sourceType, 'simulacion_practica');

    const prodDiscardedCustom = prodStage4Res.body.data.skillEntries.find(
      (e: LeadershipSkillEntry) => e.cluster === 'custom_legacy_sindical'
    );
    const devDiscardedCustom = devStage4Res.body.data.skillEntries.find(
      (e: LeadershipSkillEntry) => e.cluster === 'custom_legacy_sindical'
    );
    assert.equal(prodDiscardedCustom?.status, 'descartada');
    assert.equal(devDiscardedCustom?.status, 'descartada');
  });
});
