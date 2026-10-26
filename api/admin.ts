// Vercel Serverless Function for /api/admin & /api/admin/profile

let adminProfile = {
  id: 'user_admin_tania',
  name: 'Tania Padierna',
  email: 'hola@taniapadierna.com',
  whatsapp: '+52 55 1234 5678',
  position: 'Creadora de la Plataforma & Coach Sr.',
  companyName: 'Lidacta Platform',
  area: 'Dirección de Producto y Mentoría',
  updatedAt: new Date().toISOString(),
};

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
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

  if (req.method === 'POST') {
    adminProfile = {
      ...adminProfile,
      ...body,
      updatedAt: new Date().toISOString(),
    };
    return res.status(200).json({ success: true, profile: adminProfile });
  }

  return res.status(200).json({ success: true, profile: adminProfile });
}
