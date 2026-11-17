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
import { getStageTriggerQuestion as getSharedStageTriggerQuestion } from '../utils/stageQuestions';
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
  Loader2,
  Save,
  MessageSquare,
  Mail,
} from 'lucide-react';
import { NewMentorshipModal } from './NewMentorshipModal';
import { WhatsAppVoiceRecorder } from './WhatsAppVoiceRecorder';
import { RequestMentorModal } from './RequestMentorModal';

const STAGE_TITLES: Record<StageNumber, string> = {
  1: '1. Detectar qué sucede',
  2: '2. Analizar perspectivas y habilidades',
  3: '3. Diseñar alternativas',
  4: '4. Practicar antes de actuar',
  5: '5. Actuar (Plan de Acción)',
  6: '6. Aprender y reflexionar',
  7: '7. Cierre y retroalimentación',
};

export const STAGE_META: Record<
  StageNumber,
  {
    name: string;
    shortTitle: string;
    subtitle: string;
    objective: string;
    initialDescription: string;
    purpose: string;
  }
> = {
  1: {
    name: 'Etapa 1',
    shortTitle: 'Detectar qué sucede',
    subtitle: 'Comprende mejor la situación que estás enfrentando, sin juicios ni suposiciones.',
    objective: 'Identificar qué ocurre, qué lo provoca y quiénes están involucrados.',
    initialDescription: 'Comprende mejor la situación que estás enfrentando, sin juicios ni suposiciones.',
    purpose: 'Identificar qué ocurre, qué lo provoca y quiénes están involucrados.',
  },
  2: {
    name: 'Etapa 2',
    shortTitle: 'Analizar perspectivas y habilidades',
    subtitle: 'Explora cómo estás viviendo la situación y qué necesitas poner en juego como líder.',
    objective: 'Comprender otros puntos de vista e identificar las habilidades que pueden ayudarte a abordar el reto.',
    initialDescription: 'Explora cómo estás viviendo la situación y qué necesitas poner en juego como líder.',
    purpose: 'Comprender otros puntos de vista e identificar las habilidades que pueden ayudarte a abordar el reto.',
  },
  3: {
    name: 'Etapa 3',
    shortTitle: 'Diseñar alternativas',
    subtitle: 'Explora distintas formas de abordar la situación y encuentra el camino que mejor se adapte a tu realidad.',
    objective: 'Construir alternativas viables para que elijas cómo quieres actuar.',
    initialDescription: 'Explora distintas formas de abordar la situación y encuentra el camino que mejor se adapte a tu realidad.',
    purpose: 'Construir alternativas viables para que elijas cómo quieres actuar.',
  },
  4: {
    name: 'Etapa 4',
    shortTitle: 'Practicar antes de actuar',
    subtitle: 'Prepárate para afrontar la situación practicando una conversación o escenario real.',
    objective: 'Ensayar cómo actuar en un espacio seguro antes de llevarlo a la práctica.',
    initialDescription: 'Prepárate para afrontar la situación practicando una conversación o escenario real.',
    purpose: 'Ensayar cómo actuar en un espacio seguro antes de llevarlo a la práctica.',
  },
  5: {
    name: 'Etapa 5',
    shortTitle: 'Actuar (Plan de Acción)',
    subtitle: 'Convierte lo que has trabajado en una acción concreta que puedas llevar a la práctica.',
    objective: 'Definir qué harás, cuándo y con quién para avanzar en la situación.',
    initialDescription: 'Convierte lo que has trabajado en una acción concreta que puedas llevar a la práctica.',
    purpose: 'Definir qué harás, cuándo y con quién para avanzar en la situación.',
  },
  6: {
    name: 'Etapa 6',
    shortTitle: 'Aprender y reflexionar',
    subtitle: 'Revisa lo que sucedió al poner en práctica tu decisión y descubre qué puedes aprender de la experiencia.',
    objective: 'Reconocer qué funcionó, qué puedes ajustar y qué te llevas para futuros retos.',
    initialDescription: 'Revisa lo que sucedió al poner en práctica tu decisión y descubre qué puedes aprender de la experiencia.',
    purpose: 'Reconocer qué funcionó, qué puedes ajustar y qué te llevas para futuros retos.',
  },
  7: {
    name: 'Etapa 7',
    shortTitle: 'Cierre y retroalimentación',
    subtitle: 'Integra tus avances y reconoce las habilidades que has puesto en práctica durante este proceso.',
    objective: 'Identificar tus aprendizajes, fortalezas y oportunidades para seguir desarrollándote como líder.',
    initialDescription: 'Integra tus avances y reconoce las habilidades que has puesto en práctica durante este proceso.',
    purpose: 'Identificar tus aprendizajes, fortalezas y oportunidades para seguir desarrollándote como líder.',
  },
};

export function isStageGoalMet(session: MentorshipSession | null, stage: StageNumber): boolean {
  if (!session) return false;
  if (session.stageReadyToAdvance === stage) return true;
  if (session.stageReadyToAdvance === null && stage !== 4) return false;

  const stageMessages = (session.messages || [])
    .filter((m) => (m.stage || 1) === stage)
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  if (stage === 1) {
    let synthesisIdx = -1;
    for (let i = 0; i < stageMessages.length; i++) {
      const msg = stageMessages[i];
      if (msg.sender === 'lidacta') {
        const txt = msg.text.toLowerCase();
        const hasFacts = txt.includes('hecho') || txt.includes('situación') || txt.includes('situacion');
        const hasDilemma = txt.includes('dilema');
        const hasImpact = txt.includes('impacto') || txt.includes('reto principal');
        if (hasFacts && hasDilemma && hasImpact) {
          synthesisIdx = i;
          break;
        }
      }
    }

    if (synthesisIdx === -1) return false;

    let leaderAckIdx = -1;
    for (let j = synthesisIdx + 1; j < stageMessages.length; j++) {
      const msg = stageMessages[j];
      if (msg.sender === 'leader') {
        const leaderTxt = msg.text.toLowerCase().trim();
        const isCorrection = [
          'te confundiste', 'te confundes', 'eso no es lo que me preocupa',
          'no es lo que me preocupa', 'no me preocupa eso', 'no dije eso',
          'te equivocaste', 'no me entendiste', 'entendiste mal', 'no es por ahí', 'no es por ahi'
        ].some((t) => leaderTxt.includes(t));

        if (!isCorrection && leaderTxt.length > 0) {
          leaderAckIdx = j;
          break;
        }
      }
    }

    if (leaderAckIdx === -1) return false;

    const hasRatification = stageMessages.slice(leaderAckIdx + 1).some((m) => m.sender === 'lidacta');
    return hasRatification;
  }

  if (stage === 2) {
    const hasSkills = Array.isArray(session.identifiedSkills) && session.identifiedSkills.length > 0;
    if (!hasSkills) return false;

    const lidactaSkillIdx = stageMessages.findIndex(
      (m) => m.sender === 'lidacta' && (m.text.toLowerCase().includes('habilidad') || m.text.toLowerCase().includes('competencia'))
    );
    if (lidactaSkillIdx !== -1) {
      const nextLeaderMsg = stageMessages.slice(lidactaSkillIdx + 1).find((m) => m.sender === 'leader');
      if (nextLeaderMsg) {
        const txt = nextLeaderMsg.text.toLowerCase();
        const isRejection = ['no creo', 'no considero', 'no es esa', 'te equivocas'].some((t) => txt.includes(t));
        if (!isRejection && txt.length > 0) return true;
      }
    }
    return false;
  }

  if (stage === 3) {
    const hasAlt =
      (Array.isArray(session.suggestedAlternatives) && session.suggestedAlternatives.length > 0) ||
      Boolean(session.chosenAlternative) ||
      stageMessages.some((m) => m.sender === 'lidacta' && (m.text.toLowerCase().includes('alternativa') || m.text.toLowerCase().includes('opción') || m.text.toLowerCase().includes('opcion') || m.text.toLowerCase().includes('camino')));

    if (!hasAlt) return false;

    const lidactaAltIdx = stageMessages.findIndex(
      (m) => m.sender === 'lidacta' && (m.text.toLowerCase().includes('alternativa') || m.text.toLowerCase().includes('opción') || m.text.toLowerCase().includes('opcion') || m.text.toLowerCase().includes('camino'))
    );
    if (lidactaAltIdx !== -1) {
      const nextLeaderMsg = stageMessages.slice(lidactaAltIdx + 1).find((m) => m.sender === 'leader');
      if (nextLeaderMsg && nextLeaderMsg.text.trim().length > 0) {
        return true;
      }
    }
    return false;
  }

  if (stage === 4) {
    if (session.stageReadyToAdvance === 4) return true;
    const hasPracticeConclusion = stageMessages.some((m) => {
      if (m.sender !== 'lidacta') return false;
      const txt = (m.text || '').toLowerCase();
      return (
        txt.includes('etapa 5') ||
        txt.includes('plan de acción') ||
        txt.includes('plan de accion') ||
        txt.includes('paso formal') ||
        txt.includes('concluir la práctica') ||
        txt.includes('concluir la practica') ||
        txt.includes('concluido la práctica') ||
        txt.includes('concluido la practica') ||
        txt.includes('retroalimentación') ||
        txt.includes('retroalimentacion')
      );
    });
    const hasLeaderResponse = stageMessages.some((m) => m.sender === 'leader');
    if (hasPracticeConclusion && hasLeaderResponse) {
      return true;
    }
    return false;
  }

  return false;
}

