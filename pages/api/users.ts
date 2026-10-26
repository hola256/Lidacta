import fs from 'fs';
import path from 'path';

const USERS_DB_PATH = path.join(process.cwd(), 'server_users_db.json');

function readUsers() {
  try {
    if (fs.existsSync(USERS_DB_PATH)) {
      const content = fs.readFileSync(USERS_DB_PATH, 'utf-8');
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) {
        return parsed.map((u: any) => ({
          ...u,
          status: u.status || 'active',
        }));
      }
    }
  } catch (err) {
    console.warn('[USERS API] Error reading db:', err);
  }
  return [];
}

function writeUsers(users: any[]) {
  try {
    fs.writeFileSync(USERS_DB_PATH, JSON.stringify(users, null, 2), 'utf-8');
  } catch (err) {
    console.error('[USERS API] Error writing db:', err);
  }
}

export default function handler(req: any, res: any) {
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

  const users = readUsers();

  if (req.method === 'GET') {
    return res.json({ success: true, users });
  }

  if (req.method === 'POST') {
    const {
      name,
      email,
      role,
      companyId,
      companyName,
      position,
      area,
      birthDate,
      directReports,
      whatsapp,
      status,
      password,
      userId,
    } = req.body || {};

    // Check if delete action
    if (req.query?.action === 'delete' || req.body?.action === 'delete') {
      const targetId = userId || req.query?.id;
      if (targetId === 'user_admin_tania') {
        return res.status(400).json({ success: false, message: 'No se puede eliminar la cuenta de administración principal.' });
      }
      const nextUsers = users.filter((u: any) => u.id !== targetId);
      writeUsers(nextUsers);
      return res.json({ success: true, message: 'Usuario eliminado', users: nextUsers });
    }

    if (!name || !email) {
      return res.status(400).json({ success: false, message: 'Nombre y correo son requeridos.' });
    }

    const cleanEmail = String(email).trim().toLowerCase();
    if (users.some((u: any) => u.email.toLowerCase() === cleanEmail)) {
      return res.status(400).json({ success: false, message: 'Ya existe una cuenta con este correo.' });
    }

    const newUser = {
      id: `user_${Date.now()}`,
      name: String(name).trim(),
      email: cleanEmail,
      role: role || 'leader',
      companyId: companyId || 'comp_nexus',
      companyName: companyName || 'Industrias Nexus Automotriz',
      position: position || 'Líder de Equipo',
      area: area || '',
      birthDate: birthDate || '',
      directReports: directReports !== undefined ? Number(directReports) : 5,
      whatsapp: whatsapp || '',
      status: status === 'inactive' ? 'inactive' : 'active',
      password: password || '',
      isProfileCompleted: true,
      isProfileComplete: true,
      createdAt: new Date().toISOString(),
    };

    users.unshift(newUser);
    writeUsers(users);

    return res.status(201).json({ success: true, message: 'Usuario creado exitosamente', user: newUser, users });
  }

  if (req.method === 'PUT') {
    const { id } = req.query;
    const updates = req.body || {};
    const targetIndex = users.findIndex((u: any) => u.id === id);

    if (targetIndex === -1) {
      return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    }

    users[targetIndex] = {
      ...users[targetIndex],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    writeUsers(users);

    return res.json({ success: true, message: 'Usuario actualizado', user: users[targetIndex], users });
  }

  if (req.method === 'DELETE') {
    const { id } = req.query;
    if (id === 'user_admin_tania') {
      return res.status(400).json({ success: false, message: 'No se puede eliminar la cuenta principal de administración.' });
    }
    const nextUsers = users.filter((u: any) => u.id !== id);
    writeUsers(nextUsers);
    return res.json({ success: true, message: 'Usuario eliminado', users: nextUsers });
  }

  return res.status(405).json({ success: false, message: 'Método no soportado' });
}
