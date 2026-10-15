import React, { useState } from 'react';
import { useLidacta } from '../context/LidactaContext';
import {
  ShieldCheck,
  Users,
  Award,
  Sparkles,
  TrendingUp,
  Search,
  CheckCircle2,
  Lock,
  Download,
  Printer,
  ChevronRight,
  Filter,
  BarChart3,
  Calendar,
  Layers,
} from 'lucide-react';

export const HRView: React.FC = () => {
  const { currentUser, allUsers, mentorships, companies } = useLidacta();

  // Strict rule: HR only sees users and mentorships belonging to THEIR company
  const companyUsers = allUsers.filter(
    (u) => u.companyId === currentUser.companyId && u.role === 'leader'
  );

  const companyMentorships = mentorships.filter(
    (m) => m.companyId === currentUser.companyId
  );

  const currentCompany =
    companies.find((c) => c.id === currentUser.companyId) || companies[0];

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedThemeFilter, setSelectedThemeFilter] = useState('all');
  const [selectedLeaderDetail, setSelectedLeaderDetail] = useState<string | null>(null);

  // Indicators calculations
  const registeredLeadersCount = companyUsers.length;
  const uniqueLeadersWhoUsed = Array.from(new Set(companyMentorships.map((m) => m.leaderId)));
  const usageRatePercent = registeredLeadersCount > 0 ? Math.round((uniqueLeadersWhoUsed.length / registeredLeadersCount) * 100) : 0;
  const completedProcessesCount = companyMentorships.filter((m) => m.status === 'completed').length;

  // Aggregate skills
  const allSkills = companyMentorships.flatMap((m) => m.identifiedSkills || []);
  const skillFrequency: Record<string, number> = {};
  allSkills.forEach((sk) => {
    skillFrequency[sk] = (skillFrequency[sk] || 0) + 1;
  });
  const topSkills = Object.entries(skillFrequency).sort((a, b) => b[1] - a[1]);

  // Aggregate topics
  const allThemes = companyMentorships.map((m) => m.theme);
  const themeFrequency: Record<string, number> = {};
  allThemes.forEach((th) => {
    themeFrequency[th] = (themeFrequency[th] || 0) + 1;
  });

  const filteredMentorships = companyMentorships.filter((m) => {
    const matchesSearch =
      m.leaderName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.theme.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (m.leaderArea && m.leaderArea.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesTheme = selectedThemeFilter === 'all' || m.theme === selectedThemeFilter;
    return matchesSearch && matchesTheme;
  });

  return (
    <div className="flex-1 bg-[#FFF7EF] overflow-y-auto p-4 sm:p-8 space-y-8">
      {/* Top Banner with Strict Confidentiality Protocol */}
      <div className="bg-white border border-[#493447]/15 rounded-2xl p-6 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[#BF3A1B]">
              Panel de Recursos Humanos
            </span>
            <span className="text-xs text-[#4A3F55]/70">·</span>
            <span className="text-xs font-semibold text-[#2D1B4E]">{currentCompany.name}</span>
          </div>
          <h1 className="font-heading font-extrabold text-2xl text-[#2D1B4E]">
            Indicadores de Liderazgo, Uso e Impacto
          </h1>
          <p className="text-xs text-[#4A3F55] leading-relaxed max-w-2xl">
            Monitorea el desarrollo de habilidades, autonomía y temas abordados por tus líderes.
          </p>
        </div>

        {/* Confidentiality Seal */}
        <div className="p-3 bg-[#FFD3BF]/20 border border-[#FFD3BF] rounded-xl flex items-center gap-2 text-xs text-[#2D1B4E] shrink-0">
          <Lock className="w-4 h-4 text-[#BF3A1B] shrink-0" />
          <div>
            <span className="font-bold block">100% Confidencial</span>
            <span className="text-[11px] text-[#4A3F55]/80">Sin acceso a conversaciones privadas</span>
          </div>
        </div>
      </div>

      {/* KPI Cards: The Primary 3 Key Health Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 bg-white border border-[#493447]/10 rounded-2xl shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[#4A3F55]/80">
              I. Líderes Registrados
            </span>
            <Users className="w-4 h-4 text-[#BF3A1B]" />
          </div>
          <div className="font-heading font-bold text-3xl text-[#2D1B4E] tabular-nums">
            {registeredLeadersCount}
          </div>
          <p className="text-[11px] text-[#4A3F55]/70">
            En {currentCompany.name}
          </p>
        </div>

        <div className="p-5 bg-white border border-[#493447]/10 rounded-2xl shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[#4A3F55]/80">
              II. Líderes Activos en Lidacta
            </span>
            <TrendingUp className="w-4 h-4 text-[#BF3A1B]" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-heading font-bold text-3xl text-[#2D1B4E] tabular-nums">
              {uniqueLeadersWhoUsed.length}
            </span>
            <span className="text-xs font-semibold text-[#BF3A1B] tabular-nums">
              ({usageRatePercent}% adopción)
            </span>
          </div>
          <p className="text-[11px] text-[#4A3F55]/70">
            Han planteado situaciones reales
          </p>
        </div>

        <div className="p-5 bg-white border border-[#493447]/10 rounded-2xl shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[#4A3F55]/80">
              Procesos Concluidos (7 Etapas)
            </span>
            <CheckCircle2 className="w-4 h-4 text-[#246B2A]" />
          </div>
          <div className="font-heading font-bold text-3xl text-[#2D1B4E] tabular-nums">
            {completedProcessesCount}
          </div>
          <p className="text-[11px] text-[#4A3F55]/70">
            Con plan de acción y aprendizaje
          </p>
        </div>

        <div className="p-5 bg-white border border-[#493447]/10 rounded-2xl shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[#4A3F55]/80">
              Habilidades Identificadas
            </span>
            <Award className="w-4 h-4 text-[#F7B538]" />
          </div>
          <div className="font-heading font-bold text-3xl text-[#2D1B4E] tabular-nums">
            {topSkills.length}
          </div>
          <p className="text-[11px] text-[#4A3F55]/70">
            Competencias activadas en retos
          </p>
        </div>
      </div>

      {/* INDICATORS SECTION: III, IV, V, VI according to PDF instructions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Top Themes & Top Skills */}
        <div className="space-y-6">
          {/* III. Temas planteados por cada líder */}
          <div className="bg-white border border-[#493447]/10 rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-[#493447]/10 pb-3">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-[#BF3A1B]" />
                <h3 className="font-heading font-bold text-sm text-[#2D1B4E]">
                  III. Temas Más Abordados
                </h3>
              </div>
              <span className="text-[10px] text-[#4A3F55]/70">Frecuencia</span>
            </div>

            <div className="space-y-2.5">
              {Object.entries(themeFrequency).length === 0 ? (
                <p className="text-xs text-[#4A3F55]/60">Sin temas registrados aún.</p>
              ) : (
                Object.entries(themeFrequency).map(([thm, count], i) => (
                  <div key={i} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-[#2D1B4E] truncate max-w-[200px]">{thm}</span>
                      <span className="font-bold text-[#BF3A1B] tabular-nums">{count} casos</span>
                    </div>
                    <div className="w-full bg-[#FFF7EF] h-2 rounded-full overflow-hidden border border-[#493447]/5">
                      <div
                        className="bg-[#BF3A1B] h-full rounded-full transition-all"
                        style={{ width: `${Math.min(100, (count / companyMentorships.length) * 100)}%` }}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* IV. Habilidades que el líder necesitó */}
          <div className="bg-white border border-[#493447]/10 rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-[#493447]/10 pb-3">
              <div className="flex items-center gap-2">
                <Award className="w-4 h-4 text-[#BF3A1B]" />
                <h3 className="font-heading font-bold text-sm text-[#2D1B4E]">
                  IV. Habilidades Requeridas
                </h3>
              </div>
              <span className="text-[10px] text-[#4A3F55]/70">Demanda real</span>
            </div>

            <div className="space-y-2">
              {topSkills.length === 0 ? (
                <p className="text-xs text-[#4A3F55]/60">Sin habilidades detectadas aún.</p>
              ) : (
                topSkills.slice(0, 5).map(([sk, cnt], idx) => (
                  <div
                    key={idx}
                    className="p-2.5 bg-[#FFF7EF] border border-[#493447]/10 rounded-xl flex items-center justify-between text-xs"
                  >
                    <span className="font-medium text-[#2D1B4E] truncate pr-2">{sk}</span>
                    <span className="px-2 py-0.5 bg-[#FFD3BF] text-[#BF3A1B] font-bold rounded text-[11px] shrink-0 tabular-nums">
                      {cnt} {cnt === 1 ? 'vez' : 'veces'}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right 2 Columns: Detailed Mentorships Table (Actions & Learnings) */}
        <div className="lg:col-span-2 bg-white border border-[#493447]/10 rounded-2xl p-6 shadow-xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#493447]/10 pb-4">
            <div>
              <h3 className="font-heading font-bold text-base text-[#2D1B4E]">
                V & VI. Acciones y Aprendizajes por Líder
              </h3>
              <p className="text-xs text-[#4A3F55]/70">
                Información despersonalizada que protege la identidad de terceros
              </p>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-[#4A3F55]/50" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por líder o tema..."
                className="pl-8 pr-3 py-1.5 text-xs bg-[#FFF7EF] border border-[#493447]/15 rounded-lg text-[#2D1B4E] focus:outline-none focus:ring-1 focus:ring-[#BF3A1B] w-full sm:w-56"
              />
            </div>
          </div>

          {/* Cases List */}
          <div className="space-y-3">
            {filteredMentorships.length === 0 ? (
              <div className="p-8 text-center text-xs text-[#4A3F55]/60">
                No se encontraron registros con los filtros actuales.
              </div>
            ) : (
              filteredMentorships.map((m) => (
                <div
                  key={m.id}
                  className="p-4 bg-[#FFF7EF]/40 border border-[#493447]/10 rounded-xl space-y-3 hover:border-[#BF3A1B]/40 transition-colors"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-[#493447] text-white flex items-center justify-center font-bold text-xs">
                        {m.leaderName.charAt(0)}
                      </div>
                      <div>
                        <span className="font-bold text-xs text-[#2D1B4E]">{m.leaderName}</span>
                        <span className="text-[11px] text-[#4A3F55]/70 ml-2">
                          {m.leaderArea || 'Operaciones'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-xs">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-[#FFD3BF] text-[#BF3A1B]">
                        {m.theme}
                      </span>
                      <span className="text-[11px] text-[#4A3F55]/60">
                        {new Date(m.startedAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                  </div>

                  {/* V. Acción realizada (sin nombres de terceros) */}
                  <div className="p-3 bg-white rounded-lg border border-[#493447]/10 text-xs space-y-1">
                    <span className="font-bold text-[#2D1B4E] uppercase text-[10px] tracking-wider block">
                      V. Acción realizada por el líder:
                    </span>
                    <p className="text-[#4A3F55] leading-relaxed">
                      {m.actionPlan?.what || 'Plan de alineación en proceso de diseño.'}
                    </p>
                    {m.actionPlan?.careReminders && (
                      <p className="text-[11px] text-[#BF3A1B] italic">
                        Cuidado clave: {m.actionPlan.careReminders}
                      </p>
                    )}
                  </div>

                  {/* VI. Aprendizajes y reflexiones */}
                  {m.learnings && (
                    <div className="p-3 bg-white rounded-lg border border-[#493447]/10 text-xs space-y-1">
                      <span className="font-bold text-[#246B2A] uppercase text-[10px] tracking-wider block">
                        VI. Aprendizaje y reflexión del líder:
                      </span>
                      <p className="text-[#4A3F55] leading-relaxed font-leader italic">
                        "{m.learnings.insights || m.learnings.whatHappened}"
                      </p>
                    </div>
                  )}

                  {/* Skills badges */}
                  <div className="flex items-center gap-1.5 flex-wrap pt-1 text-[11px]">
                    <span className="font-semibold text-[#4A3F55]">Habilidades requeridas:</span>
                    {m.identifiedSkills.map((sk, idx) => (
                      <span key={idx} className="px-2 py-0.5 bg-white border border-[#493447]/15 rounded text-[10px] text-[#2D1B4E]">
                        {sk}
                      </span>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Registered Leaders Directory in this Company */}
      <div className="bg-white border border-[#493447]/10 rounded-2xl p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-[#493447]/10 pb-3">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-[#BF3A1B]" />
            <h3 className="font-heading font-bold text-base text-[#2D1B4E]">
              I & II. Censo de Líderes Registrados en {currentCompany.name}
            </h3>
          </div>
          <span className="text-xs text-[#4A3F55]/70 tabular-nums">{companyUsers.length} líderes</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-[#FFF7EF] text-[#2D1B4E] uppercase text-[10px] tracking-wider font-bold">
              <tr>
                <th className="p-3">Nombre del Líder</th>
                <th className="p-3">Puesto</th>
                <th className="p-3">Área</th>
                <th className="p-3 text-right">Personas a Cargo</th>
                <th className="p-3 text-center">Uso de Lidacta</th>
                <th className="p-3 text-right">Fecha de Registro</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#493447]/5">
              {companyUsers.map((u) => {
                const userMentorships = companyMentorships.filter((m) => m.leaderId === u.id);
                const hasUsed = userMentorships.length > 0;
                return (
                  <tr key={u.id} className="hover:bg-[#FFF7EF]/50 transition-colors">
                    <td className="p-3 font-semibold text-[#2D1B4E] flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-[#493447] text-white flex items-center justify-center font-bold text-[10px]">
                        {u.name.charAt(0)}
                      </div>
                      <span>{u.name}</span>
                    </td>
                    <td className="p-3 text-[#4A3F55]">{u.position}</td>
                    <td className="p-3 text-[#4A3F55]">{u.area || 'Operaciones'}</td>
                    <td className="p-3 text-right font-medium text-[#2D1B4E] tabular-nums">
                      {u.directReports ?? 0}
                    </td>
                    <td className="p-3 text-center">
                      {hasUsed ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#E2F7E1] text-[#246B2A]">
                          Activo ({userMentorships.length} casos)
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-neutral-100 text-[#4A3F55]/70">
                          Registrado sin uso
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-right text-[#4A3F55]/70 tabular-nums">
                      {new Date(u.createdAt).toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' })}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
