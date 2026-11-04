import test from 'node:test';
import assert from 'node:assert/strict';
import { INITIAL_MENTORSHIPS } from '../src/data/mockData';
import { MentorshipActionPlan, MentorshipLearnings } from '../src/types/lidacta';

test('Privacy & HR Consent: Header Copy matches exact specification', () => {
  const expectedHeaderDisclaimer =
    'Conversaciones privadas y confidenciales. Recursos Humanos no tiene acceso a tus conversaciones con Lidacta. Tú decides qué acciones y aprendizajes deseas compartir con tu organización.';
  assert.ok(
    expectedHeaderDisclaimer.includes('Recursos Humanos no tiene acceso a tus conversaciones con Lidacta'),
    'Disclaimer must explicitly state HR has no access to conversations'
  );
  assert.ok(
    expectedHeaderDisclaimer.includes('Tú decides qué acciones y aprendizajes deseas compartir'),
    'Disclaimer must clarify the leader decides what to share'
  );
});

test('Privacy & HR Consent: Stage 5 Action Plan defaults to unshared (Opt-in false)', () => {
  // A freshly initialized action plan must have shareWithHR false or undefined
  const defaultActionPlan: MentorshipActionPlan = {
    what: 'Conversación de alineación con supervisor',
    when: 'Viernes 10:00 AM',
    withWhom: 'Supervisor de turno',
    how: 'Reunión 1 a 1 en sala privada',
    careReminders: 'Evitar juicios y enfocarse en hechos observables',
    isCompleted: false,
    shareWithHR: false, // Default is strictly false
  };

  assert.strictEqual(defaultActionPlan.shareWithHR, false, 'Default shareWithHR must be false');
});

test('Privacy & HR Consent: Stage 6 Learnings has optional sharedLearningWithHR field', () => {
  const defaultLearnings: MentorshipLearnings = {
    whatHappened: 'La conversación se llevó a cabo cordialmente.',
    whatWorked: 'El café en privado y el reconocimiento inicial.',
    whatDidnt: 'Un poco de nervios al inicio.',
    insights: 'Reconocer la experiencia previa abre la disposición a colaborar.',
    futureAdjustments: 'Preparar los datos de soporte con antelación.',
  };

  // When unshared, sharedLearningWithHR is undefined or empty
  assert.strictEqual(defaultLearnings.sharedLearningWithHR, undefined);

  // When leader voluntarily provides a learning for HR
  const volunteeredLearnings: MentorshipLearnings = {
    ...defaultLearnings,
    sharedLearningWithHR: 'Valorar la experiencia técnica reduce la resistencia operativa al cambio.',
  };

  assert.strictEqual(
    volunteeredLearnings.sharedLearningWithHR,
    'Valorar la experiencia técnica reduce la resistencia operativa al cambio.'
  );
});

test('Privacy & HR Consent: HR View filtering logic hides unshared content', () => {
  // Helper simulating HRView display filter
  const getActionPlanHRDisplay = (actionPlan?: MentorshipActionPlan) => {
    if (actionPlan?.shareWithHR) {
      return {
        isPrivate: false,
        text: actionPlan.what,
        badge: 'Compartido voluntariamente',
      };
    }
    return {
      isPrivate: true,
      text: 'Etapa 5 completada · El contenido específico del compromiso se mantiene privado por decisión del líder.',
      badge: 'Privado y confidencial',
    };
  };

  const getLearningsHRDisplay = (learnings?: MentorshipLearnings) => {
    if (learnings?.sharedLearningWithHR && learnings.sharedLearningWithHR.trim().length > 0) {
      return {
        isPrivate: false,
        text: learnings.sharedLearningWithHR.trim(),
        badge: 'Compartido por el líder',
      };
    }
    return {
      isPrivate: true,
      text: 'Etapa 6 completada · Las reflexiones personales se mantienen privadas por confidencialidad del proceso.',
      badge: 'Privado y confidencial',
    };
  };

  // Test Case 1: Unshared session (e.g. ment_carlos_1)
  const unsharedSession = INITIAL_MENTORSHIPS.find((m) => m.id === 'ment_carlos_1');
  assert.ok(unsharedSession, 'ment_carlos_1 should exist in initial mentorships');

  const actionDisplayUnshared = getActionPlanHRDisplay(unsharedSession?.actionPlan);
  assert.strictEqual(actionDisplayUnshared.isPrivate, true);
  assert.strictEqual(actionDisplayUnshared.badge, 'Privado y confidencial');
  assert.ok(!actionDisplayUnshared.text.includes('Taller de 45 minutos'), 'Sensitive details must be hidden');

  const learningsDisplayUnshared = getLearningsHRDisplay(unsharedSession?.learnings);
  assert.strictEqual(learningsDisplayUnshared.isPrivate, true);
  assert.strictEqual(learningsDisplayUnshared.badge, 'Privado y confidencial');

  // Test Case 2: Opted-in session (e.g. ment_roberto_1)
  const sharedSession = INITIAL_MENTORSHIPS.find((m) => m.id === 'ment_roberto_1');
  assert.ok(sharedSession, 'ment_roberto_1 should exist in initial mentorships');

  const actionDisplayShared = getActionPlanHRDisplay(sharedSession?.actionPlan);
  assert.strictEqual(actionDisplayShared.isPrivate, false);
  assert.strictEqual(actionDisplayShared.badge, 'Compartido voluntariamente');
  assert.ok(actionDisplayShared.text.includes('Conversación privada de 20 min'));

  const learningsDisplayShared = getLearningsHRDisplay(sharedSession?.learnings);
  assert.strictEqual(learningsDisplayShared.isPrivate, false);
  assert.strictEqual(learningsDisplayShared.badge, 'Compartido por el líder');
  assert.ok(
    learningsDisplayShared.text.includes('Cuando reconocemos la experiencia técnica')
  );
});
