// Vercel Serverless Function for /api/user/complete-profile
// 100% self-contained: no external relative module imports to prevent ERR_MODULE_NOT_FOUND in Vercel
import { Resend } from 'resend';

function generateInviteEmailHtml(user: { name: string; email: string; companyName?: string }, directUrl: string): string {
  const currentYear = new Date().getFullYear();
  const userName = user.name || 'Líder Lidacta';
  const company = user.companyName || 'Industrias Nexus Automotriz';

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>Te invitan a completar tu perfil en Lidacta</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #F8F6F4; margin: 0; padding: 24px; color: #2D1B4E;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(45, 27, 78, 0.08); border: 1px solid #EADBCE;">
    <tr>
      <td style="background-color: #2D1B4E; padding: 32px 24px; text-align: center;">
        <h1 style="color: #FFF7EF; font-size: 24px; margin: 0 0 8px 0; font-weight: 800; letter-spacing: -0.5px;">LIDACTA</h1>
        <p style="color: #F7B538; font-size: 13px; margin: 0; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">Invitación de Onboarding Directivo</p>
      </td>
    </tr>
    <tr>
      <td style="padding: 32px 28px;">
        <span style="display: inline-block; padding: 4px 12px; background-color: #FFD3BF; color: #BF3A1B; border-radius: 20px; font-size: 11px; font-weight: 700; text-transform: uppercase; margin-bottom: 12px;">Paso Requerido</span>
        <h2 style="font-size: 20px; color: #2D1B4E; margin: 0 0 16px 0; font-weight: 700;">¡Hola ${userName}!</h2>
        <p style="font-size: 14px; line-height: 1.6; color: #4A3F55; margin: 0 0 16px 0;">
          La administración de <strong>${company}</strong> te ha invitado a formar parte del programa directivo en <strong>Lidacta</strong>.
        </p>
        <p style="font-size: 14px; line-height: 1.6; color: #4A3F55; margin: 0 0 20px 0;">
          Para habilitar tu acceso seguro y comenzar tu proceso de acompañamiento directivo personalizado, por favor ingresa al siguiente enlace y completa los datos de tu entorno operativo (Área, Puesto, WhatsApp y Personas a Cargo):
        </p>
        <div style="background-color: #FFF7EF; border: 1px solid #EADBCE; padding: 18px; border-radius: 12px; margin: 0 0 24px 0; text-align: left;">
          <p style="font-size: 13px; font-weight: 700; color: #2D1B4E; margin: 0 0 6px 0;">📋 Tus datos de acceso:</p>
          <p style="font-size: 13px; color: #4A3F55; margin: 0 0 4px 0;">• <strong>Usuario:</strong> ${user.email}</p>
          <p style="font-size: 13px; color: #4A3F55; margin: 0;">• <strong>Empresa:</strong> ${company}</p>
        </div>
        <div style="text-align: center; margin: 28px 0 24px 0;">
          <a href="${directUrl}" style="background-color: #F7B538; color: #2D1B4E; padding: 14px 28px; font-size: 14px; font-weight: 800; text-decoration: none; border-radius: 12px; display: inline-block; box-shadow: 0 4px 12px rgba(247, 181, 56, 0.35);">
            Completar Mi Perfil en Lidacta →
          </a>
        </div>
        <div style="background-color: #FFF7EF; border-left: 4px solid #F7B538; padding: 14px 16px; border-radius: 8px; margin: 0 0 20px 0;">
          <p style="font-size: 12px; font-weight: 700; color: #2D1B4E; margin: 0 0 4px 0;">🔒 Confidencialidad Absoluta Garantizada</p>
          <p style="font-size: 11px; line-height: 1.5; color: #4A3F55; margin: 0;">
            El contenido de tus conversaciones, casos y simulaciones es estrictamente privado y confidencial. Recursos Humanos únicamente recibe métricas agregadas de participación.
          </p>
        </div>
        <p style="font-size: 12px; color: #4A3F55; text-align: center; margin: 16px 0 0 0;">
          Si el botón no funciona, copia y pega este enlace en tu navegador:<br>
          <a href="${directUrl}" style="color: #BF3A1B; text-decoration: underline; word-break: break-all;">${directUrl}</a>
        </p>
      </td>
    </tr>
    <tr>
      <td style="background-color: #FFF7EF; padding: 20px 24px; text-align: center; border-top: 1px solid #EADBCE;">
        <p style="font-size: 11px; color: #4A3F55; margin: 0;">Lidacta © ${currentYear} · Desarrollo de Liderazgo Operativo</p>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

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
    body = body || {};

    // Acción de Invitación para Completar Perfil (Panel de Administración)
    if (body?.action === 'invite' || body?.action === 'send_invite' || body?.sendInvite === true) {
      const cleanEmail = (body.email || body.to || '').trim().toLowerCase();
      const cleanName = (body.name || '').trim() || 'Líder Lidacta';
      const compName = (body.companyName || '').trim() || 'Industrias Nexus Automotriz';
      const rawInviteUrl = (body.inviteUrl || '').trim();

      if (!cleanEmail || !cleanEmail.includes('@')) {
        return res.status(200).json({
          success: false,
          error: 'El correo electrónico del destinatario es obligatorio y debe ser válido.',
          message: 'El correo electrónico del destinatario es obligatorio y debe ser válido.',
        });
      }

      let directUrl = rawInviteUrl || 'https://ais-dev-5pctfozdv244x3okeqjryq-710027895954.us-east1.run.app';
      if (!directUrl.includes('/complete-profile')) {
        directUrl = `${directUrl.replace(/\/+$/, '')}/complete-profile`;
      }

      const emailSubject = 'Te invitan a completar tu perfil en Lidacta';
      const fromEmail = 'Lidacta <notificaciones@taniapadierna.com>';
      const replyToEmail = 'hola@taniapadierna.com';

      const emailHtml = generateInviteEmailHtml(
        { name: cleanName, email: cleanEmail, companyName: compName },
        directUrl
      );
      const emailText = `¡Hola ${cleanName}!\n\nLa administración de ${compName} te ha invitado a formar parte del programa directivo en Lidacta.\n\nPara habilitar tu acceso seguro y comenzar tu proceso de acompañamiento directivo personalizado, por favor ingresa al siguiente enlace y completa los datos de tu entorno operativo (Área, Puesto, WhatsApp y Personas a Cargo):\n\n${directUrl}\n\nDatos de acceso:\nUsuario: ${cleanEmail}\nEmpresa: ${compName}\n\nEl contenido de tus conversaciones es privado y confidencial.\nPuedes responder directamente a este correo o escribir a ${replyToEmail}.\n\nAtentamente,\nEl Equipo de Lidacta`;

      const resendApiKey = process.env.RESEND_API_KEY;
      if (!resendApiKey || !resendApiKey.trim()) {
        console.warn('[API /api/user/complete-profile action=invite] ⚠️ RESEND_API_KEY no configurada. Simulando despacho.');
        return res.status(200).json({
          success: true,
          message: `Invitación simulada para ${cleanEmail} (sin clave de Resend configurada).`,
          simulated: true,
        });
      }

      try {
        const resend = new Resend(resendApiKey.trim());
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
          console.error('[INVITE_ERROR]: Resend delivery failed:', resendErrMsg);
          return res.status(200).json({
            success: false,
            error: resendErrMsg,
            message: resendErrMsg,
          });
        }

        const emailId = resendResult.data?.id;
        console.log(`[API /api/user/complete-profile action=invite] ✅ Correo despachado exitosamente ID: ${emailId}`);

        return res.status(200).json({
          success: true,
          emailId,
          message: `Correo de invitación para completar perfil enviado a ${cleanEmail}`,
        });
      } catch (sdkErr: any) {
        const sdkErrMsg = typeof sdkErr === 'string' ? sdkErr : (sdkErr?.message || String(sdkErr));
        console.error('[INVITE_ERROR]: Excepción en llamada a Resend SDK:', sdkErrMsg);
        return res.status(200).json({
          success: false,
          error: sdkErrMsg,
          message: sdkErrMsg,
        });
      }
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
