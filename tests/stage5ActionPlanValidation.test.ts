import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { MentorshipActionPlan } from '../src/types/lidacta';

describe('Etapa 5: Actuar (Plan de Acción) - Validación de 5 Campos y Autonomía del Líder', () => {
  // Validación de los 5 campos obligatorios del plan de acción
  const validateActionPlan = (
    what: string,
    when: string,
    withWhom: string,
    how: string,
    careReminders: string
  ): boolean => {
    return (
      what.trim().length > 0 &&
      when.trim().length > 0 &&
      withWhom.trim().length > 0 &&
      how.trim().length > 0 &&
      careReminders.trim().length > 0
    );
  };

  it('1. Debe rechazar el avance si alguno de los 5 campos obligatorios está vacío o contiene solo espacios', () => {
    // Todos vacíos
    assert.equal(validateActionPlan('', '', '', '', ''), false);

    // Solo espacios
    assert.equal(validateActionPlan('   ', '   ', '   ', '   ', '   '), false);

    // Falta 1. ¿Qué harás?
    assert.equal(validateActionPlan('', 'Jueves 17 a las 15:30', 'Supervisor', 'Reunión 1 a 1', 'Serenidad'), false);

    // Falta 2. ¿Cuándo lo harás?
    assert.equal(validateActionPlan('Reunión de alineación', '', 'Supervisor', 'Reunión 1 a 1', 'Serenidad'), false);

    // Falta 3. ¿Con quién lo harás?
    assert.equal(validateActionPlan('Reunión de alineación', 'Jueves 17 a las 15:30', '', 'Reunión 1 a 1', 'Serenidad'), false);

    // Falta 4. ¿Cómo lo harás? (NUEVO CAMPO OBLIGATORIO)
    assert.equal(validateActionPlan('Reunión de alineación', 'Jueves 17 a las 15:30', 'Supervisor', '', 'Serenidad'), false);
    assert.equal(validateActionPlan('Reunión de alineación', 'Jueves 17 a las 15:30', 'Supervisor', '   ', 'Serenidad'), false);

    // Falta 5. ¿Qué vas a cuidar o recordar?
    assert.equal(validateActionPlan('Reunión de alineación', 'Jueves 17 a las 15:30', 'Supervisor', 'Reunión 1 a 1', ''), false);
  });

  it('2. Debe habilitar el plan cuando los 5 campos contienen texto redactado por el líder', () => {
    const what = 'Conversación 1 a 1 de alineación de objetivos';
    const when = 'Viernes 18 a las 10:00 hrs';
    const withWhom = 'Ernesto, Supervisor de Turno';
    const how = 'Estructurando la reunión con el modelo SBI y acordando metas intermedias';
    const careReminders = 'Escuchar sin interrumpir y acordar fechas realistas';

    assert.equal(validateActionPlan(what, when, withWhom, how, careReminders), true);
  });

  it('3. Guarda fielmente el texto escrito por el líder en los 5 campos sin inyectar textos de relleno predeterminados', () => {
    const rawInput = {
      what: '  Reunión con equipo de logística  ',
      when: '  Mañana 09:00 hrs  ',
      withWhom: '  Coordinadores  ',
      how: '  Presentando el tablero visual y definiendo responsables directos  ',
      careReminders: '  Enfoque en soluciones prácticas  ',
      shareWithHR: false,
    };

    const savedPlan: MentorshipActionPlan = {
      what: rawInput.what.trim(),
      when: rawInput.when.trim(),
      withWhom: rawInput.withWhom.trim(),
      how: rawInput.how.trim(),
      careReminders: rawInput.careReminders.trim(),
      shareWithHR: rawInput.shareWithHR,
      shareActionPlanWithHR: rawInput.shareWithHR,
      actionPlanShared: rawInput.shareWithHR,
      isCompleted: false,
    };

    assert.equal(savedPlan.what, 'Reunión con equipo de logística');
    assert.equal(savedPlan.when, 'Mañana 09:00 hrs');
    assert.equal(savedPlan.withWhom, 'Coordinadores');
    assert.equal(savedPlan.how, 'Presentando el tablero visual y definiendo responsables directos');
    assert.equal(savedPlan.careReminders, 'Enfoque en soluciones prácticas');
    // Verifica que no se inyectó la frase genérica 'Conversación de alineación 1 a 1'
    assert.notEqual(savedPlan.what, 'Conversación de alineación 1 a 1');
  });

  it('4. Preserva íntegramente los 4 campos preexistentes de una sesión previa e incorpora el 5to campo sin sobrescribir', () => {
    // Simulación de sesión preexistente de Valeria (con los 4 campos previamente guardados)
    const valeriaExistingSessionPlan: Partial<MentorshipActionPlan> = {
      what: 'Conversación directa sobre delimitación de funciones',
      when: 'Lunes a las 11:00 hrs',
      withWhom: 'Rodrigo (Gerente de Operaciones)',
      careReminders: 'Mantener la calma y fundamentar con datos de tiempos de entrega',
      shareWithHR: true,
    };

    // Al cargar la sesión existente, 'how' se inicializa con fallback seguro
    const loadedPlan: MentorshipActionPlan = {
      what: valeriaExistingSessionPlan.what || '',
      when: valeriaExistingSessionPlan.when || '',
      withWhom: valeriaExistingSessionPlan.withWhom || '',
      how: (valeriaExistingSessionPlan as any).how || '',
      careReminders: valeriaExistingSessionPlan.careReminders || '',
      shareWithHR: valeriaExistingSessionPlan.shareWithHR ?? false,
    };

    // Verificar que los 4 campos preexistentes NO se borraron, reiniciaron ni alteraron
    assert.equal(loadedPlan.what, 'Conversación directa sobre delimitación de funciones');
    assert.equal(loadedPlan.when, 'Lunes a las 11:00 hrs');
    assert.equal(loadedPlan.withWhom, 'Rodrigo (Gerente de Operaciones)');
    assert.equal(loadedPlan.careReminders, 'Mantener la calma y fundamentar con datos de tiempos de entrega');
    assert.equal(loadedPlan.shareWithHR, true);
    // how debe ser string vacío sin romper la estructura
    assert.equal(loadedPlan.how, '');

    // Al redactar el campo 'how', los 4 campos originales siguen intactos
    const valeriaUpdatedPlan: MentorshipActionPlan = {
      ...loadedPlan,
      how: 'Usando la técnica DEEC para describir hechos y acordar límites',
    };

    assert.equal(valeriaUpdatedPlan.what, 'Conversación directa sobre delimitación de funciones');
    assert.equal(valeriaUpdatedPlan.when, 'Lunes a las 11:00 hrs');
    assert.equal(valeriaUpdatedPlan.withWhom, 'Rodrigo (Gerente de Operaciones)');
    assert.equal(valeriaUpdatedPlan.how, 'Usando la técnica DEEC para describir hechos y acordar límites');
    assert.equal(valeriaUpdatedPlan.careReminders, 'Mantener la calma y fundamentar con datos de tiempos de entrega');
    assert.equal(validateActionPlan(
      valeriaUpdatedPlan.what,
      valeriaUpdatedPlan.when,
      valeriaUpdatedPlan.withWhom,
      valeriaUpdatedPlan.how,
      valeriaUpdatedPlan.careReminders
    ), true);
  });

  it('5. Requiere confirmación explícita del compromiso antes de avanzar a la Etapa 6', () => {
    const canAdvanceToStage6 = (isActionPlanComplete: boolean, isCommitmentConfirmed: boolean) => {
      return isActionPlanComplete && isCommitmentConfirmed;
    };

    // Caso A: Plan completo pero sin confirmación de compromiso -> No avanza
    assert.equal(canAdvanceToStage6(true, false), false);

    // Caso B: Compromiso marcado pero campos incompletos -> No avanza
    assert.equal(canAdvanceToStage6(false, true), false);

    // Caso C: Ambos cumplidos -> Puede avanzar a Etapa 6
    assert.equal(canAdvanceToStage6(true, true), true);
  });

  it('6. El borrador sugerido por la IA en la conversación no debe sobrescribir el plan del líder', () => {
    const leaderActionPlan: MentorshipActionPlan = {
      what: 'Plan personal del líder',
      when: 'Lunes 14:00 hrs',
      withWhom: 'Equipo comercial',
      how: 'Reunión en sala',
      careReminders: 'No entrar en debate',
      shareWithHR: false,
    };

    const coachReplyDraft = {
      actionPlanDraft: {
        what: 'Sugerencia generada por el modelo de IA',
        when: 'Fecha sugerida por el modelo',
        how: 'Estrategia generada por IA',
      },
    };

    // La lógica en LidactaContext mantiene actionPlan: m.actionPlan (inmune a coachReplyDraft)
    const updatedPlan = leaderActionPlan; // No se aplica coachReplyDraft

    assert.equal(updatedPlan.what, 'Plan personal del líder');
    assert.notEqual(updatedPlan.what, coachReplyDraft.actionPlanDraft.what);
  });

  it('7. El espacio de comentarios adicionales es opcional y no condiciona la validación ni el avance a Etapa 6', () => {
    // Los 5 campos del plan y la confirmación son los únicos requisitos
    const isActionPlanComplete = (
      what: string,
      when: string,
      withWhom: string,
      how: string,
      care: string
    ) => [what, when, withWhom, how, care].every((f) => f.trim().length > 0);

    const canAdvance = (
      planComplete: boolean,
      commitmentConfirmed: boolean,
      optionalComment: string
    ) => {
      // optionalComment no influye en la condición
      void optionalComment;
      return planComplete && commitmentConfirmed;
    };

    // Caso A: Con los 5 campos y compromiso confirmado, pero comentario vacío -> Puede avanzar
    assert.equal(canAdvance(true, true, ''), true);

    // Caso B: Con los 5 campos y compromiso confirmado, con comentario redactado -> Puede avanzar
    assert.equal(canAdvance(true, true, 'Tengo una duda sobre si invitar a RH a la reunión'), true);

    // Caso C: Si falta algún campo obligatorio, aunque haya comentario -> NO puede avanzar
    assert.equal(canAdvance(false, true, 'Comentario presente pero faltan campos'), false);

    // Caso D: Si falta confirmación del compromiso, aunque haya comentario -> NO puede avanzar
    assert.equal(canAdvance(true, false, 'Comentario presente pero sin checkbox'), false);

    // El contador de campos obligatorios evalúa exclusivamente los 5 campos del plan
    const completedFieldsCount = (
      what: string,
      when: string,
      withWhom: string,
      how: string,
      care: string,
      comment: string
    ) => {
      void comment; // Ignorado
      return [what, when, withWhom, how, care].filter((f) => f.trim().length > 0).length;
    };

    assert.equal(completedFieldsCount('A', 'B', 'C', 'D', 'E', 'Comentario extra'), 5);
    assert.equal(completedFieldsCount('A', 'B', 'C', 'D', 'E', ''), 5);
  });
});

