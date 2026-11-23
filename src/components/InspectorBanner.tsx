import React, { useState } from 'react';
import { useLidacta } from '../context/LidactaContext';
import { isHumanResourcesRole, getRoleDisplayName } from '../utils/roleUtils';
import { ActionPlanExecutionStatus, StageNumber } from '../types/lidacta';
import {
  TEST_STAGE6_SCENARIOS,
  TEST_STAGE_OPTIONS,
} from '../utils/testSessionFixtures';
import {
  ArrowLeft,
  Sparkles,
  Sliders,
  Eye,
  FlaskConical,
  Trash2,
  Play,
  ChevronDown,
  Loader2,
} from 'lucide-react';

export const InspectorBanner: React.FC = () => {
  const {
    isImpersonating,
    currentUser,
    mentorships,
    impersonateRole,
    stopImpersonation,
    openRoleWelcomeModal,
    createTestSessionAtStage,
    clearAllTestSessions,
  } = useLidacta();

  const [isQaLauncherOpen, setIsQaLauncherOpen] = useState(false);
  const [selectedStage, setSelectedStage] = useState<StageNumber>(1);
  const [stage6Scenario, setStage6Scenario] =
    useState<ActionPlanExecutionStatus>('pending_verification');
  const [isLaunching, setIsLaunching] = useState(false);

  if (!isImpersonating) return null;

  const isHR = isHumanResourcesRole(currentUser.role);
  const targetOppositeRole = isHR ? 'leader' : 'hr';
  const targetOppositeLabel = isHR ? 'Líder (Roberto)' : 'RH (Sofía)';
  const testSessionsCount = mentorships.filter((m) => Boolean(m.isTestSession)).length;
  const selectedStageMeta = TEST_STAGE_OPTIONS.find((o) => o.stage === selectedStage);

  const handleLaunchQuickTest = async () => {
    setIsLaunching(true);
    try {
      await createTestSessionAtStage(selectedStage, stage6Scenario);
      setIsQaLauncherOpen(false);
    } finally {
      setIsLaunching(false);
    }
  };

  return (
    <div
      role="status"
      aria-label="Barra de Modo Inspector Activo"
      className="sticky top-0 z-50 bg-[#24153F] text-white border-b-2 border-[#F7B538] shadow-2xl px-3 sm:px-6 py-2.5 flex flex-col gap-2 animate-in slide-in-from-top-2 duration-200"
    >
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        {/* Status Notice */}
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="relative flex h-2.5 w-2.5 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#F7B538] opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#F7B538]" />
          </span>
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#F7B538]/20 border border-[#F7B538]/40 text-[#F7B538] font-heading font-extrabold text-[10px] sm:text-[11px] tracking-wider uppercase">
              <Sliders className="w-3 h-3 text-[#F7B538]" />
              Modo Inspector
            </span>
          </div>
          <span className="text-xs text-[#FFF7EF]/90 truncate">
            Simulando a{' '}
            <strong className="text-white font-bold underline decoration-[#F7B538] decoration-2 underline-offset-2">
              {currentUser.name}
            </strong>
            <span className="text-white/60 hidden md:inline">
              {' '}
              · Rol: {getRoleDisplayName(currentUser.role)} ({currentUser.companyName})
            </span>
          </span>
        </div>

        {/* Quick Action Controls for Admin */}
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          {/* Quick QA Stage Launcher Toggle */}
          <button
            type="button"
            onClick={() => setIsQaLauncherOpen((prev) => !prev)}
            className={`min-h-[32px] px-2.5 py-1 border rounded-lg text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1 active:scale-95 shadow-xs ${
              isQaLauncherOpen
                ? 'bg-[#F7B538] text-[#2D1B4E] border-[#F7B538]'
                : 'bg-white/10 hover:bg-white/20 text-[#F7B538] border-[#F7B538]/40'
            }`}
            title="Iniciar una sesión de prueba aislada directamente en cualquiera de las 7 etapas"
          >
            <FlaskConical className="w-3.5 h-3.5" />
            <span>Probar Etapa (1-7)</span>
            <ChevronDown
              className={`w-3 h-3 transition-transform ${isQaLauncherOpen ? 'rotate-180' : ''}`}
            />
          </button>

          {testSessionsCount > 0 && (
            <button
              type="button"
              onClick={() => clearAllTestSessions()}
              className="min-h-[32px] px-2.5 py-1 bg-white/10 hover:bg-red-500/30 text-[#FFD3BF] hover:text-white border border-white/20 rounded-lg text-[11px] font-semibold transition-all cursor-pointer flex items-center gap-1 active:scale-95 shadow-xs"
              title="Eliminar todas las sesiones de prueba QA sin afectar datos reales"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Limpiar QA ({testSessionsCount})</span>
              <span className="sm:hidden">QA ({testSessionsCount})</span>
            </button>
          )}

          {/* Switch to Opposite Role */}
          <button
            type="button"
            onClick={() => impersonateRole(targetOppositeRole)}
            className="min-h-[32px] px-2.5 py-1 bg-white/10 hover:bg-white/20 text-[#FFF7EF] hover:text-white border border-white/20 rounded-lg text-[11px] font-semibold transition-all cursor-pointer flex items-center gap-1 active:scale-95 shadow-xs"
            title={`Cambiar vista instantáneamente a ${targetOppositeLabel}`}
          >
            <Eye className="w-3.5 h-3.5 text-[#F7B538]" />
            <span>Ver como {targetOppositeLabel}</span>
          </button>

          {/* Test Welcome Modal for Current Simulated Role */}
          <button
            type="button"
            onClick={() => openRoleWelcomeModal(currentUser.role, currentUser.name)}
            className="min-h-[32px] px-2.5 py-1 bg-[#BF3A1B]/30 hover:bg-[#BF3A1B]/50 text-[#FFD3BF] hover:text-white border border-[#BF3A1B]/40 rounded-lg text-[11px] font-semibold transition-all cursor-pointer flex items-center gap-1 active:scale-95 shadow-xs"
            title="Abrir y verificar el modal de bienvenida correspondiente a este rol"
          >
            <Sparkles className="w-3.5 h-3.5 text-[#F7B538]" />
            <span className="hidden sm:inline">Probar Modal Bienvenida</span>
            <span className="sm:hidden">Modal</span>
          </button>

          {/* Exit Inspector Mode & Return to Admin Dashboard */}
          <button
            type="button"
            onClick={stopImpersonation}
            className="min-h-[32px] px-3 py-1 bg-linear-to-r from-[#F7B538] to-[#FF8C42] hover:from-[#f5a91e] hover:to-[#ff7b29] text-[#2D1B4E] font-heading font-extrabold text-xs rounded-lg transition-all cursor-pointer flex items-center gap-1.5 shadow-md hover:shadow-lg active:scale-95"
            title="Regresar al Panel de Administradora de Tania Padierna"
          >
            <ArrowLeft className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Volver a Administradora</span>
          </button>
        </div>
      </div>

      {/* Collapsible Quick QA Generator Bar */}
      {isQaLauncherOpen && (
        <div className="bg-[#1A0E30] border border-[#F7B538]/40 rounded-xl p-3 space-y-2.5 text-xs animate-in fade-in duration-150">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-bold text-[#F7B538] uppercase tracking-wider mr-1">
                Etapa inicial:
              </span>
              {TEST_STAGE_OPTIONS.map((opt) => (
                <button
                  key={opt.stage}
                  type="button"
                  onClick={() => setSelectedStage(opt.stage)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                    selectedStage === opt.stage
                      ? 'bg-[#F7B538] text-[#2D1B4E] shadow-xs'
                      : 'bg-white/10 text-[#FFF7EF]/85 hover:bg-white/20'
                  }`}
                >
                  {opt.stage}. {opt.shortTitle}
                </button>
              ))}
            </div>

            <button
              type="button"
              disabled={isLaunching}
              onClick={handleLaunchQuickTest}
              className="min-h-[34px] px-3.5 py-1.5 bg-[#BF3A1B] hover:bg-[#a63014] text-white font-heading font-extrabold text-xs rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 shrink-0 disabled:opacity-60"
            >
              {isLaunching ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Generando sesión...</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Iniciar prueba en Etapa {selectedStage}</span>
                </>
              )}
            </button>
          </div>

          {selectedStage === 6 && (
            <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-white/10">
              <span className="text-[11px] font-bold text-[#FFD3BF]">Escenario Etapa 6:</span>
              {TEST_STAGE6_SCENARIOS.map((sc) => (
                <button
                  key={sc.id}
                  type="button"
                  onClick={() => setStage6Scenario(sc.id)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
                    stage6Scenario === sc.id
                      ? 'bg-[#FFD3BF] text-[#2D1B4E] font-bold'
                      : 'bg-white/10 text-white/80 hover:bg-white/20'
                  }`}
                >
                  {sc.label}
                </button>
              ))}
            </div>
          )}

          {selectedStageMeta && (
            <p className="text-[11px] text-[#FFF7EF]/75 leading-snug">
              <strong className="text-[#F7B538]">Contexto preparado:</strong> {selectedStageMeta.preparedContext} ·{' '}
              <span className="text-[#FFD3BF]">Aislamiento activo (sin correos, sin métricas ni alertas reales).</span>
            </p>
          )}
        </div>
      )}
    </div>
  );
};
