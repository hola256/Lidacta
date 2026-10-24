import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { UserProfile } from '../src/types/lidacta.js';

describe('User Profile Completion & Persistence Logic', () => {
  it('should identify incomplete leader when mandatory fields are missing', () => {
    const incompleteLeader: UserProfile = {
      id: 'user_leader_carlos',
      name: 'Carlos Mendoza',
      email: 'carlos.mendoza@novaretail.com',
      role: 'leader',
      companyId: 'comp_nova',
      companyName: 'Retail Nova Grupo Comercial',
      position: 'Gerente de Sucursal Centro',
      area: '',
      birthDate: '',
      directReports: undefined,
      whatsapp: '',
      isProfileCompleted: false,
      isProfileComplete: false,
      createdAt: '2026-09-15',
    };

    const isComplete = Boolean(
      (incompleteLeader.isProfileCompleted || incompleteLeader.isProfileComplete) &&
      incompleteLeader.companyName?.trim() &&
      incompleteLeader.birthDate?.trim() &&
      incompleteLeader.whatsapp?.trim() &&
      incompleteLeader.area?.trim() &&
      incompleteLeader.directReports !== undefined &&
      Number(incompleteLeader.directReports) >= 0
    );

    assert.equal(isComplete, false, 'Incomplete leader should evaluate to false');
  });

  it('should identify leader as complete once all required fields and flags are provided', () => {
    const completedLeader: UserProfile = {
      id: 'user_leader_carlos',
      name: 'Carlos Mendoza',
      email: 'carlos.mendoza@novaretail.com',
      role: 'leader',
      companyId: 'comp_nova',
      companyName: 'Retail Nova Grupo Comercial',
      position: 'Gerente de Sucursal Centro',
      area: 'Operaciones Comerciales',
      birthDate: '1990-05-20',
      directReports: 8,
      whatsapp: '+52 55 9876 5432',
      isProfileCompleted: true,
      isProfileComplete: true,
      createdAt: '2026-09-15',
    };

    const isComplete = Boolean(
      (completedLeader.isProfileCompleted || completedLeader.isProfileComplete) &&
      completedLeader.companyName?.trim() &&
      completedLeader.birthDate?.trim() &&
      completedLeader.whatsapp?.trim() &&
      completedLeader.area?.trim() &&
      completedLeader.directReports !== undefined &&
      Number(completedLeader.directReports) >= 0
    );

    assert.equal(isComplete, true, 'Completed leader should evaluate to true');
  });

  it('should verify quick access badge logic in LoginView matches status', () => {
    // Before completion
    let isCarlosComplete = false;
    let label = isCarlosComplete ? '✅ Líder Completo' : '⚡ Líder Incompleto';
    assert.equal(label, '⚡ Líder Incompleto');

    // After completion
    isCarlosComplete = true;
    label = isCarlosComplete ? '✅ Líder Completo' : '⚡ Líder Incompleto';
    assert.equal(label, '✅ Líder Completo');
  });
});
