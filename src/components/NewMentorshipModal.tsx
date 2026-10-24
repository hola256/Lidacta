import React, { useState } from 'react';
import { useLidacta } from '../context/LidactaContext';
import {
  Compass,
  X,
  AlertCircle,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';

interface NewMentorshipModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NewMentorshipModal: React.FC<NewMentorshipModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { startNewMentorship } = useLidacta();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<'alta' | 'media' | 'baja'>('media');

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanTitle = title.trim();
    const cleanDesc = description.trim();

    if (!cleanTitle) {
      setErrorMessage('Por favor, ingresa el título del caso o reto.');
      return;
    }

    if (!cleanDesc) {
      setErrorMessage('Por favor, describe la situación o problema que deseas abordar.');
      return;
    }

    setIsSubmitting(true);

    try {
      await startNewMentorship(cleanDesc, {
        title: cleanTitle,
        stage: 1,
        priority,
      });

      // Reset form and close
      setTitle('');
      setDescription('');
      setPriority('media');
      setIsSubmitting(false);
      onClose();
    } catch (err) {
      console.error(err);
      setIsSubmitting(false);
      setErrorMessage('Ocurrió un error al registrar el acompañamiento. Por favor intenta nuevamente.');
    }
  };

  const handleApplyPreset = (presetTitle: string, presetDesc: string) => {
    setTitle(presetTitle);
    setDescription(presetDesc);
    if (errorMessage) setErrorMessage(null);
  };

  return (
    <div className="fixed inset-0 z-[70] bg-[#2D1B4E]/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 overflow-y-auto animate-in fade-in duration-200">
      <div
        className="w-full max-w-xl bg-white text-[#2D1B4E] rounded-3xl shadow-2xl border border-[#493447]/15 overflow-hidden animate-in zoom-in-95 duration-200 my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="bg-[#FFF7EF] px-5 sm:px-7 py-4 border-b border-[#493447]/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#FFD3BF] text-[#BF3A1B] flex items-center justify-center font-bold shrink-0 shadow-xs">
              <Compass className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-heading font-extrabold text-base sm:text-lg text-[#2D1B4E]">
                Nuevo Acompañamiento
              </h2>
              <p className="text-xs text-[#4A3F55]/80">
                Plantea un reto o situación real con tu equipo
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-[#4A3F55]/70 hover:text-[#2D1B4E] hover:bg-black/5 rounded-xl transition-colors cursor-pointer"
            title="Cerrar ventana"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-7 space-y-4 max-h-[calc(88vh-130px)] overflow-y-auto">
          {/* Error Message */}
          {errorMessage && (
            <div className="p-3 bg-[#BF3A1B]/10 border border-[#BF3A1B]/30 rounded-xl flex items-center gap-2.5 text-xs text-[#BF3A1B] font-semibold animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* 1. Título del caso o reto */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold uppercase tracking-wider text-[#2D1B4E]">
              Título del caso o reto <span className="text-[#BF3A1B]">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (errorMessage) setErrorMessage(null);
              }}
              placeholder="ej. Fricción en el cambio de turno / Dificultad para delegar"
              className="w-full px-3.5 py-2.5 bg-[#FFF7EF]/50 border border-[#493447]/20 rounded-xl text-xs sm:text-sm text-[#2D1B4E] placeholder-[#4A3F55]/40 outline-none focus:border-[#BF3A1B] focus:ring-1 focus:ring-[#BF3A1B] transition-all"
            />

            {/* Quick suggested presets */}
            <div className="space-y-1 pt-1">
              <span className="text-[11px] font-medium text-[#4A3F55]/70 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-[#F7B538]" /> Sugerencias de retos frecuentes:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {[
                  {
                    t: 'Falta de entrega y resistencia al cambio en el turno',
                    d: 'Un supervisor clave no entrega reportes a tiempo y cuando le pido explicaciones reacciona a la defensiva diciendo que siempre se ha hecho así.',
                  },
                  {
                    t: 'Dificultad para delegar tareas críticas de supervisión',
                    d: 'Me cuesta trabajo soltar responsabilidades técnicas al equipo por temor a fallas de calidad o retrasos ante las entregas clave.',
                  },
                  {
                    t: 'Conversación difícil por desmotivación y fallas recurrentes',
                    d: 'Un colaborador con buen potencial ha bajado su rendimiento notablemente en las últimas semanas y afecta el ambiente con sus compañeros.',
                  },
                ].map((preset, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => handleApplyPreset(preset.t, preset.d)}
                    className="text-[11px] px-2.5 py-1 rounded-lg bg-[#FFF7EF] hover:bg-[#FFD3BF]/30 text-[#4A3F55] hover:text-[#2D1B4E] border border-[#493447]/10 transition-colors cursor-pointer text-left truncate max-w-full"
                  >
                    {preset.t}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 2. Descripción de la situación/problema */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold uppercase tracking-wider text-[#2D1B4E]">
              Descripción de la situación / problema <span className="text-[#BF3A1B]">*</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                if (errorMessage) setErrorMessage(null);
              }}
              rows={4}
              placeholder="Describe qué está ocurriendo, quiénes están involucrados, qué has intentado y qué resultado esperas lograr con tu equipo..."
              className="w-full p-3.5 bg-[#FFF7EF]/50 border border-[#493447]/20 rounded-xl text-xs sm:text-sm text-[#2D1B4E] placeholder-[#4A3F55]/40 outline-none focus:border-[#BF3A1B] focus:ring-1 focus:ring-[#BF3A1B] transition-all leading-relaxed"
            />
          </div>

          {/* 3. Nivel de urgencia o prioridad */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold uppercase tracking-wider text-[#2D1B4E]">
              Nivel de urgencia o prioridad <span className="text-[#BF3A1B]">*</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              {/* Alta */}
              <button
                type="button"
                onClick={() => setPriority('alta')}
                className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col gap-1 ${
                  priority === 'alta'
                    ? 'bg-[#BF3A1B]/10 border-[#BF3A1B] text-[#BF3A1B] font-bold shadow-xs'
                    : 'bg-[#FFF7EF]/40 border-[#493447]/15 text-[#4A3F55] hover:bg-[#FFF7EF]'
                }`}
              >
                <div className="flex items-center gap-1 text-xs">
                  <AlertTriangle className="w-3.5 h-3.5 text-[#BF3A1B]" />
                  <span>Alta</span>
                </div>
                <span className="text-[10px] text-[#4A3F55]/70 font-normal">
                  Crítico. Resolver ahora mismo.
                </span>
              </button>

              {/* Media */}
              <button
                type="button"
                onClick={() => setPriority('media')}
                className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col gap-1 ${
                  priority === 'media'
                    ? 'bg-[#F7B538]/20 border-[#F7B538] text-[#2D1B4E] font-bold shadow-xs'
                    : 'bg-[#FFF7EF]/40 border-[#493447]/15 text-[#4A3F55] hover:bg-[#FFF7EF]'
                }`}
              >
                <div className="flex items-center gap-1 text-xs text-[#2D1B4E]">
                  <Clock className="w-3.5 h-3.5 text-[#F7B538]" />
                  <span>Media</span>
                </div>
                <span className="text-[10px] text-[#4A3F55]/70 font-normal">
                  Resolver durante el día.
                </span>
              </button>

              {/* Baja */}
              <button
                type="button"
                onClick={() => setPriority('baja')}
                className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col gap-1 ${
                  priority === 'baja'
                    ? 'bg-[#E2F7E1] border-[#246B2A] text-[#246B2A] font-bold shadow-xs'
                    : 'bg-[#FFF7EF]/40 border-[#493447]/15 text-[#4A3F55] hover:bg-[#FFF7EF]'
                }`}
              >
                <div className="flex items-center gap-1 text-xs text-[#246B2A]">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Baja</span>
                </div>
                <span className="text-[10px] text-[#4A3F55]/70 font-normal">
                  Mejora continua
                </span>
              </button>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-4 border-t border-[#493447]/10 flex flex-col-reverse sm:flex-row items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-[#493447]/20 text-[#4A3F55] hover:bg-[#FFF7EF] font-semibold text-xs sm:text-sm transition-colors cursor-pointer disabled:opacity-50 text-center"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-[#F7B538] hover:bg-[#F5A623] text-[#2D1B4E] font-heading font-extrabold text-xs sm:text-sm shadow-md hover:shadow-lg transition-all cursor-pointer active:scale-95 disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-[#2D1B4E] border-t-transparent rounded-full animate-spin" />
                  <span>Guardando e iniciando...</span>
                </>
              ) : (
                <>
                  <span>Guardar y Enviar</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>

          {/* Confidentiality Notice */}
          <div className="pt-1 flex items-center justify-center gap-1.5 text-center text-[11px] text-[#4A3F55]/70">
            <ShieldCheck className="w-3.5 h-3.5 text-[#F7B538] shrink-0" />
            <span>Espacio 100% Confidencial · Tus reflexiones son privadas.</span>
          </div>
        </form>
      </div>
    </div>
  );
};
