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

  // Check if leader clarified that raise / increase is not viable or an option
  const raiseNotAnOption = [
    'no es opción', 'no es opcion', 'no podemos', 'no hay presupuesto', 'no es viable',
    'inviable', 'descartado', 'descartada', 'descartar el aumento', 'no aumento',
    'no podemos aumentarle', 'no se puede aumentar', 'no podemos darle', 'no está contemplado',
    'no esta contemplado'
  ].some((k) => lower.includes(k));

  // 0. Detect hierarchy / boss / disrespect friction
  const isHierarchyOrBossConflict = [
    'jefe', 'jefa', 'jefatura', 'director', 'directora', 'gerente', 'gerencia',
    'falta de respeto', 'respeto', 'me gritó', 'me grito', 'descalificó', 'descalifico',
    'humilló', 'humillo', 'maltrato', 'trato injusto', 'trato prepotente', 'prepotente',
    'mi superior', 'liderazgo superior'
  ].some((k) => lower.includes(k) || (sessionContext?.initialChallenge && sessionContext.initialChallenge.toLowerCase().includes(k)) || (sessionContext?.title && sessionContext.title.toLowerCase().includes(k)));

  // 1. EJE INAMOVIBLE: Detect disciplinary / unauthorized vacation / absence breach as primary anchor
  // ONLY if not a hierarchy / boss conflict and explicitly involves unexcused absence or vacations
  const anchorText = [
    sessionContext?.initialChallenge,
    sessionContext?.title,
    (history && history.length > 0 ? (history[0]?.text || history[0]?.content) : ''),
  ].filter(Boolean).join(' ').toLowerCase();

  const isDisciplinaryOrAbsenceCase = !isHierarchyOrBossConflict && [
    'vacacion', 'vacación', 'vacaciones', 'ausencia injustificada', 'ausencias injustificadas',
    'días sin permiso', 'dias sin permiso', 'sin autorizacion', 'sin autorización',
    'aviso por mensaje', 'avisó por mensaje', 'por whatsapp', 'notifico por mensaje', 'notificó por mensaje',
    'no vino a trabajar', 'abandono de trabajo', 'abandono de puesto', 'faltar al trabajo'
  ].some((k) => anchorText.includes(k) || lower.includes(k));

  const concernsSanctionOrReturn = !isHierarchyOrBossConflict && [
    'sancion', 'sanción', 'sancionar', 'regrese', 'vuelva', 'reincorpore', 'cuando llegue',
    'cómo hablar', 'como hablar', 'consecuencia', 'amonestacion', 'amonestación', 'acta administrativa',
    'despido', 'baja', 'castigo', 'proceder', 'medida', 'regreso'
  ].some((k) => lower.includes(k));

  // 2. Detect salary / compensation / money / raise / counteroffer
  const isSalaryCase = [
    'sueldo', 'salario', 'aumento', 'aumento de sueldo', 'aumento salarial', 'pagar', 'paga',
    'remuneracion', 'remuneración', 'compensacion', 'compensación', 'tabulador', 'dinero',
    'aumenten', 'aumentar', 'renuncia', 'irse por dinero', 'oferta económica', 'oferta economica',
    'ganar mas', 'ganar más', 'exige aumento', 'exigiendo sueldo', 'pide aumento'
  ].some((k) => lower.includes(k));

  // 3. Detect shift handoff / logs / veteran resistance
  const isShiftLogCase = [
    'bitacora', 'bitácora', 'cambio de turno', 'relevo de turno', 'supervisor veterano',
    'prensas', 'celda robótica', 'ernesto'
  ].some((k) => lower.includes(k));

  // 4. Detect delegation / audit / micromanagement
  const isDelegationCase = [
    'delegar', 'delegación', 'delegacion', 'auditoría', 'auditoria', 'iatf', 'absorber',
    'novato', 'novatos', 'revisar todo', 'cuello de botella', 'supervisores novatos'
  ].some((k) => lower.includes(k));

  // 5. Detect customer / client conflict (ONLY if actually mentioned in case!)
  const isClientCase = [
    'cliente', 'queja de cliente', 'entrega al cliente', 'pedido del cliente', 'proveedor'
  ].some((k) => lower.includes(k));

  // 6. Detect performance / task non-compliance
  const isTaskNonComplianceCase = !isHierarchyOrBossConflict && [
    'entrega', 'entregable', 'plazo', 'fecha límite', 'fecha limite', 'no cumple', 'incumple',
    'retraso', 'desempeño', 'desempeno', 'resultados', 'metas'
  ].some((k) => lower.includes(k));

  // 7. Detect interpersonal friction / attitude / resistance
  const isAttitudeCase = !isHierarchyOrBossConflict && [
    'actitud', 'defensiva', 'desmotivacion', 'desmotivación', 'apatía', 'apatia', 'resistencia',
    'conflicto', 'roce', 'desacuerdo', 'quejas'
  ].some((k) => lower.includes(k));

  // Formulate 1: Hechos y situación (Lo que está pasando objetivamente con el colaborador y las tareas)
  let factsAndSituation = '';
  if (isHierarchyOrBossConflict) {
    factsAndSituation = 'La situación de tensión y falta de respeto experimentada en la relación o interacción con la jefatura.';
  } else if (isDisciplinaryOrAbsenceCase) {
    factsAndSituation = 'La ausencia injustificada del colaborador al tomarse días de descanso o vacaciones sin previa autorización, limitándose a avisar por mensaje.';
  } else if (isSalaryCase) {
    if (raiseNotAnOption) {
      factsAndSituation = 'El colaborador condiciona su permanencia o actitud a una exigencia salarial inmediata, mientras que en la empresa el aumento de sueldo no es una opción viable en este momento.';
    } else {
      factsAndSituation = 'El colaborador plantea una exigencia de aumento salarial inmediato y manifiesta inconformidad o intención de salida si no se le concede.';
    }
  } else if (isShiftLogCase) {
    factsAndSituation = 'La omisión sistemática en el llenado de las bitácoras y registros operativos durante el cambio de turno por parte de un colaborador experimentado.';
  } else if (isDelegationCase) {
    factsAndSituation = 'La absorción directa de revisiones operativas por temor a fallas o no conformidades en el equipo.';
  } else if (isClientCase) {
    factsAndSituation = 'El roce operativo directo con el cliente y los compromisos de entrega o servicio afectados por la situación.';
  } else if (isTaskNonComplianceCase) {
    factsAndSituation = 'El incumplimiento reiterado y desfase en las tareas o entregables prioritarios asignados al equipo.';
  } else if (isAttitudeCase) {
    factsAndSituation = 'La postura a la defensiva y la resistencia para alinearse a las tareas y acuerdos cotidianos de trabajo.';
  } else {
    const rawSnippet = (currentMsg || sessionContext?.initialChallenge || sessionContext?.title || '').replace(/\s+/g, ' ').trim();
    const snippet = rawSnippet ? rawSnippet.slice(0, 95) : 'la situación operativa y los acuerdos de trabajo';
    factsAndSituation = `La situación observada en tu equipo sobre: "${snippet}${rawSnippet.length > 95 ? '...' : ''}".`;
  }

  // Formulate 2: Dilema del líder (La encrucijada concreta del líder)
  let leaderDilemma = '';
  if (isHierarchyOrBossConflict) {
    leaderDilemma = 'Hacer valer tus límites profesionales y defender tu dignidad y autonomía laboral con asertividad y temple, sin poner en riesgo la relación jerárquica ni la estabilidad de tu posición o la de tu equipo.';
  } else if (isDisciplinaryOrAbsenceCase) {
    if (concernsSanctionOrReturn) {
      leaderDilemma = 'Definir con Recursos Humanos la sanción o consecuencia disciplinaria correcta conforme a reglamento y sostener una conversación asertiva y firme al momento de su regreso, sin actuar desde la molestia pero sin mostrar permisividad.';
    } else {
      leaderDilemma = 'Hacer valer los acuerdos y normas operativas sin quebrantar la relación laboral, determinando con claridad la consecuencia disciplinaria proporcional a la falta.';
    }
  } else if (isSalaryCase) {
    if (raiseNotAnOption) {
      leaderDilemma = 'Sostener una conversación clara y firme para comunicarle con total transparencia que el incremento salarial no es viable, gestionando su reacción sin ceder a presiones ni desgastar la relación de trabajo.';
    } else {
      leaderDilemma = 'Dar retroalimentación firme y delimitar los compromisos laborales sin el temor a que la persona renuncie, se desmotive o genere fracturas en el equipo.';
    }
  } else if (isShiftLogCase) {
    leaderDilemma = 'Exigir la disciplina operativa requerida sin deteriorar el vínculo ni la motivación de una persona de amplia trayectoria en el equipo.';
  } else if (isDelegationCase) {
    leaderDilemma = 'Soltar el control y dar espacio de autonomía a los supervisores frente al temor de que ocurra un error crítico bajo tu responsabilidad.';
  } else if (isClientCase) {
    leaderDilemma = 'Defender las capacidades y tiempos de tu equipo sin poner en riesgo la relación comercial ni el nivel de servicio con el cliente.';
  } else {
    const mentionsBoss = ['jefe', 'director', 'gerencia', 'liderazgo superior', 'directora'].some((k) => lower.includes(k));
    if (mentionsBoss) {
      leaderDilemma = 'Equilibrar la presión de las expectativas de la dirección con el cuidado de la capacidad y el bienestar de tu equipo.';
    } else {
      leaderDilemma = 'Abordar una conversación difícil con asertividad y firmeza, balanceando la exigencia de resultados con el cuidado del vínculo con la persona.';
    }
  }

  // Formulate 3: Impacto y reto principal (Efecto en el equipo y objetivo clave a resolver)
  let impactAndMainChallenge = '';
  const expressesFatigue = ['cansad', 'agota', 'harto', 'frustra', 'estres', 'estrés', 'abrumad', 'desgaste'].some((k) => lower.includes(k));
  if (isHierarchyOrBossConflict) {
    impactAndMainChallenge = 'Frenar el desgaste emocional, recuperar la claridad estratégica y definir el mejor canal o momento para sostener una conversación asertiva y firme que restablezca el respeto mutuo.';
  } else if (isDisciplinaryOrAbsenceCase) {
    impactAndMainChallenge = 'Restablecer la disciplina y el respeto a las normas del equipo, evitando sentar un precedente negativo de permisividad o afectación a la equidad entre los demás colaboradores.';
  } else if (isSalaryCase) {
    impactAndMainChallenge = expressesFatigue
      ? 'Frenar el desgaste emocional acumulado, evitar sentar precedentes inviables en el equipo y definir con certeza el rumbo de la posición.'
      : 'Cuidar la equidad interna del equipo, proteger el clima laboral y definir con claridad el futuro de la colaboración.';
  } else if (isShiftLogCase) {
    impactAndMainChallenge = 'Garantizar la trazabilidad y seguridad en piso, evitando que la falta de registros afecte la calidad o al turno entrante.';
  } else if (isDelegationCase) {
    impactAndMainChallenge = 'Desarrollar la autonomía real de los supervisores y liberar tu tiempo de la operación para enfocarte en tu liderazgo estratégico.';
  } else {
    impactAndMainChallenge = expressesFatigue
      ? 'Frenar la sobrecarga mental acumulada y alinear los compromisos para que la operación fluya sin requerir tu intervención constante.'
      : 'Despejar la incertidumbre, restaurar el enfoque en las metas y cuidar el compromiso general del equipo.';
  }

  return {
    factsAndSituation,
    leaderDilemma,
    impactAndMainChallenge,
    visibleConflict: factsAndSituation,
    underlyingTension: leaderDilemma,
    emotionalImpact: impactAndMainChallenge,
  };
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

  // Regla 4: Reacción directa ante correcciones del usuario ("te confundiste", "eso no es lo que me preocupa")
  const isDirectCorrection = [
    'te confundiste', 'te confundes', 'eso no es lo que me preocupa', 'no es lo que me preocupa',
    'no me preocupa eso', 'te estás equivocando', 'te estas equivocando', 'te equivocaste',
    'no me entendiste', 'no me comprendiste', 'no es por ahí', 'no es por ahi', 'no dije eso',
    'entendiste mal', 'comprendiste mal', 'no es ese el problema', 'no es ese mi problema',
    'te fuiste por otro lado', 'no estás entendiendo', 'no estas entendiendo'
  ].some((t) => lowerMsg.includes(t));

  if (isDirectCorrection && stage === 1) {
    return {
      replyText: `Una disculpa por la confusión, ${leaderName}; te agradezco la aclaración.\n\nPara enfocar exactamente lo que necesitas: ¿qué es lo que más te preocupa en este momento respecto a esta situación y qué detalles adicionales nos faltan por poner sobre la mesa?`,
      readyToAdvance: false,
      advancePrompt: null,
      detectedTheme: 'Reorientación por Corrección',
      isTherapeuticCase: false,
    };
  }

  // Detección de matices o restricciones agregadas por el líder tras el resumen o durante la conversación
  const isNuanceOrConstraint = [
    'no es opción', 'no es opcion', 'no podemos aumentar', 'no podemos darle',
    'no hay presupuesto', 'no es viable', 'inviable', 'descartado', 'descartada',
    'descartar el aumento', 'descartar', 'no aumentarle', 'no se puede aumentar',
    'no hay aumento', 'no le podemos subir', 'no hay dinero', 'ojo', 'un detalle', 'no quiero que', 'no está sobre la mesa',
    'no esta sobre la mesa', 'no está contemplado', 'no esta contemplado',
    'no podemos pagar', 'no es posible aumentarle', 'imposible aumentar'
  ].some((t) => lowerMsg.includes(t));

  if (isNuanceOrConstraint && stage === 1) {
    const { factsAndSituation, leaderDilemma, impactAndMainChallenge } = extractDiagnosticVariables(history, cleanMsg, leaderName, sessionContext);
    return {
      replyText: `Gracias por esa precisión fundamental, ${leaderName}. Tener claro que esa vía no es una opción viable cambia por completo el terreno de juego y nos evita plantear salidas poco realistas.\n\nActualizo el mapa de la situación incorporando este matiz:\n\n• **Hechos y situación:** ${factsAndSituation}\n• **Dilema del líder:** ${leaderDilemma}\n• **Impacto y reto principal:** ${impactAndMainChallenge}\n\nCon este ajuste descartando esa opción, ¿este resumen refleja fielmente el reto que quieres abordar antes de que demos el paso a la siguiente etapa?`,
      readyToAdvance: false,
      advancePrompt: null,
      detectedTheme: 'Integración de Matices y Re-validación',
      isTherapeuticCase: false,
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
    const { factsAndSituation, leaderDilemma, impactAndMainChallenge } = extractDiagnosticVariables(history, cleanMsg, leaderName, sessionContext);
    return {
      replyText: `Te escucho con total atención, ${leaderName}. Frenamos el paso: no vamos a avanzar a la Etapa 2 hasta que tengamos total claridad sobre lo que estás viviendo.\n\nPara devolverte valor visible y ayudarte a ordenar las variables que hoy se sienten mezcladas, desgloso lo que he escuchado en tu relato:\n\n• **Hechos y situación:** ${factsAndSituation}\n• **Dilema del líder:** ${leaderDilemma}\n• **Impacto y reto principal:** ${impactAndMainChallenge}\n\nMirando este mapa con calma:\n1. De estos tres frentes, ¿cuál sientes que es el que genera mayor fricción o te cuesta más trabajo manejar en este momento?\n2. ¿Sientes que este desglose captura con precisión lo que estás viviendo, o hay alguna variable clave que se nos esté escapando?`,
      readyToAdvance: false,
      advancePrompt: null,
      detectedTheme: 'Desglose Diagnóstico',
      isTherapeuticCase: false,
    };
  }

  // Regla 3: Cierre de Etapa 1 guiado (Solo cuando el usuario confirme expresamente y SIN matices nuevos)
  const userConfirmsBreakdownOrReady = [
    'tiene sentido', 'tiene todo el sentido', 'totalmente', 'exacto',
    'asi es', 'así es', 'de acuerdo', 'estoy listo', 'ahora si', 'ahora sí',
    'avancemos', 'pasemos a la etapa 2', 'listo para avanzar', 'me queda claro',
    'tiene mucha razon', 'tiene mucha razón', 'me hace sentido', 'hace sentido',
    'me parece bien avanzar', 'podemos pasar a la etapa 2', 'pasemos a la siguiente',
    'refleja fielmente', 'refleja lo que vivo', 'si, avancemos', 'sí, avancemos'
  ].some((t) => lowerMsg.includes(t));

  if (userConfirmsBreakdownOrReady && !isNuanceOrConstraint && stage === 1) {
    return {
      replyText: `Me da mucho gusto que tengamos este mapa claro y alineado, ${leaderName}. Al tener delimitado con precisión lo que ocurre y tu encrucijada como líder, ¿estás de acuerdo en que pasemos a la Etapa 2 para analizar las perspectivas de las personas involucradas y las habilidades que necesitas activar?`,
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
      const { factsAndSituation, leaderDilemma, impactAndMainChallenge } = extractDiagnosticVariables(history, cleanMsg, leaderName, sessionContext);
      return {
        replyText: `Te lo planteo de forma muy simple y cotidiana, ${leaderName}: a veces postergamos una charla o decisión difícil porque tenemos muchas cosas urgentes en el día a día. Para verlo claro:\n\n• **Hechos y situación:** ${factsAndSituation}\n• **Dilema del líder:** ${leaderDilemma}\n• **Impacto y reto principal:** ${impactAndMainChallenge}\n\n¿Cuál de estos tres puntos crees que es la verdadera causa raíz de lo que está pasando?`,
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

  if (isQuestionRepetitionComplaint && stage === 1) {
    return {
      replyText: `Agradezco tu aclaración, ${leaderName}. Tomo nota de lo que ya compartiste para no hacerte repetir. Para ir al punto clave: desde tu perspectiva, ¿cuál es el obstáculo principal que sientes que impide resolver esto con firmeza y qué resultado concreto necesitas asegurar hoy con tu equipo?`,
      readyToAdvance: false,
      advancePrompt: null,
      detectedTheme: 'Clarificación de Causa Raíz',
      isTherapeuticCase: false,
    };
  }

  if (stage === 1) {
    const isCrimeOrTheft = [
      'robo', 'robando', 'robaron', 'robó', 'robo de material', 'hurto', 'sustracción',
      'sustraccion', 'sustrajo', 'desvío de material', 'delito', 'fraude'
    ].some((k) => lowerMsg.includes(k) || (sessionContext?.initialChallenge && sessionContext.initialChallenge.toLowerCase().includes(k)) || (sessionContext?.title && sessionContext.title.toLowerCase().includes(k)));

    const isHierarchyOrBossConflict = !isCrimeOrTheft && [
      'jefe', 'jefa', 'jefatura', 'director', 'directora', 'gerente', 'gerencia',
      'falta de respeto', 'respeto', 'me gritó', 'me grito', 'descalificó', 'descalifico',
      'humilló', 'humillo', 'maltrato', 'trato injusto', 'trato prepotente', 'prepotente',
      'mi superior', 'liderazgo superior', 'abuso de autoridad'
    ].some((k) => lowerMsg.includes(k) || (sessionContext?.initialChallenge && sessionContext.initialChallenge.toLowerCase().includes(k)) || (sessionContext?.title && sessionContext.title.toLowerCase().includes(k)));

    const isDisciplinaryOrAbsenceCase = !isHierarchyOrBossConflict && !isCrimeOrTheft && [
      'vacacion', 'vacación', 'vacaciones', 'ausencia injustificada', 'ausencias injustificadas',
      'días sin permiso', 'dias sin permiso', 'sin autorizacion', 'sin autorización',
      'aviso por mensaje', 'avisó por mensaje', 'notifico por mensaje', 'notificó por mensaje',
      'no vino a trabajar', 'abandono de trabajo', 'abandono de puesto', 'faltar al trabajo'
    ].some((k) => lowerMsg.includes(k) || (sessionContext?.initialChallenge && sessionContext.initialChallenge.toLowerCase().includes(k)) || (sessionContext?.title && sessionContext.title.toLowerCase().includes(k)));

    const isSalaryIssue = !isCrimeOrTheft && [
      'sueldo', 'salario', 'aumento', 'aumento salarial', 'dinero', 'remuneracion', 'remuneración',
      'compensacion', 'compensación', 'pagar', 'paga', 'exigiendo sueldo', 'pide aumento'
    ].some((k) => lowerMsg.includes(k) || (sessionContext?.initialChallenge && sessionContext.initialChallenge.toLowerCase().includes(k)) || (sessionContext?.title && sessionContext.title.toLowerCase().includes(k)));

    const isAttitudeOrDelivery = !isHierarchyOrBossConflict && !isCrimeOrTheft && [
      'entrega', 'entregables', 'plazo', 'fecha limite', 'fecha límite', 'retraso', 'retrasos',
      'no cumple', 'incumple', 'desempeño', 'calidad', 'actitud', 'defensiva', 'desmotivacion',
      'desmotivación', 'resistencia', 'apatia', 'apatía', 'compromiso'
    ].some((k) => lowerMsg.includes(k) || (sessionContext?.initialChallenge && sessionContext.initialChallenge.toLowerCase().includes(k)) || (sessionContext?.title && sessionContext.title.toLowerCase().includes(k)));

    const isCleanHistory = !history || history.length === 0 || history.every((m: any) => m.sender === 'leader' || m.role === 'user');

    // Turn 1 (historial limpio o inicio de acompañamiento): Responder directamente al mensaje del usuario sin plantillas ajenas ni eco robótico
    if (isCleanHistory) {
      if (isCrimeOrTheft) {
        return {
          replyText: `Una situación que involucra robo de material o faltas a la integridad y legalidad en la empresa es un hecho de máxima gravedad que trasciende el manejo habitual de equipo, ${leaderName}.\n\nPara evaluar los hechos con rigor y evitar pasos en falso: ¿cuáles son las evidencias concretas con las que se cuenta hasta ahora, qué protocolos existen en la empresa con Recursos Humanos o Seguridad, y la persona involucrada ya fue confrontada directamente?`,
          readyToAdvance: false,
          advancePrompt: null,
          detectedTheme: 'Falta Grave y Protocolos Internos/Seguridad',
          isTherapeuticCase: false,
        };
      }

      if (isHierarchyOrBossConflict) {
        return {
          replyText: `Que ocurra un abuso de autoridad o una falta de respeto de tu jefatura en público frente a otros colaboradores es una situación inaceptable que vulnera tu liderazgo y genera un desgaste severo, ${leaderName}.\n\nPara enfocar la situación con claridad estratégica: ¿cuál era el contexto de la junta o reunión cuando esto ocurrió, hubo alguna reacción de tu parte o del equipo en ese instante, y se trata de un comportamiento repetitivo del jefe o de un hecho aislado?`,
          readyToAdvance: false,
          advancePrompt: null,
          detectedTheme: 'Falta de Respeto y Relación con Jefatura',
          isTherapeuticCase: false,
        };
      }

      if (isDisciplinaryOrAbsenceCase) {
        return {
          replyText: `Que un colaborador se tome días sin autorización previa y solo lo notifique por mensaje es una falta grave a los acuerdos del equipo y a la disciplina operativa, ${leaderName}.\n\nPara dimensionar la gravedad y actuar con la firmeza debida: ¿qué impacto operativo inmediato está teniendo esto en la continuidad de las tareas del equipo, y existen políticas, precedentes o procesos disciplinarios claros en la empresa para atender un caso así?`,
          readyToAdvance: false,
          advancePrompt: null,
          detectedTheme: 'Falta Disciplinaria y Normativa',
          isTherapeuticCase: false,
        };
      }

      if (isSalaryIssue) {
        return {
          replyText: `Que un colaborador condicione su permanencia o actitud exigiendo un incremento de sueldo inmediato genera una presión delicada sobre tu liderazgo y sobre la equidad interna del equipo, ${leaderName}.\n\nPara dimensionar el escenario completo: ¿qué expectativas puntuales ha puesto sobre la mesa, y qué políticas o márgenes de tabulador existen en la empresa para una revisión de este tipo?`,
          readyToAdvance: false,
          advancePrompt: null,
          detectedTheme: 'Exigencia Salarial y Equidad',
          isTherapeuticCase: false,
        };
      }

      if (isAttitudeOrDelivery) {
        return {
          replyText: `Que existan fallas recurrentes en las entregas y una postura a la defensiva desgasta la dinámica del equipo y compromete los resultados que debes entregar, ${leaderName}.\n\nPara basarnos en hechos concretos y verificables: ¿cuáles fueron los acuerdos y plazos específicos que pactaron para esa tarea, y qué conversación previa directa has tenido con la persona sobre este incumplimiento?`,
          readyToAdvance: false,
          advancePrompt: null,
          detectedTheme: 'Acuerdos de Entrega y Desempeño',
          isTherapeuticCase: false,
        };
      }

      return {
        replyText: `Comprendo la complejidad de la situación que estás enfrentando en tu área y el impacto que esto genera en tu liderazgo, ${leaderName}.\n\nPara profundizar en los hechos concretos y evitar suposiciones: ¿cómo se originó esta situación y qué hechos observables han ocurrido recientemente entre las personas involucradas?`,
        readyToAdvance: false,
        advancePrompt: null,
        detectedTheme: 'Mapeo de Hechos',
        isTherapeuticCase: false,
      };
    }

    const askedImpactOrPolicies = prevLidactaTexts.some((t: string) =>
      t.includes('impacto operativo') || t.includes('políticas') || t.includes('politicas') || t.includes('precedentes')
    );
    const askedAgreementsOrPriorTalk = prevLidactaTexts.some((t: string) =>
      t.includes('acuerdos específicos') || t.includes('conversación previa') || t.includes('conversacion previa') || t.includes('compromisos pactados') || t.includes('en privado con tu jefe')
    );

    // 0. Caso Delito / Robo de material en turnos posteriores
    if (isCrimeOrTheft) {
      if (!askedImpactOrPolicies) {
        return {
          replyText: `Comprendo la gravedad de este hecho sobre los bienes de la empresa, ${leaderName}. Para dimensionar la situación con rigor: ¿qué impacto operativo o de seguridad inmediata ha tenido el faltante, y qué protocolos formales existen con Recursos Humanos o Seguridad Patrimonial para proceder?`,
          readyToAdvance: false,
          advancePrompt: null,
          detectedTheme: 'Protocolos de Seguridad Patrimonial',
          isTherapeuticCase: false,
        };
      }
      if (!askedAgreementsOrPriorTalk) {
        return {
          replyText: `Teniendo claro el protocolo, ${leaderName}: ¿la persona involucrada ya fue confrontada directamente, o qué evidencias documentales o testimoniales respaldan el señalamiento?`,
          readyToAdvance: false,
          advancePrompt: null,
          detectedTheme: 'Evidencias y Confrontación Directa',
          isTherapeuticCase: false,
        };
      }
    }

    // 1. Caso Jefatura en turnos posteriores
    else if (isHierarchyOrBossConflict) {
      if (!askedAgreementsOrPriorTalk) {
        return {
          replyText: `Comprendo el impacto que tiene este abuso de autoridad de la jefatura, ${leaderName}. Para enfocar cómo abordarlo: ¿has tenido la oportunidad de conversar en privado con tu jefe sobre este hecho específico, o cómo ha sido la dinámica de comunicación entre ustedes antes de esta situación?`,
          readyToAdvance: false,
          advancePrompt: null,
          detectedTheme: 'Relación con Jefatura',
          isTherapeuticCase: false,
        };
      }
    }

    // 2. Caso Disciplinario o Normativo (ej. ausencias, vacaciones no autorizadas)
    else if (isDisciplinaryOrAbsenceCase) {
      if (!askedImpactOrPolicies) {
        return {
          replyText: `Que un colaborador se tome días sin autorización previa y solo lo notifique por mensaje es una falta grave a los acuerdos del equipo y a la disciplina operativa, ${leaderName}.\n\nPara dimensionar la gravedad y actuar con la firmeza debida: ¿qué impacto operativo inmediato está teniendo esto en la continuidad de las tareas del equipo, y existen políticas, precedentes o procesos disciplinarios claros en la empresa para atender un caso así?`,
          readyToAdvance: false,
          advancePrompt: null,
          detectedTheme: 'Falta Disciplinaria y Normativa',
          isTherapeuticCase: false,
        };
      }

      if (!askedAgreementsOrPriorTalk) {
        return {
          replyText: `Entiendo el impacto operativo que describes, ${leaderName}. Para asegurar que cualquier medida cuente con el debido sustento: ¿qué antecedentes o llamados de atención previos existen con esta persona sobre el cumplimiento de normas, y qué postura asumió cuando se le señalaron?`,
          readyToAdvance: false,
          advancePrompt: null,
          detectedTheme: 'Antecedentes Disciplinarios',
          isTherapeuticCase: false,
        };
      }
    }

    // 3. Caso de Actitud o Entregas / Tareas
    else if (isAttitudeOrDelivery) {
      if (!askedAgreementsOrPriorTalk) {
        return {
          replyText: `Que existan fallas recurrentes en las entregas y una postura a la defensiva desgasta la dinámica del equipo y compromete los resultados que debes entregar, ${leaderName}. Para basarnos en hechos concretos y verificables: ¿cuáles fueron los acuerdos y plazos específicos que pactaron para esa tarea, y qué conversación previa directa has tenido con la persona sobre este incumplimiento?`,
          readyToAdvance: false,
          advancePrompt: null,
          detectedTheme: 'Acuerdos de Entrega y Desempeño',
          isTherapeuticCase: false,
        };
      }

      if (!askedImpactOrPolicies) {
        return {
          replyText: `Comprendo el contexto de las entregas, ${leaderName}. Para profundizar en la raíz: ¿qué justificación o respuesta ha dado el colaborador al señalarle el desfase, y cómo está impactando esta situación en el resto del equipo?`,
          readyToAdvance: false,
          advancePrompt: null,
          detectedTheme: 'Impacto en Equipo y Respuestas',
          isTherapeuticCase: false,
        };
      }
    }

    // 4. Caso Salarial / Compensación
    else if (isSalaryIssue) {
      if (!askedImpactOrPolicies) {
        return {
          replyText: `Que un colaborador condicione su permanencia o actitud exigiendo un incremento de sueldo inmediato genera una presión delicada sobre tu liderazgo y sobre la equidad interna del equipo, ${leaderName}. Para dimensionar el escenario completo: ¿qué expectativas puntuales ha puesto sobre la mesa, y qué políticas o márgenes de tabulador existen en la empresa para una revisión de este tipo?`,
          readyToAdvance: false,
          advancePrompt: null,
          detectedTheme: 'Exigencia Salarial y Equidad',
          isTherapeuticCase: false,
        };
      }

      if (!askedAgreementsOrPriorTalk) {
        return {
          replyText: `Tenemos delimitado el contexto salarial, ${leaderName}. Desde el plano de la gestión diaria: ¿cómo ha impactado esta inconformidad en su compromiso y desempeño operativo, y qué conversación has tenido con él sobre su valor y futuro en el equipo?`,
          readyToAdvance: false,
          advancePrompt: null,
          detectedTheme: 'Desempeño y Compensación',
          isTherapeuticCase: false,
        };
      }
    }

    // 5. Caso General
    else {
      if (!askedAgreementsOrPriorTalk) {
        return {
          replyText: `Comprendo la situación que describes en tu equipo, ${leaderName}. Para enfocar los hechos observables y evitar interpretaciones: ¿cuáles han sido los acuerdos específicos previos entre ustedes sobre este tema y cuál ha sido la conducta directa de las personas involucradas?`,
          readyToAdvance: false,
          advancePrompt: null,
          detectedTheme: 'Mapeo de Hechos',
          isTherapeuticCase: false,
        };
      }
    }

    // Regla de profundización obligatoria: Mínimo 2-3 turnos de escucha antes de desplegar el resumen final
    const leaderTurnsCount = (history || []).filter((m: any) => m.sender === 'leader' || m.role === 'user').length;
    if (leaderTurnsCount < 2) {
      if (isCrimeOrTheft) {
        return {
          replyText: `Tomo nota de este antecedente, ${leaderName}. Para asegurar que cualquier paso cuente con el debido respaldo interno y legal: ¿quién más en la gerencia o dirección tiene conocimiento de esto y qué medidas provisionales se han tomado para resguardar la operación?`,
          readyToAdvance: false,
          advancePrompt: null,
          detectedTheme: 'Investigación y Medidas Internas',
          isTherapeuticCase: false,
        };
      }

      if (isHierarchyOrBossConflict) {
        return {
          replyText: `Comprendo el impacto que este trato tiene en tu posición, ${leaderName}. Para valorar las alternativas con objetividad: ¿qué margen de conversación privada ves posible con tu jefe para delimitar acuerdos profesionales, o consideras necesario involucrar a un tercero como Recursos Humanos o una dirección superior?`,
          readyToAdvance: false,
          advancePrompt: null,
          detectedTheme: 'Delimitación de Límites Jerárquicos',
          isTherapeuticCase: false,
        };
      }

      return {
        replyText: `Te escucho con atención, ${leaderName}. Para terminar de mapear el impacto real antes de sintetizar: ¿de qué manera específica está afectando esta situación el clima de trabajo, los resultados del área o tu propia tranquilidad en el día a día?`,
        readyToAdvance: false,
        advancePrompt: null,
        detectedTheme: 'Profundización de Impacto',
        isTherapeuticCase: false,
      };
    }

    // Cierre mediante Resumen de Validación
    const { factsAndSituation, leaderDilemma, impactAndMainChallenge } = extractDiagnosticVariables(history, cleanMsg, leaderName, sessionContext);
    return {
      replyText: `Con esta información tenemos un panorama sólido y completo de la situación, ${leaderName}. Te comparto un breve resumen sintético de lo que hemos identificado:\n\n• **Hechos y situación:** ${factsAndSituation}\n• **Dilema del líder:** ${leaderDilemma}\n• **Impacto y reto principal:** ${impactAndMainChallenge}\n\n¿Este resumen refleja con claridad lo que estás viviendo? Si es así, estamos listos para dar el siguiente paso hacia la Etapa 2 (Analizar perspectivas y habilidades), donde exploraremos cómo vive la otra parte la situación y qué herramientas de liderazgo necesitas poner en juego.`,
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
    let resolvedHistory = rawHistory.filter((m: any) => {
      if (!m || typeof m !== 'object') return false;
      const mCase = m.caseId || m.mentorshipId;
      if (targetCaseId) {
        return mCase === targetCaseId;
      }
      return true;
    });

    // If it is a new accompaniment, background message history MUST be strictly empty []
    const isNewAccompaniment =
      Boolean(body?.isNewCase) ||
      (currentStageNum === 1 && (resolvedHistory.length <= 1 && resolvedHistory.every((m: any) => (m.sender === 'leader' || m.role === 'user'))));

    if (isNewAccompaniment) {
      resolvedHistory = [];
    } else {
      // If the last message in resolvedHistory is identical to the current userMessage, pop it to avoid duplication
      if (
        resolvedHistory.length > 0 &&
        (resolvedHistory[resolvedHistory.length - 1].sender === 'leader' || resolvedHistory[resolvedHistory.length - 1].role === 'user') &&
        (resolvedHistory[resolvedHistory.length - 1].text || resolvedHistory[resolvedHistory.length - 1].content || '').trim() === resolvedUserMessage
      ) {
        resolvedHistory = resolvedHistory.slice(0, -1);
      }
    }

    const activeCaseTitle = (sessionData?.id === targetCaseId ? sessionData?.title : '') || resolvedUserMessage.slice(0, 60);
    const activeCaseChallenge = (sessionData?.id === targetCaseId ? sessionData?.initialChallenge : '') || resolvedUserMessage;
    const safeSessionContext = {
      id: targetCaseId,
      title: activeCaseTitle,
      initialChallenge: activeCaseChallenge,
      currentStage: currentStageNum,
    };

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
        safeSessionContext
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
     * Caso actual: "${activeCaseTitle || 'Caso actual'}"
     * Reto inicial planteado: "${activeCaseChallenge || resolvedUserMessage || ''}"
   - ESTÁ TERMINANTEMENTE PROHIBIDO mezclar, inventar o arrastrar información de otros casos o pruebas previas (como conflictos con clientes, entregas de bitácoras de piso o auditorías IATF, A MENOS que el líder los haya mencionado expresamente en ESTA conversación).
   - Si el líder plantea una situación con un colaborador que exige un aumento de sueldo ("exigiendo sueldo"), tu análisis, desglose y preguntas DEBEN versar estrictamente sobre la exigencia salarial, la retención de talento, las expectativas de remuneración y la conversación difícil con ese colaborador. NUNCA introduzcas clientes ni temas ajenos.

======================================================================
REGLAS ESTRICTAS DE INTERACCIÓN, CALIDAD Y PERTINENCIA
======================================================================

### PROTOCOLO DE COMPRENSIÓN PROFUNDA Y ESCUCHA CONTEXTUAL

Objetivo: Asegurar que Lidacta comprenda la situación desde la perspectiva del líder antes de analizarla, emitir interpretaciones, identificar habilidades o proponer alternativas.

1. Comprender antes de interpretar:
Lidacta debe escuchar y analizar cuidadosamente cada respuesta del líder antes de formular su siguiente intervención. Debe identificar y diferenciar: Hechos, Preocupaciones, Interpretaciones, Impacto y Necesidad de acompañamiento. No debe confundir estos elementos ni presentar percepciones u hipótesis como hechos.

2. No completar la historia con suposiciones:
Queda estrictamente PROHIBIDO inventar, asumir o incorporar circunstancias que el líder no haya mencionado. Está prohibido dar por hecho, sin evidencia en la conversación, que existen: incumplimientos recurrentes, actitudes defensivas, falta de compromiso, conflictos previos, acuerdos o políticas no mencionados, o intenciones de los involucrados.

3. Reflejar comprensión antes de avanzar:
Antes de realizar un análisis o plantear una nueva pregunta, Lidacta debe demostrar que comprendió lo que el líder expresa. Prohibido utilizar expresiones genéricas de empatía como "entiendo tu preocupación" o "comprendo la situación" si no explican qué se ha comprendido.

4. Profundizar sobre lo que realmente importa:
Cuando el líder amplíe, corrija o precise su situación (por ejemplo, aclarando que la preocupación es la conducta/actitud y el mal precedente, y no las tareas o entregables), Lidacta debe actualizar inmediatamente su comprensión y reorientar el 100% de la conversación hacia esa preocupación real.

5. Separar la perspectiva del líder de la realidad de los demás involucrados:
Reconocer la experiencia del líder sin asumir automáticamente que su interpretación sobre otras personas es correcta. Explorar otras perspectivas con respeto sin etiquetar ni atribuir intenciones no comprobadas.

6. Criterio de avance:
Lidacta no debe avanzar al análisis, resumen o identificación de habilidades hasta tener una comprensión suficiente de lo que ocurrió concretamente, lo que más preocupa al líder y el impacto percibido.

Regla fundamental: No respondas solamente al problema que el líder menciona inicialmente. Comprende qué significa ese problema para él, qué le preocupa realmente y qué necesita resolver. Primero demuestra comprensión; después analiza y acompaña.

======================================================================
REGLAS ESTRICTAS DE INTERACCIÓN, CALIDAD Y PERTINENCIA EN ETAPA 1
======================================================================

1. PROHIBICIÓN DE ECO ROBÓTICO:
   - Queda estrictamente PROHIBIDO iniciar respuestas con frases mecánicas como: "Entiendo con total claridad el reto que me planteas sobre [repetir texto del usuario]...".
   - Lidacta debe responder como una mentora humana real: validando la emoción o la gravedad del hecho en sus propias palabras de forma natural.

2. REGLA DE PROFUNDIZACIÓN OBLIGATORIA (MÍNIMO 2-3 TURNOS DE ESCUCHA):
   - Lidacta NO DEBE desplegar la plantilla de resumen final de la Etapa 1 (Hechos, Dilema, Impacto) en el primer ni segundo turno a menos que el usuario haya entregado toda la información.
   - En los primeros turnos, Lidacta DEBE priorizar hacer 1 o 2 preguntas de profundización pertinentes y específicas sobre el hecho real expuesto.
   - "readyToAdvance" DEBE ser false al abrir o indagar en la Etapa 1.

3. ADAPTACIÓN DE PREGUNTAS A LA NATURALEZA DEL PROBLEMA:
   - Si el hecho es grave, un delito o falta operativa crítica (ej. robo de material): indagar sobre evidencia concreta, protocolos de la empresa con RRHH o Seguridad, y si ya se confrontó a la persona. Prohibido terminantemente hacer preguntas genéricas como "¿qué cambio concreto buscas obtener?".
   - Si es un conflicto jerárquico (ej. abuso de autoridad del jefe en público): indagar sobre el contexto de la reunión, si hubo una reacción inmediata, y si es una conducta repetitiva o aislada del jefe.
   - Si es una falta disciplinaria o normativa (ej. ausencias, vacaciones no autorizadas, faltas, desacato directo, abandono): indagar sobre el impacto operativo inmediato y si existen políticas o precedentes claros en la empresa.
   - Si es un problema de actitud o entregas: indagar sobre los acuerdos específicos y la conversación previa sobre esa tarea.
   - Si es una exigencia salarial o de compensación: indagar sobre las expectativas planteadas, el impacto en su compromiso y los límites de tabulador o políticas internas conocidas.

4. REACCIÓN DIRECTA ANTE CORRECCIONES DEL USUARIO:
   - Si el líder corrige a Lidacta indicando que se equivocó de tema o enfoque (ej. "te confundiste", "eso no es lo que me preocupa"):
   - Lidacta NO DEBE desplegar la síntesis resumida de inmediato.
   - Debe disculparse brevemente en una sola frase, hacer la pregunta correcta sobre lo aclarado y permitir que el líder exprese los detalles.

5. EJE CENTRAL Y FIDELIDAD AL HECHO DETONANTE:
   - El hecho principal reportado por el líder en su primer turno (ejemplo: ausencia injustificada de 5 días o tomar vacaciones sin autorización) es el EJE INAMOVIBLE de la mentoría.
   - Queda estrictamente PROHIBIDO cambiar el foco de la mentoría hacia "incumplimiento de tareas, entregables o plazos pactados" solo porque el líder mencione antecedentes secundarios o correcciones pasadas.

6. COMPRENSIÓN REAL Y SÍNTESIS CONECTADA A LA PREOCUPACIÓN ACTIVA:
   - En el desglose de la Etapa 1, los 3 puntos del resumen (**Hechos y situación**, **Dilema del líder**, **Impacto y reto principal**) deben construirse respondiendo explícitamente a la preocupación final planteada por el líder (ejemplo: la incertidumbre sobre cómo sancionar la ausencia y cómo abordar la conversación cuando la persona regrese).
   - Queda estrictamente PROHIBIDO usar frases de resumen genéricas que no correspondan exactamente a lo que el líder acaba de manifestar.

7. PROHIBICIÓN ABSOLUTA DE PLANTILLAS O PREGUNTAS CLONADAS:
   - Queda estrictamente PROHIBIDO usar la batería de preguntas estandarizadas (ejemplo: "¿cuánto tiempo lleva este colaborador en tu equipo...", "¿cómo definirías su perfil habitual...", "¿cómo ha sido la relación de trabajo antes de esto?").
   - Cada intervención debe ser única y redactada a la medida del mensaje específico del usuario.
   - Prohibido usar plantillas fijas de cierre como "Tenemos la información clave bien delimitada" tras 2 intercambios. El cambio de etapa debe ser un proceso dinámico de mentoría, no un conteo de turnos. "readyToAdvance" DEBE ser false al abrir o indagar en la Etapa 1.

8. ESPEJO SITUACIONAL Y EMPATÍA TÁCTICA EN LA PRIMERA FRASE:
   - La primera oración de Lidacta DEBE mencionar explícitamente los hechos concretos y la gravedad/naturaleza del problema reportado por el líder (ej. "Que un colaborador se tome 5 días de vacaciones sin autorización previa y solo lo notifique por mensaje es una falta grave a los acuerdos del equipo...").
   - Demuestra comprensión real antes de realizar cualquier pregunta.

9. AJUSTE DE TONO POR CRITICIDAD:
   - Adapta la firmeza del tono a la gravedad del problema. No utilices un tono pasivo o pausado cuando el líder reporta una falta operativa o disciplinaria grave.

10. ESCUCHA ACTIVA Y FLEXIBILIDAD OBLIGATORIA (PROHIBIDO APURAR):
   - Si el usuario dice que NO quiere avanzar, que no está listo, que va muy rápido, que necesita entender mejor la situación, o que desea profundizar en el problema:
     * Está TERMINANTEMENTE PROHIBIDO volver a preguntar si está listo para pasar a la Etapa 2.
     * Está TERMINANTEMENTE PROHIBIDO sugerir o forzar el avance de etapa.
     * Debes responder OBLIGATORIAMENTE con "readyToAdvance": false y "advancePrompt": null.

11. FORMATO DE DESGLOSE DIAGNÓSTICO Y RESUMEN (LENGUAJE HUMANO, SIN JERGA RÍGIDA):
   - Prohibido terminantemente el uso de términos rebuscados o académicos como "Dinámica relacional y perfil", "exigencia vertical" o "matriz de fricción".
   - Cuando el usuario pida ayuda para entender las variables, desglosar el problema, manifieste que no quiere avanzar o tras explorar las variables clave de la Etapa 1, la mentora DEBE estructurar el desglose/resumen utilizando estricta y únicamente estas tres etiquetas claras y acordes a su contenido, en viñetas y negritas:
     • **Hechos y situación:** [Lo que está pasando objetivamente con el colaborador y las tareas en ESTE caso exclusivo].
     • **Dilema del líder:** [La encrucijada concreta del líder, ej. dar retroalimentación firme sin temor a que la persona renuncie o se desmotive].
     • **Impacto y reto principal:** [El efecto en el equipo y el objetivo clave a resolver].
   - En la síntesis, refleja explícitamente las emociones e intenciones del líder (ej. "trabajar tranquilo", "evitar el desgaste" o "eliminar el temor al conflicto").
   - Si se trata de un desglose diagnóstico exploratorio, finalizarás haciendo 1 o 2 preguntas reflexivas sobre esos puntos (con "readyToAdvance": false).

12. INTEGRACIÓN DE MATICES, MANEJO DE DUDAS Y CIERRE DE ETAPA MEDIANTE CONFIRMACIÓN FLUIDA:
   - Resumen inicial de validación: Al explorar los puntos clave de la Etapa 1, presenta el resumen con las 3 viñetas (**Hechos y situación:**, **Dilema del líder:**, **Impacto y reto principal:**) y pregunta con preview de valor: "...¿este resumen refleja fielmente el reto que quieres abordar? Si es así, estamos listos para dar el siguiente paso hacia la Etapa 2 (Analizar perspectivas y habilidades), donde exploraremos cómo vive la otra parte la situación y qué herramientas de liderazgo necesitas poner en juego." (con "readyToAdvance": false).
   - Re-validación fluida tras correcciones: Si el líder corrige un matiz o agrega una restricción (ej. "el aumento de sueldo no es opción", "no podemos aumentarle", "no hay presupuesto"):
     * Lidacta NO debe saltar de inmediato a la Etapa 2. "readyToAdvance" DEBE ser false.
     * Agradece la aclaración en 1 o 2 frases empáticas, actualiza el dato incorporando el matiz y pregunta directamente si están listos para avanzar con base en ese ajuste, SIN volver a desplegar la plantilla completa de 3 viñetas.
   - Manejo de dudas sobre etapas: Si el líder pregunta explícitamente sobre la siguiente etapa (ej. "¿De qué trata la etapa 2?"), responde directamente explicando que en la Etapa 2 se abordarán dos frentes: 1) Entender la perspectiva y motivaciones del colaborador, y 2) Desarrollar las habilidades de comunicación firme y empática del líder. Cierra preguntando si con eso está listo para iniciar.
   - Prohibición de bucles: Queda estrictamente PROHIBIDO enviar la misma síntesis de 3 viñetas en turnos consecutivos si el usuario no aportó hechos nuevos ni confirmó explícitamente.
   - Aislamiento estricto de contexto: Responde ÚNICAMENTE con base en datos compartidos por el líder en el chat activo. Queda estrictamente PROHIBIDO asumir o inventar restricciones financieras u operativas (ej. "el aumento de sueldo no es viable") si el usuario no las ha mencionado explícitamente en la sesión actual.
   - Confirmación fluida para avanzar: Lidacta propondrá el paso a la Etapa 2 con "readyToAdvance": true y "advancePrompt": "Avanzar a Etapa 2: Analizar perspectivas y habilidades" ÚNICAMENTE cuando el líder confirme que el resumen refleja fielmente su situación sin agregar nuevos matices o restricciones (ej. "así es", "de acuerdo", "avancemos", "exacto, pasemos a la etapa 2").

13. Límite Terapéutico: NO eres psicólogo ni das terapia. Si detectas crisis emocional clínica o terapéutica, deriva amablemente a un profesional de la salud mental sin bloquear la sesión y marca "isTherapeuticCase": true.
14. Autonomía del Líder: NO tomas decisiones por el líder; cuestionas, orientas y sugieres.
15. Cero Consejos Genéricos ni Saludos Repetitivos: Personaliza cada intervención al contexto del líder. NUNCA respondas con saludos de bienvenida genéricos repetitivos (por ejemplo: "Hola [Nombre], entiendo la situación que estás enfrentando..."). Responde de forma directa al contenido del mensaje del líder.
16. Tono: Profesional, cercano, empático, claro y ejecutivo (1 a 3 párrafos cortos). Formula UNA sola pregunta o grupo reflexivo a la vez.
17. PROHIBIDO REPETIR PREGUNTAS O COLETILLAS DE CIERRE:
   - Está terminantemente PROHIBIDO repetir la misma pregunta o coletilla de cierre en turnos consecutivos.
   - Si una pregunta ya fue realizada o el líder ya aportó información al respecto, cambia de ángulo con una pregunta diferente o profundiza en las variables clave pendientes.

Contexto de la sesión:
- Empresa: ${companyContext?.name || 'Empresa'}
- Líder: ${leaderProfile?.name || 'Líder'} (${leaderProfile?.position || 'Líder'})
- Etapa actual: Etapa ${currentStageNum} - ${STAGE_NAMES[currentStageNum] || ''}
- Caso / Reto actual: ${activeCaseTitle || 'Caso actual'}
- Reto inicial: ${activeCaseChallenge || resolvedUserMessage || ''}

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
        resolvedHistory,
        safeSessionContext
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
