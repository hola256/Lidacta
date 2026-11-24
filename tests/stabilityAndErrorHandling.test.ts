import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import handler from '../api/mentor/respond';
import {
  isTechnicalErrorMessage,
  isValidMentorApiResponse,
  MENTOR_TEMPORARY_ERROR_TEXT,
} from '../src/context/LidactaContext';

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

async function runWithMockFetch(
  reqBody: any,
  fetchImpl: (url: string, init: any, callIndex: number) => Promise<any>
) {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = 'test-stability-key';

  const calls: Array<{ url: string; model: string; startedAt: number; finishedAt: number }> = [];
  let inFlight = 0;
  let maxConcurrent = 0;

  globalThis.fetch = (async (url: any, init: any) => {
    const idx = calls.length;
    const match = String(url).match(/models\/([^:]+):generateContent/);
    const model = match ? match[1] : 'unknown';
    const startedAt = Date.now();
    inFlight++;
    if (inFlight > maxConcurrent) maxConcurrent = inFlight;
    try {
      const result = await fetchImpl(String(url), init, idx);
      calls.push({ url: String(url), model, startedAt, finishedAt: Date.now() });
      return result;
    } catch (err) {
      calls.push({ url: String(url), model, startedAt, finishedAt: Date.now() });
      throw err;
    } finally {
      inFlight--;
    }
  }) as any;

  try {
    const req = { method: 'POST', body: reqBody };
    const res = createMockRes();
    await handler(req, res);
    return { res, calls, maxConcurrent };
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) {
      delete process.env.GEMINI_API_KEY;
    } else {
      process.env.GEMINI_API_KEY = originalKey;
    }
  }
}

const baseReqBody = {
  caseId: 'case_stab_1',
  stage: 1,
  leaderProfile: { name: 'Sofía Martínez', position: 'Gerente' },
  companyContext: { name: 'Empresa Demo' },
  conversationHistory: [],
  userMessage: 'Mi equipo depende demasiado de mí para tomar decisiones.',
};

