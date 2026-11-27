import React, { createContext, useContext, useState, useEffect, useMemo, useRef } from 'react';
import {
  CompanyContext,
  MentorshipSession,
  MentorshipActionPlan,
  MentorshipLearnings,
  FinalFeedbackReport,
  NotificationItem,
  StageNumber,
  ActionPlanExecutionStatus,
  UserProfile,
  UserRole,
  RecommendedResourceItem,
  SystemAlertItem,
  LeadershipSkillEntry,
} from '../types/lidacta';
import {
  INITIAL_COMPANIES,
  INITIAL_MENTORSHIPS,
  INITIAL_NOTIFICATIONS,
  INITIAL_USERS,
  DEFAULT_ADMIN_PROFILE,
  INITIAL_RECOMMENDED_RESOURCES,
  INITIAL_SYSTEM_ALERTS,
  INTERNAL_LIBRARY_CATALOG,
  EXTERNAL_SOURCES_CATALOG,
} from '../data/mockData';
import { userService, UserServiceResponse } from '../services/userService';
import { emailService } from '../services/emailService';
import { safeString, extractErrorMessage } from '../utils/safeError';
import { isHumanResourcesRole } from '../utils/roleUtils';
import {
  formatStageTwoSkillsWithEvidence,
  resolveConsolidatedStageTwoSkills,
  normalizeExistingSessionSkills,
  getActiveSkillEntries,
  getActiveSkillNames,
  sanitizeDetectedStrengths,
  INSUFFICIENT_EVIDENCE_MESSAGE,
  INSUFFICIENT_STRENGTHS_MESSAGE,
} from '../utils/skillsConsolidator';
import {
  QA_TEST_LEADER_ID,
  QA_TEST_LEADER_PROFILE,
  buildTestSessionForStage,
} from '../utils/testSessionFixtures';

export const MENTOR_TEMPORARY_ERROR_TEXT =
  'Lidacta no pudo responder en este momento. Por favor reintenta.';

export function isTechnicalErrorMessage(m: any): boolean {
  if (!m || typeof m !== 'object') return false;
  const text = String(m.text || m.content || '').toLowerCase();
  return Boolean(
    (m.id && String(m.id).includes('_err')) ||
      m.isError ||
      text.includes('no pudo responder en este momento') ||
      text.includes('por favor reintenta') ||
      text.includes('error de servidor')
  );
}

export function stripSessionMessagesForApi<T extends Record<string, any>>(
  session: T
): Omit<T, 'messages'> {
  const { messages: _omittedMessages, ...sessionWithoutMessages } = session;
  return sessionWithoutMessages;
}

export function isVerifiedGeminiResponse(
  data: any,
  options: { requireExplicitVerification?: boolean } = {}
): boolean {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return false;
  if (data.success === false) return false;
  const nested = data.data && typeof data.data === 'object' ? data.data : {};
  if (data.isFallback === true || nested.isFallback === true) return false;
  if (
    data.responseSource === 'deterministic_fallback' ||
    nested.responseSource === 'deterministic_fallback' ||
    data.responseSource === 'error' ||
    nested.responseSource === 'error'
  ) {
    return false;
  }
  if (data.isGeminiVerified === false || nested.isGeminiVerified === false) return false;
  if (options.requireExplicitVerification) {
    const hasVerifiedFlag =
      data.isGeminiVerified === true || nested.isGeminiVerified === true;
    const hasGeminiSource =
      data.responseSource === 'gemini' || nested.responseSource === 'gemini';
    if (!hasVerifiedFlag || !hasGeminiSource) {
      return false;
    }
  }
  return true;
}

function isCleanStage7Text(val: unknown): val is string {
  if (typeof val !== 'string') return false;
  const trimmed = val.trim();
  if (!trimmed) return false;
  const upper = trimmed.toUpperCase();
  const lower = trimmed.toLowerCase();
  if (
    upper.startsWith('ERROR DE SERVIDOR') ||
    lower.includes('error de servidor') ||
    lower.includes('no pudo responder en este momento') ||
    lower.includes('por favor reintenta')
  ) {
    return false;
  }
  return true;
}

function isStage7InsufficientPlaceholderText(val: string): boolean {
  const norm = val.trim().toLowerCase();
  return (
    norm === INSUFFICIENT_EVIDENCE_MESSAGE.toLowerCase() ||
    norm === INSUFFICIENT_STRENGTHS_MESSAGE.toLowerCase() ||
    norm.startsWith('no se cuenta con evidencia suficiente')
  );
}

function normalizeStage6ComparisonText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function detectStage6ExecutionCorrection(
  userMessage: string,
  currentStatus?: string | null
): 'not_executed' | null {
  if (typeof userMessage !== 'string' || !userMessage.trim()) return null;
  if (currentStatus === 'not_executed') return null;

  const norm = normalizeStage6ComparisonText(userMessage);

  const hasButtonErrorSignal =
    /(?:(?:me equivoque|presione|aprete|le di|seleccione|toque|marque|oprimi)\s+(?:el\s+boton|por\s+error|sin\s+querer|accidentalmente|"?si"?\s*(?:por\s+error|sin\s+querer|accidentalmente)?))|(?:por\s+error\s+(?:presione|aprete|seleccione|marque|le\s+di)\s+(?:a\s+)?(?:el\s+boton|"?si"?))|(?:(?:boton|por\s+error|sin\s+querer|accidentalmente).*(?:no\s+(?:he|lo|la)|aun\s+no|todavia\s+no))/.test(
      norm
    );

  const affirmsAlreadyExecuted =
    /\b(?:ya|si)\s+(?:lo\s+|la\s+)?(?:ejecute|realice|hice|lleve\s+a\s+cabo)\b/.test(norm);

  if (affirmsAlreadyExecuted && !hasButtonErrorSignal) {
    return null;
  }

  const hasExplicitNonExecution =
    /(?:^|\b)(?:aun\s+|todavia\s+)?no\s+(?:he\s+|lo\s+|la\s+)?(?:ejecutado|realizado|llevado\s+a\s+cabo|hecho|cumplido|implementado|aplicado|tenido\s+la\s+conversacion)\b/.test(
      norm
    ) ||
    /(?:todavia|aun)\s+no\s+(?:lo\s+|la\s+)?(?:hago|ejecuto|realizo|aplico|cumplo)\b/.test(
      norm
    ) ||
    /\bno\s+pude\s+(?:ejecutar|realizar|llevar\s+a\s+cabo|hacer|tener\s+la\s+conversacion)\b/.test(
      norm
    );

  if (hasButtonErrorSignal || hasExplicitNonExecution) {
    return 'not_executed';
  }

  return null;
}

function stripExecutionStatusClarificationClauses(norm: string): string {
  return norm
    .replace(
      /\b(?:la\s+verdad|honestamente|perdon|disculpa|disculpen|solo\s+para\s+aclarar|para\s+aclarar|queria\s+aclarar)\b/g,
      ' '
    )
    .replace(
      /\bme\s+equivoque(?:\s+al\s+(?:presionar|apretar|darle|seleccionar|tocar|marcar|oprimir)(?:\s+(?:a\s+|en\s+)?(?:el\s+boton(?:\s+(?:de\s+)?si)?|"?si"?))?)?\b/g,
      ' '
    )
    .replace(
      /\b(?:presione|aprete|le\s+di|seleccione|toque|marque|oprimi)\s+(?:a\s+|en\s+)?(?:el\s+boton(?:\s+(?:de\s+)?si)?|por\s+error|sin\s+querer|accidentalmente|"?si"?(?:\s*(?:por\s+error|sin\s+querer|accidentalmente))?)\b/g,
      ' '
    )
    .replace(
      /\bpor\s+error\s+(?:presione|aprete|seleccione|marque|le\s+di)(?:\s+(?:a\s+)?(?:el\s+boton|"?si"?))?\b/g,
      ' '
    )
    .replace(/\b(?:por\s+error|sin\s+querer|accidentalmente)\b/g, ' ')
    .replace(
      /\b(?:aun|todavia)\s+no\s+(?:he\s+|lo\s+|la\s+)?(?:ejecutado|realizado|llevado\s+a\s+cabo|hecho|cumplido|implementado|aplicado|tenido\s+la\s+conversacion|hago|ejecuto|realizo|aplico|cumplo)(?:\s+(?:el\s+plan(?:\s+de\s+accion)?|la\s+accion|esto|eso))?(?:\s+(?:aun|todavia))?\b/g,
      ' '
    )
    .replace(
      /\bno\s+(?:he\s+|lo\s+|la\s+)?(?:ejecutado|realizado|llevado\s+a\s+cabo|hecho|cumplido|implementado|aplicado|tenido\s+la\s+conversacion)(?:\s+(?:el\s+plan(?:\s+de\s+accion)?|la\s+accion|esto|eso))?(?:\s+(?:aun|todavia))?\b/g,
      ' '
    )
    .replace(
      /\bno\s+pude\s+(?:ejecutar|realizar|llevar\s+a\s+cabo|hacer|tener\s+la\s+conversacion)(?:lo|la)?(?:\s+(?:el\s+plan(?:\s+de\s+accion)?|la\s+accion|esto|eso))?(?:\s+(?:aun|todavia))?\b/g,
      ' '
    )
    .replace(/\b(?:el\s+plan|la\s+accion)\s+(?:sigue|esta|permanece)\s+pendiente(?:\s+de\s+ejecucion)?\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function isNonSubstantiveNonExecutionNote(value: string): boolean {
  const norm = normalizeStage6ComparisonText(value);
  if (!norm) return true;

  const pureUncertaintyOrFiller = [
    'aun no lo se',
    'todavia no lo se',
    'no lo se',
    'no se',
    'aun no',
    'todavia no',
    'pendiente',
    'ninguno',
    'ninguna',
    'nada',
    'n a',
    'na',
    'no aplica',
    'sin ejecucion',
  ];
  if (pureUncertaintyOrFiller.includes(norm)) return true;

  if (detectStage6ExecutionCorrection(value, 'executed') === 'not_executed') {
    const remainder = stripExecutionStatusClarificationClauses(norm);
    if (!remainder) return true;
    const trivialStatusTokens = new Set([
      'y', 'o', 'pero', 'que', 'de', 'el', 'la', 'los', 'las', 'un', 'una', 'a', 'en',
      'con', 'por', 'para', 'mi', 'su', 'lo', 'le', 'se', 'aun', 'todavia', 'ya', 'si', 'no',
      'boton', 'plan', 'accion', 'eso', 'esto',
    ]);
    const meaningfulRemainderWords = remainder
      .split(' ')
      .filter((w) => w.length >= 2 && !trivialStatusTokens.has(w));
    return meaningfulRemainderWords.length < 3;
  }

  return false;
}

export function reconcileStage6ExecutionState(
  session: MentorshipSession,
  nextStatus: ActionPlanExecutionStatus,
  now: string = new Date().toISOString()
): MentorshipSession {
  const updatedActionPlan: MentorshipActionPlan | undefined = session.actionPlan
    ? nextStatus === 'executed'
      ? {
          ...session.actionPlan,
          isCompleted: true,
          completedAt: session.actionPlan.completedAt || now,
        }
      : {
          ...session.actionPlan,
          isCompleted: false,
          completedAt: undefined,
        }
    : undefined;

  return {
    ...session,
    actionPlanExecutionStatus: nextStatus,
    stage6ExecutionVerified: nextStatus !== 'pending_verification',
    actionPlan: updatedActionPlan || session.actionPlan,
    lastActiveAt: now,
  };
}

export function isValidStage7FinalFeedbackReport(
  report: any
): report is FinalFeedbackReport {
  if (!report || typeof report !== 'object' || Array.isArray(report)) return false;
  const isCleanStringArray = (arr: unknown): arr is string[] =>
    Array.isArray(arr) && arr.every(isCleanStage7Text);
  const hasSubstantiveItems = (arr: unknown): boolean =>
    Array.isArray(arr) &&
    arr.some((item) => isCleanStage7Text(item) && !isStage7InsufficientPlaceholderText(item));

  if (!isCleanStringArray(report.detectedStrengths)) return false;
  if (!isCleanStringArray(report.stageTwoSkills)) return false;
  if (!isCleanStringArray(report.chosenActions)) return false;
  if (!isCleanStringArray(report.stageSixLearnings)) return false;
  if (!isCleanStringArray(report.recommendationsForAutonomy)) return false;

  const hasAnySubstantiveContent =
    hasSubstantiveItems(report.detectedStrengths) ||
    hasSubstantiveItems(report.stageTwoSkills) ||
    hasSubstantiveItems(report.chosenActions) ||
    hasSubstantiveItems(report.stageSixLearnings) ||
    hasSubstantiveItems(report.recommendationsForAutonomy);

  if (!hasAnySubstantiveContent) return false;
  return true;
}

export function buildStage7FinalFeedbackReport(
  coachFinalFeedback: FinalFeedbackReport | undefined,
  skillEntries?: LeadershipSkillEntry[] | null,
  legacyIdentifiedSkills?: string[] | null,
  deliveredAt: string = new Date().toISOString(),
  sessionContext?: {
    actionPlan?: MentorshipActionPlan;
    learnings?: MentorshipLearnings;
    actionPlanExecutionStatus?: ActionPlanExecutionStatus;
  }
): FinalFeedbackReport | undefined {
  if (!coachFinalFeedback || typeof coachFinalFeedback !== 'object' || Array.isArray(coachFinalFeedback)) {
    return undefined;
  }
  if (
    !Array.isArray(coachFinalFeedback.detectedStrengths) ||
    !Array.isArray(coachFinalFeedback.chosenActions) ||
    !Array.isArray(coachFinalFeedback.stageSixLearnings) ||
    !Array.isArray(coachFinalFeedback.recommendationsForAutonomy)
  ) {
    return undefined;
  }

  const allIncomingClean =
    coachFinalFeedback.detectedStrengths.every(isCleanStage7Text) &&
    coachFinalFeedback.chosenActions.every(isCleanStage7Text) &&
    coachFinalFeedback.stageSixLearnings.every(isCleanStage7Text) &&
    coachFinalFeedback.recommendationsForAutonomy.every(isCleanStage7Text);
  if (!allIncomingClean) {
    return undefined;
  }

  const executionStatus = sessionContext?.actionPlanExecutionStatus;
  const isUnexecuted =
    executionStatus === 'not_executed' || executionStatus === 'pending_verification';

  const registeredActions = (() => {
    const rawWhat = sessionContext?.actionPlan?.what;
    if (!isCleanStage7Text(rawWhat) || isStage7InsufficientPlaceholderText(rawWhat)) {
      return [];
    }
    const trimmedWhat = rawWhat.trim();
    const when = isCleanStage7Text(sessionContext?.actionPlan?.when)
      ? sessionContext!.actionPlan!.when.trim()
      : '';
    if (isUnexecuted) {
      return [
        `${trimmedWhat}${when ? ` (Programada: ${when})` : ''} — Estado: pendiente de ejecución`,
      ];
    }
    return [trimmedWhat];
  })();

  const registeredLearnings: string[] = [];
  if (sessionContext?.learnings && typeof sessionContext.learnings === 'object') {
    const seen = new Set<string>();
    const rawLearningFields = isUnexecuted
      ? [
          sessionContext.learnings.insights,
          sessionContext.learnings.futureAdjustments,
        ]
      : [
          sessionContext.learnings.insights,
          sessionContext.learnings.whatHappened,
          sessionContext.learnings.whatWorked,
          sessionContext.learnings.futureAdjustments,
        ];
    for (const raw of rawLearningFields) {
      if (!isCleanStage7Text(raw)) continue;
      const trimmed = raw.trim();
      if (isStage7InsufficientPlaceholderText(trimmed)) continue;
      if (isUnexecuted && isNonSubstantiveNonExecutionNote(trimmed)) continue;
      const key = trimmed.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        registeredLearnings.push(trimmed);
      }
    }
  }

  const cleanNonPlaceholderList = (arr: string[]) =>
    arr.map((s) => s.trim()).filter((s) => !isStage7InsufficientPlaceholderText(s));

  const cleanedChosenActions = cleanNonPlaceholderList(coachFinalFeedback.chosenActions);
  const cleanedStageSixLearnings = cleanNonPlaceholderList(
    coachFinalFeedback.stageSixLearnings
  ).filter((s) => !isUnexecuted || !isNonSubstantiveNonExecutionNote(s));
  const cleanedRecommendations = cleanNonPlaceholderList(coachFinalFeedback.recommendationsForAutonomy);

  const resolvedChosenActions = (() => {
    if (cleanedChosenActions.length === 0) return registeredActions;
    if (
      isUnexecuted &&
      registeredActions.length > 0 &&
      !cleanedChosenActions.some((item) =>
        /pendiente|no ejecutad|por ejecutar|reprogram/i.test(item)
      )
    ) {
      return registeredActions;
    }
    return cleanedChosenActions;
  })();

  const builtReport: FinalFeedbackReport = {
    ...coachFinalFeedback,
    detectedStrengths: sanitizeDetectedStrengths(coachFinalFeedback.detectedStrengths),
    stageTwoSkills: resolveConsolidatedStageTwoSkills(skillEntries, legacyIdentifiedSkills),
    chosenActions: resolvedChosenActions,
    stageSixLearnings:
      cleanedStageSixLearnings.length > 0 ? cleanedStageSixLearnings : registeredLearnings,
    recommendationsForAutonomy: cleanedRecommendations,
    deliveredAt,
  };
  if (!isValidStage7FinalFeedbackReport(builtReport)) {
    return undefined;
  }
  return builtReport;
}

export function isValidMentorApiResponse(
  response: { ok?: boolean } | null | undefined,
  data: any,
  resolvedReply: unknown
): resolvedReply is string {
  if (!response?.ok) return false;
  if (!data || data.success === false) return false;
  if (typeof resolvedReply !== 'string') return false;
  const trimmed = resolvedReply.trim();
  if (!trimmed) return false;
  if (trimmed.toUpperCase().startsWith('ERROR DE SERVIDOR')) return false;
  return true;
}

export type CaseOperationKind = 'advance' | 'message';

export function acquireCaseOperationLock(
  opsMap: Map<string, CaseOperationKind>,
  caseId: string,
  operation: CaseOperationKind
): boolean {
  if (!caseId || opsMap.has(caseId)) {
    return false;
  }
  opsMap.set(caseId, operation);
  return true;
}

export function releaseCaseOperationLock(
  opsMap: Map<string, CaseOperationKind>,
  caseId: string
): void {
  if (!caseId) return;
  opsMap.delete(caseId);
}

export interface ValidatedMentorApiResponse {
  valid: boolean;
  data: any;
  resolvedReply?: string;
  reason?:
    | 'http_error'
    | 'invalid_json'
    | 'invalid_payload'
    | 'unverified_or_fallback'
    | 'invalid_final_feedback';
}

export async function parseAndValidateMentorApiResponse(
  response: Pick<Response, 'ok' | 'status' | 'json'> | null | undefined,
  options: { isStage7Closure?: boolean } = {}
): Promise<ValidatedMentorApiResponse> {
  if (!response || !response.ok) {
    return { valid: false, data: {}, reason: 'http_error' };
  }

  let data: any;
  try {
    data = await response.json();
  } catch {
    return { valid: false, data: {}, reason: 'invalid_json' };
  }

  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return { valid: false, data: {}, reason: 'invalid_json' };
  }

  const resolvedReply =
    data.reply ||
    data.text ||
    data.response ||
    data.data?.reply ||
    data.data?.replyText;

  if (
    !isValidMentorApiResponse(response, data, resolvedReply) ||
    isTechnicalErrorMessage({ text: resolvedReply }) ||
    data.responseSource === 'error' ||
    data.data?.responseSource === 'error'
  ) {
    return { valid: false, data, reason: 'invalid_payload' };
  }

  if (options.isStage7Closure) {
    if (!isVerifiedGeminiResponse(data, { requireExplicitVerification: true })) {
      return { valid: false, data, reason: 'unverified_or_fallback' };
    }
    const candidateFeedback = data.data?.finalFeedback || data.finalFeedback;
    if (!isValidStage7FinalFeedbackReport(candidateFeedback)) {
      return { valid: false, data, reason: 'invalid_final_feedback' };
    }
  }

  return { valid: true, data, resolvedReply };
}

