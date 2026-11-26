import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { stripSessionMessagesForApi } from '../src/context/LidactaContext';

describe('Fase 1: Cierre de brechas Producción / Desarrollo (Shadowing, sessionData.messages y Observabilidad)', () => {
  it('1. server.ts no hace shadowing de resolvedHistory y el catch global de Etapa 7 recibe el historial filtrado', async () => {
    const serverSource = fs.readFileSync(path.resolve(process.cwd(), 'server.ts'), 'utf8');
    assert.ok(serverSource.includes('let resolvedHistory: any[] = [];'), 'Debe existir la declaración externa de resolvedHistory');
    assert.ok(!serverSource.includes('let resolvedHistory = rawHistory.filter'), 'No debe existir shadowing con let resolvedHistory = rawHistory.filter');
    assert.ok(serverSource.includes('resolvedHistory = rawHistory.filter'), 'Debe reasignar directamente la variable externa resolvedHistory');

    const { app } = await import('../server');
    const routerStack = (app as any)._router?.stack || [];
    const mentorLayer = routerStack.find(
      (layer: any) => layer.route?.path === '/api/mentor/respond' && layer.route?.methods?.post
    );
    assert.ok(mentorLayer, 'Debe encontrarse la ruta POST /api/mentor/respond en Express');

    const routeHandler = mentorLayer.route.stack[mentorLayer.route.stack.length - 1].handle;

    // Provocar una excepción controlada después del filtrado de resolvedHistory (en sessionData.leaderAlternatives, línea ~314)
    // para entrar al catch global de Etapa 7 sin romper generateDeterministicCoaching.
    const throwingSessionData: any = {
      id: 'case_s7_shadow_test',
      currentStage: 7,
      actionPlan: { what: 'Conversación 1 a 1 con acuerdos escritos' },
      skillEntries: [
        {
          skill: 'Comunicación Asertiva y Firmeza Empática',
          cluster: 'comunicacion',
          status: 'vigente',
          initialStage: 2,
          evidenceHistory: [
            {
              id: 'ev_1',
              stage: 2,
              sourceType: 'experiencia_relatada',
              evidenceText: 'Reconoció que evita dar retroalimentación directa.',
              timestamp: '2026-11-25T00:00:00.000Z',
            },
          ],
          lastUpdatedStage: 2,
          createdAt: '2026-11-25T00:00:00.000Z',
          updatedAt: '2026-11-25T00:00:00.000Z',
        },
      ],
    };
    let leaderAltReads = 0;
    Object.defineProperty(throwingSessionData, 'leaderAlternatives', {
      enumerable: true,
      get() {
        leaderAltReads++;
        if (leaderAltReads === 1) {
          throw new Error('Error inesperado simulado después de filtrar resolvedHistory');
        }
        return [];
      },
    });

    let capturedStatus = 200;
    let capturedJson: any = null;
    const origError = console.error;
    console.error = () => {};
    try {
      await routeHandler(
        {
          method: 'POST',
          body: {
            caseId: 'case_s7_shadow_test',
            stage: 7,
            leaderProfile: { name: 'Sofía Martínez', position: 'Gerente' },
            companyContext: { name: 'Empresa Demo' },
            conversationHistory: [
              { id: 'm_foreign', caseId: 'other_case', sender: 'leader', text: 'Mensaje de otro caso' },
              { id: 'm_err', caseId: 'case_s7_shadow_test', isError: true, text: 'Error previo' },
              {
                id: 'm_valid_1',
                caseId: 'case_s7_shadow_test',
                sender: 'leader',
                text: 'Mi colaborador no respeta los acuerdos operativos del turno.',
              },
              {
                id: 'm_valid_2',
                caseId: 'case_s7_shadow_test',
                sender: 'lidacta',
                text: 'Gracias por compartirlo, Sofía.',
              },
            ],
            userMessage: 'Cerramos el acompañamiento.',
            sessionData: throwingSessionData,
          },
        },
        {
          status(code: number) {
            capturedStatus = code;
            return this;
          },
          json(payload: any) {
            capturedJson = payload;
            return this;
          },
        }
      );
    } finally {
      console.error = origError;
    }

    assert.equal(capturedStatus, 200);
    assert.equal(capturedJson?.success, true);
    assert.ok(capturedJson?.data?.finalFeedback, 'El catch global de Etapa 7 debe devolver finalFeedback');
    assert.ok(
      Array.isArray(capturedJson?.data?.finalFeedback?.stageTwoSkills) &&
        capturedJson.data.finalFeedback.stageTwoSkills.some((s: string) =>
          s.includes('Comunicación Asertiva')
        ),
      'El fallback de Etapa 7 debe conservar la información de habilidades de la sesión'
    );
  });

  it('2. stripSessionMessagesForApi elimina messages sin mutar el estado y LidactaContext conserva history/conversationHistory', () => {
    const originalSession = {
      id: 'case_123',
      title: 'Caso activo',
      currentStage: 3,
      identifiedSkills: ['Escucha Activa e Indagación'],
      skillEntries: [],
      messages: [
        { id: 'm1', sender: 'leader', text: 'Mensaje confidencial 1' },
        { id: 'm2', sender: 'lidacta', text: 'Respuesta 1' },
      ],
    };

    const stripped = stripSessionMessagesForApi(originalSession);
    assert.equal('messages' in stripped, false, 'sessionData serializable no debe contener messages');
    assert.equal(stripped.id, 'case_123');
    assert.deepEqual(stripped.identifiedSkills, ['Escucha Activa e Indagación']);
    assert.equal(originalSession.messages.length, 2, 'No debe mutar la sesión interna ni borrar mensajes de la UI');

    const contextSource = fs.readFileSync(
      path.resolve(process.cwd(), 'src/context/LidactaContext.tsx'),
      'utf8'
    );

    // Verificar que los flujos modificados mantienen conversationHistory y history, y usan stripSessionMessagesForApi
    const stripCallOccurrences = (contextSource.match(/stripSessionMessagesForApi\(/g) || []).length;
    assert.equal(stripCallOccurrences, 4, 'Deben existir exactamente 4 llamadas a stripSessionMessagesForApi(');
    assert.ok(contextSource.includes('conversationHistory,'), 'Debe seguir enviando conversationHistory');
    assert.ok(contextSource.includes('conversationHistory: isolatedExistingMessages,'), 'Debe seguir enviando conversationHistory en sesiones activas');
    assert.ok(contextSource.includes('history: isolatedExistingMessages,'), 'Debe seguir enviando history en sesiones activas');
    assert.ok(contextSource.includes('conversationHistory: isolatedMessages,'), 'Debe seguir enviando conversationHistory en avance de etapa');
    assert.ok(contextSource.includes('history: isolatedMessages,'), 'Debe seguir enviando history en avance de etapa');
  });

  it('3. server.ts emite [Lidacta Usage] en desarrollo por cada intento (primary y fallback) sin exponer información sensible', async () => {
    const prevKey = process.env.GEMINI_API_KEY;
    process.env.GEMINI_API_KEY = 'secret-test-key-9999';

    // Importar server.ts con query string para asegurar inicialización de `ai` con la clave de prueba
    const modUrl = new URL('../server.ts?usageTest=' + Date.now(), import.meta.url).href;
    const { app } = await import(modUrl);

    const originalFetch = globalThis.fetch;
    const capturedLogs: string[] = [];
    const origLog = console.log;
    const origWarn = console.warn;
    console.log = (...args: any[]) => capturedLogs.push(args.join(' '));
    console.warn = (...args: any[]) => capturedLogs.push(args.join(' '));

    let fetchCount = 0;
    globalThis.fetch = (async () => {
      fetchCount++;
      if (fetchCount === 1) {
        return new Response(
          JSON.stringify({
            error: {
              code: 503,
              message: 'Model overloaded with secret prompt leak check',
              status: 'UNAVAILABLE',
            },
          }),
          { status: 503, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return new Response(
        JSON.stringify({
          modelVersion: 'gemini-3.1-flash-lite',
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      replyText: 'Entiendo el reto que describes.',
                      readyToAdvance: false,
                    }),
                  },
                ],
              },
            },
          ],
          usageMetadata: {
            promptTokenCount: 410,
            candidatesTokenCount: 28,
            thoughtsTokenCount: 9,
            totalTokenCount: 447,
            cachedContentTokenCount: 64,
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }) as any;

    const server = http.createServer(app);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
    const address = server.address() as any;
    const baseUrl = `http://127.0.0.1:${address.port}`;

    const sensitiveMessage = 'MENSAJE_CONFIDENCIAL_DEL_LIDER_XYZ';
    const sensitiveEmail = 'lider.confidencial@empresa.test';

    try {
      const resp = await originalFetch(`${baseUrl}/api/mentor/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Connection: 'close' },
        body: JSON.stringify({
          caseId: 'case_obs_dev_1',
          stage: 2,
          leaderProfile: { name: 'Ana Confidencial', email: sensitiveEmail, position: 'Directora' },
          companyContext: { name: 'Empresa Privada SA' },
          conversationHistory: [
            { id: 'm1', caseId: 'case_obs_dev_1', sender: 'leader', text: 'Inicio confidencial' },
            { id: 'm2', caseId: 'case_obs_dev_1', sender: 'lidacta', text: 'Respuesta previa' },
          ],
          userMessage: sensitiveMessage,
        }),
      });
      const json = await resp.json();
      assert.equal(resp.status, 200);
      assert.equal(json.success, true);

      const usageLines = capturedLogs.filter((line) => line.startsWith('[Lidacta Usage] '));
      assert.equal(usageLines.length, 2, 'Debe registrar 1 evento [Lidacta Usage] para primary y 1 para fallback');

      const primaryLog = JSON.parse(usageLines[0].replace('[Lidacta Usage] ', ''));
      const fallbackLog = JSON.parse(usageLines[1].replace('[Lidacta Usage] ', ''));

      assert.equal(primaryLog.traceId, fallbackLog.traceId, 'Ambos intentos deben compartir el mismo traceId UUID');
      assert.match(primaryLog.traceId, /^[0-9a-f-]{8,}$/i);

      assert.equal(primaryLog.event, 'gemini_http_error');
      assert.equal(primaryLog.attempt, 1);
      assert.equal(primaryLog.attemptRole, 'primary');
      assert.equal(primaryLog.model, 'gemini-3.8-flash');
      assert.equal(primaryLog.status, 503);
      assert.equal(primaryLog.errorClassification, 'unavailable');
      assert.equal(primaryLog.stage, 2);
      assert.ok(primaryLog.systemPromptChars > 0);
      assert.ok(primaryLog.contentsChars > 0);
      assert.ok(primaryLog.requestBodyBytes > 0);
      assert.equal(typeof primaryLog.totalElapsedMs, 'number');

      assert.equal(fallbackLog.event, 'gemini_success');
      assert.equal(fallbackLog.attempt, 2);
      assert.equal(fallbackLog.attemptRole, 'fallback');
      assert.equal(fallbackLog.model, 'gemini-3.1-flash-lite');
      assert.equal(fallbackLog.usageMetadataAvailable, true);
      assert.equal(fallbackLog.promptTokenCount, 410);
      assert.equal(fallbackLog.candidatesTokenCount, 28);
      assert.equal(fallbackLog.thoughtsTokenCount, 9);
      assert.equal(fallbackLog.totalTokenCount, 447);
      assert.equal(fallbackLog.cachedContentTokenCount, 64);

      for (const line of usageLines) {
        assert.ok(!line.includes(sensitiveMessage), 'El log no debe contener mensajes del líder');
        assert.ok(!line.includes(sensitiveEmail), 'El log no debe contener datos personales');
        assert.ok(!line.includes('secret-test-key-9999'), 'El log no debe contener la API Key');
        assert.ok(!line.includes('ERES LIDACTA') && !line.includes('Eres LIDACTA'), 'El log no debe contener el System Prompt');
      }
    } finally {
      globalThis.fetch = originalFetch;
      console.log = origLog;
      console.warn = origWarn;
      (server as any).closeAllConnections?.();
      await new Promise<void>((resolve) => server.close(() => resolve()));
      if (prevKey === undefined) {
        delete process.env.GEMINI_API_KEY;
      } else {
        process.env.GEMINI_API_KEY = prevKey;
      }
    }
  });
});
