import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import {
  CompanyContext,
  MentorshipSession,
  NotificationItem,
  StageNumber,
  UserProfile,
  UserRole,
} from '../types/lidacta';
import {
  INITIAL_COMPANIES,
  INITIAL_MENTORSHIPS,
  INITIAL_NOTIFICATIONS,
  INITIAL_USERS,
  DEFAULT_ADMIN_PROFILE,
} from '../data/mockData';

interface LidactaContextType {
  currentUser: UserProfile;
  allUsers: UserProfile[];
  companies: CompanyContext[];
  mentorships: MentorshipSession[];
  activeMentorship: MentorshipSession | null;
  notifications: NotificationItem[];
  unreadNotificationsCount: number;
  isSendingMessage: boolean;
  isEmailDrawerOpen: boolean;
  selectedEmailForPreview: NotificationItem | null;
  showNewUserModal: boolean;
  welcomeModalData: { user: UserProfile; emailText: string } | null;
  isProfileModalOpen: boolean;

  // Toast / System Notifications
  toast: { id: string; message: string; type: 'success' | 'info' | 'warning' | 'error' } | null;
  showToast: (message: string, type?: 'success' | 'info' | 'warning' | 'error') => void;
  hideToast: () => void;

  // Authentication & Onboarding
  isAuthenticated: boolean;
  isProfileComplete: boolean;
  login: (email: string, password?: string) => { success: boolean; message?: string };
  logout: () => void;
  completeUserProfile: (data: {
    companyName: string;
    area?: string;
    birthDate: string;
    directReports?: number;
    whatsapp: string;
  }) => { success: boolean; message?: string };
  updateUserProfile: (
    userId: string,
    updates: Partial<UserProfile>
  ) => Promise<{ success: boolean; message?: string }>;
  registerOrSetPassword: (
    email: string,
    password: string,
    name?: string,
    role?: UserRole,
    position?: string,
    companyId?: string
  ) => { success: boolean; message?: string };
  
  // Actions
  switchUser: (userId: string) => void;
  createNewUser: (profile: Partial<UserProfile>) => UserProfile;
  setShowNewUserModal: (open: boolean) => void;
  closeWelcomeModal: () => void;
  openProfileModal: () => void;
  closeProfileModal: () => void;
  setActiveMentorshipId: (id: string | null) => void;
  startNewMentorship: (
    challengeText: string,
    options?: {
      title?: string;
      stage?: StageNumber;
      priority?: 'alta' | 'media' | 'baja';
    }
  ) => Promise<MentorshipSession>;
  sendMessageInActiveSession: (text: string, isPractice?: boolean) => Promise<void>;
  advanceStage: (targetStage?: StageNumber) => Promise<void>;
  updateActionPlan: (plan: MentorshipSession['actionPlan']) => void;
  markActionCompleted: () => void;
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
}

const LidactaContext = createContext<LidactaContextType | undefined>(undefined);

const STORAGE_KEY_PREFIX = 'lidacta_v2_';

