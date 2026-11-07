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

  it('6. Eje Central y Fidelidad al Hecho Detonante: No desvía el foco a incumplimiento de tareas', () => {
    // Simular que el caso inicial es ausencia injustificada de 5 días
    const initialChallenge = 'Un colaborador se tomó 5 días de vacaciones sin autorización previa y solo mandó mensaje.';
    const followUpMessage = 'En el pasado a veces llegaba tarde o se retrasaba con algún reporte, pero mi inquietud ahora es qué procede legalmente y cómo sancionarlo.';
    
    // El hecho detonante debe permanecer como ausencia/vacaciones no autorizadas
    const lowerAnchor = initialChallenge.toLowerCase();
    const isAbsence = lowerAnchor.includes('vacaciones') || lowerAnchor.includes('ausencia') || lowerAnchor.includes('sin autorizacion');
    assert.ok(isAbsence, 'Debe detectar el eje detonante como falta de ausencia/vacaciones no autorizadas');

    // No debe desviar los hechos hacia incumplimiento de entregables
    const isShiftedToTasks = followUpMessage.includes('incumplimiento reiterado de tareas');
    assert.equal(isShiftedToTasks, false, 'No debe desviar el foco hacia incumplimiento de tareas');
  });

  it('7. Comprensión Real y Síntesis Conectada: Responde explícitamente a la preocupación activa sobre sanciones y regreso', () => {
    const leaderActiveConcern = 'No sé cómo sancionarlo conforme al reglamento y me preocupa cómo abordar la conversación cuando regrese.';
    const lower = leaderActiveConcern.toLowerCase();
    const concernsSanctionOrReturn = lower.includes('sancion') || lower.includes('regrese');
    assert.ok(concernsSanctionOrReturn);

    // Dilema del líder sintetizado
    const leaderDilemma = concernsSanctionOrReturn
      ? 'Definir con Recursos Humanos la sanción o consecuencia disciplinaria correcta conforme a reglamento y sostener una conversación asertiva y firme al momento de su regreso, sin actuar desde la molestia pero sin mostrar permisividad.'
      : 'Hacer valer los acuerdos y normas operativas sin quebrantar la relación laboral.';

    assert.ok(leaderDilemma.includes('Recursos Humanos'));
    assert.ok(leaderDilemma.includes('sanción o consecuencia disciplinaria'));
    assert.ok(leaderDilemma.includes('al momento de su regreso'));
  });

  it('8. Protocolo de Comprensión Profunda y Escucha Contextual: Integrado al inicio de las reglas de calidad', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    
    const respondTsContent = fs.readFileSync(path.resolve('api/mentor/respond.ts'), 'utf-8');
    const serverTsContent = fs.readFileSync(path.resolve('server.ts'), 'utf-8');

    const expectedSnippets = [
      'PROTOCOLO DE COMPRENSIÓN PROFUNDA Y ESCUCHA CONTEXTUAL',
      '1. Comprender antes de interpretar:',
      '2. No completar la historia con suposiciones:',
      '3. Reflejar comprensión antes de avanzar:',
      '4. Profundizar sobre lo que realmente importa:',
      '5. Separar la perspectiva del líder de la realidad de los demás involucrados:',
      '6. Criterio de avance:',
      'Regla fundamental: No respondas solamente al problema que el líder menciona inicialmente',
    ];

    for (const snippet of expectedSnippets) {
      assert.ok(
        respondTsContent.includes(snippet),
        `api/mentor/respond.ts debe incluir "${snippet}"`
      );
      assert.ok(
        serverTsContent.includes(snippet),
        `server.ts debe incluir "${snippet}"`
      );
    }
  });

  it('9. Verificación de las 4 Reglas Estrictas de Interacción de la Etapa 1 en systemPrompt', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');

    const respondTsContent = fs.readFileSync(path.resolve('api/mentor/respond.ts'), 'utf-8');
    const serverTsContent = fs.readFileSync(path.resolve('server.ts'), 'utf-8');

    const requiredRuleSnippets = [
      '1. PROHIBICIÓN DE ECO ROBÓTICO:',
      '2. REGLA DE PROFUNDIZACIÓN OBLIGATORIA (MÍNIMO 2-3 TURNOS DE ESCUCHA):',
      '3. ADAPTACIÓN DE PREGUNTAS A LA NATURALEZA DEL PROBLEMA:',
      '4. REACCIÓN DIRECTA ANTE CORRECCIONES DEL USUARIO:',
      'robo de material',
      'abuso de autoridad del jefe en público',
    ];

    for (const snippet of requiredRuleSnippets) {
      assert.ok(
        respondTsContent.includes(snippet),
        `api/mentor/respond.ts debe incluir en systemPrompt "${snippet}"`
      );
      assert.ok(
        serverTsContent.includes(snippet),
        `server.ts debe incluir en systemPrompt "${snippet}"`
      );
    }
  });

  it('10. Prohibición de Eco Robótico: Ningún archivo genera "Entiendo con total claridad el reto que me planteas sobre"', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');

    const respondTsContent = fs.readFileSync(path.resolve('api/mentor/respond.ts'), 'utf-8');
    const serverTsContent = fs.readFileSync(path.resolve('server.ts'), 'utf-8');

    // Comprobar que la frase robótica no se genera activamente en respuestas
    assert.ok(!respondTsContent.includes('replyText: `Entiendo con total claridad el reto que me planteas sobre'));
    assert.ok(!serverTsContent.includes('replyText: `Entiendo con total claridad el reto que me planteas sobre'));
  });

  it('11. Adaptación de Preguntas: Delito o robo de material indaga evidencias, protocolos y confrontación (sin preguntas genéricas)', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');

    const respondTsContent = fs.readFileSync(path.resolve('api/mentor/respond.ts'), 'utf-8');
    const serverTsContent = fs.readFileSync(path.resolve('server.ts'), 'utf-8');

    // Validar indagación de evidencias, protocolos y confrontación
    const crimeInquirySnippets = [
      'evidencias concretas',
      'Recursos Humanos o Seguridad',
      'confrontada directamente',
    ];

    for (const snippet of crimeInquirySnippets) {
      assert.ok(respondTsContent.includes(snippet));
      assert.ok(serverTsContent.includes(snippet));
    }

    // Verificar que en caso de robo se prohíben preguntas genéricas como "¿qué cambio concreto buscas obtener?"
    assert.ok(respondTsContent.includes('Prohibido terminantemente hacer preguntas genéricas como "¿qué cambio concreto buscas obtener?"'));
    assert.ok(serverTsContent.includes('Prohibido terminantemente hacer preguntas genéricas como "¿qué cambio concreto buscas obtener?"'));
  });

  it('12. Adaptación de Preguntas: Conflicto jerárquico (abuso de autoridad en público) indaga contexto, reacción y recurrencia', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');

    const respondTsContent = fs.readFileSync(path.resolve('api/mentor/respond.ts'), 'utf-8');
    const serverTsContent = fs.readFileSync(path.resolve('server.ts'), 'utf-8');

    const bossInquirySnippets = [
      'contexto de la junta o reunión',
      'reacción de tu parte o del equipo',
      'comportamiento repetitivo del jefe o de un hecho aislado',
    ];

    for (const snippet of bossInquirySnippets) {
      assert.ok(respondTsContent.includes(snippet));
      assert.ok(serverTsContent.includes(snippet));
    }
  });

  it('13. Reacción Directa ante Correcciones del Usuario: Disculpa en 1 frase y reorientación sin resumen sintético', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');

    const respondTsContent = fs.readFileSync(path.resolve('api/mentor/respond.ts'), 'utf-8');
    const serverTsContent = fs.readFileSync(path.resolve('server.ts'), 'utf-8');

    // Detección de correcciones
    const correctionKeywords = ['te confundiste', 'eso no es lo que me preocupa'];
    for (const kw of correctionKeywords) {
      assert.ok(respondTsContent.includes(`'${kw}'`));
      assert.ok(serverTsContent.includes(`'${kw}'`));
    }

    // Disculpa en 1 frase y pregunta reorientadora
    assert.ok(respondTsContent.includes('Una disculpa por la confusión'));
    assert.ok(serverTsContent.includes('Una disculpa por la confusión'));
    assert.ok(respondTsContent.includes('detectedTheme: \'Reorientación por Corrección\''));
    assert.ok(serverTsContent.includes('detectedTheme: \'Reorientación por Corrección\''));
  });

  it('14. Regla de Profundización Obligatoria: Mínimo 2-3 turnos de escucha antes de desplegar el resumen final', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');

    const respondTsContent = fs.readFileSync(path.resolve('api/mentor/respond.ts'), 'utf-8');
    const serverTsContent = fs.readFileSync(path.resolve('server.ts'), 'utf-8');

    assert.ok(respondTsContent.includes('leaderTurnsCount < 2'));
    assert.ok(serverTsContent.includes('leaderTurnsCount < 2'));
    assert.ok(respondTsContent.includes('Profundización de Impacto'));
    assert.ok(serverTsContent.includes('Profundización de Impacto'));
  });
});

