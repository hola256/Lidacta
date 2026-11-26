import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  acquireCaseOperationLock,
  releaseCaseOperationLock,
  parseAndValidateMentorApiResponse,
  executeTransactionalStageTransition,
  CaseOperationKind,
} from '../src/context/LidactaContext';
import {
  applyConfirmedTransitionOpenStages,
  executeActionPlanAndAdvanceToStage6,
} from '../src/components/LeaderView';
import {
  CompanyContext,
  MentorshipSession,
  NotificationItem,
  StageNumber,
  UserProfile,
} from '../src/types/lidacta';

const mockUser: UserProfile = {
  id: 'leader_test_1',
  name: 'Laura Gómez',
  email: 'laura.gomez@empresa-demo.com',
  role: 'leader',
  companyId: 'comp_1',
  companyName: 'Empresa Demo S.A.',
  area: 'Operaciones',
  position: 'Gerente de Planta',
};

const mockCompanies: CompanyContext[] = [
  {
    id: 'comp_1',
    name: 'Empresa Demo S.A.',
    industry: 'Manufactura',
    size: '250+',
    cultureValues: 'Respeto y rendición de cuentas',
    strategicPriorities: 'Autonomía de mandos medios',
    updatedAt: '2026-01-01',
  },
];

function createSession(overrides: Partial<MentorshipSession> = {}): MentorshipSession {
  return {
    id: 'case_A',
    leaderId: mockUser.id,
    leaderName: mockUser.name,
    companyId: 'comp_1',
    companyName: 'Empresa Demo S.A.',
    leaderArea: 'Operaciones',
    title: 'Delegación efectiva con supervisor',
    initialChallenge: 'Mi supervisor escala decisiones cotidianas.',
    currentStage: 1,
    theme: 'Delegación y Autonomía',
    status: 'active',
    priority: 'alta',
    startedAt: '2026-01-01T10:00:00.000Z',
    lastActiveAt: '2026-01-01T10:05:00.000Z',
    stageHistory: [
      {
        stage: 1,
        stageName: 'Detectar qué sucede',
        enteredAt: '2026-01-01T10:00:00.000Z',
      },
    ],
    messages: [
      {
        id: 'msg_1',
        caseId: 'case_A',
        mentorshipId: 'case_A',
        sender: 'leader',
        text: 'Mi supervisor escala decisiones cotidianas.',
        timestamp: '2026-01-01T10:00:00.000Z',
        stage: 1,
      },
    ],
    identifiedSkills: ['Delegación progresiva'],
    skillEntries: [
      {
        skill: 'Delegación progresiva',
        cluster: 'Delegación y Empoderamiento',
        initialStage: 2,
        lastUpdatedStage: 2,
        status: 'vigente',
        createdAt: '2026-01-01T10:05:00.000Z',
        updatedAt: '2026-01-01T10:05:00.000Z',
        evidenceHistory: [
          {
            id: 'ev_1',
            stage: 2,
            sourceType: 'experiencia_relatada',
            evidenceText: 'Siempre termino decidiendo por él.',
            timestamp: '2026-01-01T10:05:00.000Z',
          },
        ],
      },
    ],
    ...overrides,
  };
}

