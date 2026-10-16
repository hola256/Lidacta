import React, { useState, useEffect, useRef } from 'react';
import { useLidacta } from '../context/LidactaContext';
import {
  StageNumber,
  MentorshipSession,
  MentorshipActionPlan,
} from '../types/lidacta';
import {
  speakText,
  stopSpeaking,
  createSpeechRecognizer,
  isSpeechRecognitionSupported,
} from '../utils/speechUtils';
import {
  Compass,
  Send,
  Plus,
  ShieldCheck,
  Volume2,
  VolumeX,
  Mic,
  MicOff,
  ArrowRight,
  CheckCircle2,
  Clock,
  Sparkles,
  BookOpen,
  Calendar,
  UserCheck,
  FileText,
  Target,
  Award,
  ChevronRight,
  CornerDownRight,
  HelpCircle,
  Download,
  Printer,
  Menu,
  X,
  ArrowLeft,
} from 'lucide-react';

const STAGE_TITLES: Record<StageNumber, string> = {
  1: '1. Detectar qué sucede',
  2: '2. Analizar perspectivas & Habilidades',
  3: '3. Diseñar alternativas',
  4: '4. Practicar antes de actuar',
  5: '5. Actuar (Plan de Acción)',
  6: '6. Aprender y reflexionar',
  7: '7. Cierre & Retroalimentación',
};

