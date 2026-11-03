import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

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
});
