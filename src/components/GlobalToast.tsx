import React from 'react';
import { useLidacta } from '../context/LidactaContext';
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X } from 'lucide-react';

export const GlobalToast: React.FC = () => {
  const { toast, hideToast } = useLidacta();

  if (!toast) return null;

  const iconMap = {
    success: <CheckCircle2 className="w-5 h-5 text-[#F7B538] shrink-0" />,
    error: <AlertCircle className="w-5 h-5 text-[#BF3A1B] shrink-0" />,
    warning: <AlertTriangle className="w-5 h-5 text-[#F7B538] shrink-0" />,
    info: <Info className="w-5 h-5 text-[#C9BDF2] shrink-0" />,
  };

  const borderMap = {
    success: 'border-[#F7B538]/50 shadow-[#F7B538]/10',
    error: 'border-[#BF3A1B]/60 shadow-[#BF3A1B]/20',
    warning: 'border-[#F7B538]/50 shadow-[#F7B538]/15',
    info: 'border-[#493447]/30 shadow-black/20',
  };

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed top-4 sm:top-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-md px-4 pointer-events-none transition-all duration-300 animate-in fade-in slide-in-from-top-4"
    >
      <div
        className={`pointer-events-auto bg-[#2D1B4E] text-white border rounded-2xl p-4 shadow-2xl flex items-start justify-between gap-3 backdrop-blur-md ${borderMap[toast.type] || borderMap.info}`}
      >
        <div className="flex items-start gap-3">
          <div className="pt-0.5">{iconMap[toast.type] || iconMap.info}</div>
          <div className="space-y-0.5">
            <h4 className="font-heading font-bold text-xs uppercase tracking-wider text-[#F7B538]">
              {toast.type === 'success'
                ? 'Perfil Actualizado'
                : toast.type === 'error'
                ? 'Atención'
                : 'Notificación'}
            </h4>
            <p className="text-xs sm:text-sm text-[#FFF7EF] font-medium leading-relaxed">
              {toast.message}
            </p>
          </div>
        </div>

        <button
          onClick={hideToast}
          aria-label="Cerrar notificación"
          className="text-[#FFF7EF]/60 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors cursor-pointer shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
