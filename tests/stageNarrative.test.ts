import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { STAGE_META } from '../src/components/LeaderView';

describe('Narrativa y Nombres de Etapas (Enfoque centrado en el líder)', () => {
  const EXPECTED_STAGES = {
    1: {
      name: 'Etapa 1',
      shortTitle: 'Detectar qué sucede',
      subtitle: 'Comprende mejor la situación que estás enfrentando, sin juicios ni suposiciones.',
      objective: 'Identificar qué ocurre, qué lo provoca y quiénes están involucrados.',
      initialDescription: 'Comprende mejor la situación que estás enfrentando, sin juicios ni suposiciones.',
      purpose: 'Identificar qué ocurre, qué lo provoca y quiénes están involucrados.',
    },
    2: {
      name: 'Etapa 2',
      shortTitle: 'Analizar perspectivas y habilidades',
      subtitle: 'Explora cómo estás viviendo la situación y qué necesitas poner en juego como líder.',
      objective: 'Comprender otros puntos de vista e identificar las habilidades que pueden ayudarte a abordar el reto.',
      initialDescription: 'Explora cómo estás viviendo la situación y qué necesitas poner en juego como líder.',
      purpose: 'Comprender otros puntos de vista e identificar las habilidades que pueden ayudarte a abordar el reto.',
    },
    3: {
      name: 'Etapa 3',
      shortTitle: 'Diseñar alternativas',
      subtitle: 'Explora distintas formas de abordar la situación y encuentra el camino que mejor se adapte a tu realidad.',
      objective: 'Construir alternativas viables para que elijas cómo quieres actuar.',
      initialDescription: 'Explora distintas formas de abordar la situación y encuentra el camino que mejor se adapte a tu realidad.',
      purpose: 'Construir alternativas viables para que elijas cómo quieres actuar.',
    },
    4: {
      name: 'Etapa 4',
      shortTitle: 'Practicar antes de actuar',
      subtitle: 'Prepárate para afrontar la situación practicando una conversación o escenario real.',
      objective: 'Ensayar cómo actuar en un espacio seguro antes de llevarlo a la práctica.',
      initialDescription: 'Prepárate para afrontar la situación practicando una conversación o escenario real.',
      purpose: 'Ensayar cómo actuar en un espacio seguro antes de llevarlo a la práctica.',
    },
    5: {
      name: 'Etapa 5',
      shortTitle: 'Actuar (Plan de Acción)',
      subtitle: 'Convierte lo que has trabajado en una acción concreta que puedas llevar a la práctica.',
      objective: 'Definir qué harás, cuándo y con quién para avanzar en la situación.',
      initialDescription: 'Convierte lo que has trabajado en una acción concreta que puedas llevar a la práctica.',
      purpose: 'Definir qué harás, cuándo y con quién para avanzar en la situación.',
    },
    6: {
      name: 'Etapa 6',
      shortTitle: 'Aprender y reflexionar',
      subtitle: 'Revisa lo que sucedió al poner en práctica tu decisión y descubre qué puedes aprender de la experiencia.',
      objective: 'Reconocer qué funcionó, qué puedes ajustar y qué te llevas para futuros retos.',
      initialDescription: 'Revisa lo que sucedió al poner en práctica tu decisión y descubre qué puedes aprender de la experiencia.',
      purpose: 'Reconocer qué funcionó, qué puedes ajustar y qué te llevas para futuros retos.',
    },
    7: {
      name: 'Etapa 7',
      shortTitle: 'Cierre y retroalimentación',
      subtitle: 'Integra tus avances y reconoce las habilidades que has puesto en práctica durante este proceso.',
      objective: 'Identificar tus aprendizajes, fortalezas y oportunidades para seguir desarrollándote como líder.',
      initialDescription: 'Integra tus avances y reconoce las habilidades que has puesto en práctica durante este proceso.',
      purpose: 'Identificar tus aprendizajes, fortalezas y oportunidades para seguir desarrollándote como líder.',
    },
  };

  it('1. Valida que STAGE_META contenga exactamente los 7 títulos centrados en el líder', () => {
    for (let st = 1; st <= 7; st++) {
      const stageNumber = st as keyof typeof EXPECTED_STAGES;
      const expected = EXPECTED_STAGES[stageNumber];
      const actual = STAGE_META[stageNumber];

      assert.ok(actual, `STAGE_META debe definir la Etapa ${st}`);
      assert.equal(actual.shortTitle, expected.shortTitle, `shortTitle para Etapa ${st}`);
      assert.equal(actual.name, expected.name, `name para Etapa ${st}`);
    }
  });

  it('2. Valida las descripciones iniciales centradas en el líder en todas las etapas', () => {
    for (let st = 1; st <= 7; st++) {
      const stageNumber = st as keyof typeof EXPECTED_STAGES;
      const expected = EXPECTED_STAGES[stageNumber];
      const actual = STAGE_META[stageNumber];

      assert.equal(
        actual.subtitle,
        expected.subtitle,
        `subtitle (descripción inicial) para Etapa ${st}`
      );
      assert.equal(
        actual.initialDescription,
        expected.initialDescription,
        `initialDescription para Etapa ${st}`
      );
    }
  });

  it('3. Valida los propósitos de etapa centrados en el líder en todas las etapas', () => {
    for (let st = 1; st <= 7; st++) {
      const stageNumber = st as keyof typeof EXPECTED_STAGES;
      const expected = EXPECTED_STAGES[stageNumber];
      const actual = STAGE_META[stageNumber];

      assert.equal(
        actual.objective,
        expected.objective,
        `objective (propósito) para Etapa ${st}`
      );
      assert.equal(
        actual.purpose,
        expected.purpose,
        `purpose para Etapa ${st}`
      );
    }
  });

  it('4. Valida consistencia con los nombres de etapas en el flujo de 7 pasos', () => {
    assert.equal(STAGE_META[1].shortTitle, 'Detectar qué sucede');
    assert.equal(STAGE_META[2].shortTitle, 'Analizar perspectivas y habilidades');
    assert.equal(STAGE_META[3].shortTitle, 'Diseñar alternativas');
    assert.equal(STAGE_META[4].shortTitle, 'Practicar antes de actuar');
    assert.equal(STAGE_META[5].shortTitle, 'Actuar (Plan de Acción)');
    assert.equal(STAGE_META[6].shortTitle, 'Aprender y reflexionar');
    assert.equal(STAGE_META[7].shortTitle, 'Cierre y retroalimentación');
  });
});
