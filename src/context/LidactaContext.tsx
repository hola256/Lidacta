import React, { createContext, useContext, useState, useEffect } from 'react';
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

  // Actions
  switchUser: (userId: string) => void;
  createNewUser: (profile: Partial<UserProfile>) => UserProfile;
  setShowNewUserModal: (open: boolean) => void;
  closeWelcomeModal: () => void;
  setActiveMentorshipId: (id: string | null) => void;
  startNewMentorship: (challengeText: string) => Promise<MentorshipSession>;
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
}

const LidactaContext = createContext<LidactaContextType | undefined>(undefined);

const STORAGE_KEY_PREFIX = 'lidacta_v1_';

export const LidactaProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Load from local storage or fallback to mock data
  const [allUsers, setAllUsers] = useState<UserProfile[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY_PREFIX}users`);
    return saved ? JSON.parse(saved) : INITIAL_USERS;
  });

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
  const [selectedEmailForPreview, setSelectedEmailForPreview] = useState<NotificationItem | null>(null);
  const [showNewUserModal, setShowNewUserModal] = useState(false);
  const [welcomeModalData, setWelcomeModalData] = useState<{ user: UserProfile; emailText: string } | null>(null);

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
    mentorships.find((m) => m.leaderId === currentUser.id) ||
    null;

  const unreadNotificationsCount = notifications.filter(
    (n) => !n.read && (n.recipientRole === currentUser.role || (n.recipientUserId && n.recipientUserId === currentUser.id))
  ).length;

  const switchUser = (userId: string) => {
    setCurrentUserId(userId);
    const targetUser = allUsers.find((u) => u.id === userId);
    if (targetUser && targetUser.role === 'leader') {
      const leaderMentorship = mentorships.find((m) => m.leaderId === targetUser.id);
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

  const startNewMentorship = async (challengeText: string): Promise<MentorshipSession> => {
    const company = companies.find((c) => c.id === currentUser.companyId) || companies[0];
    const newSessionId = `ment_${Date.now()}`;

    const newSession: MentorshipSession = {
      id: newSessionId,
      leaderId: currentUser.id,
      leaderName: currentUser.name,
      companyId: currentUser.companyId,
      companyName: currentUser.companyName,
      leaderArea: currentUser.area,
      title: challengeText.slice(0, 60) + (challengeText.length > 60 ? '...' : ''),
      initialChallenge: challengeText,
      currentStage: 1,
      theme: 'Alineación y Comunicación',
      status: 'active',
      startedAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
      stageHistory: [
        {
          stage: 1,
          stageName: 'Detectar qué sucede con profundidad',
          enteredAt: new Date().toISOString(),
        },
      ],
      messages: [
        {
          id: `msg_${Date.now()}_lead`,
          sender: 'leader',
          text: challengeText,
          timestamp: new Date().toISOString(),
          stage: 1,
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
      message: `${currentUser.name} ha empezado a usar Lidacta para abordar un reto de liderazgo.`,
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
          stage: 1,
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
        selectedEmailForPreview,
        showNewUserModal,
        welcomeModalData,
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
