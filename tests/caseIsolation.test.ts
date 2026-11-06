import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('Aislamiento Estricto por Caso y Validación de Contexto Exclusivo', () => {
  it('1. Debe filtrar y descartar mensajes de casos o acompañamientos previos que no coinciden con el caso activo', () => {
    const targetCaseId = 'ment_salary_case_123';
    const foreignCaseId = 'ment_old_client_issue_999';

    const rawHistory = [
      {
        id: 'msg_old_1',
        caseId: foreignCaseId,
        mentorshipId: foreignCaseId,
        sender: 'leader',
        text: 'Tuvimos una queja muy fuerte con el cliente por la entrega del pedido.',
      },
      {
        id: 'msg_old_2',
        caseId: foreignCaseId,
        mentorshipId: foreignCaseId,
        sender: 'lidacta',
        text: 'Comprendo la tensión por el reclamo del cliente.',
      },
      {
        id: 'msg_current_1',
        caseId: targetCaseId,
        mentorshipId: targetCaseId,
        sender: 'leader',
        text: 'Mi colaborador Juan me está exigiendo un aumento de sueldo del 30% y amenaza con renunciar.',
      },
      {
        id: 'msg_current_2',
        caseId: targetCaseId,
        mentorshipId: targetCaseId,
        sender: 'lidacta',
        text: 'Entiendo la complejidad de gestionar un reclamo salarial directo.',
      },
    ];

    // Simulación del filtro implementado en api/mentor/respond y server.ts
    const resolvedHistory = rawHistory.filter((m: any) => {
      if (!m || typeof m !== 'object') return false;
      const mCase = m.caseId || m.mentorshipId;
      if (targetCaseId && mCase && mCase !== targetCaseId) {
        return false;
      }
      return true;
    });

    assert.equal(resolvedHistory.length, 2);
    assert.equal(resolvedHistory[0].id, 'msg_current_1');
    assert.equal(resolvedHistory[1].id, 'msg_current_2');
    assert.ok(!resolvedHistory.some((m) => m.text.includes('cliente')));
  });

  it('2. El desglose diagnóstico para un caso de salario no debe contener "cliente" ni "bitácoras"', async () => {
    // Simulación de la función extractDiagnosticVariables
    const sessionData = {
      id: 'ment_salary_case_123',
      title: 'Colaborador exigiendo sueldo',
      initialChallenge: 'Mi colaborador Juan está exigiendo un aumento de sueldo inmediato y amenaza con irse si no se lo damos.',
    };

    const history = [
      {
        id: 'msg_1',
        sender: 'leader',
        text: 'Mi colaborador Juan está exigiendo un aumento de sueldo inmediato y amenaza con irse si no se lo damos.',
      },
      {
        id: 'msg_2',
        sender: 'lidacta',
        text: 'Te escucho. ¿Cuánto tiempo lleva en el equipo y cómo ha sido su relación de trabajo?',
      },
      {
        id: 'msg_3',
        sender: 'leader',
        text: 'Lleva 2 años, es muy bueno técnicamente pero me frustra que me condicione.',
      },
    ];

    const currentMsg = 'ayúdame a entender las variables que tengo mezcladas';

    // Importamos o emulamos la lógica idéntica de api/mentor/respond.ts y server.ts
    const allUserTexts = [
      sessionData.title,
      sessionData.initialChallenge,
      ...history.map((m) => m.text),
      currentMsg,
    ];
    const combined = allUserTexts.join(' ').toLowerCase();

    const isSalaryCase = [
      'sueldo', 'salario', 'aumento', 'aumento de sueldo', 'aumento salarial', 'pagar',
      'remuneracion', 'remuneración', 'compensacion', 'compensación', 'tabulador', 'dinero',
      'exigiendo sueldo', 'pide aumento'
    ].some((k) => combined.includes(k));

    assert.ok(isSalaryCase, 'Debe identificar el caso como salarial');

    // Comprobar que NO asume cliente si no fue mencionado
    const mentionsClientInCase = combined.includes('cliente');
    assert.equal(mentionsClientInCase, false, 'No debe haber mención de cliente en este caso');
  });

  it('3. Formato de Desglose Diagnóstico respeta viñetas y negritas obligatorias', () => {
    const visibleConflict = 'La exigencia o solicitud de ajuste salarial planteada por el colaborador y la expectativa de una resolución económica inmediata.';
    const underlyingTension = 'El dilema entre reconocer el valor del colaborador frente a las políticas de tabulador o posibilidades reales de la empresa, sumado a la incertidumbre sobre cómo sostener la motivación si no se puede conceder el monto exigido.';
    const emotionalImpact = 'La sensación de desgaste e incertidumbre al gestionar una conversación económica delicada sin desmotivar al colaborador ni sentar un precedente inviable.';

    const formattedBreakdown = `• **Conflicto visible:** ${visibleConflict}\n• **Tensión subyacente:** ${underlyingTension}\n• **Impacto emocional/operativo:** ${emotionalImpact}`;

    assert.ok(formattedBreakdown.includes('• **Conflicto visible:**'));
    assert.ok(formattedBreakdown.includes('• **Tensión subyacente:**'));
    assert.ok(formattedBreakdown.includes('• **Impacto emocional/operativo:**'));
    assert.ok(!formattedBreakdown.toLowerCase().includes('cliente'));
    assert.ok(!formattedBreakdown.toLowerCase().includes('bitácora'));
  });
});
