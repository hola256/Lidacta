import React, { useState, useMemo, useEffect } from 'react';
import { useLidacta } from '../context/LidactaContext';
import { CompanyContext, MentorshipSession, UserProfile } from '../types/lidacta';
import { INTERNAL_LIBRARY_CATALOG, EXTERNAL_SOURCES_CATALOG } from '../data/mockData';
import { AddUserModal, EditUserModal, DeleteUserModal, ViewUserModal } from './UserManagementModals';
import {
  Building2,
  Sliders,
  TrendingUp,
  Clock,
  Layers,
  FileText,
  Download,
  Printer,
  Search,
  Plus,
  Upload,
  Link as LinkIcon,
  CheckCircle2,
  AlertTriangle,
  Eye,
  BarChart2,
  Users,
  ShieldAlert,
  Headphones,
  UserCheck,
  MessageSquare,
  Mail,
  ExternalLink,
  Check,
  PhoneCall,
  Sparkles,
  Pencil,
  Trash2,
  UserPlus,
  Filter,
  RefreshCw,
  Send,
  BookOpen,
  Library,
  Globe,
  BookmarkCheck,
} from 'lucide-react';

export const AdminView: React.FC = () => {
  const {
    companies,
    updateCompanyContext,
    addCompany,
    mentorships,
    allUsers,
    currentUser,
    notifications,
    recommendedResources,
    openEmailDrawer,
    openProfileModal,
    updateMentorRequestStatus,
    refreshUsers,
    isSyncingUsers,
    isDbConnected,
    lastDbSync,
    dbLatencyMs,
    updateUser,
    sendProfileInvite,
    impersonateUser,
    impersonateRole,
    openRoleWelcomeModal,
  } = useLidacta();

  const [isInspectorModalOpen, setIsInspectorModalOpen] = useState(false);

  const adminProfile = allUsers.find((u) => u.role === 'admin') || currentUser;

  const [activeTab, setActiveTab] = useState<
    'onboarding' | 'stages_monitoring' | 'analytics' | 'resources_analytics' | 'users' | 'mentor_requests'
  >('onboarding');
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>(companies[0]?.id || 'comp_nexus');
  const [selectedMentorshipForAudit, setSelectedMentorshipForAudit] = useState<MentorshipSession | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'pendiente' | 'contactado' | 'atendido'>('all');
  const [adminNoteInput, setAdminNoteInput] = useState<Record<string, string>>({});

  // Resource Analytics State & Filters
  const [resourceFilterLeader, setResourceFilterLeader] = useState<string>('all');
  const [resourceFilterTheme, setResourceFilterTheme] = useState<string>('all');
  const [resourceFilterOrigin, setResourceFilterOrigin] = useState<'all' | 'internal' | 'external'>('all');
  const [resourceFilterDifficulty, setResourceFilterDifficulty] = useState<'all' | 'Baja' | 'Media' | 'Alta'>('all');
  const [resourceSearchQuery, setResourceSearchQuery] = useState<string>('');
  const [selectedResourceForDetail, setSelectedResourceForDetail] = useState<any | null>(null);

  // Resource Analytics Metrics and Aggregations
  const resourceStats = useMemo(() => {
    const list = recommendedResources || [];
    const total = list.length;
    const internalCount = list.filter((r) => r.origin === 'internal').length;
    const externalCount = list.filter((r) => r.origin === 'external').length;
    const internalPercent = total > 0 ? Math.round((internalCount / total) * 100) : 0;
    const externalPercent = total > 0 ? Math.round((externalCount / total) * 100) : 0;

    // Unique leaders who have received resources
    const uniqueLeaderIds = new Set(list.map((r) => r.leaderId));
    const uniqueLeadersCount = uniqueLeaderIds.size;

    // Estimated Utility and Alignment Metrics
    const highUtilityCount = list.filter((r) => r.estimatedUtility === 'Muy Alta' || r.estimatedUtility === 'Alta' || !r.estimatedUtility).length;
    const highUtilityPercent = total > 0 ? Math.round((highUtilityCount / total) * 100) : 100;

    // Estimated Difficulty Breakdown
    const difficultyCounts = {
      baja: list.filter((r) => r.estimatedDifficulty === 'Baja').length,
      media: list.filter((r) => r.estimatedDifficulty === 'Media' || !r.estimatedDifficulty).length,
      alta: list.filter((r) => r.estimatedDifficulty === 'Alta').length,
    };

    // Internal Tools frequency count
    const internalFrequency: Record<string, { count: number; tool: any }> = {};
    INTERNAL_LIBRARY_CATALOG.forEach((cat) => {
      internalFrequency[cat.title] = { count: 0, tool: cat };
    });
    list.filter((r) => r.origin === 'internal').forEach((r) => {
      if (internalFrequency[r.resourceTitle]) {
        internalFrequency[r.resourceTitle].count += 1;
      } else {
        internalFrequency[r.resourceTitle] = {
          count: 1,
          tool: {
            id: r.id,
            title: r.resourceTitle,
            origin: 'internal',
            category: r.categoryOrTool || 'Herramienta Práctica (Bloque 3)',
            description: 'Herramienta interna recomendada por Lidacta.',
            authorOrSource: r.sourceOrAuthor || 'Biblioteca Interna Lidacta (Bloque 3)',
            urlOrRef: r.urlOrRef,
            recommendedStages: [r.stage],
            relatedThemes: [r.theme],
          },
        };
      }
    });

    const sortedInternalTools = Object.values(internalFrequency).sort((a, b) => b.count - a.count);

    // External Sources frequency count
    const externalFrequency: Record<string, { count: number; source: any }> = {};
    EXTERNAL_SOURCES_CATALOG.forEach((cat) => {
      externalFrequency[cat.title] = { count: 0, source: cat };
    });
    list.filter((r) => r.origin === 'external').forEach((r) => {
      if (externalFrequency[r.resourceTitle]) {
        externalFrequency[r.resourceTitle].count += 1;
      } else {
        externalFrequency[r.resourceTitle] = {
          count: 1,
          source: {
            id: r.id,
            title: r.resourceTitle,
            origin: 'external',
            category: r.categoryOrTool || 'Fuente Externa Delimitada',
            description: 'Referencia bibliográfica especializada consultada por Lidacta.',
            authorOrSource: r.sourceOrAuthor || 'Fuente Externa Delimitada',
            urlOrRef: r.urlOrRef,
            recommendedStages: [r.stage],
            relatedThemes: [r.theme],
          },
        };
      }
    });

    const sortedExternalSources = Object.values(externalFrequency).sort((a, b) => b.count - a.count);

    return {
      total,
      internalCount,
      externalCount,
      internalPercent,
      externalPercent,
      uniqueLeadersCount,
      highUtilityPercent,
      difficultyCounts,
      sortedInternalTools,
      sortedExternalSources,
    };
  }, [recommendedResources]);

  // Unique list of leaders who have received resources for the filter dropdown
  const leadersWithResources = useMemo(() => {
    const list = recommendedResources || [];
    const map = new Map<string, { id: string; name: string; email: string; companyName: string }>();
    list.forEach((r) => {
      if (!map.has(r.leaderId)) {
        map.set(r.leaderId, {
          id: r.leaderId,
          name: r.leaderName,
          email: r.leaderEmail,
          companyName: r.companyName,
        });
      }
    });
    return Array.from(map.values());
  }, [recommendedResources]);

  // Unique list of themes/challenges for the filter dropdown
  const uniqueResourceThemes = useMemo(() => {
    const list = recommendedResources || [];
    const set = new Set<string>();
    list.forEach((r) => {
      if (r.theme) set.add(r.theme);
      if (r.challengeTitle) set.add(r.challengeTitle);
    });
    return Array.from(set);
  }, [recommendedResources]);

  // Filtered list of detailed resource recommendations
  const filteredRecommendedResources = useMemo(() => {
    const list = recommendedResources || [];
    return list.filter((item) => {
      if (resourceFilterLeader !== 'all' && item.leaderId !== resourceFilterLeader) {
        return false;
      }
      if (resourceFilterOrigin !== 'all' && item.origin !== resourceFilterOrigin) {
        return false;
      }
      if (resourceFilterDifficulty !== 'all' && (item.estimatedDifficulty || 'Media') !== resourceFilterDifficulty) {
        return false;
      }
      if (resourceFilterTheme !== 'all' && item.theme !== resourceFilterTheme && item.challengeTitle !== resourceFilterTheme) {
        return false;
      }
      if (resourceSearchQuery.trim()) {
        const q = resourceSearchQuery.toLowerCase().trim();
        const matchTitle = item.resourceTitle.toLowerCase().includes(q);
        const matchLeader = item.leaderName.toLowerCase().includes(q);
        const matchCompany = item.companyName.toLowerCase().includes(q);
        const matchCat = (item.categoryOrTool || '').toLowerCase().includes(q);
        const matchSource = (item.sourceOrAuthor || '').toLowerCase().includes(q);
        const matchTheme = (item.theme || '').toLowerCase().includes(q);
        const matchChallenge = (item.challengeTitle || '').toLowerCase().includes(q);
        const matchReason = (item.utilityReason || '').toLowerCase().includes(q);
        const matchNotes = (item.resistanceOrDoubtNotes || '').toLowerCase().includes(q);
        if (!matchTitle && !matchLeader && !matchCompany && !matchCat && !matchSource && !matchTheme && !matchChallenge && !matchReason && !matchNotes) {
          return false;
        }
      }
      return true;
    });
  }, [recommendedResources, resourceFilterLeader, resourceFilterOrigin, resourceFilterDifficulty, resourceFilterTheme, resourceSearchQuery]);

  // User Management State (CRUD)
  const [searchUserQuery, setSearchUserQuery] = useState('');
  const [filterUserRole, setFilterUserRole] = useState<'all' | 'leader' | 'hr' | 'admin'>('all');
  const [filterUserStatus, setFilterUserStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);
  const [userToEdit, setUserToEdit] = useState<UserProfile | null>(null);
  const [userToDelete, setUserToDelete] = useState<UserProfile | null>(null);
  const [userToView, setUserToView] = useState<UserProfile | null>(null);
  const [sendingInviteUserId, setSendingInviteUserId] = useState<string | null>(null);
  const [invitedUserIds, setInvitedUserIds] = useState<Record<string, boolean>>({});

  const handleSendInviteToUser = async (u: UserProfile) => {
    setSendingInviteUserId(u.id);
    try {
      await sendProfileInvite({
        id: u.id,
        email: u.email,
        name: u.name,
        companyName: u.companyName,
        role: u.role,
      });
      setInvitedUserIds((prev) => ({ ...prev, [u.id]: true }));
    } catch (err) {
      console.warn('Error al enviar invitación:', err);
    } finally {
      setSendingInviteUserId(null);
    }
  };

  // Auto-refresh users on initial mount and whenever the users directory tab is viewed
  useEffect(() => {
    refreshUsers();
  }, []);

  useEffect(() => {
    if (activeTab === 'users') {
      refreshUsers();
    }
  }, [activeTab]);

  const filteredUsersList = useMemo(() => {
    return allUsers.filter((u) => {
      if (filterUserRole !== 'all' && u.role !== filterUserRole) return false;
      const uStatus = u.status || 'active';
      if (filterUserStatus !== 'all' && uStatus !== filterUserStatus) return false;
      if (searchUserQuery.trim()) {
        const q = searchUserQuery.toLowerCase().trim();
        const matchName = u.name.toLowerCase().includes(q);
        const matchEmail = u.email.toLowerCase().includes(q);
        const matchComp = (u.companyName || '').toLowerCase().includes(q);
        const matchPos = (u.position || '').toLowerCase().includes(q);
        const matchArea = (u.area || '').toLowerCase().includes(q);
        if (!matchName && !matchEmail && !matchComp && !matchPos && !matchArea) {
          return false;
        }
      }
      return true;
    });
  }, [allUsers, filterUserRole, filterUserStatus, searchUserQuery]);

  const mentorRequests = useMemo(() => {
    return notifications.filter((n) => n.type === 'mentor_request');
  }, [notifications]);

  const pendingRequestsCount = useMemo(() => {
    return mentorRequests.filter((n) => !n.mentorRequestDetails?.status || n.mentorRequestDetails?.status === 'pendiente').length;
  }, [mentorRequests]);

  const filteredMentorRequests = useMemo(() => {
    return mentorRequests.filter((n) => {
      if (statusFilter === 'all') return true;
      const status = n.mentorRequestDetails?.status || 'pendiente';
      return status === statusFilter;
    });
  }, [mentorRequests, statusFilter]);

  // Filters for segmentation
  const [segmentCompany, setSegmentCompany] = useState<string>('all');
  const [segmentArea, setSegmentArea] = useState<string>('all');
  const [segmentTheme, setSegmentTheme] = useState<string>('all');
  const [searchLeader, setSearchLeader] = useState<string>('');

  const currentCompany = companies.find((c) => c.id === selectedCompanyId) || companies[0];

  // Stage 0 Onboarding Form State
  const [onboardingValues, setOnboardingValues] = useState(currentCompany?.values || '');
  const [onboardingPhilosophy, setOnboardingPhilosophy] = useState(currentCompany?.philosophy || '');
  const [onboardingCulture, setOnboardingCulture] = useState(currentCompany?.culture || '');
  const [onboardingIndustry, setOnboardingIndustry] = useState(currentCompany?.industry || '');
  const [onboardingRhythm, setOnboardingRhythm] = useState(currentCompany?.workRhythm || '');
  const [onboardingCompetencies, setOnboardingCompetencies] = useState(
    currentCompany?.expectedCompetencies?.join(', ') || ''
  );
  const [newLinkTitle, setNewLinkTitle] = useState('');
  const [newLinkUrl, setNewLinkUrl] = useState('');
  const [saveSuccessMsg, setSaveSuccessMsg] = useState('');

  // Switch company in onboarding
  const handleSelectCompanyInOnboarding = (compId: string) => {
    setSelectedCompanyId(compId);
    const comp = companies.find((c) => c.id === compId);
    if (comp) {
      setOnboardingValues(comp.values || '');
      setOnboardingPhilosophy(comp.philosophy || '');
      setOnboardingCulture(comp.culture || '');
      setOnboardingIndustry(comp.industry || '');
      setOnboardingRhythm(comp.workRhythm || '');
      setOnboardingCompetencies(comp.expectedCompetencies?.join(', ') || '');
      setSaveSuccessMsg('');
    }
  };

  const handleSaveOnboarding = () => {
    const competenciesList = onboardingCompetencies
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    updateCompanyContext(selectedCompanyId, {
      values: onboardingValues,
      philosophy: onboardingPhilosophy,
      culture: onboardingCulture,
      industry: onboardingIndustry,
      workRhythm: onboardingRhythm,
      expectedCompetencies: competenciesList,
    });

    setSaveSuccessMsg('¡Contexto de la empresa guardado exitosamente para la Etapa Cero!');
    setTimeout(() => setSaveSuccessMsg(''), 4000);
  };

  const handleAddLink = () => {
    if (!newLinkTitle || !newLinkUrl) return;
    const currentLinks = currentCompany.webLinks || [];
    updateCompanyContext(selectedCompanyId, {
      webLinks: [...currentLinks, { title: newLinkTitle, url: newLinkUrl }],
    });
    setNewLinkTitle('');
    setNewLinkUrl('');
  };

  const handleAddAttachmentMock = () => {
    const filename = prompt('Nombre del documento / manual adjunto:', 'Guia_Liderazgo_Operativo_2026.pdf');
    if (!filename) return;
    const currentAttach = currentCompany.attachments || [];
    updateCompanyContext(selectedCompanyId, {
      attachments: [
        ...currentAttach,
        {
          name: filename,
          size: '1.9 MB',
          type: 'application/pdf',
          date: new Date().toISOString().split('T')[0],
        },
      ],
    });
  };

  // Filtered mentorships for segmentation
  const filteredMentorships = mentorships.filter((m) => {
    const matchCompany = segmentCompany === 'all' || m.companyId === segmentCompany;
    const matchArea = segmentArea === 'all' || m.leaderArea === segmentArea;
    const matchTheme = segmentTheme === 'all' || m.theme === segmentTheme;
    const matchSearch =
      !searchLeader ||
      m.leaderName.toLowerCase().includes(searchLeader.toLowerCase()) ||
      m.title.toLowerCase().includes(searchLeader.toLowerCase());
    return matchCompany && matchArea && matchTheme && matchSearch;
  });

  // Extract unique areas and themes for filters
  const uniqueAreas = Array.from(new Set(mentorships.map((m) => m.leaderArea).filter(Boolean)));
  const uniqueThemes = Array.from(new Set(mentorships.map((m) => m.theme).filter(Boolean)));

  // Analytics by company calculations
  const companyForStats = companies.find((c) => c.id === selectedCompanyId) || companies[0];
  const companyLeaders = allUsers.filter((u) => u.companyId === companyForStats.id && u.role === 'leader');
  const companyCases = mentorships.filter((m) => m.companyId === companyForStats.id);
  const uniqueUsersWhoUsed = Array.from(new Set(companyCases.map((m) => m.leaderId)));

  // Themes frequency
  const themeFrequency: Record<string, number> = {};
  companyCases.forEach((c) => {
    themeFrequency[c.theme] = (themeFrequency[c.theme] || 0) + 1;
  });

  // Export CSV
  const handleExportCSV = () => {
    const headers = [
      'ID Caso',
      'Empresa',
      'Líder',
      'Área',
      'Etapa Actual',
      'Tema',
      'Habilidades Requeridas',
      'Acción Realizada',
      'Aprendizajes',
      'Fecha Inicio',
    ];

    const rows = filteredMentorships.map((m) => [
      m.id,
      `"${m.companyName}"`,
      `"${m.leaderName}"`,
      `"${m.leaderArea || 'N/A'}"`,
      m.currentStage,
      `"${m.theme}"`,
      `"${(m.identifiedSkills || []).join('; ')}"`,
      `"${(m.actionPlan?.what || '').replace(/"/g, '""')}"`,
      `"${(m.learnings?.insights || '').replace(/"/g, '""')}"`,
      m.startedAt,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `lidacta_reporte_${selectedCompanyId}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex-1 bg-[#FFF7EF] overflow-y-auto min-w-0">
      <div className="w-full max-w-screen-xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8 space-y-6 sm:space-y-8">
        {/* Admin Header with Tab Navigation */}
        <div className="bg-white border border-[#493447]/15 rounded-2xl p-4 sm:p-6 shadow-xs flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 no-print">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-[#F7B538] bg-[#2D1B4E] px-2 py-0.5 rounded">
                Panel de Administradora · Creadora de Lidacta
              </span>
            </div>
            <h1 className="font-heading font-extrabold text-xl sm:text-2xl text-[#2D1B4E] mt-1">
              Gestión de Empresas, Etapa Cero y Auditoría de Flujo
            </h1>
            <p className="text-xs sm:text-sm text-[#4A3F55]">
              Configura el contexto empresarial y analiza la agilidad del líder en las 7 etapas operativas.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full lg:w-auto">
            {/* Inspector Mode / Role Simulation Button */}
            <button
              type="button"
              onClick={() => setIsInspectorModalOpen(true)}
              title="Simular roles de Líder o Recursos Humanos y verificar modales de bienvenida"
              className="min-h-[44px] flex items-center justify-center gap-1.5 px-3.5 py-2 bg-[#F7B538]/20 hover:bg-[#F7B538]/35 text-[#2D1B4E] border border-[#F7B538]/60 rounded-xl text-xs font-heading font-extrabold transition-all shadow-xs cursor-pointer active:scale-95 shrink-0"
            >
              <Sliders className="w-4 h-4 text-[#BF3A1B]" />
              <span>Simular Vista / Roles</span>
            </button>

            {/* Direct Admin Profile Access Button */}
            <button
              onClick={openProfileModal}
              title="Configurar mis datos personales y canales para Asesoría 1:1"
              className="min-h-[44px] flex items-center justify-center gap-1.5 px-3.5 py-2 bg-[#FFF7EF] hover:bg-[#FFD3BF]/50 text-[#2D1B4E] border border-[#BF3A1B]/30 hover:border-[#BF3A1B] rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95 shrink-0"
            >
              <UserCheck className="w-4 h-4 text-[#BF3A1B]" />
              <span>Mi Perfil Directivo</span>
            </button>

            {/* Tab Switcher */}
            <div className="flex items-center gap-1.5 p-1 bg-[#FFF7EF] border border-[#493447]/10 rounded-xl overflow-x-auto max-w-full w-full lg:w-auto pb-1">
            <button
              onClick={() => setActiveTab('onboarding')}
              className={`min-h-[44px] px-3 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center justify-center ${
                activeTab === 'onboarding'
                  ? 'bg-[#BF3A1B] text-white shadow-xs'
                  : 'text-[#4A3F55] hover:text-[#2D1B4E]'
              }`}
            >
              🏢 Etapa Cero (Onboarding)
            </button>
            <button
              onClick={() => setActiveTab('stages_monitoring')}
              className={`min-h-[44px] px-3 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center justify-center ${
                activeTab === 'stages_monitoring'
                  ? 'bg-[#BF3A1B] text-white shadow-xs'
                  : 'text-[#4A3F55] hover:text-[#2D1B4E]'
              }`}
            >
              ⏱️ Monitoreo & Tiempos
            </button>
            <button
              onClick={() => setActiveTab('analytics')}
              className={`min-h-[44px] px-3 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center justify-center ${
                activeTab === 'analytics'
                  ? 'bg-[#BF3A1B] text-white shadow-xs'
                  : 'text-[#4A3F55] hover:text-[#2D1B4E]'
              }`}
            >
              📊 Analítica & Gráficos
            </button>
            <button
              onClick={() => setActiveTab('resources_analytics')}
              className={`min-h-[44px] px-3 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center justify-center gap-1.5 ${
                activeTab === 'resources_analytics'
                  ? 'bg-[#BF3A1B] text-white shadow-xs'
                  : 'text-[#4A3F55] hover:text-[#2D1B4E]'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Analítica de Recursos</span>
              <span
                className={`ml-1 px-1.5 py-0.5 text-[10px] font-extrabold rounded-full leading-tight ${
                  activeTab === 'resources_analytics' ? 'bg-white/20 text-white' : 'bg-[#2D1B4E]/10 text-[#2D1B4E]'
                }`}
              >
                {recommendedResources.length}
              </span>
            </button>
            <button
              onClick={() => setActiveTab('users')}
              className={`min-h-[44px] px-3 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center justify-center ${
                activeTab === 'users'
                  ? 'bg-[#BF3A1B] text-white shadow-xs'
                  : 'text-[#4A3F55] hover:text-[#2D1B4E]'
              }`}
            >
              👥 Directorio de Usuarios
            </button>
            <button
              onClick={() => setActiveTab('mentor_requests')}
              className={`min-h-[44px] px-3 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center justify-center gap-1.5 ${
                activeTab === 'mentor_requests'
                  ? 'bg-[#BF3A1B] text-white shadow-xs'
                  : 'text-[#4A3F55] hover:text-[#2D1B4E]'
              }`}
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>Asesoría 1:1</span>
              {pendingRequestsCount > 0 && (
                <span className="ml-1 px-1.5 py-0.5 text-[10px] font-extrabold rounded-full bg-[#F7B538] text-[#2D1B4E] leading-tight animate-pulse">
                  {pendingRequestsCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

        {/* Urgent Notification Banner for Pending Mentor Requests */}
        {pendingRequestsCount > 0 && activeTab !== 'mentor_requests' && (
          <div className="bg-gradient-to-r from-[#BF3A1B]/15 via-[#FFF7EF] to-[#F7B538]/20 border-2 border-[#BF3A1B]/30 rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-in fade-in">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#BF3A1B] text-white flex items-center justify-center shrink-0 shadow-xs">
                <UserCheck className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-heading font-bold text-xs uppercase tracking-wider text-[#BF3A1B]">
                    Acompañamiento Personal Directivo
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-[#BF3A1B] text-white text-[10px] font-extrabold">
                    {pendingRequestsCount} {pendingRequestsCount === 1 ? 'pendiente' : 'pendientes'}
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-[#2D1B4E] font-medium mt-0.5">
                  Hay líderes solicitando una sesión directa de Asesoría 1:1 contigo (Tania Padierna).
                </p>
              </div>
            </div>
            <button
              onClick={() => setActiveTab('mentor_requests')}
              className="min-h-[44px] px-4 py-2 bg-[#BF3A1B] hover:bg-[#a63014] text-white font-heading font-extrabold text-xs rounded-xl shadow-xs transition-all cursor-pointer whitespace-nowrap active:scale-95 flex items-center gap-1.5"
            >
              <span>Ver Solicitudes</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

      {/* TAB 1: ETAPA CERO - ONBOARDING Y PERSONALIZACIÓN DE EMPRESA */}
      {activeTab === 'onboarding' && (
        <div className="space-y-6 animate-in fade-in">
          {/* Company Selector */}
          <div className="bg-white border border-[#493447]/10 rounded-2xl p-5 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <Building2 className="w-5 h-5 text-[#BF3A1B]" />
              <div className="flex flex-col">
                <span className="text-xs font-bold text-[#2D1B4E]">Empresa a configurar:</span>
                <span className="text-xs text-[#4A3F55]/70">Selecciona para alimentar la IA de Lidacta</span>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <select
                value={selectedCompanyId}
                onChange={(e) => handleSelectCompanyInOnboarding(e.target.value)}
                className="px-3 py-2 bg-[#FFF7EF] border border-[#493447]/15 rounded-xl text-xs font-bold text-[#2D1B4E] focus:outline-none focus:ring-1 focus:ring-[#BF3A1B] cursor-pointer"
              >
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.industry})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Context Editor Card */}
          <div className="bg-white border border-[#493447]/10 rounded-2xl p-6 sm:p-8 shadow-xs space-y-6">
            <div className="border-b border-[#493447]/10 pb-3 flex items-center justify-between">
              <div>
                <h2 className="font-heading font-bold text-lg text-[#2D1B4E]">
                  Información Contextual para {currentCompany.name}
                </h2>
                <p className="text-xs text-[#4A3F55]/80">
                  Lidacta adaptará automáticamente su vocabulario, enfoque e intervenciones a estos parámetros.
                </p>
              </div>
              {saveSuccessMsg && (
                <span className="text-xs font-bold text-[#246B2A] bg-[#E2F7E1] px-3 py-1 rounded-lg animate-in fade-in">
                  {saveSuccessMsg}
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
              <div className="space-y-1.5">
                <label className="font-bold text-[#2D1B4E] block">Giro / Industria de la empresa:</label>
                <input
                  type="text"
                  value={onboardingIndustry}
                  onChange={(e) => setOnboardingIndustry(e.target.value)}
                  placeholder="Ej. Manufactura automotriz, Retail comercial..."
                  className="w-full p-3 bg-[#FFF7EF]/50 border border-[#493447]/15 rounded-xl text-xs text-[#2D1B4E]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-[#2D1B4E] block">Ritmo y estilo de trabajo:</label>
                <input
                  type="text"
                  value={onboardingRhythm}
                  onChange={(e) => setOnboardingRhythm(e.target.value)}
                  placeholder="Ej. Rápido, turnos rotativos, juntas operativas de 15 min..."
                  className="w-full p-3 bg-[#FFF7EF]/50 border border-[#493447]/15 rounded-xl text-xs text-[#2D1B4E]"
                />
              </div>

              <div className="space-y-1.5 md:col-span-2">
                <label className="font-bold text-[#2D1B4E] block">Valores y Filosofía:</label>
                <textarea
                  value={onboardingValues}
                  onChange={(e) => setOnboardingValues(e.target.value)}
                  rows={3}
                  placeholder="Valores centrales que rigen la toma de decisiones..."
                  className="w-full p-3 bg-[#FFF7EF]/50 border border-[#493447]/15 rounded-xl text-xs text-[#2D1B4E] leading-relaxed"
                />
              </div>

              <div className="space-y-1.5 md:col-span-2">
                <label className="font-bold text-[#2D1B4E] block">
                  Habilidades o competencias esperadas en los líderes (separadas por comas):
                </label>
                <input
                  type="text"
                  value={onboardingCompetencies}
                  onChange={(e) => setOnboardingCompetencies(e.target.value)}
                  placeholder="Comunicación asertiva, retroalimentación en piso, delegación efectiva, resolución de conflictos..."
                  className="w-full p-3 bg-[#FFF7EF]/50 border border-[#493447]/15 rounded-xl text-xs text-[#2D1B4E]"
                />
              </div>

              <div className="space-y-1.5 md:col-span-2">
                <label className="font-bold text-[#2D1B4E] block">Cultura organizacional:</label>
                <textarea
                  value={onboardingCulture}
                  onChange={(e) => setOnboardingCulture(e.target.value)}
                  rows={2}
                  placeholder="Ambiente, expectativas de liderazgo, cómo se vive el día a día..."
                  className="w-full p-3 bg-[#FFF7EF]/50 border border-[#493447]/15 rounded-xl text-xs text-[#2D1B4E] leading-relaxed"
                />
              </div>
            </div>

            {/* Links & Attachments section as requested in PDF */}
            <div className="border-t border-[#493447]/10 pt-4 grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Web Links */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-[#2D1B4E] flex items-center gap-1.5">
                    <LinkIcon className="w-3.5 h-3.5 text-[#BF3A1B]" />
                    Enlaces Web de Consulta
                  </span>
                </div>

                <div className="flex flex-col sm:flex-row gap-2 text-xs">
                  <input
                    type="text"
                    value={newLinkTitle}
                    onChange={(e) => setNewLinkTitle(e.target.value)}
                    placeholder="Título del enlace"
                    className="flex-1 p-2.5 min-h-[44px] bg-[#FFF7EF]/50 border border-[#493447]/15 rounded-xl text-xs"
                  />
                  <input
                    type="url"
                    value={newLinkUrl}
                    onChange={(e) => setNewLinkUrl(e.target.value)}
                    placeholder="https://..."
                    className="flex-1 p-2.5 min-h-[44px] bg-[#FFF7EF]/50 border border-[#493447]/15 rounded-xl text-xs"
                  />
                  <button
                    onClick={handleAddLink}
                    className="min-h-[44px] px-4 py-2 bg-[#2D1B4E] text-white rounded-xl text-xs font-bold cursor-pointer shrink-0 active:scale-95"
                  >
                    Agregar
                  </button>
                </div>

                <div className="space-y-1.5">
                  {(currentCompany.webLinks || []).map((lnk, idx) => (
                    <div
                      key={idx}
                      className="p-2 bg-[#FFF7EF] rounded-lg border border-[#493447]/10 flex items-center justify-between text-xs"
                    >
                      <span className="font-medium text-[#2D1B4E]">{lnk.title}</span>
                      <span className="text-[#BF3A1B] text-[11px] truncate max-w-[150px]">{lnk.url}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Attachments */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-[#2D1B4E] flex items-center gap-1.5">
                    <Upload className="w-3.5 h-3.5 text-[#BF3A1B]" />
                    Archivos y Manuales Adjuntos
                  </span>
                  <button
                    onClick={handleAddAttachmentMock}
                    className="text-xs font-semibold text-[#BF3A1B] hover:underline cursor-pointer"
                  >
                    + Adjuntar archivo
                  </button>
                </div>

                <div className="space-y-1.5">
                  {(currentCompany.attachments || []).map((att, idx) => (
                    <div
                      key={idx}
                      className="p-2 bg-[#FFF7EF] rounded-lg border border-[#493447]/10 flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <FileText className="w-3.5 h-3.5 text-[#4A3F55]" />
                        <span className="font-medium text-[#2D1B4E]">{att.name}</span>
                      </div>
                      <span className="text-[10px] text-[#4A3F55]/60 tabular-nums">{att.size}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-[#493447]/10 flex justify-end">
              <button
                onClick={handleSaveOnboarding}
                className="px-6 py-2.5 bg-[#BF3A1B] hover:bg-[#a63014] text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                Guardar Contexto de Etapa Cero
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: MONITOREO DE ETAPAS, TIEMPOS Y AUDITORÍA DE CONVERSACIONES */}
      {activeTab === 'stages_monitoring' && (
        <div className="space-y-6 animate-in fade-in">
          {/* Segmentation & Filters */}
          <div className="bg-white border border-[#493447]/10 rounded-2xl p-5 shadow-xs space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <span className="font-heading font-bold text-sm text-[#2D1B4E] flex items-center gap-2">
                <Sliders className="w-4 h-4 text-[#BF3A1B]" />
                Segmentación y Filtros de Búsqueda
              </span>
              <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 w-full sm:w-auto">
                <button
                  onClick={handleExportCSV}
                  className="flex-1 sm:flex-none min-h-[44px] flex items-center justify-center gap-1.5 px-3 py-2 bg-[#FFF7EF] border border-[#493447]/15 rounded-xl text-xs font-semibold text-[#2D1B4E] hover:bg-[#FFD3BF]/20 cursor-pointer shadow-xs active:scale-95"
                >
                  <Download className="w-4 h-4 text-[#BF3A1B]" />
                  <span>Descargar CSV</span>
                </button>
                <button
                  onClick={() => window.print()}
                  className="flex-1 sm:flex-none min-h-[44px] flex items-center justify-center gap-1.5 px-3 py-2 bg-[#FFF7EF] border border-[#493447]/15 rounded-xl text-xs font-semibold text-[#2D1B4E] hover:bg-[#FFD3BF]/20 cursor-pointer shadow-xs active:scale-95"
                >
                  <Printer className="w-4 h-4 text-[#BF3A1B]" />
                  <span>Imprimir Reporte</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <label className="text-[11px] font-semibold text-[#4A3F55]/80 block mb-1">Empresa:</label>
                <select
                  value={segmentCompany}
                  onChange={(e) => setSegmentCompany(e.target.value)}
                  className="w-full p-2 bg-[#FFF7EF] border border-[#493447]/15 rounded-lg text-xs text-[#2D1B4E]"
                >
                  <option value="all">Todas las empresas</option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-[#4A3F55]/80 block mb-1">Área:</label>
                <select
                  value={segmentArea}
                  onChange={(e) => setSegmentArea(e.target.value)}
                  className="w-full p-2 bg-[#FFF7EF] border border-[#493447]/15 rounded-lg text-xs text-[#2D1B4E]"
                >
                  <option value="all">Todas las áreas</option>
                  {uniqueAreas.map((a, i) => (
                    <option key={i} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-[#4A3F55]/80 block mb-1">Tema abordado:</label>
                <select
                  value={segmentTheme}
                  onChange={(e) => setSegmentTheme(e.target.value)}
                  className="w-full p-2 bg-[#FFF7EF] border border-[#493447]/15 rounded-lg text-xs text-[#2D1B4E]"
                >
                  <option value="all">Todos los temas</option>
                  {uniqueThemes.map((t, i) => (
                    <option key={i} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-[#4A3F55]/80 block mb-1">Líder / Caso:</label>
                <input
                  type="text"
                  value={searchLeader}
                  onChange={(e) => setSearchLeader(e.target.value)}
                  placeholder="Buscar..."
                  className="w-full p-2 bg-[#FFF7EF] border border-[#493447]/15 rounded-lg text-xs text-[#2D1B4E]"
                />
              </div>
            </div>
          </div>

          {/* Table of Leaders, Stages, and Time Spent */}
          <div className="bg-white border border-[#493447]/10 rounded-2xl p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-[#493447]/10 pb-3">
              <div>
                <h3 className="font-heading font-bold text-base text-[#2D1B4E]">
                  Monitoreo de Etapas y Agilidad de Flujo
                </h3>
                <p className="text-xs text-[#4A3F55]/70">
                  Detecta qué tan ágil avanza cada líder o si está detenido en alguna etapa.
                </p>
              </div>
              <span className="text-xs font-semibold text-[#BF3A1B] tabular-nums">
                {filteredMentorships.length} casos activos
              </span>
            </div>

            {/* Mobile Cards for Mentorship Cases */}
            <div className="grid grid-cols-1 gap-3 md:hidden">
              {filteredMentorships.map((m) => {
                const currentHistoryItem = m.stageHistory.find((h) => h.stage === m.currentStage);
                const enteredDate = currentHistoryItem
                  ? new Date(currentHistoryItem.enteredAt).toLocaleDateString([], {
                      month: 'short',
                      day: 'numeric',
                    })
                  : 'N/A';
                const isStuck =
                  m.status !== 'completed' &&
                  currentHistoryItem &&
                  Date.now() - new Date(currentHistoryItem.enteredAt).getTime() > 1000 * 60 * 60 * 48;

                return (
                  <div key={m.id} className="p-4 bg-[#FFF7EF]/50 border border-[#493447]/10 rounded-2xl space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="font-bold text-xs text-[#2D1B4E] block">{m.leaderName}</span>
                        <span className="text-[10px] text-[#4A3F55]/70 block">{m.companyName}</span>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold shrink-0 ${
                          m.status === 'completed'
                            ? 'bg-[#E2F7E1] text-[#246B2A]'
                            : isStuck
                            ? 'bg-red-100 text-red-700'
                            : 'bg-[#FFD3BF] text-[#BF3A1B]'
                        }`}
                      >
                        {m.status === 'completed' ? 'Concluido' : `Etapa ${m.currentStage}`}
                      </span>
                    </div>

                    <div>
                      <h4 className="text-xs font-semibold text-[#2D1B4E]">{m.title}</h4>
                      <span className="text-[10px] text-[#BF3A1B]">{m.theme}</span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-[#4A3F55]/70 pt-2 border-t border-[#493447]/5">
                      <span>Entró: {enteredDate}</span>
                      <button
                        onClick={() => setSelectedMentorshipForAudit(m)}
                        className="min-h-[40px] px-3 py-1.5 bg-white border border-[#493447]/20 rounded-xl text-xs font-semibold text-[#2D1B4E] hover:border-[#BF3A1B] flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
                      >
                        <Eye className="w-3.5 h-3.5 text-[#BF3A1B]" />
                        <span>Ver Chat</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-[#FFF7EF] text-[#2D1B4E] uppercase text-[10px] tracking-wider font-bold">
                  <tr>
                    <th className="p-3">Líder & Empresa</th>
                    <th className="p-3">Caso Planteado</th>
                    <th className="p-3 text-center">Etapa Actual</th>
                    <th className="p-3">Fechas de Entrada</th>
                    <th className="p-3 text-right">Tiempo por Etapa</th>
                    <th className="p-3 text-center">Auditoría</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#493447]/5">
                  {filteredMentorships.map((m) => {
                    const currentHistoryItem = m.stageHistory.find((h) => h.stage === m.currentStage);
                    const enteredDate = currentHistoryItem
                      ? new Date(currentHistoryItem.enteredAt).toLocaleDateString([], {
                          month: 'short',
                          day: 'numeric',
                        })
                      : 'N/A';

                    // Check if leader is stuck (> 48h in same stage)
                    const isStuck =
                      m.status !== 'completed' &&
                      currentHistoryItem &&
                      Date.now() - new Date(currentHistoryItem.enteredAt).getTime() > 1000 * 60 * 60 * 48;

                    return (
                      <tr key={m.id} className="hover:bg-[#FFF7EF]/40 transition-colors">
                        <td className="p-3">
                          <span className="font-bold text-[#2D1B4E] block">{m.leaderName}</span>
                          <span className="text-[10px] text-[#4A3F55]/70 block">{m.companyName}</span>
                        </td>
                        <td className="p-3 max-w-xs">
                          <span className="font-medium text-[#2D1B4E] line-clamp-1">{m.title}</span>
                          <span className="text-[10px] text-[#BF3A1B]">{m.theme}</span>
                        </td>
                        <td className="p-3 text-center">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              m.status === 'completed'
                                ? 'bg-[#E2F7E1] text-[#246B2A]'
                               : isStuck
                                ? 'bg-red-100 text-red-700'
                                : 'bg-[#FFD3BF] text-[#BF3A1B]'
                            }`}
                          >
                            {m.status === 'completed' ? 'Concluido' : `Etapa ${m.currentStage}`}
                          </span>
                          {isStuck && (
                            <span className="block text-[9px] text-red-600 font-semibold mt-0.5">
                              ⚠️ Detenido
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-[#4A3F55] text-[11px] tabular-nums">
                          Entró a Etapa {m.currentStage}: {enteredDate}
                        </td>
                        <td className="p-3 text-right tabular-nums">
                          {m.stageHistory.map((h) => (
                            <div key={h.stage} className="text-[10px] text-[#4A3F55]">
                              E{h.stage}: {h.durationMinutes ? `${h.durationMinutes} min` : 'En curso'}
                            </div>
                          ))}
                        </td>
                        <td className="p-3 text-center">
                          <button
                            onClick={() => setSelectedMentorshipForAudit(m)}
                            className="flex items-center gap-1 mx-auto px-2.5 py-1 bg-white border border-[#493447]/20 rounded-lg text-xs font-semibold text-[#2D1B4E] hover:border-[#BF3A1B] transition-colors cursor-pointer"
                          >
                            <Eye className="w-3 h-3 text-[#BF3A1B]" />
                            <span>Ver Chat</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Full Conversation Audit Modal for Platform Creator */}
          {selectedMentorshipForAudit && (
            <div className="fixed inset-0 bg-[#2D1B4E]/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
              <div className="bg-white border border-[#493447]/20 rounded-2xl max-w-3xl w-full max-h-[85vh] flex flex-col shadow-2xl animate-in fade-in">
                <div className="p-5 border-b border-[#493447]/10 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#BF3A1B]">
                      Auditoría de Conversación Completa (Solo Administradora)
                    </span>
                    <h3 className="font-heading font-bold text-base text-[#2D1B4E]">
                      {selectedMentorshipForAudit.leaderName} · {selectedMentorshipForAudit.companyName}
                    </h3>
                  </div>
                  <button
                    onClick={() => setSelectedMentorshipForAudit(null)}
                    className="p-1.5 text-[#4A3F55] hover:text-[#2D1B4E] rounded-lg cursor-pointer font-bold"
                  >
                    ✕
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-5 space-y-4">
                  {selectedMentorshipForAudit.messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`p-3 rounded-xl text-xs space-y-1 ${
                        msg.sender === 'lidacta'
                          ? 'bg-[#FFF7EF] border border-[#493447]/10 mr-8'
                          : 'bg-[#FFD3BF]/30 border border-[#FFD3BF] ml-8'
                      }`}
                    >
                      <div className="flex justify-between font-bold text-[10px] text-[#2D1B4E]">
                        <span>{msg.sender === 'lidacta' ? 'LIDACTA (Mentor)' : 'LÍDER'}</span>
                        <span className="text-[#4A3F55]/60">Etapa {msg.stage}</span>
                      </div>
                      <p className="text-[#4A3F55] leading-relaxed whitespace-pre-line">{msg.text}</p>
                    </div>
                  ))}
                </div>

                <div className="p-4 border-t border-[#493447]/10 bg-[#FFF7EF] rounded-b-2xl flex justify-end">
                  <button
                    onClick={() => setSelectedMentorshipForAudit(null)}
                    className="px-4 py-2 bg-[#2D1B4E] text-white font-bold text-xs rounded-xl cursor-pointer"
                  >
                    Cerrar Auditoría
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: ANALÍTICA Y GRÁFICOS POR EMPRESA */}
      {activeTab === 'analytics' && (
        <div className="space-y-6 animate-in fade-in">
          {/* Company selector */}
          <div className="bg-white border border-[#493447]/10 rounded-2xl p-5 shadow-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BarChart2 className="w-5 h-5 text-[#BF3A1B]" />
              <h2 className="font-heading font-bold text-base text-[#2D1B4E]">
                Métricas de Impacto para {companyForStats.name}
              </h2>
            </div>
            <select
              value={selectedCompanyId}
              onChange={(e) => setSelectedCompanyId(e.target.value)}
              className="px-3 py-1.5 bg-[#FFF7EF] border border-[#493447]/15 rounded-lg text-xs font-bold text-[#2D1B4E]"
            >
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Chart 1: Líderes Registrados vs. Usaron Lidacta (PDF Example) */}
            <div className="bg-white border border-[#493447]/10 rounded-2xl p-6 shadow-xs space-y-4">
              <h3 className="font-heading font-bold text-sm text-[#2D1B4E]">
                1. Adopción: Registrados vs. Usaron Lidacta
              </h3>
              <p className="text-xs text-[#4A3F55]/70">
                Ejemplo del PDF: "La empresa tuvo 20 líderes registrados, 18 usaron Lidacta"
              </p>

              <div className="space-y-3 pt-2">
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-semibold text-[#2D1B4E]">Líderes Registrados</span>
                    <span className="font-bold tabular-nums text-[#2D1B4E]">{companyLeaders.length} líderes</span>
                  </div>
                  <div className="w-full bg-[#FFF7EF] h-4 rounded-full overflow-hidden border border-[#493447]/10">
                    <div className="bg-[#2D1B4E] h-full rounded-full w-full" />
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-semibold text-[#BF3A1B]">Usaron Lidacta</span>
                    <span className="font-bold tabular-nums text-[#BF3A1B]">
                      {uniqueUsersWhoUsed.length} líderes (
                      {companyLeaders.length > 0
                        ? Math.round((uniqueUsersWhoUsed.length / companyLeaders.length) * 100)
                        : 0}
                      %)
                    </span>
                  </div>
                  <div className="w-full bg-[#FFF7EF] h-4 rounded-full overflow-hidden border border-[#493447]/10">
                    <div
                      className="bg-[#BF3A1B] h-full rounded-full transition-all"
                      style={{
                        width: `${
                          companyLeaders.length > 0
                            ? (uniqueUsersWhoUsed.length / companyLeaders.length) * 100
                            : 0
                        }%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Chart 2: Temas más abordados por frecuencia */}
            <div className="bg-white border border-[#493447]/10 rounded-2xl p-6 shadow-xs space-y-4">
              <h3 className="font-heading font-bold text-sm text-[#2D1B4E]">
                2. Frecuencia de Temas Abordados
              </h3>
              <p className="text-xs text-[#4A3F55]/70">
                Distribución de problemáticas reales planteadas por los líderes
              </p>

              <div className="space-y-2.5 pt-2">
                {Object.entries(themeFrequency).map(([thm, cnt], i) => (
                  <div key={i} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="font-medium text-[#2D1B4E] truncate max-w-[200px]">{thm}</span>
                      <span className="font-bold text-[#BF3A1B] tabular-nums">{cnt} casos</span>
                    </div>
                    <div className="w-full bg-[#FFF7EF] h-2.5 rounded-full overflow-hidden border border-[#493447]/5">
                      <div
                        className="bg-[#E8512F] h-full rounded-full"
                        style={{ width: `${Math.min(100, (cnt / companyCases.length) * 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB: ANALÍTICA DE RECURSOS RECOMENDADOS (BLOQUE 3 & FUENTES EXTERNAS) */}
      {activeTab === 'resources_analytics' && (
        <div className="space-y-6 animate-in fade-in">
          {/* Header Card with Silent Capture Notice */}
          <div className="bg-white border border-[#493447]/10 rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-[#2D1B4E]/10 text-[#2D1B4E] flex items-center justify-center shrink-0">
                    <BookOpen className="w-5 h-5 text-[#2D1B4E]" />
                  </div>
                  <h3 className="font-heading font-extrabold text-lg sm:text-xl text-[#2D1B4E]">
                    Analítica de Recursos Recomendados por Lidacta
                  </h3>
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#246B2A] bg-emerald-50 px-3 py-1 rounded-full border border-[#246B2A]/20 shadow-2xs">
                    <Sparkles className="w-3.5 h-3.5 text-[#246B2A]" />
                    <span>100% Invisible para el Líder · Registro Automático en Segundo Plano</span>
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-[#4A3F55]/80 mt-1.5 max-w-3xl leading-relaxed">
                  Monitoreo silencioso y exhaustivo de las herramientas prácticas y fuentes que el motor de Lidacta entrega implícitamente a los líderes según sus desafíos conversacionales y avance en las 6 etapas.
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs font-bold text-[#4A3F55] bg-[#FFF7EF] border border-[#FFD3BF] px-3 py-1.5 rounded-xl">
                  Total Registros: <strong className="text-[#BF3A1B] font-extrabold ml-1">{resourceStats.total}</strong>
                </span>
              </div>
            </div>

            {/* Global Metrics Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
              <div className="bg-[#FFF7EF]/60 border border-[#FFD3BF]/60 rounded-xl p-4 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#4A3F55] uppercase tracking-wider">Total Recursos</span>
                  <div className="w-8 h-8 rounded-lg bg-[#BF3A1B]/10 text-[#BF3A1B] flex items-center justify-center">
                    <Layers className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3">
                  <div className="text-2xl font-heading font-black text-[#2D1B4E]">{resourceStats.total}</div>
                  <p className="text-[11px] text-[#4A3F55]/70 mt-0.5">Sugeridos a líderes en sesiones</p>
                </div>
              </div>

              <div className="bg-emerald-50/60 border border-emerald-200/60 rounded-xl p-4 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-900 uppercase tracking-wider">Biblioteca Interna</span>
                  <div className="w-8 h-8 rounded-lg bg-[#246B2A]/15 text-[#246B2A] flex items-center justify-center">
                    <Library className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3">
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-heading font-black text-[#246B2A]">{resourceStats.internalCount}</span>
                    <span className="text-xs font-bold text-[#246B2A] bg-emerald-100/80 px-2 py-0.5 rounded-full">
                      {resourceStats.internalPercent}% del total
                    </span>
                  </div>
                  <p className="text-[11px] text-emerald-800/70 mt-0.5">Herramientas Bloque 3 Lidacta</p>
                </div>
              </div>

              <div className="bg-[#2D1B4E]/5 border border-[#2D1B4E]/15 rounded-xl p-4 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#2D1B4E] uppercase tracking-wider">Fuentes Externas</span>
                  <div className="w-8 h-8 rounded-lg bg-[#2D1B4E]/10 text-[#2D1B4E] flex items-center justify-center">
                    <Globe className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3">
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-heading font-black text-[#2D1B4E]">{resourceStats.externalCount}</span>
                    <span className="text-xs font-bold text-[#2D1B4E] bg-[#2D1B4E]/10 px-2 py-0.5 rounded-full">
                      {resourceStats.externalPercent}% del total
                    </span>
                  </div>
                  <p className="text-[11px] text-[#4A3F55]/70 mt-0.5">Bibliografía y artículos delimitados</p>
                </div>
              </div>

              <div className="bg-[#F7B538]/10 border border-[#F7B538]/30 rounded-xl p-4 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#2D1B4E] uppercase tracking-wider">Líderes Impactados</span>
                  <div className="w-8 h-8 rounded-lg bg-[#F7B538]/30 text-[#2D1B4E] flex items-center justify-center">
                    <Users className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3">
                  <div className="text-2xl font-heading font-black text-[#2D1B4E]">{resourceStats.uniqueLeadersCount}</div>
                  <p className="text-[11px] text-[#4A3F55]/70 mt-0.5">Líderes con al menos 1 entrega</p>
                </div>
              </div>
            </div>

            {/* Visual Balance Bar */}
            <div className="bg-[#FFF7EF]/40 border border-[#FFD3BF]/40 rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-[#2D1B4E]">
                <span className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-[#246B2A] inline-block" />
                  <span>Biblioteca Interna Lidacta (Bloque 3): {resourceStats.internalPercent}% ({resourceStats.internalCount})</span>
                </span>
                <span className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-[#2D1B4E] inline-block" />
                  <span>Fuentes Externas Delimitadas: {resourceStats.externalPercent}% ({resourceStats.externalCount})</span>
                </span>
              </div>
              <div className="w-full bg-[#2D1B4E] h-3.5 rounded-full overflow-hidden flex shadow-inner">
                <div
                  className="bg-[#246B2A] h-full transition-all duration-500 ease-out flex items-center justify-center text-[9px] text-white font-extrabold"
                  style={{ width: `${resourceStats.internalPercent}%` }}
                >
                  {resourceStats.internalPercent > 10 ? `${resourceStats.internalPercent}%` : ''}
                </div>
                <div
                  className="bg-[#2D1B4E] h-full transition-all duration-500 ease-out flex items-center justify-center text-[9px] text-white font-extrabold"
                  style={{ width: `${resourceStats.externalPercent}%` }}
                >
                  {resourceStats.externalPercent > 10 ? `${resourceStats.externalPercent}%` : ''}
                </div>
              </div>
            </div>

            {/* Contextual Diagnosis Bar: Utility & Difficulty */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
              <div className="bg-[#246B2A]/5 border border-[#246B2A]/20 rounded-xl p-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-[#246B2A]/15 text-[#246B2A] flex items-center justify-center shrink-0">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[11px] font-bold text-[#2D1B4E] block">Alineación / Utilidad Estimada</span>
                    <span className="text-[10px] text-[#4A3F55]/70">Nivel de pertinencia con el problema del líder</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-xs font-black text-[#246B2A] bg-emerald-100/80 px-2.5 py-1 rounded-full border border-[#246B2A]/30">
                    {resourceStats.highUtilityPercent}% Alta / Muy Alta
                  </span>
                </div>
              </div>

              <div className="bg-[#FFF7EF] border border-[#FFD3BF] rounded-xl p-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-[#BF3A1B]/10 text-[#BF3A1B] flex items-center justify-center shrink-0">
                    <AlertTriangle className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[11px] font-bold text-[#2D1B4E] block">Dificultad Estimada de Adopción</span>
                    <span className="text-[10px] text-[#4A3F55]/70">Resistencia o esfuerzo de aplicación en piso</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 text-[10px] font-bold">
                  <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-200">
                    Baja: {resourceStats.difficultyCounts.baja}
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-[#F7B538]/20 text-[#2D1B4E] border border-[#F7B538]/40">
                    Media: {resourceStats.difficultyCounts.media}
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 border border-rose-200">
                    Alta: {resourceStats.difficultyCounts.alta}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Catalog Tables: Bloque 3 & Fuentes Externas side by side */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Table 1: Biblioteca Interna (Bloque 3) */}
            <div className="bg-white border border-[#493447]/10 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between border-b border-[#493447]/10 pb-3 mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-emerald-50 text-[#246B2A] flex items-center justify-center">
                      <Library className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-heading font-extrabold text-sm sm:text-base text-[#2D1B4E]">
                        Biblioteca Interna (Bloque 3)
                      </h4>
                      <p className="text-[11px] text-[#4A3F55]/70">
                        Herramientas prácticas propietarias más recomendadas
                      </p>
                    </div>
                  </div>
                  <span className="text-[11px] font-extrabold text-[#246B2A] bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                    {INTERNAL_LIBRARY_CATALOG.length} Herramientas
                  </span>
                </div>

                <div className="divide-y divide-[#493447]/10">
                  {resourceStats.sortedInternalTools.map(({ tool, count }) => {
                    const maxToolCount = Math.max(...resourceStats.sortedInternalTools.map((t) => t.count), 1);
                    const pctOfMax = Math.round((count / maxToolCount) * 100);
                    return (
                      <div key={tool.id || tool.title} className="py-3 hover:bg-[#FFF7EF]/30 px-2 rounded-lg transition-colors">
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-xs sm:text-sm text-[#2D1B4E] truncate">
                                {tool.title}
                              </span>
                              <span className="text-[10px] font-semibold text-[#BF3A1B] bg-[#FFF7EF] border border-[#FFD3BF] px-1.5 py-0.2 rounded">
                                {tool.category}
                              </span>
                            </div>
                            <p className="text-[11px] text-[#4A3F55]/70 line-clamp-1">
                              {tool.description}
                            </p>
                            <div className="flex items-center gap-1.5 pt-0.5 flex-wrap">
                              <span className="text-[10px] text-[#4A3F55]/60 font-semibold">Etapas:</span>
                              {(tool.recommendedStages || [2, 3]).map((stg: number) => (
                                <span key={stg} className="text-[9px] font-bold bg-[#2D1B4E]/5 text-[#2D1B4E] px-1 rounded">
                                  Etapa {stg}
                                </span>
                              ))}
                            </div>
                          </div>

                          <div className="text-right shrink-0 flex flex-col items-end">
                            <div className="flex items-baseline gap-1">
                              <span className="text-sm font-heading font-black text-[#246B2A]">{count}</span>
                              <span className="text-[10px] text-[#4A3F55]/60 font-medium">sug.</span>
                            </div>
                            <div className="w-16 bg-gray-100 h-1.5 rounded-full mt-1 overflow-hidden">
                              <div
                                className="bg-[#246B2A] h-full rounded-full"
                                style={{ width: `${pctOfMax}%` }}
                              />
                            </div>
                            <button
                              type="button"
                              onClick={() => setSelectedResourceForDetail(tool)}
                              className="text-[10px] font-bold text-[#BF3A1B] hover:text-[#2D1B4E] mt-1.5 flex items-center gap-0.5 cursor-pointer"
                            >
                              <span>Ver</span>
                              <ExternalLink className="w-2.5 h-2.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Table 2: Fuentes Externas Delimitadas */}
            <div className="bg-white border border-[#493447]/10 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between border-b border-[#493447]/10 pb-3 mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-[#2D1B4E]/10 text-[#2D1B4E] flex items-center justify-center">
                      <Globe className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-heading font-extrabold text-sm sm:text-base text-[#2D1B4E]">
                        Fuentes Externas Delimitadas
                      </h4>
                      <p className="text-[11px] text-[#4A3F55]/70">
                        Bibliografía y artículos consultados por Lidacta
                      </p>
                    </div>
                  </div>
                  <span className="text-[11px] font-extrabold text-[#2D1B4E] bg-[#2D1B4E]/5 border border-[#2D1B4E]/15 px-2 py-0.5 rounded-full">
                    {EXTERNAL_SOURCES_CATALOG.length} Fuentes
                  </span>
                </div>

                <div className="divide-y divide-[#493447]/10">
                  {resourceStats.sortedExternalSources.map(({ source, count }) => {
                    const maxSourceCount = Math.max(...resourceStats.sortedExternalSources.map((s) => s.count), 1);
                    const pctOfMax = Math.round((count / maxSourceCount) * 100);
                    return (
                      <div key={source.id || source.title} className="py-3 hover:bg-[#FFF7EF]/30 px-2 rounded-lg transition-colors">
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-xs sm:text-sm text-[#2D1B4E] truncate">
                                {source.title}
                              </span>
                              <span className="text-[10px] font-semibold text-[#2D1B4E] bg-[#2D1B4E]/5 border border-[#2D1B4E]/15 px-1.5 py-0.2 rounded">
                                {source.category}
                              </span>
                            </div>
                            <p className="text-[11px] text-[#4A3F55]/70 line-clamp-1">
                              {source.authorOrSource} · {source.description}
                            </p>
                            <div className="flex items-center gap-1.5 pt-0.5 flex-wrap">
                              <span className="text-[10px] text-[#4A3F55]/60 font-semibold">Etapas:</span>
                              {(source.recommendedStages || [2, 3]).map((stg: number) => (
                                <span key={stg} className="text-[9px] font-bold bg-[#2D1B4E]/5 text-[#2D1B4E] px-1 rounded">
                                  Etapa {stg}
                                </span>
                              ))}
                            </div>
                          </div>

                          <div className="text-right shrink-0 flex flex-col items-end">
                            <div className="flex items-baseline gap-1">
                              <span className="text-sm font-heading font-black text-[#2D1B4E]">{count}</span>
                              <span className="text-[10px] text-[#4A3F55]/60 font-medium">sug.</span>
                            </div>
                            <div className="w-16 bg-gray-100 h-1.5 rounded-full mt-1 overflow-hidden">
                              <div
                                className="bg-[#2D1B4E] h-full rounded-full"
                                style={{ width: `${pctOfMax}%` }}
                              />
                            </div>
                            <button
                              type="button"
                              onClick={() => setSelectedResourceForDetail(source)}
                              className="text-[10px] font-bold text-[#BF3A1B] hover:text-[#2D1B4E] mt-1.5 flex items-center gap-0.5 cursor-pointer"
                            >
                              <span>Ver</span>
                              <ExternalLink className="w-2.5 h-2.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Interactive Filters & Detailed Delivery Log */}
          <div className="bg-white border border-[#493447]/10 rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-[#493447]/10 pb-3">
              <div>
                <h4 className="font-heading font-extrabold text-base text-[#2D1B4E] flex items-center gap-2">
                  <BookmarkCheck className="w-4 h-4 text-[#BF3A1B]" />
                  <span>Bitácora Detallada de Entregas por Líder</span>
                </h4>
                <p className="text-xs text-[#4A3F55]/70">
                  Historial en tiempo real de recursos sugeridos en sesiones de chat y avances de etapa
                </p>
              </div>

              {/* Reset Filters button if any active */}
              {(resourceFilterLeader !== 'all' || resourceFilterOrigin !== 'all' || resourceFilterTheme !== 'all' || resourceSearchQuery) && (
                <button
                  type="button"
                  onClick={() => {
                    setResourceFilterLeader('all');
                    setResourceFilterOrigin('all');
                    setResourceFilterDifficulty('all');
                    setResourceFilterTheme('all');
                    setResourceSearchQuery('');
                  }}
                  className="text-xs font-bold text-[#BF3A1B] hover:text-[#2D1B4E] underline cursor-pointer self-start md:self-auto"
                >
                  Restablecer filtros
                </button>
              )}
            </div>

            {/* Filter Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
              {/* Leader Filter */}
              <div>
                <label className="block text-[11px] font-bold text-[#4A3F55] mb-1">
                  Filtrar por Líder:
                </label>
                <select
                  value={resourceFilterLeader}
                  onChange={(e) => setResourceFilterLeader(e.target.value)}
                  className="w-full text-xs font-medium border border-[#493447]/20 rounded-xl px-3 py-2 bg-white text-[#2D1B4E] focus:outline-none focus:ring-2 focus:ring-[#BF3A1B]/30"
                >
                  <option value="all">Todos los Líderes ({leadersWithResources.length})</option>
                  {leadersWithResources.map((ldr) => (
                    <option key={ldr.id} value={ldr.id}>
                      {ldr.name} ({ldr.companyName})
                    </option>
                  ))}
                </select>
              </div>

              {/* Theme/Challenge Filter */}
              <div>
                <label className="block text-[11px] font-bold text-[#4A3F55] mb-1">
                  Filtrar por Desafío / Tema:
                </label>
                <select
                  value={resourceFilterTheme}
                  onChange={(e) => setResourceFilterTheme(e.target.value)}
                  className="w-full text-xs font-medium border border-[#493447]/20 rounded-xl px-3 py-2 bg-white text-[#2D1B4E] focus:outline-none focus:ring-2 focus:ring-[#BF3A1B]/30"
                >
                  <option value="all">Todos los Temas ({uniqueResourceThemes.length})</option>
                  {uniqueResourceThemes.map((thm) => (
                    <option key={thm} value={thm}>
                      {thm}
                    </option>
                  ))}
                </select>
              </div>

              {/* Origin Filter */}
              <div>
                <label className="block text-[11px] font-bold text-[#4A3F55] mb-1">
                  Origen del Recurso:
                </label>
                <select
                  value={resourceFilterOrigin}
                  onChange={(e) => setResourceFilterOrigin(e.target.value as any)}
                  className="w-full text-xs font-medium border border-[#493447]/20 rounded-xl px-3 py-2 bg-white text-[#2D1B4E] focus:outline-none focus:ring-2 focus:ring-[#BF3A1B]/30"
                >
                  <option value="all">Todos los Orígenes</option>
                  <option value="internal">Biblioteca Interna (Bloque 3)</option>
                  <option value="external">Fuentes Externas Delimitadas</option>
                </select>
              </div>

              {/* Difficulty Filter */}
              <div>
                <label className="block text-[11px] font-bold text-[#4A3F55] mb-1">
                  Dificultad Estimada:
                </label>
                <select
                  value={resourceFilterDifficulty}
                  onChange={(e) => setResourceFilterDifficulty(e.target.value as any)}
                  className="w-full text-xs font-medium border border-[#493447]/20 rounded-xl px-3 py-2 bg-white text-[#2D1B4E] focus:outline-none focus:ring-2 focus:ring-[#BF3A1B]/30"
                >
                  <option value="all">Todas las Dificultades</option>
                  <option value="Baja">Baja (Fácil adopción)</option>
                  <option value="Media">Media (Fricción moderada)</option>
                  <option value="Alta">Alta (Resistencia cultural)</option>
                </select>
              </div>

              {/* Text Search */}
              <div>
                <label className="block text-[11px] font-bold text-[#4A3F55] mb-1">
                  Búsqueda Rápida:
                </label>
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-[#4A3F55]/50 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={resourceSearchQuery}
                    onChange={(e) => setResourceSearchQuery(e.target.value)}
                    placeholder="Buscar título, tema, notas..."
                    className="w-full text-xs border border-[#493447]/20 rounded-xl pl-8 pr-3 py-2 bg-white text-[#2D1B4E] focus:outline-none focus:ring-2 focus:ring-[#BF3A1B]/30"
                  />
                </div>
              </div>
            </div>

            {/* Results Counter */}
            <div className="flex items-center justify-between text-xs text-[#4A3F55]/70 pt-1">
              <span>
                Mostrando <strong className="text-[#2D1B4E] font-bold">{filteredRecommendedResources.length}</strong> de{' '}
                {recommendedResources.length} recomendaciones registradas
              </span>
            </div>

            {/* Deliveries Table */}
            <div className="overflow-x-auto rounded-xl border border-[#493447]/10">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#FFF7EF] border-b border-[#493447]/10 text-[#2D1B4E] font-heading font-extrabold uppercase text-[10px] tracking-wider">
                    <th className="py-3 px-3">Líder & Empresa</th>
                    <th className="py-3 px-3">Recurso Recomendado</th>
                    <th className="py-3 px-3">Origen</th>
                    <th className="py-3 px-3">Desafío / Tema</th>
                    <th className="py-3 px-3 text-center">Alineación / Utilidad</th>
                    <th className="py-3 px-3 text-center">Dificultad Estimada</th>
                    <th className="py-3 px-3 text-center">Etapa</th>
                    <th className="py-3 px-3">Fecha y Hora</th>
                    <th className="py-3 px-3 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#493447]/10">
                  {filteredRecommendedResources.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-xs text-[#4A3F55]/60">
                        No se encontraron recursos que coincidan con los filtros seleccionados.
                      </td>
                    </tr>
                  ) : (
                    filteredRecommendedResources.map((item) => (
                      <tr key={item.id} className="hover:bg-[#FFF7EF]/40 transition-colors">
                        <td className="py-3 px-3 font-medium">
                          <div className="font-bold text-[#2D1B4E]">{item.leaderName}</div>
                          <div className="text-[10px] text-[#4A3F55]/70">{item.companyName}</div>
                        </td>

                        <td className="py-3 px-3 max-w-xs">
                          <div className="font-bold text-[#2D1B4E] line-clamp-1">{item.resourceTitle}</div>
                          <div className="text-[10px] text-[#4A3F55]/60 truncate">
                            {item.sourceOrAuthor || item.categoryOrTool || 'Recurso de acompañamiento'}
                          </div>
                        </td>

                        <td className="py-3 px-3 whitespace-nowrap">
                          {item.origin === 'internal' ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-[#246B2A] bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                              <Library className="w-3 h-3 text-[#246B2A]" />
                              <span>Biblioteca Interna</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-[#2D1B4E] bg-[#2D1B4E]/5 border border-[#2D1B4E]/15 px-2 py-0.5 rounded-full">
                              <Globe className="w-3 h-3 text-[#2D1B4E]" />
                              <span>Fuente Externa</span>
                            </span>
                          )}
                        </td>

                        <td className="py-3 px-3 max-w-xs">
                          <span className="inline-block text-[11px] text-[#4A3F55] font-medium bg-[#FFF7EF] border border-[#FFD3BF] px-2 py-0.5 rounded-md truncate max-w-full">
                            {item.theme || item.challengeTitle}
                          </span>
                        </td>

                        <td className="py-3 px-3 text-center whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                              item.estimatedUtility === 'Muy Alta' || !item.estimatedUtility
                                ? 'bg-emerald-50 text-[#246B2A] border-emerald-200'
                                : item.estimatedUtility === 'Alta'
                                ? 'bg-green-50 text-green-800 border-green-200'
                                : 'bg-amber-50 text-amber-800 border-amber-200'
                            }`}
                            title={item.utilityReason || 'Alineado al contexto'}
                          >
                            <Sparkles className="w-2.5 h-2.5" />
                            <span>{item.estimatedUtility || 'Muy Alta'}</span>
                          </span>
                        </td>

                        <td className="py-3 px-3 text-center whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                              item.estimatedDifficulty === 'Baja'
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                : item.estimatedDifficulty === 'Alta'
                                ? 'bg-rose-50 text-rose-800 border-rose-200'
                                : 'bg-[#F7B538]/15 text-[#2D1B4E] border-[#F7B538]/40'
                            }`}
                            title={item.resistanceOrDoubtNotes || 'Dificultad estimada'}
                          >
                            <span>{item.estimatedDifficulty || 'Media'}</span>
                          </span>
                        </td>

                        <td className="py-3 px-3 text-center whitespace-nowrap">
                          <span className="font-bold text-[10px] text-[#2D1B4E] bg-white border border-[#493447]/20 px-2 py-0.5 rounded-md">
                            Etapa {item.stage}
                          </span>
                        </td>

                        <td className="py-3 px-3 whitespace-nowrap text-[11px] text-[#4A3F55]/80">
                          {new Date(item.recommendedAt || item.timestamp || Date.now()).toLocaleDateString('es-MX', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>

                        <td className="py-3 px-3 text-center whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => setSelectedResourceForDetail(item)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold text-[#BF3A1B] hover:text-white hover:bg-[#BF3A1B] border border-[#BF3A1B]/30 rounded-lg transition-all cursor-pointer"
                          >
                            <Eye className="w-3 h-3" />
                            <span>Ver Detalle</span>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: DETALLE DEL RECURSO RECOMENDADO */}
      {selectedResourceForDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 border border-[#493447]/20 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-3 border-b border-[#493447]/10 pb-3">
              <div className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                  selectedResourceForDetail.origin === 'internal'
                    ? 'bg-emerald-50 text-[#246B2A]'
                    : 'bg-[#2D1B4E]/10 text-[#2D1B4E]'
                }`}>
                  {selectedResourceForDetail.origin === 'internal' ? (
                    <Library className="w-4 h-4" />
                  ) : (
                    <Globe className="w-4 h-4" />
                  )}
                </div>
                <div>
                  <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full border ${
                    selectedResourceForDetail.origin === 'internal'
                      ? 'bg-emerald-50 text-[#246B2A] border-emerald-200'
                      : 'bg-[#2D1B4E]/5 text-[#2D1B4E] border-[#2D1B4E]/15'
                  }`}>
                    {selectedResourceForDetail.origin === 'internal'
                      ? 'Biblioteca Interna Lidacta (Bloque 3)'
                      : 'Fuente Externa Delimitada'}
                  </span>
                  <h3 className="font-heading font-extrabold text-base text-[#2D1B4E] mt-1">
                    {selectedResourceForDetail.title || selectedResourceForDetail.resourceTitle}
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedResourceForDetail(null)}
                className="text-[#4A3F55]/60 hover:text-[#2D1B4E] text-lg font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <span className="font-bold text-[#4A3F55] block text-[11px]">Categoría / Tipo:</span>
                <span className="text-[#2D1B4E] font-medium">
                  {selectedResourceForDetail.category || selectedResourceForDetail.categoryOrTool || 'Herramienta de desarrollo'}
                </span>
              </div>

              <div>
                <span className="font-bold text-[#4A3F55] block text-[11px]">Autor o Fuente:</span>
                <span className="text-[#2D1B4E] font-medium">
                  {selectedResourceForDetail.authorOrSource || selectedResourceForDetail.sourceOrAuthor || 'Lidacta Executive Coaching'}
                </span>
              </div>

              {selectedResourceForDetail.description && (
                <div>
                  <span className="font-bold text-[#4A3F55] block text-[11px]">Descripción / Enfoque:</span>
                  <p className="text-[#4A3F55]/90 bg-[#FFF7EF] p-2.5 rounded-xl border border-[#FFD3BF]/60 leading-relaxed">
                    {selectedResourceForDetail.description}
                  </p>
                </div>
              )}

              {/* If opened from delivery log, show delivery metadata */}
              {selectedResourceForDetail.leaderName && (
                <div className="bg-[#FFF7EF]/40 border border-[#FFD3BF]/60 rounded-xl p-3 space-y-1.5">
                  <div className="font-bold text-[11px] text-[#2D1B4E] uppercase tracking-wider">
                    Datos de la Entrega Silenciosa:
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div>
                      <span className="text-[#4A3F55]/70 block">Líder:</span>
                      <strong className="text-[#2D1B4E]">{selectedResourceForDetail.leaderName}</strong>
                    </div>
                    <div>
                      <span className="text-[#4A3F55]/70 block">Empresa:</span>
                      <strong className="text-[#2D1B4E]">{selectedResourceForDetail.companyName}</strong>
                    </div>
                    <div>
                      <span className="text-[#4A3F55]/70 block">Desafío / Tema:</span>
                      <strong className="text-[#2D1B4E]">{selectedResourceForDetail.theme || selectedResourceForDetail.challengeTitle}</strong>
                    </div>
                    <div>
                      <span className="text-[#4A3F55]/70 block">Etapa Sugerida:</span>
                      <strong className="text-[#2D1B4E]">Etapa {selectedResourceForDetail.stage}</strong>
                    </div>
                  </div>
                </div>
              )}

              {/* Contextual Utility and Alignment */}
              <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-xl p-3 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[11px] text-emerald-900 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-[#246B2A]" />
                    <span>Alineación & Utilidad Estimada (por Contexto):</span>
                  </span>
                  <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-100 text-[#246B2A] border border-emerald-300">
                    {selectedResourceForDetail.estimatedUtility || 'Muy Alta'}
                  </span>
                </div>
                <p className="text-[11px] text-emerald-950/80 leading-relaxed pt-0.5">
                  {selectedResourceForDetail.utilityReason || 'Alineado directamente con la problemática de gestión planteada por el líder en su jornada operativa.'}
                </p>
              </div>

              {/* Contextual Difficulty and Resistance */}
              <div className="bg-[#FFF7EF] border border-[#FFD3BF] rounded-xl p-3 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[11px] text-[#2D1B4E] flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-[#BF3A1B]" />
                    <span>Dificultad de Implementación & Puntos de Resistencia:</span>
                  </span>
                  <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${
                    selectedResourceForDetail.estimatedDifficulty === 'Baja'
                      ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                      : selectedResourceForDetail.estimatedDifficulty === 'Alta'
                      ? 'bg-rose-100 text-rose-800 border-rose-300'
                      : 'bg-[#F7B538]/25 text-[#2D1B4E] border-[#F7B538]/50'
                  }`}>
                    Dificultad: {selectedResourceForDetail.estimatedDifficulty || 'Media'}
                  </span>
                </div>
                <p className="text-[11px] text-[#4A3F55]/90 leading-relaxed pt-0.5">
                  {selectedResourceForDetail.resistanceOrDoubtNotes || 'Foco en aplicación inmediata sin fricciones o dudas significativas registradas.'}
                </p>
              </div>

              {selectedResourceForDetail.urlOrRef && (
                <div>
                  <span className="font-bold text-[#4A3F55] block text-[11px]">Referencia Documental / Enlace:</span>
                  <div className="text-[11px] font-mono text-[#BF3A1B] bg-gray-50 p-2 rounded-lg border border-gray-200 break-all select-all">
                    {selectedResourceForDetail.urlOrRef}
                  </div>
                </div>
              )}
            </div>

            <div className="pt-2 flex justify-end border-t border-[#493447]/10">
              <button
                type="button"
                onClick={() => setSelectedResourceForDetail(null)}
                className="px-4 py-2 bg-[#2D1B4E] hover:bg-[#493447] text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                Cerrar Ventana
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: DIRECTORIO DE USUARIOS */}
      {activeTab === 'users' && (
        <div className="bg-white border border-[#493447]/10 rounded-2xl p-4 sm:p-6 shadow-xs space-y-5 animate-in fade-in">
          {/* Top Header Bar with Live Real-time Sync */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#493447]/10 pb-4">
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#2D1B4E]/10 text-[#2D1B4E] flex items-center justify-center shrink-0">
                  <Users className="w-4 h-4 text-[#2D1B4E]" />
                </div>
                <h3 className="font-heading font-extrabold text-base sm:text-lg text-[#2D1B4E]">
                  Directorio de Usuarios
                </h3>
                {isDbConnected ? (
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200 shadow-2xs">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span>BD Central Conectada</span>
                    <span className="text-[10px] text-emerald-700/80 font-mono">({dbLatencyMs}ms)</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#2D1B4E] bg-[#FFF7EF] px-2.5 py-0.5 rounded-full border border-[#FFD3BF] shadow-2xs">
                    <span className="w-2 h-2 rounded-full bg-[#F7B538]" />
                    <span>Almacenamiento Activo (Local / Vercel)</span>
                  </span>
                )}
              </div>
              <p className="text-xs text-[#4A3F55]/70 mt-1 max-w-xl">
                Gestión centralizada y sincronizada globalmente: creación de usuarios, roles, estado activo/inactivo y persistencia directa en base de datos.
              </p>
            </div>

            {/* Action Buttons: Sync & Add User */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => refreshUsers()}
                disabled={isSyncingUsers}
                className="min-h-[44px] px-3.5 py-2.5 bg-[#FFF7EF] hover:bg-[#FFD3BF]/30 text-[#2D1B4E] border border-[#493447]/15 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
                title="Sincronizar directorio con la base de datos central"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-[#BF3A1B] ${isSyncingUsers ? 'animate-spin' : ''}`} />
                <span>{isSyncingUsers ? 'Sincronizando...' : 'Sincronizar'}</span>
              </button>

              <button
                type="button"
                onClick={() => setIsAddUserModalOpen(true)}
                className="min-h-[44px] px-4 py-2.5 bg-[#BF3A1B] hover:bg-[#a63014] text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-95 shrink-0"
              >
                <UserPlus className="w-4 h-4" />
                <span>+ Agregar Usuario</span>
              </button>
            </div>
          </div>

          {/* Search & Filter Toolbar */}
          <div className="bg-[#FFF7EF]/60 border border-[#493447]/10 rounded-xl p-3 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 text-xs">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-[#4A3F55]/60 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchUserQuery}
                onChange={(e) => setSearchUserQuery(e.target.value)}
                placeholder="Buscar por nombre, correo, empresa o puesto..."
                className="w-full pl-9 pr-3 py-2 min-h-[40px] bg-white border border-[#493447]/15 rounded-xl text-xs text-[#2D1B4E] focus:outline-hidden focus:border-[#BF3A1B]"
              />
              {searchUserQuery && (
                <button
                  type="button"
                  onClick={() => setSearchUserQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-[#4A3F55]/50 hover:text-[#2D1B4E]"
                >
                  Limpiar
                </button>
              )}
            </div>

            {/* Filter by Role */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 shrink-0">
                <Filter className="w-3.5 h-3.5 text-[#4A3F55]/70" />
                <span className="font-bold text-[#4A3F55] hidden sm:inline">Rol:</span>
              </div>
              <select
                value={filterUserRole}
                onChange={(e) => setFilterUserRole(e.target.value as any)}
                className="py-2 px-2.5 min-h-[40px] bg-white border border-[#493447]/15 rounded-xl text-xs text-[#2D1B4E] focus:outline-hidden focus:border-[#BF3A1B]"
              >
                <option value="all">Todos los roles</option>
                <option value="leader">Líderes</option>
                <option value="hr">Recursos Humanos</option>
                <option value="admin">Administradores</option>
              </select>

              {/* Filter by Status */}
              <select
                value={filterUserStatus}
                onChange={(e) => setFilterUserStatus(e.target.value as any)}
                className="py-2 px-2.5 min-h-[40px] bg-white border border-[#493447]/15 rounded-xl text-xs text-[#2D1B4E] focus:outline-hidden focus:border-[#BF3A1B]"
              >
                <option value="all">Todos los estados</option>
                <option value="active">Solo Activos</option>
                <option value="inactive">Solo Inactivos</option>
              </select>
            </div>

            {/* Count Badge */}
            <div className="text-[11px] text-[#4A3F55]/80 shrink-0 text-right md:text-left pt-1 md:pt-0">
              <span className="font-bold text-[#2D1B4E]">{filteredUsersList.length}</span> de {allUsers.length} cuentas
            </div>
          </div>

          {/* Empty state */}
          {filteredUsersList.length === 0 ? (
            <div className="text-center py-12 px-4 border border-dashed border-[#493447]/20 rounded-2xl bg-[#FFF7EF]/30 space-y-3">
              <div className="w-12 h-12 rounded-full bg-[#FFF7EF] border border-[#FFD3BF] text-[#BF3A1B] flex items-center justify-center mx-auto">
                <Users className="w-6 h-6" />
              </div>
              <h4 className="font-heading font-bold text-sm text-[#2D1B4E]">
                No se encontraron usuarios coincidentes
              </h4>
              <p className="text-xs text-[#4A3F55]/70 max-w-sm mx-auto">
                Intenta modificar o limpiar los filtros de búsqueda o registra un nuevo usuario en la plataforma.
              </p>
              <div className="flex items-center justify-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setSearchUserQuery('');
                    setFilterUserRole('all');
                    setFilterUserStatus('all');
                  }}
                  className="px-3.5 py-1.5 text-xs font-bold text-[#4A3F55] hover:text-[#2D1B4E] border border-[#493447]/20 rounded-xl bg-white cursor-pointer"
                >
                  Restablecer Filtros
                </button>
                <button
                  type="button"
                  onClick={() => setIsAddUserModalOpen(true)}
                  className="px-3.5 py-1.5 text-xs font-bold text-white bg-[#BF3A1B] hover:bg-[#a63014] rounded-xl cursor-pointer"
                >
                  + Agregar Usuario
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Mobile Cards for Users Directory */}
              <div className="grid grid-cols-1 gap-3 md:hidden">
                {filteredUsersList.map((u) => {
                  const isActive = (u.status || 'active') === 'active';
                  const initials = u.name
                    .split(' ')
                    .map((n) => n[0])
                    .slice(0, 2)
                    .join('')
                    .toUpperCase();

                  return (
                    <div
                      key={u.id}
                      className="p-4 bg-white border border-[#493447]/10 rounded-2xl space-y-3 shadow-xs hover:border-[#BF3A1B]/30 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <div className="w-9 h-9 rounded-full bg-[#2D1B4E] text-[#FFF7EF] font-bold text-xs flex items-center justify-center shrink-0">
                            {initials}
                          </div>
                          <div>
                            <span className="font-bold text-xs text-[#2D1B4E] block">{u.name}</span>
                            <span className="text-[11px] text-[#4A3F55]/70 block">{u.email}</span>
                          </div>
                        </div>

                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase shrink-0 ${
                            u.role === 'admin'
                              ? 'bg-[#F7B538] text-[#2D1B4E]'
                              : u.role === 'hr'
                              ? 'bg-[#C9BDF2] text-[#2D1B4E]'
                              : 'bg-[#FFD3BF] text-[#BF3A1B]'
                          }`}
                        >
                          {u.role}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-[11px] text-[#4A3F55]/80 pt-2 border-t border-[#493447]/5">
                        <div>
                          <span className="text-[10px] text-[#4A3F55]/50 block">Empresa</span>
                          <span className="font-semibold text-[#2D1B4E]">{u.companyName}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-[#4A3F55]/50 block">Puesto</span>
                          <span className="text-[#2D1B4E]">{u.position}</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-[11px] pt-1">
                        <div>
                          <span className="text-[10px] text-[#4A3F55]/50 block">Estado</span>
                          {isActive ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                              Activo
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-900 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                              Inactivo
                            </span>
                          )}
                        </div>

                        <div className="text-right">
                          <span className="text-[10px] text-[#4A3F55]/50 block">Tel / WhatsApp</span>
                          <span className="text-[10px] tabular-nums text-[#4A3F55]/80">
                            {u.whatsapp || 'No registrado'}
                          </span>
                        </div>
                      </div>

                      {/* Action buttons row */}
                      <div className="pt-2 border-t border-[#493447]/10 flex flex-wrap items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => handleSendInviteToUser(u)}
                          disabled={sendingInviteUserId === u.id}
                          className={`min-h-[38px] px-3 py-1.5 font-bold text-xs rounded-xl border transition-all cursor-pointer flex items-center gap-1.5 active:scale-95 ${
                            invitedUserIds[u.id]
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              : 'bg-[#FFF7EF] text-[#2D1B4E] border-[#493447]/15 hover:bg-[#FFD3BF]/40'
                          }`}
                          title="Enviar invitación para completar perfil"
                        >
                          {sendingInviteUserId === u.id ? (
                            <div className="w-3.5 h-3.5 border-2 border-[#BF3A1B] border-t-transparent rounded-full animate-spin" />
                          ) : invitedUserIds[u.id] ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <Send className="w-3.5 h-3.5 text-[#BF3A1B]" />
                          )}
                          <span>{invitedUserIds[u.id] ? 'Invitación enviada' : 'Enviar invitación para completar perfil'}</span>
                        </button>

                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setUserToView(u)}
                            className="min-h-[38px] px-3 py-1.5 bg-[#FFF7EF] hover:bg-[#FFD3BF]/40 text-[#2D1B4E] font-bold text-xs rounded-xl border border-[#493447]/15 transition-colors cursor-pointer flex items-center gap-1.5 active:scale-95"
                            title={`Ver perfil completo de ${u.name}`}
                          >
                            <Eye className="w-3.5 h-3.5 text-[#2D1B4E]" />
                            <span>Ver Perfil</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setUserToEdit(u)}
                            className="min-h-[38px] px-3 py-1.5 bg-[#FFF7EF] hover:bg-[#FFD3BF]/40 text-[#2D1B4E] font-bold text-xs rounded-xl border border-[#493447]/15 transition-colors cursor-pointer flex items-center gap-1.5 active:scale-95"
                          >
                            <Pencil className="w-3.5 h-3.5 text-[#BF3A1B]" />
                            <span>Editar</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setUserToDelete(u)}
                            disabled={u.id === 'user_admin_tania'}
                            className="min-h-[38px] px-3 py-1.5 bg-white hover:bg-red-50 text-red-600 font-bold text-xs rounded-xl border border-red-200 transition-colors cursor-pointer flex items-center gap-1.5 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Eliminar</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto rounded-xl border border-[#493447]/10">
                <table className="w-full text-xs text-left">
                  <thead className="bg-[#FFF7EF] text-[#2D1B4E] uppercase text-[10px] tracking-wider font-extrabold border-b border-[#493447]/10">
                    <tr>
                      <th className="p-3.5">Usuario</th>
                      <th className="p-3.5">Empresa</th>
                      <th className="p-3.5">Rol</th>
                      <th className="p-3.5">Puesto & Área</th>
                      <th className="p-3.5">Estado</th>
                      <th className="p-3.5">Tel / WhatsApp</th>
                      <th className="p-3.5 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#493447]/5 bg-white">
                    {filteredUsersList.map((u) => {
                      const isActive = (u.status || 'active') === 'active';
                      const initials = u.name
                        .split(' ')
                        .map((n) => n[0])
                        .slice(0, 2)
                        .join('')
                        .toUpperCase();

                      return (
                        <tr key={u.id} className="hover:bg-[#FFF7EF]/40 transition-colors">
                          <td className="p-3.5">
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-full bg-[#2D1B4E] text-[#FFF7EF] font-bold text-[11px] flex items-center justify-center shrink-0">
                                {initials}
                              </div>
                              <div>
                                <span className="font-bold text-[#2D1B4E] block">{u.name}</span>
                                <span className="text-[11px] text-[#4A3F55]/70 block">{u.email}</span>
                              </div>
                            </div>
                          </td>
                          <td className="p-3.5 text-[#4A3F55] font-medium">{u.companyName}</td>
                          <td className="p-3.5">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase inline-block ${
                                u.role === 'admin'
                                  ? 'bg-[#F7B538] text-[#2D1B4E]'
                                  : u.role === 'hr'
                                  ? 'bg-[#C9BDF2] text-[#2D1B4E]'
                                  : 'bg-[#FFD3BF] text-[#BF3A1B]'
                              }`}
                            >
                              {u.role}
                            </span>
                          </td>
                          <td className="p-3.5 text-[#4A3F55]">
                            <div className="font-medium text-[#2D1B4E]">{u.position}</div>
                            {u.area && <div className="text-[11px] text-[#4A3F55]/70">{u.area}</div>}
                          </td>
                          <td className="p-3.5">
                            {isActive ? (
                              <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                Activo
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-amber-900 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                Inactivo
                              </span>
                            )}
                          </td>
                          <td className="p-3.5 text-[#4A3F55]/80 tabular-nums">
                            {u.whatsapp || <span className="text-[#4A3F55]/40 italic">N/A</span>}
                          </td>
                          <td className="p-3.5 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Send Profile Invite Button */}
                              <button
                                type="button"
                                onClick={() => handleSendInviteToUser(u)}
                                disabled={sendingInviteUserId === u.id}
                                className={`min-h-[36px] px-2.5 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 active:scale-95 border ${
                                  invitedUserIds[u.id]
                                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                                    : 'bg-[#FFF7EF] text-[#2D1B4E] border-[#493447]/15 hover:bg-[#FFD3BF]/40 hover:border-[#BF3A1B]/30'
                                }`}
                                title={`Enviar invitación para completar perfil a ${u.name}`}
                              >
                                {sendingInviteUserId === u.id ? (
                                  <div className="w-3.5 h-3.5 border-2 border-[#BF3A1B] border-t-transparent rounded-full animate-spin" />
                                ) : invitedUserIds[u.id] ? (
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                ) : (
                                  <Send className="w-3.5 h-3.5 text-[#BF3A1B]" />
                                )}
                                <span className="hidden xl:inline text-[11px]">
                                  {sendingInviteUserId === u.id
                                    ? 'Enviando...'
                                    : invitedUserIds[u.id]
                                    ? 'Invitación enviada'
                                    : 'Enviar invitación'}
                                </span>
                              </button>

                              {/* Simulate / Impersonate User Button (Excluding Admin) */}
                              {u.id !== adminProfile.id && (
                                <button
                                  type="button"
                                  onClick={() => impersonateUser(u)}
                                  className="min-h-[36px] min-w-[36px] p-2 text-[#BF3A1B] hover:text-[#2D1B4E] hover:bg-[#FFD3BF]/50 rounded-xl transition-colors cursor-pointer flex items-center justify-center active:scale-95 border border-[#BF3A1B]/20 hover:border-[#BF3A1B]"
                                  title={`Simular interfaz como ${u.name} (${u.role === 'hr' ? 'Recursos Humanos' : 'Líder'})`}
                                >
                                  <Sliders className="w-4 h-4 text-[#BF3A1B]" />
                                </button>
                              )}

                              {/* View Profile Button */}
                              <button
                                type="button"
                                onClick={() => setUserToView(u)}
                                className="min-h-[36px] min-w-[36px] p-2 text-[#2D1B4E] hover:text-[#BF3A1B] hover:bg-[#FFD3BF]/40 rounded-xl transition-colors cursor-pointer flex items-center justify-center active:scale-95 border border-transparent hover:border-[#BF3A1B]/20"
                                title={`Ver perfil detallado de ${u.name}`}
                              >
                                <Eye className="w-4 h-4 text-[#2D1B4E]" />
                              </button>

                              {/* Edit Button */}
                              <button
                                type="button"
                                onClick={() => setUserToEdit(u)}
                                className="min-h-[36px] min-w-[36px] p-2 text-[#2D1B4E] hover:text-[#BF3A1B] hover:bg-[#FFD3BF]/40 rounded-xl transition-colors cursor-pointer flex items-center justify-center active:scale-95 border border-transparent hover:border-[#BF3A1B]/20"
                                title={`Editar información de ${u.name}`}
                              >
                                <Pencil className="w-4 h-4" />
                              </button>

                              {/* Delete Button */}
                              <button
                                type="button"
                                onClick={() => setUserToDelete(u)}
                                disabled={u.id === 'user_admin_tania'}
                                className="min-h-[36px] min-w-[36px] p-2 text-[#4A3F55]/60 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors cursor-pointer flex items-center justify-center active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed border border-transparent hover:border-red-200"
                                title={
                                  u.id === 'user_admin_tania'
                                    ? 'Cuenta maestra de administración protegida'
                                    : `Eliminar usuario ${u.name}`
                                }
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* TAB 5: BANDEJA DE ASESORÍA 1:1 DIRECTA (NOTIFICACIONES AL ADMINISTRADOR) */}
      {activeTab === 'mentor_requests' && (
        <div className="space-y-6 animate-in fade-in">
          {/* Header Executive Card */}
          <div className="bg-white border border-[#493447]/10 rounded-2xl p-6 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-[#BF3A1B] bg-[#FFD3BF]/40 px-2 py-0.5 rounded flex items-center gap-1">
                  <UserCheck className="w-3.5 h-3.5" />
                  Atención Directiva Exclusiva
                </span>
                <span className="text-xs text-[#4A3F55]/60">·</span>
                <span className="text-xs text-[#4A3F55]/80 font-medium">{adminProfile.name} ({adminProfile.position || 'Directora Lidacta'})</span>
              </div>
              <h2 className="font-heading font-extrabold text-lg sm:text-xl text-[#2D1B4E]">
                Bandeja de Acompañamiento Personal Directivo (Asesoría 1:1)
              </h2>
              <p className="text-xs sm:text-sm text-[#4A3F55] max-w-2xl">
                Solicitudes de líderes que requieren una intervención humana o asesoría directiva directa en cualquiera de las 7 etapas de su reto operativo.
              </p>
            </div>

            {/* Notification Channels Status Card */}
            <div className="p-3.5 bg-[#FFF7EF] border border-[#FFD3BF] rounded-xl text-xs space-y-1.5 shrink-0 w-full md:w-auto shadow-xs">
              <div className="flex items-center justify-between gap-3 text-[10px] font-bold uppercase text-[#BF3A1B] tracking-wider">
                <span>Canales de Alerta Activos</span>
                <span className="text-[9px] bg-[#BF3A1B]/10 px-1.5 py-0.2 rounded font-extrabold">Configurado</span>
              </div>
              <div className="flex items-center gap-2 text-[#2D1B4E]">
                <Mail className="w-3.5 h-3.5 text-[#BF3A1B] shrink-0" />
                <span className="font-medium text-[11px] truncate max-w-[220px]">{adminProfile.email || 'hola@taniapadierna.com'}</span>
              </div>
              <div className="flex items-center gap-2 text-[#2D1B4E]">
                <MessageSquare className="w-3.5 h-3.5 text-[#246B2A] shrink-0" />
                <span className="font-medium text-[11px] truncate max-w-[220px]">{adminProfile.whatsapp || '+52 55 1234 5678'} (WhatsApp Directo)</span>
              </div>
              <button
                type="button"
                onClick={openProfileModal}
                className="mt-1.5 w-full flex items-center justify-center gap-1.5 px-2.5 py-1.5 bg-white hover:bg-[#FFD3BF]/50 text-[#BF3A1B] border border-[#BF3A1B]/30 rounded-lg text-[11px] font-bold transition-all cursor-pointer shadow-xs active:scale-95"
              >
                <Sliders className="w-3 h-3" />
                <span>Editar mis datos y canales</span>
              </button>
            </div>
          </div>

          {/* Filter Bar & Counters */}
          <div className="bg-white border border-[#493447]/10 rounded-2xl p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
              <button
                onClick={() => setStatusFilter('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer min-h-[38px] ${
                  statusFilter === 'all'
                    ? 'bg-[#2D1B4E] text-white shadow-xs'
                    : 'bg-[#FFF7EF] text-[#4A3F55] hover:text-[#2D1B4E]'
                }`}
              >
                Todas ({mentorRequests.length})
              </button>
              <button
                onClick={() => setStatusFilter('pendiente')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer min-h-[38px] flex items-center gap-1.5 ${
                  statusFilter === 'pendiente'
                    ? 'bg-[#BF3A1B] text-white shadow-xs'
                    : 'bg-[#FFF7EF] text-[#BF3A1B] hover:bg-[#FFD3BF]/30'
                }`}
              >
                <span>Pendientes</span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/20 font-extrabold">
                  {mentorRequests.filter((m) => (!m.mentorRequestDetails?.status || m.mentorRequestDetails.status === 'pendiente')).length}
                </span>
              </button>
              <button
                onClick={() => setStatusFilter('contactado')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer min-h-[38px] ${
                  statusFilter === 'contactado'
                    ? 'bg-[#F7B538] text-[#2D1B4E] shadow-xs'
                    : 'bg-[#FFF7EF] text-[#4A3F55] hover:text-[#2D1B4E]'
                }`}
              >
                En Contacto ({mentorRequests.filter((m) => m.mentorRequestDetails?.status === 'contactado').length})
              </button>
              <button
                onClick={() => setStatusFilter('atendido')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer min-h-[38px] ${
                  statusFilter === 'atendido'
                    ? 'bg-[#246B2A] text-white shadow-xs'
                    : 'bg-[#FFF7EF] text-[#4A3F55] hover:text-[#2D1B4E]'
                }`}
              >
                Atendidas ({mentorRequests.filter((m) => m.mentorRequestDetails?.status === 'atendido').length})
              </button>
            </div>

            <div className="text-xs text-[#4A3F55]/70">
              Mostrando <strong className="text-[#2D1B4E]">{filteredMentorRequests.length}</strong> de {mentorRequests.length} solicitudes
            </div>
          </div>

          {/* Requests List */}
          {filteredMentorRequests.length === 0 ? (
            <div className="bg-white border border-[#493447]/10 rounded-2xl p-12 text-center shadow-xs">
              <div className="w-12 h-12 rounded-full bg-[#FFF7EF] border border-[#FFD3BF] text-[#BF3A1B] flex items-center justify-center mx-auto mb-3">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="font-heading font-bold text-base text-[#2D1B4E]">
                No hay solicitudes en esta categoría
              </h3>
              <p className="text-xs text-[#4A3F55] mt-1 max-w-sm mx-auto">
                {statusFilter === 'all'
                  ? 'Ningún líder ha solicitado asesoría 1:1 directa por ahora.'
                  : `No se encontraron solicitudes con estatus "${statusFilter}".`}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredMentorRequests.map((req) => {
                const details = req.mentorRequestDetails;
                const reqStatus = details?.status || 'pendiente';
                const whatsappNumber = details?.leaderWhatsapp || '+52 55 4321 9876';
                const cleanPhone = whatsappNumber.replace(/[^0-9]/g, '');
                const whatsappMsg = `Hola ${details?.leaderName || 'Líder'}, soy ${adminProfile.name || 'Tania Padierna'} de Lidacta. Recibí tu solicitud de Asesoría 1:1 sobre tu reto "${details?.caseTitle || 'Liderazgo'}" (Etapa ${details?.currentStage || 1}). Me encantará apoyarte. ¿En qué horario podemos conectar?`;
                const whatsappLink = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(whatsappMsg)}`;

                return (
                  <div
                    key={req.id}
                    className="bg-white border border-[#493447]/15 rounded-2xl p-5 sm:p-6 shadow-xs space-y-4 hover:border-[#BF3A1B]/40 transition-colors"
                  >
                    {/* Top Header of the card */}
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 border-b border-[#493447]/10 pb-4">
                      <div className="flex items-start gap-3">
                        <div className="w-11 h-11 rounded-xl bg-[#2D1B4E] text-[#F7B538] flex items-center justify-center font-heading font-extrabold text-sm shrink-0 shadow-xs">
                          {details?.leaderName
                            ? details.leaderName.split(' ').map((n) => n[0]).slice(0, 2).join('')
                            : 'LD'}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-heading font-bold text-base text-[#2D1B4E]">
                              {details?.leaderName || 'Líder Lidacta'}
                            </h3>
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                                reqStatus === 'pendiente'
                                  ? 'bg-[#BF3A1B]/15 text-[#BF3A1B] border border-[#BF3A1B]/30'
                                  : reqStatus === 'contactado'
                                  ? 'bg-[#F7B538]/30 text-[#2D1B4E] border border-[#F7B538]/50'
                                  : 'bg-[#E2F7E1] text-[#246B2A] border border-[#246B2A]/30'
                              }`}
                            >
                              {reqStatus === 'pendiente'
                                ? '● Pendiente'
                                : reqStatus === 'contactado'
                                ? 'En Contacto'
                                : '✓ Atendida'}
                            </span>
                          </div>
                          <p className="text-xs text-[#4A3F55] mt-0.5">
                            {details?.leaderPosition || 'Líder Operativo'} · <strong className="text-[#2D1B4E]">{details?.companyName || 'Empresa'}</strong>
                          </p>
                          <div className="flex items-center gap-3 text-[11px] text-[#4A3F55]/70 mt-1 flex-wrap">
                            <span>📧 {details?.leaderEmail || 'correo@empresa.com'}</span>
                            <span>📱 {whatsappNumber}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col sm:items-end text-xs text-[#4A3F55]/80 shrink-0">
                        <span className="font-semibold text-[#2D1B4E]">
                          {new Date(req.timestamp).toLocaleDateString([], {
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric',
                          })}
                        </span>
                        <span className="text-[11px] tabular-nums text-[#4A3F55]/60">
                          {new Date(req.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>

                    {/* Stage & Case Title Context */}
                    <div className="flex items-center gap-2 flex-wrap text-xs">
                      <span className="px-2.5 py-1 bg-[#2D1B4E] text-[#F7B538] font-bold rounded-lg text-[11px]">
                        Etapa {details?.currentStage || 1}: {details?.stageName || 'Operativa'}
                      </span>
                      <span className="text-[#4A3F55] font-medium">
                        Caso: <strong className="text-[#2D1B4E]">{details?.caseTitle || req.title}</strong>
                      </span>
                    </div>

                    {/* Reason Text / Voice Audio Transcript */}
                    <div className="p-4 bg-[#FFF7EF] border border-[#FFD3BF] rounded-xl space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-bold text-[#BF3A1B] uppercase tracking-wider flex items-center gap-1.5">
                          {details?.isVoiceAudio ? (
                            <>
                              <Sparkles className="w-3.5 h-3.5 text-[#BF3A1B]" />
                              <span>Mensaje de voz transcrito del líder:</span>
                            </>
                          ) : (
                            <>
                              <MessageSquare className="w-3.5 h-3.5 text-[#BF3A1B]" />
                              <span>Motivo de la solicitud (escrito por el líder):</span>
                            </>
                          )}
                        </span>
                        {details?.isVoiceAudio && (
                          <span className="text-[10px] bg-[#BF3A1B] text-white px-2 py-0.5 rounded-full font-bold">
                            Audio Transcrito
                          </span>
                        )}
                      </div>
                      <p className="text-xs sm:text-sm text-[#2D1B4E] italic leading-relaxed whitespace-pre-line font-leader">
                        "{details?.reasonText || req.message}"
                      </p>
                    </div>

                    {/* Multichannel Actions Bar */}
                    <div className="pt-2 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 border-t border-[#493447]/10">
                      {/* Action buttons */}
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* WhatsApp Direct */}
                        <a
                          href={whatsappLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="min-h-[44px] px-3.5 py-2 bg-[#246B2A] hover:bg-[#1E5723] text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center gap-2 cursor-pointer active:scale-95"
                          title="Abrir chat directo con el líder en WhatsApp"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          <span>Contactar por WhatsApp</span>
                          <ExternalLink className="w-3 h-3 opacity-80" />
                        </a>

                        {/* Simulated Email Preview */}
                        <button
                          type="button"
                          onClick={() => openEmailDrawer(req)}
                          className="min-h-[44px] px-3.5 py-2 bg-[#FFF7EF] hover:bg-[#FFD3BF]/40 text-[#2D1B4E] border border-[#493447]/20 text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center gap-2 cursor-pointer active:scale-95"
                          title="Ver correo transaccional notificado a Tania Padierna"
                        >
                          <Mail className="w-3.5 h-3.5 text-[#BF3A1B]" />
                          <span>Ver Correo Notificado</span>
                        </button>
                      </div>

                      {/* Status Selector */}
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-[#4A3F55] whitespace-nowrap">
                          Cambiar estatus:
                        </span>
                        <div className="flex items-center gap-1 p-1 bg-[#FFF7EF] border border-[#493447]/15 rounded-xl">
                          {(['pendiente', 'contactado', 'atendido'] as const).map((st) => (
                            <button
                              key={st}
                              type="button"
                              onClick={() => {
                                updateMentorRequestStatus(req.id, st, adminNoteInput[req.id]);
                              }}
                              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold capitalize transition-all cursor-pointer min-h-[36px] ${
                                reqStatus === st
                                  ? st === 'pendiente'
                                    ? 'bg-[#BF3A1B] text-white shadow-xs'
                                    : st === 'contactado'
                                    ? 'bg-[#F7B538] text-[#2D1B4E] shadow-xs'
                                    : 'bg-[#246B2A] text-white shadow-xs'
                                  : 'text-[#4A3F55] hover:text-[#2D1B4E]'
                              }`}
                            >
                              {st === 'pendiente' ? 'Pendiente' : st === 'contactado' ? 'Contactado' : 'Atendido'}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Admin Notes Section */}
                    <div className="pt-2">
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[11px] font-bold text-[#4A3F55] uppercase tracking-wider">
                          Bitácora interna de Tania Padierna:
                        </label>
                        {details?.adminNotes && (
                          <span className="text-[10px] text-[#246B2A] font-medium flex items-center gap-1">
                            <Check className="w-3 h-3" /> Nota guardada
                          </span>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={
                            adminNoteInput[req.id] !== undefined
                              ? adminNoteInput[req.id]
                              : details?.adminNotes || ''
                          }
                          onChange={(e) =>
                            setAdminNoteInput((prev) => ({ ...prev, [req.id]: e.target.value }))
                          }
                          placeholder="Ej: Se acordó llamada de 30 minutos el jueves a las 10:00 AM para preparar su reunión..."
                          className="flex-1 px-3 py-2 bg-[#FFF7EF]/50 border border-[#493447]/20 rounded-xl text-xs text-[#2D1B4E] focus:outline-none focus:ring-1 focus:ring-[#BF3A1B]"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const note = adminNoteInput[req.id] !== undefined ? adminNoteInput[req.id] : (details?.adminNotes || '');
                            updateMentorRequestStatus(req.id, reqStatus, note);
                          }}
                          className="px-3 py-2 bg-[#2D1B4E] hover:bg-[#1f1236] text-[#F7B538] text-xs font-bold rounded-xl transition-colors cursor-pointer min-h-[38px] active:scale-95"
                        >
                          Guardar Nota
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* User Management Modals (Create, Edit, Delete) */}
      <AddUserModal
        isOpen={isAddUserModalOpen}
        onClose={() => setIsAddUserModalOpen(false)}
        companies={companies}
      />
      <EditUserModal
        user={userToEdit}
        onClose={() => setUserToEdit(null)}
        companies={companies}
      />
      <DeleteUserModal
        user={userToDelete}
        onClose={() => setUserToDelete(null)}
      />
      <ViewUserModal
        user={userToView}
        onClose={() => setUserToView(null)}
        onEdit={(u) => {
          setUserToView(null);
          setUserToEdit(u);
        }}
        onSendInvite={handleSendInviteToUser}
      />

      {/* Modal de Simulación / Modo Inspector para Administradora */}
      {isInspectorModalOpen && (
        <div className="fixed inset-0 bg-[#2D1B4E]/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 animate-in fade-in">
          <div className="bg-white border border-[#493447]/20 rounded-3xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-5 sm:p-6 bg-linear-to-r from-[#2D1B4E] to-[#493447] text-white flex items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full bg-[#F7B538] text-[#2D1B4E] font-heading font-extrabold text-[10px] tracking-wider uppercase flex items-center gap-1 shadow-xs">
                    <Sliders className="w-3 h-3 text-[#2D1B4E]" />
                    Modo Inspector
                  </span>
                  <span className="text-white/60 text-xs">Exclusivo de Administradora</span>
                </div>
                <h3 className="font-heading font-extrabold text-lg sm:text-xl text-white tracking-tight">
                  Simulación de Roles & Vistas
                </h3>
                <p className="text-xs text-[#FFF7EF]/80 max-w-lg leading-relaxed">
                  Carga la interfaz, herramientas y modales de bienvenida de Líder o Recursos Humanos para realizar pruebas sin cerrar tu sesión administrativa.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsInspectorModalOpen(false)}
                className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
                title="Cerrar ventana de simulación"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
              {/* Quick Role Simulation Cards */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#4A3F55]/80">
                  1. Selección Rápida por Rol
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Leader Card */}
                  <div className="p-4 rounded-2xl border-2 border-[#FFD3BF] bg-[#FFF7EF]/50 hover:bg-[#FFF7EF] transition-all space-y-3 flex flex-col justify-between shadow-xs">
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#FFD3BF] text-[#BF3A1B]">
                          Rol: Líder Operativo
                        </span>
                        <span className="text-[10px] text-[#4A3F55]/60 font-medium">Ej: Roberto Gómez</span>
                      </div>
                      <h5 className="font-heading font-bold text-sm text-[#2D1B4E]">
                        Espacio de Acompañamiento Líder
                      </h5>
                      <p className="text-[11px] text-[#4A3F55] leading-relaxed">
                        Prueba el chat confidencial de 7 etapas, planes de acción, dictado por voz y solicitud de mentoría 1:1.
                      </p>
                    </div>

                    <div className="space-y-2 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          impersonateRole('leader');
                          setIsInspectorModalOpen(false);
                        }}
                        className="w-full py-2 px-3 bg-[#BF3A1B] hover:bg-[#a63216] text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-xs active:scale-95 flex items-center justify-center gap-1.5"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Cargar Vista de Líder</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          openRoleWelcomeModal('leader', 'Roberto Gómez');
                        }}
                        className="w-full py-1.5 px-3 bg-white hover:bg-[#FFD3BF]/40 text-[#BF3A1B] border border-[#BF3A1B]/30 rounded-xl text-[11px] font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <Sparkles className="w-3 h-3 text-[#BF3A1B]" />
                        <span>Ver Modal Bienvenida Líder</span>
                      </button>
                    </div>
                  </div>

                  {/* HR Card */}
                  <div className="p-4 rounded-2xl border-2 border-[#C9BDF2] bg-[#F5F1FB]/60 hover:bg-[#F5F1FB] transition-all space-y-3 flex flex-col justify-between shadow-xs">
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#C9BDF2] text-[#2D1B4E]">
                          Rol: Recursos Humanos
                        </span>
                        <span className="text-[10px] text-[#4A3F55]/60 font-medium">Ej: Sofía Valenzuela</span>
                      </div>
                      <h5 className="font-heading font-bold text-sm text-[#2D1B4E]">
                        Panel de Seguimiento & Indicadores
                      </h5>
                      <p className="text-[11px] text-[#4A3F55] leading-relaxed">
                        Consulta métricas agregadas de participación, distribución de habilidades y progreso general sin violar confidencialidad.
                      </p>
                    </div>

                    <div className="space-y-2 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          impersonateRole('hr');
                          setIsInspectorModalOpen(false);
                        }}
                        className="w-full py-2 px-3 bg-[#2D1B4E] hover:bg-[#3D2568] text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-xs active:scale-95 flex items-center justify-center gap-1.5"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Cargar Vista de RH</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          openRoleWelcomeModal('hr', 'Sofía Valenzuela');
                        }}
                        className="w-full py-1.5 px-3 bg-white hover:bg-[#C9BDF2]/30 text-[#2D1B4E] border border-[#2D1B4E]/30 rounded-xl text-[11px] font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <Sparkles className="w-3 h-3 text-[#2D1B4E]" />
                        <span>Ver Modal Bienvenida RH</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Specific User Emulation from Database */}
              <div className="space-y-3 pt-2 border-t border-[#493447]/10">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[#4A3F55]/80">
                    2. Simular Usuario Específico del Directorio
                  </h4>
                  <span className="text-[11px] text-[#4A3F55]/60">
                    {allUsers.filter((u) => u.role !== 'admin').length} usuarios registrados
                  </span>
                </div>

                <div className="max-h-56 overflow-y-auto rounded-xl border border-[#493447]/15 divide-y divide-[#493447]/10 bg-white">
                  {allUsers
                    .filter((u) => u.role !== 'admin')
                    .map((user) => (
                      <div
                        key={user.id}
                        className="p-3 flex items-center justify-between gap-3 hover:bg-[#FFF7EF]/60 transition-colors"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs text-[#2D1B4E] truncate">
                              {user.name}
                            </span>
                            <span
                              className={`text-[9px] px-1.5 py-0.2 rounded font-bold uppercase ${
                                user.role === 'hr'
                                  ? 'bg-[#C9BDF2] text-[#2D1B4E]'
                                  : 'bg-[#FFD3BF] text-[#BF3A1B]'
                              }`}
                            >
                              {user.role === 'hr' ? 'RH' : 'Líder'}
                            </span>
                          </div>
                          <p className="text-[10px] text-[#4A3F55]/70 truncate">
                            {user.email} · {user.companyName} {user.position ? `(${user.position})` : ''}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            impersonateUser(user);
                            setIsInspectorModalOpen(false);
                          }}
                          className="min-h-[30px] px-2.5 py-1 text-[11px] font-bold text-[#2D1B4E] bg-[#FFF7EF] hover:bg-[#FFD3BF] border border-[#BF3A1B]/30 hover:border-[#BF3A1B] rounded-lg transition-all cursor-pointer shrink-0 flex items-center gap-1 active:scale-95"
                        >
                          <Eye className="w-3 h-3 text-[#BF3A1B]" />
                          <span>Simular</span>
                        </button>
                      </div>
                    ))}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-[#FFF7EF] border-t border-[#493447]/10 flex items-center justify-between text-xs">
              <span className="text-[#4A3F55]/70 text-[11px]">
                💡 Mientras estés en Modo Inspector, verás un banner superior flotante para regresar en 1 clic.
              </span>
              <button
                type="button"
                onClick={() => setIsInspectorModalOpen(false)}
                className="px-4 py-2 bg-white hover:bg-gray-100 text-[#4A3F55] font-semibold rounded-xl border border-[#493447]/20 transition-colors cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  </div>
  );
};
