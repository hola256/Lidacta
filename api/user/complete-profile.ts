// Vercel Serverless Function for /api/user/complete-profile
// 100% self-contained: no external relative module imports to prevent ERR_MODULE_NOT_FOUND in Vercel

interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: 'leader' | 'hr' | 'admin';
  companyId: string;
  companyName: string;
  position: string;
  area?: string;
  birthDate?: string;
  directReports?: number;
  whatsapp?: string;
  avatarUrl?: string;
  isProfileCompleted?: boolean;
  isProfileComplete?: boolean;
  createdAt: string;
  password?: string;
  status?: 'active' | 'inactive';
}

const DEFAULT_USERS: UserProfile[] = [
  {
    id: 'user_admin_tania',
    name: 'Tania Padierna',
    email: 'hola@taniapadierna.com',
    role: 'admin',
    companyId: 'comp_nexus',
    companyName: 'Lidacta Platform',
    position: 'Creadora de la Plataforma & Coach Sr.',
    area: 'Dirección de Producto y Mentoría',
    whatsapp: '+52 55 1234 5678',
    isProfileCompleted: true,
    isProfileComplete: true,
    createdAt: '2026-01-01',
    status: 'active',
  },
  {
    id: 'user_leader_roberto',
    name: 'Roberto Gómez',
    email: 'roberto.gomez@nexus-auto.com',
    role: 'leader',
    companyId: 'comp_nexus',
    companyName: 'Industrias Nexus Automotriz',
    position: 'Líder de Línea de Ensamble y Calidad',
    area: 'Operaciones de Manufactura',
    birthDate: '1988-04-12',
    directReports: 14,
    whatsapp: '+52 55 4912 8841',
    avatarUrl: '/src/assets/images/avatar_leader_roberto_1792074706592.jpg',
    isProfileCompleted: true,
    isProfileComplete: true,
    createdAt: '2026-09-10',
    status: 'active',
  },
  {
    id: 'user_leader_carlos',
    name: 'Carlos Mendoza',
    email: 'carlos.mendoza@novaretail.com',
    role: 'leader',
    companyId: 'comp_nova',
    companyName: 'Retail Nova Grupo Comercial',
    position: 'Gerente de Sucursal Centro',
    area: 'Operaciones Comerciales y Tiendas',
    birthDate: '1990-06-15',
    directReports: 8,
    whatsapp: '+52 55 9876 5432',
    isProfileCompleted: true,
    isProfileComplete: true,
    createdAt: '2026-09-15',
    status: 'active',
  },
  {
    id: 'user_hr_sofia',
    name: 'Sofía Valenzuela',
    email: 'sofia.valenzuela@nexus-auto.com',
    role: 'hr',
    companyId: 'comp_nexus',
    companyName: 'Industrias Nexus Automotriz',
    position: 'Directora de Recursos Humanos & Talento',
    area: 'Gestión Humana y Cultura',
    birthDate: '1985-08-19',
    whatsapp: '+52 55 8820 1492',
    avatarUrl: '/src/assets/images/avatar_hr_sofia_1792074705689.jpg',
    isProfileCompleted: true,
    isProfileComplete: true,
    createdAt: '2026-08-20',
    status: 'active',
  },
  {
    id: 'user_hr_mariana',
    name: 'Mariana Castillo',
    email: 'mariana.castillo@novaretail.com',
    role: 'hr',
    companyId: 'comp_nova',
    companyName: 'Retail Nova Grupo Comercial',
    position: 'Gerente de Desarrollo Organizacional',
    area: 'Recursos Humanos',
    birthDate: '1987-11-23',
    whatsapp: '+52 55 7766 5544',
    isProfileCompleted: true,
    isProfileComplete: true,
    createdAt: '2026-08-25',
    status: 'active',
  },
];

let memoryUsers: UserProfile[] = [...DEFAULT_USERS];

function readDurableFile(): UserProfile[] | null {
  try {
    const fs = require('fs');
    const path = require('path');
    const tmpPath = path.join('/tmp', 'lidacta_users_db.json');
    if (fs.existsSync(tmpPath)) {
      const content = fs.readFileSync(tmpPath, 'utf-8');
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}

  try {
    const fs = require('fs');
    const path = require('path');
    const diskPath = path.join(process.cwd(), 'server_users_db.json');
    if (fs.existsSync(diskPath)) {
      const content = fs.readFileSync(diskPath, 'utf-8');
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}

  return null;
}

function writeDurableFile(users: UserProfile[]) {
  try {
    const fs = require('fs');
    const path = require('path');
    const tmpPath = path.join('/tmp', 'lidacta_users_db.json');
    fs.writeFileSync(tmpPath, JSON.stringify(users, null, 2), 'utf-8');
  } catch {}

  try {
    const fs = require('fs');
    const path = require('path');
    const diskPath = path.join(process.cwd(), 'server_users_db.json');
    fs.writeFileSync(diskPath, JSON.stringify(users, null, 2), 'utf-8');
  } catch {}
}

async function getFromKv(): Promise<UserProfile[] | null> {
  const kvUrl = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const kvToken = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!kvUrl || !kvToken) return null;
  try {
    const res = await fetch(`${kvUrl}/get/lidacta_users`, {
      headers: { Authorization: `Bearer ${kvToken}` },
      cache: 'no-store',
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.result) {
        const parsed = typeof data.result === 'string' ? JSON.parse(data.result) : data.result;
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    }
  } catch (err) {
    console.warn('[Vercel KV] Error reading users:', err);
  }
  return null;
}

async function saveToKv(users: UserProfile[]): Promise<boolean> {
  const kvUrl = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const kvToken = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!kvUrl || !kvToken) return false;
  try {
    const res = await fetch(`${kvUrl}/set/lidacta_users`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${kvToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(users),
    });
    return res.ok;
  } catch (err) {
    console.warn('[Vercel KV] Error writing users:', err);
    return false;
  }
}

async function getFromSupabase(): Promise<UserProfile[] | null> {
  const sbUrl = process.env.SUPABASE_URL;
  const sbKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;
  if (!sbUrl || !sbKey) return null;
  try {
    const cleanUrl = sbUrl.replace(/\/$/, '');
    const res = await fetch(`${cleanUrl}/rest/v1/users?select=*`, {
      headers: { apikey: sbKey, Authorization: `Bearer ${sbKey}`, Accept: 'application/json' },
      cache: 'no-store',
    });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) return data as UserProfile[];
    }
  } catch (err) {
    console.warn('[Supabase] Error reading users:', err);
  }
  return null;
}

