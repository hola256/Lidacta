import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('Server & F5 Persistence Validation', () => {
  it('should verify server_users_db.json exists and contains persistent users', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const dbPath = path.join(process.cwd(), 'server_users_db.json');
    assert.ok(fs.existsSync(dbPath), 'server_users_db.json must exist');

    const content = fs.readFileSync(dbPath, 'utf-8');
    const users = JSON.parse(content);
    assert.ok(Array.isArray(users), 'Users must be an array');
    const carlos = users.find((u: any) => u.id === 'user_leader_carlos');
    assert.ok(carlos, 'Carlos Mendoza must exist in database');
    assert.ok(carlos.position, 'Carlos Mendoza must have a persistent position');
  });

  it('should verify /api/users endpoint returns persistent users after server read', async () => {
    const res = await fetch('http://localhost:3000/api/users', { cache: 'no-store' });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.ok(Array.isArray(data.users), 'Response must contain users list');
    const carlos = data.users.find((u: any) => u.id === 'user_leader_carlos');
    assert.ok(carlos, 'Carlos Mendoza must exist in /api/users response');
  });
});
