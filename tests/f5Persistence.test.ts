import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('Server & F5 Persistence Validation', () => {
  it('should verify server_users_db.json contains updated Carlos Mendoza position', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const dbPath = path.join(process.cwd(), 'server_users_db.json');
    assert.ok(fs.existsSync(dbPath), 'server_users_db.json must exist');

    const content = fs.readFileSync(dbPath, 'utf-8');
    const users = JSON.parse(content);
    const carlos = users.find((u: any) => u.id === 'user_leader_carlos');
    assert.ok(carlos, 'Carlos Mendoza must exist in database');
    assert.equal(
      carlos.position,
      'Director de Expansión Estratégica Retail',
      'Carlos Mendoza position must persist on server disk'
    );
  });

  it('should verify /api/users endpoint returns persistent position after server read', async () => {
    const res = await fetch('http://localhost:3000/api/users', { cache: 'no-store' });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    const carlos = data.users.find((u: any) => u.id === 'user_leader_carlos');
    assert.equal(
      carlos.position,
      'Director de Expansión Estratégica Retail',
      'API endpoint /api/users must return persisted position'
    );
  });
});
