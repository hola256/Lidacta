export const QA_LEADER_ID = 'user_qa_leader';
export const QA_LEADER_EMAIL = 'laura.qa@prueba-lidacta.local';
export const QA_EMAIL_DOMAIN = '@prueba-lidacta.local';
export const QA_SESSION_ID_PREFIX = 'ment_qa_';
export const QA_LEADER_NAME = 'Laura Méndez (Líder QA)';

export const QA_MENTOR_REQUEST_BLOCKED_MESSAGE =
  'La solicitud de Asesoría 1:1 no está disponible en sesiones de prueba.';

export interface QaGuardCheckResult {
  isQa: boolean;
  reason?: string;
}

/**
 * Determina en frontend si el contexto activo corresponde a una sesión QA o al perfil QA.
 */
export function isQaMentorContext(params: {
  activeMentorship?: { id?: string; isTestSession?: boolean } | null;
  currentUser?: { id?: string; email?: string; name?: string } | null;
}): boolean {
  const { activeMentorship, currentUser } = params;
  if (activeMentorship?.isTestSession === true) return true;
  if (
    typeof activeMentorship?.id === 'string' &&
    activeMentorship.id.trim().startsWith(QA_SESSION_ID_PREFIX)
  ) {
    return true;
  }
  if (currentUser?.id === QA_LEADER_ID) return true;
  const email = (currentUser?.email || '').trim().toLowerCase();
  if (email === QA_LEADER_EMAIL || email.endsWith(QA_EMAIL_DOMAIN)) return true;
  return false;
}

/**
 * Simula/evalúa el bloqueo del flujo de Asesoría 1:1 antes de despachar por red.
 */
export function evaluateMentorRequestFrontendGuard(params: {
  activeMentorship?: { id?: string; isTestSession?: boolean } | null;
  currentUser?: { id?: string; email?: string; name?: string } | null;
}): { allowed: boolean; blockedMessage?: string } {
  if (isQaMentorContext(params)) {
    return {
      allowed: false,
      blockedMessage: QA_MENTOR_REQUEST_BLOCKED_MESSAGE,
    };
  }
  return { allowed: true };
}

/**
 * Determina en backend si un payload proviene explícitamente de una sesión QA.
 */
export function isQaRequestPayload(payload: any): QaGuardCheckResult {
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