export const LidactaProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Load from local storage or fallback to mock data, ensuring admin has valid default fields
  const [allUsers, setAllUsers] = useState<UserProfile[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY_PREFIX}users`);
    if (saved) {
      try {
        const parsed: UserProfile[] = JSON.parse(saved);
        return parsed.map((u) => {
          if (u.role === 'admin' || u.id === 'user_admin_tania') {
            return {
              ...DEFAULT_ADMIN_PROFILE,
              ...u,
              email: u.email || DEFAULT_ADMIN_PROFILE.email,
              whatsapp: u.whatsapp || DEFAULT_ADMIN_PROFILE.whatsapp,
              name: u.name || DEFAULT_ADMIN_PROFILE.name,
              position: u.position || DEFAULT_ADMIN_PROFILE.position,
              companyName: u.companyName || DEFAULT_ADMIN_PROFILE.companyName,
            };
          }
          return u;
        });
      } catch {
        return INITIAL_USERS;
      }
    }
    return INITIAL_USERS;
  });

  // Fetch centralized users and admin profile from server on load for cross-device consistency (Mobile <-> PC)
  useEffect(() => {
    fetch('/api/users')
      .then((res) => res.json())
      .then((data) => {
        if (data.success && Array.isArray(data.users)) {
          setAllUsers((prevUsers) => {
            const serverMap = new Map(data.users.map((u: UserProfile) => [u.id, u]));
            return prevUsers.map((localUser) => {
              const serverUser = serverMap.get(localUser.id) as UserProfile | undefined;
              if (serverUser) {
                return {
                  ...localUser,
                  ...serverUser,
                  // Ensure completion flags are maintained if completed on server
                  isProfileCompleted: serverUser.isProfileCompleted ?? localUser.isProfileCompleted,
                  isProfileComplete: serverUser.isProfileComplete ?? localUser.isProfileComplete,
                };
              }
              return localUser;
            });
          });
        }
      })
      .catch((err) => {
        console.warn('Could not sync users from server:', err);
      });

    fetch('/api/admin/profile')
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.profile) {
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
        console.warn('Could not sync admin profile from server, using local defaults:', err);
      });
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

  const [currentUserId, setCurrentUserId] = useState<string>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY_PREFIX}current_user_id`);
    return saved || 'user_leader_roberto';
  });

  const [companies, setCompanies] = useState<CompanyContext[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY_PREFIX}companies`);
    return saved ? JSON.parse(saved) : INITIAL_COMPANIES;
  });

  const [mentorships, setMentorships] = useState<MentorshipSession[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY_PREFIX}mentorships`);
    return saved ? JSON.parse(saved) : INITIAL_MENTORSHIPS;
  });

  const [notifications, setNotifications] = useState<NotificationItem[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY_PREFIX}notifications`);
    return saved ? JSON.parse(saved) : INITIAL_NOTIFICATIONS;
  });

  const [activeMentorshipId, setActiveMentorshipIdState] = useState<string | null>(() => {
    return 'ment_roberto_2';
  });

  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [isEmailDrawerOpen, setIsEmailDrawerOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [selectedEmailForPreview, setSelectedEmailForPreview] = useState<NotificationItem | null>(null);
  const [showNewUserModal, setShowNewUserModal] = useState(false);
  const [welcomeModalData, setWelcomeModalData] = useState<{ user: UserProfile; emailText: string } | null>(null);

  // Global Toast Notification State
  const [toast, setToast] = useState<{
    id: string;
    message: string;
    type: 'success' | 'info' | 'warning' | 'error';
  } | null>(null);

  const showToast = (
    message: string,
    type: 'success' | 'info' | 'warning' | 'error' = 'success'
  ) => {
    const id = `toast_${Date.now()}`;
    setToast({ id, message, type });
    setTimeout(() => {
      setToast((curr) => (curr?.id === id ? null : curr));
    }, 4500);
  };

  const hideToast = () => setToast(null);

  const openProfileModal = () => setIsProfileModalOpen(true);
  const closeProfileModal = () => setIsProfileModalOpen(false);

  // App starts by default on the login screen
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);

  // Sync to localStorage
  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}users`, JSON.stringify(allUsers));
  }, [allUsers]);

  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}current_user_id`, currentUserId);
  }, [currentUserId]);

  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}companies`, JSON.stringify(companies));
  }, [companies]);

  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}mentorships`, JSON.stringify(mentorships));
  }, [mentorships]);

  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}notifications`, JSON.stringify(notifications));
  }, [notifications]);

  const currentUser = allUsers.find((u) => u.id === currentUserId) || allUsers[0];

  const activeMentorship =
    mentorships.find((m) => m.id === activeMentorshipId) ||
    mentorships.find((m) => m.leaderId === currentUser.id && m.status !== 'completed') ||
    mentorships.find((m) => m.leaderId === currentUser.id) ||
    null;

  const unreadNotificationsCount = notifications.filter(
    (n) => !n.read && (n.recipientRole === currentUser.role || (n.recipientUserId && n.recipientUserId === currentUser.id))
  ).length;

  const switchUser = (userId: string) => {
    setCurrentUserId(userId);
    const targetUser = allUsers.find((u) => u.id === userId);
    if (targetUser && targetUser.role === 'leader') {
      const leaderMentorship =
        mentorships.find((m) => m.leaderId === targetUser.id && m.status !== 'completed') ||
        mentorships.find((m) => m.leaderId === targetUser.id);
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
    setCurrentUserId(newUser.id);

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
    }
  ): Promise<MentorshipSession> => {
    const company = companies.find((c) => c.id === currentUser.companyId) || companies[0];
    const newSessionId = `ment_${Date.now()}`;
    const initialStage = options?.stage || 1;
    const sessionTitle =
      options?.title?.trim() ||
      challengeText.slice(0, 60) + (challengeText.length > 60 ? '...' : '');

    const stageNames: Record<StageNumber, string> = {
      1: 'Detectar qué sucede con profundidad',
      2: 'Analizar y ver desde otras perspectivas',
      3: 'Diseñar alternativas de solución',
      4: 'Practicar antes de actuar (Roleplay)',
      5: 'Definir plan de acción concreto',
      6: 'Aprender y reflexionar tras la acción',
      7: 'Cierre y retroalimentación de liderazgo',
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
          sender: 'leader',
          text: challengeText,
          timestamp: new Date().toISOString(),
          stage: initialStage,
        },
      ],
      identifiedSkills: [],
    };

    setMentorships((prev) => [newSession, ...prev]);
    setActiveMentorshipIdState(newSessionId);

    // Notify HR about new case started (without revealing details!)
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

    // Send first message to API
    setIsSendingMessage(true);
    try {
      const response = await fetch('/api/mentor/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stage: initialStage,
          leaderProfile: currentUser,
          companyContext: company,
          conversationHistory: newSession.messages,
          userMessage: challengeText,
          sessionData: newSession,
        }),
      });

      const data = await response.json();
      if (data.success && data.data) {
        const coachReply = data.data;
        const replyMsg = {
          id: `msg_${Date.now()}_lid`,
          sender: 'lidacta' as const,
          text: coachReply.replyText,
          timestamp: new Date().toISOString(),
          stage: 1 as StageNumber,
        };

        setMentorships((prev) =>
          prev.map((m) =>
            m.id === newSessionId
              ? {
                  ...m,
                  theme: coachReply.detectedTheme || m.theme,
                  messages: [...m.messages, replyMsg],
                  lastActiveAt: new Date().toISOString(),
                }
              : m
          )
        );
      }
    } catch (err) {
      console.error('Error starting mentorship:', err);
    } finally {
      setIsSendingMessage(false);
    }

    return newSession;
  };

  const sendMessageInActiveSession = async (text: string, isPractice: boolean = false) => {
    if (!activeMentorship || !text.trim()) return;

    const currentStage = activeMentorship.currentStage;
    const company = companies.find((c) => c.id === activeMentorship.companyId) || companies[0];

    const leaderMsg = {
      id: `msg_${Date.now()}_lead`,
      sender: 'leader' as const,
      text: text.trim(),
      timestamp: new Date().toISOString(),
      stage: currentStage,
      isLeaderVoiceQuote: text.length < 140, // Format short insights nicely
    };

    const updatedMessages = [...activeMentorship.messages, leaderMsg];

    setMentorships((prev) =>
      prev.map((m) =>
        m.id === activeMentorship.id
          ? {
              ...m,
              messages: updatedMessages,
              lastActiveAt: new Date().toISOString(),
            }
          : m
      )
    );

    setIsSendingMessage(true);

    try {
      const response = await fetch('/api/mentor/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stage: currentStage,
          leaderProfile: currentUser,
          companyContext: company,
          conversationHistory: updatedMessages,
          userMessage: text,
          sessionData: activeMentorship,
          isPracticeMode: isPractice,
        }),
      });

      const data = await response.json();
      if (data.success && data.data) {
        const coachReply = data.data;

        const lidactaMsg = {
          id: `msg_${Date.now()}_lid`,
          sender: 'lidacta' as const,
          text: coachReply.replyText,
          timestamp: new Date().toISOString(),
          stage: currentStage,
        };

        setMentorships((prev) =>
          prev.map((m) => {
            if (m.id !== activeMentorship.id) return m;

            const newSkills = coachReply.identifiedSkills
              ? Array.from(new Set([...(m.identifiedSkills || []), ...coachReply.identifiedSkills]))
              : m.identifiedSkills;

            const newActionPlan = coachReply.actionPlanDraft
              ? { ...(m.actionPlan || { what: '', when: '', withWhom: '', how: '', careReminders: '' }), ...coachReply.actionPlanDraft }
              : m.actionPlan;

            const newFinalFeedback = coachReply.finalFeedback
              ? {
                  ...coachReply.finalFeedback,
                  deliveredAt: new Date().toISOString(),
                }
              : m.finalFeedbackReport;

            return {
              ...m,
              messages: [...m.messages, lidactaMsg],
              theme: coachReply.detectedTheme || m.theme,
              identifiedSkills: newSkills,
              suggestedAlternatives: coachReply.suggestedAlternatives || m.suggestedAlternatives,
              actionPlan: newActionPlan,
              finalFeedbackReport: newFinalFeedback,
              lastActiveAt: new Date().toISOString(),
            };
          })
        );
      }
    } catch (err) {
      console.error('Error sending message:', err);
    } finally {
      setIsSendingMessage(false);
    }
  };

  const advanceStage = async (targetStage?: StageNumber) => {
    if (!activeMentorship) return;

    const current = activeMentorship.currentStage;
    const nextStage = (targetStage || (current < 7 ? (current + 1 as StageNumber) : 7)) as StageNumber;

    const now = new Date().toISOString();

    const stageNames: Record<StageNumber, string> = {
      1: 'Detectar qué sucede con profundidad',
      2: 'Analizar y ver desde otras perspectivas',
      3: 'Diseñar alternativas de solución',
      4: 'Practicar antes de actuar (Roleplay)',
      5: 'Definir plan de acción concreto',
      6: 'Aprender y reflexionar tras la acción',
      7: 'Cierre y retroalimentación de liderazgo',
    };

    const updatedHistory = activeMentorship.stageHistory.map((item) => {
      if (item.stage === current && !item.completedAt) {
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
        stageName: stageNames[nextStage],
        enteredAt: now,
      });
    }

    const isCompletion = nextStage === 7;
    const newStatus = isCompletion ? 'completed' : nextStage === 5 ? 'in_action' : 'active';

    setMentorships((prev) =>
      prev.map((m) =>
        m.id === activeMentorship.id
          ? {
              ...m,
              currentStage: nextStage,
              status: newStatus,
              stageHistory: updatedHistory,
              completedAt: isCompletion ? now : m.completedAt,
              lastActiveAt: now,
            }
          : m
      )
    );

    // If reached Stage 7, notify HR that leader completed mentorship!
    if (isCompletion) {
      const hrNotification: NotificationItem = {
        id: `notif_${Date.now()}_case_completed`,
        recipientRole: 'hr',
        companyId: activeMentorship.companyId,
        title: 'Proceso de acompañamiento concluido',
        message: `${activeMentorship.leaderName} terminó su proceso de acompañamiento o mentoría con Lidacta, puedes ver los indicadores en la plataforma.`,
        type: 'case_completed',
        timestamp: now,
        read: false,
        emailSimulated: {
          to: `recursos.humanos@${activeMentorship.companyName.toLowerCase().replace(/\s+/g, '')}.com`,
          subject: `Lidacta: ${activeMentorship.leaderName} terminó su proceso de acompañamiento`,
          bodyText: `Estimada responsable de Recursos Humanos,\n\n${activeMentorship.leaderName} concluyó satisfactoriamente las 7 etapas de desarrollo en Lidacta.\n\nYa puedes consultar los indicadores clave en tu panel:\n• Tema abordado: ${activeMentorship.theme}\n• Habilidades desarrolladas: ${activeMentorship.identifiedSkills.join(', ') || 'Liderazgo operativo'}\n• Acción implementada: ${activeMentorship.actionPlan?.what || 'Conversación 1 a 1'}\n\nGracias por impulsar el liderazgo en acción.\n\nAtentamente,\nEquipo Lidacta`,
        },
      };

      setNotifications((prev) => [hrNotification, ...prev]);
    }

    // Trigger mentor introduction for new stage
    const company = companies.find((c) => c.id === activeMentorship.companyId) || companies[0];
    setIsSendingMessage(true);
    try {
      const response = await fetch('/api/mentor/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stage: nextStage,
          leaderProfile: currentUser,
          companyContext: company,
          conversationHistory: activeMentorship.messages,
          userMessage: `[Avanzando a Etapa ${nextStage}]`,
          sessionData: activeMentorship,
        }),
      });

      const data = await response.json();
      if (data.success && data.data) {
        const coachReply = data.data;
        const introMsg = {
          id: `msg_${Date.now()}_lid`,
          sender: 'lidacta' as const,
          text: coachReply.replyText,
          timestamp: new Date().toISOString(),
          stage: nextStage,
        };

        setMentorships((prev) =>
          prev.map((m) =>
            m.id === activeMentorship.id
              ? {
                  ...m,
                  messages: [...m.messages, introMsg],
                  finalFeedbackReport: coachReply.finalFeedback
                    ? { ...coachReply.finalFeedback, deliveredAt: new Date().toISOString() }
                    : m.finalFeedbackReport,
                  lastActiveAt: new Date().toISOString(),
                }
              : m
          )
        );
      }
    } catch (err) {
      console.error('Error transitioning stage:', err);
    } finally {
      setIsSendingMessage(false);
    }
  };

  const updateActionPlan = (plan: MentorshipSession['actionPlan']) => {
    if (!activeMentorship || !plan) return;
    setMentorships((prev) =>
      prev.map((m) =>
        m.id === activeMentorship.id
          ? {
              ...m,
              actionPlan: plan,
              status: 'in_action',
              lastActiveAt: new Date().toISOString(),
            }
          : m
      )
    );

    // Create action reminder notification for leader
    const reminderNotif: NotificationItem = {
      id: `notif_${Date.now()}_reminder`,
      recipientRole: 'leader',
      recipientUserId: activeMentorship.leaderId,
      companyId: activeMentorship.companyId,
      title: 'Recordatorio de tu Plan de Acción',
      message: `${currentUser.name}, tienes programada tu acción: "${plan.what}". Recuerda cuidar: ${plan.careReminders}`,
      type: 'action_reminder',
      timestamp: new Date().toISOString(),
      read: false,
      emailSimulated: {
        to: currentUser.email,
        subject: `Lidacta: Recordatorio de tu plan de acción`,
        bodyText: `Hola ${currentUser.name},\n\nTe recordamos tu compromiso de liderazgo:\n• Acción: ${plan.what}\n• Momento: ${plan.when}\n• Con quién: ${plan.withWhom}\n• Qué vas a cuidar: ${plan.careReminders}\n\nEn cuanto la lleves a cabo, regresa a Lidacta para registrar qué ocurrió en la Etapa 6.\n\n¡Desarrollo de liderazgo en acción!`,
      },
    };

    setNotifications((prev) => [reminderNotif, ...prev]);
  };

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

  const saveLearnings = (learnings: NonNullable<MentorshipSession['learnings']>) => {
    if (!activeMentorship) return;
    setMentorships((prev) =>
      prev.map((m) =>
        m.id === activeMentorship.id
          ? {
              ...m,
              learnings,
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
      email: 'hola@taniapadierna.com',
      whatsapp: '+52 55 1234 5678',
    };
    const currentStageNum = (activeMentorship?.currentStage || 1) as StageNumber;
    const currentCaseTitle = activeMentorship?.title || 'Acompañamiento en Lidacta';
    const notifId = `notif_${Date.now()}_mentor_req`;

    const stageNames: Record<number, string> = {
      1: 'Detectar qué sucede',
      2: 'Analizar perspectivas & Habilidades',
      3: 'Diseñar alternativas',
      4: 'Practicar antes de actuar',
      5: 'Actuar (Plan de Acción)',
      6: 'Aprender y reflexionar',
      7: 'Cierre & Retroalimentación',
    };

    const cleanAdminPhone = (adminUser.whatsapp || '+52 55 1234 5678').replace(/[^0-9]/g, '');
    let serverWhatsappUrl = `https://wa.me/${cleanAdminPhone}?text=${encodeURIComponent(
      `🚨 *LIDACTA: Solicitud de Asesoría 1:1*\n*Líder:* ${currentUser.name}\n*Empresa:* ${currentUser.companyName}\n*Etapa:* ${currentStageNum} (${stageNames[currentStageNum]})\n*Motivo:* ${reasonText}`
    )}`;

    let simulatedEmailObj = {
      to: adminUser.email || 'hola@taniapadierna.com',
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
          adminEmail: adminUser.email || 'hola@taniapadierna.com',
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
        sender: 'leader' as const,
        text: `[Solicitud de Asesoría 1:1 enviada a ${adminUser.name || 'Tania Padierna'}]\nMotivo: "${reasonText}"`,
        timestamp: new Date().toISOString(),
        stage: currentStageNum,
      };

      const lidactaConfirmMsg = {
        id: `msg_${Date.now()}_lid_confirm`,
        sender: 'lidacta' as const,
        text: `He recibido tu solicitud para una Asesoría 1:1, ${currentUser.name}. Se ha notificado inmediatamente a ${adminUser.name || 'Tania Padierna'} (Dirección de Mentoría) por correo electrónico (hola@taniapadierna.com) y WhatsApp (${adminUser.whatsapp || '+52 55 1234 5678'}) con tu contexto de la Etapa ${currentStageNum}. Nos pondremos en contacto contigo a la brevedad. Tu conversación sigue siendo 100% confidencial.`,
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

  const login = (email: string, _password?: string): { success: boolean; message?: string } => {
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

    setCurrentUserId(user.id);
    setIsAuthenticated(true);

    if (user.role === 'leader') {
      const leaderMentorship =
        mentorships.find((m) => m.leaderId === user.id && m.status !== 'completed') ||
        mentorships.find((m) => m.leaderId === user.id);
      setActiveMentorshipIdState(leaderMentorship ? leaderMentorship.id : null);
    }

    return { success: true };
  };

  const isProfileComplete = useMemo(() => {
    if (currentUser.role === 'admin') return true;
    if (currentUser.isProfileCompleted === false && currentUser.isProfileComplete !== true) return false;

    const hasCompany = Boolean(currentUser.companyName && currentUser.companyName.trim());
    const hasBirthDate = Boolean(currentUser.birthDate && currentUser.birthDate.trim());
    const hasWhatsapp = Boolean(currentUser.whatsapp && currentUser.whatsapp.trim());
    const isFlaggedComplete = Boolean(currentUser.isProfileCompleted || currentUser.isProfileComplete);

    if (currentUser.role === 'hr') {
      return isFlaggedComplete && hasCompany && hasBirthDate && hasWhatsapp;
    }

    if (currentUser.role === 'leader') {
      const hasArea = Boolean(currentUser.area && currentUser.area.trim());
      const hasReports =
        currentUser.directReports !== undefined &&
        currentUser.directReports !== null &&
        !isNaN(Number(currentUser.directReports)) &&
        Number(currentUser.directReports) >= 0;
      return isFlaggedComplete && hasCompany && hasArea && hasBirthDate && hasReports && hasWhatsapp;
    }

    return true;
  }, [currentUser]);

  const completeUserProfile = (data: {
    companyName: string;
    area?: string;
    birthDate: string;
    directReports?: number;
    whatsapp: string;
  }): { success: boolean; message?: string } => {
    const { companyName, area, birthDate, directReports, whatsapp } = data;

    if (!companyName || !companyName.trim()) {
      return { success: false, message: 'El nombre de la empresa es obligatorio.' };
    }
    if (!birthDate || !birthDate.trim()) {
      return { success: false, message: 'La fecha de nacimiento es obligatoria.' };
    }
    if (!whatsapp || !whatsapp.trim()) {
      return { success: false, message: 'El número de WhatsApp es obligatorio.' };
    }

    if (currentUser.role === 'leader') {
      if (!area || !area.trim()) {
        return { success: false, message: 'El área es obligatoria para el rol de Líder.' };
      }
      if (
        directReports === undefined ||
        directReports === null ||
        isNaN(Number(directReports)) ||
        Number(directReports) < 0
      ) {
        return { success: false, message: 'El número de personas a cargo es obligatorio.' };
      }
    }

    const updatedUser: UserProfile = {
      ...currentUser,
      companyName: companyName.trim(),
      birthDate: birthDate.trim(),
      whatsapp: whatsapp.trim(),
      isProfileCompleted: true,
      isProfileComplete: true,
      ...(currentUser.role === 'leader'
        ? {
            area: area?.trim() || '',
            directReports: Number(directReports),
          }
        : {}),
    };

    setAllUsers((prev) => prev.map((u) => (u.id === currentUser.id ? updatedUser : u)));

    // Update companies list if company name changed
    setCompanies((prev) =>
      prev.map((c) =>
        c.id === currentUser.companyId ? { ...c, name: companyName.trim() } : c
      )
    );

    // Update mentorship session company and area if leader
    if (currentUser.role === 'leader') {
      setMentorships((prev) =>
        prev.map((m) =>
          m.leaderId === currentUser.id
            ? { ...m, companyName: companyName.trim(), leaderArea: area?.trim() || m.leaderArea }
            : m
        )
      );
    }

    // Persist to centralized server store for cross-device consistency (Mobile, PC, Incognito)
    fetch('/api/user/complete-profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: currentUser.id,
        email: currentUser.email,
        name: currentUser.name,
        role: currentUser.role,
        position: currentUser.position,
        companyName: companyName.trim(),
        area: area?.trim(),
        birthDate: birthDate.trim(),
        directReports: directReports !== undefined ? Number(directReports) : undefined,
        whatsapp: whatsapp.trim(),
      }),
    })
      .then((res) => res.json())
      .then((resData) => {
        if (resData.success) {
          console.log('[LIDACTA PROFILE] Successfully synced profile to central server');
        }
      })
      .catch((err) => console.warn('Could not sync complete profile to server:', err));

    showToast('¡Información actualizada correctamente! Tu perfil de Líder ha quedado completado.', 'success');

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

    setAllUsers((prev) =>
      prev.map((u) => {
        if (u.id === userId) {
          return {
            ...u,
            ...updates,
            name: cleanName,
            email: cleanEmail,
            whatsapp: cleanWhatsapp || u.whatsapp,
            position: updates.position !== undefined ? updates.position.trim() : u.position,
            companyName: updates.companyName !== undefined ? updates.companyName.trim() : u.companyName,
          };
        }
        return u;
      })
    );

    // If updating admin, sync to centralized server memory so all devices/browsers reflect it immediately
    const targetUser = allUsers.find((u) => u.id === userId);
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

    return { success: true, message: 'Perfil actualizado y sincronizado centralmente.' };
  };

  const logout = () => {
    setIsAuthenticated(false);
  };

  const registerOrSetPassword = (
    email: string,
    _password: string,
    name?: string,
    role?: UserRole,
    position?: string,
    companyId?: string
  ): { success: boolean; message?: string } => {
    const cleanEmail = email.trim().toLowerCase();
    const existingUser = allUsers.find((u) => u.email.toLowerCase() === cleanEmail);

    if (existingUser) {
      if (name?.trim() || role || position?.trim()) {
        const updatedUser = {
          ...existingUser,
          name: name?.trim() || existingUser.name,
          role: role || existingUser.role,
          position: position?.trim() || existingUser.position,
        };
        setAllUsers((prev) => prev.map((u) => (u.id === existingUser.id ? updatedUser : u)));
      }
      setCurrentUserId(existingUser.id);
      setIsAuthenticated(true);
      return { success: true };
    }

    const assignedRole: UserRole = role || 'admin';
    const targetCompany = companies.find((c) => c.id === companyId) || companies[0];
    const newUser: UserProfile = {
      id: `user_${Date.now()}`,
      name: name?.trim() || (assignedRole === 'admin' ? 'Tania Padierna' : 'Usuario Lidacta'),
      email: cleanEmail,
      role: assignedRole,
      companyId: targetCompany?.id || 'comp_nexus',
      companyName: targetCompany?.name || 'Lidacta Platform',
      position:
        position?.trim() ||
        (assignedRole === 'admin'
          ? 'Administradora de Plataforma'
          : assignedRole === 'hr'
          ? 'Gestión de Talento Humano'
          : 'Líder Operativo'),
      area: assignedRole === 'admin' ? 'Dirección y Auditoría' : '',
      isProfileCompleted: assignedRole === 'admin',
      createdAt: new Date().toISOString().split('T')[0],
    };

    setAllUsers((prev) => [newUser, ...prev]);
    setCurrentUserId(newUser.id);
    setIsAuthenticated(true);
    return { success: true };
  };

  return (
    <LidactaContext.Provider
      value={{
        currentUser,
        allUsers,
        companies,
        mentorships,
        activeMentorship,
        notifications,
        unreadNotificationsCount,
        isSendingMessage,
        isEmailDrawerOpen,
        isProfileModalOpen,
        openProfileModal,
        closeProfileModal,
        updateUserProfile,
        selectedEmailForPreview,
        showNewUserModal,
        welcomeModalData,
        toast,
        showToast,
        hideToast,
        isAuthenticated,
        isProfileComplete,
        login,
        logout,
        completeUserProfile,
        registerOrSetPassword,
        switchUser,
        createNewUser,
        setShowNewUserModal,
        closeWelcomeModal,
        setActiveMentorshipId,
        startNewMentorship,
        sendMessageInActiveSession,
        advanceStage,
        updateActionPlan,
        markActionCompleted,
        saveLearnings,
        updateCompanyContext,
        addCompany,
        markNotificationsAsRead,
        openEmailDrawer,
        closeEmailDrawer,
        requestHumanMentor,
        updateMentorRequestStatus,
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
