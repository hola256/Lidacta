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
  createdAt: string;
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

export interface NotificationItem {
  id: string;
  recipientRole: UserRole;
  recipientUserId?: string;
  companyId: string;
  title: string;
  message: string;
  type: 'registration' | 'case_started' | 'action_reminder' | 'case_completed' | 'system';
  timestamp: string;
  read: boolean;
  emailSimulated?: {
    to: string;
    subject: string;
    bodyText: string;
  };
}
