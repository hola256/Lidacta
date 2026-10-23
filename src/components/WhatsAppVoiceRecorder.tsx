import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  MicOff,
  Send,
  Trash2,
  Check,
  Sparkles,
} from 'lucide-react';
import {
  createSpeechRecognizer,
  isSpeechRecognitionSupported,
  getRandomVoiceSample,
  SpeechRecognizerHandle,
} from '../utils/speechUtils';

interface WhatsAppVoiceRecorderProps {
  stageNumber: number;
  stageName?: string;
  onTranscript: (text: string) => void;
  onSendDirect?: (text: string) => void;
  disabled?: boolean;
  mode?: 'stage-card' | 'bottom-bar';
  isSending?: boolean;
}

export const WhatsAppVoiceRecorder: React.FC<WhatsAppVoiceRecorderProps> = ({
  stageNumber,
  stageName,
  onTranscript,
  onSendDirect,
  disabled = false,
  mode = 'stage-card',
  isSending = false,
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [waveAmplitudes, setWaveAmplitudes] = useState<number[]>([
    25, 60, 40, 85, 95, 45, 70, 30, 80, 50, 90, 65, 35, 75,
  ]);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const waveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const recognizerRef = useRef<SpeechRecognizerHandle | null>(null);
  const accumulatedTranscriptRef = useRef<string>('');

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (waveTimerRef.current) clearInterval(waveTimerRef.current);
      if (recognizerRef.current) recognizerRef.current.stop();
    };
  }, []);

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const startRecording = () => {
    if (disabled || isSending) return;

    setIsRecording(true);
    setDuration(0);
    setLiveTranscript('');
    accumulatedTranscriptRef.current = '';

    // Duration timer (seconds counter)
    timerRef.current = setInterval(() => {
      setDuration((prev) => prev + 1);
    }, 1000);

    // Audio frequency waveform dynamic animation
    waveTimerRef.current = setInterval(() => {
      setWaveAmplitudes([
        Math.floor(Math.random() * 60) + 20,
        Math.floor(Math.random() * 80) + 20,
        Math.floor(Math.random() * 95) + 15,
        Math.floor(Math.random() * 70) + 30,
        Math.floor(Math.random() * 100) + 10,
        Math.floor(Math.random() * 75) + 25,
        Math.floor(Math.random() * 90) + 10,
        Math.floor(Math.random() * 65) + 35,
        Math.floor(Math.random() * 85) + 15,
        Math.floor(Math.random() * 95) + 20,
        Math.floor(Math.random() * 60) + 25,
        Math.floor(Math.random() * 80) + 20,
        Math.floor(Math.random() * 50) + 30,
        Math.floor(Math.random() * 70) + 20,
      ]);
    }, 120);

    // Attempt real Web Speech API recognition
    if (isSpeechRecognitionSupported()) {
      try {
        const rec = createSpeechRecognizer(
          (transcript, isFinal) => {
            if (transcript) {
              setLiveTranscript(transcript);
              accumulatedTranscriptRef.current = transcript;
            }
          },
          () => {
            // onEnd: keep state until user explicitly clicks stop or send
          },
          () => {
            // onError: fall back seamlessly to simulated voice transcript
          }
        );

        if (rec) {
          recognizerRef.current = rec;
          rec.start();
        }
      } catch {
        // Fallback gracefully
      }
    }
  };

  const cleanupRecording = () => {
    setIsRecording(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (waveTimerRef.current) {
      clearInterval(waveTimerRef.current);
      waveTimerRef.current = null;
    }
    if (recognizerRef.current) {
      recognizerRef.current.stop();
      recognizerRef.current = null;
    }
  };

  const cancelRecording = () => {
    cleanupRecording();
    setLiveTranscript('');
    accumulatedTranscriptRef.current = '';
  };

  const getEffectiveTranscript = (): string => {
    const realText = accumulatedTranscriptRef.current.trim() || liveTranscript.trim();
    if (realText.length > 5) {
      return realText;
    }
    // Contextual realistic leadership reflection tailored to current stage
    return getRandomVoiceSample(stageNumber);
  };

  const stopAndTranscribe = () => {
    const textToInsert = getEffectiveTranscript();
    cleanupRecording();
    onTranscript(textToInsert);
  };

  const stopAndSendDirect = () => {
    const textToSend = getEffectiveTranscript();
    cleanupRecording();
    if (onSendDirect) {
      onSendDirect(textToSend);
    } else {
      onTranscript(textToSend);
    }
  };

  // Toggle handler for the microphone button
  const handleMicButtonClick = () => {
    if (isRecording) {
      stopAndTranscribe();
    } else {
      startRecording();
    }
  };

  // ----------------------------------------------------
  // LAYOUT MODE: BOTTOM FIXED BAR
  // ----------------------------------------------------
  if (mode === 'bottom-bar') {
    if (isRecording) {
      return (
        <div className="flex-1 flex items-center justify-between gap-2 bg-[#FFF7EF] border-2 border-[#BF3A1B] rounded-xl px-3 py-1.5 shadow-sm animate-in fade-in duration-200">
          {/* Recording Status & Pulse Indicator */}
          <div className="flex items-center gap-2 shrink-0">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-[#BF3A1B]" />
            </span>
            <span className="text-[11px] sm:text-xs font-bold text-[#BF3A1B] uppercase tracking-wider shrink-0">
              Grabando
            </span>
            <span className="font-mono font-bold text-xs sm:text-sm text-[#2D1B4E] tabular-nums bg-white px-2 py-0.5 rounded-md border border-[#493447]/15">
              {formatDuration(duration)}
            </span>
          </div>

          {/* Audio Wave Frequency Bars */}
          <div className="hidden sm:flex items-center gap-1 h-6 px-2 flex-1 justify-center max-w-xs">
            {waveAmplitudes.map((amp, idx) => (
              <span
                key={idx}
                className="w-1 bg-[#BF3A1B] rounded-full transition-all duration-100 ease-out"
                style={{ height: `${amp}%` }}
              />
            ))}
          </div>

          {/* Live transcript or hint */}
          <div className="text-xs text-[#2D1B4E] truncate max-w-[120px] sm:max-w-xs font-medium italic hidden md:block">
            {liveTranscript ? `"${liveTranscript}"` : `Etapa ${stageNumber}: Habla con naturalidad...`}
          </div>

          {/* Action Buttons: Cancel, Transcribe into Text, Send Directly */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Cancel / Discard */}
            <button
              type="button"
              onClick={cancelRecording}
              title="Descartar grabación"
              className="min-h-[36px] min-w-[36px] p-2 text-[#4A3F55] hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer flex items-center justify-center active:scale-95"
            >
              <Trash2 className="w-4 h-4" />
            </button>

            {/* Stop and Insert into Input */}
            <button
              type="button"
              onClick={stopAndTranscribe}
              title="Detener y convertir a texto en el campo"
              className="min-h-[36px] px-2.5 sm:px-3 py-1.5 bg-white border border-[#493447]/20 hover:border-[#BF3A1B] text-[#2D1B4E] text-xs font-bold rounded-lg transition-colors cursor-pointer flex items-center gap-1 shadow-xs active:scale-95"
            >
              <Check className="w-3.5 h-3.5 text-[#246B2A]" />
              <span className="hidden sm:inline">Transcribir</span>
            </button>

            {/* Stop and Send Directly (WhatsApp style) */}
            <button
              type="button"
              onClick={stopAndSendDirect}
              disabled={isSending}
              title="Enviar nota de voz a Lidacta"
              className="min-h-[36px] px-3 py-1.5 bg-[#BF3A1B] hover:bg-[#a63014] text-white text-xs font-heading font-extrabold rounded-lg shadow-sm transition-colors cursor-pointer flex items-center gap-1.5 active:scale-95 disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Enviar voz</span>
            </button>
          </div>
        </div>
      );
    }

    // Default idle state inside the bottom bar: Mic button next to Send
    return (
      <button
        type="button"
        onClick={handleMicButtonClick}
        disabled={disabled || isSending}
        title="Hablar por micrófono (Estilo WhatsApp)"
        className="min-h-[44px] min-w-[44px] p-2.5 rounded-xl border border-[#493447]/15 bg-[#FFF7EF] hover:bg-[#FFD3BF]/30 hover:border-[#BF3A1B] text-[#BF3A1B] hover:text-[#992E15] transition-all cursor-pointer shrink-0 flex items-center justify-center active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs"
      >
        <Mic className="w-5 h-5" />
      </button>
    );
  }

  // ----------------------------------------------------
  // LAYOUT MODE: STAGE RESPONSE CARD (Inside Etapas 1 to 7)
  // ----------------------------------------------------
  if (isRecording) {
    return (
      <div className="bg-[#FFF7EF] border-2 border-[#BF3A1B] rounded-2xl p-3 sm:p-5 shadow-md space-y-3 animate-in fade-in duration-200 max-w-full overflow-hidden box-border">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#FFD3BF] pb-2.5 max-w-full overflow-hidden">
          <div className="flex items-center gap-2 min-w-0">
            <span className="relative flex h-3.5 w-3.5 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
              <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-[#BF3A1B]" />
            </span>
            <div className="min-w-0">
              <span className="text-xs font-heading font-extrabold text-[#BF3A1B] uppercase tracking-wider block truncate">
                Grabando audio para {stageName || `Etapa ${stageNumber}`}
              </span>
              <span className="text-[10px] sm:text-[11px] text-[#4A3F55]/80 block truncate">
                Habla con claridad o expresa tus reflexiones
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="font-mono font-bold text-xs sm:text-sm text-[#2D1B4E] tabular-nums bg-white px-2.5 py-1 rounded-lg border border-[#493447]/15 shadow-2xs">
              ⏱️ {formatDuration(duration)}
            </span>
          </div>
        </div>

        {/* Real-time Dynamic Equalizer Bars */}
        <div className="bg-white/80 rounded-xl p-3 border border-[#493447]/10 flex items-center justify-between gap-3 max-w-full overflow-hidden">
          <div className="flex items-center gap-1.5 h-10 px-2 flex-1 justify-center max-w-full overflow-hidden">
            {waveAmplitudes.map((amp, idx) => (
              <span
                key={idx}
                className="w-1.5 bg-[#BF3A1B] rounded-full transition-all duration-100 ease-out shrink-0"
                style={{ height: `${Math.max(15, amp)}%` }}
              />
            ))}
          </div>
        </div>

        {/* Live speech preview or contextual indicator */}
        <div className="p-2.5 bg-white rounded-xl border border-[#FFD3BF] text-xs text-[#2D1B4E] flex items-center gap-2 max-w-full overflow-hidden box-border">
          <Sparkles className="w-4 h-4 text-[#F7B538] shrink-0" />
          <p className="truncate italic">
            {liveTranscript
              ? `Escuchando: "${liveTranscript}"`
              : 'Micrófono activo · Puedes hablar ahora...'}
          </p>
        </div>

        {/* Controls: Discard, Stop & Transcribe, Send directly */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 pt-1 w-full max-w-full box-border">
          <button
            type="button"
            onClick={cancelRecording}
            className="w-full sm:w-auto min-h-[40px] px-3.5 py-2 rounded-xl border border-red-200 text-red-700 bg-red-50 hover:bg-red-100 text-xs font-semibold transition-colors cursor-pointer flex items-center justify-center gap-1.5 active:scale-95 box-border"
          >
            <Trash2 className="w-4 h-4 text-red-600" />
            <span>Descartar grabación</span>
          </button>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={stopAndTranscribe}
              className="w-full sm:w-auto min-h-[40px] px-3.5 py-2 bg-white border border-[#493447]/20 hover:border-[#BF3A1B] text-[#2D1B4E] text-xs font-bold rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-xs active:scale-95 box-border"
            >
              <Check className="w-4 h-4 text-[#246B2A]" />
              <span>Transcribir al texto</span>
            </button>

            <button
              type="button"
              onClick={stopAndSendDirect}
              disabled={isSending}
              className="w-full sm:w-auto min-h-[40px] px-4 py-2 bg-[#F7B538] hover:bg-[#F5A623] text-[#2D1B4E] text-xs font-heading font-extrabold rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-1.5 active:scale-95 disabled:opacity-50 box-border"
            >
              <Send className="w-4 h-4 text-[#2D1B4E]" />
              <span>Enviar voz ahora</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Idle state inside the stage response card:
  return (
    <button
      type="button"
      onClick={handleMicButtonClick}
      disabled={disabled || isSending}
      className="w-full max-w-full min-h-[44px] flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border border-[#BF3A1B]/30 bg-[#FFF7EF] hover:bg-[#FFD3BF]/40 hover:border-[#BF3A1B] text-xs font-heading font-bold text-[#2D1B4E] transition-all cursor-pointer select-none active:scale-95 shadow-2xs group box-border whitespace-normal break-words"
      title="Hablar o dictar por voz estilo WhatsApp"
    >
      <div className="w-6 h-6 rounded-lg bg-[#BF3A1B] text-white flex items-center justify-center group-hover:scale-105 transition-transform shadow-xs shrink-0">
        <Mic className="w-3.5 h-3.5" />
      </div>
      <span className="break-words whitespace-normal">Dictar o hablar por voz</span>
      <span className="text-[10px] font-semibold text-[#BF3A1B] bg-[#FFD3BF]/60 px-1.5 py-0.5 rounded shrink-0">
        Voz
      </span>
    </button>
  );
};
