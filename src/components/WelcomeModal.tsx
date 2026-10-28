import React, { useState } from 'react';
import { useLidacta } from '../context/LidactaContext';
import { Sparkles, Mail, CheckCircle2, Send, ExternalLink } from 'lucide-react';

export const WelcomeModal: React.FC = () => {
  const { currentUser, welcomeModalData, closeWelcomeModal, openEmailDrawer, sendProfileInvite } = useLidacta();
  const [isSendingInvite, setIsSendingInvite] = useState(false);
  const [inviteSent, setInviteSent] = useState(false);

  if (!welcomeModalData) return null;

  const { user } = welcomeModalData;

  const handleSendInvite = async () => {
    setIsSendingInvite(true);
    try {
      await sendProfileInvite({
        id: user.id,
        email: user.email,
        name: user.name,
        companyName: user.companyName,
        role: user.role,
      });
      setInviteSent(true);
    } catch (e) {
      console.warn('Error sending profile invite:', e);
      setInviteSent(true);
    } finally {
      setIsSendingInvite(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[#2D1B4E]/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in">
      <div className="bg-white border-2 border-[#BF3A1B]/30 rounded-2xl max-w-lg w-full shadow-2xl p-4 sm:p-7 space-y-4 text-center my-auto max-h-[92vh] overflow-y-auto">
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
            La cuenta para <strong>{user.name}</strong> ({user.email}) ha sido registrada en la Base de Datos Central vinculada a <strong>{user.companyName}</strong>.
          </p>
        </div>

        {/* Automatic Welcome Notification Card */}
        <div className="p-3.5 sm:p-4 bg-[#FFF7EF] rounded-xl border border-[#493447]/10 text-xs text-left text-[#4A3F55] space-y-1.5">
          <div className="flex items-center gap-1.5 font-bold text-[#2D1B4E]">
            <CheckCircle2 className="w-4 h-4 text-[#246B2A] shrink-0" />
            <span>Notificación y correo de bienvenida generados:</span>
          </div>
          <p className="text-[11px] leading-relaxed">
            Se ha disparado automáticamente el correo electrónico de bienvenida institucional a <strong>{user.email}</strong>.
          </p>
        </div>

        {/* Dedicated Option: Enviar correo al usuario para completar su perfil */}
        <div className="p-3.5 sm:p-4 bg-[#FFFDF9] rounded-xl border-2 border-dashed border-[#F7B538] text-xs text-left space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Send className="w-4 h-4 text-[#BF3A1B] shrink-0" />
              <span className="font-bold text-[#2D1B4E]">Invitación de Onboarding / Completar Perfil:</span>
            </div>
            {inviteSent && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#246B2A]/10 text-[#246B2A] font-bold text-[10px]">
                <CheckCircle2 className="w-3 h-3" /> Enviado
              </span>
            )}
          </div>
          <p className="text-[11px] text-[#4A3F55] leading-relaxed">
            Envía un correo con el enlace directo para que el usuario ingrese a Lidacta y complete su perfil operativo (Área, Puesto, WhatsApp y Personas a Cargo) antes de su primera sesión.
          </p>
          <button
            type="button"
            onClick={handleSendInvite}
            disabled={isSendingInvite}
            className={`w-full min-h-[44px] px-4 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm active:scale-98 ${
              inviteSent
                ? 'bg-[#246B2A] text-white hover:bg-[#1E5622]'
                : 'bg-[#2D1B4E] hover:bg-[#3D2666] text-[#FFFDF9]'
            }`}
          >
            {isSendingInvite ? (
              <>
                <div className="w-4 h-4 border-2 border-[#F7B538] border-t-transparent rounded-full animate-spin" />
                <span>Enviando invitación a {user.email}...</span>
              </>
            ) : inviteSent ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-[#F7B538]" />
                <span>¡Correo de invitación enviado con éxito! (Reenviar)</span>
              </>
            ) : (
              <>
                <Send className="w-4 h-4 text-[#F7B538]" />
                <span>Enviar correo al usuario para completar su perfil</span>
              </>
            )}
          </button>
        </div>

        {/* Footer Action Buttons */}
        <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-2.5 sm:gap-3">
          <button
            onClick={() => {
              closeWelcomeModal();
              openEmailDrawer();
            }}
            className="w-full sm:w-auto min-h-[44px] px-4 py-2.5 bg-[#FFF7EF] hover:bg-[#FFD3BF]/30 text-[#2D1B4E] border border-[#493447]/15 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 shadow-xs"
          >
            <Mail className="w-4 h-4 text-[#BF3A1B]" />
            <span>Ver correos en simulador</span>
          </button>

          <button
            onClick={closeWelcomeModal}
            className="w-full sm:w-auto min-h-[44px] px-6 py-2.5 bg-[#BF3A1B] hover:bg-[#a63014] text-white rounded-xl font-bold text-xs shadow-xs transition-colors cursor-pointer flex items-center justify-center active:scale-95"
          >
            Aceptar y Continuar
          </button>
        </div>
      </div>
    </div>
  );
};