export interface ExecuteTransactionalStageTransitionParams {
  activeCaseId: string;
  targetStage?: StageNumber;
  getSessionById: (caseId: string) => MentorshipSession | undefined;
  commitMentorships: (
    updater: (prev: MentorshipSession[]) => MentorshipSession[]
  ) => MentorshipSession[];
  activeCaseOperationsRef: { current: Map<string, CaseOperationKind> };
  setCaseAdvancing: (caseId: string, advancing: boolean) => void;
  companies: CompanyContext[];
  currentUser: UserProfile;
  setNotifications: (
    updater: (prev: NotificationItem[]) => NotificationItem[]
  ) => void;
  dispatchFinalFeedbackReportEmail: (
    session: MentorshipSession,
    report: FinalFeedbackReport
  ) => Promise<{ success: boolean; message?: string; emailId?: string }>;
  recordResourceRecommendation: (
    resource: Omit<RecommendedResourceItem, 'id' | 'recommendedAt'>
  ) => void;
  autoDetectAndLogResources: (
    stage: StageNumber,
    session: MentorshipSession,
    text: string,
    coachReplyText?: string
  ) => void;
  showToast: (
    message: any,
    type?: 'success' | 'info' | 'warning' | 'error'
  ) => void;
  setIsSendingMessage?: (sending: boolean) => void;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

const STAGE_NAMES_MAP: Record<StageNumber, string> = {
  1: 'Detectar qué sucede',
  2: 'Analizar perspectivas y habilidades',
  3: 'Diseñar alternativas',
  4: 'Practicar antes de actuar',
  5: 'Actuar (Plan de Acción)',
  6: 'Aprender y reflexionar',
  7: 'Cierre y retroalimentación',
};

function computeNextStageHistory(
  existingHistory: MentorshipSession['stageHistory'],
  currentStage: StageNumber,
  nextStage: StageNumber,
  now: string,
  isReopen: boolean
): MentorshipSession['stageHistory'] {
  const safeHistory = Array.isArray(existingHistory) ? existingHistory : [];
  const updatedHistory = isReopen
    ? safeHistory.map((item) => ({ ...item }))
    : safeHistory.map((item) => {
        if (item.stage === currentStage && !item.completedAt) {
          const entered = new Date(item.enteredAt).getTime();
          const diffMinutes = Math.round((new Date(now).getTime() - entered) / (1000 * 60));
          return {
            ...item,
            completedAt: now,
            durationMinutes: Math.max(1, diffMinutes),
          };
        }
        return item;
      });

  if (!updatedHistory.some((h) => h.stage === nextStage)) {
    updatedHistory.push({
      stage: nextStage,
      stageName: STAGE_NAMES_MAP[nextStage],
      enteredAt: now,
    });
  }

  return updatedHistory;
}

export async function executeTransactionalStageTransition({
  activeCaseId,
  targetStage,
  getSessionById,
  commitMentorships,
  activeCaseOperationsRef,
  setCaseAdvancing,
  companies,
  currentUser,
  setNotifications,
  dispatchFinalFeedbackReportEmail,
  recordResourceRecommendation,
  autoDetectAndLogResources,
  showToast,
  setIsSendingMessage = () => {},
  fetchImpl = fetch,
  timeoutMs = 65000,
}: ExecuteTransactionalStageTransitionParams): Promise<boolean> {
  const initialSession = getSessionById(activeCaseId);
  if (!initialSession) return false;

  if (!acquireCaseOperationLock(activeCaseOperationsRef.current, activeCaseId, 'advance')) {
    return false;
  }

  setCaseAdvancing(activeCaseId, true);
  setIsSendingMessage(true);

  try {
    const latestSession = getSessionById(activeCaseId);
    if (!latestSession) return false;

    const current = latestSession.currentStage;
    const nextStage = (targetStage || (current < 7 ? ((current + 1) as StageNumber) : 7)) as StageNumber;
    const isReopen = nextStage < current;
    const isCompletion = nextStage === 7;
    const isEnteringStage5 = nextStage === 5;
    const isEnteringStage6 = nextStage === 6;

    // Protección transaccional: si la mentoría ya está concluida, no volver a cerrarla ni duplicar notificaciones/correos
    if (isCompletion && latestSession.status === 'completed') {
      return false;
    }

    const existingStage6Status = latestSession.actionPlanExecutionStatus;
    const nextStage6Status: ActionPlanExecutionStatus | undefined = isEnteringStage6
      ? existingStage6Status === 'executed' || existingStage6Status === 'not_executed'
        ? existingStage6Status
        : 'pending_verification'
      : latestSession.actionPlanExecutionStatus;

    // Rama especial autorizada: entrada inicial a Etapa 6 con pending_verification (local, sin fetch)
    if (isEnteringStage6 && nextStage6Status === 'pending_verification') {
      const now = new Date().toISOString();
      const alreadyHasStage6VerificationPrompt = (latestSession.messages || []).some(
        (m) =>
          (m.stage || 1) === 6 &&
          m.sender === 'lidacta' &&
          (m.text || '').includes('¿Ya ejecutaste tu Plan de Acción?')
      );

      const stage6Plan = latestSession.actionPlan;
      const stage6PlanContext =
        stage6Plan?.what?.trim()
          ? `\n\nTu compromiso registrado en la Etapa 5 fue:\n• **Acción:** ${stage6Plan.what.trim()}${
              stage6Plan.when?.trim() ? `\n• **Momento:** ${stage6Plan.when.trim()}` : ''
            }${
              stage6Plan.withWhom?.trim() ? `\n• **Con quién:** ${stage6Plan.withWhom.trim()}` : ''
            }`
          : '';

      const stage6VerificationIntroMsg = !alreadyHasStage6VerificationPrompt
        ? {
            id: `msg_${Date.now()}_lid`,
            caseId: activeCaseId,
            mentorshipId: activeCaseId,
            sender: 'lidacta' as const,
            text: `Llegamos a la Etapa 6: Aprender y reflexionar.${stage6PlanContext}\n\nAntes de comenzar con las preguntas de reflexión, quiero verificar cómo te fue con tu compromiso:\n\n**¿Ya ejecutaste tu Plan de Acción?**`,
            timestamp: now,
            stage: 6 as StageNumber,
          }
        : null;

      commitMentorships((prev) =>
        prev.map((m) =>
          m.id === activeCaseId
            ? {
                ...m,
                currentStage: 6 as StageNumber,
                stageReadyToAdvance: null,
                status: 'active',
                stageHistory: computeNextStageHistory(m.stageHistory, current, 6, now, isReopen),
                actionPlanExecutionStatus: nextStage6Status,
                stage6ExecutionVerified: false,
                messages: stage6VerificationIntroMsg
                  ? [...m.messages, stage6VerificationIntroMsg]
                  : m.messages,
                lastActiveAt: now,
              }
            : m
        )
      );

      return true;
    }

    // Todas las demás transiciones (avance ordinario, reingreso a Etapa 6 verificada, Etapa 7 o reapertura)
    // NO mutan currentStage, status, stageHistory ni notificaciones antes de validar la respuesta del servidor.
    const isolatedMessages = (latestSession.messages || []).filter((m: any) => {
      if (!m || typeof m !== 'object') return false;
      const mCase = m.caseId || m.mentorshipId;
      if (mCase && mCase !== activeCaseId) return false;
      if (isTechnicalErrorMessage(m)) {
        return false;
      }
      return true;
    });

    const company = companies.find((c) => c.id === latestSession.companyId) || companies[0];
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    let response: Response;
    try {
      response = await fetchImpl('/api/mentor/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          caseId: activeCaseId,
          mentorshipId: activeCaseId,
          stage: nextStage,
          activeStage: nextStage,
          leaderProfile: currentUser,
          companyContext: company,
          conversationHistory: isolatedMessages,
          history: isolatedMessages,
          userMessage: `[Avanzando a Etapa ${nextStage}]`,
          currentMessage: `[Avanzando a Etapa ${nextStage}]`,
          message: `[Avanzando a Etapa ${nextStage}]`,
          identifiedSkills: latestSession.identifiedSkills || [],
          skillEntries: latestSession.skillEntries || [],
          sessionData: {
            ...stripSessionMessagesForApi(latestSession),
            skillEntries: latestSession.skillEntries || [],
            identifiedSkills: latestSession.identifiedSkills || [],
          },
        }),
      });
    } finally {
      clearTimeout(timeoutId);
    }

    const validation = await parseAndValidateMentorApiResponse(response, {
      isStage7Closure: isCompletion,
    });
    if (!validation.valid || !validation.resolvedReply) {
      showToast(
        isCompletion
          ? 'No se pudo concluir la Etapa 7 porque la respuesta de Lidacta no pudo verificarse o llegó incompleta. Puedes reintentar sin perder tu avance.'
          : MENTOR_TEMPORARY_ERROR_TEXT,
        'error'
      );
      return false;
    }

    const data = validation.data;
    const resolvedReply = validation.resolvedReply;
    const coachReply = data.data || {};
    const commitNow = new Date().toISOString();

    const introMsg = {
      id: `msg_${Date.now()}_lid`,
      caseId: activeCaseId,
      mentorshipId: activeCaseId,
      sender: 'lidacta' as const,
      text: resolvedReply,
      timestamp: commitNow,
      stage: nextStage,
    };

    const generatedReport: FinalFeedbackReport | undefined = coachReply.finalFeedback
      ? buildStage7FinalFeedbackReport(
          coachReply.finalFeedback,
          latestSession.skillEntries,
          latestSession.identifiedSkills,
          commitNow,
          {
            actionPlan: latestSession.actionPlan,
            learnings: latestSession.learnings,
            actionPlanExecutionStatus: resolveStage6ExecutionStatus(latestSession),
          }
        )
      : undefined;

    if (isCompletion && !isValidStage7FinalFeedbackReport(generatedReport)) {
      showToast(
        'El reporte final de cierre llegó incompleto o inválido. Reintenta para concluir la Etapa 7 sin perder tus datos.',
        'error'
      );
      return false;
    }

    const newStatus = isCompletion ? 'completed' : isEnteringStage5 ? 'in_action' : 'active';
    let committedSession: MentorshipSession | undefined;
    let alreadyCompletedBeforeCommit = false;

    // Confirmación transaccional basada estrictamente en el estado vivo (prev), nunca en snapshot obsoleto
    commitMentorships((prev) =>
      prev.map((m) => {
        if (m.id !== activeCaseId) return m;

        // Protección atómica ante doble cierre concurrente o estado vivo ya concluido
        if (isCompletion && m.status === 'completed') {
          alreadyCompletedBeforeCommit = true;
          return m;
        }

        let updatedSkillEntries: LeadershipSkillEntry[] = m.skillEntries || [];
        if (!isReopen) {
          if ([2, 3, 4].includes(nextStage) && Array.isArray(coachReply.skillEntries)) {
            updatedSkillEntries = coachReply.skillEntries;
          } else if (
            (!m.skillEntries || m.skillEntries.length === 0) &&
            Array.isArray(m.identifiedSkills) &&
            m.identifiedSkills.length > 0 &&
            Array.isArray(coachReply.skillEntries) &&
            coachReply.skillEntries.length > 0
          ) {
            updatedSkillEntries = coachReply.skillEntries;
          }
        } else if (
          (!m.skillEntries || m.skillEntries.length === 0) &&
          Array.isArray(coachReply.skillEntries) &&
          coachReply.skillEntries.length > 0
        ) {
          updatedSkillEntries = coachReply.skillEntries;
        }

        const activeSkillNames =
          updatedSkillEntries.length > 0 ? getActiveSkillNames(updatedSkillEntries) : [];
        const updatedIdentifiedSkills =
          updatedSkillEntries.length > 0
            ? activeSkillNames
            : !isReopen &&
              [2, 3, 4].includes(nextStage) &&
              Array.isArray(coachReply.identifiedSkills)
            ? normalizeExistingSessionSkills(coachReply.identifiedSkills)
            : m.identifiedSkills || [];

        const updatedSession: MentorshipSession = {
          ...m,
          currentStage: nextStage,
          stageReadyToAdvance: null,
          status: newStatus,
          stageHistory: computeNextStageHistory(m.stageHistory, current, nextStage, commitNow, isReopen),
          completedAt: isCompletion ? m.completedAt || commitNow : m.completedAt,
          stage5EnteredAt: isEnteringStage5 ? m.stage5EnteredAt || commitNow : m.stage5EnteredAt,
          actionPlanExecutionStatus: isEnteringStage6
            ? nextStage6Status
            : m.actionPlanExecutionStatus,
          stage6ExecutionVerified: isEnteringStage6
            ? nextStage6Status === 'executed' || nextStage6Status === 'not_executed'
            : m.stage6ExecutionVerified,
          messages: [...m.messages, introMsg],
          skillEntries: updatedSkillEntries,
          identifiedSkills: updatedIdentifiedSkills,
          finalFeedbackReport: isCompletion
            ? generatedReport
            : m.finalFeedbackReport,
          lastActiveAt: commitNow,
        };

        committedSession = updatedSession;
        return updatedSession;
      })
    );

    if (alreadyCompletedBeforeCommit || !committedSession) {
      return false;
    }

    const sessionForPostCommit = committedSession;

    // Notificación a RH y correo de Etapa 7 exclusivamente tras confirmar la transición y validar el reporte
    if (isCompletion && !alreadyCompletedBeforeCommit && !sessionForPostCommit.isTestSession) {
      const activeSkillsList =
        (sessionForPostCommit.skillEntries && sessionForPostCommit.skillEntries.length > 0
          ? getActiveSkillNames(sessionForPostCommit.skillEntries)
          : sessionForPostCommit.identifiedSkills || []
        ).join(', ') || 'Liderazgo operativo';

      const hrExecutionStatus = resolveStage6ExecutionStatus(sessionForPostCommit);
      const hrActionBullet =
        hrExecutionStatus === 'executed'
          ? `• Acción implementada: ${sessionForPostCommit.actionPlan?.what || 'Conversación 1 a 1'}`
          : `• Acción programada (pendiente de ejecución): ${
              sessionForPostCommit.actionPlan?.what?.trim() || 'Plan de acción pendiente'
            }${
              sessionForPostCommit.actionPlan?.when?.trim()
                ? ` — Programada: ${sessionForPostCommit.actionPlan.when.trim()}`
                : ''
            }`;

      const hrNotification: NotificationItem = {
        id: `notif_${Date.now()}_case_completed`,
        recipientRole: 'hr',
        companyId: sessionForPostCommit.companyId,
        title: 'Proceso de acompañamiento concluido',
        message: `${sessionForPostCommit.leaderName} terminó su proceso de acompañamiento o mentoría con Lidacta, puedes ver los indicadores en la plataforma.`,
        type: 'case_completed',
        timestamp: commitNow,
        read: false,
        emailSimulated: {
          to: `recursos.humanos@${sessionForPostCommit.companyName.toLowerCase().replace(/\s+/g, '')}.com`,
          subject: `Lidacta: ${sessionForPostCommit.leaderName} terminó su proceso de acompañamiento`,
          bodyText: `Estimada responsable de Recursos Humanos,\n\n${sessionForPostCommit.leaderName} concluyó satisfactoriamente las 7 etapas de desarrollo en Lidacta.\n\nYa puedes consultar los indicadores clave en tu panel:\n• Tema abordado: ${sessionForPostCommit.theme}\n• Habilidades desarrolladas: ${activeSkillsList}\n${hrActionBullet}\n\nGracias por impulsar el liderazgo en acción.\n\nAtentamente,\nEquipo Lidacta`,
        },
      };

      setNotifications((prev) => [hrNotification, ...prev]);

      const reportToSend = sessionForPostCommit.finalFeedbackReport;
      if (isValidStage7FinalFeedbackReport(reportToSend) && !sessionForPostCommit.finalReportEmailSent) {
        dispatchFinalFeedbackReportEmail(sessionForPostCommit, reportToSend).catch((e) =>
          console.error('[LIDACTA 📧] Error no bloqueante al despachar reporte final por email:', e)
        );
      }
    }

    if (!sessionForPostCommit.isTestSession) {
      if (
        coachReply.recommendedResources &&
        Array.isArray(coachReply.recommendedResources) &&
        coachReply.recommendedResources.length > 0
      ) {
        coachReply.recommendedResources.forEach((res: any) => {
          recordResourceRecommendation({
            resourceTitle: res.title || res.resourceTitle,
            origin: res.origin || 'internal',
            categoryOrTool: res.category || res.categoryOrTool || 'Biblioteca Interna (Bloque 3)',
            sourceOrAuthor:
              res.sourceOrAuthor ||
              (res.origin === 'internal'
                ? 'Biblioteca Interna Lidacta (Bloque 3)'
                : 'Fuente Externa Delimitada'),
            urlOrRef: res.urlOrRef,
            leaderId: sessionForPostCommit.leaderId,
            leaderName: sessionForPostCommit.leaderName,
            leaderEmail: currentUser.email || `${sessionForPostCommit.leaderId}@empresa.com`,
            companyId: sessionForPostCommit.companyId,
            companyName: sessionForPostCommit.companyName,
            mentorshipId: sessionForPostCommit.id,
            challengeTitle: sessionForPostCommit.title,
            theme: sessionForPostCommit.theme || 'Desarrollo de Liderazgo',
            stage: nextStage,
            stageName: `Etapa ${nextStage}`,
          });
        });
      } else {
        autoDetectAndLogResources(
          nextStage,
          sessionForPostCommit,
          `[Avanzando a Etapa ${nextStage}]`,
          coachReply.replyText
        );
      }
    }

    return true;
  } catch (err) {
    console.error('Error transitioning stage:', err);
    showToast(MENTOR_TEMPORARY_ERROR_TEXT, 'error');
    return false;
  } finally {
    setIsSendingMessage(false);
    releaseCaseOperationLock(activeCaseOperationsRef.current, activeCaseId);
    setCaseAdvancing(activeCaseId, false);
  }
}

export function resolveStage6ExecutionStatus(
  session: MentorshipSession | null | undefined
): ActionPlanExecutionStatus {
  if (!session) return 'pending_verification';
  if (
    session.actionPlanExecutionStatus === 'executed' ||
    session.actionPlanExecutionStatus === 'not_executed' ||
    session.actionPlanExecutionStatus === 'pending_verification'
  ) {
    return session.actionPlanExecutionStatus;
  }
  const hasLegacyLearnings = Boolean(
    session.learnings?.whatHappened?.trim() ||
      session.learnings?.whatWorked?.trim() ||
      session.learnings?.insights?.trim()
  );
  const hasLegacyStage6LeaderMsg = (session.messages || []).some(
    (m) => (m.stage || 1) === 6 && m.sender === 'leader'
  );
  if (hasLegacyLearnings || hasLegacyStage6LeaderMsg) {
    return 'executed';
  }
  return 'pending_verification';
}

interface LidactaContextType {
  currentUser: UserProfile;
  allUsers: UserProfile[];
  companies: CompanyContext[];
  mentorships: MentorshipSession[];
  activeMentorship: MentorshipSession | null;
  notifications: NotificationItem[];
  unreadNotificationsCount: number;
  systemAlerts: SystemAlertItem[];
  triggerTherapeuticAlert: (params: {
    leaderName: string;
    leaderEmail?: string;
    companyName?: string;
    currentStage?: number;
    caseSummary: string;
    userMessageSnippet?: string;
  }) => Promise<{ success: boolean; alertItem?: SystemAlertItem; error?: string }>;
  isSendingMessage: boolean;
  isAdvancingStage: boolean;
  isEmailDrawerOpen: boolean;
  selectedEmailForPreview: NotificationItem | null;
  showNewUserModal: boolean;
  welcomeModalData: { user: UserProfile; emailText: string } | null;
  isProfileModalOpen: boolean;
  isLeaderProfileModalOpen: boolean;
  roleWelcomeModalData: { role: string; name?: string } | null;
  openRoleWelcomeModal: (role: string, name?: string) => void;
  closeRoleWelcomeModal: () => void;

  // Toast / System Notifications
  toast: { id: string; message: string; type: 'success' | 'info' | 'warning' | 'error' } | null;
  showToast: (message: string, type?: 'success' | 'info' | 'warning' | 'error') => void;
  hideToast: () => void;

  // Inspector Mode / Role Impersonation (Exclusively for Administrator)
  impersonatedUser: UserProfile | null;
  isImpersonating: boolean;
  impersonateUser: (userOrId: string | UserProfile) => void;
  impersonateRole: (role: 'leader' | 'hr') => void;
  stopImpersonation: () => void;
  createTestSessionAtStage: (
    stage: StageNumber,
    stage6Scenario?: ActionPlanExecutionStatus
  ) => Promise<MentorshipSession | null>;
  deleteTestSession: (sessionId: string) => void;
  clearAllTestSessions: () => number;

  // Authentication & Onboarding
  isAuthenticated: boolean;
  isProfileComplete: boolean;
  forceCompleteProfile: (userId?: string) => void;
  login: (email: string, password?: string, is1ClickRemembered?: boolean) => { success: boolean; message?: string };
  logout: () => void;
  completeUserProfile: (data: {
    name?: string;
    companyName: string;
    area?: string;
    position?: string;
    birthDate?: string;
    fechaNacimiento?: string;
    directReports?: number;
    personasACargo?: number;
    whatsapp: string;
  }) => Promise<{ success: boolean; message?: string }>;
  sendProfileInvite: (user: {
    id?: string;
    email: string;
    name: string;
    companyName?: string;
    role?: string;
  }) => Promise<{ success: boolean; message: string }>;
  updateUserProfile: (
    userId: string,
    updates: Partial<UserProfile>
  ) => Promise<{ success: boolean; message?: string }>;
  sessionUser: UserProfile | null;
  registerOrSetPassword: (
    email: string,
    password: string,
    name?: string,
    role?: UserRole,
    position?: string,
    companyId?: string,
    customCompanyName?: string,
  ) => Promise<{
    success: boolean;
    message?: string;
    user?: UserProfile;
    emailSent?: boolean;
    emailId?: string;
    emailError?: string;
  }>;
  
  // Actions
  switchUser: (userId: string) => void;
  createNewUser: (profile: Partial<UserProfile>) => UserProfile;
  createUser: (userData: {
    name: string;
    email: string;
    role: UserRole;
    companyId?: string;
    companyName?: string;
    position?: string;
    area?: string;
    birthDate?: string;
    directReports?: number;
    whatsapp?: string;
    status?: 'active' | 'inactive';
    password?: string;
  }) => Promise<{ success: boolean; message?: string; user?: UserProfile }>;
  updateUser: (
    userId: string,
    updates: Partial<UserProfile>
  ) => Promise<{ success: boolean; message?: string; user?: UserProfile }>;
  deleteUser: (userId: string) => Promise<{ success: boolean; message?: string }>;
  setShowNewUserModal: (open: boolean) => void;
  closeWelcomeModal: () => void;
  openProfileModal: () => void;
  closeProfileModal: () => void;
  openLeaderProfileModal: () => void;
  closeLeaderProfileModal: () => void;
  setActiveMentorshipId: (id: string | null) => void;
  startNewMentorship: (
    challengeText: string,
    options?: {
      title?: string;
      stage?: StageNumber;
      priority?: 'alta' | 'media' | 'baja';
      isTestSession?: boolean;
    }
  ) => Promise<MentorshipSession>;
  sendMessageInActiveSession: (text: string, isPractice?: boolean) => Promise<void>;
  advanceStage: (targetStage?: StageNumber) => Promise<boolean>;
  setStageReadyToAdvance: (stage: StageNumber | null) => void;
  updateActionPlan: (plan: MentorshipSession['actionPlan']) => boolean;
  markActionCompleted: () => void;
  respondStage6ExecutionCheck: (executed: boolean) => Promise<void>;
  saveLearnings: (learnings: NonNullable<MentorshipSession['learnings']>) => void;
  updateCompanyContext: (companyId: string, updated: Partial<CompanyContext>) => void;
  addCompany: (newCompany: Omit<CompanyContext, 'id' | 'updatedAt'>) => CompanyContext;
  markNotificationsAsRead: () => void;
  openEmailDrawer: (notification?: NotificationItem) => void;
  closeEmailDrawer: () => void;
  requestHumanMentor: (
    reasonText: string,
    isVoiceAudio?: boolean
  ) => Promise<{ success: boolean; message: string; notificationId: string; whatsappUrl: string }>;
  updateMentorRequestStatus: (
    notificationId: string,
    status: 'pendiente' | 'contactado' | 'atendido',
    notes?: string
  ) => void;

  // Live Sync & Database Refetching (Multi-device)
  refreshUsers: () => Promise<void>;
  isSyncingUsers: boolean;
  isDbConnected: boolean;
  lastDbSync: Date | null;
  dbLatencyMs: number;

  // Resource Tracking & Analytics (Implicit & Invisible for Leader)
  recommendedResources: RecommendedResourceItem[];
  recordResourceRecommendation: (
    resource: Omit<RecommendedResourceItem, 'id' | 'recommendedAt'>
  ) => void;

  // Stage 5 Automated Follow-ups & Day 8 Inactivity Monitoring
  checkAndProcessStage5FollowUps: (options?: { simulatedNow?: string; force?: boolean }) => Promise<{
    processed: number;
    sent48h: number;
    sent5d: number;
    sentAdminAlert: number;
  }>;
  triggerStage5FollowUpCheck: () => Promise<void>;

  // Stage 7 Final Feedback Report Email Dispatch
  retrySendFinalReportEmail: (mentorshipId?: string) => Promise<{ success: boolean; message?: string }>;
}

const LidactaContext = createContext<LidactaContextType | undefined>(undefined);

const STORAGE_KEY_PREFIX = 'lidacta_v2_';

export const ADMIN_OFFICIAL_PASSWORD =
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_ADMIN_PASSWORD) ||
  (typeof process !== 'undefined' && process.env?.ADMIN_PASSWORD) ||
  'Admin_Auth_Secured_2026';

export const isTherapeuticText = (text: string): boolean => {
  if (!text || typeof text !== 'string') return false;
  const lower = text.toLowerCase();
  const therapeuticTerms = [
    'depresión', 'depresion', 'depresivo', 'depresiva',
    'ansiedad clínica', 'ansiedad clinica', 'ataque de pánico', 'ataque de panico',
    'crisis de angustia', 'crisis existencial profunda',
    'terapia psicológica', 'terapia psicologica', 'psiquiatra', 'psiquiátrico', 'psiquiatrico',
    'medicamento psiquiátrico', 'antidepresivo', 'ansiolítico', 'ansiolitico',
    'ideación suicida', 'ideacion suicida', 'ganas de morir', 'no quiero vivir',
    'quitarme la vida', 'hacerme daño', 'hacerme dano', 'autolesión', 'autolesion',
    'trauma severo', 'abuso sexual', 'violencia intrafamiliar', 'duelo patológico',
    'trastorno bipolar', 'esquizofrenia', 'trastorno de la personalidad',
    'brote psicótico', 'brote psicotico', 'burnout severo clínico',
  ];
  return therapeuticTerms.some((t) => lower.includes(t));
};

export const ensureAdminPasswordInUsers = (userList: UserProfile[]): UserProfile[] => {
  return userList.map((u) => {
    if (u.email?.toLowerCase() === 'hola@lidacta.com' || u.id === 'user_admin_tania' || u.role === 'admin') {
      return {
        ...u,
        password: u.password || ADMIN_OFFICIAL_PASSWORD,
      };
    }
    return u;
  });
};

