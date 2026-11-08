const STAGE_NAMES: Record<number, string> = {
  1: 'Detectar qué sucede',
  2: 'Analizar perspectivas y habilidades',
  3: 'Diseñar alternativas',
  4: 'Practicar antes de actuar',
  5: 'Actuar (Plan de Acción)',
  6: 'Aprender y reflexionar',
  7: 'Cierre y retroalimentación',
};

function isMetaOrOperationalMessage(text: string): boolean {
  if (!text) return false;
  const lower = text.toLowerCase().trim();
  const metaPatterns = [
    'no entiendo', 'no entendí', 'no entendi', 'no comprendo', 'no comprendí', 'no comprendi',
    'repite la pregunta', 'repite tu pregunta', 'repíteme la pregunta', 'repiteme la pregunta',
    'qué me quisiste decir', 'que me quisiste decir', 'qué quisiste decir', 'que quisiste decir',
    'a qué te refieres', 'a que te refieres', 'no me queda claro', 'explícate', 'explicate',
    'explica mejor', 'explícamelo', 'explicamelo', 'no te sigo', 'no te comprendo',
    'de qué hablas', 'de que hablas', 'no sé a qué te refieres', 'no se a que te refieres',
    'reformula', 'reformula la pregunta', 'hazla más sencilla', 'hazla mas sencilla',
    'no sé qué responder', 'no se que responder', 'cómo que', 'como que', 'cómo así', 'como asi',
    'qué significa', 'que significa', 'no entiendo tu pregunta', 'no entiendo la pregunta',
    'no entendí la pregunta', 'no entendi la pregunta', 'a qué viene esa pregunta',
    'te equivocaste', 'te confundiste', 'te estás equivocando', 'te estas equivocando',
    'eso no fue lo que dije', 'eso no es lo que dije', 'no dije eso', 'yo no dije eso',
    'eso no es lo que me preocupa', 'no es lo que me preocupa', 'no me preocupa eso',
    'no me entendiste', 'no me has entendido', 'no me comprendiste', 'no es por ahí', 'no es por ahi',
    'entendiste mal', 'comprendiste mal', 'no es ese el problema', 'no es ese mi problema',
    'te fuiste por otro lado', 'no estás entendiendo', 'no estas entendiendo'
  ];
  return metaPatterns.some((p) => lower.includes(p));
}

function isSubstantiveMessage(text: string): boolean {
  if (!text) return false;
  const trimmed = text.trim();
  if (isMetaOrOperationalMessage(trimmed)) return false;

  const lower = trimmed.toLowerCase();
  const trivialPhrases = [
    'ok', 'okay', 'si', 'sí', 'no', 'ya', 'bien', 'claro', 'de acuerdo',
    'no sé', 'no se', 'tal vez', 'quizas', 'quizás', 'puede ser',
    'no mucho', 'nada', 'mas o menos', 'más o menos', 'después', 'luego',
    'hola', 'buenos dias', 'buenas tardes', 'buenas noches'
  ];
  if (trivialPhrases.includes(lower)) return false;

  const words = trimmed.split(/\s+/).filter(Boolean);
  return words.length >= 3 || trimmed.length >= 15;
}

