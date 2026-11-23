import {
  ActionPlanExecutionStatus,
  LeadershipSkillEntry,
  MentorshipActionPlan,
  MentorshipLearnings,
  MentorshipMessage,
  MentorshipSession,
  ObservedEvidenceRecord,
  StageHistoryItem,
  StageNumber,
  UserProfile,
} from '../types/lidacta';
import { getActiveSkillNames } from './skillsConsolidator';

export const QA_TEST_LEADER_ID = 'user_qa_leader';

/**
 * Perfil ficticio completo exclusivo para sesiones QA en Modo Inspector.
 * Nunca se persiste en allUsers ni en server_users_db.json.
 */
export const QA_TEST_LEADER_PROFILE: UserProfile = {
  id: QA_TEST_LEADER_ID,
  name: 'Laura Méndez (Líder QA)',
  email: 'laura.qa@prueba-lidacta.local',
  role: 'leader',
  companyId: 'comp_nexus',
  companyName: 'Industrias Nexus Automotriz',
  position: 'Gerente Comercial (Perfil QA)',
  area: 'Comercial y Servicio',
  birthDate: '1987-05-14',
  directReports: 6,
  whatsapp: '+52 55 4123 7890',
  isProfileCompleted: true,
  isProfileComplete: true,
  status: 'active',
  createdAt: '2026-01-15T10:00:00.000Z',
};

export interface TestStageOptionMeta {
  stage: StageNumber;
  label: string;
  shortTitle: string;
  preparedContext: string;
}

export const TEST_STAGE_OPTIONS: TestStageOptionMeta[] = [
  {
    stage: 1,
    label: 'Etapa 1: Definir el problema',
    shortTitle: 'Detectar qué sucede',
    preparedContext: 'Problema inicial realista sobre delegación + perfil ficticio completo de líder.',
  },
  {
    stage: 2,
    label: 'Etapa 2: Identificar habilidades',
    shortTitle: 'Analizar perspectivas y habilidades',
    preparedContext: 'Contexto del problema e historial validado de Etapa 1 (con síntesis confirmada).',
  },
  {
    stage: 3,
    label: 'Etapa 3: Diseñar alternativas',
    shortTitle: 'Diseñar alternativas',
    preparedContext: 'Contexto Etapas 1–2 + habilidades identificadas con evidencia observable.',
  },
  {
    stage: 4,
    label: 'Etapa 4: Practicar / Simulación',
    shortTitle: 'Practicar antes de actuar',
    preparedContext: 'Habilidades + alternativas propuestas + alternativa elegida lista para practicar u omitir.',
  },
  {
    stage: 5,
    label: 'Etapa 5: Plan de acción',
    shortTitle: 'Actuar (Plan de Acción)',
    preparedContext: 'Alternativa elegida + contexto previo de Etapas 1–4 para redactar el compromiso.',
  },
  {
    stage: 6,
    label: 'Etapa 6: Aprender y reflexionar',
    shortTitle: 'Aprender y reflexionar',
    preparedContext: 'Plan de Acción completo de Etapa 5 + escenario seleccionable (pendiente, ejecutado o no ejecutado).',
  },
  {
    stage: 7,
    label: 'Etapa 7: Cierre y retroalimentación',
    shortTitle: 'Cierre y retroalimentación',
    preparedContext: 'Habilidades con evidencias reales, Plan de Acción y reflexiones de Etapa 6; sin envío de correo ni alertas.',
  },
];

export interface Stage6ScenarioOptionMeta {
  id: ActionPlanExecutionStatus;
  label: string;
  description: string;
}

export const TEST_STAGE6_SCENARIOS: Stage6ScenarioOptionMeta[] = [
  {
    id: 'pending_verification',
    label: 'Ejecución pendiente',
    description: 'Muestra la pregunta obligatoria «¿Ya ejecutaste tu Plan de Acción?» con botones Sí / No.',
  },
  {
    id: 'executed',
    label: 'Plan ejecutado',
    description: 'Simula que el líder confirmó «Sí» y activa reflexión guiada real con Gemini + formulario de aprendizajes.',
  },
  {
    id: 'not_executed',
    label: 'Plan no ejecutado',
    description: 'Simula que el líder respondió «No» y activa acompañamiento empático sin juicios sobre obstáculos.',
  },
];

