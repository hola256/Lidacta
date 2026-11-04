export type UserRole = 'leader' | 'hr' | 'admin';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: UserRole;
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
  status?: 'active' | 'inactive';
  password?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface CompanyContext {
  id: string;
  name: string;
  industry: string;
  values: string;
  philosophy: string;
  expectedCompetencies: string[];
  culture: string;
  workRhythm: string;
  webLinks: { title: string; url: string }[];
  attachments: { name: string; size: string; type: string; date: string }[];
  updatedAt: string;
}

export type StageNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface StageHistoryItem {
  stage: StageNumber;
  stageName: string;
  enteredAt: string;
  completedAt?: string;
  durationMinutes?: number;
}

export interface MentorshipMessage {
  id: string;
  sender: 'leader' | 'lidacta';
  text: string;
  timestamp: string;
  stage: StageNumber;
  isLeaderVoiceQuote?: boolean;
}

export interface MentorshipActionPlan {
  what: string;
  when: string;
  withWhom: string;
  how: string;
  careReminders: string;
  isCompleted?: boolean;
  completedAt?: string;
  stage5EnteredAt?: string;
  email48hSent?: boolean;
  email48hSentAt?: string;
  email5dSent?: boolean;
  email5dSentAt?: string;
  adminInactivityAlertSent?: boolean;
  adminInactivityAlertSentAt?: string;
}

export interface MentorshipLearnings {
  whatHappened: string;
  whatWorked: string;
  whatDidnt: string;
  insights: string;
  futureAdjustments: string;
}

export interface FinalFeedbackReport {
  detectedStrengths: string[];
  stageTwoSkills: string[];
  chosenActions: string[];
  stageSixLearnings: string[];
  recommendationsForAutonomy: string[];
  deliveredAt: string;
}

export interface MentorshipSession {
  id: string;
  leaderId: string;
  leaderName: string;
  companyId: string;
  companyName: string;
  leaderArea?: string;
  title: string;
  initialChallenge: string;
  currentStage: StageNumber;
  stageHistory: StageHistoryItem[];
  messages: MentorshipMessage[];
  theme: string;
  status: 'active' | 'in_action' | 'completed';
  priority?: 'alta' | 'media' | 'baja';
  startedAt: string;
  lastActiveAt: string;
  completedAt?: string;
  // Stage 5 follow-up tracking
  stage5EnteredAt?: string;
  email48hSent?: boolean;
  email48hSentAt?: string;
  email5dSent?: boolean;
  email5dSentAt?: string;
  adminInactivityAlertSent?: boolean;
  adminInactivityAlertSentAt?: string;
  // Extracted and managed stage data
  clarificationAnswers?: string[];
  identifiedSkills: string[];
  risksAndImpact?: string;
  leaderContribution?: string;
  detectedPatterns?: string;
  leaderAlternatives?: string[];
  suggestedAlternatives?: string[];
  chosenAlternative?: string;
  wantsPractice?: boolean;
  practiceFeedback?: string;
  actionPlan?: MentorshipActionPlan;
  learnings?: MentorshipLearnings;
  finalFeedbackReport?: FinalFeedbackReport;
}

export interface MentorRequestDetails {
  leaderId: string;
  leaderName: string;
  leaderEmail: string;
  leaderWhatsapp?: string;
  leaderPosition?: string;
  companyName: string;
  currentStage: StageNumber;
  stageName: string;
  caseTitle: string;
  reasonText: string;
  isVoiceAudio?: boolean;
  status: 'pendiente' | 'contactado' | 'atendido';
  whatsappSent?: boolean;
  emailSent?: boolean;
  adminNotes?: string;
}

export type SystemAlertType = 'therapeutic_limit' | 'inactivity_day8';

export interface SystemAlertItem {
  id: string;
  type: SystemAlertType;
  typeName: string;
  leaderId?: string;
  leaderName: string;
  leaderEmail?: string;
  leaderPosition?: string;
  leaderArea?: string;
  companyId?: string;
  companyName: string;
  stage?: StageNumber;
  currentStage?: number;
  stageName?: string;
  mentorshipId?: string;
  timestamp: string;
  status: 'Correo Enviado' | 'Pendiente' | 'Revisado';
  caseSummary: string;
  emailRecipient: string;
  userMessageSnippet?: string;
  details?: Record<string, any>;
  realEmailSent?: boolean;
  realEmailId?: string;
}

export interface NotificationItem {
  id: string;
  recipientRole: UserRole;
  recipientUserId?: string;
  companyId?: string;
  title: string;
  message: string;
  type: 'registration' | 'case_started' | 'action_reminder' | 'case_completed' | 'system' | 'mentor_request' | 'stage5_followup' | 'inactivity_alert' | 'therapeutic_alert';
  timestamp: string;
  read: boolean;
  emailSimulated?: {
    from?: string;
    to: string;
    replyTo?: string;
    subject: string;
    bodyText: string;
    realEmailSent?: boolean;
    realEmailId?: string;
  };
  mentorRequestDetails?: MentorRequestDetails;
}

export type ResourceOrigin = 'internal' | 'external';
export type ResourceUtilityLevel = 'Muy Alta' | 'Alta' | 'Media';
export type ResourceDifficultyLevel = 'Baja' | 'Media' | 'Alta';

export interface RecommendedResourceItem {
  id: string;
  resourceTitle: string;
  origin: ResourceOrigin; // 'internal' = Biblioteca Interna (Bloque 3) | 'external' = Fuentes Externas Delimitadas
  categoryOrTool?: string;
  category?: string;
  sourceOrAuthor?: string;
  urlOrRef?: string;
  leaderId: string;
  leaderName: string;
  leaderEmail: string;
  companyId: string;
  companyName: string;
  mentorshipId: string;
  challengeTitle: string;
  theme: string;
  stage: StageNumber;
  stageName: string;
  recommendedAt: string;
  timestamp?: string;
  // Context-estimated Utility & Alignment
  estimatedUtility?: ResourceUtilityLevel;
  utilityReason?: string;
  // Context-estimated Difficulty & Resistance
  estimatedDifficulty?: ResourceDifficultyLevel;
  resistanceOrDoubtNotes?: string;
}
