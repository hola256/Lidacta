import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import handler, { generateContextualCoachReply } from '../api/mentor/respond';

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

async function invokeHandlerWithMockGemini(
  reqBody: any,
  geminiReplyObj: Record<string, any> = {
    replyText: 'Respuesta de prueba de Lidacta.',
    readyToAdvance: false,
    advancePrompt: null,
    identifiedSkills: [],
    detectedTheme: 'Liderazgo',
    isTherapeuticCase: false,
    therapeuticReason: null,
  }
) {
  const originalFetch = globalThis.fetch;
  const originalApiKey = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = 'test-dummy-gemini-key';

  let capturedPayload: any = null;

  globalThis.fetch = (async (_url: any, init: any) => {
    capturedPayload = JSON.parse(init.body);
    return {
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [{ text: JSON.stringify(geminiReplyObj) }],
            },
          },
        ],
      }),
      text: async () => '',
    } as any;
  }) as any;

  try {
    const req = { method: 'POST', body: reqBody };
    const res = createMockRes();
    await handler(req, res);
    return { res, capturedPayload };
  } finally {
    globalThis.fetch = originalFetch;
    if (originalApiKey === undefined) {
      delete process.env.GEMINI_API_KEY;
    } else {
      process.env.GEMINI_API_KEY = originalApiKey;
    }
  }
}

