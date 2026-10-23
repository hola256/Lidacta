import React, { useState, useMemo } from 'react';
import { useLidacta } from '../context/LidactaContext';
import { CompanyContext, MentorshipSession } from '../types/lidacta';
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
} from 'lucide-react';

export const AdminView: React.FC = () => {
  const {
    companies,
    updateCompanyContext,
    addCompany,
    mentorships,
    allUsers,
    notifications,
    openEmailDrawer,
    updateMentorRequestStatus,
  } = useLidacta();

  const [activeTab, setActiveTab] = useState<
    'onboarding' | 'stages_monitoring' | 'analytics' | 'users' | 'mentor_requests'
  >('onboarding');
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>(companies[0]?.id || 'comp_nexus');
  const [selectedMentorshipForAudit, setSelectedMentorshipForAudit] = useState<MentorshipSession | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'pendiente' | 'contactado' | 'atendido'>('all');
  const [adminNoteInput, setAdminNoteInput] = useState<Record<string, string>>({});

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

      {/* TAB 4: DIRECTORIO DE USUARIOS */}
      {activeTab === 'users' && (
        <div className="bg-white border border-[#493447]/10 rounded-2xl p-6 shadow-xs space-y-4 animate-in fade-in">
          <div className="flex items-center justify-between border-b border-[#493447]/10 pb-3">
            <div>
              <h3 className="font-heading font-bold text-base text-[#2D1B4E]">
                Directorio Global de Usuarios
              </h3>
              <p className="text-xs text-[#4A3F55]/70">
                Líderes, Recursos Humanos y Creadores en todas las empresas
              </p>
            </div>
            <span className="text-xs font-bold text-[#2D1B4E] tabular-nums">{allUsers.length} cuentas</span>
          </div>

          {/* Mobile Cards for Users Directory */}
          <div className="grid grid-cols-1 gap-2.5 md:hidden">
            {allUsers.map((u) => (
              <div key={u.id} className="p-3.5 bg-[#FFF7EF]/50 border border-[#493447]/10 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-bold text-xs text-[#2D1B4E] block">{u.name}</span>
                    <span className="text-[10px] text-[#4A3F55]/70 block">{u.email}</span>
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
                <div className="flex items-center justify-between text-[11px] text-[#4A3F55]/80 pt-1 border-t border-[#493447]/5">
                  <span className="truncate pr-2">{u.companyName} · {u.position}</span>
                  <span className="text-[10px] tabular-nums text-[#4A3F55]/70 shrink-0">{u.whatsapp || 'Sin WhatsApp'}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-[#FFF7EF] text-[#2D1B4E] uppercase text-[10px] tracking-wider font-bold">
                <tr>
                  <th className="p-3">Nombre</th>
                  <th className="p-3">Correo</th>
                  <th className="p-3">Empresa</th>
                  <th className="p-3">Rol</th>
                  <th className="p-3">Puesto & Área</th>
                  <th className="p-3 text-right">Tel / WhatsApp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#493447]/5">
                {allUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-[#FFF7EF]/40 transition-colors">
                    <td className="p-3 font-semibold text-[#2D1B4E]">{u.name}</td>
                    <td className="p-3 text-[#4A3F55]">{u.email}</td>
                    <td className="p-3 text-[#4A3F55]">{u.companyName}</td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
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
                    <td className="p-3 text-[#4A3F55]">
                      {u.position} {u.area ? `(${u.area})` : ''}
                    </td>
                    <td className="p-3 text-right text-[#4A3F55]/80 tabular-nums">
                      {u.whatsapp || 'N/A'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
                <span className="text-xs text-[#4A3F55]/80 font-medium">Tania Padierna (Directora Lidacta)</span>
              </div>
              <h2 className="font-heading font-extrabold text-lg sm:text-xl text-[#2D1B4E]">
                Bandeja de Acompañamiento Personal Directivo (Asesoría 1:1)
              </h2>
              <p className="text-xs sm:text-sm text-[#4A3F55] max-w-2xl">
                Solicitudes de líderes que requieren una intervención humana o asesoría directiva directa en cualquiera de las 7 etapas de su reto operativo.
              </p>
            </div>

            {/* Notification Channels Status Card */}
            <div className="p-3 bg-[#FFF7EF] border border-[#FFD3BF] rounded-xl text-xs space-y-1.5 shrink-0 w-full md:w-auto">
              <div className="text-[10px] font-bold uppercase text-[#BF3A1B] tracking-wider">
                Canales de Alerta Activos
              </div>
              <div className="flex items-center gap-2 text-[#2D1B4E]">
                <Mail className="w-3.5 h-3.5 text-[#BF3A1B]" />
                <span className="font-medium text-[11px]">hola@taniapadierna.com</span>
              </div>
              <div className="flex items-center gap-2 text-[#2D1B4E]">
                <MessageSquare className="w-3.5 h-3.5 text-[#246B2A]" />
                <span className="font-medium text-[11px]">+52 55 1234 5678 (WhatsApp Directo)</span>
              </div>
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
                const whatsappMsg = `Hola ${details?.leaderName || 'Líder'}, soy Tania Padierna de Lidacta. Recibí tu solicitud de Asesoría 1:1 sobre tu reto "${details?.caseTitle || 'Liderazgo'}" (Etapa ${details?.currentStage || 1}). Me encantará apoyarte. ¿En qué horario podemos conectar?`;
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
    </div>
  </div>
  );
};
