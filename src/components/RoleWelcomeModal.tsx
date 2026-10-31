import React, { useEffect, useState } from 'react';
import { useLidacta } from '../context/LidactaContext';
import { X, ArrowRight, CheckCircle2 } from 'lucide-react';
import { isHumanResourcesRole, isLeaderRole } from '../utils/roleUtils';

/**
 * Isotipo oficial SVG de Lidacta:
 * 'L' estilizada con flecha ascendente naranja/blanca sobre fondo ciruela (#2D1B4E).
 * Proporción compacta y discreta para no distraer la lectura del mensaje.
 */
export const LidactaIsotype: React.FC<{ className?: string }> = ({
  className = 'w-full h-full',
}) => (
  <svg
    viewBox="0 0 340 340"
    className={className}
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-label="Isotipo Lidacta"
  >
    {/* Fondo ciruela */}
    <rect width="340" height="340" rx="72" fill="#2D1B4E" />
    {/* Punto superior de la 'L' */}
    <circle cx="103" cy="95" r="26" fill="#FFFFFF" />
    {/* Trazo vertical y curvatura de la 'L' */}
    <path
      d="M103 138 V228 Q103 248 123 248 H173"
      stroke="#FFFFFF"
      strokeWidth="36"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    {/* Flecha ascendente naranja */}
    <path
      d="M150 248 L235 163 M195 163 H235 V203"
      stroke="#F7B538"
      strokeWidth="30"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

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

  // Strict evaluation of the stored "Rol en la Plataforma" selected during registration:
  // Evaluates explicit role keys: LEADER, LIDER, lider, leader vs HR, RH, rh, hr (ignoring position text)
  let storedRegisteredRole: string | null = null;
  try {
    if (currentUser?.id) {
      storedRegisteredRole =
        sessionStorage.getItem(`lidacta_registered_role_${currentUser.id}`) ||
        localStorage.getItem(`lidacta_registered_role_${currentUser.id}`);
    }
    if (!storedRegisteredRole && currentUser?.email) {
      storedRegisteredRole =
        sessionStorage.getItem(`lidacta_registered_role_${currentUser.email.toLowerCase()}`) ||
        localStorage.getItem(`lidacta_registered_role_${currentUser.email.toLowerCase()}`);
    }
  } catch {}

  const rawRole = (activeData.role || storedRegisteredRole || currentUser?.role || 'leader')
    .toString()
    .trim()
    .toLowerCase();

  const isHR = isHumanResourcesRole(rawRole);
  const isLeader = isLeaderRole(rawRole) && !isHR;

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
      <div className="bg-white border-2 border-[#BF3A1B]/20 rounded-3xl max-w-lg w-full shadow-2xl p-6 sm:p-8 space-y-5 text-center my-auto max-h-[92vh] overflow-y-auto relative animate-in zoom-in-95 duration-200">
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

        {/* Isotipo Lidacta Superior (Discreto, Pequeño y Armónico) */}
        <div className="flex items-center justify-center mx-auto pt-1">
          <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl shadow-md ring-2 ring-[#F7B538]/30 flex items-center justify-center overflow-hidden shrink-0 transition-transform hover:scale-105">
            <LidactaIsotype className="w-full h-full" />
          </div>
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
