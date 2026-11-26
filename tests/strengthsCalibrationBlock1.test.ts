import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  INSUFFICIENT_STRENGTHS_MESSAGE,
  sanitizeDetectedStrengths,
} from '../src/utils/skillsConsolidator';
import mentorRespondHandler from '../api/mentor/respond';

describe('Calibración de detectedStrengths (Bloque: respond.ts y skillsConsolidator.ts)', () => {
  it('1. Debe exportar INSUFFICIENT_STRENGTHS_MESSAGE con el texto oficial exacto', () => {
    assert.equal(
      INSUFFICIENT_STRENGTHS_MESSAGE,
      'No se cuenta con evidencia suficiente en este proceso para identificar fortalezas observables específicas.'
    );
  });

  it('2. sanitizeDetectedStrengths debe preservar arreglos vacíos ([]) sin forzar elementos', () => {
    assert.deepEqual(sanitizeDetectedStrengths([]), []);
    assert.deepEqual(sanitizeDetectedStrengths(null), []);
    assert.deepEqual(sanitizeDetectedStrengths(undefined), []);
    assert.deepEqual(sanitizeDetectedStrengths('no array'), []);
    assert.deepEqual(sanitizeDetectedStrengths({}), []);
  });

  it('3. sanitizeDetectedStrengths debe limitar a un máximo de 4 fortalezas y limpiar espacios', () => {
    const fiveStrengths = [
      '  Honestidad para reconocer hábitos propios  ',
      'Claridad diagnóstica para no tratar igual a colaboradores distintos',
      'Precisión operativa al estructurar compromisos',
      'Disposición al ensayo en simulación',
      'Quinta fortaleza excedente',
    ];

    const result = sanitizeDetectedStrengths(fiveStrengths);
    assert.equal(result.length, 4);
    assert.equal(result[0], 'Honestidad para reconocer hábitos propios');
    assert.equal(result[3], 'Disposición al ensayo en simulación');
    assert.ok(!result.includes('Quinta fortaleza excedente'));
  });

  it('4. sanitizeDetectedStrengths debe excluir el mensaje de transparencia si viniera en los datos', () => {
    const raw = [
      'Honestidad diagnóstica en el autoanálisis',
      INSUFFICIENT_STRENGTHS_MESSAGE,
    ];
    const result = sanitizeDetectedStrengths(raw);
    assert.equal(result.length, 1);
    assert.equal(result[0], 'Honestidad diagnóstica en el autoanálisis');
    assert.ok(!result.includes(INSUFFICIENT_STRENGTHS_MESSAGE));
  });

  it('5. api/mentor/respond debe conservar detectedStrengths: [] sin forzar fallbacks genéricos', async () => {
    let responseData: any = null;
    const req: any = {
      method: 'POST',
      body: {
        stage: 7,
        currentStage: 7,
        activeStage: 7,
        message: 'Concluyo mi proceso',
        history: [],
        leaderProfile: { name: 'Mateo Silva', email: 'mateo@silva.com' },
        companyContext: { name: 'Distribuidora Silva' },
        sessionData: {
          id: 'test_session_mateo',
          identifiedSkills: ['Comunicación Asertiva y Firmeza Empática'],
          skillEntries: [
            {
              skill: 'Comunicación Asertiva y Firmeza Empática',
              cluster: 'comunicacion',
              status: 'vigente',
              initialStage: 2,
              lastUpdatedStage: 2,
              evidenceHistory: [
                {
                  id: 'ev-1',
                  stage: 2,
                  sourceType: 'experiencia_relatada',
                  evidenceText: 'Reconoce dificultad para no engancharse',
                  timestamp: new Date().toISOString(),
                },
              ],
              reconsiderationHistory: [],
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          ],
        },
      },
    };

    const res: any = {
      setHeader: () => {},
      status: () => ({
        json: (data: any) => {
          responseData = data;
          return data;
        },
      }),
    };

    const originalFetch = globalThis.fetch;
    const prevKey = process.env.GEMINI_API_KEY;
    process.env.GEMINI_API_KEY = 'test-strengths-calibration-key';
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      replyText: 'Gracias por concluir tu proceso de acompañamiento, Mateo.',
                      readyToAdvance: false,
                      identifiedSkills: [],
                      finalFeedback: {
                        detectedStrengths: [],
                        stageTwoSkills: ['Comunicación Asertiva y Firmeza Empática'],
                        chosenActions: ['Aplicar escucha directa en reunión semanal'],
                        stageSixLearnings: ['Evitar engancharse mejora la conversación'],
                        recommendationsForAutonomy: ['Sostener preguntas abiertas en cada seguimiento'],
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

    try {
      await mentorRespondHandler(req, res);
    } finally {
      globalThis.fetch = originalFetch;
      if (prevKey === undefined) delete process.env.GEMINI_API_KEY;
      else process.env.GEMINI_API_KEY = prevKey;
    }

    assert.ok(responseData);
    assert.equal(responseData.success, true);
    assert.equal(responseData.isGeminiVerified, true);
    const feedback = responseData.data?.finalFeedback || responseData.finalFeedback;
    assert.ok(feedback, 'Debe incluir finalFeedback en Etapa 7');
    assert.ok(Array.isArray(feedback.detectedStrengths), 'detectedStrengths debe ser un arreglo');
    assert.equal(feedback.detectedStrengths.length, 0, 'Debe conservar [] sin forzar frases genéricas');
    // Verificar que no contiene las frases genéricas hardcodeadas anteriores
    assert.ok(
      !feedback.detectedStrengths.includes(
        'Proactividad para abordar situaciones complejas de liderazgo sin postergarlas'
      )
    );
    assert.ok(
      !feedback.detectedStrengths.includes(
        'Iniciativa para actuar sin postergar la conversación difícil'
      )
    );
  });
});