const STAGE_NAMES: Record<StageNumber, string> = {
  1: 'Detectar qué sucede',
  2: 'Analizar perspectivas y habilidades',
  3: 'Diseñar alternativas',
  4: 'Practicar antes de actuar',
  5: 'Actuar (Plan de Acción)',
  6: 'Aprender y reflexionar',
  7: 'Cierre y retroalimentación',
};

const BASE_CHALLENGE =
  'Dirijo un equipo comercial de seis personas. Últimamente me consultan prácticamente todas las decisiones operativas; cuando delego algo, termino supervisando cada detalle y si no queda como esperaba intervengo y lo resuelvo yo misma. Quiero que desarrollen autonomía, pero me cuesta soltar el control.';

const BASE_TITLE = 'Delegación efectiva y autonomía del equipo comercial (QA)';
const BASE_THEME = 'Delegación y Empoderamiento';

function isoOffset(minutesAgo: number): string {
  return new Date(Date.now() - minutesAgo * 60 * 1000).toISOString();
}

function buildStageHistoryUpTo(targetStage: StageNumber, markTargetCompleted: boolean): StageHistoryItem[] {
  const history: StageHistoryItem[] = [];
  for (let s = 1; s <= targetStage; s++) {
    const st = s as StageNumber;
    const enteredAgo = (8 - s) * 18;
    const isCompleted = s < targetStage || (s === targetStage && markTargetCompleted);
    history.push({
      stage: st,
      stageName: STAGE_NAMES[st],
      enteredAt: isoOffset(enteredAgo),
      ...(isCompleted
        ? {
            completedAt: isoOffset(enteredAgo - 12),
            durationMinutes: 12,
          }
        : {}),
    });
  }
  return history;
}

function buildSkillEntriesForStage(includeStage4Evidence: boolean): LeadershipSkillEntry[] {
  const now2 = isoOffset(80);
  const now4 = isoOffset(35);

  const delegationEvidence: ObservedEvidenceRecord[] = [
    {
      id: 'ev_qa_del_s2',
      stage: 2,
      sourceType: 'experiencia_relatada',
      evidenceText:
        'La líder reconoció que al asignar cuentas nuevas no especifica el criterio de éxito ni el margen de decisión del ejecutivo, provocando consultas constantes.',
      timestamp: now2,
    },
  ];
  if (includeStage4Evidence) {
    delegationEvidence.push({
      id: 'ev_qa_del_s4',
      stage: 4,
      sourceType: 'simulacion_practica',
      evidenceText:
        'En la simulación formuló con claridad el objetivo del cierre semanal, el límite de descuento autorizado y la fecha única de revisión.',
      timestamp: now4,
    });
  }

  const feedbackEvidence: ObservedEvidenceRecord[] = [
    {
      id: 'ev_qa_fb_s2',
      stage: 2,
      sourceType: 'experiencia_relatada',
      evidenceText:
        'Señaló que cuando detecta un error en una cotización lo corrige personalmente para ahorrar tiempo en lugar de retroalimentar al colaborador.',
      timestamp: now2,
    },
  ];
  if (includeStage4Evidence) {
    feedbackEvidence.push({
      id: 'ev_qa_fb_s4',
      stage: 4,
      sourceType: 'simulacion_practica',
      evidenceText:
        'Practicó preguntar primero el razonamiento de su colaborador antes de ofrecer ajustes concretos sin asumir el control de la tarea.',
      timestamp: now4,
    });
  }

  return [
    {
      skill: 'Delegación Efectiva y Empoderamiento',
      cluster: 'delegacion',
      status: 'vigente',
      initialStage: 2,
      evidenceHistory: delegationEvidence,
      reconsiderationHistory: [],
      lastUpdatedStage: includeStage4Evidence ? 4 : 2,
      createdAt: now2,
      updatedAt: includeStage4Evidence ? now4 : now2,
    },
    {
      skill: 'Retroalimentación Basada en Hechos',
      cluster: 'retroalimentacion',
      status: 'vigente',
      initialStage: 2,
      evidenceHistory: feedbackEvidence,
      reconsiderationHistory: [],
      lastUpdatedStage: includeStage4Evidence ? 4 : 2,
      createdAt: now2,
      updatedAt: includeStage4Evidence ? now4 : now2,
    },
  ];
}

