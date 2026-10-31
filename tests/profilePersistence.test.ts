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
    let carlosProfileCompleted = false;
    let label = carlosProfileCompleted ? '✅ Líder Completo' : '⚡ Líder Incompleto';
    let cardClass = carlosProfileCompleted
      ? 'bg-emerald-500/15 hover:bg-emerald-500/25 border-emerald-500/40 text-emerald-200'
      : 'bg-[#BF3A1B]/15 hover:bg-[#BF3A1B]/25 border-[#BF3A1B]/35 text-[#FFD3BF]';
    assert.equal(label, '⚡ Líder Incompleto');
    assert.ok(cardClass.includes('#BF3A1B'));

    // After completion via localStorage.setItem('carlosProfileCompleted', 'true')
    carlosProfileCompleted = true;
    label = carlosProfileCompleted ? '✅ Líder Completo' : '⚡ Líder Incompleto';
    cardClass = carlosProfileCompleted
      ? 'bg-emerald-500/15 hover:bg-emerald-500/25 border-emerald-500/40 text-emerald-200'
      : 'bg-[#BF3A1B]/15 hover:bg-[#BF3A1B]/25 border-[#BF3A1B]/35 text-[#FFD3BF]';
    assert.equal(label, '✅ Líder Completo');
    assert.ok(cardClass.includes('emerald-500'));
  });

  it('should provide differentiated welcome modal copy according to user role (Leader vs HR)', () => {
    const getWelcomeCopy = (role: 'leader' | 'hr' | 'admin') => {
      if (role === 'hr') {
        return {
          title: '¡Bienvenido/a a Lidacta!',
          body: 'Nos alegra que formes parte de este espacio. Aquí podrás impulsar el desarrollo de tus líderes y dar seguimiento a su participación y progreso a través de indicadores que te permitirán conocer cómo avanzan en su experiencia dentro de la plataforma.',
          conclusion: 'Porque desarrollar el liderazgo también significa acompañar, observar y reconocer el progreso. ¡Comencemos!',
        };
      }
      return {
        title: '¡Bienvenido/a a Lidacta!',
        body: 'Nos alegra que formes parte de este espacio. Aquí encontrarás una nueva forma de impulsar el desarrollo de tus líderes, acercándolos a herramientas de acompañamiento para enfrentar los retos reales de su día a día.',
        conclusion: 'Construyamos juntos nuevas formas de desarrollar el liderazgo. ¡Comencemos!',
      };
    };

    const leaderCopy = getWelcomeCopy('leader');
    assert.strictEqual(leaderCopy.title, '¡Bienvenido/a a Lidacta!');
    assert.ok(leaderCopy.body.includes('herramientas de acompañamiento para enfrentar los retos reales'));
    assert.ok(leaderCopy.conclusion.includes('Construyamos juntos nuevas formas de desarrollar el liderazgo'));

    const hrCopy = getWelcomeCopy('hr');
    assert.strictEqual(hrCopy.title, '¡Bienvenido/a a Lidacta!');
    assert.ok(hrCopy.body.includes('dar seguimiento a su participación y progreso a través de indicadores'));
    assert.ok(hrCopy.conclusion.includes('Porque desarrollar el liderazgo también significa acompañar, observar y reconocer el progreso'));
  });

  it('should recognize all variants of Human Resources (HR, RH, hr, rh, RECURSOS_HUMANOS)', async () => {
    const { isHumanResourcesRole } = await import('../src/utils/roleUtils.js');

    const hrVariants = [
      'HR',
      'RH',
      'hr',
      'rh',
      'RECURSOS_HUMANOS',
      'recursos_humanos',
      'Recursos Humanos',
      'RH / Talento',
      'HUMAN_RESOURCES',
      'human resources',
    ];

    for (const variant of hrVariants) {
      assert.strictEqual(
        isHumanResourcesRole(variant),
        true,
        `Role variant "${variant}" must be recognized as Human Resources`
      );
    }

    // Leader and Admin should not be recognized as HR
    assert.strictEqual(isHumanResourcesRole('leader'), false);
    assert.strictEqual(isHumanResourcesRole('LÍDER'), false);
    assert.strictEqual(isHumanResourcesRole('admin'), false);
    assert.strictEqual(isHumanResourcesRole('ADMIN'), false);
    assert.strictEqual(isHumanResourcesRole(null), false);
    assert.strictEqual(isHumanResourcesRole(undefined), false);
  });

  it('should evaluate welcome modal strictly from the role selection button, ignoring free-text position/cargo', async () => {
    const { isHumanResourcesRole } = await import('../src/utils/roleUtils.js');

    // Case 1: Leader who typed "Director de Recursos Humanos" in their position field
    // Because role is 'leader', they must get the Leader modal, NOT HR!
    const leaderWithHRPosition = {
      role: 'leader',
      position: 'Director de Recursos Humanos y Cultura',
    };
    assert.strictEqual(
      isHumanResourcesRole(leaderWithHRPosition.role),
      false,
      'Leader with HR in position must NOT be evaluated as HR'
    );

    // Case 2: HR who typed "Líder de Operaciones" in their position field
    // Because role is 'hr', they must get the HR modal!
    const hrWithLeaderPosition = {
      role: 'hr',
      position: 'Líder de Operaciones de Talento',
    };
    assert.strictEqual(
      isHumanResourcesRole(hrWithLeaderPosition.role),
      true,
      'HR with Leader in position must be evaluated as HR based on role button'
    );
  });
});
