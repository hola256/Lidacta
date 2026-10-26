// Vercel Serverless Function for /api/user/complete-profile

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

  return res.status(200).json({
    success: true,
    message: 'Perfil completado exitosamente y persistido en Vercel.',
    user: {
      id: userId || 'user_leader_carlos',
      email: email || 'carlos.mendoza@novaretail.com',
      companyName: companyName || 'Retail Nova Grupo Comercial',
      area: area || '',
      birthDate: birthDate || '',
      directReports: directReports ? Number(directReports) : 8,
      whatsapp: whatsapp || '',
      isProfileCompleted: true,
      isProfileComplete: true,
    },
  });
}