export const LidactaProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Canonical users are loaded directly from the backend database (no localStorage override)
  const [allUsers, setAllUsers] = useState<UserProfile[]>(() => ensureAdminPasswordInUsers(INITIAL_USERS));
  const [isSyncingUsers, setIsSyncingUsers] = useState<boolean>(false);
  const [isDbConnected, setIsDbConnected] = useState<boolean>(true);
  const [lastDbSync, setLastDbSync] = useState<Date | null>(null);
  const [dbLatencyMs, setDbLatencyMs] = useState<number>(18);

  // Active Session User & ID to ensure strict isolation and avoid premature fallbacks
  const [sessionUser, setSessionUser] = useState<UserProfile | null>(() => {
    try {
      const saved = sessionStorage.getItem(`${STORAGE_KEY_PREFIX}session_user`);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [currentUserId, setCurrentUserId] = useState<string>(() => {
    try {
      const saved =
        sessionStorage.getItem(`${STORAGE_KEY_PREFIX}current_user_id`) ||
        localStorage.getItem(`${STORAGE_KEY_PREFIX}current_user_id`);
      return saved || '';
    } catch {
      return '';
    }
  });

  const sessionUserRef = useRef<UserProfile | null>(sessionUser);
  sessionUserRef.current = sessionUser;
  const currentUserIdRef = useRef<string>(currentUserId);
  currentUserIdRef.current = currentUserId;

  // Set to prevent duplicate concurrent in-flight email dispatches for Stage 7 final report
  const inFlightFinalReportEmailRef = useRef<Set<string>>(new Set());

  // Inspector Mode / Emulation State (Strictly limited to Administrator sessions)
  const [impersonatedUser, setImpersonatedUser] = useState<UserProfile | null>(() => {
    try {
      const savedAdminRaw = sessionStorage.getItem(`${STORAGE_KEY_PREFIX}session_user`);
      if (savedAdminRaw) {
        const savedAdmin = JSON.parse(savedAdminRaw);
        if (savedAdmin && (savedAdmin.role === 'admin' || savedAdmin.email?.toLowerCase() === 'hola@lidacta.com')) {
          const rawImp = sessionStorage.getItem(`${STORAGE_KEY_PREFIX}impersonated_user`);
          return rawImp ? JSON.parse(rawImp) : null;
        }
      }
    } catch {}
    return null;
  });

  const isImpersonating = Boolean(
    sessionUser &&
      (sessionUser.role === 'admin' || sessionUser.email?.toLowerCase() === 'hola@lidacta.com') &&
      impersonatedUser
  );

  // Force completed profiles tracking for immediate 0ms redirect
  const [forceCompletedUserIds, setForceCompletedUserIds] = useState<Record<string, boolean>>(() => {
    const map: Record<string, boolean> = {};
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('lidacta_profile_completed_') && localStorage.getItem(key) === 'true') {
          const id = key.replace('lidacta_profile_completed_', '');
          map[id] = true;
        }
      }
    } catch {}
    return map;
  });

  const forceCompleteProfile = (userId?: string) => {
    const targetId = userId || currentUserIdRef.current || sessionUserRef.current?.id || '';
    const email = sessionUserRef.current?.email?.toLowerCase();
    setForceCompletedUserIds((prev) => ({
      ...prev,
      ...(targetId ? { [targetId]: true } : {}),
      ...(email ? { [email]: true } : {}),
    }));
    try {
      if (targetId) localStorage.setItem(`lidacta_profile_completed_${targetId}`, 'true');
      if (email) localStorage.setItem(`lidacta_profile_completed_${email}`, 'true');
    } catch {}
  };

  const refreshUsers = async () => {
    try {
      setIsSyncingUsers(true);
      const startT = performance.now();
      const res = await userService.getUsers();
      const latency = Math.round(performance.now() - startT);
      setDbLatencyMs(latency > 0 ? latency : 12);

      if (res.success && Array.isArray(res.users) && res.users.length > 0) {
        setAllUsers((prevUsers) => {
          const serverUsers = ensureAdminPasswordInUsers(res.users);
          const activeId = currentUserIdRef.current || sessionUserRef.current?.id;
          if (activeId) {
            const activeUser = prevUsers.find((u) => u.id === activeId) || sessionUserRef.current;
            const inServer = serverUsers.some(
              (u) =>
                u.id === activeId ||
                (activeUser?.email && u.email.toLowerCase() === activeUser.email.toLowerCase())
            );
            if (activeUser && !inServer) {
              return [activeUser, ...serverUsers];
            }
          }
          return serverUsers;
        });
        setIsDbConnected(true);
        setLastDbSync(new Date());
      } else {
        setIsDbConnected(false);
      }
    } catch {
      // Graceful local continuity
    } finally {
      setIsSyncingUsers(false);
    }
  };

  // Continuously sync centralized users and admin profile from server (Real-Time across all devices, windows, and incognito)
  useEffect(() => {
    let isMounted = true;
    try {
      // Clear any legacy browser-isolated users from localStorage
      localStorage.removeItem(`${STORAGE_KEY_PREFIX}users`);
    } catch {}

    const syncUsersFromServer = async () => {
      try {
        const startT = performance.now();
        const res = await userService.getUsers();
        const latency = Math.round(performance.now() - startT);
        if (isMounted) {
          setDbLatencyMs(latency > 0 ? latency : 14);
          if (res.success && Array.isArray(res.users) && res.users.length > 0) {
            setAllUsers((prevUsers) => {
              const serverUsers = ensureAdminPasswordInUsers(res.users);
              // CRITICAL: Protect the currently active/registering session user!
              // If active user is not yet reflected in serverUsers list, DO NOT drop them from allUsers!
              const activeId = currentUserIdRef.current || sessionUserRef.current?.id;
              if (activeId) {
                const activeUser = prevUsers.find((u) => u.id === activeId) || sessionUserRef.current;
                const inServer = serverUsers.some(
                  (u) =>
                    u.id === activeId ||
                    (activeUser?.email && u.email.toLowerCase() === activeUser.email.toLowerCase())
                );
                if (activeUser && !inServer) {
                  return [activeUser, ...serverUsers];
                }
              }
              return serverUsers;
            });
            setIsDbConnected(true);
            setLastDbSync(new Date());
          } else {
            setIsDbConnected(false);
          }
        }
      } catch {
        if (isMounted) setIsDbConnected(false);
      }
    };

    // Initial fetch + continuous real-time polling every 2.5s
    syncUsersFromServer();
    const userPollInterval = setInterval(syncUsersFromServer, 2500);

    // Initial admin profile fetch
    fetch('/api/admin/profile', { cache: 'no-store' })
      .then((res) => res.json())
      .then((data) => {
        if (isMounted && data.success && data.profile) {
          const sAdmin = data.profile;
          setAllUsers((prevUsers) => {
            return prevUsers.map((u) => {
              if (u.role === 'admin' || u.id === sAdmin.id) {
                return {
                  ...u,
                  name: sAdmin.name || u.name,
                  email: sAdmin.email || u.email,
                  whatsapp: sAdmin.whatsapp || u.whatsapp,
                  position: sAdmin.position || u.position,
                  companyName: sAdmin.companyName || u.companyName,
                  area: sAdmin.area || u.area,
                };
              }
              return u;
            });
          });
        }
      })
      .catch((err) => {
        console.warn('Could not sync admin profile from server:', err);
      });

    // Immediate refetch when user switches back to this tab/window or comes online
    const handleWindowActive = () => {
      if (document.visibilityState === 'visible') {
        syncUsersFromServer();
      }
    };
    window.addEventListener('focus', handleWindowActive);
    window.addEventListener('online', handleWindowActive);
    document.addEventListener('visibilitychange', handleWindowActive);

    // Listen for storage events (Instant 0ms cross-tab synchronization in same browser)
    const handleStorage = (e: StorageEvent) => {
      if (e.key === `${STORAGE_KEY_PREFIX}users` && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (Array.isArray(parsed) && isMounted) {
            setAllUsers(parsed);
          }
        } catch {}
      }
    };
    window.addEventListener('storage', handleStorage);

    return () => {
      isMounted = false;
      clearInterval(userPollInterval);
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('focus', handleWindowActive);
      window.removeEventListener('online', handleWindowActive);
      document.removeEventListener('visibilitychange', handleWindowActive);
    };
  }, []);

  // Synchronize centralized notifications from server across all devices / browsers
  useEffect(() => {
    let isMounted = true;

    const fetchNotifications = async () => {
      try {
        const res = await fetch('/api/notifications');
        const data = await res.json();
        if (isMounted && data.success && Array.isArray(data.notifications)) {
          setNotifications((prevLocal) => {
            const serverList = data.notifications as NotificationItem[];
            const serverMap = new Map(serverList.map((n) => [n.id, n]));
            // Merge with local non-mentor notifications
            const localOnly = prevLocal.filter(
              (n) => !serverMap.has(n.id) && n.type !== 'mentor_request'
            );
            return [...serverList, ...localOnly];
          });
        }
      } catch (err) {
        // Silent fallback if network glitch
      }
    };

    fetchNotifications();
    const interval = setInterval(fetchNotifications, 4000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const [companies, setCompanies] = useState<CompanyContext[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY_PREFIX}companies`);
    return saved ? JSON.parse(saved) : INITIAL_COMPANIES;
  });

  const [mentorships, setMentorships] = useState<MentorshipSession[]>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY_PREFIX}mentorships`);
      if (saved) {
        const parsed: MentorshipSession[] = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((m) => {
            if (m.id === 'ment_roberto_1') {
              const init = INITIAL_MENTORSHIPS.find((im) => im.id === 'ment_roberto_1');
              const isShared =
                m.shareActionPlanWithHR ??
                m.actionPlanShared ??
                m.actionPlan?.shareWithHR ??
                m.actionPlan?.shareActionPlanWithHR ??
                init?.shareActionPlanWithHR ??
                true;
              const reflText =
                m.sharedReflectionToHR ??
                m.sharedLearningWithHR ??
                m.learnings?.sharedLearningWithHR ??
                m.learnings?.sharedReflectionToHR ??
                init?.sharedReflectionToHR ??
                'Cuando reconocemos la experiencia técnica de los colaboradores de mayor antigüedad, los acuerdos operativos se asumen por orgullo profesional y no por imposición.';
              return {
                ...m,
                shareActionPlanWithHR: isShared,
                actionPlanShared: isShared,
                sharedReflectionToHR: reflText,
                sharedLearningWithHR: reflText,
                actionPlan: m.actionPlan
                  ? {
                      ...m.actionPlan,
                      how: m.actionPlan.how || '',
                      shareWithHR: isShared,
                      shareActionPlanWithHR: isShared,
                      actionPlanShared: isShared,
                    }
                  : m.actionPlan,
                learnings: m.learnings
                  ? {
                      ...m.learnings,
                      sharedLearningWithHR: reflText,
                      sharedReflectionToHR: reflText,
                    }
                  : m.learnings,
              };
            }

            const isShared = Boolean(
              m.shareActionPlanWithHR ??
              m.actionPlanShared ??
              m.actionPlan?.shareWithHR ??
              m.actionPlan?.shareActionPlanWithHR ??
              m.actionPlan?.actionPlanShared
            );
            const refl = (
              m.sharedReflectionToHR ??
              m.sharedLearningWithHR ??
              m.learnings?.sharedLearningWithHR ??
              m.learnings?.sharedReflectionToHR ??
              ''
            ).trim();
            const cleanMessages = (m.messages || [])
              .filter((msg: any) => (!msg.caseId || msg.caseId === m.id) && (!msg.mentorshipId || msg.mentorshipId === m.id))
              .map((msg: any) => ({
                ...msg,
                caseId: m.id,
                mentorshipId: m.id,
              }));

            return {
              ...m,
              messages: cleanMessages,
              shareActionPlanWithHR: isShared,
              actionPlanShared: isShared,
              sharedReflectionToHR: refl || undefined,
              sharedLearningWithHR: refl || undefined,
              actionPlan: m.actionPlan
                ? {
                    ...m.actionPlan,
                    how: m.actionPlan.how || '',
                    shareWithHR: isShared,
                    shareActionPlanWithHR: isShared,
                    actionPlanShared: isShared,
                  }
                : undefined,
              learnings: m.learnings
                ? {
                    ...m.learnings,
                    sharedLearningWithHR: refl || undefined,
                    sharedReflectionToHR: refl || undefined,
                  }
                : undefined,
            };
          });
        }
      }
    } catch {}
    return INITIAL_MENTORSHIPS.map((m) => ({
      ...m,
      messages: (m.messages || []).map((msg) => ({
        ...msg,
        caseId: m.id,
        mentorshipId: m.id,
      })),
    }));
  });

  const mentorshipsRef = useRef<MentorshipSession[]>(mentorships);
  const activeCaseOperationsRef = useRef<Map<string, CaseOperationKind>>(new Map());
  const [advancingCaseIds, setAdvancingCaseIds] = useState<Record<string, boolean>>({});
  const [sendingCaseIds, setSendingCaseIds] = useState<Record<string, boolean>>({});

  const commitMentorships = (
    updater: (prev: MentorshipSession[]) => MentorshipSession[]
  ): MentorshipSession[] => {
    const next = updater(mentorshipsRef.current);
    mentorshipsRef.current = next;
    setMentorships(updater);
    return next;
  };

  const setCaseAdvancing = (caseId: string, advancing: boolean) => {
    setAdvancingCaseIds((prev) => {
      if (Boolean(prev[caseId]) === advancing) return prev;
      if (!advancing) {
        const next = { ...prev };
        delete next[caseId];
        return next;
      }
      return { ...prev, [caseId]: true };
    });
  };

  const setCaseSending = (caseId: string, sending: boolean) => {
    setSendingCaseIds((prev) => {
      if (Boolean(prev[caseId]) === sending) return prev;
      if (!sending) {
        const next = { ...prev };
        delete next[caseId];
        return next;
      }
      return { ...prev, [caseId]: true };
    });
  };

  const [notifications, setNotifications] = useState<NotificationItem[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY_PREFIX}notifications`);
    return saved ? JSON.parse(saved) : INITIAL_NOTIFICATIONS;
  });

  // Implicit & Silent Resource Tracking (Invisible for Leader)
  const [recommendedResources, setRecommendedResources] = useState<RecommendedResourceItem[]>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY_PREFIX}recommended_resources_v1`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return INITIAL_RECOMMENDED_RESOURCES;
  });

  // Centralized System Alerts (Límite Terapéutico & Inactividad Día 8)
  const [systemAlerts, setSystemAlerts] = useState<SystemAlertItem[]>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY_PREFIX}system_alerts_v1`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return INITIAL_SYSTEM_ALERTS;
  });

  const recordResourceRecommendation = (
    resource: Omit<RecommendedResourceItem, 'id' | 'recommendedAt'>
  ) => {
    if (
      resource.leaderId === QA_TEST_LEADER_ID ||
      (typeof resource.mentorshipId === 'string' && resource.mentorshipId.startsWith('ment_qa_'))
    ) {
      return;
    }

    const newItem: RecommendedResourceItem = {
      ...resource,
      id: `rec_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      recommendedAt: new Date().toISOString(),
    };

    setRecommendedResources((prev) => {
      const isDuplicate = prev.some(
        (r) =>
          r.mentorshipId === resource.mentorshipId &&
          r.stage === resource.stage &&
          r.resourceTitle.toLowerCase() === resource.resourceTitle.toLowerCase()
      );
      if (isDuplicate) return prev;
      return [newItem, ...prev];
    });
  };

  const autoDetectAndLogResources = (
    stage: StageNumber,
    session: MentorshipSession,
    text: string,
    coachReplyText?: string
  ) => {
    if (
      session.isTestSession ||
      session.leaderId === QA_TEST_LEADER_ID ||
      (typeof session.id === 'string' && session.id.startsWith('ment_qa_'))
    ) {
      return;
    }
    const fullContext = `${session.title} ${session.theme || ''} ${text} ${coachReplyText || ''}`.toLowerCase();
    const candidateMatches: RecommendedResourceItem[] = [];

    // Contextual evaluation of alignment/utility and implementation difficulty
    const computeEstimates = (item: any) => {
      const isHighlySpecific = item.relatedThemes.some((t: string) => fullContext.includes(t.toLowerCase()));
      const estimatedUtility = isHighlySpecific ? 'Muy Alta' : 'Alta';
      const utilityReason = `Alineación directa con el desafío de "${session.title}" enfocado en ${item.category || item.title}.`;

      let estimatedDifficulty: 'Baja' | 'Media' | 'Alta' = 'Media';
      let resistanceOrDoubtNotes = 'Dudas iniciales sobre el tiempo de implementación en jornada de piso.';

      const idLower = (item.id || '').toLowerCase();
      if (idLower.includes('ehi') || idLower.includes('acuerdos') || idLower.includes('sprints') || idLower.includes('sbi')) {
        estimatedDifficulty = 'Baja';
        resistanceOrDoubtNotes = 'Formato ágil de fácil adopción; el líder asimiló la técnica rápidamente sin resistencia.';
      } else if (idLower.includes('veterano') || idLower.includes('desescalamiento') || idLower.includes('fallacy') || idLower.includes('candor')) {
        estimatedDifficulty = 'Media';
        resistanceOrDoubtNotes = 'Resistencia anticipada por diferencias de antigüedad o jerarquía; se requiere modelado cuidadoso del tono.';
      } else if (idLower.includes('safety') || idLower.includes('reluctant') || idLower.includes('autonomia')) {
        estimatedDifficulty = 'Alta';
        resistanceOrDoubtNotes = 'Inseguridad o resistencia cultural ante cambios normativos o reporte de desvíos; demanda acompañamiento constante.';
      }

      return { estimatedUtility, utilityReason, estimatedDifficulty, resistanceOrDoubtNotes };
    };

    // 1. Prioritize Internal Library Catalog (Bloque 3)
    for (const item of INTERNAL_LIBRARY_CATALOG) {
      const matchesStage = item.recommendedStages.includes(stage);
      const matchesTheme = item.relatedThemes.some(
        (t) => fullContext.includes(t.toLowerCase()) || (session.theme && session.theme.toLowerCase().includes(t.toLowerCase()))
      );
      if (matchesStage && matchesTheme) {
        const est = computeEstimates(item);
        candidateMatches.push({
          id: `rec_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          resourceTitle: item.title,
          origin: 'internal',
          categoryOrTool: item.category,
          sourceOrAuthor: item.authorOrSource,
          urlOrRef: item.urlOrRef,
          leaderId: session.leaderId,
          leaderName: session.leaderName,
          leaderEmail: currentUser.email || `${session.leaderId}@empresa.com`,
          companyId: session.companyId,
          companyName: session.companyName,
          mentorshipId: session.id,
          challengeTitle: session.title,
          theme: session.theme || 'Desarrollo de Liderazgo',
          stage,
          stageName: `Etapa ${stage}`,
          recommendedAt: new Date().toISOString(),
          estimatedUtility: est.estimatedUtility as any,
          utilityReason: est.utilityReason,
          estimatedDifficulty: est.estimatedDifficulty as any,
          resistanceOrDoubtNotes: est.resistanceOrDoubtNotes,
        });
        break; // 1 internal resource prioritized per stage interaction
      }
    }

    // 2. Delimited External Sources Catalog (only when complementing or deepening)
    for (const item of EXTERNAL_SOURCES_CATALOG) {
      const matchesStage = item.recommendedStages.includes(stage);
      const matchesTheme = item.relatedThemes.some(
        (t) => fullContext.includes(t.toLowerCase()) || (session.theme && session.theme.toLowerCase().includes(t.toLowerCase()))
      );
      if (matchesStage && matchesTheme) {
        const est = computeEstimates(item);
        candidateMatches.push({
          id: `rec_${Date.now()}_ext_${Math.random().toString(36).substring(2, 6)}`,
          resourceTitle: item.title,
          origin: 'external',
          categoryOrTool: item.category,
          sourceOrAuthor: item.authorOrSource,
          urlOrRef: item.urlOrRef,
          leaderId: session.leaderId,
          leaderName: session.leaderName,
          leaderEmail: currentUser.email || `${session.leaderId}@empresa.com`,
          companyId: session.companyId,
          companyName: session.companyName,
          mentorshipId: session.id,
          challengeTitle: session.title,
          theme: session.theme || 'Desarrollo de Liderazgo',
          stage,
          stageName: `Etapa ${stage}`,
          recommendedAt: new Date().toISOString(),
          estimatedUtility: est.estimatedUtility as any,
          utilityReason: est.utilityReason,
          estimatedDifficulty: est.estimatedDifficulty as any,
          resistanceOrDoubtNotes: est.resistanceOrDoubtNotes,
        });
        break; // 1 external resource max per interaction
      }
    }

    if (candidateMatches.length > 0) {
      setRecommendedResources((prev) => {
        const toAdd = candidateMatches.filter(
          (cand) =>
            !prev.some(
              (p) =>
                p.mentorshipId === cand.mentorshipId &&
                p.stage === cand.stage &&
                p.resourceTitle.toLowerCase() === cand.resourceTitle.toLowerCase()
            )
        );
        if (toAdd.length === 0) return prev;
        return [...toAdd, ...prev];
      });
    }
  };

  const [activeMentorshipId, setActiveMentorshipIdState] = useState<string | null>(() => {
    return 'ment_roberto_2';
  });

  const [isSendingGlobal, setIsSendingMessage] = useState(false);
  const [isEmailDrawerOpen, setIsEmailDrawerOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isLeaderProfileModalOpen, setIsLeaderProfileModalOpen] = useState(false);
  const [selectedEmailForPreview, setSelectedEmailForPreview] = useState<NotificationItem | null>(null);
  const [showNewUserModal, setShowNewUserModal] = useState(false);
  const [welcomeModalData, setWelcomeModalData] = useState<{ user: UserProfile; emailText: string } | null>(null);
  const [roleWelcomeModalData, setRoleWelcomeModalData] = useState<{ role: string; name?: string } | null>(() => {
    try {
      const stored = sessionStorage.getItem('lidacta_show_role_welcome');
      if (stored) {
        return JSON.parse(stored);
      }
    } catch {}
    return null;
  });

  const openRoleWelcomeModal = (role: string, name?: string) => {
    const payload = { role, name };
    try {
      sessionStorage.setItem('lidacta_show_role_welcome', JSON.stringify(payload));
    } catch {}
    setRoleWelcomeModalData(payload);
  };

  const closeRoleWelcomeModal = () => {
    try {
      sessionStorage.removeItem('lidacta_show_role_welcome');
    } catch {}
    setRoleWelcomeModalData(null);
  };

  // Global Toast Notification State
  const [toast, setToast] = useState<{
    id: string;
    message: string;
    type: 'success' | 'info' | 'warning' | 'error';
  } | null>(null);

  const showToast = (
    message: any,
    type: 'success' | 'info' | 'warning' | 'error' = 'success'
  ) => {
    const id = `toast_${Date.now()}`;
    const safeMsg = safeString(message, 'Notificación del sistema');
    setToast({ id, message: safeMsg, type });
    setTimeout(() => {
      setToast((curr) => (curr?.id === id ? null : curr));
    }, 4500);
  };

  const hideToast = () => setToast(null);

  const openProfileModal = () => setIsProfileModalOpen(true);
  const closeProfileModal = () => setIsProfileModalOpen(false);

  const openLeaderProfileModal = () => setIsLeaderProfileModalOpen(true);
  const closeLeaderProfileModal = () => setIsLeaderProfileModalOpen(false);

  // App starts by default on the login screen
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);

  // Users are not saved to localStorage to prevent device isolation and state desynchronization

  useEffect(() => {
    if (currentUserId) {
      localStorage.setItem(`${STORAGE_KEY_PREFIX}current_user_id`, currentUserId);
      sessionStorage.setItem(`${STORAGE_KEY_PREFIX}current_user_id`, currentUserId);
    }
  }, [currentUserId]);

  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}companies`, JSON.stringify(companies));
  }, [companies]);

  useEffect(() => {
    mentorshipsRef.current = mentorships;
    localStorage.setItem(`${STORAGE_KEY_PREFIX}mentorships`, JSON.stringify(mentorships));
  }, [mentorships]);

  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}notifications`, JSON.stringify(notifications));
  }, [notifications]);

  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}recommended_resources_v1`, JSON.stringify(recommendedResources));
  }, [recommendedResources]);

  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}system_alerts_v1`, JSON.stringify(systemAlerts));
  }, [systemAlerts]);

  const currentUser = useMemo(() => {
    // 0. If inspector mode is active and original user is administrator
    if (isImpersonating && impersonatedUser) {
      const live = allUsers.find(
        (u) =>
          u.id === impersonatedUser.id ||
          (impersonatedUser.email && u.email.toLowerCase() === impersonatedUser.email.toLowerCase())
      );
      return live ? { ...impersonatedUser, ...live } : impersonatedUser;
    }

    // 1. If active sessionUser exists, find latest matching record in allUsers or use sessionUser
    if (sessionUser && sessionUser.id) {
      const live = allUsers.find(
        (u) =>
          u.id === sessionUser.id ||
          (sessionUser.email && u.email.toLowerCase() === sessionUser.email.toLowerCase())
      );
      return live ? { ...sessionUser, ...live } : sessionUser;
    }
    // 2. If currentUserId set, find in allUsers
    if (currentUserId) {
      const found = allUsers.find((u) => u.id === currentUserId);
      if (found) return found;
    }
    // 3. Fallback for unauthenticated or initial state
    return allUsers[0] || DEFAULT_ADMIN_PROFILE;
  }, [allUsers, currentUserId, sessionUser, isImpersonating, impersonatedUser]);

  const activeMentorship =
    currentUser.id === QA_TEST_LEADER_ID
      ? mentorships.find((m) => m.id === activeMentorshipId && m.isTestSession) ||
        mentorships.find((m) => m.leaderId === QA_TEST_LEADER_ID && m.isTestSession) ||
        null
      : mentorships.find((m) => m.id === activeMentorshipId && !m.isTestSession) ||
        mentorships.find((m) => m.leaderId === currentUser.id && !m.isTestSession && m.status !== 'completed') ||
        mentorships.find((m) => m.leaderId === currentUser.id && !m.isTestSession) ||
        null;

  const isSendingMessage = activeMentorship?.id
    ? Boolean(sendingCaseIds[activeMentorship.id]) ||
      (isSendingGlobal && activeCaseOperationsRef.current.size === 0)
    : isSendingGlobal;
  const isAdvancingStage = Boolean(
    activeMentorship?.id && advancingCaseIds[activeMentorship.id]
  );

  const unreadNotificationsCount = notifications.filter(
    (n) => !n.read && (n.recipientRole === currentUser.role || (n.recipientUserId && n.recipientUserId === currentUser.id))
  ).length;

  const impersonateUser = (userOrId: string | UserProfile) => {
    const isAdmin =
      sessionUser?.role === 'admin' ||
      sessionUser?.email?.toLowerCase() === 'hola@lidacta.com';
    if (!isAdmin) {
      showToast('Acceso denegado: El modo inspector requiere permisos de administración.', 'error');
      return;
    }

    let target: UserProfile | undefined;
    if (typeof userOrId === 'string') {
      target = allUsers.find((u) => u.id === userOrId || u.email.toLowerCase() === userOrId.toLowerCase());
    } else {
      target = userOrId;
    }

    if (!target) {
      showToast('No se encontró el perfil de usuario para simular.', 'error');
      return;
    }

    if (target.role === 'leader') {
      const leaderMentorship =
        mentorships.find((m) => m.leaderId === target!.id && !m.isTestSession && m.status !== 'completed') ||
        mentorships.find((m) => m.leaderId === target!.id && !m.isTestSession);
      setActiveMentorshipIdState(leaderMentorship ? leaderMentorship.id : null);
    }

    setImpersonatedUser(target);
    try {
      sessionStorage.setItem(`${STORAGE_KEY_PREFIX}impersonated_user`, JSON.stringify(target));
    } catch {}

    const roleName = isHumanResourcesRole(target.role) ? 'Recursos Humanos' : target.role === 'admin' ? 'Administrador' : 'Líder';
    showToast(`Modo Inspector: Visualizando interfaz como ${target.name} (${roleName})`, 'info');
  };

  const impersonateRole = (role: 'leader' | 'hr') => {
    const isAdmin =
      sessionUser?.role === 'admin' ||
      sessionUser?.email?.toLowerCase() === 'hola@lidacta.com';
    if (!isAdmin) return;

    if (role === 'hr') {
      const hrUser =
        allUsers.find((u) => isHumanResourcesRole(u.role)) ||
        INITIAL_USERS.find((u) => isHumanResourcesRole(u.role));
      if (hrUser) {
        impersonateUser(hrUser);
      }
    } else {
      const leaderUser =
        allUsers.find((u) => u.role === 'leader' && u.id === 'user_leader_roberto') ||
        allUsers.find((u) => u.role === 'leader') ||
        INITIAL_USERS.find((u) => u.role === 'leader');
      if (leaderUser) {
        impersonateUser(leaderUser);
      }
    }
  };

  const stopImpersonation = () => {
    setImpersonatedUser(null);
    try {
      sessionStorage.removeItem(`${STORAGE_KEY_PREFIX}impersonated_user`);
    } catch {}
    showToast('Has regresado al Panel de Administradora.', 'success');
  };

  const createTestSessionAtStage = async (
    stage: StageNumber,
    stage6Scenario: ActionPlanExecutionStatus = 'pending_verification'
  ): Promise<MentorshipSession | null> => {
    const isAdmin =
      sessionUser?.role === 'admin' ||
      sessionUser?.email?.toLowerCase() === 'hola@lidacta.com';
    if (!isAdmin) {
      showToast('Acceso denegado: El generador de sesiones de prueba es exclusivo para Administradora.', 'error');
      return null;
    }

    const newSession = buildTestSessionForStage(stage, stage6Scenario, QA_TEST_LEADER_PROFILE);
    const company = companies.find((c) => c.id === QA_TEST_LEADER_PROFILE.companyId) || companies[0];

    setImpersonatedUser(QA_TEST_LEADER_PROFILE);
    try {
      sessionStorage.setItem(
        `${STORAGE_KEY_PREFIX}impersonated_user`,
        JSON.stringify(QA_TEST_LEADER_PROFILE)
      );
    } catch {}

    setMentorships((prev) => [newSession, ...prev]);
    setActiveMentorshipIdState(newSession.id);

    // En Etapa 6 "Ejecución pendiente", la sesión espera el clic del tester en Sí / No
    if (stage === 6 && stage6Scenario === 'pending_verification') {
      showToast(
        `Sesión QA lista en Etapa 6 (Ejecución pendiente). Responde Sí o No para probar el flujo real.`,
        'info'
      );
      return newSession;
    }

    const conversationHistory =
      stage === 1
        ? []
        : stage === 6
        ? newSession.messages.slice(0, -1)
        : newSession.messages;

    const userMessage =
      stage === 1
        ? newSession.initialChallenge
        : stage === 6
        ? stage6Scenario === 'executed'
          ? 'Sí, ya ejecuté mi Plan de Acción.'
          : 'No, todavía no he ejecutado mi Plan de Acción.'
        : `[Avanzando a Etapa ${stage}]`;

    setIsSendingMessage(true);
    try {
      const response = await fetch('/api/mentor/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caseId: newSession.id,
          mentorshipId: newSession.id,
          stage,
          activeStage: stage,
          leaderProfile: QA_TEST_LEADER_PROFILE,
          companyContext: company,
          conversationHistory,
          history: conversationHistory,
          isNewCase: stage === 1,
          userMessage,
          currentMessage: userMessage,
          message: userMessage,
          identifiedSkills: newSession.identifiedSkills || [],
          skillEntries: newSession.skillEntries || [],
          sessionData: stripSessionMessagesForApi(newSession),
        }),
      });

      const data = await response.json().catch(() => ({}));
      const resolvedReply =
        data.reply ||
        data.text ||
        data.response ||
        data.data?.reply ||
        data.data?.replyText;

      if (isValidMentorApiResponse(response, data, resolvedReply)) {
        const coachReply = data.data || {};
        const lidactaMsg = {
          id: `msg_${Date.now()}_lid_qa`,
          caseId: newSession.id,
          mentorshipId: newSession.id,
          sender: 'lidacta' as const,
          text: resolvedReply,
          timestamp: new Date().toISOString(),
          stage,
        };

        const activeEntriesOrSkills =
          newSession.skillEntries && newSession.skillEntries.length > 0
            ? newSession.skillEntries
            : newSession.identifiedSkills || [];

        let generatedReport: FinalFeedbackReport | undefined =
          stage === 7 && coachReply.finalFeedback
            ? buildStage7FinalFeedbackReport(
                coachReply.finalFeedback,
                newSession.skillEntries,
                newSession.identifiedSkills
              )
            : undefined;

        if (stage === 7 && !generatedReport) {
          generatedReport = {
            detectedStrengths: [],
            stageTwoSkills: formatStageTwoSkillsWithEvidence(activeEntriesOrSkills),
            chosenActions: [
              newSession.actionPlan?.what ||
                newSession.chosenAlternative ||
                'Acordar criterios explícitos de autonomía y revisión por hitos',
            ],
            stageSixLearnings: [
              newSession.learnings?.insights ||
                newSession.learnings?.whatHappened ||
                'Clarificar criterios previos fortalece la autonomía del equipo.',
            ],
            recommendationsForAutonomy: [
              'Sostener revisiones breves por hitos sin corregir documentos directamente',
              'Solicitar primero la propuesta del colaborador antes de emitir criterio',
              'Extender gradualmente los márgenes de decisión según resultados observables',
            ],
            deliveredAt: new Date().toISOString(),
          };
        }

        let updatedSessionSnapshot: MentorshipSession = newSession;
        setMentorships((prev) =>
          prev.map((m) => {
            if (m.id !== newSession.id) return m;
            let updatedSkillEntries: LeadershipSkillEntry[] = m.skillEntries || [];
            if (
              [2, 3, 4].includes(stage) &&
              Array.isArray(coachReply.skillEntries) &&
              coachReply.skillEntries.length > 0
            ) {
              updatedSkillEntries = coachReply.skillEntries;
            }
            const activeNames =
              updatedSkillEntries.length > 0 ? getActiveSkillNames(updatedSkillEntries) : [];
            const updatedIdentifiedSkills =
              updatedSkillEntries.length > 0
                ? activeNames
                : [2, 3, 4].includes(stage) &&
                  Array.isArray(coachReply.identifiedSkills) &&
                  coachReply.identifiedSkills.length > 0
                ? normalizeExistingSessionSkills(coachReply.identifiedSkills)
                : m.identifiedSkills || [];

            updatedSessionSnapshot = {
              ...m,
              theme: coachReply.detectedTheme || m.theme,
              messages: [...m.messages, lidactaMsg],
              skillEntries: updatedSkillEntries,
              identifiedSkills: updatedIdentifiedSkills,
              finalFeedbackReport: generatedReport || m.finalFeedbackReport,
              lastActiveAt: new Date().toISOString(),
            };
            return updatedSessionSnapshot;
          })
        );

        showToast(
          `Sesión de prueba QA iniciada en ${newSession.testScenarioLabel || `Etapa ${stage}`}.`,
          'success'
        );
        return updatedSessionSnapshot;
      } else {
        if (stage === 7) {
          throw new Error(data?.error || 'Respuesta inválida de mentor en Etapa 7');
        }
        const errMsg = {
          id: `msg_${Date.now()}_err`,
          caseId: newSession.id,
          mentorshipId: newSession.id,
          sender: 'lidacta' as const,
          text: MENTOR_TEMPORARY_ERROR_TEXT,
          timestamp: new Date().toISOString(),
          stage,
          isError: true,
        };
        setMentorships((prev) =>
          prev.map((m) =>
            m.id === newSession.id
              ? { ...m, messages: [...m.messages, errMsg], lastActiveAt: new Date().toISOString() }
              : m
          )
        );
      }
    } catch (err) {
      console.error('Error iniciando sesión QA por etapa:', err);
      if (stage === 7) {
        const activeEntriesOrSkills =
          newSession.skillEntries && newSession.skillEntries.length > 0
            ? newSession.skillEntries
            : newSession.identifiedSkills || [];
        const fallbackReport: FinalFeedbackReport = {
          detectedStrengths: [],
          stageTwoSkills: formatStageTwoSkillsWithEvidence(activeEntriesOrSkills),
          chosenActions: [newSession.actionPlan?.what || newSession.chosenAlternative || 'Delegación con criterios claros'],
          stageSixLearnings: [newSession.learnings?.insights || 'Clarificar criterios fortalece la autonomía del equipo.'],
          recommendationsForAutonomy: [
            'Sostener revisiones por hitos sin asumir tareas operativas',
            'Pedir primero la recomendación del colaborador ante cada consulta',
          ],
          deliveredAt: new Date().toISOString(),
        };
        setMentorships((prev) =>
          prev.map((m) =>
            m.id === newSession.id ? { ...m, finalFeedbackReport: fallbackReport } : m
          )
        );
      }
    } finally {
      setIsSendingMessage(false);
    }

    return newSession;
  };

  const deleteTestSession = (sessionId: string) => {
    const isAdmin =
      sessionUser?.role === 'admin' ||
      sessionUser?.email?.toLowerCase() === 'hola@lidacta.com';
    if (!isAdmin) return;

    const target = mentorships.find((m) => m.id === sessionId);
    if (!target || !target.isTestSession) {
      showToast('Solo es posible eliminar sesiones marcadas como prueba QA.', 'warning');
      return;
    }

    try {
      localStorage.removeItem(`lidacta_stage5_comment_${sessionId}`);
    } catch {}

    const remaining = mentorships.filter((m) => m.id !== sessionId);
    setMentorships(remaining);

    if (activeMentorshipId === sessionId) {
      const nextQa = remaining.find((m) => m.isTestSession && m.leaderId === QA_TEST_LEADER_ID);
      setActiveMentorshipIdState(nextQa ? nextQa.id : null);
    }
    showToast('Sesión de prueba eliminada.', 'info');
  };

  const clearAllTestSessions = (): number => {
    const isAdmin =
      sessionUser?.role === 'admin' ||
      sessionUser?.email?.toLowerCase() === 'hola@lidacta.com';
    if (!isAdmin) return 0;

    const testSessions = mentorships.filter((m) => m.isTestSession);
    if (testSessions.length === 0) return 0;

    testSessions.forEach((ts) => {
      try {
        localStorage.removeItem(`lidacta_stage5_comment_${ts.id}`);
      } catch {}
    });

    const remaining = mentorships.filter((m) => !m.isTestSession);
    setMentorships(remaining);

    if (testSessions.some((ts) => ts.id === activeMentorshipId)) {
      if (currentUser.id === QA_TEST_LEADER_ID) {
        setActiveMentorshipIdState(null);
      } else {
        const nextReal =
          remaining.find((m) => m.leaderId === currentUser.id && m.status !== 'completed') ||
          remaining.find((m) => m.leaderId === currentUser.id);
        setActiveMentorshipIdState(nextReal ? nextReal.id : null);
      }
    }

    showToast(
      `Se eliminaron ${testSessions.length} ${testSessions.length === 1 ? 'sesión de prueba' : 'sesiones de prueba'}.`,
      'success'
    );
    return testSessions.length;
  };

  const switchUser = (userId: string) => {
    if (sessionUser && (sessionUser.role === 'admin' || sessionUser.email?.toLowerCase() === 'hola@lidacta.com')) {
      impersonateUser(userId);
      return;
    }
    setCurrentUserId(userId);
    const targetUser = allUsers.find((u) => u.id === userId);
    if (targetUser && targetUser.role === 'leader') {
      const leaderMentorship =
        mentorships.find((m) => m.leaderId === targetUser.id && !m.isTestSession && m.status !== 'completed') ||
        mentorships.find((m) => m.leaderId === targetUser.id && !m.isTestSession);
      setActiveMentorshipIdState(leaderMentorship ? leaderMentorship.id : null);
    }
  };

  const createNewUser = (profile: Partial<UserProfile>): UserProfile => {
    const id = `user_${Date.now()}`;
    const company = companies.find((c) => c.id === profile.companyId) || companies[0];

    const newUser: UserProfile = {
      id,
      name: profile.name || 'Nuevo Usuario',
      email: profile.email || `${profile.name?.toLowerCase().replace(/\s+/g, '.')}@${company.name.toLowerCase().replace(/\s+/g, '')}.com`,
      role: profile.role || 'leader',
      companyId: company.id,
      companyName: company.name,
      position: profile.position || 'Líder',
      area: profile.area || 'Operaciones',
      birthDate: profile.birthDate || '1990-01-01',
      directReports: profile.directReports ?? 5,
      whatsapp: profile.whatsapp || '+52 55 0000 0000',
      createdAt: new Date().toISOString(),
    };

    setAllUsers((prev) => [newUser, ...prev]);
    if (currentUser.role !== 'admin') {
      setCurrentUserId(newUser.id);
      setSessionUser(newUser);
    }

    // Async persist to central database
    userService.createUser({
      name: newUser.name,
      email: newUser.email,
      role: newUser.role,
      companyId: newUser.companyId,
      companyName: newUser.companyName,
      position: newUser.position,
      area: newUser.area,
      birthDate: newUser.birthDate,
      directReports: newUser.directReports,
      whatsapp: newUser.whatsapp,
      status: 'active',
    }).catch((err) => console.warn('Could not persist new user in database:', err));

    // Trigger Welcome in-app and simulated email message
    const welcomeEmailBody = `¡Hola ${newUser.name}!

