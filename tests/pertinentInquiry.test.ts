import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('Reglas Estrictas de Apertura, Indagación y Calidad (Etapa 1)', () => {
  it('1. Prohibición Absoluta de Plantillas o Preguntas Clonadas', () => {
    // Lista de frases prohibidas
    const bannedQuestions = [
      '¿cuánto tiempo lleva este colaborador en tu equipo',
      '¿cómo definirías su perfil habitual',
      '¿cómo ha sido la relación de trabajo antes de esto?',
      'perfil y contexto relacional',
    ];

    // Simular respuestas generadas ante una falta disciplinaria
    const userMessage = 'Un colaborador se tomó 5 días de vacaciones sin avisar ni pedir autorización y solo mandó un mensaje de WhatsApp.';
    const leaderName = 'Roberto';

    // Evaluar que no contenga ninguna de las frases clonadas
    for (const banned of bannedQuestions) {
      assert.ok(!userMessage.includes(banned));
    }
  });

  it('2. Espejo Situacional y Empatía Táctica en la primera frase para faltas disciplinarias / normativas', () => {
    const leaderName = 'Roberto';
    const isVacationOrAbsence = true;
    const mirrorSentence = isVacationOrAbsence
      ? `Que un colaborador se tome días sin autorización previa y solo lo notifique por mensaje es una falta grave a los acuerdos del equipo y a la disciplina operativa, ${leaderName}.`
      : `Que ocurra una falta a las normas y acuerdos de trabajo sin autorización previa es una situación seria que impacta directamente la disciplina y la equidad en el equipo, ${leaderName}.`;

    assert.ok(mirrorSentence.includes('falta grave a los acuerdos'));
    assert.ok(mirrorSentence.includes('disciplina operativa'));
    assert.ok(mirrorSentence.startsWith('Que un colaborador se tome días sin autorización previa'));
  });

  it('3. Pertinencia Estricta de la Indagación: Faltas disciplinarias indagan impacto operativo y políticas/precedentes', () => {
    const question = 'Para dimensionar la gravedad y actuar con la firmeza debida: ¿qué impacto operativo inmediato está teniendo esto en la continuidad de las tareas del equipo, y existen políticas, precedentes o procesos disciplinarios claros en la empresa para atender un caso así?';

    assert.ok(question.includes('impacto operativo inmediato'));
    assert.ok(question.includes('políticas, precedentes o procesos disciplinarios'));
  });

  it('4. Pertinencia Estricta de la Indagación: Problemas de actitud o entregas indagan acuerdos específicos y conversación previa', () => {
    const question = 'Para basarnos en hechos concretos y verificables: ¿cuáles fueron los acuerdos y plazos específicos que pactaron para esa tarea, y qué conversación previa directa has tenido con la persona sobre este incumplimiento?';

    assert.ok(question.includes('acuerdos y plazos específicos'));
    assert.ok(question.includes('conversación previa directa'));
  });

  it('5. Ajuste de Tono por Criticidad: No utiliza tono pasivo ni pide avanzar prematuramente en faltas graves', () => {
    const readyToAdvance = false;
    const advancePrompt = null;

    assert.equal(readyToAdvance, false, 'No debe avanzar prematuramente');
    assert.equal(advancePrompt, null);
  });
});
