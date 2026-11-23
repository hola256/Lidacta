import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import {
  QA_TEST_LEADER_ID,
  QA_TEST_LEADER_PROFILE,
  TEST_STAGE6_SCENARIOS,
  TEST_STAGE_OPTIONS,
  buildTestSessionForStage,
} from '../src/utils/testSessionFixtures';
import { INITIAL_USERS, INITIAL_COMPANIES } from '../src/data/mockData';
import { resolveStage6ExecutionStatus } from '../src/context/LidactaContext';
import { generateDeterministicCoaching } from '../server';
import { generateContextualCoachReply } from '../api/mentor/respond';
import { formatStageTwoSkillsWithEvidence } from '../src/utils/skillsConsolidator';
import { StageNumber } from '../src/types/lidacta';

describe('Generador de Sesiones de Prueba por Etapa (1 a 7) - Modo Inspector', () => {
  const company = INITIAL_COMPANIES[0];

  it('ofrece selector completo de las 7 etapas y 3 escenarios de Etapa 6', () => {
    assert.deepEqual(
      TEST_STAGE_OPTIONS.map((o) => o.stage),
      [1, 2, 3, 4, 5, 6, 7]
    );
    assert.deepEqual(
      TEST_STAGE6_SCENARIOS.map((s) => s.id),
      ['pending_verification', 'executed', 'not_executed']
    );
    assert.equal(
      INITIAL_USERS.some((u) => u.id === QA_TEST_LEADER_ID || u.email === QA_TEST_LEADER_PROFILE.email),
      false,
      'El perfil ficticio QA nunca debe existir en el directorio real de usuarios'
    );
  });

  it('Etapa 1: genera problema inicial, perfil ficticio completo y respuesta contextual sin falsos positivos', () => {
    const session = buildTestSessionForStage(1);
    assert.equal(session.isTestSession, true);
    assert.equal(session.currentStage, 1);
    assert.equal(session.status, 'active');
    assert.equal(session.messages.length, 1);
    assert.equal(session.messages[0].stage, 1);
    assert.equal(session.identifiedSkills.length, 0);

    const coachReply = generateDeterministicCoaching({
      stage: 1,
      leaderProfile: QA_TEST_LEADER_PROFILE,
      companyContext: company,
      userMessage: session.initialChallenge,
      conversationHistory: [],
      sessionData: session,
    });
    assert.ok(coachReply.replyText.length > 30);
    assert.equal(
      coachReply.replyText.toLowerCase().includes('abuso de autoridad'),
      false,
      'No debe confundir un reto de delegación con abuso de autoridad'
    );
  });

  it('Etapa 2: prepara historial validado de Etapa 1 y abre análisis de perspectivas y habilidades', () => {
    const session = buildTestSessionForStage(2);
    assert.equal(session.isTestSession, true);
    assert.equal(session.currentStage, 2);
    assert.ok(session.messages.some((m) => m.stage === 1 && m.text.includes('Hechos')));
    assert.equal(session.stageHistory.length, 2);
    assert.ok(session.stageHistory[0].completedAt);

    const coachReply = generateDeterministicCoaching({
      stage: 2,
      leaderProfile: QA_TEST_LEADER_PROFILE,
      companyContext: company,
      userMessage: '[Avanzando a Etapa 2]',
      conversationHistory: session.messages,
      sessionData: session,
    });
    assert.ok(coachReply.replyText.length > 30);
  });

  it('Etapa 3: prepara habilidades con evidencias de Etapa 2 e inicia diseño de alternativas', () => {
    const session = buildTestSessionForStage(3);
    assert.equal(session.isTestSession, true);
    assert.equal(session.currentStage, 3);
    assert.ok((session.skillEntries || []).length >= 2);
    assert.ok(session.identifiedSkills.length >= 2);
    assert.ok(session.skillEntries!.every((e) => e.evidenceHistory.some((ev) => ev.stage === 2)));

    const coachReply = generateDeterministicCoaching({
      stage: 3,
      leaderProfile: QA_TEST_LEADER_PROFILE,
      companyContext: company,
      userMessage: '[Avanzando a Etapa 3]',
      conversationHistory: session.messages,
      sessionData: session,
    });
    assert.match(coachReply.replyText, /alternativa|opci|camino/i);
  });

  it('Etapa 4: prepara habilidades, alternativas y alternativa elegida lista para simulación u omisión', () => {
    const session = buildTestSessionForStage(4);
    assert.equal(session.isTestSession, true);
    assert.equal(session.currentStage, 4);
    assert.ok((session.leaderAlternatives || []).length >= 2);
    assert.ok(session.chosenAlternative && session.chosenAlternative.length > 15);
    assert.equal(session.stageReadyToAdvance, null);

    const coachReply = generateDeterministicCoaching({
      stage: 4,
      leaderProfile: QA_TEST_LEADER_PROFILE,
      companyContext: company,
      userMessage: '[Avanzando a Etapa 4]',
      conversationHistory: session.messages,
      sessionData: session,
      isPracticeMode: true,
    });
    assert.ok(coachReply.replyText.length > 30);
  });

  it('Etapa 5: prepara alternativa elegida y contexto de Etapas 1–4 para construir Plan de Acción', () => {
    const session = buildTestSessionForStage(5);
    assert.equal(session.isTestSession, true);
    assert.equal(session.currentStage, 5);
    assert.equal(session.status, 'in_action');
    assert.ok(session.chosenAlternative);
    assert.equal(session.actionPlan, undefined, 'El formulario del Plan de Acción debe iniciar libre para redactarlo');
    assert.ok(session.skillEntries!.some((e) => e.evidenceHistory.some((ev) => ev.stage === 4)));

    const coachReply = generateDeterministicCoaching({
      stage: 5,
      leaderProfile: QA_TEST_LEADER_PROFILE,
      companyContext: company,
      userMessage: '[Avanzando a Etapa 5]',
      conversationHistory: session.messages,
      sessionData: session,
    });
    assert.ok(coachReply.replyText.length > 30);
  });

  it('Etapa 6: prepara Plan de Acción completo y soporta los 3 escenarios (pendiente, ejecutado, no ejecutado)', () => {
    // Escenario A: Ejecución pendiente
    const pendingSession = buildTestSessionForStage(6, 'pending_verification');
    assert.equal(pendingSession.isTestSession, true);
    assert.equal(pendingSession.currentStage, 6);
    assert.equal(resolveStage6ExecutionStatus(pendingSession), 'pending_verification');
    assert.equal(pendingSession.stage6ExecutionVerified, false);
    assert.equal(pendingSession.actionPlan?.isCompleted, false);
    assert.ok(
      pendingSession.messages.some(
        (m) => m.stage === 6 && m.sender === 'lidacta' && m.text.includes('¿Ya ejecutaste tu Plan de Acción?')
      )
    );

    // Escenario B: Plan ejecutado
    const executedSession = buildTestSessionForStage(6, 'executed');
    assert.equal(resolveStage6ExecutionStatus(executedSession), 'executed');
    assert.equal(executedSession.stage6ExecutionVerified, true);
    assert.equal(executedSession.actionPlan?.isCompleted, true);
    const replyExecuted = generateContextualCoachReply(
      6,
      QA_TEST_LEADER_PROFILE.name,
      'Sí, ya ejecuté mi Plan de Acción.',
      executedSession.messages.slice(0, -1),
      executedSession
    );
    assert.match(replyExecuted.replyText, /ocurrió|funcionó|aprendizaje/i);

    // Escenario C: Plan no ejecutado
    const notExecutedSession = buildTestSessionForStage(6, 'not_executed');
    assert.equal(resolveStage6ExecutionStatus(notExecutedSession), 'not_executed');
    assert.equal(notExecutedSession.stage6ExecutionVerified, true);
    assert.equal(notExecutedSession.actionPlan?.isCompleted, false);
    const replyNotExecuted = generateContextualCoachReply(
      6,
      QA_TEST_LEADER_PROFILE.name,
      'No, todavía no he ejecutado mi Plan de Acción.',
      notExecutedSession.messages.slice(0, -1),
      notExecutedSession
    );
    assert.match(replyNotExecuted.replyText, /obstáculos|circunstancias|siguiente paso|ajustar/i);
    assert.equal(
      replyNotExecuted.replyText.toLowerCase().includes('¿qué ocurrió después de tu acción?'),
      false
    );
  });

  it('Etapa 7: prepara evidencias, Plan de Acción y aprendizajes de Etapa 6 generando reporte sin efectos reales', () => {
    const session = buildTestSessionForStage(7);
    assert.equal(session.isTestSession, true);
    assert.equal(session.currentStage, 7);
    assert.equal(session.status, 'completed');
    assert.ok(session.completedAt);
    assert.ok(session.actionPlan?.what);
    assert.ok(session.learnings?.insights);
    assert.ok((session.skillEntries || []).length >= 2);
    assert.equal(session.finalReportEmailSent, undefined);

    const coachReply = generateDeterministicCoaching({
      stage: 7,
      leaderProfile: QA_TEST_LEADER_PROFILE,
      companyContext: company,
      userMessage: '[Avanzando a Etapa 7]',
      conversationHistory: session.messages,
      sessionData: session,
    });
    assert.ok(coachReply.replyText.length > 30);

    const formattedSkills = formatStageTwoSkillsWithEvidence(session.skillEntries || []);
    assert.ok(formattedSkills.length >= 2);
    assert.ok(
      formattedSkills.some(
        (txt) =>
          txt.includes('Evidencia en experiencia laboral (Etapa 2)') &&
          txt.includes('Evidencia en simulación (Etapa 4)')
      ),
      'El reporte de Etapa 7 debe consolidar las evidencias reales de Etapa 2 y Etapa 4 de la sesión QA'
    );
    assert.ok(coachReply.finalFeedback, 'El cierre de Etapa 7 debe generar estructura finalFeedback');
    assert.ok(coachReply.finalFeedback.chosenActions.length > 0);
    assert.ok(coachReply.finalFeedback.stageSixLearnings.length > 0);
    assert.ok(coachReply.finalFeedback.recommendationsForAutonomy.length > 0);
  });

  it('Aislamiento estricto: verifica guardias en Contexto, RH, Admin, Líder y ausencia en Login', () => {
    const contextSrc = fs.readFileSync('src/context/LidactaContext.tsx', 'utf-8');
    const hrSrc = fs.readFileSync('src/components/HRView.tsx', 'utf-8');
    const adminSrc = fs.readFileSync('src/components/AdminView.tsx', 'utf-8');
    const leaderSrc = fs.readFileSync('src/components/LeaderView.tsx', 'utf-8');
    const bannerSrc = fs.readFileSync('src/components/InspectorBanner.tsx', 'utf-8');
    const loginSrc = fs.readFileSync('src/components/LoginView.tsx', 'utf-8');

    // Contexto: bloqueo de correos, alertas terapéuticas, seguimientos, recursos y notificaciones RH
    assert.ok(contextSrc.includes('if (targetMentorship.isTestSession)'), 'Bloqueo de email Etapa 7 en sesiones QA');
    assert.ok(contextSrc.includes('if (session.isTestSession) return session;'), 'Exclusión en checkAndProcessStage5FollowUps');
    assert.ok(contextSrc.includes('!activeMentorship.isTestSession'), 'Guardias en avance/mensajes/plan');
    assert.ok(
      contextSrc.includes('isTherapeutic && !activeMentorship.isTestSession && currentUser.id !== QA_TEST_LEADER_ID'),
      'Alerta de límite terapéutico debe omitirse en sesiones QA'
    );
    assert.ok(contextSrc.includes('!isQaSession'), 'Sin notificación a RH al crear sesión QA');
    assert.ok(contextSrc.includes('deleteTestSession') && contextSrc.includes('clearAllTestSessions'));

    // RH y Admin excluyen isTestSession de métricas, listas, recursos y alertas
    assert.ok(hrSrc.includes('!m.isTestSession'), 'HRView debe excluir sesiones QA');
    assert.ok(adminSrc.includes('mentorships.filter((m) => !m.isTestSession)'), 'AdminView debe excluir sesiones QA');
    assert.ok(
      adminSrc.includes('{realRecommendedResources.length} recomendaciones registradas'),
      'AdminView debe usar el conteo filtrado sin QA en recursos recomendados'
    );
    assert.ok(adminSrc.includes('3. Generador de Sesiones de Prueba por Etapa (1 a 7)'));
    assert.ok(bannerSrc.includes('Probar Etapa (1-7)'));

    // LeaderView aísla sesiones QA al perfil QA y oculta envío de email en Etapa 7
    assert.ok(leaderSrc.includes('!m.isTestSession'), 'Líderes reales no ven sesiones QA');
    assert.ok(leaderSrc.includes('Sesión de prueba QA: el reporte no se envía por correo ni notifica a RH.'));

    // LoginView sin controles QA
    assert.equal(loginSrc.includes('createTestSessionAtStage'), false);
    assert.equal(loginSrc.includes('isTestSession'), false);

    // Verifica que todas las etapas 1..7 producen un id único con prefijo ment_qa_
    ([1, 2, 3, 4, 5, 6, 7] as StageNumber[]).forEach((st) => {
      const s = buildTestSessionForStage(st);
      assert.ok(s.id.startsWith(`ment_qa_s${st}_`));
    });
  });
});