export const LeaderView: React.FC = () => {
  const {
    currentUser,
    allUsers,
    mentorships,
    activeMentorship,
    setActiveMentorshipId,
    startNewMentorship,
    sendMessageInActiveSession,
    advanceStage,
    setStageReadyToAdvance,
    updateActionPlan,
    markActionCompleted,
    saveLearnings,
    isSendingMessage,
    showToast,
    retrySendFinalReportEmail,
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
  const [audioState, setAudioState] = useState<{ id: string | null; status: 'idle' | 'loading' | 'playing' }>({
    id: null,
    status: 'idle',
  });
  const [isListeningMic, setIsListeningMic] = useState(false);
  const [speechRecognizer, setSpeechRecognizer] = useState<{ start: () => void; stop: () => void } | null>(null);
  const [isListeningOnboardingMic, setIsListeningOnboardingMic] = useState(false);
  const [onboardingSpeechRecognizer, setOnboardingSpeechRecognizer] = useState<{ start: () => void; stop: () => void } | null>(null);
  const onboardingBaseTextRef = useRef<string>('');
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [newChallengePriority, setNewChallengePriority] = useState<'alta' | 'media' | 'baja'>('media');
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);
  const [mobileHomeTab, setMobileHomeTab] = useState<'prompt' | 'list'>('prompt');

  // Stage 5 action plan state form
  const [actionWhat, setActionWhat] = useState('');
  const [actionWhen, setActionWhen] = useState('');
  const [actionWithWhom, setActionWithWhom] = useState('');
  const [actionHow, setActionHow] = useState('');
  const [actionCare, setActionCare] = useState('');
  const [actionShareWithHR, setActionShareWithHR] = useState(false);
  const [justSavedActionPlan, setJustSavedActionPlan] = useState(false);
  const [isSavingActionPlan, setIsSavingActionPlan] = useState(false);
  const [isCommitmentConfirmed, setIsCommitmentConfirmed] = useState(false);
  const [stage5CommentText, setStage5CommentText] = useState('');

  // Stage 5 validation: requires all 5 fields to have non-empty text (.trim().length > 0)
  const isActionPlanComplete =
    actionWhat.trim().length > 0 &&
    actionWhen.trim().length > 0 &&
    actionWithWhom.trim().length > 0 &&
    actionHow.trim().length > 0 &&
    actionCare.trim().length > 0;

  const completedFieldsCount = [
    actionWhat.trim().length > 0,
    actionWhen.trim().length > 0,
    actionWithWhom.trim().length > 0,
    actionHow.trim().length > 0,
    actionCare.trim().length > 0,
  ].filter(Boolean).length;

  // Check if action plan was previously saved in the session
  const hasSavedActionPlan = Boolean(
    activeMentorship?.actionPlan?.what?.trim() &&
    activeMentorship?.actionPlan?.when?.trim() &&
    activeMentorship?.actionPlan?.withWhom?.trim() &&
    activeMentorship?.actionPlan?.how?.trim() &&
    activeMentorship?.actionPlan?.careReminders?.trim()
  );

  // Stage 6 learnings state form
  const [learningWhatHappened, setLearningWhatHappened] = useState('');
  const [learningWhatWorked, setLearningWhatWorked] = useState('');
  const [learningWhatDidnt, setLearningWhatDidnt] = useState('');
  const [learningInsights, setLearningInsights] = useState('');
  const [learningFuture, setLearningFuture] = useState('');
  const [learningShareWithHR, setLearningShareWithHR] = useState('');
  const [justSavedLearnings, setJustSavedLearnings] = useState(false);
  const [isSavingLearnings, setIsSavingLearnings] = useState(false);

  // Stage 6 validation: requires that the 3 fields have non-empty text (.trim().length > 0)
  const isLearningsValid =
    learningWhatHappened.trim().length > 0 &&
    learningWhatWorked.trim().length > 0 &&
    learningInsights.trim().length > 0;

  // Check if learnings were previously saved in the session
  const hasSavedLearnings = Boolean(
    activeMentorship?.learnings?.whatHappened ||
    activeMentorship?.learnings?.whatWorked ||
    activeMentorship?.learnings?.insights
  );

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

  // Todas las etapas inician cerradas / colapsadas por defecto al cargar o seleccionar caso
  useEffect(() => {
    setOpenStages({
      1: false,
      2: false,
      3: false,
      4: false,
      5: false,
      6: false,
      7: false,
    });
  }, [activeMentorship?.id]);

  const [reopenedStages, setReopenedStages] = useState<Record<number, boolean>>({});
  const [isAdvancingStage, setIsAdvancingStage] = useState(false);

  useEffect(() => {
    setReopenedStages({});
  }, [activeMentorship?.id, activeMentorship?.currentStage]);

  const handleReopenConversation = (st: StageNumber) => {
    setReopenedStages((prev) => ({ ...prev, [st]: true }));
    setStageReadyToAdvance(null);
  };

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

      const onboardingRec = createSpeechRecognizer(
        (transcript, isFinal) => {
          const cleanTranscript = transcript.replace(/\s+/g, ' ').trim();
          if (!cleanTranscript) return;

          if (isFinal) {
            const updatedBase = onboardingBaseTextRef.current
              ? `${onboardingBaseTextRef.current} ${cleanTranscript}`.replace(/\s+/g, ' ').trim()
              : cleanTranscript;
            onboardingBaseTextRef.current = updatedBase;
            setNewChallengePrompt(updatedBase);
          } else {
            const liveText = onboardingBaseTextRef.current
              ? `${onboardingBaseTextRef.current} ${cleanTranscript}`.replace(/\s+/g, ' ').trim()
              : cleanTranscript;
            setNewChallengePrompt(liveText);
          }
        },
        () => setIsListeningOnboardingMic(false)
      );
      setOnboardingSpeechRecognizer(onboardingRec);
    }
  }, []);

  const lastLoadedMentorshipIdRef = useRef<string | null>(null);

  // Sync stage forms with active mentorship (only on session change so that dialogue updates do not wipe form edits)
  useEffect(() => {
    if (activeMentorship) {
      setStageInputText('');
      const isNewSession = lastLoadedMentorshipIdRef.current !== activeMentorship.id;
      lastLoadedMentorshipIdRef.current = activeMentorship.id;

      if (isNewSession) {
        if (activeMentorship.actionPlan) {
          setActionWhat(activeMentorship.actionPlan.what || '');
          setActionWhen(activeMentorship.actionPlan.when || '');
          setActionWithWhom(activeMentorship.actionPlan.withWhom || '');
          setActionHow(activeMentorship.actionPlan.how || '');
          setActionCare(activeMentorship.actionPlan.careReminders || '');
          setActionShareWithHR(Boolean(activeMentorship.actionPlan.shareWithHR));
          setIsCommitmentConfirmed(Boolean(
            activeMentorship.actionPlan.isCommitmentConfirmed ||
            activeMentorship.actionPlan.isCompleted
          ));
        } else {
          setActionWhat('');
          setActionWhen('');
          setActionWithWhom('');
          setActionHow('');
          setActionCare('');
          setActionShareWithHR(false);
          setIsCommitmentConfirmed(false);
        }
        setJustSavedActionPlan(false);

        if (activeMentorship.learnings) {
          setLearningWhatHappened(activeMentorship.learnings.whatHappened || '');
          setLearningWhatWorked(activeMentorship.learnings.whatWorked || '');
          setLearningWhatDidnt(activeMentorship.learnings.whatDidnt || '');
          setLearningInsights(activeMentorship.learnings.insights || '');
          setLearningFuture(activeMentorship.learnings.futureAdjustments || '');
          setLearningShareWithHR(activeMentorship.learnings.sharedLearningWithHR || '');
        } else {
          setLearningWhatHappened('');
          setLearningWhatWorked('');
          setLearningWhatDidnt('');
          setLearningInsights('');
          setLearningFuture('');
          setLearningShareWithHR('');
        }
      }
    }
  }, [activeMentorship?.id]);

  // Preserve Stage 5 optional comments draft per mentorship session
  useEffect(() => {
    if (activeMentorship?.id) {
      try {
        const saved = localStorage.getItem(`lidacta_stage5_comment_${activeMentorship.id}`) || '';
        setStage5CommentText(saved);
      } catch {
        setStage5CommentText('');
      }
    } else {
      setStage5CommentText('');
    }
  }, [activeMentorship?.id]);

  const handleStage5CommentChange = (text: string) => {
    setStage5CommentText(text);
    if (activeMentorship?.id) {
      try {
        if (text) {
          localStorage.setItem(`lidacta_stage5_comment_${activeMentorship.id}`, text);
        } else {
          localStorage.removeItem(`lidacta_stage5_comment_${activeMentorship.id}`);
        }
      } catch {
        // Ignore localStorage errors
      }
    }
  };

  const handleSendStage5Comment = async () => {
    if (!stage5CommentText.trim() || isSendingMessage) return;
    const textToSend = stage5CommentText.trim();
    setStage5CommentText('');
    if (activeMentorship?.id) {
      try {
        localStorage.removeItem(`lidacta_stage5_comment_${activeMentorship.id}`);
      } catch {
        // Ignore localStorage errors
      }
    }
    await sendMessageInActiveSession(textToSend, false);
  };

  const handleSendVoiceDirectStage5 = async (text: string) => {
    if (!text.trim() || isSendingMessage) return;
    setStage5CommentText('');
    if (activeMentorship?.id) {
      try {
        localStorage.removeItem(`lidacta_stage5_comment_${activeMentorship.id}`);
      } catch {
        // Ignore localStorage errors
      }
    }
    await sendMessageInActiveSession(text.trim(), false);
  };

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

  useEffect(() => {
    if (activeScrollContainerRef.current) {
      activeScrollContainerRef.current.scrollTop = activeScrollContainerRef.current.scrollHeight;
    }
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [activeMentorship?.messages?.length, isSendingMessage]);

  const toggleOnboardingMic = () => {
    if (isListeningOnboardingMic) {
      onboardingSpeechRecognizer?.stop();
      setIsListeningOnboardingMic(false);
    } else {
      onboardingBaseTextRef.current = newChallengePrompt.replace(/\s+/g, ' ').trim();
      if (onboardingSpeechRecognizer) {
        onboardingSpeechRecognizer.start();
      }
      setIsListeningOnboardingMic(true);
    }
  };

  const handleStartChallenge = async () => {
    if (!newChallengePrompt.trim()) return;
    if (isListeningOnboardingMic && onboardingSpeechRecognizer) {
      onboardingSpeechRecognizer.stop();
      setIsListeningOnboardingMic(false);
    }
    setIsStartingNew(true);
    await startNewMentorship(newChallengePrompt, { priority: newChallengePriority });
    setNewChallengePrompt('');
    setNewChallengePriority('media');
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
    setReopenedStages((prev) => ({ ...prev, [st]: false }));
    setStageInputText('');
    setInputText('');
    if (isListeningMic && speechRecognizer) {
      speechRecognizer.stop();
      setIsListeningMic(false);
    }
    await sendMessageInActiveSession(textToSend, st === 4);
  };

  const handleSubmitVoiceDirect = async (st: StageNumber, text: string) => {
    if (!text.trim() || isSendingMessage) return;
    setReopenedStages((prev) => ({ ...prev, [st]: false }));
    setStageInputText('');
    setInputText('');
    await sendMessageInActiveSession(text.trim(), st === 4);
  };

  const toggleVoicePlayback = (text: string, messageId?: string) => {
    const targetId = messageId || text.slice(0, 30);
    if (audioState.id === targetId && audioState.status !== 'idle') {
      stopSpeaking();
      setIsPlayingAudio(false);
      setAudioState({ id: null, status: 'idle' });
    } else {
      stopSpeaking();
      setIsPlayingAudio(true);
      setAudioState({ id: targetId, status: 'loading' });

      speakText(
        text,
        () => {
          setIsPlayingAudio(false);
          setAudioState({ id: null, status: 'idle' });
        },
        () => {
          setIsPlayingAudio(true);
          setAudioState({ id: targetId, status: 'playing' });
        },
        (loading) => {
          if (loading) {
            setAudioState({ id: targetId, status: 'loading' });
          }
        }
      );
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
    return getSharedStageTriggerQuestion(st, mentorship, currentUser?.name);
  };

  const handleSaveActionPlan = (silent: boolean = false): boolean => {
    if (!activeMentorship) return false;
    setIsSavingActionPlan(true);

    const plan: MentorshipActionPlan = {
      what: actionWhat.trim(),
      when: actionWhen.trim(),
      withWhom: actionWithWhom.trim(),
      how: actionHow.trim(),
      careReminders: actionCare.trim(),
      cleanedAutoGeneratedV1: activeMentorship.actionPlan?.cleanedAutoGeneratedV1,
      isCommitmentConfirmed: isCommitmentConfirmed,
      shareWithHR: actionShareWithHR,
      shareActionPlanWithHR: actionShareWithHR,
      actionPlanShared: actionShareWithHR,
      isCompleted: activeMentorship.actionPlan?.isCompleted || false,
    };

    updateActionPlan(plan);
    setIsSavingActionPlan(false);
    setJustSavedActionPlan(true);
    setTimeout(() => setJustSavedActionPlan(false), 3000);

    if (!silent) {
      if (isActionPlanComplete) {
        showToast('Plan de acción guardado exitosamente. Marca la casilla de confirmación para habilitar el avance.', 'success');
      } else {
        showToast('Borrador guardado. Recuerda completar los 5 campos obligatorios para avanzar a la Etapa 6.', 'info');
      }
    }
    return true;
  };

  const handleAdvanceToStage6 = () => {
    if (!isActionPlanComplete) {
      showToast(
        'Por favor completa los 5 campos obligatorios del Plan de Acción (¿Qué?, ¿Cuándo?, ¿Con quién?, ¿Cómo? y ¿Qué vas a cuidar?) antes de avanzar.',
        'warning'
      );
      return;
    }
    if (!isCommitmentConfirmed) {
      showToast(
        'Por favor confirma tu compromiso personal marcando la casilla de confirmación antes de avanzar.',
        'warning'
      );
      return;
    }
    handleSaveActionPlan(true);
    markActionCompleted();
    advanceStage(6);
    showToast('¡Compromiso registrado! Avanzando a Etapa 6: Aprender y reflexionar.', 'success');
  };

  const handleSaveLearnings = () => {
    if (!isLearningsValid) return;
    setIsSavingLearnings(true);

    try {
      saveLearnings({
        whatHappened: learningWhatHappened.trim(),
        whatWorked: learningWhatWorked.trim(),
        whatDidnt: learningWhatDidnt.trim() || '',
        insights: learningInsights.trim(),
        futureAdjustments: learningFuture.trim() || '',
        sharedLearningWithHR: learningShareWithHR.trim(),
      });

      setJustSavedLearnings(true);
      showToast('¡Reflexión guardada exitosamente! Tu aprendizaje ha sido registrado.', 'success');

      setTimeout(() => {
        setJustSavedLearnings(false);
      }, 3500);
    } catch (err) {
      console.error('Error saving learnings:', err);
      showToast('Hubo un error al guardar tu reflexión. Intenta de nuevo.', 'error');
    } finally {
      setIsSavingLearnings(false);
    }
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
                {audioState.id === msg.id && audioState.status === 'loading' ? (
                  <div className="flex items-center gap-1.5 text-xs text-[#BF3A1B] font-medium min-h-[32px] px-2 py-0.5 bg-[#FFD3BF]/30 rounded-lg animate-pulse">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-[#BF3A1B]" />
                    <span className="text-[11px] font-semibold">Cargando audio...</span>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => toggleVoicePlayback(msg.text, msg.id)}
                    title="Escuchar intervención con la voz clonada de Lidacta Mentora"
                    className="text-[#BF3A1B] hover:text-[#2D1B4E] text-xs flex items-center gap-1 cursor-pointer min-h-[32px] px-2 py-0.5 rounded-lg hover:bg-[#FFD3BF]/20 transition-colors"
                  >
                    {audioState.id === msg.id && audioState.status === 'playing' ? (
                      <>
                        <VolumeX className="w-3.5 h-3.5 text-[#BF3A1B] animate-pulse" />
                        <span className="hidden sm:inline font-bold">Pausar</span>
                      </>
                    ) : (
                      <>
                        <Volume2 className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Escuchar</span>
                      </>
                    )}
                  </button>
                )}
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
    <div className="flex-1 flex overflow-hidden relative w-full max-w-full">
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
      <main ref={mainContainerRef} className="flex-1 flex flex-col bg-[#FFF7EF] overflow-y-auto overflow-x-hidden min-w-0 w-full max-w-full">
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
              <div className="bg-white border border-[#493447]/15 rounded-2xl overflow-hidden shadow-sm">
                <div className="p-5 sm:p-8 space-y-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#BF3A1B]">
                    Bienvenido, {currentUser.name}
                  </span>
                  <h1 className="font-heading font-extrabold text-xl sm:text-2xl md:text-3xl text-[#2D1B4E] leading-tight">
                    ¿Qué situación de liderazgo enfrentas hoy?
                  </h1>
                  <p className="text-xs sm:text-sm text-[#4A3F55] leading-relaxed">
                    Lidacta es tu espacio seguro de mentoría para analizar y resolver retos reales con tu equipo en {currentUser.companyName}.
                  </p>
                </div>
              </div>

              {/* In Primer Plano: Entrada obligatoria de situación o reto */}
              <div className="bg-white border-2 border-[#BF3A1B]/30 rounded-2xl p-4 sm:p-8 shadow-md space-y-5">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-[#FFD3BF] text-[#BF3A1B] flex items-center justify-center font-bold shrink-0">
                    <Compass className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="font-heading font-bold text-base sm:text-lg text-[#2D1B4E]">
                      Plantea tu situación real, reto o problemática
                    </h2>
                    <p className="text-xs text-[#4A3F55]/80">
                      Cuéntame con detalle en qué situación necesitas apoyo.
                    </p>
                  </div>
                </div>

                <div className="relative">
                  <textarea
                    value={newChallengePrompt}
                    onChange={(e) => setNewChallengePrompt(e.target.value)}
                    placeholder="Escribe aquí o usa el micrófono para dictar tu situación..."
                    rows={4}
                    className="w-full p-3.5 sm:p-4 pr-14 text-xs sm:text-sm text-[#2D1B4E] bg-[#FFF7EF]/50 border border-[#493447]/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#BF3A1B] focus:border-transparent transition-all placeholder:text-[#4A3F55]/50 leading-relaxed"
                  />
                  <button
                    type="button"
                    onClick={toggleOnboardingMic}
                    title={isListeningOnboardingMic ? 'Detener dictado por voz' : 'Dictar por voz a Lidacta'}
                    aria-label={isListeningOnboardingMic ? 'Detener dictado por voz' : 'Dictar por voz a Lidacta'}
                    className={`absolute right-3 bottom-3 w-10 h-10 rounded-xl flex items-center justify-center transition-all cursor-pointer shadow-xs ${
                      isListeningOnboardingMic
                        ? 'bg-[#BF3A1B] text-white animate-pulse ring-4 ring-[#BF3A1B]/20'
                        : 'bg-white hover:bg-[#FFD3BF]/40 text-[#2D1B4E] border border-[#493447]/15'
                    }`}
                  >
                    {isListeningOnboardingMic ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4 text-[#BF3A1B]" />}
                  </button>
                </div>

                {isListeningOnboardingMic && (
                  <div className="flex items-center gap-2 text-xs text-[#BF3A1B] font-semibold bg-[#FFF7EF] px-3 py-2 rounded-lg border border-[#BF3A1B]/20">
                    <span className="w-2 h-2 rounded-full bg-[#BF3A1B] animate-ping" />
                    <span>Escuchando... habla con naturalidad para describir tu situación.</span>
                  </div>
                )}

                {/* Selección directa de Nivel de Urgencia o Prioridad */}
                <div className="space-y-2.5 pt-1">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-[#2D1B4E]">
                    NIVEL DE URGENCIAS O PRIORIDAD
                  </label>
                  <div className="grid grid-cols-3 gap-2.5">
                    {[
                      { id: 'alta' as const, icon: '⚠️', label: 'Alta', desc: 'Crítico. Resolver ahora mismo.', activeClass: 'bg-[#FFE5E5] border-[#BF3A1B] text-[#BF3A1B]' },
                      { id: 'media' as const, icon: '🕒', label: 'Media', desc: 'Resolver durante el día.', activeClass: 'bg-[#FFF3D6] border-[#F7B538] text-[#2D1B4E]' },
                      { id: 'baja' as const, icon: '✅', label: 'Baja', desc: 'Mejora continua', activeClass: 'bg-[#E2F7E1] border-[#246B2A] text-[#246B2A]' },
                    ].map((p) => {
                      const isSelected = newChallengePriority === p.id;
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => setNewChallengePriority(p.id)}
                          className={`p-3 rounded-xl border-2 text-left transition-all cursor-pointer ${
                            isSelected
                              ? `${p.activeClass} shadow-xs`
                              : 'bg-[#FFF7EF]/40 border-[#493447]/15 text-[#4A3F55] hover:border-[#493447]/30'
                          }`}
                        >
                          <div className="flex items-center gap-1.5 font-heading font-bold text-xs sm:text-sm">
                            <span>{p.icon}</span>
                            <span>{p.label}</span>
                          </div>
                          <div className="text-[10px] sm:text-[11px] opacity-85 mt-0.5 leading-snug">{p.desc}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    onClick={handleStartChallenge}
                    disabled={!newChallengePrompt.trim() || isStartingNew}
                    className="w-full sm:w-auto min-h-[44px] flex items-center justify-center gap-2 px-6 py-3 bg-[#F7B538] hover:bg-[#F5A623] text-[#2D1B4E] font-heading font-extrabold text-sm rounded-xl shadow-md transition-all disabled:opacity-50 cursor-pointer active:scale-95"
                  >
                    {isStartingNew ? (
                      <span>Iniciando mentoría con Lidacta...</span>
                    ) : (
                      <>
                        <span>Iniciar Acompañamiento →</span>
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
                    { num: 1, title: 'Detectar qué sucede', desc: 'Comprende mejor la situación que estás enfrentando, sin juicios ni suposiciones.' },
                    { num: 2, title: 'Analizar perspectivas y habilidades', desc: 'Explora cómo estás viviendo la situación y qué necesitas poner en juego como líder.' },
                    { num: 3, title: 'Diseñar alternativas', desc: 'Explora distintas formas de abordar la situación y encuentra el camino que mejor se adapte a tu realidad.' },
                    { num: 4, title: 'Practicar antes de actuar', desc: 'Prepárate para afrontar la situación practicando una conversación o escenario real.' },
                    { num: 5, title: 'Actuar (Plan de Acción)', desc: 'Convierte lo que has trabajado en una acción concreta que puedas llevar a la práctica.' },
                    { num: 6, title: 'Aprender y reflexionar', desc: 'Revisa lo que sucedió al poner en práctica tu decisión y descubre qué puedes aprender de la experiencia.' },
                    { num: 7, title: 'Cierre y retroalimentación', desc: 'Integra tus avances y reconoce las habilidades que has puesto en práctica durante este proceso.' },
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
            {/* Top Bar of Active Mentorship: Balanced Desktop & Mobile Header */}
            <div className="p-3 sm:p-4 bg-white border-b border-[#493447]/10 shrink-0">
              <div className="w-full max-w-screen-xl mx-auto flex items-center justify-between gap-4">
                {/* Izquierda: Botón Casos (móvil) + Cuadro de leyenda confidencial expandido (flex-1) */}
                <div className="flex-1 min-w-0 flex items-center gap-2.5">
                  <button
                    onClick={() => setShowMobileSidebar(true)}
                    className="md:hidden min-h-[44px] flex items-center gap-1.5 px-3 py-2 bg-[#FFF7EF] hover:bg-[#FFD3BF]/40 border border-[#493447]/15 rounded-xl text-xs font-bold text-[#2D1B4E] cursor-pointer shrink-0 active:scale-95 shadow-xs transition-colors"
                    title="Ver lista de acompañamientos"
                  >
                    <Menu className="w-4 h-4 text-[#BF3A1B]" />
                    <span>Casos</span>
                  </button>

                  <div className="flex-1 min-w-0 flex items-center gap-2 px-3.5 py-2.5 bg-[#FFF7EF] border border-[#FFD3BF] rounded-xl text-xs sm:text-sm text-[#2D1B4E] font-medium leading-snug shadow-2xs">
                    <ShieldCheck className="w-4 h-4 text-[#BF3A1B] shrink-0" />
                    <span className="line-clamp-2 sm:line-clamp-none">
                      Conversaciones privadas y confidenciales. Recursos Humanos no tiene acceso a tus conversaciones con Lidacta. Tú decides qué acciones y aprendizajes deseas compartir con tu organización.
                    </span>
                  </div>
                </div>

                {/* Derecha: Botones de Acción alineados a la derecha de esa misma fila */}
                <div className="flex items-center gap-2.5 shrink-0">
                  {/* Botón Asesoría 1:1 */}
                  <button
                    onClick={() => setIsMentorModalOpen(true)}
                    className="min-h-[44px] flex items-center gap-1.5 px-3 sm:px-3.5 py-2 bg-[#FFF7EF] hover:bg-[#FFD3BF]/40 border border-[#493447]/15 rounded-xl text-xs font-bold text-[#2D1B4E] cursor-pointer shrink-0 active:scale-95 shadow-xs transition-colors"
                    title="Solicitar Asesoría 1:1 directa (Acompañamiento personal directivo con Tania Padierna)"
                  >
                    <UserCheck className="w-4 h-4 text-[#BF3A1B]" />
                    <span className="hidden sm:inline">Asesoría 1:1</span>
                    <span className="sm:hidden">Asesor 1:1</span>
                  </button>

                  {/* Botón + Nuevo acompañamiento */}
                  <button
                    onClick={() => setIsModalOpen(true)}
                    className="min-h-[44px] flex items-center gap-1.5 px-3 sm:px-3.5 py-2 bg-[#F7B538] hover:bg-[#F5A623] text-[#2D1B4E] text-xs font-heading font-extrabold rounded-xl shadow-xs transition-colors cursor-pointer shrink-0 active:scale-95"
                    title="Registrar nuevo caso o reto"
                  >
                    <Plus className="w-4 h-4 text-[#2D1B4E]" />
                    <span className="hidden sm:inline">+ Nuevo acompañamiento</span>
                    <span className="sm:hidden">+ Nuevo</span>
                  </button>

                  {activeMentorship.currentStage === 7 && (
                    <span className="text-xs font-bold text-[#246B2A] bg-[#E2F7E1] px-3 py-2 rounded-xl flex items-center gap-1 min-h-[44px] shrink-0">
                      <CheckCircle2 className="w-4 h-4" />
                      <span className="hidden sm:inline">Proceso Concluido</span>
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
              {/* Texto Descriptivo: Encabezado de sección por debajo de los botones de acción y por encima del historial (simple, color marrón, sin contorno ni fondo) */}
              <div className="pt-0.5">
                <h2 className="text-xs sm:text-sm font-heading font-extrabold text-[#493447] tracking-wider uppercase">
                  Mentorías en Proceso ↓
                </h2>
              </div>

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
                  const isStageConclusionReady =
                    isCurrent &&
                    st <= 4 &&
                    !reopenedStages[st] &&
                    isStageGoalMet(activeMentorship, st);
                  const isOpen = !!openStages[st];
                  const meta = STAGE_META[st];
                  const allMessages = [...activeMentorship.messages].filter((m) => (m.stage || 1) === st);
                  if (!isPending && allMessages.length === 0) {
                    allMessages.push({
                      id: `trigger_${activeMentorship.id}_${st}`,
                      sender: 'lidacta',
                      text: getStageTriggerQuestion(st, activeMentorship),
                      timestamp: new Date(Date.now() - 1000).toISOString(),
                      stage: st,
                    });
                  }
                  const sortedMessages = allMessages.sort(
                    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
                  );

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
                        className={`w-full text-left p-3.5 sm:p-4.5 cursor-pointer transition-colors ${
                          isCurrent
                            ? 'bg-[#FFF7EF]/90 hover:bg-[#FFF7EF]'
                            : isPassed
                            ? 'hover:bg-[#E2F7E1]/20'
                            : 'hover:bg-neutral-50'
                        }`}
                        aria-expanded={isOpen}
                      >
                        {/* Mobile layout (< sm / 640px): 2 stacked rows for 100% description visibility */}
                        <div className="sm:hidden space-y-2 w-full">
                          {/* Fila superior: Título de etapa a la izquierda y Badge de estado + Chevron a la derecha */}
                          <div className="flex items-center justify-between gap-2 w-full">
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              <div
                                className={`w-7 h-7 rounded-lg flex items-center justify-center font-heading font-extrabold text-xs shrink-0 transition-transform ${
                                  isCurrent
                                    ? 'bg-[#F7B538] text-[#2D1B4E] shadow-xs'
                                    : isPassed
                                    ? 'bg-[#E2F7E1] text-[#246B2A]'
                                    : 'bg-neutral-100 text-[#4A3F55]/60'
                                }`}
                              >
                                {isPassed ? <CheckCircle2 className="w-3.5 h-3.5 text-[#246B2A]" /> : st}
                              </div>
                              <span className="font-heading font-extrabold text-xs text-[#2D1B4E] leading-snug">
                                {meta.name}: {meta.shortTitle}
                              </span>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              {isPassed && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold bg-[#E2F7E1] text-[#246B2A] border border-[#246B2A]/20">
                                  <CheckCircle2 className="w-3 h-3 shrink-0" />
                                  <span>Completada</span>
                                </span>
                              )}
                              {isCurrent && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-extrabold bg-[#F7B538] text-[#2D1B4E] shadow-xs">
                                  <span className="w-1.5 h-1.5 rounded-full bg-[#2D1B4E] animate-ping shrink-0" />
                                  <span>En curso</span>
                                </span>
                              )}
                              {isPending && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-medium bg-neutral-100 text-[#4A3F55]/60 border border-neutral-200">
                                  Pendiente
                                </span>
                              )}
                              <div className="w-6 h-6 rounded-lg flex items-center justify-center text-[#4A3F55] shrink-0">
                                {isOpen ? (
                                  <ChevronUp className="w-4 h-4 text-[#BF3A1B]" />
                                ) : (
                                  <ChevronDown className="w-4 h-4 text-[#4A3F55]" />
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Fila inferior: Descripción completa ocupando el 100% del ancho horizontal disponible */}
                          <p className="w-full text-xs text-[#4A3F55]/85 block mt-1 leading-relaxed pl-0.5">
                            {meta.subtitle}
                          </p>
                        </div>

                        {/* Desktop layout (>= sm / 640px): Horizontal balanced layout */}
                        <div className="hidden sm:flex items-center justify-between gap-3 w-full">
                          {/* Left: Stage number badge & titles */}
                          <div className="flex items-center gap-3.5 min-w-0 flex-1">
                            <div
                              className={`w-10 h-10 rounded-xl flex items-center justify-center font-heading font-extrabold text-base shrink-0 transition-transform ${
                                isCurrent
                                  ? 'bg-[#F7B538] text-[#2D1B4E] shadow-xs'
                                  : isPassed
                                  ? 'bg-[#E2F7E1] text-[#246B2A]'
                                  : 'bg-neutral-100 text-[#4A3F55]/60'
                              }`}
                            >
                              {isPassed ? <CheckCircle2 className="w-5 h-5 text-[#246B2A]" /> : st}
                            </div>

                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-heading font-extrabold text-sm text-[#2D1B4E] leading-snug">
                                  {meta.name}: {meta.shortTitle}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Right: Status badge & Chevron */}
                          <div className="flex items-center gap-3 shrink-0">
                            {isPassed && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-[#E2F7E1] text-[#246B2A] border border-[#246B2A]/20">
                                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                                <span>Completada</span>
                              </span>
                            )}
                            {isCurrent && (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-extrabold bg-[#F7B538] text-[#2D1B4E] shadow-xs">
                                <span className="w-2 h-2 rounded-full bg-[#2D1B4E] animate-ping shrink-0" />
                                <span>En curso</span>
                              </span>
                            )}
                            {isPending && (
                              <span className="inline-flex items-center px-2 py-1 rounded-lg text-xs font-medium bg-neutral-100 text-[#4A3F55]/60 border border-neutral-200">
                                Pendiente
                              </span>
                            )}

                            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-[#4A3F55] hover:text-[#2D1B4E] transition-colors shrink-0">
                              {isOpen ? (
                                <ChevronUp className="w-5 h-5 text-[#BF3A1B]" />
                              ) : (
                                <ChevronDown className="w-5 h-5 text-[#4A3F55]" />
                              )}
                            </div>
                          </div>
                        </div>
                      </button>

                      {/* Accordion Content Panel */}
                      {isOpen && (
                        <div className="border-t border-[#493447]/10 p-3.5 sm:p-5 space-y-4 bg-white animate-in fade-in duration-200">

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

                          {/* Messages Timeline & Input Card for Stages (except Stage 5) */}
                          {st !== 5 && (
                            <>
                              {sortedMessages.length > 0 ? (
                                <div className="flex flex-col gap-4 w-full">
                                  {sortedMessages.map((msg) => renderSingleMessage(msg))}
                                  {isCurrent && isSendingMessage && (
                                    <div className="flex items-center gap-2.5 p-3.5 bg-[#FFF7EF] border border-[#FFD3BF] rounded-2xl text-xs text-[#2D1B4E] shadow-2xs animate-pulse">
                                      <div className="w-7 h-7 rounded-xl bg-[#2D1B4E] text-[#F7B538] flex items-center justify-center font-bold text-xs shrink-0">
                                        L
                                      </div>
                                      <span className="font-medium italic text-[#4A3F55]">
                                        Lidacta está pensando su respuesta...
                                      </span>
                                    </div>
                                  )}
                                  <div ref={chatEndRef} />
                                </div>
                              ) : isPending ? (
                                <div className="p-4 bg-neutral-50 border border-dashed border-[#493447]/20 rounded-xl text-center space-y-1.5 text-xs text-[#4A3F55]/70">
                                  <Clock className="w-4 h-4 mx-auto text-[#4A3F55]/50" />
                                  <p className="font-medium text-[#2D1B4E]">Esta etapa aún no ha iniciado.</p>
                                  <p className="text-[11px]">Se activará automáticamente conforme avances en las etapas previas del acompañamiento.</p>
                                </div>
                              ) : null}

                              {/* Interactive Conversational Input Form or Transition Card for Stage */}
                              {isCurrent && st !== 6 && (
                                <>
                                  {isStageConclusionReady ? (
                                    <div className="bg-white border-2 border-[#2D1B4E] rounded-2xl p-4 sm:p-5 shadow-sm space-y-4 mt-2 animate-in fade-in duration-200">
                                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                                        <div className="flex items-center gap-2.5">
                                          <div className="w-8 h-8 rounded-xl bg-[#2D1B4E] text-[#F7B538] flex items-center justify-center font-bold text-sm shrink-0">
                                            <Sparkles className="w-4 h-4 text-[#F7B538]" />
                                          </div>
                                          <div>
                                            <h4 className="font-heading font-extrabold text-sm sm:text-base text-[#2D1B4E]">
                                              Objetivo de la {meta.name} completado
                                            </h4>
                                            <p className="text-xs text-[#4A3F55]/85 mt-0.5 leading-relaxed">
                                              {st === 1 && 'Has clarificado los hechos, el dilema central y el impacto de tu reto con Lidacta. Tienes la base sólida para continuar.'}
                                              {st === 2 && 'Has analizado las perspectivas e identificado las habilidades clave a desarrollar para este reto.'}
                                              {st === 3 && 'Has explorado las alternativas y definido el camino de acción para abordar esta situación.'}
                                              {st === 4 && 'Has concluido la práctica y preparación de tu conversación. Tienes el enfoque listo para definir tu plan de acción.'}
                                            </p>
                                          </div>
                                        </div>
                                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-[#E2F7E1] text-[#246B2A] border border-[#246B2A]/20 shrink-0">
                                          <CheckCircle2 className="w-3.5 h-3.5" />
                                          <span>Lista para avanzar</span>
                                        </span>
                                      </div>

                                      <div className="p-3 bg-[#FFF7EF] border border-[#F7B538]/30 rounded-xl text-xs text-[#2D1B4E] flex items-center gap-2">
                                        <Clock className="w-4 h-4 text-[#BF3A1B] shrink-0" />
                                        <span>El avance es exclusivamente manual. Confirma cuando desees dar el siguiente paso en tu acompañamiento.</span>
                                      </div>

                                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1 border-t border-[#493447]/10">
                                        <button
                                          type="button"
                                          disabled={isAdvancingStage}
                                          onClick={async () => {
                                            setIsAdvancingStage(true);
                                            const next = (st < 7 ? (st + 1) as StageNumber : 7) as StageNumber;
                                            await advanceStage(next);
                                            setIsAdvancingStage(false);
                                            setOpenStages((prev) => ({ ...prev, [st]: false, [next]: true }));
                                          }}
                                          className="min-h-[44px] flex items-center justify-center gap-2 px-6 py-2.5 bg-[#2D1B4E] hover:bg-[#3D2666] text-[#F7B538] font-heading font-extrabold text-xs sm:text-sm rounded-xl shadow-md transition-all cursor-pointer active:scale-95 disabled:opacity-50"
                                        >
                                          {isAdvancingStage ? (
                                            <span>Avanzando a {STAGE_META[(st + 1) as StageNumber]?.name || 'la siguiente etapa'}...</span>
                                          ) : (
                                            <>
                                              <span>Completar {meta.name} y continuar a {STAGE_META[(st + 1) as StageNumber]?.name}</span>
                                              <ArrowRight className="w-4 h-4 text-[#F7B538]" />
                                            </>
                                          )}
                                        </button>

                                        <button
                                          type="button"
                                          onClick={() => handleReopenConversation(st)}
                                          className="text-xs text-[#BF3A1B] hover:text-[#9e2f15] font-semibold underline cursor-pointer text-center sm:text-right py-1 transition-colors"
                                        >
                                          Deseo agregar información o continuar conversando en esta etapa
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
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
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter' && !e.shiftKey) {
                                            e.preventDefault();
                                            handleSubmitStageMessage(st);
                                          }
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
                                </>
                              )}
                            </>
                          )}

                          {/* Stage 4: Roleplay Practice Arena */}
                          {st === 4 && !isStageConclusionReady && (
                            <div className="p-4 sm:p-5 bg-white border-2 border-[#BF3A1B]/40 rounded-2xl shadow-sm space-y-4">
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  <div className="w-7 h-7 rounded-lg bg-[#FFD3BF] text-[#BF3A1B] flex items-center justify-center font-bold shrink-0">
                                    <Sparkles className="w-4 h-4" />
                                  </div>
                                  <h4 className="font-heading font-bold text-sm sm:text-base text-[#2D1B4E]">
                                    Etapa 4: Practicar antes de actuar
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
                                    onClick={() => {
                                      setStageReadyToAdvance(4);
                                      setReopenedStages((prev) => ({ ...prev, [4]: false }));
                                    }}
                                    className="min-h-[44px] text-xs px-3.5 py-2 bg-neutral-100 hover:bg-neutral-200 text-[#4A3F55] rounded-xl cursor-pointer flex items-center justify-center font-medium active:scale-98"
                                  >
                                    ⏭️ Omitir práctica y pasar a Actuar (Plan de Acción)
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Stage 5: Pending State Notice (if opened before reaching Stage 5) */}
                          {st === 5 && isPending && (
                            <div className="p-4 bg-neutral-50 border border-dashed border-[#493447]/20 rounded-xl text-center space-y-1.5 text-xs text-[#4A3F55]/70">
                              <Clock className="w-4 h-4 mx-auto text-[#4A3F55]/50" />
                              <p className="font-medium text-[#2D1B4E]">Esta etapa aún no ha iniciado.</p>
                              <p className="text-[11px]">Se activará automáticamente conforme avances en las etapas previas del acompañamiento.</p>
                            </div>
                          )}

                          {/* Stage 5: Action Plan Editor & Optional Comments */}
                          {st === 5 && !isPending && (
                            <>
                              <div className="p-4 sm:p-5 bg-white border-2 border-[#BF3A1B]/30 rounded-2xl shadow-sm space-y-4">
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  <Calendar className="w-4 h-4 text-[#BF3A1B] shrink-0" />
                                  <h4 className="font-heading font-bold text-sm sm:text-base text-[#2D1B4E]">
                                    Etapa 5: Actuar (Plan de Acción)
                                  </h4>
                                </div>
                                <div className="flex items-center gap-2 flex-wrap">
                                  {activeMentorship.actionPlan?.isCompleted ? (
                                    <span className="text-xs font-bold text-[#246B2A] bg-[#E2F7E1] px-2.5 py-1 rounded-lg flex items-center gap-1 w-fit">
                                      <CheckCircle2 className="w-3.5 h-3.5" />
                                      Acción Realizada
                                    </span>
                                  ) : hasSavedActionPlan ? (
                                    <span className="text-xs font-bold text-[#2D1B4E] bg-[#FFF7EF] border border-[#F7B538] px-2.5 py-1 rounded-lg flex items-center gap-1 w-fit">
                                      <Sparkles className="w-3.5 h-3.5 text-[#F7B538]" />
                                      Compromiso Registrado
                                    </span>
                                  ) : (
                                    <span className="text-xs font-semibold text-[#BF3A1B] bg-[#FFD3BF]/60 px-2.5 py-1 rounded-lg w-fit">
                                      Plan en Construcción ({completedFieldsCount}/5 campos)
                                    </span>
                                  )}
                                </div>
                              </div>

                              <div className="p-3 bg-[#FFF7EF]/80 border border-[#EADBCE] rounded-xl text-xs text-[#4A3F55] leading-relaxed">
                                <strong className="text-[#2D1B4E] font-bold">Construye tu propio Plan de Acción:</strong> Lidacta te orienta y formula preguntas en el diálogo para ayudarte a madurar tus ideas, pero la decisión y redacción de cada compromiso son exclusivamente tuyas. Escribe tus respuestas en los 5 campos a continuación.
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
                                <div className="space-y-1.5">
                                  <div className="flex items-center justify-between">
                                    <label className="font-bold text-[#2D1B4E]">1. ¿Qué exactamente harás?</label>
                                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${actionWhat.trim() ? 'text-[#246B2A] bg-[#E2F7E1]' : 'text-[#BF3A1B] bg-[#FFD3BF]/60'}`}>
                                      {actionWhat.trim() ? '✓ Listo' : 'Requerido'}
                                    </span>
                                  </div>
                                  <input
                                    type="text"
                                    value={actionWhat}
                                    onChange={(e) => setActionWhat(e.target.value)}
                                    onBlur={() => handleSaveActionPlan(true)}
                                    placeholder="Describe la acción concreta que realizarás..."
                                    className="w-full p-2.5 min-h-[44px] bg-[#FFF7EF]/50 border border-[#493447]/15 rounded-xl text-xs text-[#2D1B4E] focus:outline-none focus:border-[#BF3A1B] transition-colors"
                                  />
                                </div>

                                <div className="space-y-1.5">
                                  <div className="flex items-center justify-between">
                                    <label className="font-bold text-[#2D1B4E]">2. ¿Cuándo lo harás? (Fecha u horario específico)</label>
                                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${actionWhen.trim() ? 'text-[#246B2A] bg-[#E2F7E1]' : 'text-[#BF3A1B] bg-[#FFD3BF]/60'}`}>
                                      {actionWhen.trim() ? '✓ Listo' : 'Requerido'}
                                    </span>
                                  </div>
                                  <input
                                    type="text"
                                    value={actionWhen}
                                    onChange={(e) => setActionWhen(e.target.value)}
                                    onBlur={() => handleSaveActionPlan(true)}
                                    placeholder="Ej. Jueves 17 a las 15:30 hrs..."
                                    className="w-full p-2.5 min-h-[44px] bg-[#FFF7EF]/50 border border-[#493447]/15 rounded-xl text-xs text-[#2D1B4E] focus:outline-none focus:border-[#BF3A1B] transition-colors"
                                  />
                                </div>

                                <div className="space-y-1.5">
                                  <div className="flex items-center justify-between">
                                    <label className="font-bold text-[#2D1B4E]">3. ¿Con quién lo harás?</label>
                                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${actionWithWhom.trim() ? 'text-[#246B2A] bg-[#E2F7E1]' : 'text-[#BF3A1B] bg-[#FFD3BF]/60'}`}>
                                      {actionWithWhom.trim() ? '✓ Listo' : 'Requerido'}
                                    </span>
                                  </div>
                                  <input
                                    type="text"
                                    value={actionWithWhom}
                                    onChange={(e) => setActionWithWhom(e.target.value)}
                                    onBlur={() => handleSaveActionPlan(true)}
                                    placeholder="Ej. Supervisor de turno, equipo de operaciones..."
                                    className="w-full p-2.5 min-h-[44px] bg-[#FFF7EF]/50 border border-[#493447]/15 rounded-xl text-xs text-[#2D1B4E] focus:outline-none focus:border-[#BF3A1B] transition-colors"
                                  />
                                </div>

                                <div className="space-y-1.5">
                                  <div className="flex items-center justify-between">
                                    <label className="font-bold text-[#2D1B4E]">4. ¿Cómo lo harás? (Estrategia o pasos)</label>
                                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${actionHow.trim() ? 'text-[#246B2A] bg-[#E2F7E1]' : 'text-[#BF3A1B] bg-[#FFD3BF]/60'}`}>
                                      {actionHow.trim() ? '✓ Listo' : 'Requerido'}
                                    </span>
                                  </div>
                                  <input
                                    type="text"
                                    value={actionHow}
                                    onChange={(e) => setActionHow(e.target.value)}
                                    onBlur={() => handleSaveActionPlan(true)}
                                    placeholder="Describe los pasos, estrategia o dinámica que seguirás..."
                                    className="w-full p-2.5 min-h-[44px] bg-[#FFF7EF]/50 border border-[#493447]/15 rounded-xl text-xs text-[#2D1B4E] focus:outline-none focus:border-[#BF3A1B] transition-colors"
                                  />
                                </div>

                                <div className="space-y-1.5 sm:col-span-2">
                                  <div className="flex items-center justify-between">
                                    <label className="font-bold text-[#2D1B4E]">5. ¿Qué vas a cuidar o recordar?</label>
                                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${actionCare.trim() ? 'text-[#246B2A] bg-[#E2F7E1]' : 'text-[#BF3A1B] bg-[#FFD3BF]/60'}`}>
                                      {actionCare.trim() ? '✓ Listo' : 'Requerido'}
                                    </span>
                                  </div>
                                  <input
                                    type="text"
                                    value={actionCare}
                                    onChange={(e) => setActionCare(e.target.value)}
                                    onBlur={() => handleSaveActionPlan(true)}
                                    placeholder="Ej. Mantener serenidad, escuchar con empatía, basarse en hechos objetivos..."
                                    className="w-full p-2.5 min-h-[44px] bg-[#FFF7EF]/50 border border-[#493447]/15 rounded-xl text-xs text-[#2D1B4E] focus:outline-none focus:border-[#BF3A1B] transition-colors"
                                  />
                                </div>
                              </div>

                              {/* Barra de Guardado del Plan de Acción */}
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-1">
                                <button
                                  type="button"
                                  onClick={() => handleSaveActionPlan(false)}
                                  disabled={isSavingActionPlan}
                                  className={`min-h-[42px] px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98 ${
                                    justSavedActionPlan
                                      ? 'bg-[#E2F7E1] text-[#246B2A] border border-[#246B2A]/30'
                                      : hasSavedActionPlan
                                      ? 'bg-[#2D1B4E] text-[#FFF7EF] hover:bg-[#3D2568]'
                                      : 'bg-[#BF3A1B] text-white hover:bg-[#a63014]'
                                  }`}
                                >
                                  {isSavingActionPlan ? (
                                    <>
                                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                      <span>Guardando...</span>
                                    </>
                                  ) : justSavedActionPlan ? (
                                    <>
                                      <CheckCircle2 className="w-4 h-4 text-[#246B2A]" />
                                      <span>Plan Guardado Exitosamente</span>
                                    </>
                                  ) : hasSavedActionPlan ? (
                                    <>
                                      <Save className="w-3.5 h-3.5" />
                                      <span>Actualizar Plan de Acción</span>
                                    </>
                                  ) : (
                                    <>
                                      <Save className="w-3.5 h-3.5" />
                                      <span>Guardar Plan de Acción</span>
                                    </>
                                  )}
                                </button>

                                <div className="text-xs text-[#4A3F55]/80">
                                  {isActionPlanComplete ? (
                                    <span className="text-[#246B2A] font-semibold flex items-center gap-1">
                                      <CheckCircle2 className="w-3.5 h-3.5 text-[#246B2A]" />
                                      Los 5 campos obligatorios están completos.
                                    </span>
                                  ) : (
                                    <span className="text-[#BF3A1B] font-medium">
                                      Completa los 5 campos obligatorios ({completedFieldsCount}/5 completados).
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Casilla de Autorización de Compartición con RH (Opt-in) */}
                              <div className="p-3.5 bg-neutral-50 border border-[#493447]/15 rounded-xl space-y-1">
                                <label className="flex items-start gap-2.5 cursor-pointer select-none">
                                  <input
                                    type="checkbox"
                                    checked={actionShareWithHR}
                                    onChange={(e) => {
                                      const checked = e.target.checked;
                                      setActionShareWithHR(checked);
                                      if (activeMentorship) {
                                        updateActionPlan({
                                          what: actionWhat.trim(),
                                          when: actionWhen.trim(),
                                          withWhom: actionWithWhom.trim(),
                                          how: actionHow.trim(),
                                          careReminders: actionCare.trim(),
                                          shareWithHR: checked,
                                          shareActionPlanWithHR: checked,
                                          actionPlanShared: checked,
                                          isCompleted: activeMentorship.actionPlan?.isCompleted || false,
                                        });
                                      }
                                    }}
                                    className="mt-0.5 w-4 h-4 rounded text-[#BF3A1B] border-[#493447]/30 focus:ring-[#BF3A1B] cursor-pointer shrink-0 accent-[#BF3A1B]"
                                  />
                                  <div className="space-y-0.5">
                                    <span className="font-bold text-xs text-[#2D1B4E]">
                                      Autorizo compartir este Plan de Acción con el equipo de Recursos Humanos.
                                    </span>
                                    <p className="text-[11px] text-[#4A3F55]/70 leading-normal">
                                      Por defecto tu plan es 100% privado y confidencial. Si no marcas esta casilla, Recursos Humanos solo verá la etapa completada como indicador de avance, sin acceder al contenido redactado.
                                    </p>
                                  </div>
                                </label>
                              </div>

                                {/* Confirmación Explícita del Compromiso (Requisito 5) */}
                                {isActionPlanComplete && (
                                  <div className="p-3.5 bg-[#FFF7EF] border-2 border-[#F7B538]/70 rounded-xl space-y-2.5 animate-fadeIn">
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-2">
                                        <ShieldCheck className="w-4 h-4 text-[#BF3A1B]" />
                                        <span className="font-bold text-xs text-[#2D1B4E]">
                                          Confirmación de Compromiso del Líder
                                        </span>
                                      </div>
                                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#246B2A] bg-[#E2F7E1] px-2 py-0.5 rounded">
                                        Plan Validado
                                      </span>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-2.5 bg-white/80 rounded-lg text-[11px] text-[#4A3F55] border border-[#EADBCE]">
                                      <div><strong className="text-[#2D1B4E]">• Acción:</strong> {actionWhat}</div>
                                      <div><strong className="text-[#2D1B4E]">• Cuándo:</strong> {actionWhen}</div>
                                      <div><strong className="text-[#2D1B4E]">• Con quién:</strong> {actionWithWhom}</div>
                                      <div><strong className="text-[#2D1B4E]">• Cómo:</strong> {actionHow}</div>
                                      <div className="sm:col-span-2"><strong className="text-[#2D1B4E]">• A cuidar:</strong> {actionCare}</div>
                                    </div>

                                    <label className="flex items-start gap-2.5 cursor-pointer select-none pt-1">
                                      <input
                                        type="checkbox"
                                        checked={isCommitmentConfirmed}
                                        onChange={(e) => {
                                          const confirmed = e.target.checked;
                                          setIsCommitmentConfirmed(confirmed);
                                          if (activeMentorship && activeMentorship.actionPlan) {
                                            updateActionPlan({
                                              ...activeMentorship.actionPlan,
                                              what: actionWhat.trim(),
                                              when: actionWhen.trim(),
                                              withWhom: actionWithWhom.trim(),
                                              how: actionHow.trim(),
                                              careReminders: actionCare.trim(),
                                              isCommitmentConfirmed: confirmed,
                                            });
                                          }
                                        }}
                                        className="mt-0.5 w-4 h-4 rounded text-[#BF3A1B] border-[#493447]/30 focus:ring-[#BF3A1B] cursor-pointer shrink-0 accent-[#BF3A1B]"
                                      />
                                      <div className="space-y-0.5">
                                        <span className="font-bold text-xs text-[#2D1B4E]">
                                          Confirmo mi compromiso personal con este Plan de Acción.
                                        </span>
                                        <p className="text-[11px] text-[#4A3F55]/70 leading-normal">
                                          He definido este compromiso conscientemente y asumo la responsabilidad de ejecutarlo en mi entorno real.
                                        </p>
                                      </div>
                                    </label>
                                  </div>
                                )}
                              </div>

                              {/* 5. Comentarios adicionales, dudas o reflexiones sobre tu compromiso */}
                              {isCurrent && (
                                <div className="p-4 sm:p-5 bg-white border border-[#493447]/15 rounded-2xl shadow-xs space-y-3.5">
                                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                                    <div className="flex items-center gap-2">
                                      <MessageSquare className="w-4 h-4 text-[#BF3A1B] shrink-0" />
                                      <label className="text-xs sm:text-sm font-heading font-extrabold text-[#2D1B4E]">
                                        Comentarios adicionales, dudas o reflexiones sobre tu compromiso
                                      </label>
                                    </div>
                                    <span className="text-[11px] font-semibold text-[#4A3F55]/70 bg-neutral-100 px-2 py-0.5 rounded-md w-fit">
                                      Opcional
                                    </span>
                                  </div>

                                  <p className="text-xs text-[#4A3F55]/80 leading-relaxed">
                                    Si lo deseas, comparte aquí cualquier comentario adicional, duda o reflexión sobre la ejecución de tu compromiso para recibir retroalimentación de Lidacta. Este espacio es complementario y no condiciona tu avance a la Etapa 6.
                                  </p>

                                  <textarea
                                    value={stage5CommentText}
                                    onChange={(e) => handleStage5CommentChange(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        handleSendStage5Comment();
                                      }
                                    }}
                                    placeholder="Escribe aquí tus comentarios adicionales, dudas o reflexiones sobre la ejecución de tu compromiso..."
                                    rows={3}
                                    disabled={isSendingMessage}
                                    className="w-full p-3 sm:p-4 text-xs sm:text-sm text-[#2D1B4E] bg-[#FFF7EF]/50 border border-[#493447]/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#BF3A1B] focus:border-transparent transition-all placeholder:text-[#4A3F55]/50 leading-relaxed disabled:bg-neutral-100"
                                  />

                                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-1">
                                    <WhatsAppVoiceRecorder
                                      stageNumber={5}
                                      stageName="Etapa 5: Actuar"
                                      mode="stage-card"
                                      disabled={isSendingMessage}
                                      isSending={isSendingMessage}
                                      onTranscript={(text) => {
                                        handleStage5CommentChange(stage5CommentText ? `${stage5CommentText} ${text}` : text);
                                      }}
                                      onSendDirect={(text) => handleSendVoiceDirectStage5(text)}
                                    />

                                    <button
                                      type="button"
                                      onClick={handleSendStage5Comment}
                                      disabled={!stage5CommentText.trim() || isSendingMessage}
                                      className="min-h-[44px] flex items-center justify-center gap-2 px-5 py-2.5 bg-[#F7B538] hover:bg-[#f5a623] text-[#2D1B4E] font-heading font-extrabold text-xs sm:text-sm rounded-xl shadow-xs transition-all disabled:opacity-50 cursor-pointer active:scale-95"
                                    >
                                      {isSendingMessage ? (
                                        <span>Enviando comentario...</span>
                                      ) : (
                                        <>
                                          <span>Enviar comentario a Lidacta</span>
                                          <Send className="w-4 h-4 text-[#2D1B4E]" />
                                        </>
                                      )}
                                    </button>
                                  </div>
                                </div>
                              )}

                              {/* 6. Botón de Avance a Etapa 6 (Último elemento de Etapa 5) */}
                              <div className="space-y-2 pt-1">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-end gap-2.5">
                                  <button
                                    type="button"
                                    onClick={handleAdvanceToStage6}
                                    disabled={!isActionPlanComplete || !isCommitmentConfirmed}
                                    className={`w-full sm:w-auto min-h-[44px] flex items-center justify-center gap-1.5 px-5 py-2.5 font-bold text-xs rounded-xl transition-all shadow-xs ${
                                      isActionPlanComplete && isCommitmentConfirmed
                                        ? 'bg-[#2D1B4E] hover:bg-[#3D2568] text-[#F7B538] cursor-pointer active:scale-98'
                                        : 'bg-neutral-200 text-neutral-400 cursor-not-allowed border border-neutral-300'
                                    }`}
                                  >
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    <span>Ya ejecuté la acción → Ir a Etapa 6 (Aprender y reflexionar)</span>
                                  </button>
                                </div>

                                {(!isActionPlanComplete || !isCommitmentConfirmed) && (
                                  <p className="text-right text-[11px] text-[#BF3A1B] font-medium">
                                    {!isActionPlanComplete
                                      ? `⚠️ Completa los 5 campos del Plan de Acción (${completedFieldsCount}/5) para avanzar.`
                                      : '⚠️ Marca la casilla de confirmación de tu compromiso para habilitar el avance a la Etapa 6.'}
                                  </p>
                                )}
                              </div>
                            </>
                          )}

                          {/* Stage 6: Learnings & Reflections */}
                          {st === 6 && (
                            <div className="p-4 sm:p-5 bg-white border border-[#493447]/15 rounded-2xl shadow-sm space-y-4">
                              <div className="flex items-center justify-between gap-2 flex-wrap">
                                <div className="flex items-center gap-2">
                                  <BookOpen className="w-4 h-4 text-[#BF3A1B] shrink-0" />
                                  <h4 className="font-heading font-bold text-sm sm:text-base text-[#2D1B4E]">
                                    Etapa 6: Aprender y reflexionar
                                  </h4>
                                </div>
                                {hasSavedLearnings && (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#E2F7E1] text-[#246B2A] text-[11px] font-semibold border border-[#246B2A]/20">
                                    <CheckCircle2 className="w-3 h-3 text-[#246B2A]" />
                                    Reflexión guardada
                                  </span>
                                )}
                              </div>

                              <div className="space-y-3 text-xs">
                                <div>
                                  <div className="flex items-center justify-between mb-1">
                                    <label className="font-bold text-[#2D1B4E]">¿Qué ocurrió después de tu acción?</label>
                                    <span className="text-[10px] text-[#493447]/60 font-medium">Requerido</span>
                                  </div>
                                  <textarea
                                    value={learningWhatHappened}
                                    onChange={(e) => setLearningWhatHappened(e.target.value)}
                                    placeholder="Describe cómo reaccionó la otra persona o el equipo..."
                                    rows={2}
                                    className="w-full p-2.5 bg-[#FFF7EF]/50 border border-[#493447]/15 rounded-xl text-xs focus:outline-none focus:border-[#BF3A1B] transition-colors"
                                  />
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                  <div>
                                    <div className="flex items-center justify-between mb-1">
                                      <label className="font-bold text-[#2D1B4E]">¿Qué funcionó?</label>
                                      <span className="text-[10px] text-[#493447]/60 font-medium">Requerido</span>
                                    </div>
                                    <input
                                      type="text"
                                      value={learningWhatWorked}
                                      onChange={(e) => setLearningWhatWorked(e.target.value)}
                                      placeholder="Lo que dio buen resultado..."
                                      className="w-full p-2.5 min-h-[44px] bg-[#FFF7EF]/50 border border-[#493447]/15 rounded-xl text-xs focus:outline-none focus:border-[#BF3A1B] transition-colors"
                                    />
                                  </div>
                                  <div>
                                    <div className="flex items-center justify-between mb-1">
                                      <label className="font-bold text-[#2D1B4E]">¿De qué te das cuenta y qué aprendes?</label>
                                      <span className="text-[10px] text-[#493447]/60 font-medium">Requerido</span>
                                    </div>
                                    <input
                                      type="text"
                                      value={learningInsights}
                                      onChange={(e) => setLearningInsights(e.target.value)}
                                      placeholder="Tu insight de liderazgo..."
                                      className="w-full p-2.5 min-h-[44px] bg-[#FFF7EF]/50 border border-[#493447]/15 rounded-xl text-xs focus:outline-none focus:border-[#BF3A1B] transition-colors"
                                    />
                                  </div>
                                </div>

                                {/* Campo Opcional para Compartir Aprendizajes con Recursos Humanos */}
                                <div className="mt-3 p-3.5 bg-[#FFF7EF]/80 border border-[#FFD3BF] rounded-xl space-y-1.5">
                                  <div className="flex items-center justify-between">
                                    <label className="font-bold text-[#2D1B4E] text-xs">
                                      ¿Te gustaría compartir con Recursos Humanos algún aprendizaje de este proceso? Puedes escribirlo con tus propias palabras.
                                    </label>
                                    <span className="text-[10px] text-[#BF3A1B] font-semibold bg-[#FFD3BF]/60 px-2 py-0.5 rounded-full shrink-0 ml-2">
                                      Opcional
                                    </span>
                                  </div>
                                  <textarea
                                    value={learningShareWithHR}
                                    onChange={(e) => setLearningShareWithHR(e.target.value)}
                                    placeholder="Escribe aquí voluntariamente el aprendizaje que deseas que el equipo de Recursos Humanos conozca..."
                                    rows={2}
                                    className="w-full p-2.5 bg-white border border-[#493447]/15 rounded-xl text-xs focus:outline-none focus:border-[#BF3A1B] transition-colors"
                                  />
                                  <p className="text-[11px] text-[#4A3F55]/70 leading-normal">
                                    Este campo es 100% opcional. Si lo dejas vacío, tus reflexiones se mantendrán estrictamente privadas y no se comparte nada con la organización.
                                  </p>
                                </div>
                              </div>

                              {/* Botón «Guardar Reflexión» debajo del formulario */}
                              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-3 border-t border-[#493447]/10">
                                <button
                                  type="button"
                                  disabled={!isLearningsValid || isSavingLearnings}
                                  onClick={handleSaveLearnings}
                                  className={`w-full sm:w-auto min-h-[44px] px-5 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all ${
                                    !isLearningsValid
                                      ? 'bg-neutral-200 text-[#493447]/40 border border-neutral-300 cursor-not-allowed shadow-none'
                                      : justSavedLearnings
                                      ? 'bg-[#E2F7E1] text-[#246B2A] border border-[#246B2A]/30 font-bold'
                                      : 'bg-[#BF3A1B] hover:bg-[#a63014] text-white shadow-sm hover:shadow active:scale-98 cursor-pointer'
                                  }`}
                                >
                                  {isSavingLearnings ? (
                                    <>
                                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                      <span>Guardando...</span>
                                    </>
                                  ) : justSavedLearnings ? (
                                    <>
                                      <CheckCircle2 className="w-4 h-4 text-[#246B2A]" />
                                      <span>Reflexión Guardada</span>
                                    </>
                                  ) : hasSavedLearnings ? (
                                    <>
                                      <CheckCircle2 className="w-3.5 h-3.5" />
                                      <span>Actualizar Reflexión</span>
                                    </>
                                  ) : (
                                    <>
                                      <CheckCircle2 className="w-3.5 h-3.5" />
                                      <span>Guardar Reflexión</span>
                                    </>
                                  )}
                                </button>
                                {!isLearningsValid ? (
                                  <span className="text-[11px] text-[#493447]/60 italic">
                                    Completa los 3 campos obligatorios de reflexión para habilitar el guardado.
                                  </span>
                                ) : hasSavedLearnings && !justSavedLearnings ? (
                                  <span className="text-[11px] text-[#246B2A] font-medium flex items-center gap-1">
                                    <CheckCircle2 className="w-3 h-3 text-[#246B2A]" />
                                    Reflexión registrada. Puedes editar los campos y actualizarla en cualquier momento.
                                  </span>
                                ) : null}
                              </div>

                              {/* Botón «Concluir e ir a Cierre y retroalimentación» al final de la sección, debajo del botón de guardar */}
                              {activeMentorship.currentStage === 6 && (
                                <div className="pt-2 border-t border-[#493447]/10 flex flex-col sm:flex-row sm:items-center justify-end gap-2.5">
                                  <button
                                    type="button"
                                    onClick={() => advanceStage(7)}
                                    className="w-full sm:w-auto min-h-[44px] px-5 py-2.5 bg-[#2D1B4E] hover:bg-[#3D2568] text-[#F7B538] font-bold text-xs rounded-xl transition-all shadow-xs active:scale-98 flex items-center justify-center gap-2 cursor-pointer"
                                  >
                                    <span>Concluir e ir a Cierre y retroalimentación (Etapa 7)</span>
                                    <ArrowRight className="w-3.5 h-3.5 text-[#F7B538]" />
                                  </button>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Stage 7: Comprehensive Feedback Report */}
                          {st === 7 && activeMentorship.finalFeedbackReport && (
                            <div className="p-4 sm:p-6 bg-white border-2 border-[#2D1B4E] rounded-2xl shadow-md space-y-5 print:border-none">
                              <div className="border-b border-[#493447]/15 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
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

                                {audioState.id === 'report-summary' && audioState.status === 'loading' ? (
                                  <div className="flex items-center gap-1.5 text-xs text-[#BF3A1B] font-medium px-3 py-1.5 bg-[#FFD3BF]/30 rounded-xl border border-[#FFD3BF] animate-pulse">
                                    <Loader2 className="w-3.5 h-3.5 animate-spin text-[#BF3A1B]" />
                                    <span className="text-xs font-semibold">Cargando audio...</span>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const report = activeMentorship.finalFeedbackReport;
                                      if (!report) return;
                                      const summarySpeech = `Hola ${currentUser.name.split(' ')[0]}. Este es tu reporte de cierre de mentoría Lidacta. Entre tus fortalezas detectadas destacan: ${report.detectedStrengths.join(', ')}. Las habilidades clave que pusiste en juego fueron: ${report.stageTwoSkills.join(', ')}. Y tus principales recomendaciones para continuar fortaleciendo tu autonomía son: ${report.recommendationsForAutonomy.join(', ')}. ¡Felicidades por completar tu proceso!`;
                                      toggleVoicePlayback(summarySpeech, 'report-summary');
                                    }}
                                    title="Escuchar resumen del reporte con la voz clonada de Lidacta Mentora"
                                    className="text-[#BF3A1B] hover:text-[#2D1B4E] text-xs font-bold flex items-center gap-1.5 cursor-pointer px-3 py-1.5 rounded-xl bg-[#FFF7EF] hover:bg-[#FFD3BF]/40 border border-[#493447]/15 shadow-xs transition-colors shrink-0"
                                  >
                                    {audioState.id === 'report-summary' && audioState.status === 'playing' ? (
                                      <>
                                        <VolumeX className="w-3.5 h-3.5 text-[#BF3A1B] animate-pulse" />
                                        <span>Pausar reporte</span>
                                      </>
                                    ) : (
                                      <>
                                        <Volume2 className="w-3.5 h-3.5 text-[#BF3A1B]" />
                                        <span>Escuchar reporte</span>
                                      </>
                                    )}
                                  </button>
                                )}
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

                              <div className="p-3 bg-[#FFF7EF] rounded-xl text-center text-xs text-[#4A3F55]/70 space-y-1">
                                {activeMentorship.finalReportEmailStatus === 'sent' ? (
                                  <div className="text-[#246B2A] font-semibold flex items-center justify-center gap-1.5 flex-wrap">
                                    <CheckCircle2 className="w-4 h-4 text-[#246B2A] shrink-0" />
                                    <span>
                                      Este reporte ha sido enviado exitosamente a tu correo registrado (
                                      <strong className="text-[#2D1B4E]">
                                        {allUsers.find((u) => u.id === activeMentorship.leaderId)?.email || currentUser.email}
                                      </strong>
                                      ).
                                    </span>
                                  </div>
                                ) : activeMentorship.finalReportEmailStatus === 'simulated' ? (
                                  <div className="text-[#2D1B4E] font-medium flex items-center justify-center gap-1.5 flex-wrap">
                                    <Mail className="w-4 h-4 text-[#BF3A1B] shrink-0" />
                                    <span>
                                      Reporte registrado en modo simulado para tu correo registrado (
                                      <strong className="text-[#2D1B4E]">
                                        {allUsers.find((u) => u.id === activeMentorship.leaderId)?.email || currentUser.email}
                                      </strong>
                                      ).
                                    </span>
                                  </div>
                                ) : activeMentorship.finalReportEmailStatus === 'failed' ? (
                                  <div className="flex flex-col sm:flex-row items-center justify-center gap-2 text-[#BF3A1B]">
                                    <span>
                                      No se pudo entregar el correo a{' '}
                                      <strong>
                                        {allUsers.find((u) => u.id === activeMentorship.leaderId)?.email || currentUser.email}
                                      </strong>
                                      {activeMentorship.finalReportEmailError ? `: ${activeMentorship.finalReportEmailError}` : '.'}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={async () => {
                                        showToast('Reintentando envío de reporte por correo...', 'info');
                                        const res = await retrySendFinalReportEmail(activeMentorship.id);
                                        if (res.success) {
                                          showToast('Reporte enviado exitosamente.', 'success');
                                        } else {
                                          showToast(res.message || 'Error al reintentar envío.', 'error');
                                        }
                                      }}
                                      className="font-bold underline hover:text-[#2D1B4E] cursor-pointer"
                                    >
                                      Reintentar envío
                                    </button>
                                  </div>
                                ) : (
                                  <div className="text-[#4A3F55] font-medium flex items-center justify-center gap-1.5 flex-wrap">
                                    <Clock className="w-4 h-4 text-[#F7B538] shrink-0" />
                                    <span>
                                      Preparando el envío del reporte a tu correo registrado (
                                      <strong className="text-[#2D1B4E]">
                                        {allUsers.find((u) => u.id === activeMentorship.leaderId)?.email || currentUser.email}
                                      </strong>
                                      )...
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Stage Footer: Advance CTA or Status */}
                          <div className="pt-3 border-t border-[#493447]/10 flex flex-col sm:flex-row items-center justify-between gap-2.5">
                            {isCurrent && st < 7 && (
                              <div className="w-full flex items-center justify-between text-[11px] text-[#4A3F55]/80">
                                <span className="flex items-center gap-1.5">
                                  <Sparkles className="w-3.5 h-3.5 text-[#F7B538]" />
                                  Acompañamiento en curso con Lidacta para esta etapa del proceso.
                                </span>
                              </div>
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

            {/* Input Bar for Message Exchange (WhatsApp Style Across Stages 1 to 6 - Hidden in Stage 7 and completed processes) */}
            {activeMentorship.currentStage !== 7 &&
              activeMentorship.status !== 'completed' &&
              (activeMentorship.status as string) !== 'closed' &&
              (activeMentorship.status as string) !== 'concluido' &&
              !activeMentorship.completedAt && (
                <div className="p-2.5 sm:p-4 bg-white border-t border-[#493447]/10 shrink-0 no-print">
                  <form onSubmit={handleSendMessage} className="w-full max-w-screen-xl mx-auto flex items-center gap-2">
                    <input
                      type="text"
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      placeholder={
                        activeMentorship.currentStage === 4
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
            )}
          </div>
        )}
      </main>

      {/* Persistent Floating Shortcut: Asesoría 1:1 */}
      <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 pointer-events-none select-none">
        <button
          type="button"
          onClick={() => setIsMentorModalOpen(true)}
          className="pointer-events-auto w-auto max-w-none min-w-fit shrink-0 flex items-center gap-1.5 sm:gap-2.5 px-3 py-2 sm:px-4 sm:py-2.5 bg-[#BF3A1B] hover:bg-[#a63014] text-white rounded-2xl shadow-xl hover:shadow-2xl border-2 border-white cursor-pointer active:scale-95 transition-all group overflow-visible select-none whitespace-nowrap"
          title="Asesoría 1:1 Directa (Notificación a Tania Padierna)"
        >
          <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-lg bg-[#F7B538] text-[#2D1B4E] flex items-center justify-center font-bold shrink-0 shadow-xs">
            <UserCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#2D1B4E]" />
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
