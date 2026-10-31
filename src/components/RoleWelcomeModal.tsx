import React, { useEffect, useState } from 'react';
import { useLidacta } from '../context/LidactaContext';
import { Sparkles, X, ArrowRight, CheckCircle2, Users } from 'lucide-react';
import { isHumanResourcesRole } from '../utils/roleUtils';

export const RoleWelcomeModal: React.FC = () => {
  const { roleWelcomeModalData, closeRoleWelcomeModal, currentUser } = useLidacta();
  const [persistedData, setPersistedData] = useState<{ role: string; name?: string } | null>(null);

  // Synchronize with sessionStorage for universal resilience across desktop & mobile
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem('lidacta_show_role_welcome');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && parsed.role) {
          setPersistedData(parsed);
        }
      }
    } catch {}
  }, [roleWelcomeModalData]);

  const activeData = roleWelcomeModalData || persistedData;

  const handleClose = () => {
    try {
      sessionStorage.removeItem('lidacta_show_role_welcome');
    } catch {}
    setPersistedData(null);
    closeRoleWelcomeModal();
  };

  // Close with Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && activeData) {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeData]);

  if (!activeData) return null;

  // Exhaustive HR / RH role evaluation supporting 'HR', 'RH', 'hr', 'rh', 'RECURSOS_HUMANOS', etc.
  const effectiveRole = activeData.role || currentUser?.role || 'leader';
  const isHR = isHumanResourcesRole(effectiveRole);

  return (
    <div
      className="fixed inset-0 z-[99999] overflow-y-auto bg-[#2D1B4E]/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="role-welcome-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          handleClose();
        }
      }}
    >
      <div className="bg-white border-2 border-[#BF3A1B]/20 rounded-3xl max-w-lg w-full shadow-2xl p-6 sm:p-8 space-y-6 text-center my-auto max-h-[92vh] overflow-y-auto relative animate-in zoom-in-95 duration-200">
        {/* Close Button Top-Right */}
        <button
          type="button"
          onClick={handleClose}
          className="absolute top-4 right-4 w-9 h-9 rounded-full bg-[#FFF7EF] hover:bg-[#FFD3BF]/50 text-[#4A3F55] hover:text-[#2D1B4E] flex items-center justify-center transition-colors cursor-pointer"
          title="Cerrar ventana"
          aria-label="Cerrar"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Icon Badge */}
        <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-tr from-[#2D1B4E] to-[#493447] text-[#F7B538] flex items-center justify-center mx-auto shadow-md ring-4 ring-[#F7B538]/20">
          {isHR ? (
            <Users className="w-7 h-7 sm:w-8 sm:h-8" />
          ) : (
            <Sparkles className="w-7 h-7 sm:w-8 sm:h-8" />
          )}
        </div>

        {/* Header & Subtitle */}
        <div className="space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FFF7EF] border border-[#FFD3BF] text-[11px] font-extrabold uppercase tracking-wider text-[#BF3A1B]">
            <CheckCircle2 className="w-3.5 h-3.5 text-[#246B2A]" />
            <span>Perfil Completado con Éxito</span>
          </div>

          <h2
            id="role-welcome-title"
            className="font-heading font-extrabold text-2xl sm:text-3xl text-[#2D1B4E] tracking-tight pt-1"
          >
            ¡Bienvenido/a a Lidacta!
          </h2>
        </div>

        {/* Role-Specific Body Copy */}
        <div className="p-4 sm:p-5 bg-[#FFF7EF]/80 rounded-2xl border border-[#493447]/10 text-left space-y-3 shadow-2xs">
          {isHR ? (
            <>
              <p className="text-xs sm:text-sm text-[#2D1B4E] leading-relaxed">
                Nos alegra que formes parte de este espacio. Aquí podrás impulsar el desarrollo de tus líderes y dar seguimiento a su participación y progreso a través de indicadores que te permitirán conocer cómo avanzan en su experiencia dentro de la plataforma.
              </p>
              <p className="text-xs sm:text-sm font-semibold text-[#BF3A1B] leading-relaxed pt-1 border-t border-[#493447]/10">
                Porque desarrollar el liderazgo también significa acompañar, observar y reconocer el progreso. ¡Comencemos!
              </p>
            </>
          ) : (
            <>
              <p className="text-xs sm:text-sm text-[#2D1B4E] leading-relaxed">
                Nos alegra que formes parte de este espacio. Aquí encontrarás una nueva forma de impulsar el desarrollo de tus líderes, acercándolos a herramientas de acompañamiento para enfrentar los retos reales de su día a día.
              </p>
              <p className="text-xs sm:text-sm font-semibold text-[#BF3A1B] leading-relaxed pt-1 border-t border-[#493447]/10">
                Construyamos juntos nuevas formas de desarrollar el liderazgo. ¡Comencemos!
              </p>
            </>
          )}
        </div>

        {/* Action Button */}
        <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            type="button"
            onClick={handleClose}
            className="w-full sm:w-auto min-h-[48px] px-8 py-3 bg-[#2D1B4E] hover:bg-[#3D2666] text-[#F7B538] font-heading font-extrabold text-sm rounded-xl shadow-md hover:shadow-lg transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-98"
          >
            <span>¡Comencemos!</span>
            <ArrowRight className="w-4 h-4 text-[#F7B538]" />
          </button>
        </div>
      </div>
    </div>
  );
};
