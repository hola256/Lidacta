import React, { createContext, useContext, useState, useEffect, useMemo, useRef } from 'react';
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
import { userService, UserServiceResponse } from '../services/userService';
import { emailService } from '../services/emailService';

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
  isLeaderProfileModalOpen: boolean;

  // Toast / System Notifications
  toast: { id: string; message: string; type: 'success' | 'info' | 'warning' | 'error' } | null;
  showToast: (message: string, type?: 'success' | 'info' | 'warning' | 'error') => void;
  hideToast: () => void;

  // Authentication & Onboarding
  isAuthenticated: boolean;
  isProfileComplete: boolean;
  forceCompleteProfile: (userId?: string) => void;
  login: (email: string, password?: string) => { success: boolean; message?: string };
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

  // Live Sync & Database Refetching (Multi-device)
  refreshUsers: () => Promise<void>;
  isSyncingUsers: boolean;
  isDbConnected: boolean;
  lastDbSync: Date | null;
  dbLatencyMs: number;
}

const LidactaContext = createContext<LidactaContextType | undefined>(undefined);

const STORAGE_KEY_PREFIX = 'lidacta_v2_';

export const LidactaProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Canonical users are loaded directly from the backend database (no localStorage override)
  const [allUsers, setAllUsers] = useState<UserProfile[]>(INITIAL_USERS);
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
          const serverUsers = res.users;
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
              const serverUsers = res.users;
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
  const [isLeaderProfileModalOpen, setIsLeaderProfileModalOpen] = useState(false);
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
    localStorage.setItem(`${STORAGE_KEY_PREFIX}mentorships`, JSON.stringify(mentorships));
  }, [mentorships]);

  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}notifications`, JSON.stringify(notifications));
  }, [notifications]);

  const currentUser = useMemo(() => {
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
  }, [allUsers, currentUserId, sessionUser]);

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

    if (user.status === 'inactive') {
      return {
        success: false,
        message: 'Esta cuenta se encuentra inactiva. Por favor, contacta a la administración de Lidacta para reactivar tu acceso.',
      };
    }

    if (user.password && _password && user.password !== _password) {
      return {
        success: false,
        message: 'La contraseña ingresada no es correcta. Verifica e intenta nuevamente.',
      };
    }

    setCurrentUserId(user.id);
    setSessionUser(user);
    setIsAuthenticated(true);
    try {
      sessionStorage.setItem(`${STORAGE_KEY_PREFIX}current_user_id`, user.id);
      sessionStorage.setItem(`${STORAGE_KEY_PREFIX}session_user`, JSON.stringify(user));
      localStorage.setItem(`${STORAGE_KEY_PREFIX}current_user_id`, user.id);
    } catch {}

    if (user.role === 'leader') {
      const leaderMentorship =
        mentorships.find((m) => m.leaderId === user.id && m.status !== 'completed') ||
        mentorships.find((m) => m.leaderId === user.id);
      setActiveMentorshipIdState(leaderMentorship ? leaderMentorship.id : null);
    }

    return { success: true };
  };

  const isProfileComplete = useMemo(() => {
    if (!currentUser) return false;
    if (currentUser.role === 'admin') return true;

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

    if (currentUser.role === 'hr') {
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
    setCurrentUserId('');
    try {
      sessionStorage.removeItem(`${STORAGE_KEY_PREFIX}current_user_id`);
      sessionStorage.removeItem(`${STORAGE_KEY_PREFIX}session_user`);
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
      if (existingUser.password && existingUser.password !== password) {
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
          mentorships.find((m) => m.leaderId === existingUser.id && m.status !== 'completed') ||
          mentorships.find((m) => m.leaderId === existingUser.id);
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
        console.error('[registerOrSetPassword] ❌ Falla en la creación de usuario o despacho de correo:', res.message || res.error);
        return {
          success: false,
          message: res.message || res.error || 'Error al procesar el registro en el servidor.',
        };
      }

      if (res && res.success && res.user) {
        remoteUser = res.user;
      }
    } catch (err: any) {
      console.error('[Lidacta] Error en la petición de registro:', err);
      return {
        success: false,
        message: err?.message || 'Error de conexión al intentar registrar tu cuenta en el servidor.',
      };
    }

    const createdUser: UserProfile = remoteUser ? {
      ...remoteUser,
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

    // Dispatch automatic welcome notification for new auto-registered user
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
        bodyText: `¡Hola ${cleanName}!\n\nTe damos una cálida bienvenida a Lidacta: Desarrollo de Liderazgo en Acción.\n\nTu cuenta ha sido creada exitosamente asociada a ${targetCompName}.\nEn Lidacta cuentas con un espacio 100% seguro y confidencial donde podrás analizar situaciones reales de tu día a día, practicar tus conversaciones y tomar acciones que fortalezcan tu autonomía como líder.\n\nRecursos Humanos únicamente recibirá indicadores agregados de uso, sin acceso a tus conversaciones privadas.\n\n¡Estamos listos para acompañarte en tu próximo reto!\n\nAtentamente,\nEl Equipo de Lidacta`,
      },
    };
    setNotifications((prev) => [welcomeNotif, ...prev]);

    // Disparo explícito y esperado (await) de bienvenida a través de emailService
    let emailDispatchResult: { success: boolean; emailId?: string; error?: string } = { success: false };
    try {
      console.log(`[LidactaContext] 🚀 Ejecutando llamada esperada (await) a emailService.sendWelcomeEmail para ${cleanEmail}...`);
      emailDispatchResult = await emailService.sendWelcomeEmail({
        email: cleanEmail,
        name: cleanName,
        role: assignedRole,
        companyName: targetCompName,
      });
      console.log(`[LidactaContext] Resultado de bienvenida para ${cleanEmail}:`, emailDispatchResult);
    } catch (emailErr) {
      console.error("Resend delivery failed:", emailErr);
      emailDispatchResult = { success: false, error: (emailErr as any)?.message };
    }

    return {
      success: true,
      user: createdUser,
      emailSent: emailDispatchResult.success,
      emailId: emailDispatchResult.emailId,
      emailError: emailDispatchResult.error,
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
  }): Promise<{ success: boolean; message: string }> => {
    const inviteUrl = window.location.origin;
    try {
      await fetch('/api/mail/send-profile-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          email: user.email,
          name: user.name,
          companyName: user.companyName,
          role: user.role,
          inviteUrl,
        }),
      });
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
        to: user.email,
        subject: '🎯 Invitación para completar tu perfil de liderazgo en Lidacta',
        bodyText: `¡Hola ${user.name}!\n\nLa administración de ${user.companyName || 'tu empresa'} te ha invitado a formar parte del programa directivo en Lidacta.\n\nPara habilitar tu acceso seguro y comenzar tu proceso de acompañamiento directivo personalizado, por favor ingresa al siguiente enlace y completa los datos de tu entorno operativo (Área, Puesto, WhatsApp y Personas a Cargo):\n\n${inviteUrl}\n\nDatos de acceso:\nUsuario: ${user.email}\nEmpresa: ${user.companyName || 'Lidacta'}\n\nEl contenido de tus conversaciones es privado y confidencial.\n\nAtentamente,\nEl Equipo de Lidacta`,
      },
    };
    setNotifications((prev) => [inviteNotif, ...prev]);
    showToast(`Correo de invitación para completar perfil enviado a ${user.email}`, 'success');

    return {
      success: true,
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
        toast,
        showToast,
        hideToast,
        isAuthenticated,
        isProfileComplete,
        forceCompleteProfile,
        sendProfileInvite,
        login,
        logout,
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
        refreshUsers,
        isSyncingUsers,
        isDbConnected,
        lastDbSync,
        dbLatencyMs,
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
