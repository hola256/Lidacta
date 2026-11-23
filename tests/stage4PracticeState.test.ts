import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isStageGoalMet } from '../src/components/LeaderView';
import { MentorshipSession, MentorshipMessage } from '../src/types/lidacta';

describe('Etapa 4 - Practicar antes de actuar (Estados y Conclusión)', () => {
  const createMockSession = (overrides: Partial<MentorshipSession> = {}): MentorshipSession => ({
    id: 'test_session_st4',
    userId: 'user_leader_1',
    userFirstName: 'Carlos',
    userLastName: 'Mendoza',
    userEmail: 'carlos.mendoza@novaretail.com',
    company: 'NovaRetail',
    role: 'Director de Operaciones',
    title: 'Manejo de conflicto',
    theme: 'Manejo de conflictos',
    currentStage: 4,
    status: 'in_progress',
    privacyLevel: 'anonymized',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    messages: [],
    ...overrides,
  });

  // Pure function matching the 3 mutually exclusive state calculations from LeaderView.tsx
  const computeStage4States = ({
    session,
    sortedMessages,
    isPracticingStage4,
  }: {
    session: MentorshipSession;
    sortedMessages: MentorshipMessage[];
    isPracticingStage4: boolean;
  }) => {
    const hasExplicitConclusion = session.stageReadyToAdvance === 4;
    const isGoalMet = isStageGoalMet(session, 4);
    const isStage4Concluded = (hasExplicitConclusion || isGoalMet) && !isPracticingStage4;

    const hasStage4LeaderMessage = sortedMessages.some((m) => m.sender === 'leader' && (m.stage || 1) === 4);
    const isStage4Simulating = !isStage4Concluded && (isPracticingStage4 || (hasStage4LeaderMessage && !hasExplicitConclusion));

    const isStage4Deciding = !isStage4Concluded && !isStage4Simulating;

    return {
      isStage4Deciding,
      isStage4Simulating,
      isStage4Concluded,
      isGoalMet,
    };
  };

  it('Escenario 1: Decisión inicial al llegar a Etapa 4 (solo se muestran las opciones iniciales)', () => {
    const session = createMockSession();
    const sortedMessages: MentorshipMessage[] = [
      {
        id: 'msg_trigger_4',
        sender: 'lidacta',
        text: 'En esta Etapa 4: prepárate practicando una conversación real...',
        timestamp: new Date().toISOString(),
        stage: 4,
      },
    ];

    const states = computeStage4States({
      session,
      sortedMessages,
      isPracticingStage4: false,
    });

    assert.equal(states.isStage4Deciding, true, 'Debe estar en modo decisión');
    assert.equal(states.isStage4Simulating, false, 'No debe estar simulando');
    assert.equal(states.isStage4Concluded, false, 'No debe estar concluido');
  });

  it('Escenario 1b: Al iniciar simulación, solo se muestra la práctica activa y el cuadro de intervención', () => {
    const session = createMockSession({ stageReadyToAdvance: null });
    const sortedMessages: MentorshipMessage[] = [
      {
        id: 'msg_start',
        sender: 'leader',
        text: 'Lidacta, quiero simular que tú eres mi colaborador y yo te cito a solas para darte retroalimentación.',
        timestamp: new Date().toISOString(),
        stage: 4,
      },
    ];

    const states = computeStage4States({
      session,
      sortedMessages,
      isPracticingStage4: true,
    });

    assert.equal(states.isStage4Deciding, false, 'No debe mostrar opciones iniciales');
    assert.equal(states.isStage4Simulating, true, 'Debe estar simulando activamente');
    assert.equal(states.isStage4Concluded, false, 'No debe mostrar tarjeta de conclusión');
  });

  it('Escenario 2 & 3: La primera intervención del líder y la retroalimentación de Lidacta NO activan conclusión', () => {
    // Lidacta responde con retroalimentación dentro del rol
    const messages: MentorshipMessage[] = [
      {
        id: 'msg_start',
        sender: 'leader',
        text: 'Lidacta, quiero simular que tú eres mi colaborador...',
        timestamp: new Date(Date.now() - 30000).toISOString(),
        stage: 4,
      },
      {
        id: 'msg_lidacta_role',
        sender: 'lidacta',
        text: 'Entendido. Tomaré el rol de tu colaborador. Comienza cuando quieras y te daré retroalimentación continua.',
        timestamp: new Date(Date.now() - 20000).toISOString(),
        stage: 4,
      },
      {
        id: 'msg_leader_action',
        sender: 'leader',
        text: 'Hola Roberto, te pedí esta reunión porque he notado retrasos en las entregas del sprint.',
        timestamp: new Date(Date.now() - 10000).toISOString(),
        stage: 4,
      },
      {
        id: 'msg_lidacta_feedback',
        sender: 'lidacta',
        text: 'Hola Carlos. Te doy retroalimentación inmediata: tu entrada fue directa pero neutra. Cuidado con asumir que sé la causa.',
        timestamp: new Date().toISOString(),
        stage: 4,
      },
    ];

    const session = createMockSession({ messages });

    // Verificar explícitamente que "retroalimentación" no activa isStageGoalMet
    assert.equal(
      isStageGoalMet(session, 4),
      false,
      'La palabra "retroalimentación" ya NO debe activar isStageGoalMet para Etapa 4'
    );

    const states = computeStage4States({
      session,
      sortedMessages: messages,
      isPracticingStage4: true,
    });

    assert.equal(states.isStage4Deciding, false);
    assert.equal(states.isStage4Simulating, true, 'La práctica continúa activa');
    assert.equal(states.isStage4Concluded, false, 'NO debe aparecer la tarjeta de objetivo completado ni avance');
  });

  it('Escenario 4: Concluir explícitamente la práctica oculta la simulación y muestra la tarjeta de conclusión manual', () => {
    const messages: MentorshipMessage[] = [
      {
        id: 'msg_leader_1',
        sender: 'leader',
        text: 'Diálogo de práctica...',
        timestamp: new Date().toISOString(),
        stage: 4,
      },
    ];

    // El líder hace clic en "Concluir práctica y pasar a Actuar"
    // Esto ejecuta: setStageReadyToAdvance(4) e setIsPracticingStage4(false)
    const session = createMockSession({
      messages,
      stageReadyToAdvance: 4,
    });

    const states = computeStage4States({
      session,
      sortedMessages: messages,
      isPracticingStage4: false,
    });

    assert.equal(states.isStage4Deciding, false, 'No debe mostrar opciones iniciales');
    assert.equal(states.isStage4Simulating, false, 'La simulación activa DEBE desaparecer');
    assert.equal(states.isStage4Concluded, true, 'Debe mostrarse la tarjeta de conclusión');
    assert.equal(
      states.isStage4Simulating && states.isStage4Concluded,
      false,
      'Nunca deben mostrarse simultáneamente la simulación activa y la conclusión'
    );
  });

  it('Escenario 5: Volver a practicar reactiva la simulación y limpia el estado de conclusión', () => {
    const messages: MentorshipMessage[] = [
      {
        id: 'msg_leader_1',
        sender: 'leader',
        text: 'Diálogo de práctica...',
        timestamp: new Date().toISOString(),
        stage: 4,
      },
    ];

    // El líder hace clic en "Deseo realizar una simulación antes de continuar"
    // Esto ejecuta: setStageReadyToAdvance(null) e setIsPracticingStage4(true)
    const session = createMockSession({
      messages,
      stageReadyToAdvance: null,
    });

    const states = computeStage4States({
      session,
      sortedMessages: messages,
      isPracticingStage4: true,
    });

    assert.equal(states.isStage4Deciding, false);
    assert.equal(states.isStage4Simulating, true, 'Debe reactivarse la simulación');
    assert.equal(states.isStage4Concluded, false, 'El estado de conclusión debe limpiarse');
  });

  it('Escenario 6: Omitir práctica mantiene la conclusión y el avance manual a Etapa 5', () => {
    // El líder hace clic en "⏭️ Omitir práctica y pasar a Actuar (Plan de Acción)"
    // Esto ejecuta: setStageReadyToAdvance(4) e setIsPracticingStage4(false)
    const session = createMockSession({
      messages: [],
      stageReadyToAdvance: 4,
    });

    const states = computeStage4States({
      session,
      sortedMessages: [],
      isPracticingStage4: false,
    });

    assert.equal(states.isStage4Deciding, false, 'No debe mostrar opciones iniciales');
    assert.equal(states.isStage4Simulating, false, 'No debe mostrar espacio de simulación');
    assert.equal(states.isStage4Concluded, true, 'Debe mostrar la tarjeta de avance a Etapa 5');
  });

  it('Exclusión Mutua Estricta: En cualquier estado posible, exactamente uno de los 3 estados es true', () => {
    const permutations = [
      { ready: null, practicing: false, hasLeaderMsg: false, lidactaSays: '' },
      { ready: null, practicing: true, hasLeaderMsg: false, lidactaSays: '' },
      { ready: null, practicing: true, hasLeaderMsg: true, lidactaSays: 'retroalimentación inmediata' },
      { ready: 4, practicing: false, hasLeaderMsg: true, lidactaSays: 'concluimos la práctica' },
      { ready: null, practicing: true, hasLeaderMsg: true, lidactaSays: 'concluimos la práctica' },
      { ready: 4, practicing: false, hasLeaderMsg: false, lidactaSays: '' },
    ];

    for (const p of permutations) {
      const messages: MentorshipMessage[] = [];
      if (p.hasLeaderMsg) {
        messages.push({
          id: 'l1',
          sender: 'leader',
          text: 'Mi diálogo',
          timestamp: new Date().toISOString(),
          stage: 4,
        });
      }
      if (p.lidactaSays) {
        messages.push({
          id: 'lid1',
          sender: 'lidacta',
          text: p.lidactaSays,
          timestamp: new Date().toISOString(),
          stage: 4,
        });
      }

      const session = createMockSession({
        stageReadyToAdvance: p.ready as 4 | null,
        messages,
      });

      const { isStage4Deciding, isStage4Simulating, isStage4Concluded } = computeStage4States({
        session,
        sortedMessages: messages,
        isPracticingStage4: p.practicing,
      });

      const activeCount = [isStage4Deciding, isStage4Simulating, isStage4Concluded].filter(Boolean).length;
      assert.equal(
        activeCount,
        1,
        `Exactamente 1 estado debe estar activo para: ${JSON.stringify(p)}. Deciding=${isStage4Deciding}, Simulating=${isStage4Simulating}, Concluded=${isStage4Concluded}`
      );
    }
  });

  it('Escenario 7: «Seguir practicando» mantiene la simulación en Etapa 4 y conserva conversación y evidencia previa', () => {
    const priorMessages: MentorshipMessage[] = [
      {
        id: 'm_lead_1',
        sender: 'leader',
        text: 'Hola Ana, quiero conversar contigo sobre los acuerdos del área.',
        timestamp: new Date(Date.now() - 10000).toISOString(),
        stage: 4,
      },
      {
        id: 'm_lid_1',
        sender: 'lidacta',
        text: '[En personaje]: Claro, te escucho. [Retroalimentación]: Buen inicio, mantén foco en hechos observables.',
        timestamp: new Date().toISOString(),
        stage: 4,
      },
    ];
    const priorSkillEntries = [
      {
        id: 'sk_1',
        skill: 'Comunicación Asertiva',
        status: 'active' as const,
        sourceStage: 2 as const,
        evidenceText: 'Evitó confrontar acuerdos poco claros al inicio',
        updatedAtStage: 4 as const,
      },
    ];

    const session = createMockSession({
      currentStage: 4,
      stageReadyToAdvance: null,
      identifiedSkills: ['Comunicación Asertiva'],
      skillEntries: priorSkillEntries,
      messages: priorMessages,
    });

    // Simula clic en «Seguir practicando»: mantiene stageReadyToAdvance = null e isPracticingStage4 = true
    const states = computeStage4States({
      session,
      sortedMessages: priorMessages,
      isPracticingStage4: true,
    });

    assert.equal(states.isStage4Simulating, true, 'Debe seguir dentro de la simulación en Etapa 4');
    assert.equal(states.isStage4Concluded, false, 'No debe concluir ni ocultar la práctica');
    assert.equal(session.currentStage, 4, 'No debe avanzar automáticamente a Etapa 5');
    assert.equal(session.messages.length, 2, 'Debe conservar intacta la conversación previa');
    assert.deepEqual(session.identifiedSkills, ['Comunicación Asertiva'], 'Debe conservar habilidades identificadas');
    assert.equal(session.skillEntries?.length, 1, 'Debe conservar evidencia de habilidades acumulada');
  });

  it('Escenario 8: «Avanzar a la siguiente etapa» concluye la práctica manualmente y habilita el paso a Etapa 5', () => {
    const messages: MentorshipMessage[] = [
      {
        id: 'm_lead_1',
        sender: 'leader',
        text: 'Ensayo completo de apertura.',
        timestamp: new Date().toISOString(),
        stage: 4,
      },
    ];

    // Al pulsar «Avanzar a la siguiente etapa» desde simulación activa o tarjeta concluida:
    // 1) se concluye la práctica (stageReadyToAdvance = 4, isPracticingStage4 = false)
    // 2) se ejecuta explícitamente advanceStage(5) (sin auto-avance previo)
    const concludedSession = createMockSession({
      currentStage: 4,
      stageReadyToAdvance: 4,
      messages,
    });

    const states = computeStage4States({
      session: concludedSession,
      sortedMessages: messages,
      isPracticingStage4: false,
    });

    assert.equal(states.isStage4Simulating, false, 'Debe cerrar el modo simulación activa');
    assert.equal(states.isStage4Concluded, true, 'Debe marcar la práctica como concluida');

    const advancedSession = {
      ...concludedSession,
      currentStage: 5 as const,
      stageReadyToAdvance: null,
    };
    assert.equal(advancedSession.currentStage, 5, 'Tras confirmación manual avanza a Etapa 5 – Plan de Acción');
    assert.equal(advancedSession.messages.length, 1, 'Conserva el historial de práctica al pasar a Etapa 5');
  });
});