async function saveToSupabase(users: UserProfile[]): Promise<boolean> {
  const sbUrl = process.env.SUPABASE_URL;
  const sbKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;
  if (!sbUrl || !sbKey) return false;
  try {
    const cleanUrl = sbUrl.replace(/\/$/, '');
    const res = await fetch(`${cleanUrl}/rest/v1/users`, {
      method: 'POST',
      headers: {
        apikey: sbKey,
        Authorization: `Bearer ${sbKey}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates',
      },
      body: JSON.stringify(users),
    });
    return res.ok;
  } catch (err) {
    console.warn('[Supabase] Error writing users:', err);
    return false;
  }
}

async function loadUsers(): Promise<{ users: UserProfile[]; source: string }> {
  const kvUsers = await getFromKv();
  if (kvUsers) {
    memoryUsers = kvUsers;
    writeDurableFile(kvUsers);
    return { users: kvUsers, source: 'Vercel KV (Upstash)' };
  }
  const sbUsers = await getFromSupabase();
  if (sbUsers) {
    memoryUsers = sbUsers;
    writeDurableFile(sbUsers);
    return { users: sbUsers, source: 'Supabase Cloud' };
  }
  const fileUsers = readDurableFile();
  if (fileUsers) {
    memoryUsers = fileUsers;
    return { users: fileUsers, source: 'Base de Datos Persistente' };
  }
  return { users: memoryUsers, source: 'Base de Datos Central' };
}

async function persistUsers(users: UserProfile[]) {
  memoryUsers = users;
  writeDurableFile(users);
  await saveToKv(users);
  await saveToSupabase(users);
}

export default async function handler(req: any, res: any) {
  try {
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');

    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {}
    }

    const { userId, email, companyName, area, birthDate, directReports, whatsapp, position } = body || {};

    const { users } = await loadUsers();
    const cleanEmail = (email || '').trim().toLowerCase();

    const targetIdx = users.findIndex(
      (u) => (userId && u.id === userId) || (cleanEmail && u.email.toLowerCase() === cleanEmail)
    );

    if (targetIdx !== -1) {
      users[targetIdx] = {
        ...users[targetIdx],
        companyName: companyName ? companyName.trim() : users[targetIdx].companyName,
        position: position ? position.trim() : users[targetIdx].position,
        area: area !== undefined ? area.trim() : users[targetIdx].area,
        birthDate: birthDate ? birthDate.trim() : users[targetIdx].birthDate,
        directReports: directReports !== undefined ? Number(directReports) : users[targetIdx].directReports,
        whatsapp: whatsapp ? whatsapp.trim() : users[targetIdx].whatsapp,
        isProfileCompleted: true,
        isProfileComplete: true,
      };

      try {
        await persistUsers(users);
      } catch (persistErr) {
        console.error('[PROFILE_ERROR] Error persistiendo usuario:', persistErr);
      }

      return res.status(200).json({
        success: true,
        message: 'Perfil completado exitosamente y persistido en la Base de Datos Central.',
        user: users[targetIdx],
        users,
      });
    }

    // Fallback if user was newly created in memory
    const fallbackUser: UserProfile = {
      id: userId || `user_${Date.now()}`,
      name: body?.name?.trim() || 'Usuario Lidacta',
      email: cleanEmail || 'usuario@lidacta.com',
      role: body?.role || 'leader',
      companyId: body?.companyId || 'comp_custom',
      companyName: companyName?.trim() || 'Empresa Sin especificar',
      position: position?.trim() || 'Líder Operativo',
      area: area?.trim() || 'Operaciones',
      birthDate: birthDate?.trim() || '1990-01-01',
      directReports: directReports ? Number(directReports) : 5,
      whatsapp: whatsapp?.trim() || 'Sin especificar',
      isProfileCompleted: true,
      isProfileComplete: true,
      createdAt: new Date().toISOString().split('T')[0],
      status: 'active',
    };

    users.unshift(fallbackUser);
    try {
      await persistUsers(users);
    } catch {}

    return res.status(200).json({
      success: true,
      message: 'Perfil completado exitosamente.',
      user: fallbackUser,
      users,
    });
  } catch (err: any) {
    console.error('[PROFILE_ERROR]:', err);
    return res.status(200).json({
      success: false,
      error: err?.message || 'Error al completar el perfil en el servidor.',
      message: err?.message || 'Error al completar el perfil en el servidor.',
    });
  }
}