describe('Estabilidad y Manejo de Errores en Producción (api/mentor/respond.ts + Frontend)', () => {
  it('1. Manejo de 503 y 429 con fallback automático al modelo alternativo sin llamadas concurrentes', async () => {
    // Escenario A: 503 en principal -> éxito en fallback
    const run503 = await runWithMockFetch(baseReqBody, async (_url, _init, idx) => {
      if (idx === 0) {
        return { ok: false, status: 503, text: async () => 'UNAVAILABLE' };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: JSON.stringify({ replyText: 'Respuesta vía fallback', readyToAdvance: false }) }] } }],
        }),
      };
    });

    assert.equal(run503.res.statusCode, 200);
    assert.equal(run503.res.body.success, true);
    assert.equal(run503.res.body.reply, 'Respuesta vía fallback');
    assert.equal(run503.maxConcurrent, 1, 'Nunca debe hacer llamadas concurrentes');
    assert.deepEqual(
      run503.calls.map((c) => c.model),
      ['gemini-3.8-flash', 'gemini-3.1-flash-lite']
    );

    // Escenario B: 429 en principal -> éxito en fallback
    const run429 = await runWithMockFetch(baseReqBody, async (_url, _init, idx) => {
      if (idx === 0) {
        return { ok: false, status: 429, text: async () => 'RESOURCE_EXHAUSTED' };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: JSON.stringify({ replyText: 'Recuperado tras 429', readyToAdvance: false }) }] } }],
        }),
      };
    });

    assert.equal(run429.res.statusCode, 200);
    assert.equal(run429.res.body.success, true);
    assert.equal(run429.res.body.reply, 'Recuperado tras 429');
    assert.equal(run429.maxConcurrent, 1);
    assert.deepEqual(
      run429.calls.map((c) => c.model),
      ['gemini-3.8-flash', 'gemini-3.1-flash-lite']
    );
  });

  it('2. Ante 503/429 rápido en ambos modelos, ejecuta máximo 1 reintento secuencial con espera breve y logra recuperar si responde 200', async () => {
    const { res, calls, maxConcurrent } = await runWithMockFetch(baseReqBody, async (_url, _init, idx) => {
      if (idx < 2) {
        return { ok: false, status: 503, text: async () => 'UNAVAILABLE' };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: JSON.stringify({ replyText: 'Recuperado en el único reintento secuencial', readyToAdvance: false }) }] } }],
        }),
      };
    });

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.reply, 'Recuperado en el único reintento secuencial');
    assert.equal(maxConcurrent, 1);
    assert.deepEqual(
      calls.map((c) => c.model),
      ['gemini-3.8-flash', 'gemini-3.1-flash-lite', 'gemini-3.1-flash-lite']
    );
    // Verifica que existió espera breve con jitter (>= 1100ms) antes del 3er intento
    const gapBeforeExtraRetry = calls[2].startedAt - calls[1].finishedAt;
    assert.ok(gapBeforeExtraRetry >= 1100, `Espera con jitter esperada >=1100ms, fue ${gapBeforeExtraRetry}ms`);
  });

  it('3. Si fallan todos los intentos en Etapas 1-6, devuelve HTTP de error limpio (sin HTTP 200 ni reply técnico) y mantiene intacta Etapa 7', async () => {
    const failedAll503 = await runWithMockFetch(baseReqBody, async () => ({
      ok: false,
      status: 503,
      text: async () => 'UNAVAILABLE',
    }));

    assert.equal(failedAll503.calls.length, 3, 'Máximo 3 intentos secuenciales (principal + fallback + 1 reintento rápido)');
    assert.equal(failedAll503.maxConcurrent, 1);
    assert.equal(failedAll503.res.statusCode, 503);
    assert.equal(failedAll503.res.body.success, false);
    assert.equal(failedAll503.res.body.reply, undefined, 'No debe enviar texto de error en reply');
    assert.equal(failedAll503.res.body.text, undefined, 'No debe enviar texto de error en text');
    assert.ok(!JSON.stringify(failedAll503.res.body).includes('ERROR DE SERVIDOR'));

    // Etapa 7 conserva su comportamiento especial sin modificaciones
    const stage7Run = await runWithMockFetch(
      { ...baseReqBody, stage: 7, activeStage: 7 },
      async () => ({
        ok: false,
        status: 503,
        text: async () => 'UNAVAILABLE',
      })
    );
    assert.equal(stage7Run.res.statusCode, 200);
    assert.equal(stage7Run.res.body.success, true);
    assert.ok(stage7Run.res.body.data?.finalFeedback);
  });

  it('4. Timeout / AbortError no activa reintento adicional y no mezcla el HTTP 503 del modelo previo con el aborto del fallback', async () => {
    const abortRun = await runWithMockFetch(baseReqBody, async (_url, _init, idx) => {
      if (idx === 0) {
        return { ok: false, status: 503, text: async () => 'UNAVAILABLE' };
      }
      const abortErr: any = new Error('This operation was aborted');
      abortErr.name = 'AbortError';
      throw abortErr;
    });

    assert.equal(abortRun.calls.length, 2, 'No debe reintentar tras AbortError/timeout');
    assert.equal(abortRun.res.statusCode, 504, 'Debe reportar 504 de timeout y NO heredar 503 del primer modelo');
    assert.equal(abortRun.res.body.success, false);
    assert.equal(abortRun.res.body.reply, undefined);
    assert.ok(!JSON.stringify(abortRun.res.body).includes('This operation was aborted'));
    assert.ok(!JSON.stringify(abortRun.res.body).includes('503'));

    // Error 400 tampoco debe activar reintento adicional
    const badReqRun = await runWithMockFetch(baseReqBody, async () => ({
      ok: false,
      status: 400,
      text: async () => 'Bad Request',
    }));
    assert.equal(badReqRun.calls.length, 2);
    assert.equal(badReqRun.res.statusCode, 400);
    assert.equal(badReqRun.res.body.success, false);
    assert.equal(badReqRun.res.body.reply, undefined);
  });

  it('5. Integridad del historial y validación de respuesta en LidactaContext.tsx', () => {
    // Nunca aceptar success:false aunque HTTP sea 200 ni mensajes "ERROR DE SERVIDOR"
    assert.equal(
      isValidMentorApiResponse({ ok: true }, { success: false, reply: 'ERROR DE SERVIDOR (Gemini API 503): This operation was aborted' }, 'ERROR DE SERVIDOR (Gemini API 503): This operation was aborted'),
      false
    );
    assert.equal(
      isValidMentorApiResponse({ ok: true }, { success: false, reply: 'Texto cualquiera' }, 'Texto cualquiera'),
      false
    );
    assert.equal(
      isValidMentorApiResponse({ ok: false }, { success: true, reply: 'Texto cualquiera' }, 'Texto cualquiera'),
      false
    );
    assert.equal(
      isValidMentorApiResponse({ ok: true }, { success: true, reply: 'ERROR DE SERVIDOR: fallo' }, 'ERROR DE SERVIDOR: fallo'),
      false
    );
    assert.equal(
      isValidMentorApiResponse({ ok: true }, { success: true, reply: '   ' }, '   '),
      false
    );
    assert.equal(
      isValidMentorApiResponse({ ok: true }, { success: true, reply: '¿Qué fue lo que más te preocupó de esa junta?' }, '¿Qué fue lo que más te preocupó de esa junta?'),
      true
    );

    // Exclusión de errores técnicos (incluyendo mensajes previos con ERROR DE SERVIDOR)
    assert.equal(isTechnicalErrorMessage({ id: 'msg_1_err', text: 'Algo' }), true);
    assert.equal(isTechnicalErrorMessage({ id: 'msg_2', isError: true, text: 'Algo' }), true);
    assert.equal(isTechnicalErrorMessage({ id: 'msg_3', text: MENTOR_TEMPORARY_ERROR_TEXT }), true);
    assert.equal(
      isTechnicalErrorMessage({ id: 'msg_4', text: 'ERROR DE SERVIDOR (Gemini API 503): This operation was aborted' }),
      true
    );
    assert.equal(
      isTechnicalErrorMessage({ id: 'msg_5', sender: 'lidacta', text: '¿Qué acuerdos previos tenían?' }),
      false
    );

    // Confirmar uso de isValidMentorApiResponse e isTechnicalErrorMessage en todos los puntos de recepción/filtro de LidactaContext
    const contextSrc = fs.readFileSync(path.resolve('src/context/LidactaContext.tsx'), 'utf-8');
    const validResponseCalls = (contextSrc.match(/isValidMentorApiResponse\(response,\s*data,\s*resolvedReply\)/g) || []).length;
    assert.equal(validResponseCalls, 5, 'Los 4 puntos del diagnóstico + verificación Etapa 6 deben usar isValidMentorApiResponse');
    const techFilterCalls = (contextSrc.match(/isTechnicalErrorMessage\(m\)/g) || []).length;
    assert.equal(techFilterCalls, 3, 'Los 3 filtros de historial en LidactaContext deben usar isTechnicalErrorMessage');
  });

  it('6. Liberación de isSendingMessage en todos los flujos que invocan /api/mentor/respond', () => {
    const contextSrc = fs.readFileSync(path.resolve('src/context/LidactaContext.tsx'), 'utf-8');
    const setTrueCount = (contextSrc.match(/setIsSendingMessage\(true\)/g) || []).length;
    const finallyResetCount = (contextSrc.match(/finally\s*\{\s*setIsSendingMessage\(false\);/g) || []).length;
    assert.equal(setTrueCount, 5);
    assert.equal(finallyResetCount, 5, 'Cada setIsSendingMessage(true) debe liberarse en su bloque finally');
  });

  it('7. Protección contra doble inicio en handleStartChallenge de LeaderView.tsx', () => {
    const leaderViewSrc = fs.readFileSync(path.resolve('src/components/LeaderView.tsx'), 'utf-8');
    assert.ok(leaderViewSrc.includes('isStartingChallengeRef = useRef(false)'));
    assert.ok(
      leaderViewSrc.includes(
        'if (!newChallengePrompt.trim() || isStartingNew || isSendingMessage || isStartingChallengeRef.current) return;'
      )
    );
    assert.ok(leaderViewSrc.includes('isStartingChallengeRef.current = true;'));
    assert.ok(leaderViewSrc.includes('isStartingChallengeRef.current = false;\n      setIsStartingNew(false);'));
  });
});
