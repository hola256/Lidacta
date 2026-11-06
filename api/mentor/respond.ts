const STAGE_NAMES: Record<number, string> = {
  1: 'Detectar qué sucede',
  2: 'Analizar perspectivas y habilidades',
  3: 'Diseñar alternativas',
  4: 'Practicar antes de actuar',
  5: 'Actuar (Plan de Acción)',
  6: 'Aprender y reflexionar',
  7: 'Cierre y retroalimentación',
};

function extractDiagnosticVariables(
  history: any[],
  currentMsg: string,
  leaderName: string,
  sessionContext?: any
) {
  const allUserTexts: string[] = [];
  if (sessionContext?.title) {
    allUserTexts.push(sessionContext.title);
  }
  if (sessionContext?.initialChallenge) {
    allUserTexts.push(sessionContext.initialChallenge);
  }
  for (const m of history || []) {
    const txt = (m.text || m.content || '').trim();
    if (txt) allUserTexts.push(txt);
  }
  if (currentMsg) {
    allUserTexts.push(currentMsg.trim());
  }

  const combinedText = allUserTexts.join(' ');
  const lower = combinedText.toLowerCase();

  // 1. Detect salary / compensation / money / raise / counteroffer
  const isSalaryCase = [
    'sueldo', 'salario', 'aumento', 'aumento de sueldo', 'aumento salarial', 'pagar', 'paga',
    'remuneracion', 'remuneración', 'compensacion', 'compensación', 'tabulador', 'dinero',
    'aumenten', 'aumentar', 'renuncia', 'irse por dinero', 'oferta económica', 'oferta economica',
    'ganar mas', 'ganar más', 'exige aumento', 'exigiendo sueldo', 'pide aumento'
  ].some((k) => lower.includes(k));

  // 2. Detect shift handoff / logs / veteran resistance
  const isShiftLogCase = [
    'bitacora', 'bitácora', 'cambio de turno', 'relevo de turno', 'supervisor veterano',
    'prensas', 'celda robótica', 'ernesto'
  ].some((k) => lower.includes(k));

  // 3. Detect delegation / audit / micromanagement
  const isDelegationCase = [
    'delegar', 'delegación', 'delegacion', 'auditoría', 'auditoria', 'iatf', 'absorber',
    'novato', 'novatos', 'revisar todo', 'cuello de botella', 'supervisores novatos'
  ].some((k) => lower.includes(k));

  // 4. Detect customer / client conflict (ONLY if actually mentioned!)
  const isClientCase = [
    'cliente', 'queja de cliente', 'entrega al cliente', 'pedido del cliente', 'proveedor'
  ].some((k) => lower.includes(k));

  // 5. Detect performance / task non-compliance
  const isTaskNonComplianceCase = [
    'entrega', 'entregable', 'plazo', 'fecha límite', 'fecha limite', 'no cumple', 'incumple',
    'retraso', 'desempeño', 'desempeno', 'resultados', 'metas'
  ].some((k) => lower.includes(k));

  // 6. Detect interpersonal friction / attitude / resistance
  const isAttitudeCase = [
    'actitud', 'defensiva', 'desmotivacion', 'desmotivación', 'apatía', 'apatia', 'resistencia',
    'conflicto', 'roce', 'desacuerdo', 'quejas'
  ].some((k) => lower.includes(k));

  // Formulate Conflicto Visible based on actual case
  let visibleConflict = '';
  if (isSalaryCase) {
    visibleConflict = 'La exigencia o solicitud de ajuste salarial planteada por el colaborador y la expectativa de una resolución económica inmediata.';
  } else if (isShiftLogCase) {
    visibleConflict = 'La omisión en la entrega oportuna de las bitácoras y registros operativos durante el cambio de turno.';
  } else if (isDelegationCase) {
    visibleConflict = 'La absorción de revisiones operativas por temor a que el equipo cometa omisiones o no conformidades.';
  } else if (isClientCase) {
    visibleConflict = 'El roce operativo con el cliente y los compromisos de entrega o servicio afectados por la situación.';
  } else if (isTaskNonComplianceCase) {
    visibleConflict = 'El incumplimiento o desfase en los entregables y tareas prioritarias asignadas al equipo.';
  } else if (isAttitudeCase) {
    visibleConflict = 'La postura a la defensiva o falta de alineación en las dinámicas y compromisos de trabajo cotidianos.';
  } else {
    const rawSnippet = (sessionContext?.initialChallenge || sessionContext?.title || currentMsg || '').replace(/\s+/g, ' ').trim();
    const snippet = rawSnippet ? rawSnippet.slice(0, 95) : 'la situación operativa y los acuerdos de trabajo';
    visibleConflict = `La situación observada en tu equipo sobre: "${snippet}${rawSnippet.length > 95 ? '...' : ''}".`;
  }

  // Formulate Tensión Subyacente based on actual case
  let underlyingTension = '';
  if (isSalaryCase) {
    underlyingTension = 'El dilema entre reconocer el valor del colaborador frente a las políticas de tabulador o posibilidades reales de la empresa, sumado a la incertidumbre sobre cómo sostener la motivación si no se puede conceder el monto exigido.';
  } else if (isShiftLogCase) {
    underlyingTension = 'La fricción entre respetar la trayectoria del colaborador y la exigencia innegociable de disciplina y trazabilidad operativa.';
  } else if (isDelegationCase) {
    underlyingTension = 'La contradicción entre la necesidad de desarrollar autonomía en los supervisores y el riesgo de soltar el control ante una evaluación crítica.';
  } else if (isClientCase) {
    underlyingTension = 'La presión de equilibrar la satisfacción del cliente con las capacidades reales y tiempos de respuesta de tu equipo.';
  } else {
    const mentionsBoss = ['jefe', 'director', 'gerencia', 'liderazgo superior', 'directora'].some((k) => lower.includes(k));
    if (mentionsBoss) {
      underlyingTension = 'La presión vertical de responder a las expectativas de la dirección mientras gestionas la capacidad y bienestar de tu equipo.';
    } else {
      underlyingTension = 'Las expectativas y percepciones no alineadas entre lo que necesitas asegurar como líder y lo que la otra parte está buscando o experimentando.';
    }
  }

  // Formulate Impacto Emocional/Operativo based on actual case
  let emotionalImpact = '';
  const expressesFatigue = ['cansad', 'agota', 'harto', 'frustra', 'estres', 'estrés', 'abrumad', 'desgaste'].some((k) => lower.includes(k));
  if (isSalaryCase) {
    emotionalImpact = expressesFatigue
      ? 'La sensación de desgaste e incertidumbre al gestionar una conversación económica delicada sin desmotivar al colaborador ni sentar un precedente inviable.'
      : 'La preocupación por mantener la estabilidad del equipo y la carga de encontrar una salida justa y viable para ambas partes.';
  } else if (isShiftLogCase) {
    emotionalImpact = 'El desgaste de reiterar requerimientos básicos y la incomodidad de confrontar a alguien experimentado sin generar fracturas en piso.';
  } else if (isDelegationCase) {
    emotionalImpact = 'El agotamiento físico y mental de cargar con revisiones detalladas, posponiendo tus responsabilidades estratégicas de liderazgo.';
  } else {
    emotionalImpact = expressesFatigue
      ? 'El desgaste acumulado de asumir toda la carga y el estrés de evitar que la situación escale o afecte al resto del equipo.'
      : 'La sobrecarga mental y la inquietud por resolver de raíz una situación que consume tiempo y energía de tu rol como líder.';
  }

  return { visibleConflict, underlyingTension, emotionalImpact };
}

