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
  ChevronDown,
  ChevronUp,
  CornerDownRight,
  HelpCircle,
  Download,
  Menu,
  X,
  ArrowLeft,
  AlertTriangle,
  Headphones,
} from 'lucide-react';
import { NewMentorshipModal } from './NewMentorshipModal';
import { WhatsAppVoiceRecorder } from './WhatsAppVoiceRecorder';
import { RequestMentorModal } from './RequestMentorModal';

const STAGE_TITLES: Record<StageNumber, string> = {
  1: '1. Detectar qué sucede',
  2: '2. Analizar perspectivas & Habilidades',
  3: '3. Diseñar alternativas',
  4: '4. Practicar antes de actuar',
  5: '5. Actuar (Plan de Acción)',
  6: '6. Aprender y reflexionar',
  7: '7. Cierre & Retroalimentación',
};

export const STAGE_META: Record<
  StageNumber,
  {
    name: string;
    shortTitle: string;
    subtitle: string;
    objective: string;
  }
> = {
  1: {
    name: 'Etapa 1',
    shortTitle: 'Detectar qué sucede',
    subtitle: 'Comprender a fondo sin juzgar, validando tu contexto y hechos.',
    objective: 'Identificar hechos concretos, detonantes y personas involucradas sin juicios previos.',
  },
  2: {
    name: 'Etapa 2',
    shortTitle: 'Analizar perspectivas & Habilidades',
    subtitle: 'Explorar puntos de vista y descubrir habilidades clave de liderazgo.',
    objective: 'Explorar la perspectiva de los involucrados y mapear las habilidades indispensables a desplegar.',
  },
  3: {
    name: 'Etapa 3',
    shortTitle: 'Diseñar alternativas',
    subtitle: 'Idear y estructurar caminos viables de solución (tú lideras la salida).',
    objective: 'Estructurar al menos 2 o 3 alternativas viables; Lidacta acompaña y fortalece.',
  },
  4: {
    name: 'Etapa 4',
    shortTitle: 'Practicar antes de actuar',
    subtitle: 'Simulación y roleplay conversacional con voz o texto.',
    objective: 'Entrenar el diálogo en un entorno seguro antes de la conversación real en el trabajo.',
  },
  5: {
    name: 'Etapa 5',
    shortTitle: 'Actuar (Plan de Acción)',
    subtitle: 'Definir compromisos: qué, cuándo, con quién y qué cuidar.',
    objective: 'Aterrizar la intervención en un plan medible con fecha, hora y recordatorio concreto.',
  },
  6: {
    name: 'Etapa 6',
    shortTitle: 'Aprender y reflexionar',
    subtitle: 'Reflexión indispensable tras la acción para ajustar hábitos.',
    objective: 'Evaluar qué ocurrió, qué funcionó y consolidar aprendizajes de autonomía directiva.',
  },
  7: {
    name: 'Etapa 7',
    shortTitle: 'Cierre & Retroalimentación',
    subtitle: 'Consolidación de fortalezas y reporte de desarrollo.',
    objective: 'Obtención del reporte confidencial de retroalimentación de autonomía y cierre del proceso.',
  },
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
  const [stageInputText, setStageInputText] = useState('');
  const [newChallengePrompt, setNewChallengePrompt] = useState('');
  const [isStartingNew, setIsStartingNew] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isMentorModalOpen, setIsMentorModalOpen] = useState(false);
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
  const mainContainerRef = useRef<HTMLElement>(null);
  const activeScrollContainerRef = useRef<HTMLDivElement>(null);

  // Accordion open/collapse state for the 7 stages (default: all collapsed for completed cases; current open for active cases)
  const [openStages, setOpenStages] = useState<Record<StageNumber, boolean>>({
    1: false,
    2: false,
    3: false,
    4: false,
    5: false,
    6: false,
    7: false,
  });

  // Keep active stage open by default when switching session or advancing stage (only for active cases)
  useEffect(() => {
    if (activeMentorship) {
      const isCompleted =
        activeMentorship.status === 'completed' ||
        (activeMentorship.status as string) === 'closed' ||
        (activeMentorship.status as string) === 'concluido' ||
        !!activeMentorship.completedAt ||
        activeMentorship.currentStage === 7;

      if (isCompleted) {
        // Closed / completed case: all 7 stages stay compressed (closed) by default
        setOpenStages({
          1: false,
          2: false,
          3: false,
          4: false,
          5: false,
          6: false,
          7: false,
        });
      } else {
        const stage = activeMentorship.currentStage || 1;
        setOpenStages({
          1: stage === 1,
          2: stage === 2,
          3: stage === 3,
          4: stage === 4,
          5: stage === 5,
          6: stage === 6,
          7: stage === 7,
        });
      }
    }
  }, [
    activeMentorship?.id,
    activeMentorship?.currentStage,
    activeMentorship?.status,
    activeMentorship?.completedAt,
  ]);

  const toggleStage = (st: StageNumber) => {
    setOpenStages((prev) => ({
      ...prev,
      [st]: !prev[st],
    }));
  };

  const expandAllStages = () => {
    setOpenStages({
      1: true,
      2: true,
      3: true,
      4: true,
      5: true,
      6: true,
      7: true,
    });
  };

  const collapseAllStages = () => {
    setOpenStages({
      1: false,
      2: false,
      3: false,
      4: false,
      5: false,
      6: false,
      7: false,
    });
  };

  const collapseAllExceptCurrent = () => {
    if (!activeMentorship) return;
    const isCompleted =
      activeMentorship.status === 'completed' ||
      (activeMentorship.status as string) === 'closed' ||
      (activeMentorship.status as string) === 'concluido' ||
      !!activeMentorship.completedAt ||
      activeMentorship.currentStage === 7;

    if (isCompleted) {
      collapseAllStages();
      return;
    }
    const stage = activeMentorship.currentStage || 1;
    setOpenStages({
      1: stage === 1,
      2: stage === 2,
      3: stage === 3,
      4: stage === 4,
      5: stage === 5,
      6: stage === 6,
      7: stage === 7,
    });
  };

  // Initialize Speech Recognizer
  useEffect(() => {
    if (isSpeechRecognitionSupported()) {
      const rec = createSpeechRecognizer(
        (transcript) => {
          setStageInputText((prev) => (prev ? `${prev} ${transcript}` : transcript));
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
      setStageInputText('');
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

  // Initial positioning: Ensure screen and containers are strictly positioned at the top on mount and session load
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    if (mainContainerRef.current) {
      mainContainerRef.current.scrollTop = 0;
    }
    if (activeScrollContainerRef.current) {
      activeScrollContainerRef.current.scrollTop = 0;
    }
  }, [activeMentorship?.id]);

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
    setStageInputText('');
    await sendMessageInActiveSession(text, activeMentorship?.currentStage === 4);
    // Smooth scroll only on intentional user message submission
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 150);
  };

  // Dedicated submission for active stage card
  const handleSubmitStageMessage = async (st: StageNumber) => {
    if (!stageInputText.trim() || isSendingMessage) return;
    const textToSend = stageInputText.trim();
    setStageInputText('');
    setInputText('');
    if (isListeningMic && speechRecognizer) {
      speechRecognizer.stop();
      setIsListeningMic(false);
    }
    await sendMessageInActiveSession(textToSend, st === 4);
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 150);
  };

  const handleSubmitVoiceDirect = async (st: StageNumber, text: string) => {
    if (!text.trim() || isSendingMessage) return;
    setStageInputText('');
    setInputText('');
    await sendMessageInActiveSession(text.trim(), st === 4);
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 150);
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

  const toggleMicListeningForStage = () => {
    if (!isSpeechRecognitionSupported()) {
      const sampleText = ' [Nota de voz dictada: reflexiono sobre los puntos críticos y cómo organizar la delegación con mi equipo]';
      setStageInputText((prev) => (prev ? `${prev}${sampleText}` : sampleText.trim()));
      setInputText((prev) => (prev ? `${prev}${sampleText}` : sampleText.trim()));
      return;
    }
    if (!speechRecognizer) return;
    if (isListeningMic) {
      speechRecognizer.stop();
      setIsListeningMic(false);
    } else {
      speechRecognizer.start();
      setIsListeningMic(true);
    }
  };

  // Coherent opening trigger question tailored to each stage and current mentorship context
  const getStageTriggerQuestion = (
    st: StageNumber,
    mentorship: MentorshipSession
  ): string => {
    const leaderFirstName = currentUser?.name ? currentUser.name.split(' ')[0] : 'Líder';
    const skillsList =
      mentorship.identifiedSkills && mentorship.identifiedSkills.length > 0
        ? mentorship.identifiedSkills.join(' y ')
        : '';

    switch (st) {
      case 1:
        return `Hola ${leaderFirstName}. Para comprender a fondo sin juzgar y validar tu contexto: ¿Cuál es el hecho o detonante principal que ocurrió y quiénes están directamente involucrados?`;
      case 2:
        return `En la etapa anterior comprendimos los hechos iniciales sobre "${mentorship.title}". Ahora analicemos perspectivas: ¿Cómo crees que perciben la situación los demás involucrados y qué habilidades de liderazgo necesitas poner en juego para abordarlo?`;
      case 3:
        if (mentorship.id === 'ment_roberto_2' || mentorship.theme?.toLowerCase().includes('delegación')) {
          return `En la etapa anterior definimos la falta de delegación y el empoderamiento; para avanzar en esta Etapa 3, ¿qué tarea específica te cuesta más trabajo entregar hoy a tu equipo y qué alternativas visualizas?`;
        }
        if (skillsList) {
          return `En la etapa anterior definimos la necesidad de trabajar en ${skillsList}; para avanzar en esta Etapa 3 y diseñar alternativas de solución, ¿qué tarea o situación específica te cuesta más trabajo resolver hoy y qué caminos viables visualizas?`;
        }
        return `En la etapa anterior analizamos las perspectivas y habilidades requeridas; para avanzar en esta Etapa 3 y diseñar alternativas de solución: ¿qué alternativas o caminos viables visualizas tú para resolver esta situación?`;
      case 4:
        return `Tú has diseñado las alternativas clave. Antes de actuar en la vida real, preparemos el terreno en este espacio seguro: ¿Qué diálogo, objeción o postura difícil te gustaría simular o entrenar conmigo?`;
      case 5:
        return `Con las alternativas y la simulación preparadas, aterricemos la intervención en un Plan de Acción concreto: ¿Qué harás exactamente, en qué fecha y hora específica, con quién y qué cuidarás durante ese momento?`;
      case 6:
        return `Tras haber ejecutado tu plan de acción en el trabajo: ¿Qué ocurrió exactamente con tu equipo, qué funcionó, qué no y de qué te das cuenta para tus futuros hábitos de liderazgo?`;
      case 7:
        return `Has recorrido el ciclo completo de las 7 etapas con Lidacta. Tu conversación ha sido 100% confidencial. A continuación tienes tu reporte consolidado de retroalimentación de liderazgo y autonomía directiva.`;
      default:
        return `Apertura de la Etapa ${st}: Comparte tus reflexiones o dudas para avanzar en tu acompañamiento directivo.`;
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

  const renderSingleMessage = (msg: {
    id: string;
    sender: 'leader' | 'lidacta';
    text: string;
    timestamp: string;
    isLeaderVoiceQuote?: boolean;
  }) => {
    const isLidacta = msg.sender === 'lidacta';

    if (isLidacta) {
      return (
        <div key={msg.id} className="flex gap-2.5 sm:gap-3 items-start animate-in fade-in">
          <div className="w-8 h-8 rounded-xl bg-[#2D1B4E] text-[#F7B538] flex items-center justify-center font-bold text-xs shrink-0 mt-0.5 shadow-xs">
            L
          </div>
          <div className="flex-1 bg-[#FFF7EF]/50 border border-[#493447]/15 rounded-2xl rounded-tl-sm p-3.5 sm:p-4 shadow-xs space-y-2 min-w-0">
            <div className="flex items-center justify-between border-b border-[#493447]/10 pb-2">
              <span className="font-heading font-bold text-xs text-[#2D1B4E]">
                Lidacta · Mentora Sr.
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => toggleVoicePlayback(msg.text)}
                  title="Escuchar intervención de Lidacta con voz"
                  className="text-[#BF3A1B] hover:text-[#2D1B4E] text-xs flex items-center gap-1 cursor-pointer min-h-[32px] px-2 py-0.5 rounded-lg hover:bg-[#FFD3BF]/20 transition-colors"
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
            <span className="tabular-nums">
              {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
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
                  setShowMobileSidebar(false);
                  setIsModalOpen(true);
                }}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-[#F7B538] hover:bg-[#F5A623] text-[#2D1B4E] font-heading font-extrabold text-sm rounded-xl shadow-md transition-all cursor-pointer min-h-[44px] active:scale-95"
              >
                <Plus className="w-4 h-4" />
                <span>Nuevo acompañamiento</span>
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
                        <div className="flex items-center gap-1.5 flex-wrap">
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
                          {m.priority && (
                            <span
                              className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${
                                m.priority === 'alta'
                                  ? 'bg-[#BF3A1B]/15 text-[#BF3A1B]'
                                  : m.priority === 'media'
                                  ? 'bg-[#F7B538]/30 text-[#2D1B4E]'
                                  : 'bg-[#E2F7E1] text-[#246B2A]'
                              }`}
                            >
                              {m.priority}
                            </span>
                          )}
                        </div>
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
            onClick={() => setIsModalOpen(true)}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-[#F7B538] hover:bg-[#F5A623] text-[#2D1B4E] font-heading font-extrabold text-sm rounded-xl shadow-md transition-all cursor-pointer min-h-[44px] active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Nuevo acompañamiento</span>
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
                    <div className="flex items-center gap-1.5 flex-wrap">
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
                      {m.priority && (
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${
                            m.priority === 'alta'
                              ? 'bg-[#BF3A1B]/15 text-[#BF3A1B]'
                              : m.priority === 'media'
                              ? 'bg-[#F7B538]/30 text-[#2D1B4E]'
                              : 'bg-[#E2F7E1] text-[#246B2A]'
                          }`}
                        >
                          {m.priority}
                        </span>
                      )}
                    </div>
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
      <main ref={mainContainerRef} className="flex-1 flex flex-col bg-[#FFF7EF] overflow-y-auto min-w-0">
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
                    onClick={() => setIsModalOpen(true)}
                    className="text-xs font-bold text-[#2D1B4E] bg-[#F7B538] hover:bg-[#F5A623] px-2.5 py-1 rounded-lg flex items-center gap-1 shadow-xs transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5 text-[#2D1B4E]" />
                    <span>Nuevo acompañamiento</span>
                  </button>
                </div>
                {filteredMentorships.length === 0 ? (
                  <div className="p-6 bg-white border border-[#493447]/10 rounded-2xl text-center text-xs text-[#4A3F55]/60">
                    No hay acompañamientos registrados. Pulsa en "Nuevo acompañamiento" para iniciar.
                  </div>
                ) : (
                  filteredMentorships.map((m) => (
                    <div
                      key={m.id}
                      onClick={() => setActiveMentorshipId(m.id)}
                      className="p-4 bg-white border border-[#493447]/15 rounded-xl shadow-xs space-y-2 cursor-pointer active:scale-98 transition-transform"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 flex-wrap">
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
                          {m.priority && (
                            <span
                              className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${
                                m.priority === 'alta'
                                  ? 'bg-[#BF3A1B]/15 text-[#BF3A1B]'
                                  : m.priority === 'media'
                                  ? 'bg-[#F7B538]/30 text-[#2D1B4E]'
                                  : 'bg-[#E2F7E1] text-[#246B2A]'
                              }`}
                            >
                              {m.priority}
                            </span>
                          )}
                        </div>
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

                <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(true)}
                    className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-[#493447]/20 text-[#2D1B4E] hover:bg-[#FFF7EF] font-bold text-xs sm:text-sm transition-colors cursor-pointer min-h-[44px]"
                  >
                    <Plus className="w-4 h-4 text-[#BF3A1B]" />
                    <span>+ Formulario de Caso con Prioridad</span>
                  </button>

                  <button
                    onClick={handleStartChallenge}
                    disabled={!newChallengePrompt.trim() || isStartingNew}
                    className="min-h-[44px] flex items-center justify-center gap-2 px-6 py-3 bg-[#F7B538] hover:bg-[#F5A623] text-[#2D1B4E] font-heading font-extrabold text-sm rounded-xl shadow-md transition-all disabled:opacity-50 cursor-pointer active:scale-95"
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
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <button
                    onClick={() => setShowMobileSidebar(true)}
                    className="md:hidden min-h-[44px] flex items-center gap-1.5 px-3 py-2 bg-[#FFF7EF] border border-[#493447]/15 rounded-xl text-xs font-bold text-[#2D1B4E] cursor-pointer shrink-0 active:scale-95"
                    title="Ver lista de acompañamientos"
                  >
                    <Menu className="w-4 h-4 text-[#BF3A1B]" />
                    <span>Casos</span>
                  </button>
                  <div className="flex items-center gap-2 px-3 py-2 bg-[#FFF7EF] border border-[#FFD3BF] rounded-xl text-xs sm:text-sm text-[#2D1B4E] font-medium leading-snug">
                    <ShieldCheck className="w-4 h-4 text-[#BF3A1B] shrink-0" />
                    <span>
                      Conversación 100% confidencial con tu mentor Lidacta. Recursos Humanos solo ve indicadores de desarrollo
                    </span>
                  </div>
                </div>

                {/* Header Actions */}
                <div className="flex items-center gap-2 shrink-0 flex-wrap sm:flex-nowrap">
                  {/* Asesoría 1:1 Button */}
                  <button
                    onClick={() => setIsMentorModalOpen(true)}
                    className="flex items-center gap-1.5 px-3 py-2 bg-[#FFF7EF] hover:bg-[#FFD3BF]/60 text-[#BF3A1B] border-2 border-[#BF3A1B]/40 hover:border-[#BF3A1B] text-xs font-heading font-extrabold rounded-xl shadow-xs transition-all cursor-pointer min-h-[44px] active:scale-95"
                    title="Solicitar Asesoría 1:1 directa (Acompañamiento personal directivo con Tania Padierna)"
                  >
                    <UserCheck className="w-4 h-4 text-[#BF3A1B]" />
                    <span className="hidden sm:inline">Asesoría 1:1</span>
                    <span className="sm:hidden">Asesor 1:1</span>
                  </button>

                  <button
                    onClick={() => setIsModalOpen(true)}
                    className="flex items-center gap-1.5 px-3 py-2 bg-[#F7B538] hover:bg-[#F5A623] text-[#2D1B4E] text-xs font-heading font-extrabold rounded-xl shadow-xs transition-colors cursor-pointer min-h-[44px] active:scale-95"
                    title="Registrar nuevo caso o reto"
                  >
                    <Plus className="w-4 h-4 text-[#2D1B4E]" />
                    <span className="hidden sm:inline">Nuevo acompañamiento</span>
                    <span className="sm:hidden">Nuevo</span>
                  </button>

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

            </div>

            {/* Active Mentorship Body: Vertical Adaptive Accordion (7 Etapas) */}
            <div
              ref={activeScrollContainerRef}
              className="flex-1 overflow-y-auto p-3 sm:p-6 space-y-4 sm:space-y-5 w-full max-w-screen-xl mx-auto"
            >

              {/* Accordion Navigation Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-1">
                <div>
                  <h3 className="font-heading font-extrabold text-sm sm:text-base text-[#2D1B4E] flex items-center gap-2 flex-wrap">
                    <span>Mentoría - {activeMentorship.title}</span>
                    <span
                      className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                        activeMentorship.status === 'completed' ||
                        (activeMentorship.status as string) === 'closed' ||
                        (activeMentorship.status as string) === 'concluido' ||
                        !!activeMentorship.completedAt ||
                        activeMentorship.currentStage === 7
                          ? 'bg-[#E2F7E1] text-[#246B2A]'
                          : 'bg-[#FFD3BF] text-[#BF3A1B]'
                      }`}
                    >
                      {activeMentorship.status === 'completed' ||
                      (activeMentorship.status as string) === 'closed' ||
                      (activeMentorship.status as string) === 'concluido' ||
                      !!activeMentorship.completedAt ||
                      activeMentorship.currentStage === 7
                        ? 'Proceso Concluido'
                        : `Etapa activa: ${activeMentorship.currentStage} de 7`}
                    </span>
                  </h3>
                  <p className="text-xs text-[#4A3F55]/80 mt-0.5">
                    Toca cualquier etapa para desplegar o comprimir su contenido, herramientas e historial.
                  </p>
                </div>

                <div className="flex items-center gap-2 text-xs shrink-0">
                  <button
                    type="button"
                    onClick={expandAllStages}
                    className="px-3 py-1.5 rounded-xl border border-[#493447]/20 text-[#4A3F55] hover:text-[#2D1B4E] hover:bg-[#FFF7EF] font-semibold transition-colors cursor-pointer"
                  >
                    Expandir todas
                  </button>
                  <button
                    type="button"
                    onClick={collapseAllExceptCurrent}
                    className="px-3 py-1.5 rounded-xl border border-[#493447]/20 text-[#4A3F55] hover:text-[#2D1B4E] hover:bg-[#FFF7EF] font-semibold transition-colors cursor-pointer"
                  >
                    {activeMentorship.status === 'completed' ||
                    (activeMentorship.status as string) === 'closed' ||
                    (activeMentorship.status as string) === 'concluido' ||
                    !!activeMentorship.completedAt ||
                    activeMentorship.currentStage === 7
                      ? 'Comprimir todas'
                      : 'Solo etapa actual'}
                  </button>
                </div>
              </div>

              {/* Vertical Stack of 7 Accordion Cards */}
              <div className="space-y-3">
                {([1, 2, 3, 4, 5, 6, 7] as StageNumber[]).map((st) => {
                  const isCaseCompleted =
                    activeMentorship.status === 'completed' ||
                    (activeMentorship.status as string) === 'closed' ||
                    (activeMentorship.status as string) === 'concluido' ||
                    !!activeMentorship.completedAt ||
                    activeMentorship.currentStage === 7;

                  // If case is closed/completed, all 7 stages are marked as completed; otherwise rely on stage progress
                  const isPassed = isCaseCompleted ? true : activeMentorship.currentStage > st;
                  const isCurrent = isCaseCompleted ? false : activeMentorship.currentStage === st;
                  const isPending = isCaseCompleted ? false : activeMentorship.currentStage < st;
                  const isOpen = !!openStages[st];
                  const meta = STAGE_META[st];
                  const stageMessages = activeMentorship.messages.filter((m) => (m.stage || 1) === st);

                  return (
                    <div
                      key={st}
                      className={`rounded-2xl border transition-all duration-200 overflow-hidden ${
                        isCurrent
                          ? 'bg-white border-[#F7B538] ring-2 ring-[#F7B538]/30 shadow-md'
                          : isPassed
                          ? 'bg-white border-[#246B2A]/25 shadow-xs'
                          : 'bg-white border-[#493447]/15 opacity-90'
                      }`}
                    >
                      {/* Accordion Bar / Header Button */}
                      <button
                        type="button"
                        onClick={() => toggleStage(st)}
                        className={`w-full text-left p-3.5 sm:p-4.5 flex items-center justify-between gap-3 cursor-pointer transition-colors ${
                          isCurrent
                            ? 'bg-[#FFF7EF]/90 hover:bg-[#FFF7EF]'
                            : isPassed
                            ? 'hover:bg-[#E2F7E1]/20'
                            : 'hover:bg-neutral-50'
                        }`}
                        aria-expanded={isOpen}
                      >
                        {/* Left: Stage number badge & titles */}
                        <div className="flex items-center gap-3 sm:gap-3.5 min-w-0">
                          <div
                            className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center font-heading font-extrabold text-sm sm:text-base shrink-0 transition-transform ${
                              isCurrent
                                ? 'bg-[#F7B538] text-[#2D1B4E] shadow-xs'
                                : isPassed
                                ? 'bg-[#E2F7E1] text-[#246B2A]'
                                : 'bg-neutral-100 text-[#4A3F55]/60'
                            }`}
                          >
                            {isPassed ? <CheckCircle2 className="w-5 h-5 text-[#246B2A]" /> : st}
                          </div>

                          <div className="min-w-0 space-y-0.5">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-heading font-extrabold text-xs sm:text-sm text-[#2D1B4E]">
                                {meta.name}: {meta.shortTitle}
                              </span>
                            </div>
                            <p className="text-[11px] sm:text-xs text-[#4A3F55]/80 line-clamp-1">
                              {meta.subtitle}
                            </p>
                          </div>
                        </div>

                        {/* Right: Status badge & Chevron */}
                        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                          {isPassed && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] sm:text-xs font-bold bg-[#E2F7E1] text-[#246B2A] border border-[#246B2A]/20">
                              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                              <span>Completada</span>
                            </span>
                          )}
                          {isCurrent && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] sm:text-xs font-extrabold bg-[#F7B538] text-[#2D1B4E] shadow-xs">
                              <span className="w-2 h-2 rounded-full bg-[#2D1B4E] animate-ping shrink-0" />
                              <span>En curso</span>
                            </span>
                          )}
                          {isPending && (
                            <span className="inline-flex items-center px-2 py-1 rounded-lg text-[10px] sm:text-xs font-medium bg-neutral-100 text-[#4A3F55]/60 border border-neutral-200">
                              Pendiente
                            </span>
                          )}

                          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-[#4A3F55] hover:text-[#2D1B4E] transition-colors">
                            {isOpen ? (
                              <ChevronUp className="w-5 h-5 text-[#BF3A1B]" />
                            ) : (
                              <ChevronDown className="w-5 h-5 text-[#4A3F55]" />
                            )}
                          </div>
                        </div>
                      </button>

                      {/* Accordion Content Panel */}
                      {isOpen && (
                        <div className="border-t border-[#493447]/10 p-3.5 sm:p-5 space-y-4 bg-white animate-in fade-in duration-200">
                          {/* Objective Banner */}
                          <div className="p-3 bg-[#FFF7EF] border border-[#FFD3BF]/60 rounded-xl text-xs text-[#4A3F55] flex items-start gap-2.5">
                            <Compass className="w-4 h-4 text-[#BF3A1B] shrink-0 mt-0.5" />
                            <div>
                              <span className="font-bold text-[#2D1B4E] mr-1">Propósito de la etapa:</span>
                              <span>{meta.objective}</span>
                            </div>
                          </div>

                          {/* Stage 1: Initial Challenge Card */}
                          {st === 1 && activeMentorship.initialChallenge && (
                            <div className="p-3.5 bg-neutral-50 border border-[#493447]/10 rounded-xl space-y-1">
                              <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#BF3A1B]">
                                <FileText className="w-3.5 h-3.5" />
                                <span>Situación o reto inicial planteado:</span>
                              </div>
                              <p className="text-xs sm:text-sm text-[#2D1B4E] leading-relaxed">
                                {activeMentorship.initialChallenge}
                              </p>
                            </div>
                          )}

                          {/* Stage 2: Identified Skills Highlight */}
                          {st === 2 && activeMentorship.identifiedSkills && activeMentorship.identifiedSkills.length > 0 && (
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

                          {/* Pregunta detonadora de Lidacta (Apertura de conversación) */}
                          {!isPending && (
                            <div className="bg-[#FFF7EF] border border-[#FFD3BF] rounded-2xl p-4 sm:p-5 shadow-xs space-y-2.5">
                              <div className="flex items-center justify-between border-b border-[#FFD3BF]/60 pb-2">
                                <div className="flex items-center gap-2.5">
                                  <div className="w-8 h-8 rounded-xl bg-[#2D1B4E] text-[#F7B538] flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
                                    L
                                  </div>
                                  <div>
                                    <span className="font-heading font-bold text-xs text-[#2D1B4E]">
                                      Lidacta · Apertura de conversación
                                    </span>
                                    <span className="block text-[10px] text-[#BF3A1B] font-semibold">
                                      Pregunta detonadora · {meta.name} ({meta.shortTitle})
                                    </span>
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => toggleVoicePlayback(getStageTriggerQuestion(st, activeMentorship))}
                                  title="Escuchar pregunta detonadora con voz"
                                  className="text-[#BF3A1B] hover:text-[#2D1B4E] text-xs flex items-center gap-1 cursor-pointer px-2.5 py-1 rounded-lg hover:bg-[#FFD3BF]/30 transition-colors"
                                >
                                  <Volume2 className="w-3.5 h-3.5" />
                                  <span className="hidden sm:inline">Escuchar</span>
                                </button>
                              </div>

                              <p className="text-xs sm:text-sm text-[#2D1B4E] font-medium leading-relaxed whitespace-pre-line">
                                {getStageTriggerQuestion(st, activeMentorship)}
                              </p>
                            </div>
                          )}

                          {/* Messages Timeline for this Stage */}
                          {stageMessages.length > 0 ? (
                            <div className="space-y-3 pt-1">
                              <div className="text-[11px] font-bold uppercase tracking-wider text-[#4A3F55]/70 flex items-center gap-1.5">
                                <Sparkles className="w-3.5 h-3.5 text-[#F7B538]" />
                                <span>Intercambios reflexivos de esta etapa:</span>
                              </div>
                              {stageMessages.map(renderSingleMessage)}
                            </div>
                          ) : isPending ? (
                            <div className="p-4 bg-neutral-50 border border-dashed border-[#493447]/20 rounded-xl text-center space-y-1.5 text-xs text-[#4A3F55]/70">
                              <Clock className="w-4 h-4 mx-auto text-[#4A3F55]/50" />
                              <p className="font-medium text-[#2D1B4E]">Esta etapa aún no ha iniciado.</p>
                              <p className="text-[11px]">Se activará automáticamente conforme avances en las etapas previas del acompañamiento.</p>
                            </div>
                          ) : null}

                          {/* Interactive Conversational Input Form for Stage (Etapa 1 to 7) */}
                          {isCurrent && (
                            <div className="bg-white border-2 border-[#F7B538] rounded-2xl p-4 sm:p-5 shadow-sm space-y-3.5 mt-2">
                              <div className="flex items-center justify-between">
                                <label className="text-xs font-heading font-extrabold text-[#2D1B4E] flex items-center gap-2">
                                  <span className="w-2.5 h-2.5 rounded-full bg-[#BF3A1B] animate-pulse" />
                                  <span>Tu respuesta para la {meta.name}:</span>
                                </label>
                                <span className="text-[11px] text-[#4A3F55]/70 flex items-center gap-1">
                                  <Sparkles className="w-3.5 h-3.5 text-[#F7B538]" />
                                  <span>Escribe o habla por nota de voz</span>
                                </span>
                              </div>

                              {/* Área de entrada de texto (Escribir) */}
                              <textarea
                                value={stageInputText}
                                onChange={(e) => {
                                  setStageInputText(e.target.value);
                                  setInputText(e.target.value);
                                }}
                                placeholder={
                                  st === 7
                                    ? 'Escribe tus reflexiones finales o dudas sobre el reporte para Lidacta...'
                                    : 'Escribe aquí tu respuesta, dudas o reflexiones...'
                                }
                                rows={4}
                                disabled={isSendingMessage}
                                className="w-full p-3 sm:p-4 text-xs sm:text-sm text-[#2D1B4E] bg-[#FFF7EF]/50 border border-[#493447]/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#BF3A1B] focus:border-transparent transition-all placeholder:text-[#4A3F55]/50 leading-relaxed disabled:bg-neutral-100"
                              />

                              {/* Controles de Entrada por Voz estilo WhatsApp y Envío */}
                              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-1">
                                {/* Opción de entrada por voz (Micrófono estilo WhatsApp) */}
                                <WhatsAppVoiceRecorder
                                  stageNumber={st}
                                  stageName={meta.name}
                                  mode="stage-card"
                                  disabled={isSendingMessage}
                                  isSending={isSendingMessage}
                                  onTranscript={(text) => {
                                    setStageInputText((prev) => (prev ? `${prev} ${text}` : text));
                                    setInputText((prev) => (prev ? `${prev} ${text}` : text));
                                  }}
                                  onSendDirect={(text) => handleSubmitVoiceDirect(st, text)}
                                />

                                {/* Botón de Envío en Ámbar Impulso (#F7B538) */}
                                <button
                                  type="button"
                                  onClick={() => handleSubmitStageMessage(st)}
                                  disabled={!stageInputText.trim() || isSendingMessage}
                                  className="min-h-[44px] flex items-center justify-center gap-2 px-6 py-2.5 bg-[#F7B538] hover:bg-[#f5a623] text-[#2D1B4E] font-heading font-extrabold text-xs sm:text-sm rounded-xl shadow-md transition-all disabled:opacity-50 cursor-pointer active:scale-95"
                                >
                                  {isSendingMessage ? (
                                    <span>Guardando avance...</span>
                                  ) : (
                                    <>
                                      <span>{st === 7 ? 'Enviar reflexión final' : 'Enviar avance'}</span>
                                      <Send className="w-4 h-4 text-[#2D1B4E]" />
                                    </>
                                  )}
                                </button>
                              </div>
                            </div>
                          )}

                          {/* Stage 4: Roleplay Practice Arena */}
                          {st === 4 && (
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
                                    type="button"
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
                                    type="button"
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
                          {st === 5 && (
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
                                  type="button"
                                  onClick={handleSaveActionPlan}
                                  className="w-full sm:w-auto min-h-[44px] px-4 py-2 bg-[#BF3A1B] text-white font-bold text-xs rounded-xl hover:bg-[#a63014] transition-colors cursor-pointer shadow-xs active:scale-98 flex items-center justify-center"
                                >
                                  Guardar y Activar Recordatorio
                                </button>
                                {!activeMentorship.actionPlan?.isCompleted && (
                                  <button
                                    type="button"
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
                          {st === 6 && (
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
                                  type="button"
                                  onClick={handleSaveLearnings}
                                  className="w-full sm:w-auto min-h-[44px] px-4 py-2 bg-neutral-200 text-[#2D1B4E] font-bold text-xs rounded-xl hover:bg-neutral-300 transition-colors cursor-pointer flex items-center justify-center"
                                >
                                  Guardar Reflexión
                                </button>
                                {activeMentorship.currentStage === 6 && (
                                  <button
                                    type="button"
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
                          {st === 7 && activeMentorship.finalFeedbackReport && (
                            <div className="p-4 sm:p-6 bg-white border-2 border-[#2D1B4E] rounded-2xl shadow-md space-y-5 print:border-none">
                              <div className="border-b border-[#493447]/15 pb-4">
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

                          {/* Stage Footer: Advance CTA or Status */}
                          <div className="pt-3 border-t border-[#493447]/10 flex flex-col sm:flex-row items-center justify-between gap-2.5">
                            {isCurrent && st < 7 && (
                              <>
                                <span className="text-[11px] text-[#4A3F55]/70 flex items-center gap-1">
                                  <Sparkles className="w-3.5 h-3.5 text-[#F7B538]" />
                                  Al cumplir con el objetivo de esta etapa, puedes avanzar al siguiente paso.
                                </span>
                                <button
                                  type="button"
                                  onClick={() => advanceStage()}
                                  disabled={isSendingMessage}
                                  className="w-full sm:w-auto min-h-[40px] px-4 py-2 bg-[#BF3A1B] hover:bg-[#a63014] text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5 active:scale-95 disabled:opacity-50"
                                >
                                  <span>Avanzar a Etapa {st + 1}</span>
                                  <ChevronRight className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}

                            {isPassed && (
                              <div className="w-full flex items-center justify-between text-[11px] text-[#246B2A] font-semibold">
                                <span className="flex items-center gap-1">
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  Etapa completada exitosamente
                                </span>
                                {st < 7 && !isCaseCompleted && (
                                  <button
                                    type="button"
                                    onClick={() => advanceStage(st)}
                                    className="text-xs text-[#BF3A1B] hover:underline font-bold cursor-pointer"
                                  >
                                    Reabrir como etapa activa
                                  </button>
                                )}
                              </div>
                            )}

                            {isPending && (
                              <span className="text-[11px] text-[#4A3F55]/60 italic">
                                Etapa pendiente de inicio
                              </span>
                            )}

                            {st === 7 && (isCurrent || isCaseCompleted) && (
                              <span className="text-xs font-bold text-[#246B2A] flex items-center gap-1">
                                <CheckCircle2 className="w-4 h-4" />
                                Proceso de 7 etapas concluido satisfactoriamente.
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div ref={messagesEndRef} />
            </div>

            {/* Input Bar for Message Exchange (WhatsApp Style Across Stages 1 to 7) */}
            <div className="p-2.5 sm:p-4 bg-white border-t border-[#493447]/10 shrink-0 no-print">
              <form onSubmit={handleSendMessage} className="w-full max-w-screen-xl mx-auto flex items-center gap-2">
                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder={
                    activeMentorship.currentStage === 7
                      ? 'Escribe o habla por voz con Lidacta sobre tu reporte final...'
                      : activeMentorship.currentStage === 4
                      ? 'Responde a la práctica o simula...'
                      : `Escribe tu respuesta para la Etapa ${activeMentorship.currentStage || 1}...`
                  }
                  className="min-h-[44px] flex-1 px-3 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm text-[#2D1B4E] bg-[#FFF7EF]/50 border border-[#493447]/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#BF3A1B] focus:border-transparent transition-all placeholder:text-[#4A3F55]/50 min-w-0 disabled:bg-neutral-100 disabled:text-[#4A3F55]/60"
                  disabled={isSendingMessage}
                />

                {/* WhatsApp Voice Recording Button & Dynamic Audio Bar */}
                <WhatsAppVoiceRecorder
                  stageNumber={activeMentorship.currentStage || 1}
                  stageName={STAGE_META[activeMentorship.currentStage || 1]?.name}
                  mode="bottom-bar"
                  disabled={isSendingMessage}
                  isSending={isSendingMessage}
                  onTranscript={(text) => {
                    setInputText((prev) => (prev ? `${prev} ${text}` : text));
                    setStageInputText((prev) => (prev ? `${prev} ${text}` : text));
                  }}
                  onSendDirect={async (text) => {
                    if (!text.trim() || isSendingMessage) return;
                    setInputText('');
                    setStageInputText('');
                    await sendMessageInActiveSession(text.trim(), activeMentorship.currentStage === 4);
                    setTimeout(() => {
                      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
                    }, 150);
                  }}
                />

                {/* Send Button */}
                <button
                  type="submit"
                  disabled={!inputText.trim() || isSendingMessage}
                  title="Enviar respuesta escrita"
                  className="min-h-[44px] min-w-[44px] p-2.5 bg-[#BF3A1B] hover:bg-[#a63014] text-white rounded-xl shadow-xs transition-colors disabled:opacity-50 cursor-pointer shrink-0 flex items-center justify-center active:scale-95"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </div>
          </div>
        )}
      </main>

      {/* Persistent Floating Shortcut: Asesoría 1:1 */}
      <div className="fixed bottom-5 right-5 sm:bottom-6 sm:right-6 z-50 w-auto max-w-none overflow-visible whitespace-nowrap">
        <button
          type="button"
          onClick={() => setIsMentorModalOpen(true)}
          className="w-auto max-w-none min-w-fit shrink-0 flex items-center gap-2 sm:gap-2.5 px-4 py-2.5 bg-[#BF3A1B] hover:bg-[#a63014] text-white rounded-2xl shadow-xl hover:shadow-2xl border-2 border-white cursor-pointer active:scale-95 transition-all group overflow-visible select-none whitespace-nowrap"
          title="Asesoría 1:1 Directa (Notificación a Tania Padierna)"
        >
          <div className="w-6 h-6 rounded-lg bg-[#F7B538] text-[#2D1B4E] flex items-center justify-center font-bold shrink-0 shadow-xs">
            <UserCheck className="w-4 h-4 text-[#2D1B4E]" />
          </div>
          <span className="font-heading font-extrabold text-xs sm:text-sm tracking-wide text-white whitespace-nowrap inline-block shrink-0">
            Asesoría 1:1
          </span>
        </button>
      </div>

      {/* Interactive New Mentorship / Challenge Registration Modal */}
      <NewMentorshipModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />

      {/* Interactive Request Mentor Modal (Text + Voice) */}
      <RequestMentorModal
        isOpen={isMentorModalOpen}
        onClose={() => setIsMentorModalOpen(false)}
      />
    </div>
  );
};
