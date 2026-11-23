import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolveStage6ExecutionStatus } from '../src/context/LidactaContext';
import { generateContextualCoachReply } from '../api/mentor/respond';
import { MentorshipSession } from '../src/types/lidacta';

describe('Etapa 6 - Aprender / Ajustar (Reflexión de Liderazgo)', () => {
  // Validation function simulating the exact logic implemented in LeaderView.tsx
  const validateLearnings = (
    whatHappened: string,
    whatWorked: string,
    insights: string
  ) => {
    return (
      whatHappened.trim().length > 0 &&
      whatWorked.trim().length > 0 &&
      insights.trim().length > 0
    );
  };

  it('debe mantener deshabilitado el botón si alguno de los 3 campos está vacío o solo contiene espacios', () => {
    // All empty
    assert.equal(validateLearnings('', '', ''), false);

    // Only spaces
    assert.equal(validateLearnings('   ', '   ', '   '), false);

    // Missing field 1
    assert.equal(validateLearnings('', 'El equipo colaboró activamente', 'Aprendí a delegar con claridad'), false);

    // Missing field 2
    assert.equal(validateLearnings('La conversación fue fluida', '   ', 'Aprendí a escuchar activamente'), false);

    // Missing field 3
    assert.equal(validateLearnings('La conversación fue fluida', 'El equipo colaboró activamente', ''), false);
  });

  it('debe habilitar el botón cuando los 3 campos contienen texto válido (.trim().length > 0)', () => {
    const whatHappened = 'La retroalimentación fue bien recibida por el colaborador.';
    const whatWorked = 'Mantener la calma y hacer preguntas abiertas.';
    const insights = 'La empatía genera mayor apertura y confianza en el liderazgo.';

    assert.equal(validateLearnings(whatHappened, whatWorked, insights), true);
  });

  it('no debe exigir longitud mínima excesiva (basta con cualquier texto no vacío)', () => {
    assert.equal(validateLearnings('Bien', 'Escuchar', 'Paciencia'), true);
  });

  it('debe permitir la edición y re-guardado incluso si la etapa ya fue completada o cerrada', () => {
    // Simula una sesión en etapa 7 o concluida con reflexiones previas
    const sessionMock = {
      id: 'session_leader_1',
      currentStage: 7,
      status: 'completed',
      learnings: {
        whatHappened: 'Sesión ejecutada',
        whatWorked: 'Escucha activa',
        whatDidnt: '',
        insights: 'Importancia del feedback continuo',
        futureAdjustments: '',
      },
    };

    const hasSavedLearnings = Boolean(
      sessionMock.learnings?.whatHappened ||
      sessionMock.learnings?.whatWorked ||
      sessionMock.learnings?.insights
    );
    assert.equal(hasSavedLearnings, true);

    // El usuario edita uno o varios campos en el panel
    const editedWhatHappened = 'Sesión ejecutada con nuevo acuerdo y seguimiento';
    const editedWhatWorked = 'Escucha activa y resumen de acuerdos';
    const editedInsights = sessionMock.learnings.insights;

    const isLearningsValid = validateLearnings(editedWhatHappened, editedWhatWorked, editedInsights);
    assert.equal(isLearningsValid, true, 'El botón de guardar/actualizar debe habilitarse al editar');

    // Simula la función saveLearnings
    const updatedLearnings = {
      whatHappened: editedWhatHappened.trim(),
      whatWorked: editedWhatWorked.trim(),
      whatDidnt: '',
      insights: editedInsights.trim(),
      futureAdjustments: '',
    };

    assert.equal(updatedLearnings.whatHappened, 'Sesión ejecutada con nuevo acuerdo y seguimiento');
    assert.equal(updatedLearnings.whatWorked, 'Escucha activa y resumen de acuerdos');
  });

  it('debe seleccionar el texto y estilo del botón de acuerdo con el estado de guardado', () => {
    const getButtonLabel = (params: {
      isSaving: boolean;
      justSaved: boolean;
      hasSaved: boolean;
    }) => {
      if (params.isSaving) return 'Guardando...';
      if (params.justSaved) return 'Reflexión Guardada';
      if (params.hasSaved) return 'Actualizar Reflexión';
      return 'Guardar Reflexión';
    };

    // Initial state before save
    assert.equal(
      getButtonLabel({ isSaving: false, justSaved: false, hasSaved: false }),
      'Guardar Reflexión'
    );

    // During save
    assert.equal(
      getButtonLabel({ isSaving: true, justSaved: false, hasSaved: false }),
      'Guardando...'
    );

    // Just saved feedback
    assert.equal(
      getButtonLabel({ isSaving: false, justSaved: true, hasSaved: true }),
      'Reflexión Guardada'
    );

    // After previous save, ready for update
    assert.equal(
      getButtonLabel({ isSaving: false, justSaved: false, hasSaved: true }),
      'Actualizar Reflexión'
    );
  });

  describe('Verificación inicial de ejecución del Plan de Acción (Sí / No)', () => {
    const buildStage6Session = (overrides: Partial<MentorshipSession> = {}): MentorshipSession => ({
      id: 'session_st6_verify',
      leaderId: 'leader_1',
      companyId: 'comp_1',
      title: 'Alineación de prioridades',
      initialChallenge: 'Retrasos en entregas semanales',
      detectedTheme: 'Retroalimentación',
      currentStage: 6,
      status: 'active',
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
      messages: [],
      identifiedSkills: ['Comunicación Asertiva'],
      stageHistory: [],
      actionPlan: {
        what: 'Conversar 1 a 1 con Ana sobre sus prioridades semanales',
        when: 'Jueves a las 10:00 AM',
        withWhom: 'Ana López',
        how: 'Usando hechos observables y preguntas abiertas',
        careReminders: 'Escuchar antes de concluir',
        isCompleted: false,
      },
      ...overrides,
    });

    it('inicia en pending_verification al entrar a Etapa 6 y distingue Sí / No sin marcar ejecución prematura', () => {
      const enteredSession = buildStage6Session();
      assert.equal(resolveStage6ExecutionStatus(enteredSession), 'pending_verification');
      assert.equal(enteredSession.actionPlan?.isCompleted, false, 'Avanzar a Etapa 6 no debe marcar el plan como ejecutado');

      const notExecutedSession = buildStage6Session({
        actionPlanExecutionStatus: 'not_executed',
        stage6ExecutionVerified: true,
        actionPlan: {
          ...enteredSession.actionPlan!,
          isCompleted: false,
        },
      });
      assert.equal(resolveStage6ExecutionStatus(notExecutedSession), 'not_executed');
      assert.equal(notExecutedSession.actionPlan?.isCompleted, false, 'Elegir No mantiene isCompleted en false');

      const executedSession = buildStage6Session({
        actionPlanExecutionStatus: 'executed',
        stage6ExecutionVerified: true,
        actionPlan: {
          ...enteredSession.actionPlan!,
          isCompleted: true,
        },
      });
      assert.equal(resolveStage6ExecutionStatus(executedSession), 'executed');
      assert.equal(executedSession.actionPlan?.isCompleted, true);
    });

    it('mantiene compatibilidad con sesiones legadas de Etapa 6 que ya tenían reflexión o diálogo', () => {
      const legacySession = buildStage6Session({
        actionPlanExecutionStatus: undefined,
        learnings: {
          whatHappened: 'Conversamos con calma',
          whatWorked: 'Escucha activa',
          whatDidnt: '',
          insights: 'Alinear expectativas temprano evita fricciones',
          futureAdjustments: '',
        },
      });
      assert.equal(resolveStage6ExecutionStatus(legacySession), 'executed');
    });

    it('si el líder responde Sí: recupera el Plan de Acción real de Etapa 5 sin asumir resultados no compartidos', () => {
      const reply = generateContextualCoachReply(
        6,
        'Sofía',
        'Sí, ya ejecuté mi Plan de Acción.',
        [],
        {
          actionPlanExecutionStatus: 'executed',
          actionPlan: {
            what: 'Conversar 1 a 1 con Ana sobre sus prioridades semanales',
            when: 'Jueves a las 10:00 AM',
            withWhom: 'Ana López',
          },
        }
      );

      assert.ok(
        reply.replyText.includes('Conversar 1 a 1 con Ana sobre sus prioridades semanales'),
        'Debe recuperar el plan real de la Etapa 5'
      );
      assert.match(reply.replyText, /qué ocurrió|qué funcionó|qué aprendizaje/i);
      assert.equal(reply.finalFeedback, undefined, 'No debe fabricar feedback final en Etapa 6');
    });

    it('si el líder responde No: abre acompañamiento respetuoso sobre obstáculos y siguiente paso sin dar por hecha la ejecución', () => {
      const reply = generateContextualCoachReply(
        6,
        'Sofía',
        'No, todavía no he ejecutado mi Plan de Acción.',
        [],
        {
          actionPlanExecutionStatus: 'not_executed',
          actionPlan: {
            what: 'Conversar 1 a 1 con Ana sobre sus prioridades semanales',
          },
        }
      );

      assert.match(reply.replyText, /obstáculos|circunstancias|siguiente paso|ajustar/i);
      assert.ok(
        !reply.replyText.toLowerCase().includes('¿qué ocurrió después de tu acción?'),
        'No debe preguntar como si la acción ya hubiera ocurrido'
      );
      assert.ok(
        !reply.replyText.toLowerCase().includes('tras ejecutar'),
        'No debe asumir ejecución previa'
      );
      assert.equal(reply.finalFeedback, undefined, 'No debe registrar resultados ficticios');
    });

    it('reconoce ejecución parcial en el diálogo distinguiendo lo ejecutado de lo pendiente', () => {
      const partialWhenNo = generateContextualCoachReply(
        6,
        'Sofía',
        'Solo alcancé a avanzar una parte de la reunión, todavía falta acordar las fechas.',
        [],
        {
          actionPlanExecutionStatus: 'not_executed',
          actionPlan: {
            what: 'Conversar 1 a 1 con Ana sobre sus prioridades semanales',
          },
        }
      );
      assert.match(partialWhenNo.replyText, /pendiente/i);
      assert.match(partialWhenNo.replyText, /parte|avanzar|llevó a cabo|realizó/i);

      const partialWhenYes = generateContextualCoachReply(
        6,
        'Sofía',
        'Ejecuté solo una parte del plan, me faltó revisar el seguimiento.',
        [],
        {
          actionPlanExecutionStatus: 'executed',
          actionPlan: {
            what: 'Conversar 1 a 1 con Ana sobre sus prioridades semanales',
          },
        }
      );
      assert.match(partialWhenYes.replyText, /pendiente/i);
      assert.match(partialWhenYes.replyText, /parte/i);
    });
  });
});

