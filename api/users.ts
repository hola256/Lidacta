// Vercel Serverless Function for /api/users
// Supports Vercel KV (Upstash Redis), Supabase, or in-memory persistence.

export const config = {
  maxDuration: 15,
};

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

// In-memory fallback cache across lambda warm invocations
let memoryUsers: UserProfile[] = [...DEFAULT_USERS];

// Helper: Read users from Vercel KV or Upstash Redis
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
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    }
  } catch (err) {
    console.warn('[Vercel KV] Error reading users:', err);
  }
  return null;
}

// Helper: Write users to Vercel KV or Upstash Redis
async function saveToKv(users: UserProfile[]): Promise<boolean> {
  const kvUrl = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const kvToken = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!kvUrl || !kvToken) return false;

  try {
    const res = await fetch(`${kvUrl}/set/lidacta_users`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${kvToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(users),
    });
    return res.ok;
  } catch (err) {
    console.warn('[Vercel KV] Error writing users:', err);
    return false;
  }
}

// Helper: Read users from Supabase REST API
async function getFromSupabase(): Promise<UserProfile[] | null> {
  const sbUrl = process.env.SUPABASE_URL;
  const sbKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

  if (!sbUrl || !sbKey) return null;

  try {
    const cleanUrl = sbUrl.replace(/\/$/, '');
    const res = await fetch(`${cleanUrl}/rest/v1/users?select=*`, {
      headers: {
        apikey: sbKey,
        Authorization: `Bearer ${sbKey}`,
        Accept: 'application/json',
      },
      cache: 'no-store',
    });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        return data as UserProfile[];
      }
    }
  } catch (err) {
    console.warn('[Supabase] Error reading users:', err);
  }
  return null;
}

// Helper: Save users to Supabase REST API
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
  // 1. Try Vercel KV / Upstash Redis
  const kvUsers = await getFromKv();
  if (kvUsers) {
    memoryUsers = kvUsers;
    return { users: kvUsers, source: 'Vercel KV (Upstash)' };
  }

  // 2. Try Supabase
  const sbUsers = await getFromSupabase();
  if (sbUsers) {
    memoryUsers = sbUsers;
    return { users: sbUsers, source: 'Supabase Cloud' };
  }

  // 3. Resilient Preview / In-memory fallback
  return { users: memoryUsers, source: 'Modo Vista Previa (Memoria Local)' };
}

async function persistUsers(users: UserProfile[]) {
  memoryUsers = users;
  await saveToKv(users);
  await saveToSupabase(users);
}

export default async function handler(req: any, res: any) {
  // CORS Configuration
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {}
    }

    const { users, source } = await loadUsers();

    // GET: List users
    if (req.method === 'GET') {
      return res.status(200).json({
        success: true,
        users,
        dbSource: source,
        count: users.length,
      });
    }

    // POST: Create new user OR update user via fallback
    if (req.method === 'POST') {
      // Check if it's an update payload
      if (body.userId && body.updates) {
        const targetIndex = users.findIndex((u) => u.id === body.userId);
        if (targetIndex === -1) {
          return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
        }
        users[targetIndex] = { ...users[targetIndex], ...body.updates };
        await persistUsers(users);
        return res.status(200).json({
          success: true,
          user: users[targetIndex],
          users,
          message: 'Usuario actualizado correctamente',
        });
      }

      // Otherwise create new user
      const cleanEmail = (body.email || '').trim().toLowerCase();
      if (!cleanEmail) {
        return res.status(400).json({ success: false, message: 'El correo electrónico es obligatorio' });
      }

      const existingIndex = users.findIndex((u) => u.email.toLowerCase() === cleanEmail);
      if (existingIndex !== -1) {
        users[existingIndex] = {
          ...users[existingIndex],
          ...body,
          email: cleanEmail,
        };
        await persistUsers(users);
        return res.status(200).json({
          success: true,
          user: users[existingIndex],
          users,
          message: `Usuario ${users[existingIndex].name} actualizado.`,
        });
      }

      const newUser: UserProfile = {
        id: body.id || `user_${Date.now()}`,
        name: body.name?.trim() || 'Nuevo Usuario',
        email: cleanEmail,
        role: body.role || 'leader',
        companyId: body.companyId || 'comp_nexus',
        companyName: body.companyName || 'Industrias Nexus Automotriz',
        position: body.position || 'Líder Operativo',
        area: body.area || '',
        birthDate: body.birthDate || '',
        directReports: body.directReports !== undefined ? Number(body.directReports) : undefined,
        whatsapp: body.whatsapp || '',
        isProfileCompleted: body.isProfileCompleted ?? (body.role === 'admin'),
        isProfileComplete: body.isProfileComplete ?? (body.role === 'admin'),
        createdAt: new Date().toISOString().split('T')[0],
        status: body.status || 'active',
      };

      users.unshift(newUser);
      await persistUsers(users);

      return res.status(201).json({
        success: true,
        user: newUser,
        users,
        message: `Usuario ${newUser.name} creado exitosamente.`,
      });
    }

    // PUT: Update user
    if (req.method === 'PUT') {
      const urlParts = req.url.split('/');
      const rawId = urlParts[urlParts.length - 1]?.split('?')[0];
      const userId = body.userId || rawId;

      const targetIndex = users.findIndex((u) => u.id === userId);
      if (targetIndex === -1) {
        return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
      }

      users[targetIndex] = { ...users[targetIndex], ...body };
      await persistUsers(users);

      return res.status(200).json({
        success: true,
        user: users[targetIndex],
        users,
        message: 'Usuario actualizado exitosamente.',
      });
    }

    // DELETE: Delete user
    if (req.method === 'DELETE') {
      const urlParts = req.url.split('/');
      const rawId = urlParts[urlParts.length - 1]?.split('?')[0];
      const userId = body?.userId || rawId;

      const filtered = users.filter((u) => u.id !== userId);
      if (filtered.length === users.length) {
        return res.status(404).json({ success: false, message: 'Usuario no encontrado para eliminar' });
      }

      await persistUsers(filtered);
      return res.status(200).json({
        success: true,
        deletedId: userId,
        users: filtered,
        message: 'Usuario eliminado exitosamente.',
      });
    }

    return res.status(405).json({ success: false, message: 'Método no permitido' });
  } catch (error: any) {
    console.error('[API /api/users (Vercel)] Error:', error);
    return res.status(500).json({
      success: false,
      message: error?.message || 'Error interno en Vercel Serverless Function',
    });
  }
}