function buildPriorMessages(sessionId: string, upToCompletedStage: number): MentorshipMessage[] {
  const msgs: MentorshipMessage[] = [];
  const pushMsg = (sender: 'leader' | 'lidacta', stage: StageNumber, text: string, minsAgo: number, suffix: string) => {
    msgs.push({
      id: `msg_qa_${stage}_${suffix}_${Date.now()}`,
      caseId: sessionId,
      mentorshipId: sessionId,
      sender,
      stage,
      text,
      timestamp: isoOffset(minsAgo),
      isLeaderVoiceQuote: sender === 'leader' && text.length < 140,
    });
  };

  if (upToCompletedStage >= 1) {
    pushMsg('leader', 1, BASE_CHALLENGE, 110, 's1_1');
    pushMsg(
      'lidacta',
      1,
      'Gracias por compartirlo con tanta claridad, Laura. Cuando mencionas que intervienes si algo no queda como esperabas, ¿en qué momentos específicos sientes mayor urgencia por retomar el control y qué ocurre si dejas que tu equipo entregue la primera versión sin tu revisión previa?',
      108,
      's1_2'
    );
    pushMsg(
      'leader',
      1,
      'Sobre todo pasa en las cotizaciones con clientes clave y en el seguimiento semanal. Si no reviso antes, temo que enviemos condiciones imprecisas, pero al mismo tiempo ellos ya ni intentan proponer una solución por sí mismos.',
      105,
      's1_3'
    );
    pushMsg(
      'lidacta',
      1,
      'Resumo lo que hemos identificado para confirmar que vamos en la misma línea:\n\n• **Hechos / Situación:** Tu equipo comercial de seis personas te consulta casi todas las decisiones operativas y tú terminas corrigiendo cotizaciones y seguimientos clave.\n• **Dilema:** Quieres fortalecer la autonomía del equipo, pero el temor a errores frente a clientes clave te lleva a supervisar y resolver personalmente.\n• **Impacto / Reto principal:** Se genera dependencia operativa en tu rol y se frena la iniciativa y el criterio propio de tus colaboradores.\n\n¿Refleja esto con precisión lo que estás viviendo?',
      102,
      's1_4'
    );
    pushMsg('leader', 1, 'Sí, exactamente eso es lo que está ocurriendo en el día a día.', 99, 's1_5');
    pushMsg(
      'lidacta',
      1,
      'Excelente, ya tenemos una base clara del desafío. Cuando gustes puedes avanzar a la Etapa 2 para analizar perspectivas y habilidades.',
      97,
      's1_6'
    );
  }

  if (upToCompletedStage >= 2) {
    pushMsg(
      'lidacta',
      2,
      'En esta Etapa 2, observando la dinámica con tu equipo comercial: ¿qué parte de tu propia forma de delegar consideras que hoy facilita sin querer que tus colaboradores te consulten todo, y qué habilidades clave sientes necesario fortalecer?',
      92,
      's2_1'
    );
    pushMsg(
      'leader',
      2,
      'Me doy cuenta de que al delegar pido el resultado final sin aclarar hasta dónde pueden decidir solos ni qué criterios voy a evaluar. Y cuando hay un error en una cotización, prefiero corregirlo yo rápido en lugar de sentarme a darles retroalimentación para que lo ajusten ellos.',
      88,
      's2_2'
    );
    pushMsg(
      'lidacta',
      2,
      'Es un hallazgo muy valioso. A partir de lo que compartes, emergen dos habilidades centrales para trabajar en este caso: **Delegación con criterios claros** y **Retroalimentación formativa sin microgestión**. ¿Te hace sentido enfocarnos en estas dos habilidades para diseñar alternativas?',
      84,
      's2_3'
    );
    pushMsg('leader', 2, 'Sí, totalmente. Me hace mucho sentido trabajar ambas.', 81, 's2_4');
  }

  if (upToCompletedStage >= 3) {
    pushMsg(
      'lidacta',
      3,
      'Con la claridad sobre tus habilidades clave, diseñemos opciones reales. ¿Qué dos o tres alternativas distintas podrías aplicar con tu equipo esta semana para transferir criterio sin exponer al cliente a errores graves?',
      74,
      's3_1'
    );
    pushMsg(
      'leader',
      3,
      'Alternativa 1: Definir una matriz simple de niveles de autonomía (qué pueden aprobar solos y qué requiere validación). Alternativa 2: Acordar revisiones breves por hitos con los dos ejecutivos senior antes de cerrar la propuesta, pidiendo primero su recomendación en lugar de darles la respuesta.',
      69,
      's3_2'
    );
    pushMsg(
      'lidacta',
      3,
      'Son dos alternativas muy complementarias y aterrizadas. Si tuvieras que elegir un camino principal para ponerlo a prueba primero con tus dos ejecutivos senior, ¿cuál elegirías y qué riesgo o resistencia necesitarías cuidar?',
      64,
      's3_3'
    );
    pushMsg(
      'leader',
      3,
      'Elijo combinar ambas: acordar criterios explícitos de autonomía y revisar avances por hitos con mis dos ejecutivos senior, pidiéndoles siempre su propuesta antes de intervenir.',
      60,
      's3_4'
    );
  }

  if (upToCompletedStage >= 4) {
    pushMsg(
      'lidacta',
      4,
      'Practiquemos esta conversación antes de tenerla. Imagina que soy Andrés, tu ejecutivo senior, y acabo de escribirte: «Laura, ¿puedes revisar esta cotización antes de mandarla y decirme qué descuento autorizamos?». ¿Qué le responderías?',
      52,
      's4_1'
    );
    pushMsg(
      'leader',
      4,
      'Andrés, antes de revisarla juntos, cuéntame qué margen propones según el límite del 8% que acordamos y qué riesgos ves en la cuenta. Lo revisamos 10 minutos a las 4 pm.',
      46,
      's4_2'
    );
    pushMsg(
      'lidacta',
      4,
      'Muy bien resuelto: devolviste la responsabilidad con calma, recordaste el parámetro de autonomía (8%) y acotaste el espacio de revisión sin hacer el trabajo por él. Con esto tienes la práctica lista para estructurar tu Plan de Acción en la Etapa 5.',
      41,
      's4_3'
    );
  }

  return msgs;
}