function generateContextualCoachReply(
  stage: number,
  leaderName: string,
  userMsg: string,
  history: any[],
  sessionContext?: any
): {
  replyText: string;
  readyToAdvance: boolean;
  advancePrompt: string | null;
  detectedTheme: string;
  identifiedSkills?: string[];
  isTherapeuticCase: boolean;
} {
  const cleanMsg = (userMsg || '').trim();
  const lowerMsg = cleanMsg.toLowerCase();

  // Therapeutic detection guardrail
  const therapeuticTerms = [
    'depresión', 'depresion', 'ansiedad clínica', 'ataque de pánico',
    'ideación suicida', 'suicidio', 'autolesión', 'no quiero vivir',
    'pastillas para dormir', 'crisis emocional severa',
  ];
  if (therapeuticTerms.some((t) => lowerMsg.includes(t))) {
    return {
      replyText: `Agradezco profundamente la confianza con la que compartes esto. Como mentora en Lidacta, mi labor se centra exclusivamente en el desarrollo de liderazgo y acuerdos laborales entre equipos. Por tu bienestar integral, este tipo de situación amerita el apoyo de un profesional de la salud mental o del área de bienestar de tu empresa. Permanezco a tu lado para cuando desees trabajar cualquier reto sobre tus equipos y liderazgo.`,
      readyToAdvance: false,
      advancePrompt: null,
      detectedTheme: 'Orientación y Límite de Rol',
      isTherapeuticCase: true,
    };
  }

  // Regla 1: Escucha activa y flexibilidad obligatoria (Petición de NO avanzar / entender mejor)
  const wantsToPauseOrNotAdvance = [
    'no quiero avanzar', 'no avancemos', 'no pasar a la etapa 2', 'no quiero pasar a la etapa 2',
    'espera', 'esperate', 'espérate', 'aun no', 'aún no', 'todavia no', 'todavía no',
    'no estoy listo', 'no tan rapido', 'no tan rápido', 'despacio', 'vamos muy rapido', 'vamos muy rápido',
    'necesito entender', 'entender mejor', 'profundizar', 'desglosar', 'desglosa',
    'ayudame a entender', 'ayúdame a entender', 'variables', 'muchas cosas mezcladas',
    'no entiendo las variables', 'analizar mejor', 'detengamonos', 'detengámonos',
    'quiero profundizar', 'desglosame', 'desglósame', 'no pasar', 'detenernos',
    'ir despacio', 'frena', 'frenemos', 'parar', 'no avanzar'
  ].some((t) => lowerMsg.includes(t));

  // Regla 2: Formato de Desglose Diagnóstico cuando el usuario pide ayuda para desglosar o entender
  if (wantsToPauseOrNotAdvance && stage === 1) {
    const { visibleConflict, underlyingTension, emotionalImpact } = extractDiagnosticVariables(history, cleanMsg, leaderName, sessionContext);
    return {
      replyText: `Te escucho con total atención, ${leaderName}. Frenamos el paso: no vamos a avanzar a la Etapa 2 hasta que tengamos total claridad sobre lo que estás viviendo.\n\nPara devolverte valor visible y ayudarte a ordenar las variables que hoy se sienten mezcladas, desgloso lo que he escuchado en tu relato:\n\n• **Conflicto visible:** ${visibleConflict}\n• **Tensión subyacente:** ${underlyingTension}\n• **Impacto emocional/operativo:** ${emotionalImpact}\n\nMirando este mapa con calma:\n1. De estos tres frentes, ¿cuál sientes que es el que genera mayor fricción o te cuesta más trabajo manejar en este momento?\n2. ¿Sientes que este desglose captura con precisión lo que estás viviendo, o hay alguna variable clave que se nos esté escapando?`,
      readyToAdvance: false,
      advancePrompt: null,
      detectedTheme: 'Desglose Diagnóstico',
      isTherapeuticCase: false,
    };
  }

  // Regla 3: Cierre de Etapa 1 guiado (Solo cuando el usuario confirme expresamente que el desglose tiene sentido)
  const userConfirmsBreakdownOrReady = [
    'tiene sentido', 'tiene todo el sentido', 'totalmente', 'exacto',
    'asi es', 'así es', 'de acuerdo', 'estoy listo', 'ahora si', 'ahora sí',
    'avancemos', 'pasemos a la etapa 2', 'listo para avanzar', 'me queda claro',
    'tiene mucha razon', 'tiene mucha razón', 'me hace sentido', 'hace sentido',
    'me parece bien avanzar', 'podemos pasar a la etapa 2', 'pasemos a la siguiente'
  ].some((t) => lowerMsg.includes(t));

  if (userConfirmsBreakdownOrReady && stage === 1) {
    return {
      replyText: `Me alegra que este mapa te dé claridad y ordene el panorama, ${leaderName}. Ahora que las variables clave están comprendidas y hacen sentido para ti, ¿estás de acuerdo en que demos el paso a la Etapa 2 para analizar las perspectivas y habilidades requeridas?`,
      readyToAdvance: true,
      advancePrompt: 'Avanzar a Etapa 2: Analizar perspectivas y habilidades',
      detectedTheme: 'Cierre de Etapa 1 Guiado',
      isTherapeuticCase: false,
    };
  }

  // Detección de confusión o solicitud de aclaración
  const isConfusion = [
    'no entiendo', 'no comprendo', 'a que te refieres', 'a qué te refieres',
    'como que', 'cómo que', 'como asi', 'cómo así', 'no se que responder',
    'no sé qué responder', 'no se a que te refieres', 'no sé a qué te refieres',
    'explicate', 'explícate', 'a que te refieres con', 'a qué te refieres con',
    'no me queda claro', 'que significa', 'qué significa', 'a que te refieres exactamente',
    'no entendi', 'no entendí', 'no te sigo', 'no te comprendo', 'de que hablas', 'de qué hablas'
  ].some((t) => lowerMsg.includes(t));

  if (isConfusion) {
    if (stage === 1) {
      const { visibleConflict, underlyingTension, emotionalImpact } = extractDiagnosticVariables(history, cleanMsg, leaderName, sessionContext);
      return {
        replyText: `Te lo planteo de forma muy simple y cotidiana, ${leaderName}: a veces postergamos una charla o decisión difícil porque tenemos muchas cosas urgentes en el día a día. Para verlo claro:\n\n• **Conflicto visible:** ${visibleConflict}\n• **Tensión subyacente:** ${underlyingTension}\n• **Impacto emocional/operativo:** ${emotionalImpact}\n\n¿Cuál de estos tres puntos crees que es la verdadera causa raíz de lo que está pasando?`,
        readyToAdvance: false,
        advancePrompt: null,
        detectedTheme: 'Clarificación de Situación',
        isTherapeuticCase: false,
      };
    }
    if (stage === 2) {
      return {
        replyText: `Aterricémoslo con un ejemplo sencillo, ${leaderName}: si le preguntáramos a la otra persona involucrada qué opina de este problema, ¿qué crees que nos diría? Mirarlo desde sus ojos nos permite identificar qué habilidad de comunicación o firmeza necesitas activar tú.`,
        readyToAdvance: false,
        advancePrompt: null,
        detectedTheme: 'Perspectivas y Habilidades',
        isTherapeuticCase: false,
      };
    }
  }

  // Si el líder señala que una pregunta se repite, validar con empatía y pivotar a otra variable sin avanzar
  const isQuestionRepetitionComplaint = [
    'de nuevo la misma pregunta', 'otra vez la misma pregunta', 'ya te respondí esa pregunta',
    'ya te respondi esa pregunta', 'ya te contesté eso', 'ya te conteste eso', 'repetitivo'
  ].some((t) => lowerMsg.includes(t));

  // Extraer preguntas previas de Lidacta para evitar repetir
  const prevLidactaTexts = (history || [])
    .filter((m: any) => m.sender === 'lidacta' || m.role === 'model')
    .map((m: any) => (m.text || m.content || '').toLowerCase());

  const askedSeniorityOrProfile = prevLidactaTexts.some((t: string) =>
    t.includes('antigüedad') || t.includes('perfil') || t.includes('tiempo lleva') || t.includes('relación de trabajo')
  );
  const askedSpecificTasks = prevLidactaTexts.some((t: string) =>
    t.includes('tareas específicas') || t.includes('entregables específicos') || t.includes('respuesta exacta') || t.includes('conducta exacta')
  );
  const askedPreviousAttemptsOrHR = prevLidactaTexts.some((t: string) =>
    t.includes('recursos humanos') || t.includes('intentos previos') || t.includes('conversaciones de retroalimentación') || t.includes('intervenido recursos')
  );
  const askedOutcomeOrRoot = prevLidactaTexts.some((t: string) =>
    t.includes('obstáculo de fondo') || t.includes('frena para resolver') || t.includes('resultado concreto')
  );

  if (isQuestionRepetitionComplaint && stage === 1) {
    if (!askedSpecificTasks) {
      return {
        replyText: `Agradezco tu aclaración, ${leaderName}. Tomo nota de lo que ya compartiste para no hacerte repetir. Para enfocar con precisión los hechos observables: ¿qué tareas o compromisos específicos se le han asignado recientemente a este colaborador y cuál ha sido exactamente su respuesta o conducta al no cumplirlas?`,
        readyToAdvance: false,
        advancePrompt: null,
        detectedTheme: 'Hechos Observables',
        isTherapeuticCase: false,
      };
    }
    if (!askedPreviousAttemptsOrHR) {
      return {
        replyText: `Comprendido, ${leaderName}. Vamos directo a lo que no hemos revisado: ¿qué conversaciones previas has tenido con esta persona sobre el tema, qué acuerdos se pactaron y si ha intervenido o qué conocimiento tiene Recursos Humanos?`,
        readyToAdvance: false,
        advancePrompt: null,
        detectedTheme: 'Intentos Previos y RH',
        isTherapeuticCase: false,
      };
    }
  }

  if (stage === 1) {
    // Variable 1: Antigüedad, perfil del colaborador y contexto de la relación
    if (!askedSeniorityOrProfile) {
      return {
        replyText: `Te escucho con atención, ${leaderName}. Para comprender a fondo el contexto antes de apresurarnos a conclusiones: ¿cuánto tiempo lleva este colaborador en tu equipo o en la empresa, cómo definirías su perfil habitual y cómo ha sido la relación de trabajo entre ustedes hasta antes de este problema?`,
        readyToAdvance: false,
        advancePrompt: null,
        detectedTheme: 'Perfil y Contexto Relacional',
        isTherapeuticCase: false,
      };
    }

    // Variable 2: Tareas específicas y respuesta/conducta exacta
    if (!askedSpecificTasks) {
      return {
        replyText: `Comprendo el contexto de la relación, ${leaderName}. Para aterrizar en hechos observables y evitar quedarnos en suposiciones: ¿qué tareas, proyectos o entregables específicos se le han asignado recientemente y cuál ha sido exactamente su respuesta o justificación al momento de no cumplirlas?`,
        readyToAdvance: false,
        advancePrompt: null,
        detectedTheme: 'Hechos y Tareas Específicas',
        isTherapeuticCase: false,
      };
    }

    // Variable 3: Intentos previos del líder y Recursos Humanos
    if (!askedPreviousAttemptsOrHR) {
      return {
        replyText: `Es fundamental mapear los antecedentes de la situación, ${leaderName}: ¿qué conversaciones de retroalimentación o acuerdos has intentado previamente con esta persona sobre este problema, qué compromisos se establecieron y si ha tenido conocimiento o ha intervenido Recursos Humanos?`,
        readyToAdvance: false,
        advancePrompt: null,
        detectedTheme: 'Gestiones Previas y RH',
        isTherapeuticCase: false,
      };
    }

    // Variable 4: Obstáculo de fondo y necesidad real del líder
    if (!askedOutcomeOrRoot) {
      return {
        replyText: `Tenemos los antecedentes mucho más claros, ${leaderName}. Desde tu propia vivencia y rol de liderazgo: ¿cuál sientes que es el obstáculo de fondo que más te preocupa o te frena para resolver esto, y qué resultado concreto necesitas asegurar con tu equipo?`,
        readyToAdvance: false,
        advancePrompt: null,
        detectedTheme: 'Causa Raíz y Necesidad del Líder',
        isTherapeuticCase: false,
      };
    }

    // Cierre mediante Resumen de Validación (cuando se exploraron las variables clave)
    const { visibleConflict, underlyingTension, emotionalImpact } = extractDiagnosticVariables(history, cleanMsg, leaderName, sessionContext);
    return {
      replyText: `Con esta información tenemos un panorama sólido y completo de la situación, ${leaderName}. Te comparto un breve resumen sintético de lo que hemos identificado:\n\n• **Hechos y tareas:** ${visibleConflict}\n• **Dinámica relacional y perfil:** ${underlyingTension}\n• **Antecedentes e impacto:** ${emotionalImpact}\n\n¿Este resumen refleja con claridad lo que estás viviendo o hay algún punto que quieras profundizar antes de pasar a la siguiente etapa?`,
      readyToAdvance: false,
      advancePrompt: null,
      detectedTheme: 'Resumen de Validación Etapa 1',
      isTherapeuticCase: false,
    };
  }

  if (stage === 2) {
    return {
      replyText: `Al analizar esto con mayor profundidad: si te pones en los zapatos de la otra parte, ¿cómo crees que perciben esta situación? Y desde tu rol de líder, ¿qué habilidad necesitas poner en juego para destrabarla?`,
      readyToAdvance: true,
      advancePrompt: 'Avanzar a Etapa 3: Diseñar alternativas',
      detectedTheme: 'Perspectivas y Habilidades',
      identifiedSkills: ['Comunicación Asertiva', 'Gestión de Acuerdos'],
      isTherapeuticCase: false,
    };
  }

  if (stage === 3) {
    return {
      replyText: `Tomando en cuenta lo que planteas: ¿qué alternativas de solución o caminos de acción viables visualizas tú en primer lugar para abordar esto con tu gente?`,
      readyToAdvance: true,
      advancePrompt: 'Avanzar a Etapa 4: Practicar antes de actuar',
      detectedTheme: 'Diseño de Alternativas',
      isTherapeuticCase: false,
    };
  }

  if (stage === 4) {
    return {
      replyText: `Hagamos el ensayo de la conversación. Imagina que soy la otra persona involucrada: ¿cómo abrirías el diálogo para plantear el tema con claridad y empatía? Te leo o escucho para darte retroalimentación.`,
      readyToAdvance: true,
      advancePrompt: 'Avanzar a Etapa 5: Actuar (Plan de Acción)',
      detectedTheme: 'Práctica de Conversación',
      isTherapeuticCase: false,
    };
  }

  if (stage === 5) {
    return {
      replyText: `Concretemos tu plan: ¿qué harás exactamente, en qué fecha y hora específica, y con quién?`,
      readyToAdvance: true,
      advancePrompt: 'Avanzar a Etapa 6: Aprender y reflexionar',
      detectedTheme: 'Plan de Acción',
      isTherapeuticCase: false,
    };
  }

  if (stage === 6) {
    return {
      replyText: `Al revisar lo ocurrido tras ejecutar la acción: ¿qué funcionó según lo previsto, qué te sorprendió y qué aprendizaje te llevas sobre tu estilo de liderazgo?`,
      readyToAdvance: true,
      advancePrompt: 'Avanzar a Etapa 7: Cierre y retroalimentación',
      detectedTheme: 'Aprendizaje y Reflexión',
      isTherapeuticCase: false,
    };
  }

  return {
    replyText: `Has recorrido un valioso proceso de liderazgo. Reconoce tus avances y las habilidades que has puesto en práctica para mantener tu autonomía y el desarrollo de tu equipo.`,
    readyToAdvance: true,
    advancePrompt: null,
    detectedTheme: 'Cierre y Consolidación',
    isTherapeuticCase: false,
  };
}

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed. Use POST.' });
  }

  let currentStageNum = 1;
  let leaderFirstName = 'Líder';

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {
        body = {};
      }
    }

    const {
      caseId,
      mentorshipId,
      stage,
      activeStage,
      leaderProfile,
      companyContext,
      conversationHistory,
      history,
      userMessage,
      currentMessage,
      message,
      sessionData,
      isPracticeMode,
    } = body || {};

    currentStageNum = Number(stage || activeStage) || 1;
    leaderFirstName = (leaderProfile?.name || 'Líder').split(' ')[0];
    const resolvedUserMessage = (userMessage || currentMessage || message || '').trim();
    const targetCaseId = caseId || mentorshipId || sessionData?.id || '';

    const rawHistory = Array.isArray(conversationHistory)
      ? conversationHistory
      : Array.isArray(history)
      ? history
      : [];

    // STRICT CASE ISOLATION:
    // Only accept messages that belong to the active caseId / mentorshipId
    const resolvedHistory = rawHistory.filter((m: any) => {
      if (!m || typeof m !== 'object') return false;
      const mCase = m.caseId || m.mentorshipId;
      if (targetCaseId && mCase && mCase !== targetCaseId) {
        return false;
      }
      return true;
    });

    const apiKey =
      process.env.GEMINI_API_KEY ||
      process.env.API_KEY ||
      process.env.NEXT_PUBLIC_GEMINI_API_KEY;

    if (!apiKey) {
      console.warn('GEMINI_API_KEY not configured in Vercel. Generating contextual coaching reply.');
      const contextual = generateContextualCoachReply(
        currentStageNum,
        leaderFirstName,
        resolvedUserMessage,
        resolvedHistory,
        sessionData
      );
      return res.status(200).json({
        success: true,
        reply: contextual.replyText,
        text: contextual.replyText,
        data: {
          ...contextual,
          reply: contextual.replyText,
        },
      });
    }

    const systemPrompt = `Eres LIDACTA, mentora sénior y facilitadora de desarrollo de liderazgo interactivo. Tu misión es acompañar a los líderes en su entorno laboral cotidiano mediante una conversación guiada, estructurada, empática y orientada a la acción.

======================================================================
AISLAMIENTO ESTRICTO POR CASO Y CONTEXTO EXCLUSIVO (CRÍTICO)
======================================================================
1. AISLAMIENTO TOTAL POR CASO:
   - Toda tu intervención, desglose diagnóstico, preguntas y síntesis DEBEN basarse ÚNICA Y EXCLUSIVAMENTE en los hechos, personas, conductas y problemática expuestos en ESTE caso particular:
     * Caso actual: "${sessionData?.title || 'Caso actual'}"
     * Reto inicial planteado: "${sessionData?.initialChallenge || resolvedUserMessage || ''}"
   - ESTÁ TERMINANTEMENTE PROHIBIDO mezclar, inventar o arrastrar información de otros casos o pruebas previas (como conflictos con clientes, entregas de bitácoras de piso o auditorías IATF, A MENOS que el líder los haya mencionado expresamente en ESTA conversación).
   - Si el líder plantea una situación con un colaborador que exige un aumento de sueldo ("exigiendo sueldo"), tu análisis, desglose y preguntas DEBEN versar estrictamente sobre la exigencia salarial, la retención de talento, las expectativas de remuneración y la conversación difícil con ese colaborador. NUNCA introduzcas clientes ni temas ajenos.

======================================================================
REGLAS ESTRICTAS DE INTERACCIÓN (ESCÚCHAME CON ATENCIÓN)
======================================================================

1. PROHIBICIÓN ESTRICTA DE CIERRE PREMATURO (COMPRENDER ANTES DE RECOMENDAR):
   - Está TERMINANTEMENTE PROHIBIDO sugerir avanzar a la Etapa 2 o formular preguntas de cierre en la primera o segunda respuesta del usuario. "readyToAdvance" DEBE ser false.
   - Principio rector: "Comprender antes de recomendar: explorar el contexto, los hechos, las personas involucradas y la necesidad real del líder. No asumir que la primera descripción representa toda la situación".
   - Está PROHIBIDO usar plantillas fijas de cierre como "Tenemos la información clave bien delimitada" tras 2 intercambios. El cambio de etapa debe ser un proceso dinámico de mentoría, no un conteo de turnos.

2. EXPLORACIÓN OBLIGATORIA DE VARIABLES EN ETAPA 1 (PROFUNDIZACIÓN):
   Antes de dar por delimitada la Etapa 1 o formular cualquier resumen de cierre, la mentora DEBE indagar activamente sobre las siguientes variables a lo largo de la conversación (una a la vez, con tono empático y cercano):
   a) Antigüedad / perfil del colaborador y contexto de la relación de trabajo (cuánto tiempo llevan trabajando juntos, cuál es su perfil habitual y cómo ha sido la relación).
   b) Tipo de tareas específicas que se le han asignado y cuál ha sido la respuesta o conducta exacta observada (hechos concretos y verificables).
   c) Historial de intentos previos del líder para abordar el tema y qué ha intentado o recomendado Recursos Humanos.
   d) Obstáculo de fondo y necesidad real que el líder busca resolver.

3. ESCUCHA ACTIVA Y FLEXIBILIDAD OBLIGATORIA (PROHIBIDO APURAR):
   - Si el usuario dice que NO quiere avanzar, que no está listo, que va muy rápido, que necesita entender mejor la situación, o que desea profundizar en el problema:
     * Está TERMINANTEMENTE PROHIBIDO volver a preguntar si está listo para pasar a la Etapa 2.
     * Está TERMINANTEMENTE PROHIBIDO sugerir o forzar el avance de etapa.
     * Debes responder OBLIGATORIAMENTE con "readyToAdvance": false y "advancePrompt": null.

4. FORMATO DE DESGLOSE DIAGNÓSTICO (DEVOLVER VALOR VISIBLE EN ESTE CASO):
   - Cuando el usuario pida ayuda para entender las variables, desglosar el problema, o manifieste que no quiere avanzar y necesita entender mejor:
     La mentora DEBE estructurar su respuesta analizando y sintetizando activamente todo lo que ha escuchado en la conversación de ESTE caso exclusivo, devolviendo valor visible con esta estructura exacta en viñetas y negritas:
     • **Conflicto visible:** [Síntesis objetiva y concreta de la situación observable planteada por el líder en ESTE caso exclusivo (por ejemplo: la solicitud salarial del colaborador, la omisión de una tarea, o el problema operativo)].
     • **Tensión subyacente:** [Análisis de la dinámica relacional, expectativas no alineadas, jerarquía o fricción de fondo en ESTE caso exclusivo].
     • **Impacto emocional/operativo:** [Reflejo del desgaste, sobrecarga, dilema o frustración expresados por el líder en ESTE caso exclusivo].
   - Finalizarás haciendo 1 o 2 preguntas reflexivas específicas sobre esos puntos desglosados para ayudar al líder a esclarecer la causa raíz (sin preguntar sobre pasar de etapa).

5. CIERRE DE ETAPA MEDIANTE RESUMEN DE VALIDACIÓN:
   - Solo cuando se hayan explorado activamente las variables clave de la Etapa 1, Lidacta generará un breve resumen sintético de lo conversado en ESTE caso (3 a 4 puntos clave en viñetas).
   - Debe finalizar preguntando explícitamente: "¿Este resumen refleja con claridad lo que estás viviendo o hay algún punto que quieras profundizar antes de pasar a la siguiente etapa?" (con "readyToAdvance": false).
   - Solo cuando el usuario confirme o valide expresamente el resumen/mapa del problema (por ejemplo: "Tiene todo el sentido", "Exacto, así es", "De acuerdo, avancemos"), la mentora podrá validar el avance y proponer dar el paso a la Etapa 2 con "readyToAdvance": true y "advancePrompt": "Avanzar a Etapa 2: Analizar perspectivas y habilidades".

6. Límite Terapéutico: NO eres psicólogo ni das terapia. Si detectas crisis emocional clínica o terapéutica, deriva amablemente a un profesional de la salud mental sin bloquear la sesión y marca "isTherapeuticCase": true.
7. Autonomía del Líder: NO tomas decisiones por el líder; cuestionas, orientas y sugieres.
8. Cero Consejos Genéricos ni Saludos Repetitivos: Personaliza cada intervención al contexto del líder. NUNCA respondas con saludos de bienvenida genéricos repetitivos (por ejemplo: "Hola [Nombre], entiendo la situación que estás enfrentando..."). Responde de forma directa al contenido del mensaje del líder.
9. Tono: Profesional, cercano, empático, claro y ejecutivo (1 a 3 párrafos cortos). Formula UNA sola pregunta o grupo reflexivo a la vez.
10. PROHIBIDO REPETIR PREGUNTAS O COLETILLAS DE CIERRE:
   - Está terminantemente PROHIBIDO repetir la misma pregunta o coletilla de cierre en turnos consecutivos.
   - Si una pregunta ya fue realizada o el líder ya aportó información al respecto, cambia de ángulo con una pregunta diferente o profundiza en las variables clave pendientes.

Contexto de la sesión:
- Empresa: ${companyContext?.name || 'Empresa'}
- Líder: ${leaderProfile?.name || 'Líder'} (${leaderProfile?.position || 'Líder'})
- Etapa actual: Etapa ${currentStageNum} - ${STAGE_NAMES[currentStageNum] || ''}
- Caso / Reto actual: ${sessionData?.title || 'Caso actual'}
- Reto inicial: ${sessionData?.initialChallenge || resolvedUserMessage || ''}

Responde SIEMPRE en JSON estricto con esta estructura:
{
  "replyText": "Tu intervención empática, humana y reflexiva para el líder.",
  "readyToAdvance": false,
  "advancePrompt": null,
  "identifiedSkills": [],
  "detectedTheme": "Liderazgo",
  "isTherapeuticCase": false,
  "therapeuticReason": null
}`;

    // Build Gemini contents array with explicit role: "user" | "model" and strict alternation
    const contents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];

    const pushTurn = (role: 'user' | 'model', text: string) => {
      const clean = text.trim();
      if (!clean) return;
      if (contents.length === 0 && role === 'model') {
        contents.push({ role: 'user', parts: [{ text: 'Hola Lidacta, necesito apoyo con una situación de liderazgo.' }] });
      }
      const last = contents[contents.length - 1];
      if (last && last.role === role) {
        if (!last.parts[0].text.includes(clean)) {
          last.parts[0].text = `${last.parts[0].text}\n\n${clean}`;
        }
      } else {
        contents.push({
          role,
          parts: [{ text: clean }],
        });
      }
    };

    for (const msg of resolvedHistory) {
      const msgText = (msg.text || msg.content || '').trim();
      if (!msgText) continue;
      const role: 'user' | 'model' =
        msg.sender === 'leader' || msg.role === 'user' ? 'user' : 'model';
      pushTurn(role, msgText);
    }

    if (resolvedUserMessage) {
      pushTurn('user', resolvedUserMessage);
    }

    if (contents.length === 0) {
      pushTurn('user', `Hola Lidacta, estoy en la Etapa ${currentStageNum}.`);
    }

    // Try gemini-3.8-flash first as requested by Google, with graceful fallbacks
    const modelsToTry = [
      'gemini-3.8-flash',
      'gemini-1.5-flash',
      'gemini-2.0-flash',
      'gemini-2.5-flash',
    ];
    let data: any = null;
    let ok = false;

    for (const modelName of modelsToTry) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000);
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            systemInstruction: {
              parts: [{ text: systemPrompt }],
            },
            contents,
            generationConfig: {
              responseMimeType: 'application/json',
              temperature: 0.7,
            },
          }),
        });
        clearTimeout(timeoutId);

        if (response.ok) {
          data = await response.json();
          ok = true;
          break;
        }

        const errText = await response.text();
        console.warn(`Gemini API (${modelName}) returned status ${response.status}:`, errText);
      } catch (fetchErr: any) {
        clearTimeout(timeoutId);
        console.warn(`Fetch error with ${modelName}:`, fetchErr?.message || fetchErr);
      }
    }

    if (!ok || !data?.candidates?.[0]?.content?.parts?.[0]?.text) {
      const contextual = generateContextualCoachReply(
        currentStageNum,
        leaderFirstName,
        resolvedUserMessage,
        resolvedHistory
      );
      return res.status(200).json({
        success: true,
        reply: contextual.replyText,
        text: contextual.replyText,
        data: {
          ...contextual,
          reply: contextual.replyText,
        },
      });
    }

    const candidatePartText = data.candidates[0].content.parts[0].text || '';
    const rawText = candidatePartText
      .trim()
      .replace(/^```json\s*/i, '')
      .replace(/```$/i, '')
      .trim();

    let parsed: any = null;
    try {
      parsed = JSON.parse(rawText || '{}');
    } catch {
      parsed = null;
    }

    const responseText = parsed?.replyText || rawText || candidatePartText;

    return res.status(200).json({
      success: true,
      reply: responseText,
      text: responseText,
      data: parsed
        ? { ...parsed, reply: responseText, replyText: responseText }
        : { reply: responseText, replyText: responseText },
    });
  } catch (error: any) {
    console.error('Error en mentor respond:', error);
    const contextual = generateContextualCoachReply(
      currentStageNum,
      leaderFirstName,
      '',
      []
    );
    return res.status(200).json({
      success: true,
      reply: contextual.replyText,
      text: contextual.replyText,
      data: {
        ...contextual,
        reply: contextual.replyText,
      },
    });
  }
}