describe('Bloque 1A: Paridad Conversacional en api/mentor/respond.ts', () => {
  it('1. Aclaración o corrección del líder reorienta el foco sin arrastrar el anclaje anterior y mantiene intacto el systemPrompt global', async () => {
    const { res, capturedPayload } = await invokeHandlerWithMockGemini(
      {
        caseId: 'case_corr_1',
        stage: 1,
        leaderProfile: { name: 'Sofía Martínez', position: 'Gerente de Operaciones' },
        companyContext: { name: 'Empresa Demo' },
        conversationHistory: [
          {
            id: 'm1',
            caseId: 'case_corr_1',
            sender: 'leader',
            stage: 1,
            text: 'Como gerente me cuesta mucho lo que pasa en mi área.',
          },
          {
            id: 'm2',
            caseId: 'case_corr_1',
            sender: 'lidacta',
            stage: 1,
            text: 'Lamento la tensión con tu jefe en ese momento.',
          },
        ],
        userMessage:
          'Te confundiste, yo soy la gerente y no tengo problema con mi jefe; mi preocupación real es que no sé delegar decisiones a mi equipo.',
      },
      {
        replyText: 'Gracias por aclararlo, Sofía. Enfoquémonos en cómo delegar decisiones a tu equipo.',
        readyToAdvance: false,
        advancePrompt: null,
        identifiedSkills: [],
        detectedTheme: 'Delegación y Claridad de Roles',
      }
    );

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);

    const sysText = capturedPayload?.systemInstruction?.parts?.[0]?.text || '';
    assert.ok(sysText.includes('ERES LIDACTA: Mentora ejecutiva Senior'));
    assert.ok(sysText.includes('1. GUARDRAILS Y LÍMITES OPERATIVOS INAMOVIBLES'));
    assert.ok(sysText.includes('3. FLUJO OPERATIVO DE 7 ETAPAS (DINÁMICO Y FLEXIBLE)'));

    const lastUserTurn =
      capturedPayload.contents[capturedPayload.contents.length - 1]?.parts?.[0]?.text || '';
    assert.ok(lastUserTurn.includes('=== ÚLTIMO MENSAJE DEL LÍDER (PRIORITARIO) ==='));
    assert.ok(lastUserTurn.includes('no sé delegar decisiones a mi equipo'));
    assert.ok(
      lastUserTurn.includes('reorienta el 100% de la conversación hacia esa preocupación real')
    );

    // Verificar también la lógica contextual local para Etapa 1 tras corrección sustantiva
    const localReply = generateContextualCoachReply(
      1,
      'Sofía',
      'Te confundiste, yo soy la gerente y no tengo problema con mi jefe; mi preocupación real es que no sé delegar decisiones a mi equipo.',
      [
        {
          id: 'm1',
          sender: 'leader',
          stage: 1,
          text: 'Como gerente tengo tensión en el área.',
        },
        {
          id: 'm2',
          sender: 'lidacta',
          stage: 1,
          text: '¿Qué pasó con tu jefe en la junta?',
        },
      ]
    );

    assert.equal(localReply.detectedTheme, 'Delegación y Claridad de Roles');
    assert.ok(!localReply.replyText.toLowerCase().includes('abuso de autoridad'));
    assert.ok(localReply.replyText.toLowerCase().includes('delegar'));
    assert.equal(localReply.readyToAdvance, false);
  });

  it('2. Mensajes válidos del historial sin caseId no se pierden; solo se excluyen mensajes de otro caso', async () => {
    const { capturedPayload } = await invokeHandlerWithMockGemini({
      caseId: 'case_active_200',
      stage: 2,
      leaderProfile: { name: 'Carlos Ruiz', position: 'Jefe de Planta' },
      conversationHistory: [
        {
          id: 'msg_other_case',
          caseId: 'case_foreign_999',
          sender: 'leader',
          stage: 1,
          text: 'Mensaje confidencial de otro caso distinto.',
        },
        {
          id: 'msg_legacy_no_caseid_1',
          sender: 'leader',
          stage: 1,
          text: 'Mi equipo depende demasiado de mí para aprobar turnos.',
        },
        {
          id: 'msg_legacy_no_caseid_2',
          sender: 'lidacta',
          stage: 1,
          text: 'Comprendo, ¿en qué tipo de turnos ocurre con más frecuencia?',
        },
        {
          id: 'msg_same_case',
          caseId: 'case_active_200',
          sender: 'leader',
          stage: 2,
          text: 'En los cambios de turno de fin de semana siempre me llaman.',
        },
      ],
      userMessage: 'Creo que me cuesta confiar en que decidan bien sin mí.',
    });

    const allSentText = capturedPayload.contents
      .map((c: any) => c.parts.map((p: any) => p.text).join(' '))
      .join('\n');

    assert.ok(allSentText.includes('Mi equipo depende demasiado de mí para aprobar turnos.'));
    assert.ok(allSentText.includes('Comprendo, ¿en qué tipo de turnos ocurre con más frecuencia?'));
    assert.ok(allSentText.includes('En los cambios de turno de fin de semana siempre me llaman.'));
    assert.ok(!allSentText.includes('Mensaje confidencial de otro caso distinto.'));
  });

  it('3. Mensajes técnicos de error se excluyen del historial enviado al modelo y del reto inicial', async () => {
    const { capturedPayload } = await invokeHandlerWithMockGemini({
      caseId: 'case_err_filter_3',
      stage: 2,
      leaderProfile: { name: 'Ana López', position: 'Gerente' },
      conversationHistory: [
        {
          id: 'm_err_1',
          caseId: 'case_err_filter_3',
          sender: 'lidacta',
          stage: 1,
          text: 'ERROR DE SERVIDOR: timeout en modelo principal.',
        },
        {
          id: 'm_err_2',
          caseId: 'case_err_filter_3',
          isError: true,
          sender: 'lidacta',
          stage: 1,
          text: 'Fallo temporal de red.',
        },
        {
          id: 'm_err_3',
          caseId: 'case_err_filter_3',
          sender: 'lidacta',
          stage: 1,
          text: 'Lidacta no pudo responder en este momento, por favor reintenta.',
        },
        {
          id: 'm_valid_1',
          caseId: 'case_err_filter_3',
          sender: 'leader',
          stage: 1,
          text: 'Dos supervisores no entregan a tiempo sus reportes semanales.',
        },
        {
          id: 'm_valid_2',
          caseId: 'case_err_filter_3',
          sender: 'lidacta',
          stage: 2,
          text: '¿Cómo crees que perciben ellos la claridad de los plazos?',
        },
      ],
      userMessage: 'Tal vez no he dejado claro qué es prioritario.',
    });

    const allSentText = capturedPayload.contents
      .map((c: any) => c.parts.map((p: any) => p.text).join(' '))
      .join('\n');

    assert.ok(!allSentText.includes('ERROR DE SERVIDOR'));
    assert.ok(!allSentText.includes('Fallo temporal de red'));
    assert.ok(!allSentText.includes('no pudo responder en este momento'));
    assert.ok(!allSentText.includes('por favor reintenta'));
    assert.ok(allSentText.includes('Dos supervisores no entregan a tiempo sus reportes semanales.'));
  });

  it('4. No repite preguntas ya contestadas, conserva turnos cortos consecutivos y aplica reglas anti-repetición', async () => {
    const { capturedPayload } = await invokeHandlerWithMockGemini({
      caseId: 'case_turn_seq_4',
      stage: 1,
      leaderProfile: { name: 'Luis Pérez', position: 'Director' },
      conversationHistory: [
        {
          id: 'u1',
          caseId: 'case_turn_seq_4',
          sender: 'leader',
          stage: 1,
          text: 'Sí, Juan llegó tarde tres veces y dijo que sí entregaría hoy el reporte.',
        },
        {
          id: 'u2',
          caseId: 'case_turn_seq_4',
          sender: 'leader',
          stage: 1,
          text: 'Sí',
        },
        {
          id: 'l1',
          caseId: 'case_turn_seq_4',
          sender: 'lidacta',
          stage: 1,
          text: '¿Ya hablaste con él sobre esas llegadas tarde?',
        },
      ],
      userMessage: 'Ya hablé con él ayer y acordamos revisar horarios el lunes.',
    });

    const historyUserText = capturedPayload.contents[0]?.parts?.[0]?.text || '';
    // Con el fix exacto (sin .includes), el turno corto consecutivo "Sí" NO debe descartarse
    assert.ok(historyUserText.includes('[Etapa 1 | LÍDER] Sí'));
    assert.ok(historyUserText.includes('\n\n---\n\n'));

    const lastUserTurn =
      capturedPayload.contents[capturedPayload.contents.length - 1]?.parts?.[0]?.text || '';
    assert.ok(
      lastUserTurn.includes('PROHIBIDO repetir preguntas que el líder ya respondió')
    );
    assert.ok(
      lastUserTurn.includes(
        'PROHIBIDO repetir síntesis, explicaciones previas o coletillas de cierre en turnos consecutivos'
      )
    );
    assert.ok(lastUserTurn.includes('REGLA CRÍTICA ANTI-CICLADO'));
  });

  it('5. Responde adecuadamente cuando el líder indica que ya contestó o que no entendió, y respeta pausas', async () => {
    const { capturedPayload, res } = await invokeHandlerWithMockGemini(
      {
        caseId: 'case_pause_5',
        stage: 1,
        leaderProfile: { name: 'Elena Gómez', position: 'Coordinadora' },
        conversationHistory: [
          {
            id: 'm1',
            caseId: 'case_pause_5',
            sender: 'leader',
            stage: 1,
            text: 'Mi equipo tiene fricciones entre ventas y almacén.',
          },
          {
            id: 'm2',
            caseId: 'case_pause_5',
            sender: 'lidacta',
            stage: 1,
            text: '¿Qué ocurrió en la última junta?',
          },
        ],
        userMessage: 'No entendí tu pregunta, mejor vamos más despacio porque no quiero avanzar todavía.',
      },
      {
        replyText: 'Vamos a tu ritmo, Elena. Te lo planteo más simple.',
        readyToAdvance: false,
        advancePrompt: null,
        identifiedSkills: [],
      }
    );

    const lastUserTurn =
      capturedPayload.contents[capturedPayload.contents.length - 1]?.parts?.[0]?.text || '';
    assert.ok(lastUserTurn.includes('REGLA CRÍTICA ANTI-CICLADO'));
    assert.ok(lastUserTurn.includes('respeta su ritmo, no empujes el avance de etapa'));
    assert.equal(res.body.readyToAdvance, false);

    // Validar comportamiento local directo para ambos casos:
    const confusionReply = generateContextualCoachReply(
      1,
      'Elena',
      'No entendí tu pregunta',
      [
        {
          sender: 'leader',
          stage: 1,
          text: 'Mi equipo se retrasa con las entregas semanales.',
        },
        {
          sender: 'lidacta',
          stage: 1,
          text: '¿Qué acuerdos previos existían?',
        },
      ]
    );
    assert.equal(confusionReply.detectedTheme, 'Clarificación de Pregunta');
    assert.equal(confusionReply.readyToAdvance, false);
    assert.ok(confusionReply.replyText.toLowerCase().includes('más clara'));

    const repeatedReply = generateContextualCoachReply(
      1,
      'Elena',
      'Ya te contesté eso hace dos mensajes',
      []
    );
    assert.equal(repeatedReply.detectedTheme, 'Clarificación de Causa Raíz');
    assert.equal(repeatedReply.readyToAdvance, false);
    assert.ok(repeatedReply.replyText.includes('para no hacerte repetir'));

    const pauseReply = generateContextualCoachReply(
      1,
      'Elena',
      'Espérate, no quiero avanzar todavía, quiero entender mejor',
      []
    );
    assert.equal(pauseReply.readyToAdvance, false);
    assert.equal(pauseReply.advancePrompt, null);
  });

  it('6. En Etapa 3 reconoce una decisión explícita, confirma la alternativa, evita seguir comparando/proponiendo y habilita el avance', async () => {
    const { capturedPayload, res } = await invokeHandlerWithMockGemini(
      {
        caseId: 'case_stage3_6',
        stage: 3,
        leaderProfile: { name: 'Marco Díaz', position: 'Gerente' },
        sessionData: {
          id: 'case_stage3_6',
          title: 'Delegación operativa',
          initialChallenge: 'Todo pasa por mí y necesito que decidan más.',
          leaderAlternatives: [
            'Definir umbrales claros de decisión por rol en una reunión 1 a 1',
            'Implementar tablero semanal de seguimiento sin aprobación previa',
          ],
        },
        conversationHistory: [
          {
            id: 's3_1',
            caseId: 'case_stage3_6',
            sender: 'lidacta',
            stage: 3,
            text: '¿Qué alternativas visualizas para resolver esto?',
          },
          {
            id: 's3_2',
            caseId: 'case_stage3_6',
            sender: 'leader',
            stage: 3,
            text: '1. Definir umbrales claros de decisión por rol. 2. Tablero semanal sin aprobación previa.',
          },
        ],
        userMessage: 'Me quedo con la primera opción de definir umbrales claros de decisión por rol.',
      },
      {
        replyText:
          'Excelente elección, Marco. Confirmamos tu ruta: definir umbrales claros de decisión por rol.',
        readyToAdvance: true,
        advancePrompt: 'Ir a Etapa 4: Practicar antes de actuar (opcional)',
        identifiedSkills: [],
      }
    );

    const lastUserTurn =
      capturedPayload.contents[capturedPayload.contents.length - 1]?.parts?.[0]?.text || '';
    assert.ok(lastUserTurn.includes('REGLA LOCAL DE ETAPA 3 (RECONOCIMIENTO DE DECISIONES):'));
    assert.ok(
      lastUserTurn.includes('PROHIBIDO seguir comparando ventajas y desventajas después de una decisión firme')
    );
    assert.ok(
      lastUserTurn.includes('PROHIBIDO proponer alternativas adicionales cuando el líder ya eligió')
    );
    assert.equal(res.body.readyToAdvance, true);
    assert.equal(res.body.advancePrompt, 'Ir a Etapa 4: Practicar antes de actuar (opcional)');

    // Validar la lógica determinística de Etapa 3
    const stage3Selected = generateContextualCoachReply(
      3,
      'Marco',
      'Me quedo con la primera opción de definir umbrales claros de decisión por rol.',
      [
        {
          sender: 'leader',
          stage: 3,
          text: '1. Definir umbrales claros de decisión por rol en una reunión 1 a 1\n2. Implementar tablero semanal de seguimiento',
        },
      ],
      {
        leaderAlternatives: [
          'Definir umbrales claros de decisión por rol en una reunión 1 a 1',
          'Implementar tablero semanal de seguimiento',
        ],
      }
    );

    assert.equal(stage3Selected.readyToAdvance, true);
    assert.ok(stage3Selected.advancePrompt);
    assert.ok(stage3Selected.replyText.includes('Confirmo tu decisión elegida'));
    assert.ok(stage3Selected.replyText.includes('tú eres quien decide y conduce la acción'));
    assert.ok(
      stage3Selected.replyText.toLowerCase().includes('definir umbrales claros de decisión')
    );
    assert.ok(!stage3Selected.replyText.includes('ventajas y desventajas'));

    // Y si expresa duda en Etapa 3, NO debe habilitar avance
    const stage3Doubt = generateContextualCoachReply(
      3,
      'Marco',
      'No sé cuál elegir todavía, me da miedo que no funcione.',
      [],
      {
        leaderAlternatives: [
          'Definir umbrales claros de decisión por rol en una reunión 1 a 1',
          'Implementar tablero semanal de seguimiento',
        ],
      }
    );
    assert.equal(stage3Doubt.readyToAdvance, false);
    assert.equal(stage3Doubt.advancePrompt, null);
  });

  it('7. La información de sesión enviada al modelo preserva skillEntries (incluidos estados/evidencias) y leaderAlternatives', async () => {
    const skillEntries = [
      {
        id: 'sk_1',
        skill: 'Delegación efectiva',
        status: 'activa',
        detectedStage: 2,
        evidenceHistory: [
          { stage: 2, text: 'Reconoce que centraliza aprobaciones operativas.' },
        ],
      },
      {
        id: 'sk_2',
        skill: 'Escucha activa',
        status: 'descartada',
        detectedStage: 2,
        discardReason: 'La causa raíz resultó ser control operativo y no falta de escucha.',
        evidenceHistory: [
          { stage: 2, text: 'Señal inicial en Etapa 2' },
          { stage: 3, text: 'Descartada en Etapa 3 tras evidencia de procesos' },
        ],
      },
    ];
    const leaderAlternatives = [
      'Definir matriz de decisiones por nivel',
      'Reunión semanal de seguimiento de acuerdos',
    ];

    const { capturedPayload } = await invokeHandlerWithMockGemini({
      caseId: 'case_ctx_7',
      stage: 3,
      leaderProfile: { name: 'Valeria Soto', position: 'Directora' },
      sessionData: {
        id: 'case_ctx_7',
        title: 'Autonomía de gerentes',
        initialChallenge: 'Mis gerentes me escalan decisiones operativas.',
        skillEntries,
        leaderAlternatives,
      },
      conversationHistory: [
        {
          id: 'c1',
          caseId: 'case_ctx_7',
          sender: 'lidacta',
          stage: 3,
          text: '¿Qué alternativas estás considerando?',
        },
      ],
      userMessage: 'Creo que la matriz de decisiones me ayudará mucho.',
    });

    const lastUserTurn =
      capturedPayload.contents[capturedPayload.contents.length - 1]?.parts?.[0]?.text || '';
    assert.ok(lastUserTurn.includes('Datos previos guardados de la sesión'));

    const jsonMatch = lastUserTurn.match(
      /Datos previos guardados de la sesión[^:]*:\n([\s\S]*?)\n\n=== ÚLTIMO MENSAJE DEL LÍDER/
    );
    assert.ok(jsonMatch && jsonMatch[1], 'Debe serializar safeSessionContext en el prompt');

    const sentSessionContext = JSON.parse(jsonMatch[1]);
    assert.deepEqual(sentSessionContext.leaderAlternatives, leaderAlternatives);
    assert.equal(sentSessionContext.skillEntries.length, 2);
    assert.equal(sentSessionContext.skillEntries[0].status, 'activa');
    assert.equal(
      sentSessionContext.skillEntries[0].evidenceHistory[0].text,
      'Reconoce que centraliza aprobaciones operativas.'
    );
    assert.equal(sentSessionContext.skillEntries[1].status, 'descartada');
    assert.equal(
      sentSessionContext.skillEntries[1].discardReason,
      'La causa raíz resultó ser control operativo y no falta de escucha.'
    );
  });
});
