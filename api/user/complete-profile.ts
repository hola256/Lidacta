// Vercel Serverless Function for /api/user/complete-profile
import { loadUsers, persistUsers } from '../users';

export default async function handler(req: any, res: any) {
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

  const { userId, email, companyName, area, birthDate, directReports, whatsapp } = body || {};

  try {
    const { users } = await loadUsers();
    const cleanEmail = (email || '').trim().toLowerCase();

    const targetIdx = users.findIndex(
      (u) => (userId && u.id === userId) || (cleanEmail && u.email.toLowerCase() === cleanEmail)
    );

    if (targetIdx !== -1) {
      users[targetIdx] = {
        ...users[targetIdx],
        companyName: companyName ? companyName.trim() : users[targetIdx].companyName,
        area: area !== undefined ? area.trim() : users[targetIdx].area,
        birthDate: birthDate ? birthDate.trim() : users[targetIdx].birthDate,
        directReports: directReports !== undefined ? Number(directReports) : users[targetIdx].directReports,
        whatsapp: whatsapp ? whatsapp.trim() : users[targetIdx].whatsapp,
        isProfileCompleted: true,
        isProfileComplete: true,
      };

      await persistUsers(users);

      return res.status(200).json({
        success: true,
        message: 'Perfil completado exitosamente y persistido en la Base de Datos Central.',
        user: users[targetIdx],
        users,
      });
    }

    // Fallback if user was newly created in memory
    return res.status(200).json({
      success: true,
      message: 'Perfil completado exitosamente.',
      user: {
        id: userId || `user_${Date.now()}`,
        email: cleanEmail,
        companyName: companyName?.trim() || '',
        area: area?.trim() || '',
        birthDate: birthDate?.trim() || '',
        directReports: directReports ? Number(directReports) : 5,
        whatsapp: whatsapp?.trim() || '',
        isProfileCompleted: true,
        isProfileComplete: true,
      },
      users,
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: err?.message || 'Error al completar el perfil en el servidor.',
    });
  }
}

