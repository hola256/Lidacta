import React, { useState } from 'react';
import { useLidacta } from '../context/LidactaContext';
import {
  UserCheck,
  X,
  Send,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Info,
  Sparkles,
  ShieldCheck,
} from 'lucide-react';
import { WhatsAppVoiceRecorder } from './WhatsAppVoiceRecorder';
import { STAGE_META } from './LeaderView';
import { StageNumber } from '../types/lidacta';

interface RequestMentorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ApiErrorState {
  status?: number;
  message: string;
  details?: string;
  hint?: string;
}

interface ResendSuccessState {
  id?: string;
  recipient: string;
  timestamp: string;
}

export const RequestMentorModal: React.FC<RequestMentorModalProps> = ({ isOpen, onClose }) => {
  const { currentUser, activeMentorship, requestHumanMentor } = useLidacta();

  const [reasonText, setReasonText] = useState('');
  const [priority, setPriority] = useState<'normal' | 'alta'>('normal');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [apiError, setApiError] = useState<ApiErrorState | null>(null);
  const [resendSuccess, setResendSuccess] = useState<ResendSuccessState | null>(null);

  const [submittedData, setSubmittedData] = useState<{
    success: boolean;
    whatsappUrl: string;
    notificationId: string;
    resendId?: string;
    recipient?: string;
  } | null>(null);

  if (!isOpen) return null;

  const currentStageNum = (activeMentorship?.currentStage || 1) as StageNumber;
  const currentStageMeta = STAGE_META[currentStageNum];

  /**
   * Dispatches the actual HTTP request to /api/send (Resend).
   * Returns { ok: true, data } or { ok: false, error: ApiErrorState }.
   */
  const dispatchRealEmail = async (
    fullReason: string,
    transcriptText: string,
    isVoice: boolean
  ): Promise<{ ok: boolean; data?: any; error?: ApiErrorState }> => {
    const formattedDate = new Date().toLocaleString('es-MX', {
      timeZone: 'America/Mexico_City',
      dateStyle: 'full',
      timeStyle: 'medium',
    });

    const payload = {
      leaderName: currentUser.name,
      message: fullReason,
      transcript: transcriptText,
      date: formattedDate,
      leaderEmail: currentUser.email,
      leaderPosition: currentUser.position,
      companyName: currentUser.companyName,
      currentStage: currentStageNum,
      caseTitle: activeMentorship?.title || 'Acompañamiento en curso',
      reasonText: fullReason,
      isVoiceAudio: isVoice,
    };

    console.log('[Asesoría 1:1] 🚀 Forzando petición real POST a /api/send con payload:', payload);

    try {
      const response = await fetch('/api/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(payload),
      });

      let responseData: any = null;
      const contentType = response.headers.get('content-type') || '';

      if (contentType.includes('application/json')) {
        responseData = await response.json();
      } else {
        const text = await response.text();
        try {
          responseData = JSON.parse(text);
        } catch {
          responseData = { rawText: text };
        }
      }

      console.log('[Asesoría 1:1] 📥 Respuesta de /api/send:', {
        status: response.status,
        ok: response.ok,
        data: responseData,
      });

      if (!response.ok || (responseData && responseData.success === false)) {
        let hint = 'Verifica la configuración del servidor.';
        if (response.status === 404) {
          hint = 'El servidor devolvió HTTP 404 para /api/send. En Vercel, asegúrate de que el archivo /api/send.ts esté en la raíz del repositorio.';
        } else if (response.status === 500 && (responseData?.error?.includes?.('RESEND_API_KEY') || responseData?.hint)) {
          hint = responseData.hint || 'Falta la variable de entorno RESEND_API_KEY en tu proyecto de Vercel (Settings > Environment Variables).';
        } else if (responseData?.error) {
          hint = typeof responseData.error === 'string' ? responseData.error : JSON.stringify(responseData.error);
        }

        return {
          ok: false,
          error: {
            status: response.status,
            message: responseData?.error || `Error HTTP ${response.status} al despachar con Resend`,
            details: responseData?.details ? JSON.stringify(responseData.details) : undefined,
            hint,
          },
        };
      }

      return {
        ok: true,
        data: responseData,
      };
    } catch (networkErr: any) {
      console.error('[Asesoría 1:1] ❌ Error de red al llamar a /api/send:', networkErr);
      return {
        ok: false,
        error: {
          message: networkErr?.message || 'Error de red al conectar con /api/send',
          hint: 'Revisa tu conexión a internet o comprueba si el endpoint /api/send está activo en Vercel.',
        },
      };
    }
  };

  const handleSubmit = async (e?: React.FormEvent, forceBypassEmail = false) => {
    if (e) e.preventDefault();
    if (!reasonText.trim() || isSubmitting) return;

    setIsSubmitting(true);
    setApiError(null);

    const fullReason =
      priority === 'alta'
        ? `[ALTA PRIORIDAD] ${reasonText.trim()}`
        : reasonText.trim();

    try {
      let emailDispatchResult: { ok: boolean; data?: any; error?: ApiErrorState } = { ok: true };

      if (!forceBypassEmail) {
        emailDispatchResult = await dispatchRealEmail(fullReason, '', false);
      }

      if (!emailDispatchResult.ok && !forceBypassEmail) {
        setApiError(emailDispatchResult.error || { message: 'Error desconocido al enviar correo' });
        setIsSubmitting(false);
        return;
      }

      // If email succeeded or bypassed, record Resend details and sync local/central mentorship state
      const resendId = emailDispatchResult.data?.id;
      const recipient = emailDispatchResult.data?.recipient || 'hola@taniapadierna.com';

      if (resendId) {
        setResendSuccess({
          id: resendId,
          recipient,
          timestamp: new Date().toLocaleTimeString('es-MX'),
        });
      }

      const result = await requestHumanMentor(fullReason, false);
      setSubmittedData({
        success: true,
        whatsappUrl: result.whatsappUrl,
        notificationId: result.notificationId,
        resendId,
        recipient,
      });
    } catch (err: any) {
      console.error('Error procesando solicitud de mentoría:', err);
      setApiError({
        message: err?.message || 'Error inesperado al procesar la solicitud',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVoiceTranscript = (text: string) => {
    setReasonText((prev) => (prev ? `${prev} ${text}` : text));
  };

  const handleVoiceSendDirect = async (text: string, forceBypassEmail = false) => {
    if (!text.trim() || isSubmitting) return;
    setIsSubmitting(true);
    setApiError(null);

    const fullReason =
      priority === 'alta'
        ? `[ALTA PRIORIDAD] [Nota de Voz] ${text.trim()}`
        : `[Nota de Voz] ${text.trim()}`;

    try {
      let emailDispatchResult: { ok: boolean; data?: any; error?: ApiErrorState } = { ok: true };

      if (!forceBypassEmail) {
        emailDispatchResult = await dispatchRealEmail(fullReason, text.trim(), true);
      }

      if (!emailDispatchResult.ok && !forceBypassEmail) {
        setApiError(emailDispatchResult.error || { message: 'Error desconocido al despachar nota de voz por correo' });
        setIsSubmitting(false);
        return;
      }

      const resendId = emailDispatchResult.data?.id;
      const recipient = emailDispatchResult.data?.recipient || 'hola@taniapadierna.com';

      if (resendId) {
        setResendSuccess({
          id: resendId,
          recipient,
          timestamp: new Date().toLocaleTimeString('es-MX'),
        });
      }

      const result = await requestHumanMentor(fullReason, true);
      setSubmittedData({
        success: true,
        whatsappUrl: result.whatsappUrl,
        notificationId: result.notificationId,
        resendId,
        recipient,
      });
    } catch (err: any) {
      console.error('Error procesando nota de voz para mentoría:', err);
      setApiError({
        message: err?.message || 'Error inesperado al procesar la nota de voz',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetAndClose = () => {
    setReasonText('');
    setPriority('normal');
    setSubmittedData(null);
    setApiError(null);
    setResendSuccess(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[#2D1B4E]/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in">
      <div className="w-full max-w-xl bg-white rounded-3xl shadow-2xl border border-[#493447]/20 overflow-hidden flex flex-col">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 bg-[#2D1B4E] text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#F7B538] text-[#2D1B4E] flex items-center justify-center font-bold shadow-md shrink-0">
              <UserCheck className="w-5 h-5 text-[#2D1B4E]" />
            </div>
            <div>
              <h2 className="font-heading font-extrabold text-base sm:text-lg leading-tight">
                Asesoría 1:1 Directa
              </h2>
              <p className="text-xs text-[#FFF7EF]/80 mt-0.5">
                Acompañamiento personal directivo con Tania Padierna (Dirección de Mentoría)
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
          {/* VISIBLE ERROR BANNER: Shown if /api/send fails */}
          {apiError && (
            <div className="p-4 bg-red-50 border-2 border-red-300 rounded-2xl text-left space-y-3 animate-in fade-in slide-in-from-top-2">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-red-100 text-red-600 flex items-center justify-center shrink-0 mt-0.5">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div className="flex-1 space-y-1">
                  <div className="flex items-center justify-between">
                    <h4 className="font-heading font-bold text-sm text-red-800">
                      Aviso: No se pudo enviar la solicitud por correo
                    </h4>
                    {apiError.status && (
                      <span className="text-[10px] font-mono bg-red-200 text-red-800 px-2 py-0.5 rounded-full font-bold">
                        Código {apiError.status}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-red-700 leading-relaxed font-medium">
                    {apiError.message}
                  </p>
                  {apiError.hint && (
                    <div className="flex items-start gap-1.5 p-2 bg-white/70 rounded-lg text-[11px] text-red-800 border border-red-200 mt-2">
                      <Info className="w-3.5 h-3.5 text-red-600 shrink-0 mt-0.5" />
                      <span>{apiError.hint}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2 pt-1 border-t border-red-200">
                <button
                  type="button"
                  onClick={() => handleSubmit(undefined, false)}
                  disabled={isSubmitting}
                  className="flex-1 min-h-[38px] flex items-center justify-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSubmitting ? 'animate-spin' : ''}`} />
                  <span>Reintentar envío</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSubmit(undefined, true)}
                  disabled={isSubmitting}
                  className="flex-1 min-h-[38px] flex items-center justify-center gap-1.5 px-3 py-1.5 bg-white hover:bg-red-50 text-red-700 border border-red-300 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                >
                  <span>Continuar y notificar en el Panel</span>
                </button>
              </div>
            </div>
          )}

          {submittedData?.success ? (
            /* Success confirmation screen */
            <div className="text-center py-6 sm:py-8 space-y-6 animate-in zoom-in-95">
              <div className="w-16 h-16 bg-[#E2F7E1] text-[#246B2A] rounded-2xl mx-auto flex items-center justify-center shadow-sm">
                <CheckCircle2 className="w-9 h-9" />
              </div>

              <div className="space-y-2.5 max-w-md mx-auto px-2">
                <h3 className="font-heading font-extrabold text-xl sm:text-2xl text-[#2D1B4E]">
                  ¡Solicitud Enviada con Éxito!
                </h3>
                <p className="text-sm text-[#4A3F55] leading-relaxed">
                  Hemos recibido tu solicitud. Tania Padierna (Directora de Mentoría) ha sido notificada y te contactará a la brevedad para coordinar la sesión.
                </p>
              </div>

              <div className="pt-2 max-w-xs mx-auto">
                <button
                  type="button"
                  onClick={handleResetAndClose}
                  className="w-full min-h-[44px] px-6 py-2.5 bg-[#2D1B4E] hover:bg-[#493447] text-white text-xs sm:text-sm font-bold rounded-xl transition-all cursor-pointer active:scale-95 shadow-sm"
                >
                  Volver a mi acompañamiento
                </button>
              </div>
            </div>
          ) : (
            /* Request Form */
            <form onSubmit={(e) => handleSubmit(e, false)} className="space-y-4">
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
                  onChange={(e) => {
                    setReasonText(e.target.value);
                    if (apiError) setApiError(null);
                  }}
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
                </div>

                <WhatsAppVoiceRecorder
                  stageNumber={currentStageNum}
                  stageName="Solicitud de Mentoría"
                  mode="stage-card"
                  disabled={isSubmitting}
                  isSending={isSubmitting}
                  onTranscript={handleVoiceTranscript}
                  onSendDirect={(transcript) => handleVoiceSendDirect(transcript, false)}
                />
              </div>

              {/* Confidentiality Notice */}
              <div className="p-3 bg-neutral-50 rounded-xl border border-[#493447]/10 flex items-center gap-2 text-xs text-[#4A3F55]">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                <p className="leading-snug">
                  Tu solicitud será enviada de forma confidencial a la Directora de Mentoría.
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
                    <span className="flex items-center gap-2">
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Enviando solicitud...
                    </span>
                  ) : (
                    <>
                      <span>Solicitar Asesoría 1:1</span>
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
