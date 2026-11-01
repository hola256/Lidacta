import React from 'react';
import { useLidacta } from '../context/LidactaContext';
import { isHumanResourcesRole, getRoleDisplayName } from '../utils/roleUtils';
import { ArrowLeft, Sparkles, Sliders, Eye } from 'lucide-react';

export const InspectorBanner: React.FC = () => {
  const {
    isImpersonating,
    currentUser,
    impersonateRole,
    stopImpersonation,
    openRoleWelcomeModal,
  } = useLidacta();

  if (!isImpersonating) return null;

  const isHR = isHumanResourcesRole(currentUser.role);
  const targetOppositeRole = isHR ? 'leader' : 'hr';
  const targetOppositeLabel = isHR ? 'Líder (Roberto)' : 'RH (Sofía)';

  return (
    <div
      role="status"
      aria-label="Barra de Modo Inspector Activo"
      className="sticky top-0 z-50 bg-[#24153F] text-white border-b-2 border-[#F7B538] shadow-2xl px-3 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-2.5 animate-in slide-in-from-top-2 duration-200"
    >
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
          Simulando a <strong className="text-white font-bold underline decoration-[#F7B538] decoration-2 underline-offset-2">{currentUser.name}</strong>
          <span className="text-white/60 hidden md:inline"> · Rol: {getRoleDisplayName(currentUser.role)} ({currentUser.companyName})</span>
        </span>
      </div>

      {/* Quick Action Controls for Admin */}
      <div className="flex items-center gap-2 shrink-0">
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
  );
};
