import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { buildTestSessionForStage } from '../src/utils/testSessionFixtures';
import { resolveStage6ExecutionStatus } from '../src/context/LidactaContext';

describe('Etapa 6 - Ajustes puntuales de experiencia y presentación', () => {
  it('1. Sustituye la etiqueta "Momento" por "Cuando" en el resumen de Etapa 5 recuperado en Etapa 6 conservando el valor íntegro', () => {
    const contextSrc = fs.readFileSync(
      path.resolve(process.cwd(), 'src/context/LidactaContext.tsx'),
      'utf8'
    );

    assert.ok(
      contextSrc.includes('• **Cuando:** ${stage6Plan.when.trim()}'),
      'LidactaContext debe mostrar la etiqueta "**Cuando:**" en el resumen de Etapa 6'
    );
    assert.equal(
      contextSrc.includes('• **Momento:** ${stage6Plan.when.trim()}'),
      false,
      'No debe permanecer la etiqueta "**Momento:**" en el resumen de Etapa 6'
    );

    const qaStage6 = buildTestSessionForStage(6, 'pending_verification');
    const introMsg = qaStage6.messages.find(
      (m) => m.stage === 6 && m.sender === 'lidacta'
    );
    assert.ok(introMsg, 'Debe existir el mensaje de bienvenida de Etapa 6');
    assert.ok(
      introMsg.text.includes(`• **Cuando:** ${qaStage6.actionPlan?.when}`),
      'El mensaje de Etapa 6 debe usar "Cuando:" conservando íntegro el valor de fecha y horario'
    );
    assert.equal(
      introMsg.text.includes('• **Momento:**'),
      false,
      'El mensaje de Etapa 6 no debe contener "Momento:"'
    );
    assert.ok(
      introMsg.text.includes(`• **Acción:** ${qaStage6.actionPlan?.what}`),
      'Debe conservar el valor de Acción'
    );
    assert.ok(
      introMsg.text.includes(`• **Con quién:** ${qaStage6.actionPlan?.withWhom}`),
      'Debe conservar el valor de Con quién'
    );
  });

  it('2. Cuando el plan está pendiente de ejecución (not_executed), prioriza el cuadro de respuesta antes que la referencia compacta y desplegable del plan', () => {
    const leaderViewSrc = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/LeaderView.tsx'),
      'utf8'
    );

    const notExecutedIdx = leaderViewSrc.indexOf("{stage6ExecutionStatus === 'not_executed' && (");
    const nonNotExecutedIdx = leaderViewSrc.indexOf("{stage6ExecutionStatus !== 'not_executed' && (");
    assert.ok(notExecutedIdx !== -1, 'Debe existir la rama de Etapa 6 para not_executed');
    assert.ok(nonNotExecutedIdx > notExecutedIdx, 'La rama not_executed debe estar delimitada antes de la rama executed/pending');

    const notExecutedBlock = leaderViewSrc.slice(notExecutedIdx, nonNotExecutedIdx);

    const replyBoxIdx = notExecutedBlock.indexOf('Conversa sobre lo que ocurrió y tu siguiente paso:');
    const statusBadgeIdx = notExecutedBlock.indexOf('Plan pendiente de ejecución');
    const planDetailsToggleIdx = notExecutedBlock.indexOf('aria-expanded={isStage6PlanExpanded}');
    const planHeaderIdx = notExecutedBlock.indexOf('Plan de Acción acordado en Etapa 5');
    const changeToYesIdx = notExecutedBlock.indexOf('Ya ejecuté mi Plan de Acción (cambiar a Sí)');

    assert.ok(replyBoxIdx !== -1, 'Debe mostrar el cuadro de conversación directa en not_executed');
    assert.ok(statusBadgeIdx !== -1, 'Debe mantener visible el estado Plan pendiente de ejecución');
    assert.ok(planDetailsToggleIdx !== -1, 'El detalle del plan de Etapa 5 debe ser desplegable en not_executed');
    assert.ok(planHeaderIdx !== -1, 'Debe conservar la referencia al Plan de Acción acordado en Etapa 5');
    assert.ok(changeToYesIdx !== -1, 'Debe conservar la acción para cambiar a Sí');

    // Jerarquía visual: el espacio de respuesta aparece antes que el detalle desplegable del plan
    assert.ok(
      replyBoxIdx < planHeaderIdx,
      'El cuadro de respuesta debe ubicarse antes que el detalle del plan para no interrumpir la conversación'
    );
    assert.ok(
      notExecutedBlock.includes('stage5Plan?.what?.trim()') &&
        notExecutedBlock.includes('stage5Plan?.when?.trim()') &&
        notExecutedBlock.includes('stage5Plan?.withWhom?.trim()'),
      'El detalle desplegable debe conservar los datos del plan (Acción, Cuándo y Con quién)'
    );

    // Estado resuelto sigue intacto
    const qaNotExecuted = buildTestSessionForStage(6, 'not_executed');
    assert.equal(resolveStage6ExecutionStatus(qaNotExecuted), 'not_executed');
  });
});