const DEFAULT_STAGE5_PLAN: MentorshipActionPlan = {
  what: 'Realizar una sesión de alineación con los 2 ejecutivos senior para establecer criterios de autonomía (descuentos hasta 8%) y pactar revisión por hitos sin corregir sus cotizaciones directamente.',
  when: 'Este jueves de 09:30 a 10:15 hrs en sala de juntas comercial.',
  withWhom: 'Andrés Salgado y Valeria Ríos (ejecutivos comerciales senior).',
  how: 'Presentar la matriz de niveles de decisión en 3 rubros, escuchar sus dudas sobre casos límite y acordar que toda consulta venga acompañada de su propia recomendación.',
  careReminders: 'Evitar resolver el documento por ellos; formular preguntas abiertas («¿qué propones?») y sostener la escucha activa.',
  shareWithHR: false,
  shareActionPlanWithHR: false,
  actionPlanShared: false,
  isCompleted: false,
  isCommitmentConfirmed: true,
};

const DEFAULT_STAGE6_LEARNINGS: MentorshipLearnings = {
  whatHappened:
    'Tuve la reunión el jueves; al inicio Andrés dudó en proponer el descuento por temor a equivocarse, pero al recordarle el margen del 8% presentó dos escenarios bien sustentados y cerró la cotización sin mi intervención directa.',
  whatWorked:
    'Pedir primero su recomendación escrita y haber delimitado el margen autorizado de decisión redujo en más de la mitad las interrupciones operativas durante la semana.',
  whatDidnt:
    'Al principio estuve a punto de editar una frase de su propuesta, pero me detuve y se lo planteé como pregunta.',
  insights:
    'Cuando explicito los criterios de decisión y tolero pequeños ajustes de estilo, el equipo asume responsabilidad real y yo recupero tiempo estratégico.',
  futureAdjustments:
    'Extender la matriz de autonomía al resto de los 4 ejecutivos en la junta semanal del próximo lunes.',
  sharedLearningWithHR: '',
  sharedReflectionToHR: '',
};

/**
 * Construye un objeto MentorshipSession coherente e aislado (isTestSession: true)
 * posicionado directamente en cualquiera de las 7 etapas de Lidacta.
 */
