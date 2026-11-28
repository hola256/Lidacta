import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import respondHandler, { generateContextualCoachReply } from '../api/mentor/respond';
import {
  reconcileStage2SkillEntries,
  reconcileStage34SkillEntries,
} from '../src/context/LidactaContext';
import { buildTestSessionForStage, QA_TEST_LEADER_PROFILE } from '../src/utils/testSessionFixtures';
import { getActiveSkillNames } from '../src/utils/skillsConsolidator';
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
  apiKey: string | null = 'dummy-f3b3-prod-key'
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
  apiKey: string | null = 'dummy-f3b3-dev-key'
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

  const modUrl = new URL(`../server.ts?f3b3=${Date.now()}-${Math.random()}`, import.meta.url).href;
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
                    'Analicemos cómo abordaste ese momento para identificar el foco correcto.',
                  readyToAdvance: payload.readyToAdvance ?? false,
                  advancePrompt: payload.advancePrompt ?? null,
                  identifiedSkills: payload.identifiedSkills ?? [],
                  ...(payload.skillsReconsideration
                    ? { skillsReconsideration: payload.skillsReconsideration }
                    : {}),
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
  id: 'leader_f3b3',
  name: 'Elena Vargas',
  email: 'elena@empresa.com',
  role: 'leader',
  companyId: 'comp_f3b3',
  companyName: 'Logística Central',
  position: 'Gerente de Operaciones',
  area: 'Operaciones',
  directReports: 8,
  createdAt: '2026-11-25T09:00:00Z',
};

const baseCompanyContext = {
  id: 'comp_f3b3',
  name: 'Logística Central',
  industry: 'Distribución',
};

const stage2NarrativeHistory = [
  {
    id: 'm1',
    sender: 'leader',
    stage: 1,
    text: 'Marcos entrega tarde los reportes diarios y cuando algo urge termino corrigiendo sus archivos yo misma para evitar fricciones.',
  },
  {
    id: 'm2',
    sender: 'lidacta',
    stage: 1,
    text: 'Entiendo la sobrecarga que esto te genera.',
  },
  {
    id: 'm3',
    sender: 'leader',
    stage: 2,
    text: 'Cuando lo llamo para revisar el retraso prefiero callarme y absorber la corrección porque temo que reaccione a la defensiva.',
  },
];

const stage34NarrativeHistory = [
  ...stage2NarrativeHistory,
  {
    id: 'm4',
    sender: 'leader',
    stage: 3,
    text: 'Pensé en fijar horarios de entrega por escrito y revisar solo los criterios clave sin rehacer su trabajo.',
  },
  {
    id: 'm5',
    sender: 'leader',
    stage: 4,
    text: 'En la simulación le expliqué los hechos de los tres retrasos sin reproches y le pregunté qué obstáculo enfrentó en el cierre.',
  },
];

function makeSkillEntry(
  overrides: Partial<LeadershipSkillEntry> & Pick<LeadershipSkillEntry, 'skill' | 'cluster'>
): LeadershipSkillEntry {
  return {
    status: 'vigente',
    initialStage: 2,
    evidenceHistory: [
      {
        id: 'ev-base-1',
        stage: 2,
        sourceType: 'experiencia_relatada',
        evidenceText:
          'Evita hablar con Marcos por temor a que se ponga a la defensiva y prefiere callarse.',
        timestamp: '2026-11-25T10:00:00Z',
      },
    ],
    reconsiderationHistory: [],
    lastUpdatedStage: 2,
    createdAt: '2026-11-25T10:00:00Z',
    updatedAt: '2026-11-25T10:00:00Z',
    ...overrides,
  };
}

