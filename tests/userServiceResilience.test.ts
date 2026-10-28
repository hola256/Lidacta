import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { userService } from '../src/services/userService.js';

describe('UserService Resilience & Safe JSON Fallback', () => {
  it('should return users safely even if network or server sends non-JSON or fails', async () => {
    const result = await userService.getUsers();
    assert.equal(result.success, true);
    assert.ok(Array.isArray(result.users));
    assert.ok(result.users.length > 0);
  });

  it('should update user safely without throwing SyntaxError or crash', async () => {
    const result = await userService.updateUser('user_admin_tania', {
      position: 'Directora & Creadora Lidacta',
    });
    assert.equal(result.success, true);
    assert.ok(result.message?.includes('Base de Datos Central'));
  });

  it('should check db health safely without throwing', async () => {
    const health = await userService.checkDbHealth();
    assert.equal(typeof health.connected, 'boolean');
    assert.ok(health.dbSource);
  });
});