function createHarness(initialSessions: MentorshipSession[]) {
  let mentorships = initialSessions.map((s) => structuredClone(s));
  let notifications: NotificationItem[] = [];
  const activeCaseOperationsRef = { current: new Map<string, CaseOperationKind>() };
  const advancingState: Record<string, boolean> = {};
  const advancingTransitions: Array<{ caseId: string; advancing: boolean }> = [];
  const toasts: Array<{ message: string; type?: string }> = [];
  const emailCalls: Array<{ sessionId: string; report: any }> = [];
  const resourceLogs: any[] = [];

  const getSessionById = (caseId: string) => mentorships.find((m) => m.id === caseId);
  const commitMentorships = (updater: (prev: MentorshipSession[]) => MentorshipSession[]) => {
    mentorships = updater(mentorships);
    return mentorships;
  };
  const setCaseAdvancing = (caseId: string, advancing: boolean) => {
    advancingTransitions.push({ caseId, advancing });
    if (advancing) {
      advancingState[caseId] = true;
    } else {
      delete advancingState[caseId];
    }
  };
  const setNotifications = (updater: (prev: NotificationItem[]) => NotificationItem[]) => {
    notifications = updater(notifications);
  };

  return {
    getMentorships: () => mentorships,
    getSession: (id: string) => mentorships.find((m) => m.id === id),
    getNotifications: () => notifications,
    activeCaseOperationsRef,
    advancingState,
    advancingTransitions,
    toasts,
    emailCalls,
    resourceLogs,
    runAdvance: (
      activeCaseId: string,
      fetchImpl: typeof fetch,
      options?: { targetStage?: StageNumber; timeoutMs?: number }
    ) =>
      executeTransactionalStageTransition({
        activeCaseId,
        targetStage: options?.targetStage,
        getSessionById,
        commitMentorships,
        activeCaseOperationsRef,
        setCaseAdvancing,
        companies: mockCompanies,
        currentUser: mockUser,
        setNotifications,
        dispatchFinalFeedbackReportEmail: async (session, report) => {
          emailCalls.push({ sessionId: session.id, report });
          return { success: true, emailId: 'mock_email_1' };
        },
        recordResourceRecommendation: (res) => resourceLogs.push(res),
        autoDetectAndLogResources: () => {},
        showToast: (message, type) => toasts.push({ message: String(message), type }),
        fetchImpl,
        timeoutMs: options?.timeoutMs ?? 500,
      }),
  };
}

function okResponse(payload: any): Response {
  return {
    ok: true,
    status: 200,
    json: async () => payload,
  } as any;
}