export const LeaderView: React.FC = () => {
  const {
    currentUser,
    mentorships,
    activeMentorship,
    setActiveMentorshipId,
    startNewMentorship,
    sendMessageInActiveSession,
    advanceStage,
    updateActionPlan,
    markActionCompleted,
    saveLearnings,
    isSendingMessage,
  } = useLidacta();

  // Filter mentorships for this leader
  const leaderMentorships = mentorships.filter((m) => m.leaderId === currentUser.id);

  const [filterTab, setFilterTab] = useState<'all' | 'active' | 'completed'>('all');
  const [inputText, setInputText] = useState('');
  const [newChallengePrompt, setNewChallengePrompt] = useState('');
  const [isStartingNew, setIsStartingNew] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [isListeningMic, setIsListeningMic] = useState(false);
  const [speechRecognizer, setSpeechRecognizer] = useState<{ start: () => void; stop: () => void } | null>(null);
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);
  const [mobileHomeTab, setMobileHomeTab] = useState<'prompt' | 'list'>('prompt');

  // Stage 5 action plan state form
  const [actionWhat, setActionWhat] = useState('');
  const [actionWhen, setActionWhen] = useState('');
  const [actionWithWhom, setActionWithWhom] = useState('');
  const [actionHow, setActionHow] = useState('');
  const [actionCare, setActionCare] = useState('');

  // Stage 6 learnings state form
  const [learningWhatHappened, setLearningWhatHappened] = useState('');
  const [learningWhatWorked, setLearningWhatWorked] = useState('');
  const [learningWhatDidnt, setLearningWhatDidnt] = useState('');
  const [learningInsights, setLearningInsights] = useState('');
  const [learningFuture, setLearningFuture] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Initialize Speech Recognizer
  useEffect(() => {
    if (isSpeechRecognitionSupported()) {
      const rec = createSpeechRecognizer(
        (transcript) => {
          setInputText((prev) => (prev ? `${prev} ${transcript}` : transcript));
          setIsListeningMic(false);
        },
        () => setIsListeningMic(false)
      );
      setSpeechRecognizer(rec);
    }
  }, []);

  // Sync stage forms with active mentorship
  useEffect(() => {
    if (activeMentorship) {
      if (activeMentorship.actionPlan) {
        setActionWhat(activeMentorship.actionPlan.what || '');
        setActionWhen(activeMentorship.actionPlan.when || '');
        setActionWithWhom(activeMentorship.actionPlan.withWhom || '');
        setActionHow(activeMentorship.actionPlan.how || '');
        setActionCare(activeMentorship.actionPlan.careReminders || '');
      } else {
        setActionWhat('');
        setActionWhen('');
        setActionWithWhom('');
        setActionHow('');
        setActionCare('');
      }

      if (activeMentorship.learnings) {
        setLearningWhatHappened(activeMentorship.learnings.whatHappened || '');
        setLearningWhatWorked(activeMentorship.learnings.whatWorked || '');
        setLearningWhatDidnt(activeMentorship.learnings.whatDidnt || '');
        setLearningInsights(activeMentorship.learnings.insights || '');
        setLearningFuture(activeMentorship.learnings.futureAdjustments || '');
      } else {
        setLearningWhatHappened('');
        setLearningWhatWorked('');
        setLearningWhatDidnt('');
        setLearningInsights('');
        setLearningFuture('');
      }
    }
  }, [activeMentorship]);

  // Scroll to bottom of message stream
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeMentorship?.messages]);

  const handleStartChallenge = async () => {
    if (!newChallengePrompt.trim()) return;
    setIsStartingNew(true);
    await startNewMentorship(newChallengePrompt);
    setNewChallengePrompt('');
    setIsStartingNew(false);
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || isSendingMessage) return;
    const text = inputText;
    setInputText('');
    await sendMessageInActiveSession(text, activeMentorship?.currentStage === 4);
  };

  const toggleVoicePlayback = (text: string) => {
    if (isPlayingAudio) {
      stopSpeaking();
      setIsPlayingAudio(false);
    } else {
      setIsPlayingAudio(true);
      speakText(text, () => setIsPlayingAudio(false));
    }
  };

  const toggleMicListening = () => {
    if (!speechRecognizer) return;
    if (isListeningMic) {
      speechRecognizer.stop();
      setIsListeningMic(false);
    } else {
      speechRecognizer.start();
      setIsListeningMic(true);
    }
  };

  const handleSaveActionPlan = () => {
    if (!actionWhat) return;
    const plan: MentorshipActionPlan = {
      what: actionWhat,
      when: actionWhen || 'Próxima jornada laboral',
      withWhom: actionWithWhom || 'Equipo directo',
      how: actionHow || 'Diálogo directo y constructivo',
      careReminders: actionCare || 'Mantener serenidad y acuerdos claros',
      isCompleted: false,
    };
    updateActionPlan(plan);
  };

  const handleSaveLearnings = () => {
    if (!learningWhatHappened && !learningInsights) return;
    saveLearnings({
      whatHappened: learningWhatHappened,
      whatWorked: learningWhatWorked,
      whatDidnt: learningWhatDidnt,
      insights: learningInsights,
      futureAdjustments: learningFuture,
    });
  };

  const filteredMentorships = leaderMentorships.filter((m) => {
    if (filterTab === 'active') return m.status !== 'completed';
    if (filterTab === 'completed') return m.status === 'completed';
    return true;
  });

  return (
    <div className="flex-1 flex overflow-hidden relative">
      {/* MOBILE DRAWER: Mis Acompañamientos */}
      {showMobileSidebar && (
        <div className="fixed inset-0 z-50 md:hidden bg-[#2D1B4E]/60 backdrop-blur-xs flex">
          <div className="w-4/5 max-w-sm bg-white h-full shadow-2xl flex flex-col border-r border-[#493447]/20 animate-in slide-in-from-left duration-200">
            <div className="p-4 border-b border-[#493447]/10 flex items-center justify-between bg-[#FFF7EF]">
              <span className="font-heading font-bold text-sm text-[#2D1B4E]">
                Mis Acompañamientos
              </span>
              <button
                onClick={() => setShowMobileSidebar(false)}
                className="p-1.5 text-[#4A3F55] hover:text-[#2D1B4E] rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 border-b border-[#493447]/10">
              <button
                onClick={() => {
                  setActiveMentorshipId(null);
                  setShowMobileSidebar(false);
                  setMobileHomeTab('prompt');
                }}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-[#BF3A1B] hover:bg-[#a63014] text-white font-bold text-sm rounded-xl shadow-sm transition-all cursor-pointer min-h-[44px]"
              >
                <Plus className="w-4 h-4" />
                <span>Nuevo Acompañamiento</span>
              </button>
            </div>

            <div className="px-4 pt-3 pb-2 flex items-center justify-between gap-1 text-xs text-[#4A3F55]">
              <div className="flex items-center gap-1 p-0.5 bg-[#FFF7EF] rounded-lg border border-[#493447]/10 w-full justify-around">
                <button
                  onClick={() => setFilterTab('all')}
                  className={`flex-1 py-1 rounded text-[11px] font-medium transition-colors cursor-pointer text-center ${
                    filterTab === 'all' ? 'bg-white text-[#2D1B4E] font-bold shadow-xs' : 'text-[#4A3F55]/70'
                  }`}
                >
                  Todos
                </button>
                <button
                  onClick={() => setFilterTab('active')}
                  className={`flex-1 py-1 rounded text-[11px] font-medium transition-colors cursor-pointer text-center ${
                    filterTab === 'active' ? 'bg-white text-[#2D1B4E] font-bold shadow-xs' : 'text-[#4A3F55]/70'
                  }`}
                >
                  En curso
                </button>
                <button
                  onClick={() => setFilterTab('completed')}
                  className={`flex-1 py-1 rounded text-[11px] font-medium transition-colors cursor-pointer text-center ${
                    filterTab === 'completed' ? 'bg-white text-[#2D1B4E] font-bold shadow-xs' : 'text-[#4A3F55]/70'
                  }`}
                >
                  Cerrados
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
              {filteredMentorships.length === 0 ? (
                <div className="p-6 text-center text-xs text-[#4A3F55]/60">
                  No hay acompañamientos en esta vista. Plantea un nuevo reto para comenzar.
                </div>
              ) : (
                filteredMentorships.map((m) => {
                  const isSelected = activeMentorship?.id === m.id;
                  return (
                    <div
                      key={m.id}
                      onClick={() => {
                        setActiveMentorshipId(m.id);
                        setShowMobileSidebar(false);
                      }}
                      className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-[#FFD3BF]/20 border-[#BF3A1B]/40 shadow-xs'
                          : 'bg-white hover:bg-[#FFF7EF] border-[#493447]/10'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
                            m.status === 'completed'
                              ? 'bg-[#E2F7E1] text-[#246B2A]'
                              : m.status === 'in_action'
                              ? 'bg-[#FFD3BF] text-[#BF3A1B]'
                              : 'bg-[#C9BDF2]/50 text-[#2D1B4E]'
                          }`}
                        >
                          {m.status === 'completed' ? 'Concluido' : `Etapa ${m.currentStage}`}
                        </span>
                        <span className="text-[10px] text-[#4A3F55]/60">
                          {new Date(m.startedAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                        </span>
                      </div>
                      <h3 className="text-xs font-bold text-[#2D1B4E] line-clamp-2 leading-snug">
                        {m.title}
                      </h3>
                      <div className="mt-2 flex items-center justify-between text-[11px] text-[#4A3F55]/70">
                        <span className="truncate max-w-[140px]">{m.theme}</span>
                        {m.status === 'completed' && (
                          <span className="text-[#BF3A1B] font-semibold text-[10px] flex items-center gap-0.5">
                            <Award className="w-3 h-3" />
                            Reporte
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="p-3 m-3 bg-[#C9BDF2]/25 border border-[#C9BDF2]/50 rounded-xl text-xs text-[#2D1B4E]">
              <div className="flex items-center gap-1.5 font-bold mb-1">
                <ShieldCheck className="w-4 h-4 text-[#BF3A1B]" />
                <span>100% Confidencial</span>
              </div>
              <p className="text-[11px] text-[#4A3F55] leading-tight">
                Tus conversaciones con Lidacta son privadas.
              </p>
            </div>
          </div>
          <div className="flex-1" onClick={() => setShowMobileSidebar(false)} />
        </div>
      )}

      {/* DESKTOP SIDEBAR: Mentorías y Acompañamientos */}
      <aside className="hidden md:flex w-72 lg:w-80 bg-white border-r border-[#493447]/10 flex-col shrink-0 no-print">
        {/* Primary CTA: Nuevo Acompañamiento */}
        <div className="p-4 border-b border-[#493447]/10">
          <button
            onClick={() => setActiveMentorshipId(null)}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-[#BF3A1B] hover:bg-[#a63014] text-white font-bold text-sm rounded-xl shadow-sm transition-all cursor-pointer min-h-[44px]"
          >
            <Plus className="w-4 h-4" />
            <span>Nuevo Acompañamiento</span>
          </button>
        </div>

        {/* Filter Segmented Controls */}
        <div className="px-4 pt-3 pb-2 flex items-center justify-between gap-1 text-xs text-[#4A3F55]">
          <span className="font-heading font-bold text-xs uppercase tracking-wider text-[#2D1B4E]">
            Mis Acompañamientos
          </span>
          <div className="flex items-center gap-1 p-0.5 bg-[#FFF7EF] rounded-lg border border-[#493447]/10">
            <button
              onClick={() => setFilterTab('all')}
              className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                filterTab === 'all' ? 'bg-white text-[#2D1B4E] font-bold shadow-xs' : 'text-[#4A3F55]/70'
              }`}
            >
              Todos
            </button>
            <button
              onClick={() => setFilterTab('active')}
              className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                filterTab === 'active' ? 'bg-white text-[#2D1B4E] font-bold shadow-xs' : 'text-[#4A3F55]/70'
              }`}
            >
              En curso
            </button>
            <button
              onClick={() => setFilterTab('completed')}
              className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                filterTab === 'completed' ? 'bg-white text-[#2D1B4E] font-bold shadow-xs' : 'text-[#4A3F55]/70'
              }`}
            >
              Cerrados
            </button>
          </div>
        </div>

        {/* Sessions List */}
        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
          {filteredMentorships.length === 0 ? (
            <div className="p-6 text-center text-xs text-[#4A3F55]/60">
              No hay acompañamientos en esta vista. Plantea un nuevo reto para comenzar.
            </div>
          ) : (
            filteredMentorships.map((m) => {
              const isSelected = activeMentorship?.id === m.id;
              return (
                <div
                  key={m.id}
                  onClick={() => setActiveMentorshipId(m.id)}
                  className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-[#FFD3BF]/20 border-[#BF3A1B]/40 shadow-xs'
                      : 'bg-white hover:bg-[#FFF7EF] border-[#493447]/10'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
                        m.status === 'completed'
                          ? 'bg-[#E2F7E1] text-[#246B2A]'
                          : m.status === 'in_action'
                          ? 'bg-[#FFD3BF] text-[#BF3A1B]'
                          : 'bg-[#C9BDF2]/50 text-[#2D1B4E]'
                      }`}
                    >
                      {m.status === 'completed' ? 'Concluido' : `Etapa ${m.currentStage}`}
                    </span>
                    <span className="text-[10px] text-[#4A3F55]/60">
                      {new Date(m.startedAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                    </span>
                  </div>

                  <h3 className="text-xs font-bold text-[#2D1B4E] line-clamp-2 leading-snug">
                    {m.title}
                  </h3>

                  <div className="mt-2 flex items-center justify-between text-[11px] text-[#4A3F55]/70">
                    <span className="truncate max-w-[140px]">{m.theme}</span>
                    {m.status === 'completed' && (
                      <span className="text-[#BF3A1B] font-semibold text-[10px] flex items-center gap-0.5">
                        <Award className="w-3 h-3" />
                        Reporte
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Confidentiality Reminder Badge */}
        <div className="p-3 m-3 bg-[#C9BDF2]/25 border border-[#C9BDF2]/50 rounded-xl text-xs text-[#2D1B4E]">
          <div className="flex items-center gap-1.5 font-bold mb-1">
            <ShieldCheck className="w-4 h-4 text-[#BF3A1B]" />
            <span>100% Confidencial</span>
          </div>
          <p className="text-[11px] text-[#4A3F55] leading-tight">
            Tus conversaciones con Lidacta son privadas. Recursos Humanos solo ve indicadores de desarrollo.
          </p>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 flex flex-col bg-[#FFF7EF] overflow-y-auto min-w-0">
        {/* If no active mentorship is selected, or "+ Nuevo Acompañamiento" was clicked: SHOW INITIAL HERO & PROMPT */}
        {!activeMentorship ? (
          <div className="w-full max-w-screen-xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8 space-y-6 sm:space-y-8 animate-in fade-in">
            {/* Mobile View Switcher between Challenge and Mentorship List */}
            <div className="md:hidden w-full">
              <div className="grid grid-cols-2 p-1 bg-white border border-[#493447]/15 rounded-xl shadow-xs">
                <button
                  onClick={() => setMobileHomeTab('prompt')}
                  className={`py-2 text-xs font-bold rounded-lg transition-all ${
                    mobileHomeTab === 'prompt' ? 'bg-[#BF3A1B] text-white shadow-xs' : 'text-[#4A3F55]'
                  }`}
                >
                  + Nuevo Reto
                </button>
                <button
                  onClick={() => setMobileHomeTab('list')}
                  className={`py-2 text-xs font-bold rounded-lg transition-all ${
                    mobileHomeTab === 'list' ? 'bg-[#BF3A1B] text-white shadow-xs' : 'text-[#4A3F55]'
                  }`}
                >
                  Mis Casos ({leaderMentorships.length})
                </button>
              </div>
            </div>

            {/* Mobile List View when tab selected */}
            {mobileHomeTab === 'list' && (
              <div className="md:hidden space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-[#493447]/10">
                  <span className="font-heading font-bold text-sm text-[#2D1B4E]">
                    Tus Acompañamientos Registrados
                  </span>
                  <button
                    onClick={() => setMobileHomeTab('prompt')}
                    className="text-xs font-bold text-[#BF3A1B] flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Nuevo</span>
                  </button>
                </div>
                {filteredMentorships.length === 0 ? (
                  <div className="p-6 bg-white border border-[#493447]/10 rounded-2xl text-center text-xs text-[#4A3F55]/60">
                    No hay acompañamientos registrados. Pulsa en "+ Nuevo Reto" para iniciar.
                  </div>
                ) : (
                  filteredMentorships.map((m) => (
                    <div
                      key={m.id}
                      onClick={() => setActiveMentorshipId(m.id)}
                      className="p-4 bg-white border border-[#493447]/15 rounded-xl shadow-xs space-y-2 cursor-pointer active:scale-98 transition-transform"
                    >
                      <div className="flex items-center justify-between">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
                            m.status === 'completed'
                              ? 'bg-[#E2F7E1] text-[#246B2A]'
                              : m.status === 'in_action'
                              ? 'bg-[#FFD3BF] text-[#BF3A1B]'
                              : 'bg-[#C9BDF2]/50 text-[#2D1B4E]'
                          }`}
                        >
                          {m.status === 'completed' ? 'Concluido' : `Etapa ${m.currentStage}`}
                        </span>
                        <span className="text-[10px] text-[#4A3F55]/60">
                          {new Date(m.startedAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                        </span>
                      </div>
                      <h3 className="font-heading font-bold text-sm text-[#2D1B4E]">
                        {m.title}
                      </h3>
                      <div className="flex items-center justify-between text-xs text-[#4A3F55]/70 pt-1 border-t border-[#493447]/5">
                        <span>{m.theme}</span>
                        <span className="text-[#BF3A1B] font-semibold flex items-center gap-1">
                          Continuar <ArrowRight className="w-3 h-3" />
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Prompt View (Always visible on desktop, or when mobileHomeTab === 'prompt' on mobile) */}
            <div className={`space-y-6 sm:space-y-8 ${mobileHomeTab === 'list' ? 'hidden md:block' : 'block'}`}>
              {/* Header Hero Banner */}
              <div className="bg-white border border-[#493447]/15 rounded-2xl overflow-hidden shadow-sm flex flex-col md:flex-row items-stretch">
                <div className="p-5 sm:p-8 flex-1 space-y-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#BF3A1B]">
                    Bienvenido, {currentUser.name}
                  </span>
                  <h1 className="font-heading font-extrabold text-xl sm:text-2xl md:text-3xl text-[#2D1B4E] leading-tight">
                    ¿Qué situación de liderazgo enfrentas hoy?
                  </h1>
                  <p className="text-xs sm:text-sm text-[#4A3F55] leading-relaxed">
                    Lidacta es tu espacio seguro de mentoría ejecutiva para analizar, practicar y resolver retos reales con tu equipo en {currentUser.companyName}.
                  </p>
                </div>
                <div className="w-full md:w-80 h-44 sm:h-64 md:h-auto shrink-0 relative bg-[#2D1B4E]/5">
                  <img
                    src="/src/assets/images/lidacta_hero_mentorship_1792074705291.jpg"
                    alt="Mentoría de liderazgo Lidacta"
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                </div>
              </div>

              {/* In Primer Plano: Entrada obligatoria de situación o reto */}
              <div className="bg-white border-2 border-[#BF3A1B]/30 rounded-2xl p-4 sm:p-8 shadow-md space-y-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-[#FFD3BF] text-[#BF3A1B] flex items-center justify-center font-bold shrink-0">
                    <Compass className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="font-heading font-bold text-base sm:text-lg text-[#2D1B4E]">
                      Plantea tu situación real, reto o problemática
                    </h2>
                    <p className="text-xs text-[#4A3F55]/80">
                      Escribe con tus propias palabras qué está ocurriendo con tu gente o qué decisión debes tomar.
                    </p>
                  </div>
                </div>

                <textarea
                  value={newChallengePrompt}
                  onChange={(e) => setNewChallengePrompt(e.target.value)}
                  placeholder="Ejemplo: Tengo un colaborador clave en mi equipo que entrega con retrasos continuos y cuando le doy retroalimentación se pone a la defensiva..."
                  rows={4}
                  className="w-full p-3.5 sm:p-4 text-xs sm:text-sm text-[#2D1B4E] bg-[#FFF7EF]/50 border border-[#493447]/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#BF3A1B] focus:border-transparent transition-all placeholder:text-[#4A3F55]/50 leading-relaxed"
                />

                {/* Quick suggestions */}
                <div className="space-y-2">
                  <span className="text-xs font-semibold text-[#4A3F55]">Retos frecuentes en tu contexto:</span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {[
                      'Me cuesta trabajo delegar tareas críticas antes de una fecha de entrega',
                      'Falta de compromiso y desacuerdos en el cambio de turno',
                      'Debo tener una conversación difícil sobre baja calidad en el trabajo',
                      'Tensión entre dos integrantes del equipo que afecta el clima laboral',
                    ].map((example, i) => (
                      <button
                        key={i}
                        onClick={() => setNewChallengePrompt(example)}
                        className="text-xs text-left p-2.5 bg-[#FFF7EF] hover:bg-[#FFD3BF]/30 text-[#4A3F55] hover:text-[#2D1B4E] rounded-xl border border-[#493447]/10 transition-colors cursor-pointer"
                      >
                        {example}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    onClick={handleStartChallenge}
                    disabled={!newChallengePrompt.trim() || isStartingNew}
                    className="w-full sm:w-auto min-h-[44px] flex items-center justify-center gap-2 px-6 py-3 bg-[#BF3A1B] hover:bg-[#a63014] text-white font-bold text-sm rounded-xl shadow-sm transition-all disabled:opacity-50 cursor-pointer active:scale-95"
                  >
                    {isStartingNew ? (
                      <span>Iniciando mentoría con Lidacta...</span>
                    ) : (
                      <>
                        <span>Iniciar Acompañamiento</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Methodology Roadmap: 7 Etapas */}
              <div className="space-y-3">
                <h3 className="font-heading font-bold text-xs sm:text-sm text-[#2D1B4E] uppercase tracking-wider">
                  El Flujo Operativo de Lidacta (7 Etapas)
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {[
                    { num: 1, title: 'Detectar', desc: 'Entender a fondo sin juzgar, validando tu contexto.' },
                    { num: 2, title: 'Analizar', desc: 'Ver otros ángulos y descubrir habilidades clave.' },
                    { num: 3, title: 'Alternativas', desc: 'Tú diseñas las salidas; Lidacta fortalece.' },
                    { num: 4, title: 'Practicar', desc: 'Simulación y roleplay con voz antes de actuar.' },
                    { num: 5, title: 'Actuar', desc: 'Plan concreto: qué, cuándo, con quién y cómo.' },
                    { num: 6, title: 'Aprender', desc: 'Reflexionar tras la acción y ajustar hábitos.' },
                    { num: 7, title: 'Cierre', desc: 'Reporte confidencial de retroalimentación.' },
                  ].map((s) => (
                    <div key={s.num} className="p-3.5 bg-white border border-[#493447]/10 rounded-xl space-y-1">
                      <span className="text-[11px] font-bold text-[#BF3A1B]">Etapa {s.num}</span>
                      <h4 className="text-xs font-bold text-[#2D1B4E]">{s.title}</h4>
                      <p className="text-[11px] text-[#4A3F55]/80 leading-normal">{s.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* ACTIVE MENTORSHIP VIEW */
          <div className="flex-1 flex flex-col h-full overflow-hidden">
            {/* Top Bar of Active Mentorship */}
            <div className="p-3 sm:p-4 bg-white border-b border-[#493447]/10 shrink-0">
              <div className="w-full max-w-screen-xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <button
                    onClick={() => setShowMobileSidebar(true)}
                    className="md:hidden min-h-[44px] flex items-center gap-1.5 px-3 py-2 bg-[#FFF7EF] border border-[#493447]/15 rounded-xl text-xs font-bold text-[#2D1B4E] cursor-pointer shrink-0 active:scale-95"
                    title="Ver lista de acompañamientos"
                  >
                    <Menu className="w-4 h-4 text-[#BF3A1B]" />
                    <span>Casos</span>
                  </button>
                  <div className="space-y-0.5 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-[#FFD3BF] text-[#BF3A1B] shrink-0">
                        Etapa {activeMentorship.currentStage} de 7
                      </span>
                      <span className="text-xs text-[#4A3F55]/70 hidden xs:inline">·</span>
                      <span className="text-xs font-semibold text-[#2D1B4E] truncate max-w-[150px] sm:max-w-none">
                        {activeMentorship.theme}
                      </span>
                    </div>
                    <h2 className="font-heading font-bold text-sm sm:text-base text-[#2D1B4E] truncate">
                      {activeMentorship.title}
                    </h2>
                  </div>
                </div>

                {/* Stage Advance Action */}
                <div className="flex items-center gap-2 shrink-0">
                  {activeMentorship.currentStage < 7 && (
                    <button
                      onClick={() => advanceStage()}
                      disabled={isSendingMessage}
                      className="w-full sm:w-auto min-h-[44px] flex items-center justify-center gap-1.5 px-3.5 py-2 bg-[#BF3A1B] hover:bg-[#a63014] text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50 active:scale-95"
                    >
                      <span>Avanzar a Etapa {activeMentorship.currentStage + 1}</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {activeMentorship.currentStage === 7 && (
                    <span className="text-xs font-bold text-[#246B2A] bg-[#E2F7E1] px-3 py-2 rounded-xl flex items-center gap-1 min-h-[44px]">
                      <CheckCircle2 className="w-4 h-4" />
                      Proceso Concluido
                    </span>
                  )}
                </div>
              </div>

              {/* Visual 7-Stage Progress Bar */}
              <div className="w-full max-w-screen-xl mx-auto mt-2.5 pt-2.5 border-t border-[#493447]/10">
                <div className="grid grid-cols-7 gap-1 sm:gap-2">
                  {([1, 2, 3, 4, 5, 6, 7] as StageNumber[]).map((st) => {
                    const isPassed = activeMentorship.currentStage > st;
                    const isCurrent = activeMentorship.currentStage === st;
                    return (
                      <button
                        key={st}
                        onClick={() => advanceStage(st)}
                        className={`min-h-[38px] sm:min-h-[40px] text-center py-1 sm:py-1.5 px-0.5 sm:px-1 rounded-lg transition-colors text-[10px] sm:text-xs font-medium cursor-pointer ${
                          isCurrent
                            ? 'bg-[#2D1B4E] text-[#F7B538] font-bold shadow-xs'
                            : isPassed
                            ? 'bg-[#C9BDF2]/40 text-[#2D1B4E]'
                            : 'bg-neutral-100 text-[#4A3F55]/60 hover:bg-neutral-200'
                        }`}
                        title={STAGE_TITLES[st]}
                      >
                        <span className="block sm:hidden font-bold">{st}</span>
                        <span className="hidden sm:block truncate">{STAGE_TITLES[st]}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Conversation Stream & Interactive Stage Cards */}
            <div className="flex-1 overflow-y-auto p-3 sm:p-6 space-y-4 sm:space-y-6 w-full max-w-screen-xl mx-auto">
              {/* Privacy Notice */}
              <div className="p-3 bg-[#FFF7EF] border border-[#FFD3BF] rounded-xl flex items-center justify-between text-xs text-[#4A3F55]">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-[#BF3A1B] shrink-0" />
                  <span className="leading-snug">
                    Conversación 100% confidencial con tu mentor Lidacta. Recursos Humanos solo ve indicadores de desarrollo.
                  </span>
                </div>
              </div>

              {/* Messages timeline */}
              {activeMentorship.messages.map((msg) => {
                const isLidacta = msg.sender === 'lidacta';

                if (isLidacta) {
                  return (
                    <div key={msg.id} className="flex gap-2.5 sm:gap-3 items-start animate-in fade-in">
                      <div className="w-8 h-8 rounded-xl bg-[#2D1B4E] text-[#F7B538] flex items-center justify-center font-bold text-xs shrink-0 mt-0.5 shadow-xs">
                        L
                      </div>
                      <div className="flex-1 bg-white border border-[#493447]/15 rounded-2xl rounded-tl-sm p-3.5 sm:p-5 shadow-xs space-y-2.5 sm:space-y-3 min-w-0">
                        <div className="flex items-center justify-between border-b border-[#493447]/10 pb-2">
                          <span className="font-heading font-bold text-xs text-[#2D1B4E]">
                            Lidacta · Mentora Sr.
                          </span>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => toggleVoicePlayback(msg.text)}
                              title="Escuchar intervención de Lidacta con voz"
                              className="text-[#BF3A1B] hover:text-[#2D1B4E] text-xs flex items-center gap-1 cursor-pointer min-h-[36px] px-2 py-1 rounded-lg hover:bg-[#FFD3BF]/20"
                            >
                              {isPlayingAudio ? (
                                <>
                                  <VolumeX className="w-3.5 h-3.5" />
                                  <span className="hidden sm:inline">Pausar</span>
                                </>
                              ) : (
                                <>
                                  <Volume2 className="w-3.5 h-3.5" />
                                  <span className="hidden sm:inline">Escuchar</span>
                                </>
                              )}
                            </button>
                            <span className="text-[10px] text-[#4A3F55]/60 tabular-nums">
                              {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        </div>

                        <div className="text-xs sm:text-sm text-[#4A3F55] leading-relaxed whitespace-pre-line font-normal">
                          {msg.text}
                        </div>
                      </div>
                    </div>
                  );
                }

                // Leader message: styled according to brand guidelines
                return (
                  <div key={msg.id} className="flex gap-2.5 sm:gap-3 justify-end items-start animate-in fade-in">
                    <div className="max-w-[85%] sm:max-w-xl bg-[#FFD3BF]/30 border border-[#FFD3BF] rounded-2xl rounded-tr-sm p-3.5 sm:p-4 space-y-1 text-right">
                      <div className="flex items-center justify-between text-[10px] text-[#4A3F55]/70 mb-1 gap-2">
                        <span className="font-semibold text-[#BF3A1B]">Voz del líder</span>
                        <span className="tabular-nums">{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <p
                        className={`text-xs sm:text-sm text-[#2D1B4E] leading-relaxed text-left ${
                          msg.isLeaderVoiceQuote ? 'font-leader text-sm sm:text-base' : ''
                        }`}
                      >
                        {msg.text}
                      </p>
                    </div>
                  </div>
                );
              })}

              {/* INTERACTIVE STAGE SPECIFIC PANELS */}

              {/* Stage 2: Identified Skills Highlight */}
              {activeMentorship.currentStage >= 2 && activeMentorship.identifiedSkills && activeMentorship.identifiedSkills.length > 0 && (
                <div className="p-4 bg-white border border-[#493447]/15 rounded-2xl space-y-2.5 shadow-xs">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#BF3A1B]">
                    <Target className="w-4 h-4 shrink-0" />
                    <span>Habilidades clave identificadas en Etapa 2:</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 sm:gap-2">
                    {activeMentorship.identifiedSkills.map((sk, idx) => (
                      <span
                        key={idx}
                        className="px-2.5 py-1 bg-[#FFF7EF] border border-[#BF3A1B]/30 text-[#2D1B4E] font-semibold text-xs rounded-lg"
                      >
                        {sk}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Stage 4: Roleplay Practice Arena (Optional with Voice) */}
              {activeMentorship.currentStage === 4 && (
                <div className="p-4 sm:p-5 bg-white border-2 border-[#BF3A1B]/40 rounded-2xl shadow-sm space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-[#FFD3BF] text-[#BF3A1B] flex items-center justify-center font-bold shrink-0">
                        <Sparkles className="w-4 h-4" />
                      </div>
                      <h4 className="font-heading font-bold text-sm sm:text-base text-[#2D1B4E]">
                        Etapa 4: Practicar antes de actuar (Roleplay opcional)
                      </h4>
                    </div>
                    <span className="text-[11px] font-semibold text-[#BF3A1B] bg-[#FFD3BF]/40 px-2 py-0.5 rounded w-fit">
                      Práctica con voz o texto
                    </span>
                  </div>

                  <p className="text-xs sm:text-sm text-[#4A3F55] leading-relaxed">
                    Practica aquí la conversación o diálogo que tendrás. Lidacta asumirá el rol del colaborador o involucrado y te dará retroalimentación instantánea de lo que debes cuidar o mejorar.
                  </p>

                  <div className="p-3 bg-[#FFF7EF] border border-[#493447]/10 rounded-xl space-y-2">
                    <span className="text-xs font-bold text-[#2D1B4E]">Opciones de práctica:</span>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <button
                        onClick={() =>
                          sendMessageInActiveSession(
                            'Lidacta, quiero simular que tú eres mi colaborador y yo te cito a solas para darte retroalimentación.',
                            true
                          )
                        }
                        className="min-h-[44px] text-xs px-3.5 py-2 bg-white border border-[#493447]/15 rounded-xl hover:border-[#BF3A1B] font-semibold text-[#2D1B4E] cursor-pointer flex items-center justify-center gap-1.5 shadow-xs active:scale-98"
                      >
                        🎭 Iniciar simulación de diálogo
                      </button>
                      <button
                        onClick={() => advanceStage(5)}
                        className="min-h-[44px] text-xs px-3.5 py-2 bg-neutral-100 hover:bg-neutral-200 text-[#4A3F55] rounded-xl cursor-pointer flex items-center justify-center font-medium active:scale-98"
                      >
                        ⏭️ Omitir práctica y pasar al Plan de Acción (Etapa 5)
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Stage 5: Action Plan Editor */}
              {activeMentorship.currentStage >= 5 && (
                <div className="p-4 sm:p-5 bg-white border-2 border-[#BF3A1B]/30 rounded-2xl shadow-sm space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-[#BF3A1B] shrink-0" />
                      <h4 className="font-heading font-bold text-sm sm:text-base text-[#2D1B4E]">
                        Etapa 5: Plan de Acción Concreto
                      </h4>
                    </div>
                    {activeMentorship.actionPlan?.isCompleted ? (
                      <span className="text-xs font-bold text-[#246B2A] bg-[#E2F7E1] px-2.5 py-1 rounded-lg flex items-center gap-1 w-fit">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Acción Realizada
                      </span>
                    ) : (
                      <span className="text-xs font-semibold text-[#BF3A1B] bg-[#FFD3BF]/60 px-2 py-0.5 rounded w-fit">
                        En Seguimiento
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="space-y-1">
                      <label className="font-bold text-[#2D1B4E]">1. ¿Qué exactamente harás?</label>
                      <input
                        type="text"
                        value={actionWhat}
                        onChange={(e) => setActionWhat(e.target.value)}
                        placeholder="Ej. Conversación 1 a 1 de alineación"
                        className="w-full p-2.5 min-h-[44px] bg-[#FFF7EF]/50 border border-[#493447]/15 rounded-xl text-xs text-[#2D1B4E]"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="font-bold text-[#2D1B4E]">2. ¿Cuándo lo harás? (Fecha específica)</label>
                      <input
                        type="text"
                        value={actionWhen}
                        onChange={(e) => setActionWhen(e.target.value)}
                        placeholder="Ej. Jueves 17 a las 15:30 hrs"
                        className="w-full p-2.5 min-h-[44px] bg-[#FFF7EF]/50 border border-[#493447]/15 rounded-xl text-xs text-[#2D1B4E]"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="font-bold text-[#2D1B4E]">3. ¿Con quién lo harás?</label>
                      <input
                        type="text"
                        value={actionWithWhom}
                        onChange={(e) => setActionWithWhom(e.target.value)}
                        placeholder="Ej. Supervisor de turno"
                        className="w-full p-2.5 min-h-[44px] bg-[#FFF7EF]/50 border border-[#493447]/15 rounded-xl text-xs text-[#2D1B4E]"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="font-bold text-[#2D1B4E]">4. ¿Qué vas a cuidar o recordar?</label>
                      <input
                        type="text"
                        value={actionCare}
                        onChange={(e) => setActionCare(e.target.value)}
                        placeholder="Ej. Mantener serenidad y escuchar con empatía"
                        className="w-full p-2.5 min-h-[44px] bg-[#FFF7EF]/50 border border-[#493447]/15 rounded-xl text-xs text-[#2D1B4E]"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-3 border-t border-[#493447]/10">
                    <button
                      onClick={handleSaveActionPlan}
                      className="w-full sm:w-auto min-h-[44px] px-4 py-2 bg-[#BF3A1B] text-white font-bold text-xs rounded-xl hover:bg-[#a63014] transition-colors cursor-pointer shadow-xs active:scale-98 flex items-center justify-center"
                    >
                      Guardar y Activar Recordatorio
                    </button>
                    {!activeMentorship.actionPlan?.isCompleted && (
                      <button
                        onClick={() => {
                          markActionCompleted();
                          advanceStage(6);
                        }}
                        className="w-full sm:w-auto min-h-[44px] flex items-center justify-center gap-1.5 px-4 py-2 bg-[#2D1B4E] text-[#F7B538] font-bold text-xs rounded-xl hover:bg-[#493447] transition-colors cursor-pointer shadow-xs active:scale-98"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Ya ejecuté la acción → Ir a Etapa 6 (Aprender)</span>
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Stage 6: Learnings & Reflections */}
              {activeMentorship.currentStage >= 6 && (
                <div className="p-4 sm:p-5 bg-white border border-[#493447]/15 rounded-2xl shadow-sm space-y-4">
                  <div className="flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-[#BF3A1B] shrink-0" />
                    <h4 className="font-heading font-bold text-sm sm:text-base text-[#2D1B4E]">
                      Etapa 6: Aprender - Ajustar (Reflexión indispensable)
                    </h4>
                  </div>

                  <div className="space-y-3 text-xs">
                    <div>
                      <label className="font-bold text-[#2D1B4E]">¿Qué ocurrió después de tu acción?</label>
                      <textarea
                        value={learningWhatHappened}
                        onChange={(e) => setLearningWhatHappened(e.target.value)}
                        placeholder="Describe cómo reaccionó la otra persona o el equipo..."
                        rows={2}
                        className="w-full mt-1 p-2.5 bg-[#FFF7EF]/50 border border-[#493447]/15 rounded-xl text-xs"
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="font-bold text-[#2D1B4E]">¿Qué funcionó?</label>
                        <input
                          type="text"
                          value={learningWhatWorked}
                          onChange={(e) => setLearningWhatWorked(e.target.value)}
                          placeholder="Lo que dio buen resultado..."
                          className="w-full mt-1 p-2.5 min-h-[44px] bg-[#FFF7EF]/50 border border-[#493447]/15 rounded-xl text-xs"
                        />
                      </div>
                      <div>
                        <label className="font-bold text-[#2D1B4E]">¿De qué te das cuenta y qué aprendes?</label>
                        <input
                          type="text"
                          value={learningInsights}
                          onChange={(e) => setLearningInsights(e.target.value)}
                          placeholder="Tu insight de liderazgo..."
                          className="w-full mt-1 p-2.5 min-h-[44px] bg-[#FFF7EF]/50 border border-[#493447]/15 rounded-xl text-xs"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-3 border-t border-[#493447]/10">
                    <button
                      onClick={handleSaveLearnings}
                      className="w-full sm:w-auto min-h-[44px] px-4 py-2 bg-neutral-200 text-[#2D1B4E] font-bold text-xs rounded-xl hover:bg-neutral-300 transition-colors cursor-pointer flex items-center justify-center"
                    >
                      Guardar Reflexión
                    </button>
                    {activeMentorship.currentStage === 6 && (
                      <button
                        onClick={() => advanceStage(7)}
                        className="w-full sm:w-auto min-h-[44px] px-4 py-2 bg-[#BF3A1B] text-white font-bold text-xs rounded-xl hover:bg-[#a63014] transition-colors cursor-pointer shadow-xs active:scale-98 flex items-center justify-center"
                      >
                        Concluir e ir a Cierre (Etapa 7) →
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Stage 7: Comprehensive Feedback Report */}
              {activeMentorship.currentStage === 7 && activeMentorship.finalFeedbackReport && (
                <div className="p-4 sm:p-6 bg-white border-2 border-[#2D1B4E] rounded-2xl shadow-md space-y-5 print:border-none">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#493447]/15 pb-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <Award className="w-5 h-5 text-[#BF3A1B] shrink-0" />
                        <h3 className="font-heading font-extrabold text-base sm:text-lg text-[#2D1B4E]">
                          Reporte de Retroalimentación de Liderazgo y Autonomía
                        </h3>
                      </div>
                      <p className="text-xs text-[#4A3F55]/80 mt-0.5">
                        Lidacta · Desarrollo de Liderazgo en acción · {currentUser.companyName}
                      </p>
                    </div>

                    <button
                      onClick={() => window.print()}
                      className="min-h-[44px] flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-[#2D1B4E] bg-[#FFF7EF] border border-[#493447]/20 rounded-xl hover:bg-[#FFD3BF]/30 transition-colors cursor-pointer no-print w-full sm:w-auto"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>Imprimir / PDF</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                    {/* Strengths */}
                    <div className="p-4 bg-[#FFF7EF] rounded-xl space-y-2 border border-[#493447]/10">
                      <span className="font-heading font-bold text-[#2D1B4E] uppercase tracking-wider text-[11px] block">
                        🌟 Fortalezas detectadas en el líder
                      </span>
                      <ul className="space-y-1.5 list-disc list-inside text-[#4A3F55]">
                        {activeMentorship.finalFeedbackReport.detectedStrengths.map((s, i) => (
                          <li key={i}>{s}</li>
                        ))}
                      </ul>
                    </div>

                    {/* Stage 2 Skills */}
                    <div className="p-4 bg-[#FFD3BF]/20 rounded-xl space-y-2 border border-[#FFD3BF]">
                      <span className="font-heading font-bold text-[#BF3A1B] uppercase tracking-wider text-[11px] block">
                        🎯 Habilidades clave puestas en juego (Etapa 2)
                      </span>
                      <ul className="space-y-1.5 list-disc list-inside text-[#2D1B4E]">
                        {activeMentorship.finalFeedbackReport.stageTwoSkills.map((s, i) => (
                          <li key={i}>{s}</li>
                        ))}
                      </ul>
                    </div>

                    {/* Actions Chosen */}
                    <div className="p-4 bg-[#C9BDF2]/20 rounded-xl space-y-2 border border-[#C9BDF2]/40">
                      <span className="font-heading font-bold text-[#2D1B4E] uppercase tracking-wider text-[11px] block">
                        ⚡ Acciones que eligió el líder
                      </span>
                      <ul className="space-y-1.5 list-disc list-inside text-[#4A3F55]">
                        {activeMentorship.finalFeedbackReport.chosenActions.map((s, i) => (
                          <li key={i}>{s}</li>
                        ))}
                      </ul>
                    </div>

                    {/* Stage 6 Learnings */}
                    <div className="p-4 bg-[#FFF7EF] rounded-xl space-y-2 border border-[#493447]/10">
                      <span className="font-heading font-bold text-[#2D1B4E] uppercase tracking-wider text-[11px] block">
                        💡 Aprendizajes y reflexiones (Etapa 6)
                      </span>
                      <ul className="space-y-1.5 list-disc list-inside text-[#4A3F55]">
                        {activeMentorship.finalFeedbackReport.stageSixLearnings.map((s, i) => (
                          <li key={i}>{s}</li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* Recommendations for Autonomy */}
                  <div className="p-4 bg-[#2D1B4E] text-[#FFF7EF] rounded-xl space-y-2">
                    <span className="font-heading font-bold text-[#F7B538] uppercase tracking-wider text-[11px] block">
                      🚀 Recomendaciones para el fortalecimiento de tu autonomía
                    </span>
                    <ul className="space-y-1.5 list-disc list-inside text-xs leading-relaxed text-[#FFF7EF]/90">
                      {activeMentorship.finalFeedbackReport.recommendationsForAutonomy.map((rec, i) => (
                        <li key={i}>{rec}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="p-3 bg-[#FFF7EF] rounded-xl text-center text-xs text-[#4A3F55]/70">
                    Este reporte ha sido enviado también a tu correo electrónico registrado ({currentUser.email}).
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input Bar for Message Exchange */}
            <div className="p-2.5 sm:p-4 bg-white border-t border-[#493447]/10 shrink-0 no-print">
              <form onSubmit={handleSendMessage} className="w-full max-w-screen-xl mx-auto flex items-center gap-2">
                {/* Voice Input Mic Toggle */}
                <button
                  type="button"
                  onClick={toggleMicListening}
                  title="Hablar por micrófono"
                  className={`min-h-[44px] min-w-[44px] p-2.5 rounded-xl border transition-colors cursor-pointer shrink-0 flex items-center justify-center active:scale-95 ${
                    isListeningMic
                      ? 'bg-[#E8512F] text-white border-[#E8512F] animate-pulse'
                      : 'bg-[#FFF7EF] text-[#4A3F55] border-[#493447]/15 hover:border-[#BF3A1B]'
                  }`}
                >
                  {isListeningMic ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                </button>

                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder={
                    isListeningMic
                      ? 'Escuchando tu voz...'
                      : activeMentorship.currentStage === 4
                      ? 'Responde a la práctica o simula...'
                      : `Escribe tu respuesta para la Etapa ${activeMentorship.currentStage}...`
                  }
                  className="min-h-[44px] flex-1 px-3 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm text-[#2D1B4E] bg-[#FFF7EF]/50 border border-[#493447]/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#BF3A1B] focus:border-transparent transition-all placeholder:text-[#4A3F55]/50 min-w-0"
                  disabled={isSendingMessage}
                />

                <button
                  type="submit"
                  disabled={!inputText.trim() || isSendingMessage}
                  className="min-h-[44px] min-w-[44px] p-2.5 bg-[#BF3A1B] hover:bg-[#a63014] text-white rounded-xl shadow-xs transition-colors disabled:opacity-50 cursor-pointer shrink-0 flex items-center justify-center active:scale-95"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
