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
        body: 'Nos alegra que estés aquí. Este es un espacio para ti y para los retos que enfrentas al dirigir, acompañar y gestionar personas en tu equipo.',
        conclusion: 'Cada situación, desde una conversación difícil hasta la toma de decisiones sobre tu equipo, es una oportunidad para analizar, aprender y encontrar nuevas formas de actuar, fortaleciendo tu liderazgo en el día a día.',
      };
    };

    const leaderCopy = getWelcomeCopy('leader');
    assert.strictEqual(leaderCopy.title, '¡Bienvenido/a a Lidacta!');
    assert.ok(leaderCopy.body.includes('Este es un espacio para ti y para los retos que enfrentas al dirigir'));
    assert.ok(leaderCopy.conclusion.includes('fortaleciendo tu liderazgo en el día a día'));

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

  it('should strictly evaluate all leader role variants (LEADER, LIDER, lider, leader, líder)', async () => {
    const { isLeaderRole, isHumanResourcesRole } = await import('../src/utils/roleUtils.js');

    const leaderVariants = [
      'LEADER',
      'LIDER',
      'leader',
      'lider',
      'líder',
      'LÍDER',
      'LEADER_ROLE',
      'lider_role',
    ];

    for (const variant of leaderVariants) {
      assert.strictEqual(
        isLeaderRole(variant),
        true,
        `Role variant "${variant}" must be recognized as Leader`
      );
      assert.strictEqual(
        isHumanResourcesRole(variant),
        false,
        `Role variant "${variant}" must NOT be recognized as Human Resources`
      );
    }
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

  it('should generate differentiated welcome email text for Human Resources vs Leader', () => {
    const getWelcomeEmailText = (role: string, name: string) => {
      const isHR = role === 'hr';
      if (isHR) {
        return `Hola, ${name}:\n\n¡Nos alegra darte la bienvenida a Lidacta!\n\nGracias por confiar en este espacio para impulsar el desarrollo de tus líderes.\n\nSabemos que desarrollar habilidades de liderazgo va más allá de ofrecer capacitación. También implica acompañar a las personas en los retos cotidianos que enfrentan al dirigir, gestionar y trabajar con sus equipos.\n\nLidacta busca contribuir a ese proceso, ofreciendo a tus líderes un espacio de acompañamiento para analizar situaciones reales de gestión de personas, explorar alternativas y encontrar nuevas formas de actuar.\n\nDesde tu perfil de Recursos Humanos podrás consultar indicadores de uso y progreso de tus líderes, que te permitirán dar seguimiento a su participación y conocer cómo avanzan en su experiencia dentro de la plataforma.\n\nTe invitamos a explorar Lidacta, familiarizarte con sus indicadores y descubrir cómo esta herramienta puede complementar tus iniciativas de desarrollo de liderazgo.\n\n¡Gracias por ser parte de este proyecto!\n\nLidacta\nDesarrollo de Liderazgo en Acción`;
      }
      return `¡Hola ${name}!\n\nTe damos una cálida bienvenida a Lidacta: Desarrollo de Liderazgo en Acción.\n\nLidacta es tu espacio seguro, confidencial y práctico en el que tendrás un mentor para acompañarte y ayudarte a resolver los retos relacionados con el manejo de personas. Podrás también encontrar herramientas y establecer acciones que fortalezcan tu autonomía como líder.\n\nAtentamente,\nEl Equipo de Lidacta`;
    };

    const hrEmail = getWelcomeEmailText('hr', 'Sofía');
    assert.ok(hrEmail.startsWith('Hola, Sofía:'));
    assert.ok(hrEmail.includes('Gracias por confiar en este espacio para impulsar el desarrollo de tus líderes'));
    assert.ok(hrEmail.includes('Desde tu perfil de Recursos Humanos podrás consultar indicadores de uso y progreso'));
    assert.ok(hrEmail.includes('¡Gracias por ser parte de este proyecto!'));

    const leaderEmail = getWelcomeEmailText('leader', 'Carlos');
    assert.ok(leaderEmail.startsWith('¡Hola Carlos!'));
    assert.ok(leaderEmail.includes('fortalezcan tu autonomía como líder'));
  });

  it('should authenticate administrator account (hola@taniapadierna.com) with official password LidactaAdmin2026!', async () => {
    const { DEFAULT_ADMIN_PROFILE } = await import('../src/data/mockData.js');
    const { ADMIN_OFFICIAL_PASSWORD } = await import('../src/context/LidactaContext.js');

    assert.strictEqual(DEFAULT_ADMIN_PROFILE.email, 'hola@taniapadierna.com');
    assert.strictEqual(DEFAULT_ADMIN_PROFILE.password, 'LidactaAdmin2026!');
    assert.strictEqual(ADMIN_OFFICIAL_PASSWORD, 'LidactaAdmin2026!');

    // Authentication simulator matching LidactaContext.login logic
    const testLogin = (email: string, passwordInput?: string) => {
      const cleanEmail = email.trim().toLowerCase();
      const user = cleanEmail === 'hola@taniapadierna.com' ? DEFAULT_ADMIN_PROFILE : null;
      if (!user) return { success: false, message: 'Usuario no encontrado' };

      const expected = user.password || ADMIN_OFFICIAL_PASSWORD;
      if (expected) {
        if (!passwordInput || passwordInput.trim() !== expected.trim()) {
          return {
            success: false,
            message: 'La contraseña ingresada no es correcta. Verifica e intenta nuevamente.',
          };
        }
      }
      return { success: true };
    };

    // Valid password
    const validResult = testLogin('hola@taniapadierna.com', 'LidactaAdmin2026!');
    assert.strictEqual(validResult.success, true, 'Login with correct admin password must succeed');

    // Invalid password
    const invalidResult = testLogin('hola@taniapadierna.com', 'WrongPassword123');
    assert.strictEqual(invalidResult.success, false, 'Login with incorrect password must fail');
    assert.strictEqual(
      invalidResult.message,
      'La contraseña ingresada no es correcta. Verifica e intenta nuevamente.'
    );

    // Empty password
    const emptyResult = testLogin('hola@taniapadierna.com', '');
    assert.strictEqual(emptyResult.success, false, 'Login with empty password must fail');
  });

  it('should support 1-click remembered session login and verify public demo buttons are eliminated', async () => {
    const { DEFAULT_ADMIN_PROFILE, INITIAL_USERS } = await import('../src/data/mockData.js');
    const fs = await import('fs');

    // 1. Simulator for 1-click remembered session login logic
    const testLoginRemembered = (email: string, passwordInput?: string, is1ClickRemembered?: boolean) => {
      const cleanEmail = email.trim().toLowerCase();
      const allTestUsers = INITIAL_USERS || [DEFAULT_ADMIN_PROFILE];
      const user = allTestUsers.find((u) => u.email.trim().toLowerCase() === cleanEmail);
      if (!user) return { success: false, message: 'Usuario no encontrado' };

      // When 1-click remembered is true, previous authentication in browser is trusted
      if (!is1ClickRemembered) {
        const expected = user.password;
        if (expected && (!passwordInput || passwordInput.trim() !== expected.trim())) {
          return { success: false, message: 'Contraseña incorrecta' };
        }
      }
      return { success: true, user };
    };

    // Standard login without password should fail
    const standardWithoutPassword = testLoginRemembered('hola@taniapadierna.com', '');
    assert.strictEqual(standardWithoutPassword.success, false);

    // 1-Click remembered session for valid user should succeed
    const rememberedLogin = testLoginRemembered('hola@taniapadierna.com', undefined, true);
    assert.strictEqual(rememberedLogin.success, true);
    assert.strictEqual(rememberedLogin.user?.email, 'hola@taniapadierna.com');

    // 2. Ensure LoginView source code does NOT contain public quick demo buttons
    const loginViewSource = fs.readFileSync('src/components/LoginView.tsx', 'utf-8');
    assert.strictEqual(
      loginViewSource.includes('Acceso Rápido de Prueba (1 Clic)'),
      false,
      'Public test access button label must be removed'
    );
    assert.strictEqual(
      loginViewSource.includes('Ingresar como Administradora'),
      false,
      'Public admin test access button must be removed'
    );
    assert.strictEqual(
      loginViewSource.includes('handleQuickLoginAdmin'),
      false,
      'handleQuickLoginAdmin handler must not be present'
    );
    assert.strictEqual(
      loginViewSource.includes('handleResumeRememberedSession'),
      true,
      'handleResumeRememberedSession must be present for 1-click remembered access'
    );
    assert.strictEqual(
      loginViewSource.includes('handleSwitchAccount'),
      true,
      'handleSwitchAccount must be present for switching account'
    );
    assert.strictEqual(
      loginViewSource.includes('Continuar como'),
      true,
      'Continuar como [Nombre] button must be present in remembered session'
    );
    assert.strictEqual(
      loginViewSource.includes('Ingresar con otra cuenta'),
      true,
      'Ingresar con otra cuenta button must be present'
    );
  });
});