describe('Frente 3 Bloque 3B.3 — Persistencia, integridad diagnóstica y locución', () => {
  describe('A. Pruebas determinísticas de persistencia y reconciliación cliente', () => {
    it('1. Sesión legada (identifiedSkills con skillEntries: []) conserva habilidad histórica al agregar una nueva en Etapa 2', () => {
      const incoming: LeadershipSkillEntry[] = [
        {
          skill: 'Delegación Efectiva y Empoderamiento',
          cluster: 'delegacion',
          status: 'vigente',
          initialStage: 2,
          lastUpdatedStage: 2,
          createdAt: '2026-11-28T10:00:00Z',
          updatedAt: '2026-11-28T10:00:00Z',
          reconsiderationHistory: [],
          evidenceHistory: [
            {
              id: 'ev-del-1',
              stage: 2,
              sourceType: 'experiencia_relatada',
              evidenceText:
                'Termina corrigiendo los archivos de Marcos ella misma cuando algo urge en lugar de delegar la corrección.',
              timestamp: '2026-11-28T10:00:00Z',
            },
          ],
        },
      ];

      const reconciled = reconcileStage2SkillEntries([], incoming, {
        caseTitle: 'Retrasos en reportes',
        initialChallenge:
          'Marcos entrega tarde los reportes diarios y termino corrigiendo sus archivos yo misma.',
        history: stage2NarrativeHistory,
        latestUserMessage:
          'Prefiero callarme y absorber la corrección cuando entrega tarde el reporte.',
        legacyIdentifiedSkills: ['Negociación Sindical'],
      });

      const activeNames = getActiveSkillNames(reconciled);
      assert.equal(reconciled.length, 2);
      assert.ok(activeNames.includes('Negociación Sindical'));
      assert.ok(activeNames.includes('Delegación Efectiva y Empoderamiento'));
      const newEntry = reconciled.find((e) => e.cluster === 'delegacion');
      assert.equal(newEntry?.evidenceHistory.length, 1);
      assert.equal(newEntry?.evidenceHistory[0].sourceType, 'experiencia_relatada');
    });

    it('2. Sesión legada con habilidad equivalente a una entrante NO la duplica y adjunta evidencia válida', () => {
      const incoming: LeadershipSkillEntry[] = [
        {
          skill: 'Comunicación Asertiva y Firmeza Empática',
          cluster: 'comunicacion',
          status: 'vigente',
          initialStage: 2,
          lastUpdatedStage: 2,
          createdAt: '2026-11-28T10:00:00Z',
          updatedAt: '2026-11-28T10:00:00Z',
          reconsiderationHistory: [],
          evidenceHistory: [
            {
              id: 'ev-com-1',
              stage: 2,
              sourceType: 'experiencia_relatada',
              evidenceText:
                'Prefiere callarse cuando revisa los retrasos de Marcos por temor a que se ponga a la defensiva.',
              timestamp: '2026-11-28T10:00:00Z',
            },
          ],
        },
      ];

      const reconciled = reconcileStage2SkillEntries([], incoming, {
        caseTitle: 'Retrasos en reportes',
        initialChallenge: 'Marcos entrega tarde los reportes diarios.',
        history: stage2NarrativeHistory,
        legacyIdentifiedSkills: ['Comunicación Asertiva'],
      });

      assert.equal(reconciled.length, 1);
      assert.equal(reconciled[0].cluster, 'comunicacion');
      assert.equal(reconciled[0].skill, 'Comunicación Asertiva y Firmeza Empática');
      assert.equal(reconciled[0].evidenceHistory.length, 1);
      assert.deepEqual(getActiveSkillNames(reconciled), [
        'Comunicación Asertiva y Firmeza Empática',
      ]);
    });

    it('3. Habilidad previa descartada o sustituida NO se reactiva en Etapa 2 aunque llegue en incomingEntries', () => {
      const existing: LeadershipSkillEntry[] = [
        makeSkillEntry({
          skill: 'Comunicación Asertiva y Firmeza Empática',
          cluster: 'comunicacion',
          status: 'descartada',
          reconsiderationHistory: [
            {
              stage: 3,
              reconsiderationReason: 'Se descartó tras aclarar que ya conversó directamente.',
              timestamp: '2026-11-25T11:00:00Z',
            },
          ],
        }),
        makeSkillEntry({
          skill: 'Inteligencia y Regulación Emocional',
          cluster: 'inteligencia_emocional',
          status: 'sustituida',
          reconsiderationHistory: [
            {
              stage: 3,
              reconsiderationReason: 'Sustituida por delegación con criterios explícitos.',
              replacedBySkill: 'Delegación Efectiva y Empoderamiento',
              timestamp: '2026-11-25T11:05:00Z',
            },
          ],
        }),
      ];

      const incoming: LeadershipSkillEntry[] = [
        makeSkillEntry({
          skill: 'Comunicación Asertiva y Firmeza Empática',
          cluster: 'comunicacion',
          status: 'vigente',
          evidenceHistory: [
            {
              id: 'ev-try-reactivate',
              stage: 2,
              sourceType: 'experiencia_relatada',
              evidenceText:
                'Cuando revisa los retrasos prefiere callarse para evitar roces con Marcos.',
              timestamp: '2026-11-28T10:00:00Z',
            },
          ],
        }),
        makeSkillEntry({
          skill: 'Inteligencia y Regulación Emocional',
          cluster: 'inteligencia_emocional',
          status: 'vigente',
        }),
      ];

      const reconciled = reconcileStage2SkillEntries(existing, incoming, {
        caseTitle: 'Retrasos',
        initialChallenge: 'Marcos entrega tarde los reportes.',
        history: stage2NarrativeHistory,
      });

      assert.equal(reconciled.length, 2);
      assert.equal(reconciled[0].status, 'descartada');
      assert.equal(reconciled[1].status, 'sustituida');
      assert.deepEqual(getActiveSkillNames(reconciled), []);
    });

    it('4. Etapas 3 y 4 con respuesta parcial o vacía de skillEntries conservan habilidades previas, evidenceHistory y reconsiderationHistory', () => {
      const existing: LeadershipSkillEntry[] = [
        makeSkillEntry({
          skill: 'Comunicación Asertiva y Firmeza Empática',
          cluster: 'comunicacion',
          status: 'vigente',
        }),
        makeSkillEntry({
          skill: 'Delegación Efectiva y Empoderamiento',
          cluster: 'delegacion',
          status: 'precisada',
          initialStage: 3,
          lastUpdatedStage: 3,
          evidenceHistory: [
            {
              id: 'ev-del-s3',
              stage: 3,
              sourceType: 'experiencia_relatada',
              evidenceText: 'Reconoció que rehace los archivos de Marcos para ahorrar tiempo.',
              timestamp: '2026-11-25T10:30:00Z',
            },
          ],
          reconsiderationHistory: [
            {
              stage: 3,
              reconsiderationReason: 'Precisada al analizar sus alternativas de seguimiento.',
              replacesSkill: 'Control Operativo',
              timestamp: '2026-11-25T10:30:00Z',
            },
          ],
        }),
      ];

      // 4a) Respuesta vacía [] en Etapa 3
      const afterEmpty = reconcileStage34SkillEntries(
        existing,
        { skillEntries: [] },
        3,
        {
          caseTitle: 'Retrasos en reportes',
          initialChallenge: 'Marcos entrega tarde los reportes.',
          history: stage34NarrativeHistory,
        }
      );
      assert.equal(afterEmpty.length, 2);
      assert.equal(afterEmpty[0].evidenceHistory[0].id, 'ev-base-1');
      assert.equal(afterEmpty[1].reconsiderationHistory?.length, 1);

      // 4b) Respuesta parcial en Etapa 4 que omite la primera habilidad y borra el historial previo de la segunda
      const partialIncoming: LeadershipSkillEntry[] = [
        {
          skill: 'Delegación Efectiva y Empoderamiento',
          cluster: 'delegacion',
          status: 'precisada',
          initialStage: 3,
          lastUpdatedStage: 4,
          createdAt: '2026-11-28T11:00:00Z',
          updatedAt: '2026-11-28T11:00:00Z',
          evidenceHistory: [
            {
              id: 'ev-del-s4-sim',
              stage: 4,
              sourceType: 'simulacion_practica',
              evidenceText:
                'En la simulación definió criterios claros de entrega sin rehacer el trabajo de Marcos.',
              timestamp: '2026-11-28T11:00:00Z',
            },
          ],
          reconsiderationHistory: [],
        },
      ];

      const afterPartial = reconcileStage34SkillEntries(
        existing,
        { skillEntries: partialIncoming },
        4,
        {
          caseTitle: 'Retrasos en reportes',
          initialChallenge: 'Marcos entrega tarde los reportes.',
          history: stage34NarrativeHistory,
          latestUserMessage:
            'En la simulación definí criterios claros de entrega sin asumir su archivo.',
        }
      );

      assert.equal(afterPartial.length, 2);
      assert.equal(afterPartial[0].cluster, 'comunicacion');
      assert.equal(afterPartial[0].evidenceHistory[0].id, 'ev-base-1');
      assert.equal(afterPartial[1].cluster, 'delegacion');
      assert.equal(afterPartial[1].reconsiderationHistory?.length, 1);
      assert.equal(afterPartial[1].evidenceHistory.length, 2);
      assert.equal(afterPartial[1].evidenceHistory[0].id, 'ev-del-s3');
      assert.equal(afterPartial[1].evidenceHistory[1].sourceType, 'simulacion_practica');
    });

    it('5. Etapas 3 y 4 rechazan cambios de estatus en skillEntries cuando NO existe reconsideración válida', () => {
      const existing: LeadershipSkillEntry[] = [
        makeSkillEntry({
          skill: 'Comunicación Asertiva y Firmeza Empática',
          cluster: 'comunicacion',
          status: 'vigente',
        }),
        makeSkillEntry({
          skill: 'Escucha Activa e Indagación',
          cluster: 'escucha',
          status: 'descartada',
          reconsiderationHistory: [
            {
              stage: 3,
              reconsiderationReason: 'Descartada en Etapa 3 porque sí preguntó causas en el cierre.',
              timestamp: '2026-11-25T11:00:00Z',
            },
          ],
        }),
      ];

      // Intento inválido: pasar comunicacion a descartada sin justificación y resucitar escucha sin nueva evidencia
      const invalidFlipReply: LeadershipSkillEntry[] = [
        makeSkillEntry({
          skill: 'Comunicación Asertiva y Firmeza Empática',
          cluster: 'comunicacion',
          status: 'descartada',
          reconsiderationHistory: [],
        }),
        makeSkillEntry({
          skill: 'Escucha Activa e Indagación',
          cluster: 'escucha',
          status: 'vigente',
          reconsiderationHistory: [
            {
              stage: 3,
              reconsiderationReason: 'Descartada en Etapa 3 porque sí preguntó causas en el cierre.',
              timestamp: '2026-11-25T11:00:00Z',
            },
          ],
        }),
      ];

      const reconciled = reconcileStage34SkillEntries(
        existing,
        { skillEntries: invalidFlipReply },
        4,
        {
          caseTitle: 'Retrasos en reportes',
          initialChallenge: 'Marcos entrega tarde los reportes.',
          history: stage34NarrativeHistory,
        }
      );

      const com = reconciled.find((e) => e.cluster === 'comunicacion');
      const esc = reconciled.find((e) => e.cluster === 'escucha');
      assert.equal(com?.status, 'vigente');
      assert.equal(esc?.status, 'descartada');
    });

    it('6. Etapas 3 y 4 aplican discard, replace y reactivate válidos preservando evidenceHistory y reconsiderationHistory', () => {
      const existing: LeadershipSkillEntry[] = [
        makeSkillEntry({
          skill: 'Comunicación Asertiva y Firmeza Empática',
          cluster: 'comunicacion',
          status: 'vigente',
        }),
        makeSkillEntry({
          skill: 'Delegación Efectiva y Empoderamiento',
          cluster: 'delegacion',
          status: 'vigente',
          evidenceHistory: [
            {
              id: 'ev-del-keep',
              stage: 2,
              sourceType: 'experiencia_relatada',
              evidenceText: 'Corrige personalmente los reportes urgentes de Marcos.',
              timestamp: '2026-11-25T10:00:00Z',
            },
          ],
        }),
        makeSkillEntry({
          skill: 'Escucha Activa e Indagación',
          cluster: 'escucha',
          status: 'descartada',
          evidenceHistory: [
            {
              id: 'ev-esc-orig',
              stage: 2,
              sourceType: 'experiencia_relatada',
              evidenceText: 'Asumió el motivo del retraso sin preguntarle a Marcos.',
              timestamp: '2026-11-25T10:00:00Z',
            },
          ],
          reconsiderationHistory: [
            {
              stage: 3,
              reconsiderationReason: 'Indicó que ya le había preguntado anteriormente.',
              timestamp: '2026-11-25T11:00:00Z',
            },
          ],
        }),
      ];

      const stage4ContextMsg =
        'En la simulación demostró que no interrumpió a Marcos, prefirió fijar criterios escritos de entrega y volvió a evitar preguntarle qué obstáculo enfrentó en el cierre.';

      const result = reconcileStage34SkillEntries(
        existing,
        {
          skillsReconsideration: {
            discard: [
              {
                skill: 'Comunicación Asertiva y Firmeza Empática',
                evidence:
                  'En la simulación explicó los retrasos de Marcos con calma, hechos concretos y sin reproches.',
              },
            ],
            replace: [
              {
                from: 'Delegación Efectiva y Empoderamiento',
                to: 'Gestión y Clarificación de Acuerdos',
                evidence:
                  'El reto principal en las alternativas y simulación fue fijar criterios escritos y horarios de entrega claros.',
                newEvidenceText:
                  'En la simulación necesitó precisar acuerdos explícitos sobre horarios de entrega de los reportes.',
              },
            ],
            reactivate: [
              {
                skill: 'Escucha Activa e Indagación',
                evidence:
                  'En la simulación volvió a cerrar la indicación sin indagar qué obstáculo enfrentó Marcos en el cierre.',
                newEvidenceText:
                  'En la simulación dio la instrucción sin preguntarle a Marcos qué obstáculo enfrentó en el cierre.',
              },
            ],
          },
        },
        4,
        {
          caseTitle: 'Retrasos en reportes',
          initialChallenge: 'Marcos entrega tarde los reportes diarios.',
          history: stage34NarrativeHistory,
          latestUserMessage: stage4ContextMsg,
        }
      );

      const com = result.find((e) => e.cluster === 'comunicacion');
      const del = result.find((e) => e.cluster === 'delegacion');
      const acuerdos = result.find((e) => e.cluster === 'acuerdos');
      const esc = result.find((e) => e.cluster === 'escucha');

      assert.equal(com?.status, 'descartada');
      assert.equal(com?.evidenceHistory[0].id, 'ev-base-1');
      assert.equal(com?.reconsiderationHistory?.length, 1);

      assert.equal(del?.status, 'sustituida');
      assert.equal(del?.evidenceHistory[0].id, 'ev-del-keep');
      assert.equal(del?.reconsiderationHistory?.[0].replacedBySkill, 'Gestión y Clarificación de Acuerdos');

      assert.equal(acuerdos?.status, 'precisada');
      assert.equal(acuerdos?.reconsiderationHistory?.[0].replacesSkill, 'Delegación Efectiva y Empoderamiento');
      assert.equal(acuerdos?.evidenceHistory[0].sourceType, 'simulacion_practica');

      assert.equal(esc?.status, 'precisada');
      assert.equal(esc?.evidenceHistory.length, 2);
      assert.equal(esc?.evidenceHistory[0].id, 'ev-esc-orig');
      assert.equal(esc?.evidenceHistory[1].sourceType, 'simulacion_practica');
      assert.equal(esc?.reconsiderationHistory?.length, 2);
    });

    it('7. Etapas 3 y 4 rechazan habilidades nuevas sin evidencia suficiente sin borrar las existentes', () => {
      const existing: LeadershipSkillEntry[] = [
        makeSkillEntry({
          skill: 'Comunicación Asertiva y Firmeza Empática',
          cluster: 'comunicacion',
          status: 'vigente',
        }),
      ];

      const incoming: LeadershipSkillEntry[] = [
        makeSkillEntry({
          skill: 'Comunicación Asertiva y Firmeza Empática',
          cluster: 'comunicacion',
          status: 'vigente',
        }),
        {
          skill: 'Motivación y Desarrollo de Equipos',
          cluster: 'motivacion',
          status: 'vigente',
          initialStage: 3,
          lastUpdatedStage: 3,
          createdAt: '2026-11-28T11:00:00Z',
          updatedAt: '2026-11-28T11:00:00Z',
          evidenceHistory: [],
          reconsiderationHistory: [],
        },
        {
          skill: 'Pensamiento Estratégico y Priorización',
          cluster: 'estrategia',
          status: 'vigente',
          initialStage: 3,
          lastUpdatedStage: 3,
          createdAt: '2026-11-28T11:00:00Z',
          updatedAt: '2026-11-28T11:00:00Z',
          evidenceHistory: [
            {
              id: 'ev-speculative',
              stage: 3,
              sourceType: 'experiencia_relatada',
              evidenceText: 'Seguramente le falta visión estratégica.',
              timestamp: '2026-11-28T11:00:00Z',
            },
          ],
          reconsiderationHistory: [],
        },
      ];

      const result = reconcileStage34SkillEntries(
        existing,
        { skillEntries: incoming },
        3,
        {
          caseTitle: 'Retrasos en reportes',
          initialChallenge: 'Marcos entrega tarde los reportes diarios.',
          history: stage34NarrativeHistory,
        }
      );

      assert.equal(result.length, 1);
      assert.equal(result[0].cluster, 'comunicacion');
      assert.deepEqual(getActiveSkillNames(result), ['Comunicación Asertiva y Firmeza Empática']);
    });
  });

  describe('B. Guardrails Etapa 2 con Gemini mockeado y paridad Prod / Dev', () => {
    it('8. Bloquea avance en Etapa 2 cuando Gemini devuelve identifiedSkills: [] con readyToAdvance: true sin habilidades previas', async () => {
      const reqBody = {
        caseId: 'case_f3b3_empty_s2',
        stage: 2,
        leaderProfile: baseLeaderProfile,
        companyContext: baseCompanyContext,
        conversationHistory: [
          {
            id: 'm1',
            sender: 'leader',
            stage: 1,
            text: 'Tengo problemas de coordinación con mi área.',
          },
        ],
        userMessage: 'No sabría decirte todavía qué pasó exactamente.',
        sessionData: {
          id: 'case_f3b3_empty_s2',
          title: 'Problemas de coordinación',
          initialChallenge: 'Tengo problemas de coordinación con mi área.',
          identifiedSkills: [],
          skillEntries: [],
        },
      };

      const geminiPrematureAdvance = () =>
        makeGeminiJsonResponse({
          replyText: 'Qué buen punto. ¿Avanzamos a Etapa 3?',
          readyToAdvance: true,
          advancePrompt: 'Avanzar a Etapa 3: Diseñar alternativas',
          identifiedSkills: [],
        });

      const prodRes = await invokeProdHandler(reqBody, geminiPrematureAdvance);
      const devRes = await invokeDevServer(reqBody, geminiPrematureAdvance);

      for (const payload of [prodRes.body?.data, devRes.body?.data]) {
        assert.deepEqual(payload.identifiedSkills, []);
        assert.deepEqual(payload.skillEntries, []);
        assert.equal(payload.readyToAdvance, false);
        assert.equal(payload.advancePrompt, null);
        assert.ok(payload.replyText.includes('?'));
        assert.ok(/ejemplo concreto/i.test(payload.replyText));
        assert.ok(!/¿Avanzamos a Etapa 3\?/i.test(payload.replyText));
      }

      // Fallback determinístico en Prod también bloquea sin habilidades previas
      const prodFallback = generateContextualCoachReply(
        2,
        baseLeaderProfile.name,
        reqBody.userMessage,
        reqBody.conversationHistory,
        reqBody.sessionData
      );
      assert.equal(prodFallback.readyToAdvance, false);
      assert.equal(prodFallback.advancePrompt, null);
      assert.deepEqual(prodFallback.identifiedSkills, []);
    });

    it('9. Bloquea avance en Etapa 2 cuando Gemini propone habilidades rechazadas por falta de evidencia y no hay vigentes', async () => {
      const reqBody = {
        caseId: 'case_f3b3_rejected_s2',
        stage: 2,
        leaderProfile: baseLeaderProfile,
        companyContext: baseCompanyContext,
        conversationHistory: [
          {
            id: 'm1',
            sender: 'leader',
            stage: 1,
            text: 'Problemas en el área de ventas.',
          },
        ],
        userMessage: 'Todo sigue tenso.',
        sessionData: {
          id: 'case_f3b3_rejected_s2',
          title: 'Problemas en el área de ventas',
          initialChallenge: 'Problemas en el área de ventas.',
          identifiedSkills: [],
          skillEntries: [],
        },
      };

      const geminiUnverified = () =>
        makeGeminiJsonResponse({
          replyText: 'Podemos cerrar esta etapa. ¿Pasamos a la Etapa 3?',
          readyToAdvance: true,
          advancePrompt: 'Avanzar a Etapa 3',
          identifiedSkills: [
            { skill: 'Delegación Efectiva', evidenceText: 'Problemas en el área de ventas.' },
            {
              skill: 'Inteligencia Emocional',
              evidenceText: 'Probablemente reacciona mal bajo presión.',
            },
          ],
        });

      const prodRes = await invokeProdHandler(reqBody, geminiUnverified);
      const devRes = await invokeDevServer(reqBody, geminiUnverified);

      for (const payload of [prodRes.body?.data, devRes.body?.data]) {
        assert.deepEqual(payload.identifiedSkills, []);
        assert.deepEqual(payload.skillEntries, []);
        assert.equal(payload.readyToAdvance, false);
        assert.equal(payload.advancePrompt, null);
        assert.ok(/ejemplo concreto/i.test(payload.replyText));
      }
    });

    it('10. Etapa 2 permite avance normal cuando ya existe al menos una habilidad activa previa en la sesión', async () => {
      const existingEntry = makeSkillEntry({
        skill: 'Comunicación Asertiva y Firmeza Empática',
        cluster: 'comunicacion',
        status: 'vigente',
      });

      const reqBody = {
        caseId: 'case_f3b3_existing_s2',
        stage: 2,
        leaderProfile: baseLeaderProfile,
        companyContext: baseCompanyContext,
        conversationHistory: stage2NarrativeHistory,
        userMessage: 'Creo que él siente que lo evito hasta que el problema explota.',
        sessionData: {
          id: 'case_f3b3_existing_s2',
          title: 'Retrasos en entregas',
          initialChallenge: 'Marcos entrega tarde los reportes diarios.',
          identifiedSkills: ['Comunicación Asertiva y Firmeza Empática'],
          skillEntries: [existingEntry],
        },
      };

      const geminiAdvanceWithExisting = () =>
        makeGeminiJsonResponse({
          replyText: 'Excelente toma de perspectiva. Con este foco ya identificado, ¿avanzamos a la Etapa 3?',
          readyToAdvance: true,
          advancePrompt: 'Avanzar a Etapa 3: Diseñar alternativas',
          identifiedSkills: [],
        });

      const prodRes = await invokeProdHandler(reqBody, geminiAdvanceWithExisting);
      const devRes = await invokeDevServer(reqBody, geminiAdvanceWithExisting);

      for (const payload of [prodRes.body?.data, devRes.body?.data]) {
        assert.deepEqual(payload.identifiedSkills, ['Comunicación Asertiva y Firmeza Empática']);
        assert.equal(payload.skillEntries.length, 1);
        assert.equal(payload.readyToAdvance, true);
        assert.equal(payload.advancePrompt, 'Avanzar a Etapa 3: Diseñar alternativas');
      }
    });
  });

  describe('C. Presentación en LeaderView y flujo QA de etapas', () => {
    it('11. LeaderView.tsx narra stageTwoSkills como habilidades identificadas para fortalecer y NO como habilidades puestas en juego', () => {
      const leaderViewSrc = fs.readFileSync(
        path.resolve(process.cwd(), 'src/components/LeaderView.tsx'),
        'utf8'
      );

      assert.equal(
        leaderViewSrc.includes('Las habilidades clave que pusiste en juego fueron'),
        false,
        'La locución de audio no debe afirmar que las habilidades por fortalecer fueron puestas en juego'
      );
      assert.ok(
        leaderViewSrc.includes(
          'Las habilidades identificadas para fortalecer durante tu acompañamiento fueron:'
        ),
        'La locución debe presentar stageTwoSkills como habilidades identificadas para fortalecer'
      );
      assert.ok(
        leaderViewSrc.includes('Habilidades que necesitas fortalecer y evidencias de progreso'),
        'El encabezado visual de la sección debe permanecer intacto'
      );
    });

    it('12. Flujo QA (createTestSessionAtStage y buildTestSessionForStage) protege Etapas 2, 3 y 4 mediante reconciliadores', () => {
      const contextSrc = fs.readFileSync(
        path.resolve(process.cwd(), 'src/context/LidactaContext.tsx'),
        'utf8'
      );

      // Verificar que createTestSessionAtStage no sobrescribe skillEntries directamente en Etapas 2, 3 y 4
      const qaFnStart = contextSrc.indexOf('const createTestSessionAtStage = async');
      const qaFnEnd = contextSrc.indexOf('const deleteTestSession =', qaFnStart);
      assert.ok(qaFnStart !== -1 && qaFnEnd > qaFnStart);
      const qaFnBody = contextSrc.slice(qaFnStart, qaFnEnd);

      assert.ok(qaFnBody.includes('reconcileStage2SkillEntries'));
      assert.ok(qaFnBody.includes('reconcileStage34SkillEntries'));

      const qaStage2 = buildTestSessionForStage(2, 'pending_verification', QA_TEST_LEADER_PROFILE);
      assert.deepEqual(qaStage2.skillEntries, []);
      assert.deepEqual(qaStage2.identifiedSkills, []);

      const qaStage3 = buildTestSessionForStage(3, 'pending_verification', QA_TEST_LEADER_PROFILE);
      assert.equal(qaStage3.skillEntries.length, 2);
      assert.equal(qaStage3.identifiedSkills.length, 2);

      // Simular respuesta QA parcial en Etapa 3: el reconciliador preserva las 2 habilidades QA intactas
      const afterPartialQa = reconcileStage34SkillEntries(
        qaStage3.skillEntries,
        { skillEntries: [] },
        3,
        {
          caseTitle: qaStage3.title,
          initialChallenge: qaStage3.initialChallenge,
          history: qaStage3.messages,
        }
      );
      assert.equal(afterPartialQa.length, 2);
      assert.deepEqual(getActiveSkillNames(afterPartialQa), qaStage3.identifiedSkills);
    });
  });
});
