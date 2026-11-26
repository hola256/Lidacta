import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import handler, { extractGeminiCandidateText } from '../api/mentor/respond';
import { stripSessionMessagesForApi } from '../src/context/LidactaContext';

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

describe('Bloque 1: Verificación de correcciones controladas', () => {
  it('1. Creación de caso en LidactaContext aplica stripSessionMessagesForApi(newSession) y conserva todos los datos requeridos por el backend', () => {
    const contextSource = fs.readFileSync(
      path.resolve(process.cwd(), 'src/context/LidactaContext.tsx'),
      'utf8'
    );
    assert.ok(
      contextSource.includes('sessionData: stripSessionMessagesForApi(newSession),'),
      'La creación de caso debe enviar sessionData: stripSessionMessagesForApi(newSession)'
    );
    const stripCalls = (contextSource.match(/stripSessionMessagesForApi\(/g) || []).length;
    assert.equal(stripCalls, 5, 'Los 5 flujos de /api/mentor/respond deben usar stripSessionMessagesForApi(');

    const newSession = {
      id: 'ment_new_123',
      leaderId: 'user_leader_1',
      companyId: 'comp_1',
      title: 'Delegación operativa con supervisores',
      initialChallenge: 'Mis supervisores me consultan cada decisión operativa menor.',
      currentStage: 1,
      status: 'active',
      createdAt: '2026-11-26T00:00:00.000Z',
      lastActiveAt: '2026-11-26T00:00:00.000Z',
      identifiedSkills: [],
      skillEntries: [],
      leaderAlternatives: ['Definir matriz de decisiones'],
      actionPlan: null,
      messages: [
        {
          id: 'msg_1_lead',
          caseId: 'ment_new_123',
          mentorshipId: 'ment_new_123',
          sender: 'leader',
          text: 'Mis supervisores me consultan cada decisión operativa menor.',
          timestamp: '2026-11-26T00:00:00.000Z',
          stage: 1,
        },
      ],
    };

    const stripped = stripSessionMessagesForApi(newSession);
    assert.equal('messages' in stripped, false);
    assert.equal(stripped.id, newSession.id);
    assert.equal(stripped.title, newSession.title);
    assert.equal(stripped.initialChallenge, newSession.initialChallenge);
    assert.equal(stripped.currentStage, 1);
    assert.deepEqual(stripped.identifiedSkills, []);
    assert.deepEqual(stripped.skillEntries, []);
    assert.deepEqual(stripped.leaderAlternatives, ['Definir matriz de decisiones']);
    assert.equal(newSession.messages.length, 1, 'No debe mutar el objeto newSession usado en el estado de la UI');
  });

  it('2. server.ts incorpora suggestedAlternatives y chosenAlternative a safeSessionContext y filtra "error de servidor" respetando aislamiento por caso', async () => {
    const prevKey = process.env.GEMINI_API_KEY;
    process.env.GEMINI_API_KEY = 'test-block1-dev-key';
    const modUrl = new URL('../server.ts?block1Test=' + Date.now(), import.meta.url).href;
    const { app } = await import(modUrl);

    const originalFetch = globalThis.fetch;
    let capturedGeminiBody: any = null;

    globalThis.fetch = (async (_url: any, init: any) => {
      capturedGeminiBody = JSON.parse(init.body);
      return new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      replyText: 'Continuemos evaluando tus alternativas.',
                      readyToAdvance: false,
                    }),
                  },
                ],
              },
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }) as any;

    const server = http.createServer(app);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
    const address = server.address() as any;
    const baseUrl = `http://127.0.0.1:${address.port}`;

    try {
      const resp = await originalFetch(`${baseUrl}/api/mentor/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Connection: 'close' },
        body: JSON.stringify({
          caseId: 'case_active_b1',
          stage: 3,
          leaderProfile: { name: 'Ana Torres', position: 'Gerente' },
          companyContext: { name: 'Empresa Demo' },
          conversationHistory: [
            {
              id: 'm_foreign',
              caseId: 'case_foreign_999',
              sender: 'leader',
              text: 'MENSAJE_DE_OTRO_CASO_AJENO',
            },
            {
              id: 'm_err_server',
              caseId: 'case_active_b1',
              sender: 'lidacta',
              text: 'ERROR DE SERVIDOR (Gemini API 503): fallo previo',
            },
            {
              id: 'm_valid_active',
              caseId: 'case_active_b1',
              sender: 'leader',
              text: 'Necesito delegar revisiones semanales sin perder control de calidad.',
            },
          ],
          userMessage: 'Me inclino por implementar un checklist semanal.',
          sessionData: {
            id: 'case_active_b1',
            title: 'Delegación de revisiones',
            initialChallenge: 'Necesito delegar revisiones semanales sin perder control de calidad.',
            leaderAlternatives: ['Checklist semanal'],
            suggestedAlternatives: ['Aplicar modelo DELEGATE en 1 a 1', 'Definir tablero de seguimiento'],
            chosenAlternative: '  Aplicar modelo DELEGATE en 1 a 1  ',
          },
        }),
      });

      const json = await resp.json();
      assert.equal(resp.status, 200);
      assert.equal(json.success, true);

      const sentPromptText = capturedGeminiBody?.contents?.[0]?.parts?.[0]?.text || '';
      assert.ok(sentPromptText.includes('Necesito delegar revisiones semanales sin perder control de calidad.'));
      assert.ok(!sentPromptText.includes('MENSAJE_DE_OTRO_CASO_AJENO'), 'Debe mantener aislamiento estricto por caso');
      assert.ok(!sentPromptText.includes('ERROR DE SERVIDOR'), 'Debe excluir mensajes con "error de servidor"');

      const ctxMatch = sentPromptText.match(/Datos previos guardados:\s*(\{[\s\S]*?\})\n/);
      assert.ok(ctxMatch && ctxMatch[1], 'Debe serializar safeSessionContext en el prompt');
      const sentCtx = JSON.parse(ctxMatch[1]);
      assert.deepEqual(sentCtx.suggestedAlternatives, [
        'Aplicar modelo DELEGATE en 1 a 1',
        'Definir tablero de seguimiento',
      ]);
      assert.equal(sentCtx.chosenAlternative, 'Aplicar modelo DELEGATE en 1 a 1');
    } finally {
      globalThis.fetch = originalFetch;
      (server as any).closeAllConnections?.();
      await new Promise<void>((resolve) => server.close(() => resolve()));
      if (prevKey === undefined) {
        delete process.env.GEMINI_API_KEY;
      } else {
        process.env.GEMINI_API_KEY = prevKey;
      }
    }
  });

  it('3. server.ts limpia los temporizadores de 30s con clearTimeout tanto en respuesta exitosa como en timeout', async () => {
    const prevKey = process.env.GEMINI_API_KEY;
    process.env.GEMINI_API_KEY = 'test-block1-timer-key';
    const modUrl = new URL('../server.ts?block1Timers=' + Date.now(), import.meta.url).href;
    const { app } = await import(modUrl);

    const originalFetch = globalThis.fetch;
    const originalSetTimeout = globalThis.setTimeout;
    const originalClearTimeout = globalThis.clearTimeout;

    const scheduled30sTimers: any[] = [];
    const cleared30sTimers: any[] = [];
    let simulateImmediateTimeout = false;

    (globalThis as any).setTimeout = ((fn: any, ms?: number, ...args: any[]) => {
      if (ms === 30000) {
        const effectiveMs = simulateImmediateTimeout ? 15 : ms;
        const handle = originalSetTimeout(fn, effectiveMs, ...args);
        scheduled30sTimers.push(handle);
        return handle;
      }
      return originalSetTimeout(fn, ms, ...args);
    }) as any;

    (globalThis as any).clearTimeout = ((handle: any) => {
      if (scheduled30sTimers.includes(handle)) {
        cleared30sTimers.push(handle);
      }
      return originalClearTimeout(handle);
    }) as any;

    const server = http.createServer(app);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
    const address = server.address() as any;
    const baseUrl = `http://127.0.0.1:${address.port}`;

    try {
      // Escenario A: Respuesta exitosa en intento primario -> debe limpiar el timer de 30s inmediatamente
      simulateImmediateTimeout = false;
      globalThis.fetch = (async () =>
        new Response(
          JSON.stringify({
            candidates: [
              {
                content: {
                  parts: [{ text: JSON.stringify({ replyText: 'OK sin timeout', readyToAdvance: false }) }],
                },
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )) as any;

      const okResp = await originalFetch(`${baseUrl}/api/mentor/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Connection: 'close' },
        body: JSON.stringify({
          caseId: 'case_timer_ok',
          stage: 1,
          leaderProfile: { name: 'Sofía', position: 'Gerente' },
          userMessage: 'Mi equipo tiene dificultades para priorizar tareas.',
        }),
      });
      const okJson = await okResp.json();
      assert.equal(okResp.status, 200);
      assert.equal(okJson.success, true);
      assert.equal(scheduled30sTimers.length, 1);
      assert.equal(cleared30sTimers.length, 1, 'El temporizador de 30s debe limpiarse en respuesta exitosa');

      // Escenario B: Timeout en primario y fallback -> ambos temporizadores deben pasar por clearTimeout en finally
      scheduled30sTimers.length = 0;
      cleared30sTimers.length = 0;
      simulateImmediateTimeout = true;

      let pendingResolvers: Array<() => void> = [];
      globalThis.fetch = (async () =>
        new Promise<Response>((resolve) => {
          pendingResolvers.push(() =>
            resolve(
              new Response(
                JSON.stringify({ candidates: [{ content: { parts: [{ text: '{}' }] } }] }),
                { status: 200, headers: { 'Content-Type': 'application/json' } }
              )
            )
          );
        })) as any;

      const timeoutResp = await originalFetch(`${baseUrl}/api/mentor/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Connection: 'close' },
        body: JSON.stringify({
          caseId: 'case_timer_timeout',
          stage: 1,
          leaderProfile: { name: 'Sofía', position: 'Gerente' },
          userMessage: 'Mi equipo tiene dificultades para priorizar tareas.',
        }),
      });
      // Liberar promesas colgadas del mock fetch para no dejar handles abiertos
      for (const r of pendingResolvers) r();

      const timeoutJson = await timeoutResp.json();
      assert.equal(timeoutResp.status, 200);
      assert.equal(timeoutJson.success, true);
      assert.equal(scheduled30sTimers.length, 2, 'Deben crearse 2 temporizadores de 30s (primary + fallback)');
      assert.equal(cleared30sTimers.length, 2, 'Ambos temporizadores deben limpiarse mediante clearTimeout incluso en timeout');
    } finally {
      globalThis.setTimeout = originalSetTimeout;
      globalThis.clearTimeout = originalClearTimeout;
      globalThis.fetch = originalFetch;
      (server as any).closeAllConnections?.();
      await new Promise<void>((resolve) => server.close(() => resolve()));
      if (prevKey === undefined) {
        delete process.env.GEMINI_API_KEY;
      } else {
        process.env.GEMINI_API_KEY = prevKey;
      }
    }
  });

  it('4. api/mentor/respond.ts extrae partes textuales no-thought y mantiene fallback seguro', async () => {
    // Pruebas unitarias de extractGeminiCandidateText
    const withThoughtFirst = extractGeminiCandidateText({
      candidates: [
        {
          content: {
            parts: [
              { thought: true, text: 'Razonamiento interno del modelo que no es JSON.' },
              { text: JSON.stringify({ replyText: 'Respuesta válida tras pensamiento.', readyToAdvance: false }) },
            ],
          },
        },
      ],
    });
    assert.equal(
      JSON.parse(withThoughtFirst).replyText,
      'Respuesta válida tras pensamiento.'
    );

    const multiTextParts = extractGeminiCandidateText({
      candidates: [
        {
          content: {
            parts: [
              { thought: true, text: 'Pensamiento descartado.' },
              { text: '{"replyText":' },
              { text: '"Texto dividido en dos partes","readyToAdvance":false}' },
            ],
          },
        },
      ],
    });
    assert.equal(JSON.parse(multiTextParts).replyText, 'Texto dividido en dos partes');

    const onlyThoughtFallback = extractGeminiCandidateText({
      candidates: [
        {
          content: {
            parts: [{ thought: true, text: 'Fallback al primer texto si no hay otra parte' }],
          },
        },
      ],
    });
    assert.equal(onlyThoughtFallback, 'Fallback al primer texto si no hay otra parte');
    assert.equal(extractGeminiCandidateText({ candidates: [{ content: { parts: [] } }] }), '');

    // Prueba integral del handler en api/mentor/respond.ts con parte thought + parte JSON
    const originalFetch = globalThis.fetch;
    const originalKey = process.env.GEMINI_API_KEY;
    process.env.GEMINI_API_KEY = 'test-extract-key';

    globalThis.fetch = (async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [
                { thought: true, text: 'Análisis interno que rompería JSON.parse si se leyera parts[0]' },
                {
                  text: JSON.stringify({
                    replyText: '¿Qué resultado concreto esperas lograr con tu equipo esta semana?',
                    readyToAdvance: false,
                    advancePrompt: null,
                    identifiedSkills: [],
                  }),
                },
              ],
            },
          },
        ],
      }),
    })) as any;

    try {
      const req = {
        method: 'POST',
        body: {
          caseId: 'case_thought_extract',
          stage: 1,
          leaderProfile: { name: 'Laura', position: 'Directora' },
          companyContext: { name: 'Empresa Demo' },
          conversationHistory: [],
          userMessage: 'Necesito alinear prioridades con mis coordinadores.',
        },
      };
      const res = createMockRes();
      await handler(req, res);

      assert.equal(res.statusCode, 200);
      assert.equal(res.body.success, true);
      assert.equal(
        res.body.reply,
        '¿Qué resultado concreto esperas lograr con tu equipo esta semana?'
      );
      assert.equal(res.body.readyToAdvance, false);
    } finally {
      globalThis.fetch = originalFetch;
      if (originalKey === undefined) {
        delete process.env.GEMINI_API_KEY;
      } else {
        process.env.GEMINI_API_KEY = originalKey;
      }
    }
  });
});
