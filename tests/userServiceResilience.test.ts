import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { userService } from '../src/services/userService.js';

describe('UserService Resilience & Vercel Compatibility', () => {
  it('should return users with local fallback if remote server is unreachable', async () => {
    // In node test environment, fetch('/api/users') will fail/mock-fail
    const result = await userService.getUsers();
    assert.equal(result.success, true, 'getUsers should never return success: false to the UI');
    assert.ok(Array.isArray(result.users), 'users must be an array');
    assert.ok(result.users.length > 0, 'should contain users');
  });

  it('should update user with fallback without throwing connection error', async () => {
    const result = await userService.updateUser('user_admin_tania', {
      position: 'Directora & Creadora Lidacta',
    });
    assert.equal(result.success, true, 'updateUser should succeed via fallback without blocking');
    assert.ok(!result.message?.includes('No se pudo conectar'), 'Must not show connection error');
  });

  it('should check db health without marking disconnected', async () => {
    const health = await userService.checkDbHealth();
    assert.equal(health.connected, true, 'Database status should remain active');
    assert.ok(health.usersCount > 0, 'Should have positive users count');
  });
});
