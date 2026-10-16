import React from 'react';
import { useLidacta } from '../context/LidactaContext';
import { Mail, X, CheckCircle, ShieldCheck } from 'lucide-react';

export const EmailSimulatorDrawer: React.FC = () => {
  const { isEmailDrawerOpen, closeEmailDrawer, notifications, selectedEmailForPreview } = useLidacta();

  if (!isEmailDrawerOpen) return null;

  const emailsList = notifications.filter((n) => n.emailSimulated);
  const currentEmail = selectedEmailForPreview || emailsList[0];

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-[#2D1B4E]/40 backdrop-blur-xs flex justify-end animate-in fade-in">
      <div className="w-full sm:max-w-xl bg-white h-full shadow-2xl flex flex-col border-l border-[#493447]/20">
        {/* Drawer Header */}
        <div className="p-3.5 sm:p-4 bg-[#2D1B4E] text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Mail className="w-4 h-4 text-[#F7B538]" />
            <h3 className="font-heading font-bold text-xs sm:text-sm">
              Bandeja de Correos Transaccionales (Simulador)
            </h3>
          </div>
          <button
            onClick={closeEmailDrawer}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-white/70 hover:text-white cursor-pointer active:scale-95"
            title="Cerrar bandeja"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Confidentiality reminder */}
        <div className="p-3 bg-[#FFF7EF] border-b border-[#493447]/10 flex items-center gap-2 text-xs text-[#4A3F55]">
          <ShieldCheck className="w-4 h-4 text-[#BF3A1B] shrink-0" />
          <span className="leading-tight">
            Lidacta envía notificaciones por correo respetando estrictamente la confidencialidad: RH nunca recibe detalles privados del caso.
          </span>
        </div>

        {/* Content: Selected Email Details */}
        <div className="flex-1 overflow-y-auto p-3.5 sm:p-6 space-y-4">
          {currentEmail?.emailSimulated ? (
            <div className="space-y-4">
              <div className="p-3.5 sm:p-4 bg-[#FFF7EF]/60 rounded-xl border border-[#493447]/10 space-y-2 text-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[#493447]/10 pb-2 gap-1">
                  <span className="font-bold text-[#2D1B4E]">Para:</span>
                  <span className="font-mono text-[#BF3A1B] break-all">{currentEmail.emailSimulated.to}</span>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[#493447]/10 pb-2 gap-1">
                  <span className="font-bold text-[#2D1B4E]">Asunto:</span>
                  <span className="font-semibold text-[#2D1B4E]">{currentEmail.emailSimulated.subject}</span>
                </div>
                <div className="flex items-center justify-between text-[#4A3F55]/60 text-[11px]">
                  <span>Fecha:</span>
                  <span>{new Date(currentEmail.timestamp).toLocaleString()}</span>
                </div>
              </div>

              {/* Email Body */}
              <div className="p-4 sm:p-6 bg-white border border-[#493447]/15 rounded-2xl shadow-xs space-y-3">
                <div className="flex items-center gap-2 border-b border-[#493447]/10 pb-3">
                  <div className="w-7 h-7 rounded-lg bg-[#2D1B4E] text-[#F7B538] flex items-center justify-center font-bold text-xs">
                    L
                  </div>
                  <span className="font-heading font-bold text-sm text-[#2D1B4E]">
                    Lidacta · Desarrollo de Liderazgo en acción
                  </span>
                </div>
                <p className="text-xs text-[#4A3F55] leading-relaxed whitespace-pre-line font-normal">
                  {currentEmail.emailSimulated.bodyText}
                </p>
              </div>
            </div>
          ) : (
            <div className="p-8 text-center text-xs text-[#4A3F55]/70">
              No hay correos en la bandeja.
            </div>
          )}

          {/* History of other emails */}
          <div className="pt-4 border-t border-[#493447]/10 space-y-2">
            <span className="text-xs font-bold text-[#2D1B4E] uppercase tracking-wider block">
              Historial de correos generados ({emailsList.length}):
            </span>
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {emailsList.map((e) => (
                <div
                  key={e.id}
                  className="p-2.5 bg-[#FFF7EF]/40 hover:bg-[#FFD3BF]/20 rounded-lg border border-[#493447]/10 text-xs transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-[#2D1B4E] truncate max-w-[280px]">
                      {e.emailSimulated?.subject}
                    </span>
                    <span className="text-[10px] text-[#4A3F55]/60">
                      {new Date(e.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
