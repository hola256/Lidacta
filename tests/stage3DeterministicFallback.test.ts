import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { generateDeterministicCoaching } from '../server';

const INITIAL_STAGE3_SIGNATURE = '¿Qué alternativas o caminos de solución visualizas tú';

const baseLeaderProfile = {
  name: 'Laura Gómez',
  role: 'Gerente de Operaciones',
};

const baseCompanyContext = {
  name: 'Grupo Norte',
  industry: 'Logística',
};

const stage1And2History = [
  {
    sender: 'leader',
    role: 'user',
    stage: 1,
    text: 'Uno de mis coordinadores entrega tarde los reportes semanales y eso frena al área comercial.',
  },
  {
    sender: 'lidacta',
    role: 'model',
    stage: 1,
    text: 'Entiendo el impacto que esto genera en la operación.',
  },
  {
    sender: 'leader',
    role: 'user',
    stage: 2,
    text: 'Creo que tampoco he dejado claros los horarios de corte desde el inicio.',
  },
  {
    sender: 'lidacta',
    role: 'model',
    stage: 2,
    text: 'Excelente nivel de autoconciencia. ¿Avanzamos a la Etapa 3?',
  },
];

function assertNotInitialQuestion(replyText: string) {
  assert.equal(
    replyText.includes('Para diseñar las posibles salidas'),
    false,
    'No debe repetir el encabezado de la pregunta inicial de Etapa 3'
  );
  assert.equal(
    replyText.includes(INITIAL_STAGE3_SIGNATURE),
    false,
    'No debe volver a formular la pregunta inicial de Etapa 3'
  );
}

