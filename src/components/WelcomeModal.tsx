import React from 'react';
import { useLidacta } from '../context/LidactaContext';
import { Sparkles, Mail, CheckCircle2 } from 'lucide-react';

export const WelcomeModal: React.FC = () => {
  const { welcomeModalData, closeWelcomeModal, openEmailDrawer } = useLidacta();

  if (!welcomeModalData) return null;

  const { user, emailText } = welcomeModalData;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[#2D1B4E]/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in">
      <div className="bg-white border-2 border-[#BF3A1B]/30 rounded-2xl max-w-lg w-full shadow-2xl p-4 sm:p-8 space-y-4 sm:space-y-5 text-center my-auto max-h-[92vh] overflow-y-auto">
        <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-[#FFD3BF] text-[#BF3A1B] flex items-center justify-center mx-auto shadow-sm">
          <Sparkles className="w-6 h-6 sm:w-7 sm:h-7" />
        </div>

        <div className="space-y-1.5 sm:space-y-2">
          <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-[#BF3A1B]">
            ¡Perfil Creado Exitosamente!
          </span>
          <h2 className="font-heading font-extrabold text-xl sm:text-2xl text-[#2D1B4E]">
            ¡Te damos la bienvenida a Lidacta, {user.name}!
          </h2>
          <p className="text-xs sm:text-sm text-[#4A3F55] leading-relaxed max-w-md mx-auto">
            Tu espacio confidencial de liderazgo en {user.companyName} está listo. Aquí podrás analizar retos reales, practicar con simulaciones y actuar con mayor autonomía.
          </p>
        </div>

        <div className="p-3.5 sm:p-4 bg-[#FFF7EF] rounded-xl border border-[#493447]/10 text-xs text-left text-[#4A3F55] space-y-1.5">
          <div className="flex items-center gap-1.5 font-bold text-[#2D1B4E]">
            <CheckCircle2 className="w-4 h-4 text-[#246B2A] shrink-0" />
            <span>Notificación y bienvenida enviadas:</span>
          </div>
          <p className="text-[11px] leading-relaxed">
            Hemos enviado un correo cálido de bienvenida a tu buzón institucional (<strong>{user.email}</strong>).
          </p>
        </div>

        <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-2.5 sm:gap-3">
          <button
            onClick={() => {
              closeWelcomeModal();
              openEmailDrawer();
            }}
            className="w-full sm:w-auto min-h-[44px] px-4 py-2.5 bg-[#FFF7EF] hover:bg-[#FFD3BF]/30 text-[#2D1B4E] border border-[#493447]/15 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 shadow-xs"
          >
            <Mail className="w-4 h-4 text-[#BF3A1B]" />
            <span>Ver correo de bienvenida</span>
          </button>

          <button
            onClick={closeWelcomeModal}
            className="w-full sm:w-auto min-h-[44px] px-6 py-2.5 bg-[#BF3A1B] hover:bg-[#a63014] text-white rounded-xl font-bold text-xs shadow-xs transition-colors cursor-pointer flex items-center justify-center active:scale-95"
          >
            Comenzar en Lidacta
          </button>
        </div>
      </div>
    </div>
  );
};