export function buildTestSessionForStage(
  stage: StageNumber,
  stage6Scenario: ActionPlanExecutionStatus = 'pending_verification',
  leaderProfile: UserProfile = QA_TEST_LEADER_PROFILE
): MentorshipSession {
  const uniqueSuffix = `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const sessionId = `ment_qa_s${stage}_${uniqueSuffix}`;
  const now = new Date().toISOString();
  const stageOption = TEST_STAGE_OPTIONS.find((o) => o.stage === stage);
  const scenarioLabel =
    stage === 6
      ? `${stageOption?.label || 'Etapa 6'} (${
          TEST_STAGE6_SCENARIOS.find((s) => s.id === stage6Scenario)?.label || stage6Scenario
        })`
      : stageOption?.label || `Etapa ${stage}`;

  const skillEntries = stage >= 3 ? buildSkillEntriesForStage(stage >= 5) : [];
  const identifiedSkills = skillEntries.length > 0 ? getActiveSkillNames(skillEntries) : [];

  const leaderAlternatives =
    stage >= 4
      ? [
          'Definir una matriz simple de niveles de autonomía (qué pueden aprobar solos y qué requiere validación).',
          'Acordar revisiones breves por hitos con los dos ejecutivos senior pidiendo primero su recomendación.',
        ]
      : undefined;

  const suggestedAlternatives =
    stage >= 4
      ? [
          'Matriz de niveles de decisión por monto/riesgo',
          'Revisión por hitos con recomendación previa del colaborador',
        ]
      : undefined;

  const chosenAlternative =
    stage >= 4
      ? 'Acordar criterios explícitos de autonomía (margen del 8%) y revisar avances por hitos con los 2 ejecutivos senior pidiéndoles su propuesta antes de intervenir.'
      : undefined;

  // Messages strictly cover prior completed stages, plus target stage setup when required
  const completedPriorStage = stage - 1;
  const messages: MentorshipMessage[] =
    stage === 1
      ? [
          {
            id: `msg_qa_s1_init_${uniqueSuffix}`,
            caseId: sessionId,
            mentorshipId: sessionId,
            sender: 'leader',
            text: BASE_CHALLENGE,
            timestamp: isoOffset(5),
            stage: 1,
          },
        ]
      : buildPriorMessages(sessionId, completedPriorStage);

  let actionPlan: MentorshipActionPlan | undefined;
  let actionPlanExecutionStatus: ActionPlanExecutionStatus | undefined;
  let stage6ExecutionVerified: boolean | undefined;
  let learnings: MentorshipLearnings | undefined;

  if (stage >= 6) {
    const isExecuted = stage === 7 || stage6Scenario === 'executed';
    actionPlan = {
      ...DEFAULT_STAGE5_PLAN,
      stage5EnteredAt: isoOffset(30),
      isCompleted: isExecuted,
      ...(isExecuted ? { completedAt: isoOffset(15) } : {}),
    };
  }

  if (stage === 6) {
    actionPlanExecutionStatus = stage6Scenario;
    stage6ExecutionVerified = stage6Scenario !== 'pending_verification';

    const verificationPromptText = `Llegamos a la Etapa 6: Aprender y reflexionar.\n\nTu compromiso registrado en la Etapa 5 fue:\n• **Acción:** ${DEFAULT_STAGE5_PLAN.what}\n• **Momento:** ${DEFAULT_STAGE5_PLAN.when}\n• **Con quién:** ${DEFAULT_STAGE5_PLAN.withWhom}\n\nAntes de comenzar con las preguntas de reflexión, quiero verificar cómo te fue con tu compromiso:\n\n**¿Ya ejecutaste tu Plan de Acción?**`;

    messages.push({
      id: `msg_qa_s6_verify_${uniqueSuffix}`,
      caseId: sessionId,
      mentorshipId: sessionId,
      sender: 'lidacta',
      text: verificationPromptText,
      timestamp: isoOffset(2),
      stage: 6,
    });

    if (stage6Scenario === 'executed') {
      messages.push({
        id: `msg_qa_s6_yes_${uniqueSuffix}`,
        caseId: sessionId,
        mentorshipId: sessionId,
        sender: 'leader',
        text: 'Sí, ya ejecuté mi Plan de Acción.',
        timestamp: isoOffset(1),
        stage: 6,
        isLeaderVoiceQuote: true,
      });
    } else if (stage6Scenario === 'not_executed') {
      messages.push({
        id: `msg_qa_s6_no_${uniqueSuffix}`,
        caseId: sessionId,
        mentorshipId: sessionId,
        sender: 'leader',
        text: 'No, todavía no he ejecutado mi Plan de Acción.',
        timestamp: isoOffset(1),
        stage: 6,
        isLeaderVoiceQuote: true,
      });
    }
  }

  if (stage === 7) {
    actionPlanExecutionStatus = 'executed';
    stage6ExecutionVerified = true;
    learnings = { ...DEFAULT_STAGE6_LEARNINGS };

    messages.push(
      {
        id: `msg_qa_s6_verify_${uniqueSuffix}`,
        caseId: sessionId,
        mentorshipId: sessionId,
        sender: 'lidacta',
        text: 'Llegamos a la Etapa 6: Aprender y reflexionar. ¿Ya ejecutaste tu Plan de Acción?',
        timestamp: isoOffset(25),
        stage: 6,
      },
      {
        id: `msg_qa_s6_yes_${uniqueSuffix}`,
        caseId: sessionId,
        mentorshipId: sessionId,
        sender: 'leader',
        text: 'Sí, ya ejecuté mi Plan de Acción.',
        timestamp: isoOffset(22),
        stage: 6,
        isLeaderVoiceQuote: true,
      },
      {
        id: `msg_qa_s6_reflect_q_${uniqueSuffix}`,
        caseId: sessionId,
        mentorshipId: sessionId,
        sender: 'lidacta',
        text: 'Gracias por confirmarlo. ¿Qué ocurrió exactamente al sostener la sesión con Andrés y Valeria, qué funcionó y qué te llevas para futuros casos?',
        timestamp: isoOffset(18),
        stage: 6,
      },
      {
        id: `msg_qa_s6_reflect_a_${uniqueSuffix}`,
        caseId: sessionId,
        mentorshipId: sessionId,
        sender: 'leader',
        text: 'Al principio dudaron, pero al recordarles el límite del 8% y pedirles primero su recomendación, presentaron dos escenarios sólidos y cerraron la cotización sin que yo corrigiera el archivo. Aprendí que clarificar criterios reduce interrupciones y fortalece su criterio.',
        timestamp: isoOffset(14),
        stage: 6,
      }
    );
  }

  return {
    id: sessionId,
    leaderId: leaderProfile.id,
    leaderName: leaderProfile.name,
    companyId: leaderProfile.companyId,
    companyName: leaderProfile.companyName,
    leaderArea: leaderProfile.area,
    title: `[QA E${stage}${stage === 6 ? ` · ${stage6Scenario === 'executed' ? 'Sí' : stage6Scenario === 'not_executed' ? 'No' : 'Pend.'}` : ''}] ${BASE_TITLE}`,
    initialChallenge: BASE_CHALLENGE,
    currentStage: stage,
    stageHistory: buildStageHistoryUpTo(stage, stage === 7),
    messages,
    stageReadyToAdvance: null,
    theme: BASE_THEME,
    status: stage === 7 ? 'completed' : stage >= 5 ? 'in_action' : 'active',
    priority: 'media',
    startedAt: isoOffset(stage === 1 ? 5 : 115),
    lastActiveAt: now,
    ...(stage === 7 ? { completedAt: now } : {}),
    ...(stage >= 5 ? { stage5EnteredAt: isoOffset(stage === 5 ? 2 : 30) } : {}),
    ...(actionPlanExecutionStatus ? { actionPlanExecutionStatus } : {}),
    ...(stage6ExecutionVerified !== undefined ? { stage6ExecutionVerified } : {}),
    identifiedSkills,
    skillEntries,
    ...(leaderAlternatives ? { leaderAlternatives } : {}),
    ...(suggestedAlternatives ? { suggestedAlternatives } : {}),
    ...(chosenAlternative ? { chosenAlternative } : {}),
    ...(stage >= 5
      ? {
          wantsPractice: true,
          practiceFeedback:
            'La líder devolvió la responsabilidad operativa con calma, delimitó el margen autorizado y pactó una revisión breve sin resolver la tarea.',
        }
      : {}),
    ...(actionPlan ? { actionPlan } : {}),
    ...(learnings ? { learnings } : {}),
    isTestSession: true,
    testScenarioLabel: scenarioLabel,
  };
}
