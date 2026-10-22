import React, { useState } from 'react';
import { useLidacta } from '../context/LidactaContext';
import {
  Headphones,
  UserCheck,
  X,
  Send,
  CheckCircle2,
  Mail,
  MessageSquare,
  Sparkles,
  ShieldCheck,
  ExternalLink,
} from 'lucide-react';
import { WhatsAppVoiceRecorder } from './WhatsAppVoiceRecorder';
import { STAGE_META } from './LeaderView';
import { StageNumber } from '../types/lidacta';

interface RequestMentorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const RequestMentorModal: React.FC<RequestMentorModalProps> = ({ isOpen, onClose }) => {
  const { currentUser, activeMentorship, requestHumanMentor, openEmailDrawer, notifications } = useLidacta();

  const [reasonText, setReasonText] = useState('');
  const [priority, setPriority] = useState<'normal' | 'alta'>('normal');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedData, setSubmittedData] = useState<{
    success: boolean;
    whatsappUrl: string;
    notificationId: string;
  } | null>(null);

  if (!isOpen) return null;

  const currentStageNum = (activeMentorship?.currentStage || 1) as StageNumber;
  const currentStageMeta = STAGE_META[currentStageNum];

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!reasonText.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const fullReason =
        priority === 'alta'
          ? `[ALTA PRIORIDAD] ${reasonText.trim()}`
          : reasonText.trim();

      const result = await requestHumanMentor(fullReason, false);
      setSubmittedData({
        success: true,
        whatsappUrl: result.whatsappUrl,
        notificationId: result.notificationId,
      });
    } catch (err) {
      console.error('Error submitting mentor request:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVoiceTranscript = (text: string) => {
    setReasonText((prev) => (prev ? `${prev} ${text}` : text));
  };

  const handleVoiceSendDirect = async (text: string) => {
    if (!text.trim() || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const fullReason =
        priority === 'alta'
          ? `[ALTA PRIORIDAD] [Nota de Voz] ${text.trim()}`
          : `[Nota de Voz] ${text.trim()}`;

      const result = await requestHumanMentor(fullReason, true);
      setSubmittedData({
        success: true,
        whatsappUrl: result.whatsappUrl,
        notificationId: result.notificationId,
      });
    } catch (err) {
      console.error('Error submitting voice mentor request:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetAndClose = () => {
    setReasonText('');
    setPriority('normal');
    setSubmittedData(null);
    onClose();
  };

  const handleViewGeneratedEmail = () => {
    if (submittedData?.notificationId) {
      const notif = notifications.find((n) => n.id === submittedData.notificationId);
      openEmailDrawer(notif);
    } else {
      openEmailDrawer();
    }
    handleResetAndClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[#2D1B4E]/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in">
      <div className="w-full max-w-xl bg-white rounded-3xl shadow-2xl border border-[#493447]/20 overflow-hidden flex flex-col">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 bg-[#2D1B4E] text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#F7B538] text-[#2D1B4E] flex items-center justify-center font-bold shadow-md shrink-0">
              <Headphones className="w-5 h-5 text-[#2D1B4E]" />
            </div>
            <div>
              <h2 className="font-heading font-extrabold text-base sm:text-lg leading-tight">
                Hablar con un Mentor Humano
              </h2>
              <p className="text-xs text-[#FFF7EF]/80 mt-0.5">
                Acompañamiento personalizado directo con la Dirección de Mentoría
              </p>
            </div>
          </div>
          <button
            onClick={handleResetAndClose}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-white/70 hover:text-white hover:bg-white/10 transition-colors cursor-pointer active:scale-95"
            title="Cerrar ventana"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 space-y-4 sm:space-y-5 overflow-y-auto max-h-[80vh]">
          {submittedData?.success ? (
            /* Success confirmation screen */
            <div className="text-center py-4 space-y-4 animate-in zoom-in-95">
              <div className="w-14 h-14 bg-[#E2F7E1] text-[#246B2A] rounded-2xl mx-auto flex items-center justify-center shadow-sm">
                <CheckCircle2 className="w-8 h-8" />
              </div>

              <div className="space-y-1.5">
                <h3 className="font-heading font-extrabold text-lg sm:text-xl text-[#2D1B4E]">
                  ¡Solicitud Enviada con Éxito!
                </h3>
                <p className="text-xs sm:text-sm text-[#4A3F55] max-w-md mx-auto leading-relaxed">
                  Hemos notificado a <span className="font-bold text-[#2D1B4E]">Tania Padierna</span> (Directora de Mentoría) a través de los tres canales automáticos:
                </p>
              </div>

              {/* Multichannel Delivery Confirmation Box */}
              <div className="bg-[#FFF7EF] border border-[#FFD3BF] rounded-2xl p-4 text-left space-y-2.5 text-xs text-[#2D1B4E]">
                <div className="flex items-center gap-2 font-bold text-[#BF3A1B]">
                  <Sparkles className="w-4 h-4" />
                  <span>Notificaciones multicanal entregadas:</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div className="p-2.5 bg-white rounded-xl border border-[#493447]/10 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span>Panel Admin (Alerta)</span>
                  </div>
                  <div className="p-2.5 bg-white rounded-xl border border-[#493447]/10 flex items-center gap-2">
                    <Mail className="w-3.5 h-3.5 text-[#BF3A1B]" />
                    <span className="truncate">Email enviado</span>
                  </div>
                  <div className="p-2.5 bg-white rounded-xl border border-[#493447]/10 flex items-center gap-2">
                    <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                    <span>WhatsApp alerta</span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
                <a
                  href={submittedData.whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 min-h-[44px] flex items-center justify-center gap-2 px-4 py-2.5 bg-[#25D366] hover:bg-[#20ba59] text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>Abrir mensaje en WhatsApp</span>
                  <ExternalLink className="w-3 h-3 ml-0.5" />
                </a>

                <button
                  type="button"
                  onClick={handleViewGeneratedEmail}
                  className="flex-1 min-h-[44px] flex items-center justify-center gap-2 px-4 py-2.5 bg-[#FFF7EF] hover:bg-[#FFD3BF]/40 text-[#2D1B4E] border border-[#493447]/20 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                >
                  <Mail className="w-4 h-4 text-[#BF3A1B]" />
                  <span>Ver correo en simulador</span>
                </button>
              </div>

              <button
                type="button"
                onClick={handleResetAndClose}
                className="w-full min-h-[44px] py-2.5 bg-[#2D1B4E] hover:bg-[#493447] text-white text-xs font-bold rounded-xl transition-colors cursor-pointer active:scale-95"
              >
                Volver a mi acompañamiento
              </button>
            </div>
          ) : (
            /* Request Form */
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Context banner showing leader and current case info */}
              <div className="p-3.5 sm:p-4 bg-[#FFF7EF] border border-[#FFD3BF] rounded-2xl space-y-2">
                <div className="flex items-center justify-between text-xs text-[#2D1B4E] font-bold">
                  <div className="flex items-center gap-1.5">
                    <UserCheck className="w-4 h-4 text-[#BF3A1B]" />
                    <span>Solicitante: {currentUser.name}</span>
                  </div>
                  <span className="text-[11px] text-[#BF3A1B] bg-[#FFD3BF]/60 px-2 py-0.5 rounded-full font-bold">
                    {currentStageMeta?.name || `Etapa ${currentStageNum}`}
                  </span>
                </div>
                <div className="text-xs text-[#4A3F55] leading-snug">
                  <span className="font-semibold text-[#2D1B4E]">Caso activo: </span>
                  {activeMentorship?.title || 'Acompañamiento en curso'}
                </div>
              </div>

              {/* Priority Selector */}
              <div className="space-y-1.5">
                <label className="text-xs font-heading font-bold text-[#2D1B4E] block">
                  Nivel de urgencia:
                </label>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setPriority('normal')}
                    className={`min-h-[42px] px-3 py-2 rounded-xl border text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      priority === 'normal'
                        ? 'bg-[#2D1B4E] text-white border-[#2D1B4E] shadow-xs'
                        : 'bg-[#FFF7EF]/60 text-[#4A3F55] border-[#493447]/15 hover:border-[#BF3A1B]'
                    }`}
                  >
                    <span>📅 Normal (Dudas o alineación)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPriority('alta')}
                    className={`min-h-[42px] px-3 py-2 rounded-xl border text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      priority === 'alta'
                        ? 'bg-[#BF3A1B] text-white border-[#BF3A1B] shadow-xs ring-2 ring-[#BF3A1B]/30'
                        : 'bg-[#FFF7EF]/60 text-[#4A3F55] border-[#493447]/15 hover:border-[#BF3A1B]'
                    }`}
                  >
                    <span>⚡ Alta (Bloqueo o urgencia)</span>
                  </button>
                </div>
              </div>

              {/* Textarea for request reason */}
              <div className="space-y-1.5">
                <label className="text-xs font-heading font-bold text-[#2D1B4E] flex items-center justify-between">
                  <span>¿En qué situación o bloqueo específico necesitas apoyo? *</span>
                  <span className="text-[11px] font-normal text-[#4A3F55]/70">Escribe o dicta por voz</span>
                </label>
                <textarea
                  value={reasonText}
                  onChange={(e) => setReasonText(e.target.value)}
                  placeholder="Explica brevemente la duda, bloqueo o situación en la que requieres apoyo directo de un mentor..."
                  rows={4}
                  required
                  disabled={isSubmitting}
                  className="w-full p-3 sm:p-4 text-xs sm:text-sm text-[#2D1B4E] bg-[#FFF7EF]/50 border border-[#493447]/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#BF3A1B] focus:border-transparent transition-all placeholder:text-[#4A3F55]/50 leading-relaxed"
                />
              </div>

              {/* Voice Recording Control (WhatsApp Style) */}
              <div className="p-3 bg-[#FFF7EF]/60 border border-[#493447]/15 rounded-2xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#2D1B4E] flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-[#F7B538]" />
                    <span>Opción: Explicar por nota de voz</span>
                  </span>
                  <span className="text-[11px] text-[#BF3A1B] font-semibold">
                    Grabación con Web Speech API
                  </span>
                </div>

                <WhatsAppVoiceRecorder
                  stageNumber={currentStageNum}
                  stageName="Solicitud de Mentoría"
                  mode="stage-card"
                  disabled={isSubmitting}
                  isSending={isSubmitting}
                  onTranscript={handleVoiceTranscript}
                  onSendDirect={handleVoiceSendDirect}
                />
              </div>

              {/* Multichannel Notification Disclosure */}
              <div className="p-3 bg-neutral-50 rounded-xl border border-[#493447]/10 flex items-start gap-2 text-[11px] text-[#4A3F55]">
                <ShieldCheck className="w-4 h-4 text-[#BF3A1B] shrink-0 mt-0.5" />
                <p className="leading-snug">
                  Al enviar esta solicitud, el sistema despacha una notificación en vivo al Administrador Principal (<span className="font-semibold text-[#2D1B4E]">Tania Padierna</span>), envía una alerta a su correo corporativo y genera el mensaje de enlace para WhatsApp.
                </p>
              </div>

              {/* Actions Footer */}
              <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-2.5 pt-2 border-t border-[#493447]/10">
                <button
                  type="button"
                  onClick={handleResetAndClose}
                  className="w-full sm:w-auto min-h-[44px] px-4 py-2 border border-[#493447]/20 text-[#4A3F55] hover:bg-neutral-100 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={!reasonText.trim() || isSubmitting}
                  className="w-full sm:w-auto min-h-[44px] px-6 py-2.5 bg-[#F7B538] hover:bg-[#f5a623] text-[#2D1B4E] font-heading font-extrabold text-xs sm:text-sm rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <span>Enviando notificación...</span>
                  ) : (
                    <>
                      <span>Enviar Solicitud de Mentoría</span>
                      <Send className="w-4 h-4 text-[#2D1B4E]" />
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