describe('Etapa 3 Preview - Fallback determinista contextual (server.ts)', () => {
  it('1. Primera interacción al entrar a Etapa 3 ([Avanzando a Etapa 3]) emite la pregunta inicial', () => {
    const result = generateDeterministicCoaching({
      stage: 3,
      leaderProfile: baseLeaderProfile,
      companyContext: baseCompanyContext,
      userMessage: '[Avanzando a Etapa 3]',
      conversationHistory: stage1And2History,
      sessionData: {
        id: 'case_st3_1',
        initialChallenge: 'Retrasos en reportes semanales de coordinación',
        leaderAlternatives: [],
      },
    });

    assert.equal(result.readyToAdvance, false);
    assert.ok(result.replyText.includes('Para diseñar las posibles salidas'));
    assert.ok(result.replyText.includes(INITIAL_STAGE3_SIGNATURE));
  });

  it('2. Cuando el líder propone dos alternativas concretas, responde sobre ellas sin repetir la pregunta inicial ni inventar decisiones', () => {
    const result = generateDeterministicCoaching({
      stage: 3,
      leaderProfile: baseLeaderProfile,
      companyContext: baseCompanyContext,
      userMessage:
        'Mis dos alternativas son: 1. Hablar en privado con mi coordinador para acordar un horario fijo de entrega. 2. Implementar un tablero compartido para revisar avances los miércoles.',
      conversationHistory: [
        ...stage1And2History,
        {
          sender: 'lidacta',
          role: 'model',
          stage: 3,
          text: 'Para diseñar las posibles salidas, Laura, quiero escucharte a ti primero...',
        },
      ],
      sessionData: {
        id: 'case_st3_2',
        initialChallenge: 'Retrasos en reportes semanales de coordinación',
        leaderAlternatives: [],
      },
    });

    assertNotInitialQuestion(result.replyText);
    assert.equal(result.readyToAdvance, false, 'No debe asumir que el líder ya eligió una opción');
    assert.ok(
      result.replyText.toLowerCase().includes('hablar en privado') ||
        result.replyText.toLowerCase().includes('horario fijo'),
      'Debe reconocer la primera alternativa planteada por el líder'
    );
    assert.ok(
      result.replyText.toLowerCase().includes('tablero compartido') ||
        result.replyText.toLowerCase().includes('miércoles'),
      'Debe reconocer la segunda alternativa planteada por el líder'
    );
    assert.ok(Array.isArray(result.suggestedAlternatives) && result.suggestedAlternatives.length >= 2);
  });

  it('3. Cuando el líder plantea alternativas y además expresa dudas y pide orientación, profundiza sin inventar elecciones ni repetir la pregunta inicial', () => {
    const result = generateDeterministicCoaching({
      stage: 3,
      leaderProfile: baseLeaderProfile,
      companyContext: baseCompanyContext,
      userMessage:
        'Podría conversar primero 1 a 1 con Carlos para aclarar expectativas, o reasignar temporalmente el reporte a otro analista. Pero tengo dudas de cuál conviene más porque me preocupa que se ponga a la defensiva; ¿qué me recomiendas?',
      conversationHistory: [
        ...stage1And2History,
        {
          sender: 'lidacta',
          role: 'model',
          stage: 3,
          text: 'Para diseñar las posibles salidas, Laura, quiero escucharte a ti primero...',
        },
      ],
      sessionData: {
        id: 'case_st3_3',
        initialChallenge: 'Retrasos en reportes semanales de coordinación',
        leaderAlternatives: [],
      },
    });

    assertNotInitialQuestion(result.replyText);
    assert.equal(result.readyToAdvance, false, 'Si tiene dudas o pide orientación, readyToAdvance debe ser false');
    assert.ok(
      result.replyText.toLowerCase().includes('carlos') ||
        result.replyText.toLowerCase().includes('expectativas'),
      'Debe recuperar la primera alternativa del líder'
    );
    assert.ok(
      result.replyText.toLowerCase().includes('reasignar') ||
        result.replyText.toLowerCase().includes('analista'),
      'Debe recuperar la segunda alternativa del líder'
    );
    assert.ok(
      /reservas|riesgo|criterios|cuidado del vínculo|sin decidir por ti/i.test(result.replyText),
      'Debe abordar las dudas y ofrecer criterios sin decidir por el líder'
    );
  });

  it('4. En turnos posteriores de Etapa 3, si el líder vuelve a preguntar por dudas, combinación u obstáculos, usa el historial de Etapa 3 y nunca repite la pregunta inicial', () => {
    const multiTurnHistory = [
      ...stage1And2History,
      {
        sender: 'lidacta',
        role: 'model',
        stage: 3,
        text: 'Para diseñar las posibles salidas, Laura, quiero escucharte a ti primero...',
      },
      {
        sender: 'leader',
        role: 'user',
        stage: 3,
        text: '1. Conversación directa de alineación con Carlos. 2. Hacer una revisión semanal corta con el equipo.',
      },
      {
        sender: 'lidacta',
        role: 'model',
        stage: 3,
        text: 'Reconozco las alternativas concretas que acabas de proponer...',
      },
    ];

    const result = generateDeterministicCoaching({
      stage: 3,
      leaderProfile: baseLeaderProfile,
      companyContext: baseCompanyContext,
      userMessage:
        'Sigo con dudas sobre qué consecuencias u obstáculos podrían surgir y cómo podría combinarlas sin sobrecargar al equipo.',
      conversationHistory: multiTurnHistory,
      sessionData: {
        id: 'case_st3_4',
        initialChallenge: 'Retrasos en reportes semanales de coordinación',
        leaderAlternatives: [],
      },
    });

    assertNotInitialQuestion(result.replyText);
    assert.equal(result.readyToAdvance, false);
    assert.ok(
      result.replyText.toLowerCase().includes('carlos') ||
        result.replyText.toLowerCase().includes('revisión semanal'),
      'Debe retomar las alternativas propuestas en turnos previos de Etapa 3'
    );
    assert.ok(
      /obstáculo|consecuencia|combinar|secuencia|reacción/i.test(result.replyText),
      'Debe profundizar en obstáculos, consecuencias o combinación'
    );
  });

  it('5. Si el líder responde únicamente con dudas y pedido de orientación sin alternativas previas, acompaña esas dudas sin repetir la pregunta inicial', () => {
    const result = generateDeterministicCoaching({
      stage: 3,
      leaderProfile: baseLeaderProfile,
      companyContext: baseCompanyContext,
      userMessage: 'La verdad tengo muchas dudas y no sé por dónde empezar, ¿qué me sugieres considerar primero?',
      conversationHistory: [
        ...stage1And2History,
        {
          sender: 'lidacta',
          role: 'model',
          stage: 3,
          text: 'Para diseñar las posibles salidas, Laura, quiero escucharte a ti primero...',
        },
      ],
      sessionData: {
        id: 'case_st3_5',
        initialChallenge: 'Retrasos en reportes semanales de coordinación',
        leaderAlternatives: [],
      },
    });

    assertNotInitialQuestion(result.replyText);
    assert.equal(result.readyToAdvance, false);
    assert.ok(
      /no forzar una decisión|dudas|proteger primero|siguiente paso/i.test(result.replyText),
      'Debe acompañar las dudas sin inventar alternativas ni repetir la pregunta inicial'
    );
  });

  it('6. Cuando el líder valida o elige explícitamente una alternativa sin dudas activas, habilita readyToAdvance para avance manual', () => {
    const multiTurnHistory = [
      ...stage1And2History,
      {
        sender: 'lidacta',
        role: 'model',
        stage: 3,
        text: 'Para diseñar las posibles salidas, Laura, quiero escucharte a ti primero...',
      },
      {
        sender: 'leader',
        role: 'user',
        stage: 3,
        text: '1. Hablar en privado con Carlos para fijar acuerdos. 2. Hacer seguimiento semanal en tablero.',
      },
    ];

    const result = generateDeterministicCoaching({
      stage: 3,
      leaderProfile: baseLeaderProfile,
      companyContext: baseCompanyContext,
      userMessage: 'Me quedo con la primera opción de hablar en privado con Carlos para fijar acuerdos claros.',
      conversationHistory: multiTurnHistory,
      sessionData: {
        id: 'case_st3_6',
        initialChallenge: 'Retrasos en reportes semanales de coordinación',
        leaderAlternatives: [],
      },
    });

    assertNotInitialQuestion(result.replyText);
    assert.equal(result.readyToAdvance, true);
    assert.ok(result.replyText.includes('tú eres quien decide y conduce la acción'));
  });
});
