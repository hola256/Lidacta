// Vercel Serverless Function for /api/notifications
// Self-contained QA isolation guard to avoid ERR_MODULE_NOT_FOUND in Vercel Node ESM runtime

const QA_LEADER_ID = 'user_qa_leader';
const QA_LEADER_EMAIL = 'laura.qa@prueba-lidacta.local';
const QA_EMAIL_DOMAIN = '@prueba-lidacta.local';
const QA_SESSION_ID_PREFIX = 'ment_qa_';
const QA_LEADER_NAME = 'Laura Méndez (Líder QA)';

function isQaRequestPayload(payload: any): { isQa: boolean; reason?: string } {
  if (!payload || typeof payload !== 'object') {
    return { isQa: false };
  }

  if (payload.isTestSession === true || payload.isTestSession === 'true') {
    return { isQa: true, reason: 'isTestSession' };
  }

  const candidateIds = [
    payload.leaderId,
    payload.userId,
    payload.mentorRequestDetails?.leaderId,
  ];
  if (candidateIds.some((id) => typeof id === 'string' && id.trim() === QA_LEADER_ID)) {
    return { isQa: true, reason: 'QA_TEST_LEADER_ID' };
  }

  const candidateSessionIds = [
    payload.sessionId,
    payload.mentorshipId,
    payload.caseId,
    payload.mentorRequestDetails?.sessionId,
  ];
  if (
    candidateSessionIds.some(
      (sid) => typeof sid === 'string' && sid.trim().startsWith(QA_SESSION_ID_PREFIX)
    )
  ) {
    return { isQa: true, reason: 'ment_qa_sessionId' };
  }

  const candidateEmails = [
    payload.leaderEmail,
    payload.email,
    payload.to,
    payload.mentorRequestDetails?.leaderEmail,
  ];
  for (const rawEmail of candidateEmails) {
    if (typeof rawEmail === 'string') {
      const normalized = rawEmail.trim().toLowerCase();
      if (normalized === QA_LEADER_EMAIL || normalized.endsWith(QA_EMAIL_DOMAIN)) {
        return { isQa: true, reason: 'qa_email' };
      }
    }
  }

  const candidateNames = [
    payload.leaderName,
    payload.name,
    payload.mentorRequestDetails?.leaderName,
  ];
  if (candidateNames.some((n) => typeof n === 'string' && n.trim() === QA_LEADER_NAME)) {
    return { isQa: true, reason: 'qa_leader_name' };
  }

  return { isQa: false };
}

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

export const maxDuration = 60; // 60 segundos de timeout

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
    const qaCheck = isQaRequestPayload(body);
    if (qaCheck.isQa) {
      return res.status(403).json({
        success: false,
        blockedByQa: true,
        message: 'Notificación bloqueada por aislamiento de sesiones QA.',
      });
    }

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