describe('Bloque 3A.3 — Integridad transaccional de transiciones', () => {
  it('1. Transición exitosa avanza etapa tras validar servidor y libera bloqueo', async () => {
    const initial = createSession({ currentStage: 1 });
    const h = createHarness([initial]);

    let observedStageDuringFetch: StageNumber | undefined;
    const confirmed = await h.runAdvance('case_A', (async () => {
      observedStageDuringFetch = h.getSession('case_A')?.currentStage;
      assert.equal(h.advancingState['case_A'], true);
      assert.equal(h.activeCaseOperationsRef.current.get('case_A'), 'advance');
      return okResponse({
        success: true,
        reply: 'Pasemos a la Etapa 2 para analizar qué habilidades están en juego.',
        data: { replyText: 'Pasemos a la Etapa 2 para analizar qué habilidades están en juego.' },
      });
    }) as any);

    assert.equal(confirmed, true);
    assert.equal(observedStageDuringFetch, 1, 'La etapa NO debe cambiar mientras el fetch está en vuelo');
    const updated = h.getSession('case_A')!;
    assert.equal(updated.currentStage, 2);
    assert.equal(updated.status, 'active');
    assert.equal(updated.stageHistory.length, 2);
    assert.ok(updated.stageHistory[0].completedAt);
    assert.equal(updated.stageHistory[1].stage, 2);
    assert.equal(h.activeCaseOperationsRef.current.has('case_A'), false);
    assert.equal(Boolean(h.advancingState['case_A']), false);
  });

  it('2. Errores HTTP 500, 503 y 429 rechazan transición sin mutar la sesión', async () => {
    for (const statusCode of [500, 503, 429]) {
      const initial = createSession({ currentStage: 2 });
      const snapshotBefore = structuredClone(initial);
      const h = createHarness([initial]);

      const confirmed = await h.runAdvance('case_A', (async () => ({
        ok: false,
        status: statusCode,
        json: async () => ({ success: false, error: `HTTP ${statusCode}` }),
      })) as any);

      assert.equal(confirmed, false, `HTTP ${statusCode} debe retornar false`);
      assert.deepEqual(h.getSession('case_A'), snapshotBefore);
      assert.equal(h.getNotifications().length, 0);
      assert.equal(h.toasts.at(-1)?.type, 'error');
      assert.equal(h.activeCaseOperationsRef.current.has('case_A'), false);
      assert.equal(Boolean(h.advancingState['case_A']), false);
    }
  });

  it('3. Timeout y rechazo de red abortan limpiamente sin alterar estado', async () => {
    // 3A. Timeout mediante AbortController
    const hTimeout = createHarness([createSession({ currentStage: 3 })]);
    const beforeTimeout = structuredClone(hTimeout.getSession('case_A'));

    const timeoutConfirmed = await hTimeout.runAdvance(
      'case_A',
      ((_url: any, init: any) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            const err: any = new Error('Aborted');
            err.name = 'AbortError';
            reject(err);
          });
        })) as any,
      { timeoutMs: 25 }
    );

    assert.equal(timeoutConfirmed, false);
    assert.deepEqual(hTimeout.getSession('case_A'), beforeTimeout);
    assert.equal(hTimeout.activeCaseOperationsRef.current.has('case_A'), false);

    // 3B. Rechazo de red directo
    const hNet = createHarness([createSession({ currentStage: 3 })]);
    const beforeNet = structuredClone(hNet.getSession('case_A'));
    const netConfirmed = await hNet.runAdvance('case_A', (async () => {
      throw new TypeError('Failed to fetch');
    }) as any);

    assert.equal(netConfirmed, false);
    assert.deepEqual(hNet.getSession('case_A'), beforeNet);
    assert.equal(hNet.activeCaseOperationsRef.current.has('case_A'), false);
  });

  it('4. Respuestas 200 vacías, success:false, ERROR DE SERVIDOR o JSON malformado son rechazadas', async () => {
    const invalidPayloads: Array<{ label: string; response: any }> = [
      {
        label: 'JSON inválido que lanza error',
        response: {
          ok: true,
          status: 200,
          json: async () => {
            throw new SyntaxError('Unexpected token <');
          },
        },
      },
      {
        label: 'JSON no objeto (null)',
        response: okResponse(null),
      },
      {
        label: 'success explícito false',
        response: okResponse({ success: false, reply: 'Texto ignorado' }),
      },
      {
        label: 'respuesta vacía',
        response: okResponse({ success: true, reply: '   ' }),
      },
      {
        label: 'prefijo ERROR DE SERVIDOR',
        response: okResponse({ success: true, reply: 'ERROR DE SERVIDOR: 503 Unavailable' }),
      },
    ];

    for (const item of invalidPayloads) {
      const validation = await parseAndValidateMentorApiResponse(item.response);
      assert.equal(validation.valid, false, `Debe rechazar: ${item.label}`);

      const h = createHarness([createSession({ currentStage: 2 })]);
      const before = structuredClone(h.getSession('case_A'));
      const ok = await h.runAdvance('case_A', (async () => item.response) as any);
      assert.equal(ok, false, `advanceStage debe retornar false para: ${item.label}`);
      assert.deepEqual(h.getSession('case_A'), before);
    }
  });

  it('5. Doble clic, dos transiciones concurrentes y colisión mensaje+transición en el mismo caso ejecutan 1 sola petición', async () => {
    const h = createHarness([createSession({ currentStage: 1 })]);
    let fetchCount = 0;
    let releaseFetch!: () => void;
    const gate = new Promise<void>((resolve) => {
      releaseFetch = resolve;
    });

    const slowFetch = (async () => {
      fetchCount++;
      await gate;
      return okResponse({ success: true, reply: 'Avance confirmado a Etapa 2.' });
    }) as any;

    const p1 = h.runAdvance('case_A', slowFetch);
    const p2 = h.runAdvance('case_A', slowFetch);

    // Mientras la transición está activa, un intento de bloqueo de mensaje sobre el mismo caso es rechazado
    const msgLockAcquired = acquireCaseOperationLock(h.activeCaseOperationsRef.current, 'case_A', 'message');
    assert.equal(msgLockAcquired, false);

    releaseFetch();
    const [r1, r2] = await Promise.all([p1, p2]);

    assert.equal(r1, true);
    assert.equal(r2, false);
    assert.equal(fetchCount, 1);

    // Ahora simulamos un envío de mensaje activo que bloquea una transición simultánea sobre el mismo caso
    assert.equal(acquireCaseOperationLock(h.activeCaseOperationsRef.current, 'case_A', 'message'), true);
    let blockedFetchCount = 0;
    const blockedAdvance = await h.runAdvance('case_A', (async () => {
      blockedFetchCount++;
      return okResponse({ success: true, reply: 'No debería ejecutarse' });
    }) as any);
    assert.equal(blockedAdvance, false);
    assert.equal(blockedFetchCount, 0);
    releaseCaseOperationLock(h.activeCaseOperationsRef.current, 'case_A');
  });

  it('6. Operaciones simultáneas en casos diferentes no se bloquean entre sí', async () => {
    const sessionA = createSession({ id: 'case_A', currentStage: 1 });
    const sessionB = createSession({ id: 'case_B', currentStage: 2 });
    const h = createHarness([sessionA, sessionB]);

    let releaseA!: () => void;
    const gateA = new Promise<void>((resolve) => {
      releaseA = resolve;
    });

    const pA = h.runAdvance('case_A', (async () => {
      await gateA;
      return okResponse({ success: true, reply: 'Caso A -> Etapa 2' });
    }) as any);

    // Mientras Caso A está bloqueado esperando respuesta, Caso B avanza sin esperar
    const rB = await h.runAdvance('case_B', (async () => {
      assert.equal(h.advancingState['case_A'], true);
      assert.equal(h.advancingState['case_B'], true);
      return okResponse({ success: true, reply: 'Caso B -> Etapa 3' });
    }) as any);

    assert.equal(rB, true);
    assert.equal(h.getSession('case_B')?.currentStage, 3);
    assert.equal(h.getSession('case_A')?.currentStage, 1);

    releaseA();
    const rA = await pA;
    assert.equal(rA, true);
    assert.equal(h.getSession('case_A')?.currentStage, 2);
  });

  it('7 & 8. Reintento exitoso después de un fallo y liberación garantizada del bloqueo en todos los escenarios', async () => {
    const h = createHarness([createSession({ currentStage: 2 })]);

    const firstAttempt = await h.runAdvance('case_A', (async () => ({
      ok: false,
      status: 503,
      json: async () => ({ success: false }),
    })) as any);

    assert.equal(firstAttempt, false);
    assert.equal(h.getSession('case_A')?.currentStage, 2);
    assert.equal(h.activeCaseOperationsRef.current.has('case_A'), false);
    assert.equal(Boolean(h.advancingState['case_A']), false);

    const retryAttempt = await h.runAdvance('case_A', (async () =>
      okResponse({ success: true, reply: 'Recuperado en el reintento: Etapa 3.' })) as any);

    assert.equal(retryAttempt, true);
    assert.equal(h.getSession('case_A')?.currentStage, 3);
    assert.equal(h.activeCaseOperationsRef.current.has('case_A'), false);
    assert.equal(Boolean(h.advancingState['case_A']), false);

    // Caso inexistente tampoco deja residuos
    const missingAttempt = await h.runAdvance('non_existent', (async () => okResponse({})) as any);
    assert.equal(missingAttempt, false);
    assert.equal(h.activeCaseOperationsRef.current.size, 0);
  });

  it('9. Entrada inicial a Etapa 6 con pending_verification es local y sin fetch', async () => {
    const plan = {
      what: 'Conversar 1 a 1 con Roberto el lunes a las 9am',
      when: 'Lunes 9:00 AM',
      withWhom: 'Roberto',
      how: 'Con ejemplos concretos y preguntas abiertas',
      careReminders: 'Cuidar el tono sereno y validar compromiso',
      isCommitmentConfirmed: true,
    };
    const h = createHarness([
      createSession({
        currentStage: 5,
        status: 'in_action',
        actionPlan: plan,
        actionPlanExecutionStatus: undefined,
      }),
    ]);

    let fetchCalls = 0;
    const confirmed = await h.runAdvance(
      'case_A',
      (async () => {
        fetchCalls++;
        return okResponse({ success: true, reply: 'No debe llamarse' });
      }) as any,
      { targetStage: 6 }
    );

    assert.equal(confirmed, true);
    assert.equal(fetchCalls, 0);
    const updated = h.getSession('case_A')!;
    assert.equal(updated.currentStage, 6);
    assert.equal(updated.actionPlanExecutionStatus, 'pending_verification');
    assert.equal(updated.stage6ExecutionVerified, false);
    assert.ok(updated.messages.some((m) => m.stage === 6 && m.text.includes('¿Ya ejecutaste tu Plan de Acción?')));
    assert.equal(h.activeCaseOperationsRef.current.has('case_A'), false);
  });

  it('10. Reingreso a Etapa 6 cuando la verificación ya existe sí consulta al servidor y exige respuesta válida', async () => {
    const h = createHarness([
      createSession({
        currentStage: 5,
        status: 'in_action',
        actionPlanExecutionStatus: 'executed',
        stage6ExecutionVerified: true,
      }),
    ]);

    let fetchCalls = 0;
    const failedReentry = await h.runAdvance(
      'case_A',
      (async () => {
        fetchCalls++;
        return { ok: false, status: 500, json: async () => ({ success: false }) };
      }) as any,
      { targetStage: 6 }
    );
    assert.equal(fetchCalls, 1);
    assert.equal(failedReentry, false);
    assert.equal(h.getSession('case_A')?.currentStage, 5);

    const okReentry = await h.runAdvance(
      'case_A',
      (async () => {
        fetchCalls++;
        return okResponse({ success: true, reply: 'Retomamos tu reflexión en Etapa 6.' });
      }) as any,
      { targetStage: 6 }
    );
    assert.equal(fetchCalls, 2);
    assert.equal(okReentry, true);
    assert.equal(h.getSession('case_A')?.currentStage, 6);
    assert.equal(h.getSession('case_A')?.actionPlanExecutionStatus, 'executed');
  });

  it('11. Reapertura de etapa anterior conserva historial posterior, actionPlan, learnings, skillEntries e identifiedSkills', async () => {
    const richSession = createSession({
      currentStage: 6,
      status: 'active',
      actionPlan: {
        what: 'Acordar criterios de delegación',
        when: 'Martes 10am',
        withWhom: 'Ana',
        how: 'Escucha activa',
        careReminders: 'No interrumpir',
        isCommitmentConfirmed: true,
      },
      actionPlanExecutionStatus: 'executed',
      learnings: {
        whatHappened: 'Ana propuso su propio plan.',
        whatWorked: 'Hacer preguntas abiertas.',
        whatDidnt: '',
        insights: 'Soltar el control inmediato aumenta la iniciativa.',
        futureAdjustments: 'Revisiones semanales de 10 minutos.',
        sharedLearningWithHR: '',
      },
      stageHistory: [
        { stage: 1, stageName: 'Detectar qué sucede', enteredAt: '2026-01-01T10:00:00Z', completedAt: '2026-01-01T10:10:00Z' },
        { stage: 2, stageName: 'Analizar perspectivas y habilidades', enteredAt: '2026-01-01T10:10:00Z', completedAt: '2026-01-01T10:20:00Z' },
        { stage: 3, stageName: 'Diseñar alternativas', enteredAt: '2026-01-01T10:20:00Z', completedAt: '2026-01-01T10:30:00Z' },
        { stage: 4, stageName: 'Practicar antes de actuar', enteredAt: '2026-01-01T10:30:00Z', completedAt: '2026-01-01T10:40:00Z' },
        { stage: 5, stageName: 'Actuar (Plan de Acción)', enteredAt: '2026-01-01T10:40:00Z', completedAt: '2026-01-01T10:50:00Z' },
        { stage: 6, stageName: 'Aprender y reflexionar', enteredAt: '2026-01-01T10:50:00Z' },
      ],
    });

    const h = createHarness([richSession]);

    // 11A. Si falla la reapertura, permanece en Etapa 6 sin perder datos
    const failReopen = await h.runAdvance(
      'case_A',
      (async () => ({ ok: false, status: 503, json: async () => ({ success: false }) })) as any,
      { targetStage: 2 }
    );
    assert.equal(failReopen, false);
    assert.equal(h.getSession('case_A')?.currentStage, 6);

    // 11B. Si tiene éxito (incluso si backend responde skillEntries: [] en intro de Etapa 2), conserva todos los datos históricos
    const okReopen = await h.runAdvance(
      'case_A',
      (async () =>
        okResponse({
          success: true,
          reply: 'Reabrimos Etapa 2 para revisar perspectivas.',
          data: { skillEntries: [], identifiedSkills: [] },
        })) as any,
      { targetStage: 2 }
    );

    assert.equal(okReopen, true);
    const updated = h.getSession('case_A')!;
    assert.equal(updated.currentStage, 2);
    assert.equal(updated.status, 'active');
    assert.equal(updated.stageHistory.length, 6, 'No debe borrar el historial de etapas posteriores');
    assert.ok(updated.stageHistory.find((s) => s.stage === 5)?.completedAt);
    assert.deepEqual(updated.actionPlan, richSession.actionPlan);
    assert.deepEqual(updated.learnings, richSession.learnings);
    assert.deepEqual(updated.skillEntries, richSession.skillEntries);
    assert.deepEqual(updated.identifiedSkills, richSession.identifiedSkills);
  });

  it('12. Error de transición deja intactos currentStage, status, stageHistory, actionPlan, learnings, skillEntries e identifiedSkills', async () => {
    const fullSession = createSession({
      currentStage: 5,
      status: 'in_action',
      actionPlan: {
        what: 'Delegar reporte semanal',
        when: 'Viernes',
        withWhom: 'Equipo',
        how: 'Checklist breve',
        careReminders: 'Dar espacio',
        isCommitmentConfirmed: true,
      },
      actionPlanExecutionStatus: 'executed',
      learnings: {
        whatHappened: 'Avance inicial',
        whatWorked: 'Claridad de objetivo',
        whatDidnt: '',
        insights: 'Menos microgestión',
        futureAdjustments: '',
        sharedLearningWithHR: '',
      },
      stageHistory: [
        { stage: 1, stageName: 'Detectar qué sucede', enteredAt: '2026-01-01T10:00:00Z', completedAt: '2026-01-01T10:05:00Z' },
        { stage: 5, stageName: 'Actuar (Plan de Acción)', enteredAt: '2026-01-01T10:05:00Z' },
      ],
    });
    const baseline = structuredClone(fullSession);
    const h = createHarness([fullSession]);

    const ok = await h.runAdvance(
      'case_A',
      (async () => ({ ok: false, status: 500, json: async () => ({ success: false }) })) as any,
      { targetStage: 6 }
    );

    assert.equal(ok, false);
    const after = h.getSession('case_A')!;
    assert.equal(after.currentStage, baseline.currentStage);
    assert.equal(after.status, baseline.status);
    assert.deepEqual(after.stageHistory, baseline.stageHistory);
    assert.deepEqual(after.actionPlan, baseline.actionPlan);
    assert.deepEqual(after.learnings, baseline.learnings);
    assert.deepEqual(after.skillEntries, baseline.skillEntries);
    assert.deepEqual(after.identifiedSkills, baseline.identifiedSkills);
  });

  it('13. Acordeones no cambian ante transición fallida y entrada Etapa 5->6 respeta fallo de guardado', async () => {
    const initialAccordions: Record<StageNumber, boolean> = {
      1: false,
      2: true,
      3: false,
      4: false,
      5: false,
      6: false,
      7: false,
    };

    const unchanged = applyConfirmedTransitionOpenStages(initialAccordions, 2, 3, false);
    assert.deepEqual(unchanged, initialAccordions);

    const switched = applyConfirmedTransitionOpenStages(initialAccordions, 2, 3, true);
    assert.equal(switched[2], false);
    assert.equal(switched[3], true);

    // Flujo 5->6: si falla el guardado del Plan de Acción, NO invoca advanceStage(6)
    let advanceCalled = 0;
    const toasts: Array<{ msg: string; type?: string }> = [];
    let opened = false;
    const saveFailed = await executeActionPlanAndAdvanceToStage6({
      isActionPlanComplete: true,
      isCommitmentConfirmed: true,
      isAdvancingStage: false,
      isSendingMessage: false,
      saveActionPlan: () => false,
      advanceToStage6: async () => {
        advanceCalled++;
        return true;
      },
      showToast: (msg, type) => toasts.push({ msg, type }),
      onTransitionConfirmed: () => {
        opened = true;
      },
    });
    assert.equal(saveFailed, false);
    assert.equal(advanceCalled, 0);
    assert.equal(opened, false);
    assert.equal(toasts.at(-1)?.type, 'error');

    // Flujo 5->6: si guardado OK pero advanceStage(6) falla, NO abre acordeón ni muestra toast de éxito
    const advanceFailed = await executeActionPlanAndAdvanceToStage6({
      isActionPlanComplete: true,
      isCommitmentConfirmed: true,
      isAdvancingStage: false,
      isSendingMessage: false,
      saveActionPlan: () => true,
      advanceToStage6: async () => false,
      showToast: (msg, type) => toasts.push({ msg, type }),
      onTransitionConfirmed: () => {
        opened = true;
      },
    });
    assert.equal(advanceFailed, false);
    assert.equal(opened, false);
    assert.ok(!toasts.some((t) => t.type === 'success'));
  });

  it('14. Un error al avanzar a Etapa 7 jamás genera cierre prematuro, reporte fallback ni correo/notificación', async () => {
    const stage6Session = createSession({
      currentStage: 6,
      status: 'active',
      actionPlan: {
        what: 'Implementar reunión 1 a 1 semanal',
        when: 'Lunes',
        withWhom: 'Carlos',
        how: 'Agenda compartida',
        careReminders: 'Escuchar primero',
        isCommitmentConfirmed: true,
        isCompleted: true,
      },
      actionPlanExecutionStatus: 'executed',
      stage6ExecutionVerified: true,
      learnings: {
        whatHappened: 'Carlos asumió propiedad de sus entregas.',
        whatWorked: 'Preguntar por su propuesta.',
        whatDidnt: '',
        insights: 'Confiar con criterios claros funciona.',
        futureAdjustments: '',
        sharedLearningWithHR: '',
      },
    });
    const h = createHarness([stage6Session]);

    const closedOnFailure = await h.runAdvance(
      'case_A',
      (async () => ({
        ok: false,
        status: 503,
        json: async () => ({ success: false, error: 'Service unavailable' }),
      })) as any,
      { targetStage: 7 }
    );

    assert.equal(closedOnFailure, false);
    const after = h.getSession('case_A')!;
    assert.equal(after.currentStage, 6, 'Debe permanecer en Etapa 6');
    assert.equal(after.status, 'active', 'NO debe marcarse como completed');
    assert.equal(after.completedAt, undefined, 'NO debe asignar completedAt');
    assert.equal(after.finalFeedbackReport, undefined, 'NO debe fabricar reporte fallback en fallo');
    assert.equal(h.getNotifications().length, 0, 'NO debe emitir notificación a RH');
    assert.equal(h.emailCalls.length, 0, 'NO debe despachar correo de Etapa 7');
  });
});