function extractDiagnosticVariables(
  history: any[],
  currentMsg: string,
  leaderName: string,
  sessionContext?: any
) {
  const allUserTexts: string[] = [];
  if (sessionContext?.title && !isMetaOrOperationalMessage(sessionContext.title)) {
    allUserTexts.push(sessionContext.title);
  }
  if (sessionContext?.initialChallenge && !isMetaOrOperationalMessage(sessionContext.initialChallenge)) {
    allUserTexts.push(sessionContext.initialChallenge);
  }
  for (const m of history || []) {
    const txt = (m.text || m.content || '').trim();
    if (txt && !isMetaOrOperationalMessage(txt)) allUserTexts.push(txt);
  }
  if (currentMsg && !isMetaOrOperationalMessage(currentMsg)) {
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

  const anchorText = [
    sessionContext?.initialChallenge,
    sessionContext?.title,
    (history && history.length > 0 ? (history[0]?.text || history[0]?.content) : ''),
  ].filter((t) => t && !isMetaOrOperationalMessage(t)).join(' ').toLowerCase();

  // 1. Casos Éticos / Faltas Graves / Delitos (robo, fuga de información, acoso)
  const isCrimeOrTheft = [
    'robo', 'robando', 'robaron', 'robó', 'robo de material', 'hurto', 'sustracción',
    'sustraccion', 'sustrajo', 'desvío de material', 'delito', 'fraude', 'almacén', 'almacen'
  ].some((k) => anchorText.includes(k) || lower.includes(k));

  // 2. Conflictos / Jerarquía / Abuso de autoridad
  const isHierarchyOrBossConflict = !isCrimeOrTheft && [
    'jefe', 'jefa', 'jefatura', 'director', 'directora', 'gerente', 'gerencia',
    'falta de respeto', 'respeto', 'me gritó', 'me grito', 'descalificó', 'descalifico',
    'humilló', 'humillo', 'maltrato', 'trato injusto', 'trato prepotente', 'prepotente',
    'mi superior', 'liderazgo superior', 'abuso de autoridad'
  ].some((k) => lower.includes(k) || anchorText.includes(k));

  // 3. Faltas Disciplinarias / Normativa (ausencias, vacaciones no autorizadas)
  const isDisciplinaryOrAbsenceCase = !isHierarchyOrBossConflict && !isCrimeOrTheft && [
    'vacacion', 'vacación', 'vacaciones', 'ausencia injustificada', 'ausencias injustificadas',
    'días sin permiso', 'dias sin permiso', 'sin autorizacion', 'sin autorización',
    'aviso por mensaje', 'avisó por mensaje', 'por whatsapp', 'notifico por mensaje', 'notificó por mensaje',
    'no vino a trabajar', 'abandono de trabajo', 'abandono de puesto', 'faltar al trabajo'
  ].some((k) => anchorText.includes(k) || lower.includes(k));

  const concernsSanctionOrReturn = !isHierarchyOrBossConflict && !isCrimeOrTheft && [
    'sancion', 'sanción', 'sancionar', 'regrese', 'vuelva', 'reincorpore', 'cuando llegue',
    'cómo hablar', 'como hablar', 'consecuencia', 'amonestacion', 'amonestación', 'acta administrativa',
    'despido', 'baja', 'castigo', 'proceder', 'medida', 'regreso'
  ].some((k) => lower.includes(k));

  // 4. Compensación / Exigencia salarial
  const isSalaryCase = !isCrimeOrTheft && [
    'sueldo', 'salario', 'aumento', 'aumento de sueldo', 'aumento salarial', 'pagar', 'paga',
    'remuneracion', 'remuneración', 'compensacion', 'compensación', 'tabulador', 'dinero',
    'aumenten', 'aumentar', 'renuncia', 'irse por dinero', 'oferta económica', 'oferta economica',
    'ganar mas', 'ganar más', 'exige aumento', 'exigiendo sueldo', 'pide aumento'
  ].some((k) => lower.includes(k));

  // 5. Delegación / Exceso de control / Centralización
  const isDelegationCase = [
    'delegar', 'delegación', 'delegacion', 'auditoría', 'auditoria', 'iatf', 'absorber',
    'novato', 'novatos', 'revisar todo', 'cuello de botella', 'supervisores novatos'
  ].some((k) => lower.includes(k));

  // 6. Retroalimentación / Desempeño / Entregas
  const isTaskNonComplianceCase = !isHierarchyOrBossConflict && !isCrimeOrTheft && [
    'entrega', 'entregable', 'plazo', 'fecha límite', 'fecha limite', 'no cumple', 'incumple',
    'retraso', 'desempeño', 'desempeno', 'resultados', 'metas'
  ].some((k) => lower.includes(k));

  // 7. Motivación / Actitud
  const isAttitudeCase = !isHierarchyOrBossConflict && !isCrimeOrTheft && [
    'actitud', 'defensiva', 'desmotivacion', 'desmotivación', 'apatía', 'apatia', 'resistencia',
    'conflicto', 'roce', 'desacuerdo', 'quejas'
  ].some((k) => lower.includes(k));

  // Formulate 1: Hechos y situación (Síntesis conceptual interpretada, CERO copy-paste literal)
  let factsAndSituation = '';
  if (isCrimeOrTheft) {
    factsAndSituation = 'La situación de presunto faltante, robo de material o afectación a los bienes de la empresa en el área.';
  } else if (isHierarchyOrBossConflict) {
    factsAndSituation = 'La situación de tensión y falta de respeto experimentada en la relación o interacción con la jefatura.';
  } else if (isDisciplinaryOrAbsenceCase) {
    factsAndSituation = 'La ausencia injustificada del colaborador al tomarse días de descanso o vacaciones sin previa autorización, limitándose a avisar por mensaje.';
  } else if (isSalaryCase) {
    if (raiseNotAnOption) {
      factsAndSituation = 'El colaborador condiciona su permanencia o actitud a una exigencia salarial inmediata, mientras que en la empresa el aumento de sueldo no es una opción viable en este momento.';
    } else {
      factsAndSituation = 'El colaborador plantea una exigencia de aumento salarial inmediato y manifiesta inconformidad o intención de salida si no se le concede.';
    }
  } else if (isDelegationCase) {
    factsAndSituation = 'La absorción directa de revisiones operativas por temor a fallas o no conformidades en el equipo.';
  } else if (isTaskNonComplianceCase) {
    factsAndSituation = 'El incumplimiento reiterado y desfase en las tareas o entregables prioritarios asignados al equipo.';
  } else if (isAttitudeCase) {
    factsAndSituation = 'La postura a la defensiva y la resistencia para alinearse a las tareas y acuerdos cotidianos de trabajo.';
  } else {
    factsAndSituation = 'La dinámica y los desacuerdos observados en el equipo respecto a los compromisos de trabajo cotidianos.';
  }

  // Formulate 2: Dilema del líder (Encrucijada concreta)
  let leaderDilemma = '';
  if (isCrimeOrTheft) {
    leaderDilemma = 'Actuar con apego a los protocolos legales y de Recursos Humanos o Seguridad sin precipitaciones, reuniendo evidencias sólidas antes de proceder formalmente.';
  } else if (isHierarchyOrBossConflict) {
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
  } else if (isDelegationCase) {
    leaderDilemma = 'Soltar el control y dar espacio de autonomía a los supervisores frente al temor de que ocurra un error crítico bajo tu responsabilidad.';
  } else {
    leaderDilemma = 'Abordar una conversación difícil con asertividad y firmeza, balanceando la exigencia de resultados con el cuidado del vínculo con la persona.';
  }

  // Formulate 3: Impacto y reto principal
  let impactAndMainChallenge = '';
  const expressesFatigue = ['cansad', 'agota', 'harto', 'frustra', 'estres', 'estrés', 'abrumad', 'desgaste'].some((k) => lower.includes(k));
  if (isCrimeOrTheft) {
    impactAndMainChallenge = 'Proteger la integridad del área, evitar riesgos legales para la empresa y proceder conforme a los lineamientos institucionales con total objetividad.';
  } else if (isHierarchyOrBossConflict) {
    impactAndMainChallenge = 'Frenar el desgaste emocional, recuperar la claridad estratégica y definir el mejor canal o momento para sostener una conversación asertiva y firme que restablezca el respeto mutuo.';
  } else if (isDisciplinaryOrAbsenceCase) {
    impactAndMainChallenge = 'Restablecer la disciplina y el respeto a las normas del equipo, evitando sentar un precedente negativo de permisividad o afectación a la equidad entre los demás colaboradores.';
  } else if (isSalaryCase) {
    impactAndMainChallenge = expressesFatigue
      ? 'Frenar el desgaste emocional acumulado, evitar sentar precedentes inviables en el equipo y definir con certeza el rumbo de la posición.'
      : 'Cuidar la equidad interna del equipo, proteger el clima laboral y definir con claridad el futuro de la colaboración.';
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

  // 1. Guardrail de límite terapéutico
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

  // 2. Reacción directa ante correcciones del usuario ("te confundiste", "eso no es lo que me preocupa")
  const isDirectCorrection = [
    'te confundiste', 'te confundes', 'eso no es lo que me preocupa', 'no es lo que me preocupa',
    'no me preocupa eso', 'te estás equivocando', 'te estas equivocando', 'te equivocaste',
    'no me entendiste', 'no me has entendido', 'no me comprendiste', 'no es por ahí', 'no es por ahi', 'no dije eso',
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

  // 3. Manejo de meta-conversación, aclaraciones o confusión
  const isConfusion = isMetaOrOperationalMessage(cleanMsg);
  if (isConfusion && stage === 1) {
    const anchorForConfusion = [
      sessionContext?.initialChallenge,
      sessionContext?.title,
      (history && history.length > 0 ? (history[0]?.text || history[0]?.content) : ''),
    ].filter((t) => t && !isMetaOrOperationalMessage(t)).join(' ').toLowerCase();

    const isCrimeOrTheftConfusion = [
      'robo', 'robando', 'robaron', 'robó', 'robo de material', 'hurto', 'sustracción',
      'sustraccion', 'sustrajo', 'desvío de material', 'delito', 'fraude', 'almacén', 'almacen'
    ].some((k) => anchorForConfusion.includes(k));

    const isBossConfusion = !isCrimeOrTheftConfusion && [
      'jefe', 'jefa', 'jefatura', 'director', 'directora', 'gerente', 'gerencia',
      'falta de respeto', 'respeto', 'me gritó', 'me grito', 'descalificó', 'descalifico',
      'humilló', 'humillo', 'maltrato', 'trato injusto', 'trato prepotente', 'prepotente',
      'mi superior', 'liderazgo superior', 'abuso de autoridad'
    ].some((k) => anchorForConfusion.includes(k));

    const isDisciplinaryConfusion = !isBossConfusion && !isCrimeOrTheftConfusion && [
      'vacacion', 'vacación', 'vacaciones', 'ausencia injustificada', 'ausencias injustificadas',
      'días sin permiso', 'dias sin permiso', 'sin autorizacion', 'sin autorización',
      'aviso por mensaje', 'avisó por mensaje', 'notifico por mensaje', 'notificó por mensaje',
      'no vino a trabajar', 'abandono de trabajo', 'abandono de puesto', 'faltar al trabajo'
    ].some((k) => anchorForConfusion.includes(k));

    const isSalaryConfusion = !isCrimeOrTheftConfusion && [
      'sueldo', 'salario', 'aumento', 'aumento salarial', 'dinero', 'remuneracion', 'remuneración',
      'compensacion', 'compensación', 'pagar', 'paga', 'exigiendo sueldo', 'pide aumento'
    ].some((k) => anchorForConfusion.includes(k));

    const isDeliveryConfusion = !isBossConfusion && !isCrimeOrTheftConfusion && [
      'entrega', 'entregables', 'plazo', 'fecha limite', 'fecha límite', 'retraso', 'retrasos',
      'no cumple', 'incumple', 'desempeño', 'calidad', 'actitud', 'defensiva', 'desmotivacion'
    ].some((k) => anchorForConfusion.includes(k));

    let simplifiedQuestion = '';
    if (isCrimeOrTheftConfusion) {
      simplifiedQuestion = `Te lo planteo de forma mucho más directa y sencilla, ${leaderName}: sobre lo ocurrido con el material o almacén, ¿cuentan ya con registros o evidencias claras de lo que pasó, o alguien en Recursos Humanos o Seguridad ya fue informado?`;
    } else if (isBossConfusion) {
      simplifiedQuestion = `Te lo pongo en palabras muy sencillas y directas, ${leaderName}: sobre lo que viviste con tu jefe en esa reunión, ¿qué fue exactamente lo que él dijo o hizo frente a los demás, y pudiste decirle algo en ese momento o no se pudo reaccionar?`;
    } else if (isDisciplinaryConfusion) {
      simplifiedQuestion = `Te lo formulo de manera más clara y simple, ${leaderName}: respecto al colaborador que se tomó los días sin autorización, ¿qué tareas urgentes quedaron afectadas en el equipo y qué reglamento interno tienen para atender una falta así?`;
    } else if (isSalaryConfusion) {
      simplifiedQuestion = `Te lo pregunto de forma más clara y cotidiana, ${leaderName}: sobre este colaborador que pide más sueldo, ¿cuánto incremento está solicitando y qué margen real tiene la empresa para considerar o descartar esa petición?`;
    } else if (isDeliveryConfusion) {
      simplifiedQuestion = `Te lo pregunto de forma más clara y concreta, ${leaderName}: sobre los retrasos o la postura del colaborador en las entregas, ¿cuáles eran las fechas y compromisos exactos pactados y qué te respondió cuando hablaste con él?`;
    } else {
      simplifiedQuestion = `Te lo planteo de forma más sencilla y aterrizada, ${leaderName}: sobre la situación que me compartiste con tu equipo, ¿qué fue exactamente lo que ocurrió en la última conversación con las personas involucradas y qué es lo que más te preocupa si no se resuelve pronto?`;
    }

    return {
      replyText: simplifiedQuestion,
      readyToAdvance: false,
      advancePrompt: null,
      detectedTheme: 'Clarificación de Pregunta',
      isTherapeuticCase: false,
    };
  }

  // 4. Detección de matices o restricciones añadidas por el líder tras el resumen
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
      replyText: `Gracias por esa precisión fundamental, ${leaderName}. Tener claro que esa vía no es una opción viable cambia por completo el panorama y nos evita plantear salidas poco realistas.\n\nActualizo el mapa de la situación incorporando este matiz:\n\n• **Hechos y situación:** ${factsAndSituation}\n• **Dilema del líder:** ${leaderDilemma}\n• **Impacto y reto principal:** ${impactAndMainChallenge}\n\nCon este ajuste descartando esa opción, ¿este resumen refleja fielmente el reto que quieres abordar? Si es así, estamos listos para dar el siguiente paso hacia la Etapa 2 (Analizar perspectivas y habilidades), donde exploraremos cómo vive la otra parte la situación y qué herramientas de liderazgo necesitas poner en juego.`,
      readyToAdvance: false,
      advancePrompt: null,
      detectedTheme: 'Integración de Matices y Re-validación',
      isTherapeuticCase: false,
    };
  }

  // 5. Petición explícita de NO avanzar o entender mejor / desglosar
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

  // 6. Cierre de Etapa 1 guiado con preview de valor (cuando el usuario confirma expresamente y SIN matices nuevos)
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
      replyText: `Me da mucho gusto que tengamos este mapa claro y alineado, ${leaderName}. Al tener delimitado con precisión lo que ocurre y tu encrucijada como líder, ¿estás de acuerdo en que pasemos a la Etapa 2 (Analizar perspectivas y habilidades), donde exploraremos cómo percibe la situación la otra parte y qué habilidades necesitas activar para destrabarla?`,
      readyToAdvance: true,
      advancePrompt: 'Avanzar a Etapa 2: Analizar perspectivas y habilidades',
      detectedTheme: 'Cierre de Etapa 1 Guiado',
      isTherapeuticCase: false,
    };
  }

  // 7. Pregunta repetida
  const isQuestionRepetitionComplaint = [
    'de nuevo la misma pregunta', 'otra vez la misma pregunta', 'ya te respondí esa pregunta',
    'ya te respondi esa pregunta', 'ya te contesté eso', 'ya te conteste eso', 'repetitivo'
  ].some((t) => lowerMsg.includes(t));

  if (isQuestionRepetitionComplaint && stage === 1) {
    return {
      replyText: `Agradezco tu aclaración, ${leaderName}. Tomo nota de lo que ya compartiste para no hacerte repetir. Para ir al punto clave: desde tu perspectiva, ¿cuál es el obstáculo principal que sientes que impide resolver esto con firmeza y qué resultado concreto necesitas asegurar hoy con tu equipo?`,
      readyToAdvance: false,
      advancePrompt: null,
      detectedTheme: 'Clarificación de Causa Raíz',
      isTherapeuticCase: false,
    };
  }

  // 8. Flujo dinámico de Etapa 1: Exploración narrativa adaptada al pilar
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

    const isDelegation = [
      'delegar', 'delegación', 'delegacion', 'centralizar', 'sobrecarga', 'miedo a delegar',
      'supervisores novatos', 'absorber'
    ].some((k) => lowerMsg.includes(k) || (sessionContext?.initialChallenge && sessionContext.initialChallenge.toLowerCase().includes(k)) || (sessionContext?.title && sessionContext.title.toLowerCase().includes(k)));

    const prevLidactaTexts = (history || [])
      .filter((m: any) => m.sender === 'lidacta' || m.role === 'model')
      .map((m: any) => (m.text || m.content || '').toLowerCase());

    const isCleanHistory = !history || history.length === 0 || history.every((m: any) => m.sender === 'leader' || m.role === 'user');

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

      if (isDelegation) {
        return {
          replyText: `La sobrecarga provocada por absorber tareas o la dificultad para soltar el control desgasta tu energía y limita el crecimiento del equipo, ${leaderName}.\n\nPara clarificar el punto de partida: ¿cuáles son las tareas específicas que hoy más te cuesta delegar y qué temores o riesgos visualizas si permites que otros las asuman?`,
          readyToAdvance: false,
          advancePrompt: null,
          detectedTheme: 'Delegación y Claridad de Roles',
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

    const hasExploredInitialPilar = prevLidactaTexts.some((t: string) =>
      t.includes('evidencias concretas') || t.includes('contexto de la junta') || t.includes('impacto operativo inmediato') ||
      t.includes('expectativas puntuales') || t.includes('acuerdos y plazos específicos') || t.includes('te cuesta delegar')
    );

    // Si aún no se indaga sobre el impacto o antecedentes, continuar la conversación narrativa
    if (!hasExploredInitialPilar) {
      if (isCrimeOrTheft) {
        return {
          replyText: `Comprendo la gravedad de este hecho sobre los bienes de la empresa, ${leaderName}. Para dimensionar la situación con rigor: ¿qué impacto operativo o de seguridad inmediata ha tenido el faltante, y qué protocolos formales existen con Recursos Humanos o Seguridad Patrimonial para proceder?`,
          readyToAdvance: false,
          advancePrompt: null,
          detectedTheme: 'Protocolos de Seguridad Patrimonial',
          isTherapeuticCase: false,
        };
      }

      if (isHierarchyOrBossConflict) {
        return {
          replyText: `Comprendo el impacto que tiene este abuso de autoridad de la jefatura, ${leaderName}. Para enfocar cómo abordarlo: ¿has tenido la oportunidad de conversar en privado con tu jefe sobre este hecho específico, o cómo ha sido la dinámica de comunicación entre ustedes antes de esta situación?`,
          readyToAdvance: false,
          advancePrompt: null,
          detectedTheme: 'Relación con Jefatura',
          isTherapeuticCase: false,
        };
      }

      if (isDisciplinaryOrAbsenceCase) {
        return {
          replyText: `Entiendo el impacto operativo que describes, ${leaderName}. Para asegurar que cualquier medida cuente con el debido sustento: ¿qué antecedentes o llamados de atención previos existen con esta persona sobre el cumplimiento de normas, y qué postura asumió cuando se le señalaron?`,
          readyToAdvance: false,
          advancePrompt: null,
          detectedTheme: 'Antecedentes Disciplinarios',
          isTherapeuticCase: false,
        };
      }

      if (isSalaryIssue) {
        return {
          replyText: `Tenemos delimitado el contexto salarial, ${leaderName}. Desde el plano de la gestión diaria: ¿cómo ha impactado esta inconformidad en su compromiso y desempeño operativo, y qué conversación has tenido con él sobre su valor y futuro en el equipo?`,
          readyToAdvance: false,
          advancePrompt: null,
          detectedTheme: 'Desempeño y Compensación',
          isTherapeuticCase: false,
        };
      }

      return {
        replyText: `Te escucho con atención, ${leaderName}. Para terminar de mapear el impacto real antes de estructurar el análisis: ¿de qué manera específica está afectando esta situación el clima de trabajo, los resultados del área o tu propia tranquilidad en el día a día?`,
        readyToAdvance: false,
        advancePrompt: null,
        detectedTheme: 'Profundización de Impacto',
        isTherapeuticCase: false,
      };
    }

    // Cierre mediante Resumen de Validación con Preview de Valor hacia la Etapa 2
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

export const maxDuration = 60; // 60 segundos de timeout

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
    let resolvedHistory = rawHistory.filter((m: any) => {
      if (!m || typeof m !== 'object') return false;
      const mCase = m.caseId || m.mentorshipId;
      if (targetCaseId) {
        return mCase === targetCaseId;
      }
      return true;
    });

    const isNewAccompaniment =
      Boolean(body?.isNewCase) ||
      (currentStageNum === 1 && (resolvedHistory.length <= 1 && resolvedHistory.every((m: any) => (m.sender === 'leader' || m.role === 'user'))));

    if (isNewAccompaniment) {
      resolvedHistory = [];
    } else {
      if (
        resolvedHistory.length > 0 &&
        (resolvedHistory[resolvedHistory.length - 1].sender === 'leader' || resolvedHistory[resolvedHistory.length - 1].role === 'user') &&
        (resolvedHistory[resolvedHistory.length - 1].text || resolvedHistory[resolvedHistory.length - 1].content || '').trim() === resolvedUserMessage
      ) {
        resolvedHistory = resolvedHistory.slice(0, -1);
      }
    }

    let initialSubstantiveChallenge = '';
    if (sessionData?.id === targetCaseId && sessionData?.initialChallenge && !isMetaOrOperationalMessage(sessionData.initialChallenge)) {
      initialSubstantiveChallenge = sessionData.initialChallenge;
    } else if (sessionData?.id === targetCaseId && sessionData?.title && !isMetaOrOperationalMessage(sessionData.title)) {
      initialSubstantiveChallenge = sessionData.title;
    } else {
      for (const m of rawHistory || []) {
        const txt = (m.text || m.content || '').trim();
        if ((m.sender === 'leader' || m.role === 'user') && txt && !isMetaOrOperationalMessage(txt)) {
          initialSubstantiveChallenge = txt;
          break;
        }
      }
      if (!initialSubstantiveChallenge && !isMetaOrOperationalMessage(resolvedUserMessage)) {
        initialSubstantiveChallenge = resolvedUserMessage;
      }
    }

    const activeCaseTitle = (sessionData?.id === targetCaseId ? sessionData?.title : '') || (initialSubstantiveChallenge ? initialSubstantiveChallenge.slice(0, 60) : 'Caso de liderazgo activo');
    const activeCaseChallenge = (sessionData?.id === targetCaseId ? sessionData?.initialChallenge : '') || initialSubstantiveChallenge || 'Reto de liderazgo y gestión de equipo';
    const safeSessionContext = {
      id: targetCaseId,
      title: activeCaseTitle,
      initialChallenge: activeCaseChallenge,
      currentStage: currentStageNum,
    };

    const apiKey =
      process.env.GEMINI_API_KEY ||
      process.env.API_KEY ||
      process.env.GOOGLE_API_KEY ||
      process.env.VITE_GEMINI_API_KEY ||
      process.env.NEXT_PUBLIC_GEMINI_API_KEY;

    if (!apiKey) {
      console.error('ERROR: No se detectó ninguna GEMINI_API_KEY en process.env');
      return res.status(200).json({
        success: false,
        reply: 'ERROR DE SERVIDOR: No se detectó ninguna GEMINI_API_KEY en process.env',
        text: 'ERROR DE SERVIDOR: No se detectó ninguna GEMINI_API_KEY en process.env',
        error: 'No se detectó ninguna GEMINI_API_KEY en process.env',
      });
    }

    const systemPrompt = `ERES LIDACTA: Mentora ejecutiva Senior y facilitadora de desarrollo de liderazgo interactivo. 
Tu misión es acompañar a los líderes en su entorno laboral cotidiano mediante una conversación guiada, estructurada y orientada a la acción.
Tu tono es humano, cercano, empático, claro, directo y ejecutivo. Jamás usas frases robóticas de plantilla, empatía falsa ni tecnicismos teóricos.

======================================================================
1. GUARDRAILS Y LÍMITES OPERATIVOS INAMOVIBLES
======================================================================
1. LÍMITE TERAPÉUTICO: No eres psicóloga ni impartes terapia. Si detectas crisis clínica o emocional personal, deriva con respeto a un profesional y activa el protocolo de notificación.
2. AUTONOMÍA DEL LÍDER: No tomas decisiones por el líder. Guías y cuestionas. Usa "Considerando tu situación, podrías explorar..." en lugar de "Te aconsejo que hagas X".
3. CERO CONSEJOS GENÉRICOS: Toda recomendación debe ser adaptada al contexto real expuesto y alineada a la Biblioteca Interna.

======================================================================
2. PROTOCOLO DE COMPRENSIÓN PROFUNDA Y ESCUCHA CONTEXTUAL (REGLA DE ORO)
======================================================================
1. COMPRENDER ANTES DE INTERPRETAR: Escucha cada respuesta antes de avanzar. Diferencia Hechos (lo que ocurrió), Preocupaciones (lo que realmente inquieta), Interpretaciones (juicios) e Impacto.
2. NO COMPLETAR LA HISTORIA CON SUPOSICIONES: Queda PROHIBIDO inventar o asumir incumplimientos recurrentes, actitudes defensivas o acuerdos previos que el líder NO haya mencionado.

3. ADAPTACIÓN AL TEMA SEGÚN SU NATURALEZA (PILARES DE INTERVENCIÓN):
   - Retroalimentación y Comunicación (bajo desempeño, cambio de conducta, conversaciones difíciles, transmitir ideas): Indaga sobre el contexto, ayuda al líder a aclarar sus ideas, el mensaje central que quiere transmitir y a considerar la importancia de cuidar la relación profesional.
   - Conflictos (diferencias, peleas, desacuerdos entre colaboradores o con el líder): Indaga el contexto y evalúa la gravedad e impacto real del conflicto.
   - Estrés y Emocionalidad del Líder (sobrecarga, frustración): Valida emociones de forma humana sin caer en conversaciones clínicas o terapéuticas.
   - Motivación (colaboradores desmotivados, apatía, desánimo): Indaga el contexto, las expectativas del líder y las del equipo al buscar motivación.
   - Delegación (sobrecarga, miedo a delegar, exceso de control, centralización): Indaga el contexto, los resultados esperados y la claridad de roles entre el líder y su equipo.
   - Casos Éticos / Faltas Graves / Delitos (robo, fuga de información, acoso): Indaga sobre hechos observables, evidencias y protocolos con RRHH/Legal. Queda PROHIBIDO preguntar por "acuerdos previos".
   - Caso no contemplado: Evalúa la gravedad percibida por el líder e indaga sobre lo que ocurrió concretamente antes de calificar la situación.

4. MANEJO DE META-CONVERSACIÓN Y ACLARACIONES:
   - Si el líder expresa confusión ("no entendí tu pregunta", "repite", "te confundiste"): RESPONDE ÚNICAMENTE ACLARANDO LA DUDA O REFORMULANDO LA PREGUNTA.
   - Queda ESTRICTAMENTE PROHIBIDO tomar frases de confusión del usuario como si fueran el "Hecho" o "Situación" del caso de liderazgo, y queda PROHIBIDO generar la plantilla de resumen ante una aclaración.

5. PROHIBIDO EL COPY-PASTE LITERAL: Jamás pegues frases textuales de duda del usuario dentro del resumen de validación. Redacta la síntesis interpretando la historia de fondo que motivó la consulta.

======================================================================
3. FLUJO OPERATIVO DE 7 ETAPAS (DINÁMICO Y FLEXIBLE)
======================================================================
ETAPA 1: DETECTAR QUÉ SUCEDE
- Objetivo: Clarificar los hechos, desahogar y mapear la preocupación real.
- Mecánica de Intervención:
  * Primeros turnos: Haz MÁXIMO 1 o 2 preguntas de profundización naturales y específicas sobre el hecho real según su pilar. Habla en formato narrativo fluido (PROHIBIDO usar plantillas con viñetas en el primer o segundo turno salvo que el líder haya entregado toda la historia completa).
  * Cuando haya información suficiente: Entrega la síntesis de validación con las 3 viñetas (**Hechos y situación**, **Dilema del líder**, **Impacto y reto principal**) basándote en la historia real planteada al inicio.

ETAPA 2: ANALIZAR PERSPECTIVAS Y HABILIDADES
- Cuestiona premisas, explora la contribución del líder sin culparlo e identifica la habilidad crítica a desarrollar.

ETAPA 3: DISEÑAR ALTERNATIVAS
- Estimula al líder a proponer opciones. Si se bloquea, sugiere hasta 2 opciones basadas en la Biblioteca Interna (SBI, DEEC, Delegate, Semáforo Emocional).

ETAPA 4: PRACTICAR ANTES DE ACTUAR (OPCIONAL)
- Ofrece simular la conversación o brindar una herramienta si aporta valor al caso.

ETAPA 5: ACTUAR (PLAN DE ACCIÓN)
- Define Acción exacta, Fecha/Hora, Involucrados y Puntos ciegos a cuidar.

ETAPA 6: APRENDER Y REFLEXIONAR
- Evalúa qué funcionó, qué no y qué aprendizaje se lleva el líder.

ETAPA 7: CIERRE Y RETROALIMENTACIÓN
- Entrega resumen ejecutivo con fortalezas, habilidades trabajadas y compromisos.

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

    const MODEL_NAME = process.env.GEMINI_MODEL || 'gemini-3.8-flash';
    const FALLBACK_MODEL = 'gemini-3.8-flash';
    const modelsToTry = [
      MODEL_NAME,
      ...(MODEL_NAME !== FALLBACK_MODEL ? [FALLBACK_MODEL] : []),
    ];
    let data: any = null;
    let ok = false;
    let lastStatus = 0;
    let lastErrorText = '';

    for (let i = 0; i < modelsToTry.length; i++) {
      const modelName = modelsToTry[i];
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 segundos de timeout
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
        lastStatus = response.status;

        if (response.ok) {
          data = await response.json();
          ok = true;
          break;
        }

        lastErrorText = await response.text();
        console.warn(`Gemini API (${modelName}) returned status ${response.status}:`, lastErrorText);

        // Si devuelve 503 (saturación) o 429 (límite de tasa), hacemos fallback automático al siguiente modelo
        if (response.status === 503 || response.status === 429) {
          console.warn(`Saturación/límite de tasa detectado (${response.status}) en ${modelName}. Procediendo con fallback automático...`);
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      } catch (fetchErr: any) {
        clearTimeout(timeoutId);
        lastErrorText = fetchErr?.message || String(fetchErr);
        console.warn(`Fetch error with ${modelName}:`, lastErrorText);
      }
    }

    if (!ok || !data?.candidates?.[0]?.content?.parts?.[0]?.text) {
      const errorMsg = lastErrorText || 'No se recibió respuesta válida de los candidatos de la API de Gemini.';
      return res.status(200).json({
        success: false,
        reply: `ERROR DE SERVIDOR (Gemini API ${lastStatus || 'Error'}): ${errorMsg}`,
        text: `ERROR DE SERVIDOR: ${errorMsg}`,
        error: errorMsg,
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

    const responseText = parsed?.replyText || parsed?.reply || rawText || candidatePartText;

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
    return res.status(200).json({
      success: false,
      reply: `ERROR DE SERVIDOR: ${error?.message || JSON.stringify(error)}`,
      text: `ERROR DE SERVIDOR: ${error?.message || JSON.stringify(error)}`,
      error: error?.message || 'Error en servidor',
    });
  }
}
