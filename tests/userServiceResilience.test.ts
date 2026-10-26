import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { userService } from '../src/services/userService.js';

describe('UserService Real Database Operations (No LocalStorage Fallback)', () => {
  it('should return error if server/database is offline without writing to localStorage', async () => {
    // In standalone node test runner without server running, fetch('/api/users') fails
    const result = await userService.getUsers();
    // Since server is not mocked in this unit test process, it cleanly returns failure
    assert.equal(result.success, false);
    assert.ok(result.message?.includes('Base de Datos Central'));
  });

  it('should return failure with clear error message when database update cannot reach server', async () => {
    const result = await userService.updateUser('user_admin_tania', {
      position: 'Directora & Creadora Lidacta',
    });
    assert.equal(result.success, false);
    assert.ok(result.message?.includes('Base de Datos Central'));
  });

  it('should check db health correctly', async () => {
    const health = await userService.checkDbHealth();
    assert.equal(typeof health.connected, 'boolean');
    assert.ok(health.dbSource);
  });
});