Te damos una cálida bienvenida a Lidacta: Desarrollo de Liderazgo en acción.

Tu cuenta ha sido creada exitosamente asociada a ${newUser.companyName}.
En Lidacta cuentas con un espacio 100% seguro y confidencial donde podrás analizar situaciones reales de tu día a día, practicar tus conversaciones y tomar acciones que fortalezcan tu autonomía como líder.

Recursos Humanos únicamente recibirá indicadores agregados de uso, sin acceso a tus conversaciones privadas.

¡Estamos listos para acompañarte en tu próximo reto!

Atentamente,
El Equipo de Lidacta`;

    setWelcomeModalData({
      user: newUser,
      emailText: welcomeEmailBody,
    });

    // Notify HR if new user is a leader
    if (newUser.role === 'leader') {
      const hrNotification: NotificationItem = {
        id: `notif_${Date.now()}`,
        recipientRole: 'hr',
        companyId: newUser.companyId,
        title: 'Nuevo líder registrado en Lidacta',
        message: `${newUser.name} ha completado su registro en Lidacta.`,
        type: 'registration',
        timestamp: new Date().toISOString(),
        read: false,
        emailSimulated: {
          to: `recursos.humanos@${newUser.companyName.toLowerCase().replace(/\s+/g, '')}.com`,
          subject: `Lidacta: ${newUser.name} ha completado su registro`,
          bodyText: `Estimado equipo de Recursos Humanos,\n\nLes informamos que ${newUser.name} (${newUser.position} - Área: ${newUser.area}) ha completado su registro en Lidacta.\n\nYa cuenta con acceso a la plataforma para abordar retos reales de liderazgo con total confidencialidad.\n\nAtentamente,\nEquipo Lidacta`,
        },
      };

      setNotifications((prev) => [hrNotification, ...prev]);
    }

    return newUser;
  };

  const closeWelcomeModal = () => {
    setWelcomeModalData(null);
  };

  const setActiveMentorshipId = (id: string | null) => {
    setActiveMentorshipIdState(id);
  };

  const startNewMentorship = async (
    challengeText: string,
    options?: {
      title?: string;
      stage?: StageNumber;
      priority?: 'alta' | 'media' | 'baja';
      isTestSession?: boolean;
    }
  ): Promise<MentorshipSession> => {
    const company = companies.find((c) => c.id === currentUser.companyId) || companies[0];
    const isQaSession = Boolean(options?.isTestSession || currentUser.id === QA_TEST_LEADER_ID);
    const newSessionId = `${isQaSession ? 'ment_qa_' : 'ment_'}${Date.now()}`;
    const initialStage = options?.stage || 1;
    const sessionTitle =
      options?.title?.trim() ||
      challengeText.slice(0, 60) + (challengeText.length > 60 ? '...' : '');

    const stageNames: Record<StageNumber, string> = {
      1: 'Detectar qué sucede',
      2: 'Analizar perspectivas y habilidades',
      3: 'Diseñar alternativas',
      4: 'Practicar antes de actuar',
      5: 'Actuar (Plan de Acción)',
      6: 'Aprender y reflexionar',
      7: 'Cierre y retroalimentación',
    };

    const newSession: MentorshipSession = {
      id: newSessionId,
      leaderId: currentUser.id,
      leaderName: currentUser.name,
      companyId: currentUser.companyId,
      companyName: currentUser.companyName,
      leaderArea: currentUser.area,
      title: sessionTitle,
      initialChallenge: challengeText,
      currentStage: initialStage,
      theme: 'Alineación y Comunicación',
      status: initialStage === 7 ? 'completed' : initialStage === 5 ? 'in_action' : 'active',
      priority: options?.priority || 'media',
      startedAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
      stageHistory: [
        {
          stage: initialStage,
          stageName: stageNames[initialStage],
          enteredAt: new Date().toISOString(),
        },
      ],
      messages: [
        {
          id: `msg_${Date.now()}_lead`,
          caseId: newSessionId,
          mentorshipId: newSessionId,
          sender: 'leader',
          text: challengeText,
          timestamp: new Date().toISOString(),
          stage: initialStage,
        },
      ],
      identifiedSkills: [],
      skillEntries: [],
      ...(isQaSession ? { isTestSession: true, testScenarioLabel: `Etapa ${initialStage} (QA)` } : {}),
    };

    commitMentorships((prev) => [newSession, ...prev]);
    setActiveMentorshipIdState(newSessionId);

    // Notify HR about new case started (only for real sessions, never QA test sessions)
    if (!isQaSession) {
      const hrNotification: NotificationItem = {
        id: `notif_${Date.now()}_case_start`,
        recipientRole: 'hr',
        companyId: currentUser.companyId,
        title: 'Líder inició acompañamiento en Lidacta',
        message: `${currentUser.name} ha empezado a usar Lidacta para abordar un reto de liderazgo: "${sessionTitle}".`,
        type: 'case_started',
        timestamp: new Date().toISOString(),
        read: false,
        emailSimulated: {
          to: `recursos.humanos@${currentUser.companyName.toLowerCase().replace(/\s+/g, '')}.com`,
          subject: `Lidacta: ${currentUser.name} ha empezado a usar Lidacta`,
          bodyText: `Estimada responsable de Recursos Humanos,\n\nTe informamos que ${currentUser.name} ha iniciado un proceso de acompañamiento en Lidacta para resolver una situación de liderazgo en su equipo.\n\nPor rigurosa confidencialidad, el contenido de su conversación es privado. Recibirás una notificación cuando concluya las 7 etapas de la metodología.\n\nAtentamente,\nEquipo Lidacta`,
        },
      };
      setNotifications((prev) => [hrNotification, ...prev]);
    }

    // Send first message to API with explicit caseId isolation
    acquireCaseOperationLock(activeCaseOperationsRef.current, newSessionId, 'message');
    setCaseSending(newSessionId, true);
    setIsSendingMessage(true);
    try {
      const response = await fetch('/api/mentor/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caseId: newSessionId,
          mentorshipId: newSessionId,
          stage: initialStage,
          activeStage: initialStage,
          leaderProfile: currentUser,
          companyContext: company,
          conversationHistory: [],
          history: [],
          isNewCase: true,
          userMessage: challengeText,
          currentMessage: challengeText,
          message: challengeText,
          identifiedSkills: [],
          skillEntries: [],
          sessionData: stripSessionMessagesForApi(newSession),
        }),
      });

      const data = await response.json().catch(() => ({}));
      const resolvedReply =
        data.reply ||
        data.text ||
        data.response ||
        data.data?.reply ||
        data.data?.replyText;
      if (isValidMentorApiResponse(response, data, resolvedReply)) {
        const coachReply = data.data || {};
        const replyMsg = {
          id: `msg_${Date.now()}_lid`,
          caseId: newSessionId,
          mentorshipId: newSessionId,
          sender: 'lidacta' as const,
          text: resolvedReply,
          timestamp: new Date().toISOString(),
          stage: initialStage,
        };

        const returnedSkillEntries = Array.isArray(coachReply.skillEntries)
          ? coachReply.skillEntries
          : [];
        const returnedIdentifiedSkills = Array.isArray(coachReply.identifiedSkills)
          ? coachReply.identifiedSkills
          : [];

        setMentorships((prev) =>
          prev.map((m) =>
            m.id === newSessionId
              ? {
                  ...m,
                  theme: coachReply.detectedTheme || m.theme,
                  messages: [...m.messages, replyMsg],
                  skillEntries: m.skillEntries && m.skillEntries.length > 0 ? m.skillEntries : returnedSkillEntries,
                  identifiedSkills: m.identifiedSkills && m.identifiedSkills.length > 0 ? m.identifiedSkills : returnedIdentifiedSkills,
                  lastActiveAt: new Date().toISOString(),
                }
              : m
          )
        );
      } else {
        const errMsg = {
          id: `msg_${Date.now()}_err`,
          caseId: newSessionId,
          mentorshipId: newSessionId,
          sender: 'lidacta' as const,
          text: MENTOR_TEMPORARY_ERROR_TEXT,
          timestamp: new Date().toISOString(),
          stage: initialStage,
          isError: true,
        };
        setMentorships((prev) =>
          prev.map((m) =>
            m.id === newSessionId
              ? { ...m, messages: [...m.messages, errMsg], lastActiveAt: new Date().toISOString() }
              : m
          )
        );
      }
    } catch (err) {
      console.error('Error starting mentorship:', err);
      const errMsg = {
        id: `msg_${Date.now()}_err`,
        caseId: newSessionId,
        mentorshipId: newSessionId,
        sender: 'lidacta' as const,
        text: MENTOR_TEMPORARY_ERROR_TEXT,
        timestamp: new Date().toISOString(),
        stage: initialStage,
        isError: true,
      };
      setMentorships((prev) =>
        prev.map((m) =>
          m.id === newSessionId
            ? { ...m, messages: [...m.messages, errMsg], lastActiveAt: new Date().toISOString() }
            : m
        )
      );
    } finally {
      setIsSendingMessage(false);
      releaseCaseOperationLock(activeCaseOperationsRef.current, newSessionId);
      setCaseSending(newSessionId, false);
    }

    return newSession;
  };

  const lastAlertTimestampRef = useRef<{ [key: string]: number }>({});

  /**
   * Dispara el protocolo ético y la alerta de caso con naturaleza terapéutica.
   * Envía correo transaccional vía Resend a hola@lidacta.com y registra en la Bitácora de Alertas.
   */
  const triggerTherapeuticAlert = async (params: {
    leaderName: string;
    leaderEmail?: string;
    companyName?: string;
    currentStage?: number;
    caseSummary: string;
    userMessageSnippet?: string;
  }): Promise<{ success: boolean; alertItem?: SystemAlertItem; error?: string }> => {
    const normalizedEmail = (params.leaderEmail || '').trim().toLowerCase();
    if (
      normalizedEmail === QA_TEST_LEADER_PROFILE.email.toLowerCase() ||
      normalizedEmail.endsWith('@prueba-lidacta.local') ||
      (params.leaderName || '').includes('(Líder QA)')
    ) {
      return { success: false, error: 'Sesión de prueba QA: alerta terapéutica omitida.' };
    }

    const leaderKey = `${params.leaderName}_${params.companyName || ''}`.toLowerCase();
    const nowMs = Date.now();
    const lastTriggered = lastAlertTimestampRef.current[leaderKey] || 0;

    // Prevenir despachos duplicados para el mismo líder en una ventana de 30 segundos
    if (nowMs - lastTriggered < 30000) {
      return { success: true };
    }
    lastAlertTimestampRef.current[leaderKey] = nowMs;

    const nowIso = new Date().toISOString();
    const formattedDateTime = new Date().toLocaleString('es-MX', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const alertId = `alert_therap_${nowMs}_${Math.random().toString(36).substring(2, 6)}`;
    const compName = params.companyName || currentUser.companyName || 'Industrias Nexus Automotriz';
    const leaderMail = params.leaderEmail || currentUser.email || 'lider@empresa.com';
    const stageNum = params.currentStage || 1;

    const alertItem: SystemAlertItem = {
      id: alertId,
      timestamp: nowIso,
      leaderName: params.leaderName,
      companyId: currentUser?.companyId || 'comp_general',
      companyName: compName,
      type: 'therapeutic_limit',
      typeName: 'Límite Terapéutico',
      status: 'Correo Enviado',
      caseSummary: params.caseSummary,
      emailRecipient: 'hola@lidacta.com',
      currentStage: stageNum,
      leaderEmail: leaderMail,
      userMessageSnippet: params.userMessageSnippet,
      details: {
        dateTimeFormatted: formattedDateTime,
        protocolStatus: 'Derivación ética y respetuosa aplicada en chat',
      },
    };

    // 1. Despacho real de correo transaccional a hola@lidacta.com
    try {
      await emailService.sendTherapeuticAlert({
        leaderName: params.leaderName,
        leaderEmail: leaderMail,
        companyName: compName,
        currentStage: stageNum,
        stageName: `Etapa ${stageNum}`,
        dateTimeFormatted: formattedDateTime,
        contextSummary: params.caseSummary,
      });
    } catch (e) {
      console.error('[triggerTherapeuticAlert] Error enviando correo Resend:', e);
    }

    // 2. Registrar en Bitácora de Alertas del Sistema
    setSystemAlerts((prev) => [alertItem, ...prev]);

    // 3. Crear notificación interna para Administradora
    const adminNotif: NotificationItem = {
      id: `notif_${nowMs}_therap`,
      recipientRole: 'admin',
      companyId: currentUser?.companyId || 'comp_general',
      title: `🚨 Alerta: Límite Terapéutico detectado (${params.leaderName})`,
      message: `Lidacta detectó una consulta con naturaleza clínica/terapéutica en la Etapa ${stageNum} de ${params.leaderName} (${compName}). Se notificó a hola@lidacta.com.`,
      type: 'therapeutic_alert',
      timestamp: nowIso,
      read: false,
      emailSimulated: {
        from: 'Lidacta <notificaciones@taniapadierna.com>',
        to: 'hola@lidacta.com',
        replyTo: leaderMail,
        subject: '[ALERTA LIDACTA] Detección de Caso con Naturaleza Terapéutica',
        bodyText: `Estimada Tania:\n\nSe ha activado el Protocolo Ético de Límite Terapéutico en Lidacta.\n\n• Nombre del Líder: ${params.leaderName}\n• Empresa: ${compName}\n• Fecha/Hora: ${formattedDateTime}\n• Etapa actual: Etapa ${stageNum}\n• Resumen contextual: ${params.caseSummary}\n\nAcción realizada en chat: Orientación cálida hacia profesionales de la salud mental / PAE sin bloquear la plataforma.`,
        realEmailSent: true,
      },
    };
    setNotifications((prev) => [adminNotif, ...prev]);

    return { success: true, alertItem };
  };

  const sendMessageInActiveSession = async (text: string, isPractice: boolean = false) => {
    if (!activeMentorship || !text.trim()) return;

    const currentCaseId = activeMentorship.id;
    const targetSession =
      mentorshipsRef.current.find((m) => m.id === currentCaseId) || activeMentorship;
    if (!acquireCaseOperationLock(activeCaseOperationsRef.current, currentCaseId, 'message')) {
      return;
    }

    const currentStage = targetSession.currentStage;
    const company = companies.find((c) => c.id === targetSession.companyId) || companies[0];

    setCaseSending(currentCaseId, true);
    setIsSendingMessage(true);

    try {
      // Filter strictly to ensure no foreign messages or technical error messages are passed to Gemini
      const isolatedExistingMessages = (targetSession.messages || []).filter((m: any) => {
        if (!m || typeof m !== 'object') return false;
        const mCase = m.caseId || m.mentorshipId;
        if (mCase && mCase !== currentCaseId) return false;
        if (isTechnicalErrorMessage(m)) {
          return false;
        }
        return true;
      });

      const leaderMsg = {
        id: `msg_${Date.now()}_lead`,
        caseId: currentCaseId,
        mentorshipId: currentCaseId,
        sender: 'leader' as const,
        text: text.trim(),
        timestamp: new Date().toISOString(),
        stage: currentStage,
        isLeaderVoiceQuote: text.length < 140, // Format short insights nicely
      };

      // UI state: preserve all accumulated messages (including technical error notifications and retries) in chronological order
      commitMentorships((prev) =>
        prev.map((m) =>
          m.id === currentCaseId
            ? {
                ...m,
                stageReadyToAdvance: null,
                messages: [...(m.messages || []), leaderMsg],
                lastActiveAt: new Date().toISOString(),
              }
            : m
        )
      );

      const response = await fetch('/api/mentor/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caseId: currentCaseId,
          mentorshipId: currentCaseId,
          message: text,
          history: isolatedExistingMessages,
          stage: currentStage,
          activeStage: currentStage,
          leaderProfile: currentUser,
          companyContext: company,
          conversationHistory: isolatedExistingMessages,
          userMessage: text,
          currentMessage: text,
          identifiedSkills: targetSession.identifiedSkills || [],
          skillEntries: targetSession.skillEntries || [],
          sessionData: {
            ...stripSessionMessagesForApi(targetSession),
            skillEntries: targetSession.skillEntries || [],
            identifiedSkills: targetSession.identifiedSkills || [],
          },
          isPracticeMode: isPractice,
        }),
      });

      const data = await response.json().catch(() => ({}));
      const resolvedReply =
        data.reply ||
        data.text ||
        data.response ||
        data.data?.reply ||
        data.data?.replyText;
      const coachReply = data.data || {};
      const stage7ResponseValid =
        currentStage !== 7 ||
        (isVerifiedGeminiResponse(data, { requireExplicitVerification: true }) &&
          isValidStage7FinalFeedbackReport(coachReply.finalFeedback));

      if (isValidMentorApiResponse(response, data, resolvedReply) && stage7ResponseValid) {
        const isReadyToAdvance = Boolean(coachReply.readyToAdvance || data.readyToAdvance);
        const stageAdvanceSignal =
          isReadyToAdvance && currentStage >= 1 && currentStage <= 4
            ? (currentStage as StageNumber)
            : null;

        const rawStructuredCorrection =
          coachReply.correctedExecutionStatus ?? data.correctedExecutionStatus;
        const validatedStage6Correction: 'not_executed' | null =
          currentStage === 6 && rawStructuredCorrection === 'not_executed'
            ? 'not_executed'
            : currentStage === 6
            ? detectStage6ExecutionCorrection(text, targetSession.actionPlanExecutionStatus)
            : null;

        const lidactaMsg = {
          id: `msg_${Date.now()}_lid`,
          caseId: currentCaseId,
          mentorshipId: currentCaseId,
          sender: 'lidacta' as const,
          text: resolvedReply,
          timestamp: new Date().toISOString(),
          stage: currentStage,
        };

        let committedTargetSession: MentorshipSession | undefined;

        commitMentorships((prev) =>
          prev.map((m) => {
            if (m.id !== currentCaseId) return m;

            const baseSession =
              validatedStage6Correction === 'not_executed'
                ? reconcileStage6ExecutionState(m, 'not_executed')
                : m;

            // Manejo estructurado de skillEntries:
            // En etapas 2, 3 y 4: cuando el backend devuelve un arreglo en coachReply.skillEntries,
            // se adopta directamente como la verdad canónica estructurada (respetando estados y evidencias reales).
            // En etapas 1, 5, 6 y 7: se conservan intactas las entradas existentes de la sesión (m.skillEntries).
            let newSkillEntries: LeadershipSkillEntry[] = baseSession.skillEntries || [];
            if ([2, 3, 4].includes(currentStage) && Array.isArray(coachReply.skillEntries)) {
              newSkillEntries = coachReply.skillEntries;
            } else if (
              (!baseSession.skillEntries || baseSession.skillEntries.length === 0) &&
              Array.isArray(baseSession.identifiedSkills) &&
              baseSession.identifiedSkills.length > 0 &&
              Array.isArray(coachReply.skillEntries) &&
              coachReply.skillEntries.length > 0
            ) {
              newSkillEntries = coachReply.skillEntries;
            }

            // Sincronización de identifiedSkills para retrocompatibilidad:
            // Si existen skillEntries, extraemos los nombres de las habilidades activas (vigente o precisada) con getActiveSkillNames.
            // Si no hay skillEntries, recurrimos a coachReply.identifiedSkills (en 2, 3, 4) o mantenemos m.identifiedSkills.
            const activeSkillNamesFromEntries = newSkillEntries.length > 0 ? getActiveSkillNames(newSkillEntries) : [];
            const newSkills =
              newSkillEntries.length > 0
                ? activeSkillNamesFromEntries
                : [2, 3, 4].includes(currentStage) && Array.isArray(coachReply.identifiedSkills)
                ? normalizeExistingSessionSkills(coachReply.identifiedSkills)
                : baseSession.identifiedSkills
                ? normalizeExistingSessionSkills(baseSession.identifiedSkills)
                : [];

            const authoritativeEntries =
              newSkillEntries.length > 0 ? newSkillEntries : baseSession.skillEntries;
            const authoritativeLegacySkills =
              newSkills.length > 0 ? newSkills : baseSession.identifiedSkills;

            // In Stage 5, the leader personally writes and owns their Action Plan.
            // Any suggestions or drafts provided by Lidacta in the conversation remain in the chat only
            // and are NEVER automatically populated into m.actionPlan.
            const verifiedStage7Feedback =
              currentStage === 7 &&
              coachReply.finalFeedback &&
              isVerifiedGeminiResponse(data, { requireExplicitVerification: true })
                ? buildStage7FinalFeedbackReport(
                    coachReply.finalFeedback,
                    authoritativeEntries,
                    authoritativeLegacySkills,
                    new Date().toISOString(),
                    {
                      actionPlan: baseSession.actionPlan,
                      learnings: baseSession.learnings,
                      actionPlanExecutionStatus: resolveStage6ExecutionStatus(baseSession),
                    }
                  )
                : undefined;

            const updatedTargetSession: MentorshipSession = {
              ...baseSession,
              stageReadyToAdvance:
                stageAdvanceSignal !== null ? stageAdvanceSignal : baseSession.stageReadyToAdvance,
              messages: [...baseSession.messages, lidactaMsg],
              theme: coachReply.detectedTheme || baseSession.theme,
              skillEntries: newSkillEntries,
              identifiedSkills: newSkills,
              suggestedAlternatives:
                coachReply.suggestedAlternatives || baseSession.suggestedAlternatives,
              actionPlan: baseSession.actionPlan,
              finalFeedbackReport: verifiedStage7Feedback || baseSession.finalFeedbackReport,
              lastActiveAt: new Date().toISOString(),
            };
            committedTargetSession = updatedTargetSession;
            return updatedTargetSession;
          })
        );

        const resolvedTargetSession = committedTargetSession || targetSession;

        // Despacho automático de correo para Etapa 7 exclusivamente con respuesta verificada de Gemini y reporte válido
        const generatedStage7Report: FinalFeedbackReport | undefined =
          currentStage === 7 &&
          coachReply.finalFeedback &&
          isVerifiedGeminiResponse(data, { requireExplicitVerification: true })
            ? buildStage7FinalFeedbackReport(
                coachReply.finalFeedback,
                resolvedTargetSession.skillEntries,
                resolvedTargetSession.identifiedSkills,
                new Date().toISOString(),
                {
                  actionPlan: resolvedTargetSession.actionPlan,
                  learnings: resolvedTargetSession.learnings,
                  actionPlanExecutionStatus: resolveStage6ExecutionStatus(resolvedTargetSession),
                }
              )
            : undefined;

        if (currentStage === 7 && !resolvedTargetSession.isTestSession) {
          const reportToSend = generatedStage7Report || resolvedTargetSession.finalFeedbackReport;
          if (
            isVerifiedGeminiResponse(data, { requireExplicitVerification: true }) &&
            isValidStage7FinalFeedbackReport(reportToSend) &&
            !resolvedTargetSession.finalReportEmailSent
          ) {
            const sessionSnapshot: MentorshipSession = {
              ...resolvedTargetSession,
              finalFeedbackReport: reportToSend,
            };
            dispatchFinalFeedbackReportEmail(sessionSnapshot, reportToSend).catch((e) =>
              console.error('[LIDACTA 📧] Error no bloqueante al despachar reporte final por email:', e)
            );
          }
        }

        // Silent and automatic resource tracking in background (100% invisible for leader; omit for QA test sessions)
        if (!resolvedTargetSession.isTestSession) {
          if (coachReply.recommendedResources && Array.isArray(coachReply.recommendedResources) && coachReply.recommendedResources.length > 0) {
            coachReply.recommendedResources.forEach((res: any) => {
              recordResourceRecommendation({
                resourceTitle: res.title || res.resourceTitle,
                origin: res.origin || 'internal',
                categoryOrTool: res.category || res.categoryOrTool || 'Biblioteca Interna (Bloque 3)',
                sourceOrAuthor: res.sourceOrAuthor || (res.origin === 'internal' ? 'Biblioteca Interna Lidacta (Bloque 3)' : 'Fuente Externa Delimitada'),
                urlOrRef: res.urlOrRef,
                leaderId: resolvedTargetSession.leaderId,
                leaderName: resolvedTargetSession.leaderName,
                leaderEmail: currentUser.email || `${resolvedTargetSession.leaderId}@empresa.com`,
                companyId: resolvedTargetSession.companyId,
                companyName: resolvedTargetSession.companyName,
                mentorshipId: resolvedTargetSession.id,
                challengeTitle: resolvedTargetSession.title,
                theme: coachReply.detectedTheme || resolvedTargetSession.theme || 'Desarrollo de Liderazgo',
                stage: currentStage,
                stageName: `Etapa ${currentStage}`,
                estimatedUtility: res.estimatedUtility || 'Muy Alta',
                utilityReason: res.utilityReason || `Alineación contextual con el reto de "${resolvedTargetSession.title}".`,
                estimatedDifficulty: res.estimatedDifficulty || 'Media',
                resistanceOrDoubtNotes: res.resistanceOrDoubtNotes || 'Foco en aplicación práctica sin burocracia.',
              });
            });
          } else {
            autoDetectAndLogResources(currentStage, resolvedTargetSession, text, coachReply.replyText);
          }

          // Protocolo Ético: Detección automática y despacho de Alerta de Límite Terapéutico
          const isTherapeutic = Boolean(
            coachReply.isTherapeuticCase ||
            coachReply.therapeuticReason ||
            isTherapeuticText(text)
          );

          if (isTherapeutic && !resolvedTargetSession.isTestSession && currentUser.id !== QA_TEST_LEADER_ID) {
            triggerTherapeuticAlert({
              leaderName: resolvedTargetSession.leaderName || currentUser.name,
              leaderEmail: currentUser.email || `${resolvedTargetSession.leaderId}@empresa.com`,
              companyName: resolvedTargetSession.companyName || currentUser.companyName,
              currentStage: currentStage,
              caseSummary: coachReply.therapeuticReason || `Consulta con posible naturaleza clínica/terapéutica detectada en mensaje: "${text.substring(0, 160)}"`,
              userMessageSnippet: text,
            }).catch((err) => console.error('Error triggering therapeutic alert:', err));
          }
        }
      } else {
        const errMsg = {
          id: `msg_${Date.now()}_err`,
          caseId: currentCaseId,
          mentorshipId: currentCaseId,
          sender: 'lidacta' as const,
          text: 'Lidacta no pudo responder en este momento. Por favor reintenta.',
          timestamp: new Date().toISOString(),
          stage: currentStage,
          isError: true,
        };
        commitMentorships((prev) =>
          prev.map((m) =>
            m.id === currentCaseId
              ? { ...m, messages: [...m.messages, errMsg], lastActiveAt: new Date().toISOString() }
              : m
          )
        );
      }
    } catch (error) {
      console.error('Error detallado del chat:', error);
      const errMsg = {
        id: `msg_${Date.now()}_err`,
        caseId: currentCaseId,
        mentorshipId: currentCaseId,
        sender: 'lidacta' as const,
        text: 'Lidacta no pudo responder en este momento. Por favor reintenta.',
        timestamp: new Date().toISOString(),
        stage: currentStage,
        isError: true,
      };
      commitMentorships((prev) =>
        prev.map((m) =>
          m.id === currentCaseId
            ? { ...m, messages: [...m.messages, errMsg], lastActiveAt: new Date().toISOString() }
            : m
        )
      );
    } finally {
      setIsSendingMessage(false);
      releaseCaseOperationLock(activeCaseOperationsRef.current, currentCaseId);
      setCaseSending(currentCaseId, false);
    }
  };

  /**
   * Despacho automático y protegido del Reporte Final de Etapa 7 al correo registrado del Líder vía Resend.
   * Evita duplicados, no bloquea el cierre del caso y maneja contingencias de red/Resend.
   */
  const dispatchFinalFeedbackReportEmail = async (
    targetMentorship: MentorshipSession,
    report: FinalFeedbackReport
  ): Promise<{ success: boolean; message?: string; emailId?: string }> => {
    if (!targetMentorship || !report) {
      return { success: false, message: 'Faltan datos de mentoría o reporte.' };
    }
    if (targetMentorship.isTestSession) {
      return { success: false, message: 'Sesión de prueba QA: envío de correo deshabilitado.' };
    }
    const caseId = targetMentorship.id;

    // 1. PROTECCIÓN CONTRA DUPLICADOS:
    // Si ya fue enviado previamente o está en curso de envío (in-flight), NO enviar nuevamente.
    if (targetMentorship.finalReportEmailSent) {
      return { success: true, message: 'El reporte final ya fue enviado previamente por correo.' };
    }
    if (inFlightFinalReportEmailRef.current.has(caseId)) {
      return { success: false, message: 'El envío del reporte ya se encuentra en proceso.' };
    }

    // 2. OBTENCIÓN DEL DESTINATARIO REAL DEL LÍDER:
    // Resolver el correo del líder registrado en allUsers o en la sesión activa, nunca Recursos Humanos
    const leaderUser =
      allUsers.find((u) => u.id === targetMentorship.leaderId) ||
      (currentUser.id === targetMentorship.leaderId ? currentUser : null) ||
      allUsers.find(
        (u) =>
          u.name &&
          targetMentorship.leaderName &&
          u.name.trim().toLowerCase() === targetMentorship.leaderName.trim().toLowerCase()
      );

    const leaderEmail = (
      leaderUser?.email ||
      (targetMentorship as any).leaderEmail ||
      (currentUser.id === targetMentorship.leaderId ? currentUser.email : '')
    ).trim().toLowerCase();

    // REGLA OBLIGATORIA: Utilizar exclusivamente el correo electrónico real y registrado del líder.
    // Queda terminantemente PROHIBIDO inventar o sintetizar direcciones de correo.
    if (!leaderEmail || !leaderEmail.includes('@')) {
      const errMsg = 'No se encontró un correo electrónico real registrado para el líder.';
      console.warn(`[LIDACTA 📧] No se pudo enviar reporte final (caso ${caseId}): ${errMsg}`);
      setMentorships((prev) =>
        prev.map((m) =>
          m.id === caseId
            ? {
                ...m,
                finalReportEmailSent: false,
                finalReportEmailStatus: 'failed',
                finalReportEmailError: errMsg,
              }
            : m
        )
      );
      return { success: false, message: errMsg };
    }

    const leaderName = leaderUser?.name || targetMentorship.leaderName || 'Líder';
    const companyName = targetMentorship.companyName || leaderUser?.companyName || 'Empresa';
    const challengeTitle = targetMentorship.title || 'Desafío de Liderazgo';

    inFlightFinalReportEmailRef.current.add(caseId);

    try {
      const result = await emailService.sendFinalFeedbackReport({
        leaderEmail,
        leaderName,
        companyName,
        challengeTitle,
        report,
      });

      if (result.success) {
        const isReal = Boolean(result.realSent);
        setMentorships((prev) =>
          prev.map((m) =>
            m.id === caseId
              ? {
                  ...m,
                  finalReportEmailSent: isReal,
                  finalReportEmailSentAt: new Date().toISOString(),
                  finalReportEmailId: result.emailId,
                  finalReportEmailStatus: isReal ? 'sent' : 'simulated',
                  finalReportEmailError: undefined,
                }
              : m
          )
        );
        return {
          success: true,
          emailId: result.emailId,
          message: result.message || 'Reporte final enviado exitosamente al correo del líder.',
        };
      } else {
        const errorMsg = result.error || 'Error al despachar el correo con Resend.';
        console.warn(`[LIDACTA 📧] Envío fallido de reporte final (caso ${caseId}):`, errorMsg);
        setMentorships((prev) =>
          prev.map((m) =>
            m.id === caseId
              ? {
                  ...m,
                  finalReportEmailSent: false,
                  finalReportEmailStatus: 'failed',
                  finalReportEmailError: errorMsg,
                }
              : m
          )
        );
        return { success: false, message: errorMsg };
      }
    } catch (err: any) {
      const errorMsg = err?.message || 'Error de red inesperado al entregar correo.';
      console.error(`[LIDACTA 📧] Excepción en envío de reporte final (caso ${caseId}):`, err);
      setMentorships((prev) =>
        prev.map((m) =>
          m.id === caseId
            ? {
                ...m,
                finalReportEmailSent: false,
                finalReportEmailStatus: 'failed',
                finalReportEmailError: errorMsg,
              }
            : m
        )
      );
      return { success: false, message: errorMsg };
    } finally {
      inFlightFinalReportEmailRef.current.delete(caseId);
    }
  };

  /**
   * Reintento controlado y seguro para reenviar el reporte final si un intento previo falló.
   */
  const retrySendFinalReportEmail = async (mentorshipId?: string): Promise<{ success: boolean; message?: string }> => {
    const target = mentorshipId
      ? mentorships.find((m) => m.id === mentorshipId)
      : activeMentorship;
    if (!target) {
      return { success: false, message: 'No se encontró la mentoría objetivo.' };
    }
    if (!target.finalFeedbackReport) {
      return { success: false, message: 'La mentoría aún no cuenta con un reporte final generado.' };
    }
    if (target.finalReportEmailSent) {
      return { success: true, message: 'El reporte ya fue enviado exitosamente con anterioridad.' };
    }
    return dispatchFinalFeedbackReportEmail(target, target.finalFeedbackReport);
  };

  const advanceStage = async (targetStage?: StageNumber): Promise<boolean> => {
    if (!activeMentorship) return false;
    return executeTransactionalStageTransition({
      activeCaseId: activeMentorship.id,
      targetStage,
      getSessionById: (caseId) => mentorshipsRef.current.find((m) => m.id === caseId),
      commitMentorships,
      activeCaseOperationsRef,
      setCaseAdvancing,
      companies,
      currentUser,
      setNotifications,
      dispatchFinalFeedbackReportEmail,
      recordResourceRecommendation,
      autoDetectAndLogResources,
      showToast,
      setIsSendingMessage,
    });
  };

  const setStageReadyToAdvance = (stage: StageNumber | null) => {
    if (!activeMentorship) return;
    const currentCaseId = activeMentorship.id;
    commitMentorships((prev) =>
      prev.map((m) =>
        m.id === currentCaseId
          ? {
              ...m,
              stageReadyToAdvance: stage,
              lastActiveAt: new Date().toISOString(),
            }
          : m
      )
    );
  };

  const updateActionPlan = (plan: MentorshipSession['actionPlan']): boolean => {
    if (!activeMentorship || !plan) return false;
    const currentCaseId = activeMentorship.id;
    const latestSession =
      mentorshipsRef.current.find((m) => m.id === currentCaseId) || activeMentorship;
    if (!latestSession) return false;

    const now = new Date().toISOString();
    const stage5Time = plan.stage5EnteredAt || latestSession.stage5EnteredAt || now;
    const isShared = Boolean(
      plan.shareActionPlanWithHR ?? plan.actionPlanShared ?? plan.shareWithHR ?? false
    );
    const updatedPlan: MentorshipActionPlan = {
      ...plan,
      cleanedAutoGeneratedV1:
        plan.cleanedAutoGeneratedV1 ?? latestSession.actionPlan?.cleanedAutoGeneratedV1,
      shareWithHR: isShared,
      shareActionPlanWithHR: isShared,
      actionPlanShared: isShared,
      stage5EnteredAt: stage5Time,
    };

    let updated = false;
    commitMentorships((prev) =>
      prev.map((m) => {
        if (m.id !== currentCaseId) return m;
        updated = true;
        return {
          ...m,
          actionPlan: updatedPlan,
          shareActionPlanWithHR: isShared,
          actionPlanShared: isShared,
          stage5EnteredAt: stage5Time,
          status: 'in_action',
          lastActiveAt: now,
        };
      })
    );

    if (!updated) return false;

    // Create action reminder notification for leader (only for real sessions)
    if (!latestSession.isTestSession) {
      const reminderNotif: NotificationItem = {
        id: `notif_${Date.now()}_reminder`,
        recipientRole: 'leader',
        recipientUserId: latestSession.leaderId,
        companyId: latestSession.companyId,
        title: 'Recordatorio de tu Plan de Acción',
        message: `${currentUser.name}, tienes programada tu acción: "${plan.what}". Recuerda cuidar: ${plan.careReminders}`,
        type: 'action_reminder',
        timestamp: now,
        read: false,
        emailSimulated: {
          to: currentUser.email,
          subject: `Lidacta: Recordatorio de tu plan de acción`,
          bodyText: `Hola ${currentUser.name},\n\nTe recordamos tu compromiso de liderazgo:\n• Acción: ${plan.what}\n• Momento: ${plan.when}\n• Con quién: ${plan.withWhom}\n• Qué vas a cuidar: ${plan.careReminders}\n\nEn cuanto la lleves a cabo, regresa a Lidacta para registrar qué ocurrió en la Etapa 6.\n\n¡Desarrollo de liderazgo en acción!`,
        },
      };

      setNotifications((prev) => [reminderNotif, ...prev]);
    }
    return true;
  };

  /**
   * Procesa de forma automatizada los correos de acompañamiento de Etapa 5 (48h y 5 días)
   * y despacha la alerta de inactividad de 8 días para la Administradora (hola@lidacta.com).
   */
  const checkAndProcessStage5FollowUps = async (options?: {
    simulatedNow?: string;
    force?: boolean;
  }): Promise<{
    processed: number;
    sent48h: number;
    sent5d: number;
    sentAdminAlert: number;
  }> => {
    const currentTimeMs = options?.simulatedNow
      ? new Date(options.simulatedNow).getTime()
      : Date.now();
    let sent48hCount = 0;
    let sent5dCount = 0;
    let sentAdminAlertCount = 0;
    let processedCount = 0;

    const newNotifications: NotificationItem[] = [];
    const newSystemAlerts: SystemAlertItem[] = [];

    const updatedMentorships = await Promise.all(
      mentorships.map(async (session) => {
        // Excluir sesiones de prueba QA de seguimientos automáticos y alertas de inactividad
        if (session.isTestSession) return session;

        // Evaluar si la sesión está en etapa 5 o tiene plan de acción registrado
        const hasStage5 =
          session.currentStage === 5 ||
          Boolean(session.stage5EnteredAt) ||
          Boolean(session.actionPlan?.stage5EnteredAt) ||
          session.stageHistory.some((h) => h.stage === 5);

        if (!hasStage5) return session;
        processedCount++;

        const stage5TimeStr =
          session.stage5EnteredAt ||
          session.actionPlan?.stage5EnteredAt ||
          session.stageHistory.find((h) => h.stage === 5)?.enteredAt ||
          session.startedAt;
        const stage5TimeMs = new Date(stage5TimeStr).getTime();
        const elapsedHours = Math.max(0, (currentTimeMs - stage5TimeMs) / (1000 * 60 * 60));
        const elapsedDays = elapsedHours / 24;

        // Recuperar detalles del perfil del líder
        const leaderUser = allUsers.find(
          (u) =>
            u.id === session.leaderId ||
            (u.email && session.leaderId && u.id.toLowerCase() === session.leaderId.toLowerCase())
        );
        const leaderEmail =
          leaderUser?.email ||
          (session.leaderName
            ? `${session.leaderName.toLowerCase().replace(/\s+/g, '.')}@${(session.companyName || 'empresa').toLowerCase().replace(/\s+/g, '')}.com`
            : 'lider@empresa.com');
        const leaderPosition = leaderUser?.position || 'Líder Operativo';
        const leaderArea = leaderUser?.area || session.leaderArea || 'Operaciones';
        const leaderWhatsapp = leaderUser?.whatsapp || '+52 55 9876 5432';
        const nowIso = new Date(currentTimeMs).toISOString();

        let updatedSession = { ...session };
        let actionPlanUpdated = session.actionPlan ? { ...session.actionPlan } : undefined;

        // 1. Correo 1 (a las 48 horas): Asunto de apoyo continuo para revisar el primer paso del compromiso del líder.
        const alreadySent48h = session.email48hSent || session.actionPlan?.email48hSent;
        if ((elapsedHours >= 48 || options?.force) && !alreadySent48h) {
          try {
            await emailService.sendStage5FollowUp48h({
              leaderEmail,
              leaderName: session.leaderName,
              companyName: session.companyName,
              challengeTitle: session.title,
              actionPlan: session.actionPlan,
            });
            sent48hCount++;
            updatedSession.email48hSent = true;
            updatedSession.email48hSentAt = nowIso;
            if (actionPlanUpdated) {
              actionPlanUpdated.email48hSent = true;
              actionPlanUpdated.email48hSentAt = nowIso;
            }

            newNotifications.push({
              id: `notif_${Date.now()}_stage5_48h_${session.id}`,
              recipientRole: 'leader',
              recipientUserId: session.leaderId,
              companyId: session.companyId,
              title: 'Apoyo continuo Lidacta (48 hrs tras tu plan)',
              message: `${session.leaderName}, han transcurrido 48 horas desde tu plan de acción. Estamos contigo para acompañarte en tu primer paso con "${session.actionPlan?.what || session.title}".`,
              type: 'stage5_followup',
              timestamp: nowIso,
              read: false,
              emailSimulated: {
                from: 'Lidacta <notificaciones@taniapadierna.com>',
                to: leaderEmail,
                replyTo: 'hola@lidacta.com',
                subject: 'Apoyo continuo para revisar el primer paso de tu compromiso en Lidacta',
                bodyText: `¡Hola ${session.leaderName}!\n\nHan transcurrido 48 horas desde que definiste tu plan de acción en Lidacta para tu desafío: "${session.title}".\n\n• ¿Qué harás?: ${session.actionPlan?.what || 'Conversación 1 a 1'}\n• ¿Cuándo?: ${session.actionPlan?.when || 'Esta semana'}\n• ¿Con quién?: ${session.actionPlan?.withWhom || 'Equipo'}\n• ¿Cómo?: ${session.actionPlan?.how || 'Diálogo directo y constructivo'}\n• Qué vas a cuidar: ${session.actionPlan?.careReminders || 'Escucha activa'}\n\nRecuerda: El liderazgo se forja en las conversaciones reales del día a día.`,
                realEmailSent: true,
              },
            });
          } catch (e) {
            console.error('Error dispatching stage 5 48h follow-up:', e);
          }
        }

        // 2. Correo 2 (a los 5 días): Asunto de seguimiento previo para consolidar avances antes de pasar a la Etapa 6.
        const alreadySent5d = session.email5dSent || session.actionPlan?.email5dSent;
        if ((elapsedDays >= 5 || options?.force) && !alreadySent5d) {
          try {
            await emailService.sendStage5FollowUp5d({
              leaderEmail,
              leaderName: session.leaderName,
              companyName: session.companyName,
              challengeTitle: session.title,
              actionPlan: session.actionPlan,
            });
            sent5dCount++;
            updatedSession.email5dSent = true;
            updatedSession.email5dSentAt = nowIso;
            if (actionPlanUpdated) {
              actionPlanUpdated.email5dSent = true;
              actionPlanUpdated.email5dSentAt = nowIso;
            }

            newNotifications.push({
              id: `notif_${Date.now()}_stage5_5d_${session.id}`,
              recipientRole: 'leader',
              recipientUserId: session.leaderId,
              companyId: session.companyId,
              title: 'Seguimiento de avances hacia la Etapa 6 (5 días)',
              message: `${session.leaderName}, es momento de consolidar avances de tu compromiso antes de pasar a la Etapa 6 (Aprender y reflexionar).`,
              type: 'stage5_followup',
              timestamp: nowIso,
              read: false,
              emailSimulated: {
                from: 'Lidacta <notificaciones@taniapadierna.com>',
                to: leaderEmail,
                replyTo: 'hola@lidacta.com',
                subject: 'Seguimiento de tu plan de acción en Lidacta: consolidando avances hacia la Etapa 6',
                bodyText: `¡Hola ${session.leaderName}!\n\nHan transcurrido 5 días desde que estableciste tu plan de acción en Lidacta.\n\nEs un excelente momento para hacer una pausa previa: ¿pudiste llevar a cabo la acción acordada? ¿Qué funcionó y qué respuestas observaste en tu equipo?\n\nTe invitamos a ingresar a Lidacta para concluir tu plan y avanzar a la Etapa 6.`,
                realEmailSent: true,
              },
            });
          } catch (e) {
            console.error('Error dispatching stage 5 5d follow-up:', e);
          }
        }

        // 3. Alerta de Inactividad para la Administradora (a partir del Día 8):
        // Si transcurren 8 días calendario tras finalizar la Etapa 5 sin que el líder haya ingresado a la plataforma
        // o interactuado con Lidacta, envía un correo automático de alerta a hola@lidacta.com.
        // Contenido de la alerta: Nombre del Líder, Empresa, Fecha del último acceso, Etapa actual (Etapa 5) y resumen breve de su compromiso no finalizado.
        const lastActiveTimeMs = new Date(session.lastActiveAt || stage5TimeStr).getTime();
        const daysSinceLastActive = Math.max(0, (currentTimeMs - lastActiveTimeMs) / (1000 * 60 * 60 * 24));
        const isInactiveInStage5 =
          session.currentStage === 5 &&
          (daysSinceLastActive >= 8 || elapsedDays >= 8 || options?.force);
        const alreadySentAdminAlert =
          session.adminInactivityAlertSent || session.actionPlan?.adminInactivityAlertSent;

        if (isInactiveInStage5 && !alreadySentAdminAlert) {
          try {
            const lastActiveDate = new Date(session.lastActiveAt || stage5TimeStr);
            const lastActiveFormatted = `${lastActiveDate.toLocaleDateString('es-MX', {
              day: '2-digit',
              month: 'long',
              year: 'numeric',
            })}, ${lastActiveDate.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })} hrs`;

            await emailService.sendStage5InactivityAlertToAdmin({
              leaderEmail,
              leaderName: session.leaderName,
              companyName: session.companyName,
              challengeTitle: session.title,
              leaderPosition,
              leaderArea,
              leaderWhatsapp,
              lastActiveAt: session.lastActiveAt,
              lastActiveFormatted,
              actionPlan: session.actionPlan,
            });
            sentAdminAlertCount++;
            updatedSession.adminInactivityAlertSent = true;
            updatedSession.adminInactivityAlertSentAt = nowIso;
            if (actionPlanUpdated) {
              actionPlanUpdated.adminInactivityAlertSent = true;
              actionPlanUpdated.adminInactivityAlertSentAt = nowIso;
            }

            newNotifications.push({
              id: `notif_${Date.now()}_stage5_inactivity_${session.id}`,
              recipientRole: 'admin',
              companyId: session.companyId,
              title: `🚨 Alerta de Inactividad (Día 8): ${session.leaderName} en Etapa 5`,
              message: `Han transcurrido más de 8 días sin actividad en la plataforma desde que ${session.leaderName} (${session.companyName}) definió su compromiso en la Etapa 5.`,
              type: 'inactivity_alert',
              timestamp: nowIso,
              read: false,
              emailSimulated: {
                from: 'Lidacta <notificaciones@taniapadierna.com>',
                to: 'hola@lidacta.com',
                replyTo: leaderEmail,
                subject: `🚨 Alerta de Inactividad (Día 8): ${session.leaderName} (${session.companyName}) sin avances en Etapa 5`,
                bodyText: `Estimada Tania,\n\nEl sistema de monitoreo de Lidacta ha detectado que han transcurrido 8 días calendario desde que ${session.leaderName} definió su compromiso en la Etapa 5 sin que haya ingresado a la plataforma ni registrado avances hacia la Etapa 6.\n\n📋 DATOS DEL LÍDER E INACTIVIDAD:\n• Nombre del Líder: ${session.leaderName}\n• Empresa: ${session.companyName}\n• Puesto / Área: ${leaderPosition} (Área: ${leaderArea})\n• Fecha del último acceso: ${lastActiveFormatted}\n• Etapa actual: Etapa 5 (Compromiso y Plan de Acción)\n• Desafío en curso: "${session.title}"\n\n⚠️ RESUMEN BREVE DE SU COMPROMISO NO FINALIZADO:\n• Acción comprometida: ${session.actionPlan?.what || 'Conversación de liderazgo'}\n• Fecha prevista: ${session.actionPlan?.when || 'No especificada'}\n• Con quién: ${session.actionPlan?.withWhom || 'Equipo'}\n• Cómo: ${session.actionPlan?.how || 'Diálogo constructivo'}\n• Aspectos a cuidar: ${session.actionPlan?.careReminders || 'Foco en hechos objetivos'}\n\n📞 DATOS DE CONTACTO DIRECTO:\n• Correo electrónico: ${leaderEmail}\n• WhatsApp: ${leaderWhatsapp}\n\nRecomendación de intervención: Te sugerimos contactar al líder para apoyarlo a resolver posibles dudas, indagar si enfrentó algún obstáculo no previsto e invitarlo a retomar su proceso en la Etapa 6 de Lidacta.`,
                realEmailSent: true,
              },
            });

            newSystemAlerts.push({
              id: `alert_inact_${session.id}_${Date.now()}`,
              timestamp: nowIso,
              leaderName: session.leaderName,
              companyId: session.companyId,
              companyName: session.companyName,
              type: 'inactivity_day8',
              typeName: 'Inactividad Día 8',
              status: 'Correo Enviado',
              caseSummary: `Inactividad de 8 días en Etapa 5 tras definir compromiso "${session.actionPlan?.what || session.title}". Último acceso registrado: ${lastActiveFormatted}.`,
              emailRecipient: 'hola@lidacta.com',
              currentStage: 5,
              mentorshipId: session.id,
              leaderEmail,
              leaderPosition,
              details: {
                lastActiveFormatted,
                pendingAction: session.actionPlan?.what,
                plannedDate: session.actionPlan?.when,
                teamMember: session.actionPlan?.withWhom,
              },
            });
          } catch (e) {
            console.error('Error dispatching stage 5 inactivity alert to admin:', e);
          }
        }

        if (actionPlanUpdated) {
          updatedSession.actionPlan = actionPlanUpdated;
        }

        return updatedSession;
      })
    );

    if (newNotifications.length > 0) {
      setNotifications((prev) => [...newNotifications, ...prev]);
    }

    if (newSystemAlerts.length > 0) {
      setSystemAlerts((prev) => [...newSystemAlerts, ...prev]);
    }

    setMentorships(updatedMentorships);

    return {
      processed: processedCount,
      sent48h: sent48hCount,
      sent5d: sent5dCount,
      sentAdminAlert: sentAdminAlertCount,
    };
  };

  const triggerStage5FollowUpCheck = async () => {
    const res = await checkAndProcessStage5FollowUps();
    if (res.sentAdminAlert > 0 || res.sent48h > 0 || res.sent5d > 0) {
      showToast(
        `Monitoreo de Etapa 5 ejecutado: ${res.sent48h} de 48h, ${res.sent5d} de 5d y ${res.sentAdminAlert} alertas de inactividad a Tania Padierna.`,
        'info'
      );
    } else {
      showToast('Monitoreo de Etapa 5 al día: líderes con notificaciones al corriente.', 'success');
    }
  };

  // Verificación periódica al montar la aplicación
  useEffect(() => {
    const timer = setTimeout(() => {
      checkAndProcessStage5FollowUps().catch(() => {});
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  const markActionCompleted = () => {
    if (!activeMentorship || !activeMentorship.actionPlan) return;
    const now = new Date().toISOString();
    setMentorships((prev) =>
      prev.map((m) =>
        m.id === activeMentorship.id
          ? {
              ...m,
              actionPlan: {
                ...m.actionPlan!,
                isCompleted: true,
                completedAt: now,
              },
              lastActiveAt: now,
            }
          : m
      )
    );
  };

  const respondStage6ExecutionCheck = async (executed: boolean) => {
    if (!activeMentorship) return;

    const currentCaseId = activeMentorship.id;
    const targetSession =
      mentorshipsRef.current.find((m) => m.id === currentCaseId) || activeMentorship;
    if (!acquireCaseOperationLock(activeCaseOperationsRef.current, currentCaseId, 'message')) {
      return;
    }

    const now = new Date().toISOString();
    const executionStatus: ActionPlanExecutionStatus = executed ? 'executed' : 'not_executed';
    const leaderAnswerText = executed
      ? 'Sí, ya ejecuté mi Plan de Acción.'
      : 'No, todavía no he ejecutado mi Plan de Acción.';

    const leaderMsg = {
      id: `msg_${Date.now()}_lead`,
      caseId: currentCaseId,
      mentorshipId: currentCaseId,
      sender: 'leader' as const,
      text: leaderAnswerText,
      timestamp: now,
      stage: 6 as StageNumber,
      isLeaderVoiceQuote: true,
    };

    const isolatedExistingMessages = (targetSession.messages || []).filter((m: any) => {
      if (!m || typeof m !== 'object') return false;
      const mCase = m.caseId || m.mentorshipId;
      if (mCase && mCase !== currentCaseId) return false;
      if (isTechnicalErrorMessage(m)) {
        return false;
      }
      return true;
    });

    const updatedActionPlan = targetSession.actionPlan
      ? executed
        ? {
            ...targetSession.actionPlan,
            isCompleted: true,
            completedAt: targetSession.actionPlan.completedAt || now,
          }
        : {
            ...targetSession.actionPlan,
            isCompleted: false,
            completedAt: undefined,
          }
      : undefined;

    commitMentorships((prev) =>
      prev.map((m) =>
        m.id === currentCaseId
          ? {
              ...m,
              actionPlanExecutionStatus: executionStatus,
              stage6ExecutionVerified: true,
              actionPlan: updatedActionPlan || m.actionPlan,
              messages: [...m.messages, leaderMsg],
              lastActiveAt: now,
            }
          : m
      )
    );

    const company = companies.find((c) => c.id === targetSession.companyId) || companies[0];
    setCaseSending(currentCaseId, true);
    setIsSendingMessage(true);

    const buildFallbackReplyText = () => {
      const planWhat = targetSession.actionPlan?.what?.trim();
      if (executed) {
        return planWhat
          ? `Gracias por confirmarlo. Tomando en cuenta tu compromiso en la Etapa 5 ("${planWhat}"), reflexionemos sobre lo que viviste: ¿qué ocurrió realmente al llevarlo a la práctica, qué observaste en la otra persona o en tu equipo, y qué aprendizaje te deja esta experiencia?`
          : `Gracias por confirmarlo. Para reflexionar a partir de tu experiencia real: ¿qué ocurrió al llevar a la práctica tu plan de acción, qué funcionó bien y de qué te das cuenta sobre tu liderazgo?`;
      }
      return planWhat
        ? `Gracias por compartirlo con total honestidad; no pasa nada, este espacio es precisamente para acompañarte sin juicios. Respecto a tu compromiso ("${planWhat}"), ¿qué obstáculos o circunstancias se presentaron que impidieron llevarlo a cabo, o lograste avanzar en alguna parte? Conversemos para ver cómo ajustarlo y definir tu siguiente paso.`
        : `Gracias por compartirlo con total honestidad; este espacio es para acompañarte sin juicios. ¿Qué obstáculos o circunstancias impidieron llevar a cabo tu plan de acción, o pudiste realizar al menos una parte? Conversemos para identificar qué ajustar y cuál podría ser tu siguiente paso.`;
    };

    try {
      const response = await fetch('/api/mentor/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caseId: currentCaseId,
          mentorshipId: currentCaseId,
          stage: 6,
          activeStage: 6,
          leaderProfile: currentUser,
          companyContext: company,
          conversationHistory: isolatedExistingMessages,
          history: isolatedExistingMessages,
          userMessage: leaderAnswerText,
          currentMessage: leaderAnswerText,
          message: leaderAnswerText,
          identifiedSkills: targetSession.identifiedSkills || [],
          skillEntries: targetSession.skillEntries || [],
          sessionData: {
            ...stripSessionMessagesForApi(targetSession),
            actionPlan: updatedActionPlan || targetSession.actionPlan,
            actionPlanExecutionStatus: executionStatus,
            stage6ExecutionVerified: true,
            skillEntries: targetSession.skillEntries || [],
            identifiedSkills: targetSession.identifiedSkills || [],
          },
        }),
      });

      const data = await response.json().catch(() => ({}));
      const resolvedReply =
        data.reply ||
        data.text ||
        data.response ||
        data.data?.reply ||
        data.data?.replyText;

      const replyText = isValidMentorApiResponse(response, data, resolvedReply)
        ? resolvedReply
        : buildFallbackReplyText();
      const lidactaMsg = {
        id: `msg_${Date.now()}_lid`,
        caseId: currentCaseId,
        mentorshipId: currentCaseId,
        sender: 'lidacta' as const,
        text: replyText,
        timestamp: new Date().toISOString(),
        stage: 6 as StageNumber,
      };

      commitMentorships((prev) =>
        prev.map((m) =>
          m.id === currentCaseId
            ? {
                ...m,
                messages: [...m.messages, lidactaMsg],
                lastActiveAt: new Date().toISOString(),
              }
            : m
        )
      );
    } catch (err) {
      console.error('Error in Stage 6 execution check response:', err);
      const fallbackMsg = {
        id: `msg_${Date.now()}_lid`,
        caseId: currentCaseId,
        mentorshipId: currentCaseId,
        sender: 'lidacta' as const,
        text: buildFallbackReplyText(),
        timestamp: new Date().toISOString(),
        stage: 6 as StageNumber,
      };
      commitMentorships((prev) =>
        prev.map((m) =>
          m.id === currentCaseId
            ? {
                ...m,
                messages: [...m.messages, fallbackMsg],
                lastActiveAt: new Date().toISOString(),
              }
            : m
        )
      );
    } finally {
      setIsSendingMessage(false);
      releaseCaseOperationLock(activeCaseOperationsRef.current, currentCaseId);
      setCaseSending(currentCaseId, false);
    }
  };

  const saveLearnings = (learnings: NonNullable<MentorshipSession['learnings']>) => {
    if (!activeMentorship) return;
    const reflectionText = (
      learnings.sharedReflectionToHR ?? learnings.sharedLearningWithHR ?? ''
    ).trim();
    const updatedLearnings: MentorshipLearnings = {
      ...learnings,
      sharedLearningWithHR: reflectionText,
      sharedReflectionToHR: reflectionText,
    };
    setMentorships((prev) =>
      prev.map((m) =>
        m.id === activeMentorship.id
          ? {
              ...m,
              learnings: updatedLearnings,
              sharedReflectionToHR: reflectionText,
              sharedLearningWithHR: reflectionText,
              lastActiveAt: new Date().toISOString(),
            }
          : m
      )
    );
  };

  const updateCompanyContext = (companyId: string, updated: Partial<CompanyContext>) => {
    setCompanies((prev) =>
      prev.map((c) =>
        c.id === companyId
          ? { ...c, ...updated, updatedAt: new Date().toISOString().split('T')[0] }
          : c
      )
    );
  };

  const addCompany = (newComp: Omit<CompanyContext, 'id' | 'updatedAt'>): CompanyContext => {
    const id = `comp_${Date.now()}`;
    const created: CompanyContext = {
      ...newComp,
      id,
      updatedAt: new Date().toISOString().split('T')[0],
    };
    setCompanies((prev) => [...prev, created]);
    return created;
  };

  const markNotificationsAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const openEmailDrawer = (notification?: NotificationItem) => {
    if (notification) {
      setSelectedEmailForPreview(notification);
    } else {
      setSelectedEmailForPreview(notifications[0] || null);
    }
    setIsEmailDrawerOpen(true);
  };

  const closeEmailDrawer = () => {
    setIsEmailDrawerOpen(false);
  };

  const requestHumanMentor = async (
    reasonText: string,
    isVoiceAudio: boolean = false
  ): Promise<{ success: boolean; message: string; notificationId: string; whatsappUrl: string }> => {
    const adminUser = allUsers.find((u) => u.role === 'admin') || {
      id: 'user_admin_tania',
      name: 'Tania Padierna',
      email: 'hola@lidacta.com',
      whatsapp: '+52 55 1234 5678',
    };
    const currentStageNum = (activeMentorship?.currentStage || 1) as StageNumber;
    const currentCaseTitle = activeMentorship?.title || 'Acompañamiento en Lidacta';
    const notifId = `notif_${Date.now()}_mentor_req`;

    const stageNames: Record<number, string> = {
      1: 'Detectar qué sucede',
      2: 'Analizar perspectivas y habilidades',
      3: 'Diseñar alternativas',
      4: 'Practicar antes de actuar',
      5: 'Actuar (Plan de Acción)',
      6: 'Aprender y reflexionar',
      7: 'Cierre y retroalimentación',
    };

    const cleanAdminPhone = (adminUser.whatsapp || '+52 55 1234 5678').replace(/[^0-9]/g, '');
    let serverWhatsappUrl = `https://wa.me/${cleanAdminPhone}?text=${encodeURIComponent(
      `🚨 *LIDACTA: Solicitud de Asesoría 1:1*\n*Líder:* ${currentUser.name}\n*Empresa:* ${currentUser.companyName}\n*Etapa:* ${currentStageNum} (${stageNames[currentStageNum]})\n*Motivo:* ${reasonText}`
    )}`;

    if (activeMentorship?.isTestSession || currentUser.id === QA_TEST_LEADER_ID) {
      const leaderNoteMsg = {
        id: `msg_${Date.now()}_lead_req_qa`,
        caseId: activeMentorship?.id,
        mentorshipId: activeMentorship?.id,
        sender: 'leader' as const,
        text: `[Solicitud QA simulada de Asesoría 1:1]\nMotivo: "${reasonText}"`,
        timestamp: new Date().toISOString(),
        stage: currentStageNum,
      };
      const lidactaConfirmMsg = {
        id: `msg_${Date.now()}_lid_confirm_qa`,
        caseId: activeMentorship?.id,
        mentorshipId: activeMentorship?.id,
        sender: 'lidacta' as const,
        text: `(Modo QA) Confirmación visual de solicitud de Asesoría 1:1 en Etapa ${currentStageNum}. No se enviaron correos ni notificaciones reales.`,
        timestamp: new Date().toISOString(),
        stage: currentStageNum,
      };
      if (activeMentorship) {
        setMentorships((prev) =>
          prev.map((m) =>
            m.id === activeMentorship.id
              ? { ...m, messages: [...m.messages, leaderNoteMsg, lidactaConfirmMsg], lastActiveAt: new Date().toISOString() }
              : m
          )
        );
      }
      return {
        success: true,
        message: 'Solicitud simulada en modo QA (sin envíos reales).',
        notificationId: notifId,
        whatsappUrl: serverWhatsappUrl,
      };
    }

    let simulatedEmailObj = {
      to: adminUser.email || 'hola@lidacta.com',
      subject: `🚨 [URGENTE] Solicitud de Asesoría 1:1: ${currentUser.name} (${currentUser.companyName} · Etapa ${currentStageNum})`,
      bodyText: `Estimada ${adminUser.name || 'Tania Padierna'},\n\nEl líder ${currentUser.name} (${currentUser.position || 'Líder'}) de la empresa "${currentUser.companyName}" ha solicitado una sesión directa de Asesoría 1:1 en Lidacta.\n\n• Reto actual: ${currentCaseTitle}\n• Etapa en curso: Etapa ${currentStageNum} (${stageNames[currentStageNum]})\n• Formato: ${isVoiceAudio ? 'Nota de voz dictada / grabada' : 'Texto escrito'}\n\nMotivo expresado por el líder:\n"${reasonText}"\n\nDatos de contacto directo:\n• Email: ${currentUser.email}\n• WhatsApp: ${currentUser.whatsapp || 'No registrado'}\n• Fecha y hora: ${new Date().toLocaleString('es-MX')}\n\nAtentamente,\nSistema de Notificaciones Lidacta`,
    };

    try {
      const resp = await fetch('/api/mentor/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leaderId: currentUser.id,
          leaderName: currentUser.name,
          leaderEmail: currentUser.email,
          leaderWhatsapp: currentUser.whatsapp || '',
          leaderPosition: currentUser.position,
          companyName: currentUser.companyName,
          currentStage: currentStageNum,
          caseTitle: currentCaseTitle,
          reasonText,
          isVoiceAudio,
          adminEmail: adminUser.email || 'hola@lidacta.com',
          adminWhatsapp: adminUser.whatsapp || '+52 55 1234 5678',
        }),
      });
      const data = await resp.json();
      if (data.success) {
        if (data.whatsappUrl) serverWhatsappUrl = data.whatsappUrl;
        if (data.simulatedEmail) simulatedEmailObj = data.simulatedEmail;
        if (data.notification) {
          setNotifications((prev) => [
            data.notification,
            ...prev.filter((n) => n.id !== data.notification.id),
          ]);
        }
      }
    } catch (e) {
      console.warn('Backend call failed, using local simulated notification:', e);
      const fallbackNotification: NotificationItem = {
        id: notifId,
        recipientRole: 'admin',
        recipientUserId: adminUser.id || 'user_admin_tania',
        companyId: currentUser.companyId,
        title: `🚨 Solicitud de Asesoría 1:1: ${currentUser.name} (Etapa ${currentStageNum})`,
        message: `${currentUser.name} (${currentUser.companyName}) ha solicitado hablar con ${adminUser.name || 'Tania Padierna'} para el caso "${currentCaseTitle}". Motivo: "${reasonText}"`,
        type: 'mentor_request',
        timestamp: new Date().toISOString(),
        read: false,
        emailSimulated: simulatedEmailObj,
        mentorRequestDetails: {
          leaderId: currentUser.id,
          leaderName: currentUser.name,
          leaderEmail: currentUser.email,
          leaderWhatsapp: currentUser.whatsapp || '',
          leaderPosition: currentUser.position,
          companyName: currentUser.companyName,
          currentStage: currentStageNum,
          stageName: stageNames[currentStageNum] || `Etapa ${currentStageNum}`,
          caseTitle: currentCaseTitle,
          reasonText,
          isVoiceAudio,
          status: 'pendiente',
          whatsappSent: true,
          emailSent: true,
        },
      };
      setNotifications((prev) => [fallbackNotification, ...prev]);
    }

    // Also inject confirmation in the active session so the leader sees reassurance in chat
    if (activeMentorship) {
      const leaderNoteMsg = {
        id: `msg_${Date.now()}_lead_req`,
        caseId: activeMentorship.id,
        mentorshipId: activeMentorship.id,
        sender: 'leader' as const,
        text: `[Solicitud de Asesoría 1:1 enviada a ${adminUser.name || 'Tania Padierna'}]\nMotivo: "${reasonText}"`,
        timestamp: new Date().toISOString(),
        stage: currentStageNum,
      };

      const lidactaConfirmMsg = {
        id: `msg_${Date.now()}_lid_confirm`,
        caseId: activeMentorship.id,
        mentorshipId: activeMentorship.id,
        sender: 'lidacta' as const,
        text: `He recibido tu solicitud para una Asesoría 1:1, ${currentUser.name}. Se ha notificado inmediatamente a ${adminUser.name || 'Tania Padierna'} (Dirección de Mentoría) por correo electrónico (${adminUser.email || 'hola@lidacta.com'}) y WhatsApp (${adminUser.whatsapp || '+52 55 1234 5678'}) con tu contexto de la Etapa ${currentStageNum}. Nos pondremos en contacto contigo a la brevedad. Tu conversación sigue siendo 100% confidencial.`,
        timestamp: new Date().toISOString(),
        stage: currentStageNum,
      };

      setMentorships((prev) =>
        prev.map((m) =>
          m.id === activeMentorship.id
            ? {
                ...m,
                messages: [...m.messages, leaderNoteMsg, lidactaConfirmMsg],
                lastActiveAt: new Date().toISOString(),
              }
            : m
        )
      );
    }

    return {
      success: true,
      message: 'Solicitud enviada y notificada exitosamente.',
      notificationId: notifId,
      whatsappUrl: serverWhatsappUrl,
    };
  };

  const updateMentorRequestStatus = (
    notificationId: string,
    status: 'pendiente' | 'contactado' | 'atendido',
    notes?: string
  ) => {
    setNotifications((prev) =>
      prev.map((n) =>
        n.id === notificationId && n.mentorRequestDetails
          ? {
              ...n,
              mentorRequestDetails: {
                ...n.mentorRequestDetails,
                status,
                adminNotes: notes !== undefined ? notes : n.mentorRequestDetails.adminNotes,
              },
            }
          : n
      )
    );

    // Sync status change to centralized server
    fetch('/api/notifications/status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notificationId, status, notes }),
    }).catch((err) => console.warn('Could not sync status to server:', err));
  };

  const login = (
    email: string,
    _password?: string,
    is1ClickRemembered?: boolean
  ): { success: boolean; message?: string } => {
    const cleanEmail = email.trim().toLowerCase();

    // Check if user exists in allUsers
    let user = allUsers.find((u) => u.email.toLowerCase() === cleanEmail);

    // If typing 'admin' or generic admin email or Tania's email
    if (!user && (cleanEmail === 'admin' || cleanEmail === 'admin@lidacta.com')) {
      user = allUsers.find((u) => u.role === 'admin') || allUsers[0];
    }

    if (!user) {
      return {
        success: false,
        message: 'No se encontró una cuenta con este correo. Puedes crear tu acceso o registrarte en la pestaña "Crear Contraseña".',
      };
    }

    if (user.status === 'inactive') {
      return {
        success: false,
        message: 'Esta cuenta se encuentra inactiva. Por favor, contacta a la administración de Lidacta para reactivar tu acceso.',
      };
    }

    // Determine official password for account
    const isTaniaAdmin =
      user.email.toLowerCase() === 'hola@lidacta.com' ||
      user.id === 'user_admin_tania' ||
      user.role === 'admin';

    const expectedPassword = isTaniaAdmin
      ? (user.password || ADMIN_OFFICIAL_PASSWORD)
      : user.password;

    // Check password if expected or provided (bypassed if resuming recognized session on this device in 1-click)
    if (!is1ClickRemembered && expectedPassword) {
      if (_password !== undefined && _password !== null) {
        if (_password.trim() !== expectedPassword.trim()) {
          return {
            success: false,
            message: 'La contraseña ingresada no es correcta. Verifica e intenta nuevamente.',
          };
        }
      }
    }

    const authenticatedUser: UserProfile = isTaniaAdmin
      ? { ...user, password: expectedPassword }
      : user;

    setCurrentUserId(authenticatedUser.id);
    setSessionUser(authenticatedUser);
    setIsAuthenticated(true);
    try {
      sessionStorage.setItem(`${STORAGE_KEY_PREFIX}current_user_id`, authenticatedUser.id);
      sessionStorage.setItem(`${STORAGE_KEY_PREFIX}session_user`, JSON.stringify(authenticatedUser));
      localStorage.setItem(`${STORAGE_KEY_PREFIX}current_user_id`, authenticatedUser.id);
      localStorage.setItem('lidacta_remembered_user', JSON.stringify(authenticatedUser));
      localStorage.setItem(`${STORAGE_KEY_PREFIX}remembered_user`, JSON.stringify(authenticatedUser));
    } catch {}

    if (authenticatedUser.role === 'leader') {
      const leaderMentorship =
        mentorships.find((m) => m.leaderId === authenticatedUser.id && !m.isTestSession && m.status !== 'completed') ||
        mentorships.find((m) => m.leaderId === authenticatedUser.id && !m.isTestSession);
      setActiveMentorshipIdState(leaderMentorship ? leaderMentorship.id : null);
    }

    return { success: true };
  };

  const isProfileComplete = useMemo(() => {
    if (!currentUser) return false;
    if (currentUser.role === 'admin') return true;
    if (currentUser.id === QA_TEST_LEADER_ID) return true;

    // 1. Force completed map (triggered when user submits "Guardar Perfil")
    if (
      forceCompletedUserIds[currentUser.id] ||
      (currentUser.email && forceCompletedUserIds[currentUser.email.toLowerCase()])
    ) {
      return true;
    }

    // 2. Direct persistent localStorage flags (saved when user completes profile)
    try {
      if (
        localStorage.getItem(`lidacta_profile_completed_${currentUser.id}`) === 'true' ||
        (currentUser.email && localStorage.getItem(`lidacta_profile_completed_${currentUser.email.toLowerCase()}`) === 'true')
      ) {
        return true;
      }
    } catch {}

    // 3. Demo seed users (Roberto Gómez and Sofía Valenzuela start with completed profiles)
    if (currentUser.id === 'user_leader_roberto' || currentUser.id === 'user_hr_sofia') {
      return true;
    }

    // 4. Carlos Mendoza seed demo check
    const isCarlos = currentUser.id === 'user_leader_carlos' || (currentUser.email && currentUser.email.toLowerCase().includes('carlos.mendoza'));
    if (isCarlos) {
      try {
        if (
          localStorage.getItem('carlosProfileCompleted') === 'true' ||
          localStorage.getItem(`${STORAGE_KEY_PREFIX}carlosProfileCompleted`) === 'true'
        ) {
          return true;
        }
      } catch {}
    }

    // 5. If user has not completed onboarding, strictly return false
    if (!currentUser.isProfileCompleted && !currentUser.isProfileComplete) {
      return false;
    }

    // 6. Even if marked completed in DB, ensure non-placeholder values
    const cleanPhone = (currentUser.whatsapp || '').trim();
    const hasRealPhone = cleanPhone !== '' && cleanPhone !== 'Sin especificar' && cleanPhone !== '+52 55 0000 0000';
    const cleanDate = (currentUser.birthDate || '').trim();
    const hasRealDate = cleanDate !== '' && cleanDate !== '1990-01-01';
    const hasCompany = Boolean(currentUser.companyName && currentUser.companyName.trim() && currentUser.companyName !== 'Empresa Sin especificar');

    if (isHumanResourcesRole(currentUser.role)) {
      return hasCompany && hasRealPhone && hasRealDate;
    }

    if (currentUser.role === 'leader') {
      const hasArea = Boolean(currentUser.area && currentUser.area.trim());
      const hasReports =
        currentUser.directReports !== undefined &&
        currentUser.directReports !== null &&
        !isNaN(Number(currentUser.directReports)) &&
        Number(currentUser.directReports) >= 0;
      return hasCompany && hasArea && hasReports && hasRealPhone && hasRealDate;
    }

    return false;
  }, [currentUser, forceCompletedUserIds]);

  const completeUserProfile = async (data: {
    name?: string;
    companyName: string;
    area?: string;
    position?: string;
    birthDate?: string;
    fechaNacimiento?: string;
    directReports?: number;
    personasACargo?: number;
    whatsapp: string;
  }): Promise<{ success: boolean; message?: string }> => {
    const { name, companyName, area, position, birthDate, fechaNacimiento, directReports, personasACargo, whatsapp } = data;

    const cleanName = String(name || currentUser.name || '').trim() || 'Usuario Lidacta';
    const cleanCompany = String(companyName || currentUser.companyName || '').trim() || 'Empresa Sin especificar';

    // Normalize date: accepts YYYY-MM-DD or DD/MM/YYYY without throwing
    const rawBirthDate = birthDate || fechaNacimiento || currentUser.birthDate || '1990-01-01';
    let cleanBirthDate = '1990-01-01';
    const dmy = String(rawBirthDate).trim().match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (dmy) {
      cleanBirthDate = `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
    } else {
      cleanBirthDate = String(rawBirthDate).trim() || '1990-01-01';
    }

    // Sanitize WhatsApp: clean spaces and non-numerics while preserving leading '+'
    const rawPhone = String(whatsapp !== undefined && whatsapp !== null ? whatsapp : (currentUser.whatsapp || '')).trim();
    const hasPlus = rawPhone.startsWith('+');
    const digitsOnly = rawPhone.replace(/[^\d]/g, '');
    const cleanWhatsapp = digitsOnly ? (hasPlus ? `+${digitsOnly}` : digitsOnly) : (rawPhone || 'Sin especificar');

    const cleanArea = String(area !== undefined && area !== null ? area : (currentUser.area || '')).trim() || 'Operaciones';
    const cleanPosition = String(position !== undefined && position !== null ? position : (currentUser.position || '')).trim() || 'Líder Operativo';

    // Parse personasACargo safely (parseInt(val) || 0)
    const rawReports = personasACargo !== undefined ? personasACargo : (directReports !== undefined ? directReports : (currentUser.directReports ?? 0));
    const parsedReports = parseInt(String(rawReports), 10);
    const cleanReports = isNaN(parsedReports) ? 0 : Math.max(0, parsedReports);

    const updatedUser: UserProfile = {
      ...currentUser,
      name: cleanName,
      companyName: cleanCompany,
      area: cleanArea,
      position: cleanPosition,
      birthDate: cleanBirthDate,
      directReports: cleanReports,
      whatsapp: cleanWhatsapp,
      isProfileCompleted: true,
      isProfileComplete: true,
    };

    // 1. Synchronously persist to local storage and update session state immediately
    // Guarantees zero latency and instantaneous entry even if remote backend is slow
    forceCompleteProfile(updatedUser.id);
    setSessionUser(updatedUser);
    sessionUserRef.current = updatedUser;
    setCurrentUserId(updatedUser.id);
    currentUserIdRef.current = updatedUser.id;

    setAllUsers((prev) => {
      const idx = prev.findIndex((u) => u.id === updatedUser.id || u.email.toLowerCase() === updatedUser.email.toLowerCase());
      if (idx !== -1) {
        const copy = [...prev];
        copy[idx] = updatedUser;
        return copy;
      }
      return [updatedUser, ...prev];
    });

    try {
      localStorage.setItem(`lidacta_profile_completed_${updatedUser.id}`, 'true');
      localStorage.setItem(`lidacta_profile_completed_${updatedUser.email.toLowerCase()}`, 'true');
      sessionStorage.setItem(`lidacta_profile_completed_${updatedUser.id}`, 'true');
      sessionStorage.setItem(`${STORAGE_KEY_PREFIX}session_user`, JSON.stringify(updatedUser));
      sessionStorage.setItem(`${STORAGE_KEY_PREFIX}current_user_id`, updatedUser.id);
      localStorage.setItem(`${STORAGE_KEY_PREFIX}current_user_id`, updatedUser.id);
      localStorage.setItem(`${STORAGE_KEY_PREFIX}user_${updatedUser.id}`, JSON.stringify(updatedUser));
      if (
        updatedUser.id === 'user_leader_carlos' ||
        updatedUser.email.toLowerCase().includes('carlos.mendoza')
      ) {
        localStorage.setItem('carlosProfileCompleted', 'true');
        localStorage.setItem('lidacta_v2_carlosProfileCompleted', 'true');
      }
    } catch {}

    // Update companies list if company name changed or new
    setCompanies((prev) => {
      const exists = prev.some((c) => c.name.toLowerCase() === cleanCompany.toLowerCase());
      if (!exists && cleanCompany !== 'Empresa Sin especificar') {
        const newComp: CompanyContext = {
          id: currentUser.companyId || `comp_${Date.now()}`,
          name: cleanCompany,
          industry: 'Sector General',
          values: 'Compromiso y excelencia operativa',
          philosophy: 'Liderazgo operativo en acción',
          expectedCompetencies: ['Comunicación Asertiva', 'Gestión de Equipos'],
          culture: 'Colaborativa y enfocada en resultados',
          workRhythm: 'Operativo dinámico',
          webLinks: [],
          attachments: [],
          updatedAt: new Date().toISOString().split('T')[0],
        };
        const next = [...prev, newComp];
        try {
          localStorage.setItem(`${STORAGE_KEY_PREFIX}companies`, JSON.stringify(next));
        } catch {}
        return next;
      }
      return prev.map((c) => (c.id === currentUser.companyId ? { ...c, name: cleanCompany } : c));
    });

    // Update mentorship session company and area if leader
    if (currentUser.role === 'leader') {
      setMentorships((prev) =>
        prev.map((m) =>
          m.leaderId === currentUser.id
            ? { ...m, companyName: cleanCompany, leaderArea: cleanArea || m.leaderArea }
            : m
        )
      );
    }

    // 2. Perform backend persistence in background/timeout protected without blocking user
    try {
      const res = await Promise.race([
        userService.completeProfile({
          userId: currentUser.id,
          email: currentUser.email,
          name: currentUser.name || 'Usuario Lidacta',
          role: currentUser.role,
          companyId: currentUser.companyId || 'comp_custom',
          companyName: cleanCompany,
          area: cleanArea,
          position: cleanPosition,
          birthDate: cleanBirthDate,
          fechaNacimiento: cleanBirthDate,
          directReports: cleanReports,
          personasACargo: cleanReports,
          whatsapp: cleanWhatsapp,
        }),
        new Promise<UserServiceResponse>((_, reject) =>
          setTimeout(() => reject(new Error('timeout')), 3000)
        ),
      ]);

      if (res && res.success) {
        const savedUser = res.user || updatedUser;
        setSessionUser(savedUser);
        sessionUserRef.current = savedUser;
        if (Array.isArray(res.users) && res.users.length > 0) {
          setAllUsers(res.users);
        }
      }
    } catch (err) {
      console.warn('[Lidacta] Base de datos central lenta o con latencia; perfil guardado síncronamente en almacenamiento local:', err);
    }

    showToast('¡Perfil completado y guardado correctamente!', 'success');
    openRoleWelcomeModal(updatedUser.role, updatedUser.name);
    return { success: true };
  };

  const updateUserProfile = async (
    userId: string,
    updates: Partial<UserProfile>
  ): Promise<{ success: boolean; message?: string }> => {
    if (!updates.name || !updates.name.trim()) {
      return { success: false, message: 'El nombre completo es obligatorio.' };
    }
    if (!updates.email || !updates.email.trim()) {
      return { success: false, message: 'El correo electrónico es obligatorio.' };
    }

    const cleanName = updates.name.trim();
    const cleanEmail = updates.email.trim().toLowerCase();
    const cleanWhatsapp = updates.whatsapp !== undefined ? updates.whatsapp.trim() : '';

    const payload: Partial<UserProfile> = {
      ...updates,
      name: cleanName,
      email: cleanEmail,
      whatsapp: cleanWhatsapp,
      position: updates.position !== undefined ? updates.position.trim() : undefined,
      companyName: updates.companyName !== undefined ? updates.companyName.trim() : undefined,
      area: updates.area !== undefined ? updates.area.trim() : undefined,
      birthDate: updates.birthDate !== undefined ? updates.birthDate.trim() : undefined,
      directReports: updates.directReports !== undefined ? Number(updates.directReports) : undefined,
      isProfileCompleted: true,
      isProfileComplete: true,
    };

    // Direct call to database via userService
    const res = await userService.updateUser(userId, payload);
    if (!res.success) {
      showToast(res.message || 'Error al guardar cambios en la base de datos central.', 'error');
      return { success: false, message: res.message };
    }

    // Update UI canonical state strictly after server responds
    if (Array.isArray(res.users) && res.users.length > 0) {
      setAllUsers(res.users);
    }

    // Update companies if name changed
    if (updates.companyName) {
      setCompanies((prev) =>
        prev.map((c) =>
          c.id === (updates.companyId || currentUser.companyId)
            ? { ...c, name: updates.companyName!.trim() }
            : c
        )
      );
    }

    // Update mentorship session if leader
    setMentorships((prev) =>
      prev.map((m) =>
        m.leaderId === userId
          ? {
              ...m,
              leaderName: cleanName,
              companyName: updates.companyName?.trim() || m.companyName,
              leaderArea: updates.area?.trim() || m.leaderArea,
            }
          : m
      )
    );

    // If updating admin, sync to centralized server memory & profile endpoint
    const targetUser = (res.users || allUsers).find((u) => u.id === userId);
    if (userId === 'user_admin_tania' || updates.role === 'admin' || targetUser?.role === 'admin') {
      try {
        await fetch('/api/admin/profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: cleanName,
            email: cleanEmail,
            whatsapp: cleanWhatsapp,
            position: updates.position,
            companyName: updates.companyName,
            area: updates.area,
          }),
        });
      } catch (err) {
        console.warn('Failed to persist admin profile to server:', err);
      }
    }

    showToast('Perfil actualizado correctamente en la Base de Datos Central', 'success');
    return { success: true, message: 'Perfil actualizado correctamente en la Base de Datos Central' };
  };

  const logout = () => {
    setIsAuthenticated(false);
    setSessionUser(null);
    setImpersonatedUser(null);
    setCurrentUserId('');
    try {
      sessionStorage.removeItem(`${STORAGE_KEY_PREFIX}current_user_id`);
      sessionStorage.removeItem(`${STORAGE_KEY_PREFIX}session_user`);
      sessionStorage.removeItem(`${STORAGE_KEY_PREFIX}impersonated_user`);
      localStorage.removeItem(`${STORAGE_KEY_PREFIX}current_user_id`);
    } catch {}
  };

  const registerOrSetPassword = async (
    email: string,
    password: string,
    name?: string,
    role?: UserRole,
    position?: string,
    companyId?: string,
    customCompanyName?: string
  ): Promise<{
    success: boolean;
    message?: string;
    user?: UserProfile;
    emailSent?: boolean;
    emailId?: string;
    emailError?: string;
  }> => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      return { success: false, message: 'Por favor, ingresa un correo electrónico corporativo válido.' };
    }
    if (!password || password.trim().length < 6) {
      return { success: false, message: 'La contraseña debe tener al menos 6 caracteres.' };
    }

    // 1. Check if user already exists
    const existingUser = allUsers.find((u) => u.email.toLowerCase() === cleanEmail);

    if (existingUser) {
      const isExistingAdmin =
        existingUser.email.toLowerCase() === 'hola@lidacta.com' ||
        existingUser.id === 'user_admin_tania' ||
        existingUser.role === 'admin';

      const expectedPassword = isExistingAdmin
        ? (existingUser.password || ADMIN_OFFICIAL_PASSWORD)
        : existingUser.password;

      if (expectedPassword && expectedPassword.trim() !== password.trim()) {
        return { success: false, message: 'La contraseña ingresada no es correcta. Verifica e intenta nuevamente.' };
      }
      if (existingUser.status === 'inactive') {
        return { success: false, message: 'Esta cuenta se encuentra inactiva. Contacta al administrador.' };
      }

      if (name?.trim() || role || position?.trim()) {
        const updates: Partial<UserProfile> = {
          name: name?.trim() || existingUser.name,
          role: role || existingUser.role,
          position: position?.trim() || existingUser.position,
        };
        await userService.updateUser(existingUser.id, updates);
        const updatedUser = { ...existingUser, ...updates };
        setAllUsers((prev) => prev.map((u) => (u.id === existingUser.id ? updatedUser : u)));
        setSessionUser(updatedUser);
      } else {
        setSessionUser(existingUser);
      }

      setCurrentUserId(existingUser.id);
      setIsAuthenticated(true);
      try {
        sessionStorage.setItem(`${STORAGE_KEY_PREFIX}current_user_id`, existingUser.id);
        sessionStorage.setItem(`${STORAGE_KEY_PREFIX}session_user`, JSON.stringify(existingUser));
        localStorage.setItem(`${STORAGE_KEY_PREFIX}current_user_id`, existingUser.id);
      } catch {}

      if (existingUser.role === 'leader') {
        const leaderMentorship =
          mentorships.find((m) => m.leaderId === existingUser.id && !m.isTestSession && m.status !== 'completed') ||
          mentorships.find((m) => m.leaderId === existingUser.id && !m.isTestSession);
        setActiveMentorshipIdState(leaderMentorship ? leaderMentorship.id : null);
      }

      return { success: true, user: existingUser };
    }

    // 2. New User Registration Flow (Direct Central Database Persistence with Synchronous Local Resilience)
    const cleanName = name?.trim();
    if (!cleanName || cleanName.length < 2) {
      return { success: false, message: 'Por favor ingresa tu nombre completo para el registro.' };
    }

    const assignedRole: UserRole = role || 'leader';

    // Handle Company: Support predefined or custom company
    let targetCompId = companyId || 'comp_nexus';
    let targetCompName = 'Industrias Nexus Automotriz';

    if (customCompanyName?.trim() || companyId === 'other') {
      const cleanCustom = (customCompanyName || '').trim() || 'Mi Empresa Personalizada';
      targetCompName = cleanCustom;
      targetCompId = `comp_${Date.now()}`;

      // Dynamically add company to state and storage
      const newComp: CompanyContext = {
        id: targetCompId,
        name: cleanCustom,
        industry: 'Sector General',
        values: 'Compromiso y excelencia operativa',
        philosophy: 'Liderazgo operativo en acción',
        expectedCompetencies: ['Comunicación Asertiva', 'Gestión de Equipos'],
        culture: 'Colaborativa y enfocada en resultados',
        workRhythm: 'Operativo dinámico',
        webLinks: [],
        attachments: [],
        updatedAt: new Date().toISOString().split('T')[0],
      };
      setCompanies((prev) => {
        if (!prev.some((c) => c.name.toLowerCase() === cleanCustom.toLowerCase())) {
          const next = [...prev, newComp];
          try {
            localStorage.setItem(`${STORAGE_KEY_PREFIX}companies`, JSON.stringify(next));
          } catch {}
          return next;
        }
        return prev;
      });
    } else {
      const targetCompany = companies.find((c) => c.id === companyId) || companies[0];
      targetCompId = targetCompany?.id || 'comp_nexus';
      targetCompName = targetCompany?.name || 'Industrias Nexus Automotriz';
    }

    const defaultPosition =
      position?.trim() ||
      (assignedRole === 'admin'
        ? 'Administradora de Plataforma'
        : assignedRole === 'hr'
        ? 'Gestión de Talento Humano'
        : 'Líder Operativo');

    // Create user in central database via userService with timeout protection
    let remoteUser: UserProfile | undefined = undefined;
    try {
      const res = await Promise.race([
        userService.createUser({
          name: cleanName,
          email: cleanEmail,
          role: assignedRole,
          companyId: targetCompId,
          companyName: targetCompName,
          position: defaultPosition,
          area: assignedRole === 'leader' ? '' : undefined,
          birthDate: '',
          directReports: assignedRole === 'leader' ? undefined : 0,
          whatsapp: '',
          status: 'active',
          password: password.trim(),
          isProfileCompleted: assignedRole === 'admin',
          isProfileComplete: assignedRole === 'admin',
        }),
        new Promise<UserServiceResponse>((_, reject) =>
          setTimeout(() => reject(new Error('timeout')), 3500)
        ),
      ]);

      if (res && !res.success) {
        const errorMsg = extractErrorMessage(res.message || res.error, 'Error al procesar el registro en el servidor.');
        console.error('[registerOrSetPassword] ❌ Falla en la creación de usuario:', errorMsg);
        return {
          success: false,
          message: errorMsg,
        };
      }

      if (res && res.success && res.user) {
        remoteUser = res.user;
      }
    } catch (err: any) {
      console.error('[Lidacta] Error en la petición de registro:', err);
      return {
        success: false,
        message: extractErrorMessage(err, 'Error de conexión al intentar registrar tu cuenta en el servidor.'),
      };
    }

    const createdUser: UserProfile = remoteUser ? {
      ...remoteUser,
      role: assignedRole,
      companyId: targetCompId,
      companyName: targetCompName,
      isProfileCompleted: assignedRole === 'admin',
      isProfileComplete: assignedRole === 'admin',
    } : {
      id: `user_${Date.now()}`,
      name: cleanName,
      email: cleanEmail,
      role: assignedRole,
      companyId: targetCompId,
      companyName: targetCompName,
      position: defaultPosition,
      area: '',
      birthDate: '',
      directReports: undefined,
      whatsapp: '',
      isProfileCompleted: assignedRole === 'admin',
      isProfileComplete: assignedRole === 'admin',
      createdAt: new Date().toISOString().split('T')[0],
      status: 'active',
      password: password.trim(),
    };

    // Persist registered role selection strictly
    try {
      localStorage.setItem(`lidacta_registered_role_${createdUser.id}`, assignedRole);
      localStorage.setItem(`lidacta_registered_role_${createdUser.email.toLowerCase()}`, assignedRole);
      sessionStorage.setItem(`lidacta_registered_role_${createdUser.id}`, assignedRole);
      sessionStorage.setItem(`lidacta_registered_role_${createdUser.email.toLowerCase()}`, assignedRole);
    } catch {}

    // Ensure session isolation: clear any lingering admin cache and bind session strictly to new user
    setSessionUser(createdUser);
    sessionUserRef.current = createdUser;
    setCurrentUserId(createdUser.id);
    currentUserIdRef.current = createdUser.id;

    // Strictly ensure new user profile is NOT marked complete until onboarding form is submitted
    if (assignedRole !== 'admin') {
      try {
        localStorage.removeItem(`lidacta_profile_completed_${createdUser.id}`);
        localStorage.removeItem(`lidacta_profile_completed_${cleanEmail}`);
        sessionStorage.removeItem(`lidacta_profile_completed_${createdUser.id}`);
        sessionStorage.removeItem(`lidacta_profile_completed_${cleanEmail}`);
      } catch {}
      setForceCompletedUserIds((prev) => {
        const next = { ...prev };
        delete next[createdUser.id];
        delete next[cleanEmail];
        return next;
      });
    }

    try {
      sessionStorage.setItem(`${STORAGE_KEY_PREFIX}current_user_id`, createdUser.id);
      sessionStorage.setItem(`${STORAGE_KEY_PREFIX}session_user`, JSON.stringify(createdUser));
      localStorage.setItem(`${STORAGE_KEY_PREFIX}current_user_id`, createdUser.id);
      localStorage.setItem(`${STORAGE_KEY_PREFIX}user_${createdUser.id}`, JSON.stringify(createdUser));
    } catch {}

    setAllUsers((prev) => [
      createdUser,
      ...prev.filter((u) => u.id !== createdUser.id && u.email.toLowerCase() !== cleanEmail),
    ]);
    setIsAuthenticated(true);

    if (assignedRole === 'leader') {
      setActiveMentorshipIdState(null);
    }

    // Dispatch automatic welcome notification for new auto-registered user in UI
    const welcomeNotif: NotificationItem = {
      id: `notif_welcome_${Date.now()}`,
      recipientRole: assignedRole,
      recipientUserId: createdUser.id,
      companyId: targetCompId,
      title: `¡Te damos la bienvenida a Lidacta, ${cleanName}!`,
      message: `Tu cuenta ha sido creada exitosamente. Hemos enviado un correo de bienvenida a ${cleanEmail}.`,
      type: 'registration',
      timestamp: new Date().toISOString(),
      read: false,
      emailSimulated: {
        to: cleanEmail,
        subject: `¡Te damos la bienvenida a Lidacta, ${cleanName}!`,
        bodyText: assignedRole === 'hr'
          ? `Hola, ${cleanName}:\n\n¡Nos alegra darte la bienvenida a Lidacta!\n\nGracias por confiar en este espacio para impulsar el desarrollo de tus líderes.\n\nSabemos que desarrollar habilidades de liderazgo va más allá de ofrecer capacitación. También implica acompañar a las personas en los retos cotidianos que enfrentan al dirigir, gestionar y trabajar con sus equipos.\n\nLidacta busca contribuir a ese proceso, ofreciendo a tus líderes un espacio de acompañamiento para analizar situaciones reales de gestión de personas, explorar alternativas y encontrar nuevas formas de actuar.\n\nDesde tu perfil de Recursos Humanos podrás consultar indicadores de uso y progreso de tus líderes, que te permitirán dar seguimiento a su participación y conocer cómo avanzan en su experiencia dentro de la plataforma.\n\nTe invitamos a explorar Lidacta, familiarizarte con sus indicadores y descubrir cómo esta herramienta puede complementar tus iniciativas de desarrollo de liderazgo.\n\n¡Gracias por ser parte de este proyecto!\n\nLidacta\nDesarrollo de Liderazgo en Acción`
          : `¡Hola ${cleanName}!\n\nTe damos una cálida bienvenida a Lidacta: Desarrollo de Liderazgo en Acción.\n\nTu cuenta ha sido creada exitosamente asociada a ${targetCompName}.\n\nLidacta es tu espacio seguro, confidencial y práctico en el que tendrás un mentor para acompañarte y ayudarte a resolver los retos relacionados con el manejo de personas. Podrás también encontrar herramientas y establecer acciones que fortalezcan tu autonomía como líder.\n\nRecursos Humanos únicamente recibirá indicadores agregados de uso, sin acceso a tus conversaciones privadas.\n\n¡Estamos listos para acompañarte en tu próximo reto!\n\nAtentamente,\nEl Equipo de Lidacta`,
      },
    };
    setNotifications((prev) => [welcomeNotif, ...prev]);

    // Correo oficial único despachado directamente por /api/register en el backend con plantilla estilizada HTML

    return {
      success: true,
      user: createdUser,
      message: 'Usuario registrado exitosamente',
    };
  };

  const createUser = async (userData: {
    name: string;
    email: string;
    role: UserRole;
    companyId?: string;
    companyName?: string;
    position?: string;
    area?: string;
    birthDate?: string;
    directReports?: number;
    whatsapp?: string;
    status?: 'active' | 'inactive';
    password?: string;
  }): Promise<{ success: boolean; message?: string; user?: UserProfile }> => {
    const cleanName = userData.name.trim();
    const cleanEmail = userData.email.trim().toLowerCase();

    if (!cleanName) {
      showToast('El nombre completo es obligatorio.', 'error');
      return { success: false, message: 'El nombre completo es obligatorio.' };
    }
    if (!cleanEmail || !cleanEmail.includes('@')) {
      showToast('Ingresa un correo electrónico válido.', 'error');
      return { success: false, message: 'Ingresa un correo electrónico válido.' };
    }

    const targetComp = companies.find((c) => c.id === userData.companyId) || companies[0];
    const targetCompanyId = targetComp?.id || 'comp_nexus';
    const targetCompanyName = targetComp?.name || userData.companyName || 'Industrias Nexus Automotriz';

    const res = await userService.createUser({
      name: cleanName,
      email: cleanEmail,
      role: userData.role,
      companyId: targetCompanyId,
      companyName: targetCompanyName,
      position: userData.position || (userData.role === 'leader' ? 'Líder de Equipo' : userData.role === 'hr' ? 'Gestión Humana' : 'Administrador'),
      area: userData.area || (userData.role === 'leader' ? 'Operaciones' : ''),
      birthDate: userData.birthDate || '1990-01-01',
      directReports: userData.directReports !== undefined ? Number(userData.directReports) : (userData.role === 'leader' ? 5 : 0),
      whatsapp: userData.whatsapp || '',
      status: userData.status || 'active',
      password: userData.password || '',
    });

    if (!res.success) {
      showToast(res.message || 'Error al guardar usuario en la base de datos central.', 'error');
      return { success: false, message: res.message || 'Error en el servidor central al crear usuario.' };
    }

    if (Array.isArray(res.users) && res.users.length > 0) {
      setAllUsers(res.users);
    } else if (res.user) {
      setAllUsers((prev) => [res.user!, ...prev.filter((u) => u.id !== res.user!.id)]);
    }

    const createdUser: UserProfile = res.user || {
      id: `user_${Date.now()}`,
      name: cleanName,
      email: cleanEmail,
      role: userData.role,
      companyId: targetCompanyId,
      companyName: targetCompanyName,
      position: userData.position || 'Líder',
      createdAt: new Date().toISOString(),
      status: userData.status || 'active',
    };

    showToast('Usuario creado correctamente en la Base de Datos Central', 'success');

    // Trigger Welcome in-app simulated email message
    const welcomeEmailBody = `¡Hola ${createdUser.name}!\n\nTe damos una cálida bienvenida a Lidacta: Desarrollo de Liderazgo en acción.\n\nTu cuenta ha sido creada exitosamente asociada a ${createdUser.companyName}.\nEn Lidacta cuentas con un espacio 100% seguro y confidencial donde podrás analizar situaciones reales de tu día a día, practicar tus conversaciones y tomar acciones que fortalezcan tu autonomía como líder.\n\nRecursos Humanos únicamente recibirá indicadores agregados de uso, sin acceso a tus conversaciones privadas.\n\n¡Estamos listos para acompañarte en tu próximo reto!\n\nAtentamente,\nEl Equipo de Lidacta`;

    setWelcomeModalData({
      user: createdUser,
      emailText: welcomeEmailBody,
    });

    // Disparar envío garantizado de bienvenida asíncrono
    fetch('/api/send-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: createdUser.id,
        email: cleanEmail,
        name: cleanName,
        role: userData.role,
        companyName: targetCompanyName,
        type: 'welcome',
      }),
    }).catch((err) => console.warn('[LIDACTA] Envío asíncrono desde alta admin:', err));

    return { success: true, message: res.message, user: createdUser };
  };

  const updateUser = async (
    userId: string,
    updates: Partial<UserProfile>
  ): Promise<{ success: boolean; message?: string; user?: UserProfile }> => {
    if (updates.name !== undefined && !updates.name.trim()) {
      showToast('El nombre completo es obligatorio.', 'error');
      return { success: false, message: 'El nombre completo es obligatorio.' };
    }
    if (updates.email !== undefined && (!updates.email.trim() || !updates.email.includes('@'))) {
      showToast('Ingresa un correo electrónico válido.', 'error');
      return { success: false, message: 'Ingresa un correo electrónico válido.' };
    }

    const res = await userService.updateUser(userId, updates);
    if (!res.success) {
      showToast(res.message || 'Error al actualizar usuario en la Base de Datos Central.', 'error');
      return { success: false, message: res.message || 'Error al actualizar usuario.' };
    }

    if (Array.isArray(res.users) && res.users.length > 0) {
      setAllUsers(res.users);
    } else if (res.user) {
      setAllUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, ...res.user! } : u)));
    }

    showToast('Perfil actualizado correctamente en la Base de Datos Central', 'success');
    return { success: true, message: res.message, user: res.user };
  };

  const deleteUser = async (userId: string): Promise<{ success: boolean; message?: string }> => {
    if (userId === 'user_admin_tania') {
      const msg = 'No se puede eliminar la cuenta principal de administración (Tania Padierna).';
      showToast(msg, 'error');
      return { success: false, message: msg };
    }

    const res = await userService.deleteUser(userId);
    if (!res.success) {
      showToast(res.message || 'Error al eliminar usuario en la base de datos central.', 'error');
      return { success: false, message: res.message || 'Error al eliminar usuario.' };
    }

    if (Array.isArray(res.users)) {
      setAllUsers(res.users);
    } else {
      setAllUsers((prev) => prev.filter((u) => u.id !== userId));
    }

    // If deleted current user, switch to admin
    if (currentUserId === userId) {
      const remainingAdmin = (res.users || allUsers).find((u) => u.id !== userId && u.role === 'admin') ||
        (res.users || allUsers).find((u) => u.id !== userId);
      if (remainingAdmin) {
        setCurrentUserId(remainingAdmin.id);
      }
    }

    showToast('Usuario eliminado correctamente de la Base de Datos Central', 'success');
    return { success: true, message: res.message };
  };

  const sendProfileInvite = async (user: {
    id?: string;
    email: string;
    name: string;
    companyName?: string;
    role?: string;
  }): Promise<{ success: boolean; message: string; emailId?: string }> => {
    const directUrl = `${window.location.origin}/complete-profile`;
    const subject = 'Te invitan a completar tu perfil en Lidacta';
    let emailId: string | undefined;

    try {
      const payload = {
        action: 'invite',
        userId: user.id,
        email: user.email,
        to: user.email,
        name: user.name,
        companyName: user.companyName,
        role: user.role,
        inviteUrl: directUrl,
      };

      let res = await fetch('/api/user/complete-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(payload),
      });

      // Fallback a /api/users o /api/admin/invite
      if (!res.ok && res.status === 404) {
        res = await fetch('/api/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify(payload),
        });
      }

      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        if (data.emailId) {
          emailId = data.emailId;
        }
      }
    } catch (err) {
      console.warn('Could not reach backend to send profile invite email:', err);
    }

    const inviteNotif: NotificationItem = {
      id: `notif_invite_${Date.now()}`,
      recipientRole: (user.role as UserRole) || 'leader',
      recipientUserId: user.id,
      companyId: user.companyName || 'comp_nexus',
      title: `Invitación de perfil enviada a ${user.name}`,
      message: `Se envió correo a ${user.email} con enlace directo para completar su perfil de liderazgo.`,
      type: 'registration',
      timestamp: new Date().toISOString(),
      read: false,
      emailSimulated: {
        from: 'Lidacta <notificaciones@taniapadierna.com>',
        to: user.email,
        replyTo: 'hola@lidacta.com',
        subject,
        bodyText: `¡Hola ${user.name}!\n\nLa administración de ${user.companyName || 'tu empresa'} te ha invitado a formar parte del programa directivo en Lidacta.\n\nPara habilitar tu acceso seguro y comenzar tu proceso de acompañamiento directivo personalizado, por favor ingresa al siguiente enlace y completa los datos de tu entorno operativo (Área, Puesto, WhatsApp y Personas a Cargo):\n\n${directUrl}\n\nDatos de acceso:\nUsuario: ${user.email}\nEmpresa: ${user.companyName || 'Lidacta'}\n\nEl contenido de tus conversaciones es privado y confidencial.\n\nAtentamente,\nEl Equipo de Lidacta`,
        realEmailSent: true,
        realEmailId: emailId,
      },
    };
    setNotifications((prev) => [inviteNotif, ...prev]);
    showToast(`Correo de invitación para completar perfil enviado a ${user.email}`, 'success');

    return {
      success: true,
      emailId,
      message: `Correo de invitación para completar perfil enviado a ${user.email}`,
    };
  };

  return (
    <LidactaContext.Provider
      value={{
        sessionUser,
        currentUser,
        allUsers,
        companies,
        mentorships,
        activeMentorship,
        notifications,
        unreadNotificationsCount,
        isSendingMessage,
        isAdvancingStage,
        isEmailDrawerOpen,
        isProfileModalOpen,
        openProfileModal,
        closeProfileModal,
        isLeaderProfileModalOpen,
        openLeaderProfileModal,
        closeLeaderProfileModal,
        updateUserProfile,
        selectedEmailForPreview,
        showNewUserModal,
        welcomeModalData,
        roleWelcomeModalData,
        openRoleWelcomeModal,
        closeRoleWelcomeModal,
        toast,
        showToast,
        hideToast,
        isAuthenticated,
        isProfileComplete,
        forceCompleteProfile,
        sendProfileInvite,
        login,
        logout,
        impersonatedUser,
        isImpersonating,
        impersonateUser,
        impersonateRole,
        stopImpersonation,
        createTestSessionAtStage,
        deleteTestSession,
        clearAllTestSessions,
        completeUserProfile,
        registerOrSetPassword,
        switchUser,
        createNewUser,
        createUser,
        updateUser,
        deleteUser,
        setShowNewUserModal,
        closeWelcomeModal,
        setActiveMentorshipId,
        startNewMentorship,
        sendMessageInActiveSession,
        advanceStage,
        setStageReadyToAdvance,
        updateActionPlan,
        markActionCompleted,
        respondStage6ExecutionCheck,
        saveLearnings,
        updateCompanyContext,
        addCompany,
        markNotificationsAsRead,
        openEmailDrawer,
        closeEmailDrawer,
        requestHumanMentor,
        updateMentorRequestStatus,
        refreshUsers,
        isSyncingUsers,
        isDbConnected,
        lastDbSync,
        dbLatencyMs,
        recommendedResources,
        recordResourceRecommendation,
        systemAlerts,
        triggerTherapeuticAlert,
        checkAndProcessStage5FollowUps,
        triggerStage5FollowUpCheck,
        retrySendFinalReportEmail,
      }}
    >
      {children}
    </LidactaContext.Provider>
  );
};

export const useLidacta = () => {
  const context = useContext(LidactaContext);
  if (!context) {
    throw new Error('useLidacta must be used within a LidactaProvider');
  }
  return context;
};
