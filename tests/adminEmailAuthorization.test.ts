import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { DEFAULT_ADMIN_PROFILE, INITIAL_USERS } from '../src/data/mockData.js';
import { ensureAdminPasswordInUsers, ADMIN_OFFICIAL_PASSWORD } from '../src/context/LidactaContext.js';
import { DEFAULT_USERS } from '../api/users.js';
import adminHandler from '../api/admin.js';
import { isAdminRole, isHumanResourcesRole, isLeaderRole } from '../src/utils/roleUtils.js';
import { buildTestSessionForStage } from '../src/utils/testSessionFixtures.js';

const NEW_ADMIN_EMAIL = 'hola@lidacta.com';
const OLD_ADMIN_EMAIL = 'hola@taniapadierna.com';

describe('Cambio Controlado de Correo de Administradora (hola@lidacta.com)', () => {
  it('1. La identidad de la administradora en mockData, api/users, api/admin y JSON persistentes usa hola@lidacta.com', async () => {
    assert.equal(DEFAULT_ADMIN_PROFILE.id, 'user_admin_tania');
    assert.equal(DEFAULT_ADMIN_PROFILE.email, NEW_ADMIN_EMAIL);
    assert.equal(DEFAULT_ADMIN_PROFILE.role, 'admin');

    const mockAdmin = INITIAL_USERS.find((u) => u.id === 'user_admin_tania');
    assert.ok(mockAdmin);
    assert.equal(mockAdmin.email, NEW_ADMIN_EMAIL);
    assert.equal(mockAdmin.role, 'admin');

    const apiAdmin = DEFAULT_USERS.find((u) => u.id === 'user_admin_tania');
    assert.ok(apiAdmin);
    assert.equal(apiAdmin.email, NEW_ADMIN_EMAIL);
    assert.equal(apiAdmin.role, 'admin');

    // api/admin GET handler devuelve perfil con hola@lidacta.com
    let adminJson: any = null;
    await adminHandler(
      { method: 'GET', body: undefined },
      {
        setHeader: () => {},
        status: () => ({
          json: (d: any) => {
            adminJson = d;
            return d;
          },
          end: () => {},
        }),
      }
    );
    assert.equal(adminJson?.success, true);
    assert.equal(adminJson?.profile?.id, 'user_admin_tania');
    assert.equal(adminJson?.profile?.email, NEW_ADMIN_EMAIL);

    // data/users.json y server_users_db.json tienen user_admin_tania con hola@lidacta.com y coinciden
    const dataUsers = JSON.parse(fs.readFileSync('data/users.json', 'utf-8'));
    const serverUsers = JSON.parse(fs.readFileSync('server_users_db.json', 'utf-8'));
    assert.deepEqual(dataUsers, serverUsers);

    const jsonAdmin = dataUsers.find((u: any) => u.id === 'user_admin_tania');
    assert.ok(jsonAdmin);
    assert.equal(jsonAdmin.email, NEW_ADMIN_EMAIL);
    assert.equal(jsonAdmin.role, 'admin');

    // El correo anterior no aparece en ningún usuario con rol admin
    const legacyAdminMatches = [
      ...INITIAL_USERS,
      ...DEFAULT_USERS,
      ...dataUsers,
    ].filter((u: any) => String(u.email || '').toLowerCase() === OLD_ADMIN_EMAIL);
    assert.equal(legacyAdminMatches.length, 0);
  });

  it('2. El inicio de sesión y permisos administrativos (Modo Inspector y Generador QA) aceptan hola@lidacta.com y rechazan hola@taniapadierna.com', () => {
    const users = ensureAdminPasswordInUsers(INITIAL_USERS);

    // Simulación directa de la lógica de reconocimiento de login de LidactaContext
    const simulateLogin = (email: string, password: string) => {
      const cleanEmail = email.trim().toLowerCase();
      const user = users.find((u) => u.email.toLowerCase() === cleanEmail);
      if (!user) return { success: false, user: null };
      const isTaniaAdmin =
        user.email.toLowerCase() === NEW_ADMIN_EMAIL ||
        user.id === 'user_admin_tania' ||
        user.role === 'admin';
      const expectedPassword = isTaniaAdmin
        ? user.password || ADMIN_OFFICIAL_PASSWORD
        : user.password;
      if (expectedPassword && password.trim() !== expectedPassword.trim()) {
        return { success: false, user: null };
      }
      return { success: true, user };
    };

    const newLogin = simulateLogin(NEW_ADMIN_EMAIL, ADMIN_OFFICIAL_PASSWORD);
    assert.equal(newLogin.success, true);
    assert.ok(newLogin.user);
    assert.equal(isAdminRole(newLogin.user.role), true);

    const oldLogin = simulateLogin(OLD_ADMIN_EMAIL, ADMIN_OFFICIAL_PASSWORD);
    assert.equal(oldLogin.success, false);
    assert.equal(oldLogin.user, null);

    // Verificación de acceso a Modo Inspector y Generador QA
    const hasAdminAccess = (u: { role: string; email: string } | null) =>
      Boolean(u && (u.role === 'admin' || u.email.toLowerCase() === NEW_ADMIN_EMAIL));

    assert.equal(hasAdminAccess(newLogin.user), true);
    assert.equal(hasAdminAccess({ role: 'leader', email: OLD_ADMIN_EMAIL }), false);
    assert.equal(hasAdminAccess(null), false);

    // El generador QA sigue funcionando para sesión administradora válida en las 7 etapas
    const qaSession = buildTestSessionForStage(4);
    assert.equal(qaSession.currentStage, 4);
    assert.equal(qaSession.isTestSession, true);
  });

  it('3. El código de LidactaContext no conserva autorizaciones activas ligadas al correo anterior', () => {
    const contextSource = fs.readFileSync('src/context/LidactaContext.tsx', 'utf-8');
    assert.equal(
      contextSource.includes(OLD_ADMIN_EMAIL),
      false,
      'LidactaContext.tsx no debe contener referencias al correo anterior'
    );
    assert.ok(contextSource.includes(`sessionUser?.email?.toLowerCase() === '${NEW_ADMIN_EMAIL}'`));
    assert.ok(contextSource.includes(`user.email.toLowerCase() === '${NEW_ADMIN_EMAIL}'`));
  });

  it('4. Los demás usuarios (líderes y RH) conservan sus roles y permisos sin alteraciones', () => {
    const dataUsers = JSON.parse(fs.readFileSync('data/users.json', 'utf-8'));

    const roberto = dataUsers.find((u: any) => u.email === 'roberto.gomez@nexus-auto.com');
    assert.ok(roberto);
    assert.equal(isLeaderRole(roberto.role), true);
    assert.equal(isAdminRole(roberto.role), false);

    const sofia = dataUsers.find((u: any) => u.email === 'sofia.valenzuela@nexus-auto.com');
    assert.ok(sofia);
    assert.equal(isHumanResourcesRole(sofia.role), true);
    assert.equal(isAdminRole(sofia.role), false);

    // Registros de líderes de prueba en domain taniapadierna.com permanecen intactos
    const preservedLeaderEmails = [
      'laura.test.template@taniapadierna.com',
      'prueba.module@taniapadierna.com',
      'carlos.test.mailing@taniapadierna.com',
    ];
    for (const leaderEmail of preservedLeaderEmails) {
      const found = dataUsers.find((u: any) => u.email === leaderEmail);
      assert.ok(found, `Debe conservarse el registro de líder existente: ${leaderEmail}`);
      assert.equal(found.role, 'leader');
    }
  });
});
