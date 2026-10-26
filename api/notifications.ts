// Vercel Serverless Function for /api/notifications

interface ServerNotificationItem {
  id: string;
  recipientRole: string;
  recipientUserId?: string;
  companyId?: string;
  title: string;
  message: string;
  type: string;
  createdAt: string;
  read: boolean;
  mentorRequestDetails?: any;
}

const DEFAULT_NOTIFICATIONS: ServerNotificationItem[] = [
  {
    id: 'notif_init_1',
    recipientRole: 'admin',
    companyId: 'comp_nexus',
    title: 'Solicitud de Asesoría 1:1 Recibida',
    message: 'Roberto Gómez (Líder en Industrias Nexus) solicitó acompañamiento directo en Etapa 5.',
    type: 'mentor_request',
    createdAt: new Date().toISOString(),
    read: false,
    mentorRequestDetails: {
      status: 'pending',
      leaderName: 'Roberto Gómez',
      leaderEmail: 'roberto.gomez@nexus-auto.com',
      companyName: 'Industrias Nexus Automotriz',
      caseTitle: 'Falta de involucramiento del equipo en los estándares 5S de la línea',
      stage: 5,
    },
  },
];

let memoryNotifications: ServerNotificationItem[] = [...DEFAULT_NOTIFICATIONS];

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

  if (req.method === 'GET') {
    return res.status(200).json({
      success: true,
      notifications: memoryNotifications,
    });
  }

  if (req.method === 'POST') {
    if (body.notificationId && body.status) {
      memoryNotifications = memoryNotifications.map((n) => {
        if (n.id === body.notificationId && n.mentorRequestDetails) {
          return {
            ...n,
            mentorRequestDetails: {
              ...n.mentorRequestDetails,
              status: body.status || n.mentorRequestDetails.status,
              adminNotes: body.notes !== undefined ? body.notes : n.mentorRequestDetails.adminNotes,
            },
          };
        }
        return n;
      });
      return res.status(200).json({ success: true, notifications: memoryNotifications });
    }

    if (body.title && body.message) {
      const newNotif: ServerNotificationItem = {
        id: `notif_${Date.now()}`,
        recipientRole: body.recipientRole || 'admin',
        recipientUserId: body.recipientUserId,
        companyId: body.companyId,
        title: body.title,
        message: body.message,
        type: body.type || 'info',
        createdAt: new Date().toISOString(),
        read: false,
        mentorRequestDetails: body.mentorRequestDetails,
      };
      memoryNotifications.unshift(newNotif);
      return res.status(201).json({ success: true, notification: newNotif, notifications: memoryNotifications });
    }
  }

  return res.status(200).json({ success: true, notifications: memoryNotifications });
}
