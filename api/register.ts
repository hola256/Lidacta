import { Resend } from 'resend';

export const config = {
  maxDuration: 15,
};

// Standalone UserProfile definition to eliminate external module dependencies
export interface UserProfile {
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

// Vercel Serverless Function for /api/register
// 100% self-contained: no external relative module imports, eliminating ERR_MODULE_NOT_FOUND
export default async function handler(req: any, res: any) {
  try {
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

    if (req.method !== 'POST') {
      return res.status(200).json({
        success: false,
        error: 'Método HTTP no permitido. Utiliza POST para registrar usuarios.',
        message: 'Método HTTP no permitido. Utiliza POST para registrar usuarios.',
      });
    }

    // 1. Mandatory Check for RESEND_API_KEY
    const resendApiKey = process.env.RESEND_API_KEY;
    if (!resendApiKey || !resendApiKey.trim()) {
      console.error('[REGISTER_ERROR]: RESEND_API_KEY no está configurada en Vercel');
      return res.status(200).json({
        success: false,
        error: 'RESEND_API_KEY no está configurada en Vercel',
        message: 'RESEND_API_KEY no está configurada en Vercel',
      });
    }

    // 2. Safe Body Parsing
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch (parseErr) {
        console.error('[REGISTER_ERROR]: Error al parsear JSON del cuerpo:', parseErr);
        body = {};
      }
    }
    body = body || {};

    const cleanEmail = (body.email || '').trim().toLowerCase();
    const cleanName = (body.name || '').trim();

    if (!cleanName || cleanName.length < 2) {
      console.error('[REGISTER_ERROR]: El nombre completo es obligatorio y no cumple longitud mínima');
      return res.status(200).json({
        success: false,
        error: 'El nombre completo es obligatorio para el registro.',
        message: 'El nombre completo es obligatorio para el registro.',
      });
    }

    if (!cleanEmail || !cleanEmail.includes('@')) {
      console.error('[REGISTER_ERROR]: El correo electrónico proporcionado no es válido');
      return res.status(200).json({
        success: false,
        error: 'El correo electrónico corporativo es obligatorio y debe ser válido.',
        message: 'El correo electrónico corporativo es obligatorio y debe ser válido.',
      });
    }

    // 3. Resilient User Loading
    let users: UserProfile[] = [];
    try {
      const result = await loadUsers();
      users = result?.users || [];
    } catch (loadErr: any) {
      console.error('[REGISTER_ERROR]: Error al cargar usuarios de base de datos:', loadErr);
      users = [...DEFAULT_USERS];
    }

    // Check duplicate
    const existingIndex = users.findIndex((u) => u.email.toLowerCase() === cleanEmail);
    if (existingIndex !== -1) {
      return res.status(200).json({
        success: false,
        error: 'Ya existe una cuenta registrada con este correo electrónico. Por favor inicia sesión.',
        message: 'Ya existe una cuenta registrada con este correo electrónico. Por favor inicia sesión.',
      });
    }

    const newUser: UserProfile = {
      id: body.id || `user_${Date.now()}`,
      name: cleanName,
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
      password: body.password || '',
    };

    const fromEmail = process.env.RESEND_FROM_EMAIL || 'Lidacta <notificaciones@taniapadierna.com>';
    const replyToEmail = process.env.RESEND_REPLY_TO || 'hola@taniapadierna.com';

    console.log(`[API /api/register] ==========================================`);
    console.log(`[API /api/register] 🚀 Iniciando registro de usuario: ${cleanName} (${cleanEmail})`);
    console.log(`[API /api/register] Remitente Oficial (From): ${fromEmail}`);
    console.log(`[API /api/register] Responder a (Reply-To): ${replyToEmail}`);

    // 4. Safe User Persistence
    users.unshift(newUser);
    try {
      await persistUsers(users);
      console.log(`[API /api/register] ✅ Usuario guardado en almacenamiento persistente: ${newUser.name}`);
    } catch (persistErr: any) {
      console.error('[REGISTER_ERROR]: Error persistiendo usuarios:', persistErr);
    }

    // 5. Envío nativo de correo con el SDK oficial de Resend (con await dentro de try/catch dedicado)
    let emailDeliveryResult: { success: boolean; emailId?: string; error?: string } = { success: false };
    try {
      const resend = new Resend(resendApiKey);
      const emailSubject = `¡Te damos la bienvenida a Lidacta, ${newUser.name}!`;

      const emailHtml = `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><title>${emailSubject}</title></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #F8F6F4; margin: 0; padding: 24px; color: #2D1B4E;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(45, 27, 78, 0.08); border: 1px solid #EADBCE;">
    <tr>
      <td style="background-color: #2D1B4E; padding: 32px 24px; text-align: center;">
        <h1 style="color: #FFF7EF; font-size: 24px; margin: 0 0 8px 0; font-weight: 800;">LIDACTA</h1>
        <p style="color: #F7B538; font-size: 13px; margin: 0; font-weight: 600; text-transform: uppercase;">Desarrollo de Liderazgo en Acción</p>
      </td>
    </tr>
    <tr>
      <td style="padding: 32px 28px;">
        <h2 style="font-size: 20px; color: #2D1B4E; margin: 0 0 16px 0;">¡Hola ${newUser.name}!</h2>
        <p style="font-size: 14px; line-height: 1.6; color: #4A3F55; margin: 0 0 16px 0;">
          Te damos una cálida bienvenida a <strong>Lidacta</strong>. Tu cuenta ha sido creada exitosamente asociada a <strong>${newUser.companyName}</strong>.
        </p>
        <p style="font-size: 14px; line-height: 1.6; color: #4A3F55; margin: 0 0 20px 0;">
          Lidacta es tu espacio seguro, confidencial y práctico en el que tendrás un mentor para acompañarte y ayudarte a resolver los retos relacionados con el manejo de personas. Podrás también encontrar herramientas y establecer acciones que fortalezcan tu autonomía como líder.
        </p>
        <div style="background-color: #FFF7EF; border-left: 4px solid #F7B538; padding: 16px; border-radius: 8px; margin: 0 0 24px 0;">
          <p style="font-size: 13px; font-weight: 700; color: #2D1B4E; margin: 0 0 6px 0;">🔒 Confidencialidad Absoluta Garantizada</p>
          <p style="font-size: 12px; line-height: 1.5; color: #4A3F55; margin: 0;">
            El contenido de tus conversaciones y casos es estrictamente privado. Recursos Humanos únicamente recibe métricas agregadas de participación.
          </p>
        </div>
      </td>
    </tr>
    <tr>
      <td style="background-color: #FFF7EF; padding: 20px 24px; text-align: center; border-top: 1px solid #EADBCE;">
        <p style="font-size: 11px; color: #4A3F55; margin: 0;">Lidacta © ${new Date().getFullYear()} · Desarrollo de Liderazgo Operativo</p>
      </td>
    </tr>
  </table>
</body>
</html>`;

      const emailText = `¡Hola ${newUser.name}!\n\nTe damos una cálida bienvenida a Lidacta: Desarrollo de Liderazgo en Acción.\nTu cuenta ha sido creada exitosamente asociada a ${newUser.companyName}.\n\nLidacta es tu espacio seguro, confidencial y práctico en el que tendrás un mentor para acompañarte y ayudarte a resolver los retos relacionados con el manejo de personas. Podrás también encontrar herramientas y establecer acciones que fortalezcan tu autonomía como líder.\n\nAtentamente,\nEl Equipo de Lidacta\nResponder a: ${replyToEmail}`;

      console.log(`[API /api/register] 🚀 Ejecutando envío oficial con Resend SDK para: ${cleanEmail}...`);
      const resendResult = await resend.emails.send({
        from: fromEmail,
        to: [cleanEmail],
        replyTo: replyToEmail,
        subject: emailSubject,
        html: emailHtml,
        text: emailText,
      });

      if (resendResult.error) {
        const resendErr: any = resendResult.error;
        const resendErrMsg = typeof resendErr === 'string'
          ? resendErr
          : (resendErr?.message || String(resendErr));
        console.error('[REGISTER_ERROR]: Resend delivery failed:', resendErrMsg);
        emailDeliveryResult = { success: false, error: resendErrMsg };
      } else {
        const emailId = resendResult.data?.id;
        console.log(`[API /api/register] ✅ Correo entregado exitosamente vía Resend con ID: ${emailId}`);
        emailDeliveryResult = { success: true, emailId };
      }
    } catch (emailErr: any) {
      const emailErrMsg = typeof emailErr === 'string'
        ? emailErr
        : (emailErr?.message || String(emailErr));
      console.error('[REGISTER_ERROR]: Excepción en llamada a Resend SDK:', emailErrMsg);
      emailDeliveryResult = { success: false, error: emailErrMsg };
    }

    console.log(`[API /api/register] ✅ Usuario creado exitosamente: ${newUser.name} (${newUser.email})`);
    console.log(`[API /api/register] ==========================================`);

    return res.status(200).json({
      success: true,
      user: newUser,
      users,
      emailSent: emailDeliveryResult.success,
      emailId: emailDeliveryResult.emailId,
      emailError: emailDeliveryResult.error,
      message: 'Usuario registrado exitosamente en Lidacta.',
    });
  } catch (error: any) {
    console.error('[REGISTER_ERROR]:', error);
    const errorMessage = typeof error?.message === 'string'
      ? error.message
      : (typeof error === 'string' ? error : 'Error inesperado durante el registro');
    return res.status(200).json({
      success: false,
      error: errorMessage,
      message: errorMessage,
    });
  }
}
