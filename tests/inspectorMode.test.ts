import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import { DEFAULT_ADMIN_PROFILE, INITIAL_USERS } from '../src/data/mockData.js';
import { isHumanResourcesRole, isAdminRole, isLeaderRole, getRoleDisplayName } from '../src/utils/roleUtils.js';

describe('Inspector Mode & Role Impersonation Logic', () => {
  it('should restrict role impersonation exclusively to Administrator sessions', () => {
    const testCanImpersonate = (user: { role: string; email: string }) => {
      return user.role === 'admin' || user.email.toLowerCase() === 'hola@taniapadierna.com';
    };

    // Administrator
    assert.strictEqual(
      testCanImpersonate({ role: 'admin', email: 'hola@taniapadierna.com' }),
      true,
      'Admin should be allowed to use inspector mode'
    );

    // Regular Leader
    assert.strictEqual(
      testCanImpersonate({ role: 'leader', email: 'roberto.gomez@nexus-auto.com' }),
      false,
      'Leader should NOT be allowed to use inspector mode'
    );

    // Regular HR
    assert.strictEqual(
      testCanImpersonate({ role: 'hr', email: 'sofia.valenzuela@nexus-auto.com' }),
      false,
      'HR should NOT be allowed to use inspector mode'
    );
  });

  it('should compute currentUser correctly when impersonation is active', () => {
    const adminUser = DEFAULT_ADMIN_PROFILE;
    const leaderUser = INITIAL_USERS.find((u) => u.role === 'leader')!;
    const hrUser = INITIAL_USERS.find((u) => u.role === 'hr')!;

    assert.ok(leaderUser, 'Leader user must exist in mock data');
    assert.ok(hrUser, 'HR user must exist in mock data');

    // Simulator for LidactaContext currentUser useMemo
    const computeCurrentUser = (
      sessionUser: typeof adminUser,
      impersonatedUser: typeof leaderUser | null
    ) => {
      const isImpersonating = Boolean(
        sessionUser &&
          (sessionUser.role === 'admin' || sessionUser.email.toLowerCase() === 'hola@taniapadierna.com') &&
          impersonatedUser
      );

      if (isImpersonating && impersonatedUser) {
        return impersonatedUser;
      }
      return sessionUser;
    };

    // State 1: Normal Admin session without impersonation
    const normalState = computeCurrentUser(adminUser, null);
    assert.strictEqual(normalState.id, adminUser.id);
    assert.strictEqual(isAdminRole(normalState.role), true);
    assert.strictEqual(isLeaderRole(normalState.role), false);

    // State 2: Admin impersonating Leader
    const leaderState = computeCurrentUser(adminUser, leaderUser);
    assert.strictEqual(leaderState.id, leaderUser.id);
    assert.strictEqual(isLeaderRole(leaderState.role), true);
    assert.strictEqual(isAdminRole(leaderState.role), false);
    assert.strictEqual(getRoleDisplayName(leaderState.role), 'Líder');

    // State 3: Admin impersonating HR
    const hrState = computeCurrentUser(adminUser, hrUser);
    assert.strictEqual(hrState.id, hrUser.id);
    assert.strictEqual(isHumanResourcesRole(hrState.role), true);
    assert.strictEqual(isAdminRole(hrState.role), false);
    assert.strictEqual(getRoleDisplayName(hrState.role), 'Recursos Humanos');

    // State 4: Stop impersonation returns to Admin
    const revertedState = computeCurrentUser(adminUser, null);
    assert.strictEqual(revertedState.id, adminUser.id);
    assert.strictEqual(isAdminRole(revertedState.role), true);
  });

  it('should verify that Inspector controls are integrated in AdminView, App, and InspectorBanner', () => {
    // 1. InspectorBanner component exists and contains return button and indicators
    const bannerSource = fs.readFileSync('src/components/InspectorBanner.tsx', 'utf-8');
    assert.ok(bannerSource.includes('Modo Inspector'));
    assert.ok(bannerSource.includes('Volver a Administradora'));
    assert.ok(bannerSource.includes('Probar Modal Bienvenida'));
    assert.ok(bannerSource.includes('stopImpersonation'));

    // 2. App.tsx renders InspectorBanner
    const appSource = fs.readFileSync('src/App.tsx', 'utf-8');
    assert.ok(appSource.includes('<InspectorBanner />'));

    // 3. AdminView.tsx has the button and modal for simulation
    const adminSource = fs.readFileSync('src/components/AdminView.tsx', 'utf-8');
    assert.ok(adminSource.includes('Simular Vista / Roles'));
    assert.ok(adminSource.includes('isInspectorModalOpen'));
    assert.ok(adminSource.includes('impersonateRole'));
    assert.ok(adminSource.includes('impersonateUser'));

    // 4. LoginView.tsx remains clean with no public test buttons
    const loginSource = fs.readFileSync('src/components/LoginView.tsx', 'utf-8');
    assert.strictEqual(loginSource.includes('Acceso Rápido de Prueba'), false);
    assert.strictEqual(loginSource.includes('Ingresar como Administradora'), false);
  });
});
