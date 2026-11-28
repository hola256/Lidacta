/**
 * skillsConsolidator.ts
 *
 * Módulo especializado en la normalización, consolidación semántica y deduplicación
 * de habilidades de liderazgo para Lidacta.
 *
 * Principios:
 * 1. Lidacta identifica las habilidades a partir del análisis del comportamiento,
 *    decisiones, respuestas y perspectivas del líder (sin requerir validación del líder).
 * 2. Únicamente las etapas 2 (Análisis), 3 (Comprensión) y 4 (Práctica opcional)
 *    pueden aportar evidencia para identificar, confirmar, precisar o reconsiderar habilidades.
 * 3. Las etapas 1, 5, 6 y 7 NO generan nuevas habilidades.
 * 4. Diferencia claramente entre "Habilidades que necesita fortalecer" (áreas de desarrollo)
 *    y "Evidencias de progreso" (avances observables en el proceso).
 * 5. Elimina duplicados por mayúsculas/minúsculas, acentos, sinónimos y conceptos equivalentes.
 */

import type {
  SkillStatus,
  EvidenceSourceType,
  ObservedEvidenceRecord,
  SkillReconsiderationRecord,
  LeadershipSkillEntry,
} from '../types/lidacta';

export type {
  SkillStatus,
  EvidenceSourceType,
  ObservedEvidenceRecord,
  SkillReconsiderationRecord,
  LeadershipSkillEntry,
};

export interface CanonicalSkillDefinition {
  canonicalName: string;
  cluster: string;
  keywords: string[];
}

export const CANONICAL_LEADERSHIP_SKILLS: CanonicalSkillDefinition[] = [
  {
    canonicalName: 'Comunicación Asertiva y Firmeza Empática',
    cluster: 'comunicacion',
    keywords: [
      'comunicacion asertiva',
      'comunicacion directa',
      'comunicacion clara',
      'asertividad',
      'asertivo',
      'asertiva',
      'firmeza empatica',
      'comunicacion firme',
      'expresion clara',
      'decir las cosas a tiempo',
      'postura clara',
      'claridad al comunicar',
      'comunicacion estrategica',
    ],
  },
  {
    canonicalName: 'Escucha Activa e Indagación',
    cluster: 'escucha',
    keywords: [
      'escucha activa',
      'escucha empatica',
      'capacidad de escucha',
      'escuchar',
      'indagacion',
      'hacer preguntas',
      'preguntas abiertas',
      'atencion al equipo',
      'no suponer',
      'comprender antes de responder',
    ],
  },
  {
    canonicalName: 'Gestión y Clarificación de Acuerdos',
    cluster: 'acuerdos',
    keywords: [
      'gestion de acuerdos',
      'establecimiento de acuerdos',
      'acuerdos operativos',
      'clarificacion de expectativas',
      'alineacion de expectativas',
      'manejo de expectativas',
      'seguimiento de compromisos',
      'reglas claras',
      'acuerdos y seguimiento',
      'cumplimiento de acuerdos',
    ],
  },
  {
    canonicalName: 'Delegación Efectiva y Empoderamiento',
    cluster: 'delegacion',
    keywords: [
      'delegacion',
      'delegar',
      'empoderamiento',
      'empoderar',
      'soltar el control',
      'soltar tareas',
      'confiar tareas',
      'asignacion de responsabilidades',
      'supervision sin microgestion',
      'autonomia del equipo',
    ],
  },
  {
    canonicalName: 'Inteligencia y Regulación Emocional',
    cluster: 'emocional',
    keywords: [
      'inteligencia emocional',
      'regulacion emocional',
      'autocontrol',
      'manejo del estres',
      'calma bajo presion',
      'contencion emocional',
      'gestion de la frustracion',
      'tolerancia a la frustracion',
      'temperamento',
      'paciencia',
    ],
  },
  {
    canonicalName: 'Resolución Constructiva de Conflictos',
    cluster: 'conflicto',
    keywords: [
      'resolucion de conflictos',
      'manejo de conflictos',
      'gestion de conflictos',
      'mediacion',
      'destrabar tensiones',
      'confrontacion constructiva',
      'conversaciones dificiles',
      'desacuerdos',
      'manejo de diferencias',
    ],
  },
  {
    canonicalName: 'Retroalimentación Basada en Hechos',
    cluster: 'retroalimentacion',
    keywords: [
      'retroalimentacion',
      'feedback',
      'modelo ehi',
      'retroalimentacion constructiva',
      'observaciones basadas en hechos',
      'retroalimentar',
      'retroalimentacion continua',
      'dar retroalimentacion',
    ],
  },
  {
    canonicalName: 'Motivación y Desarrollo de Equipos',
    cluster: 'motivacion',
    keywords: [
      'motivacion',
      'desarrollo de colaboradores',
      'reconocimiento',
      'clima laboral',
      'compromiso del equipo',
      'inspirar al equipo',
      'liderazgo inspiracional',
      'desarrollo de talento',
    ],
  },
  {
    canonicalName: 'Pensamiento Estratégico y Priorización',
    cluster: 'estrategia',
    keywords: [
      'pensamiento estrategico',
      'priorizacion',
      'toma de decisiones',
      'vision global',
      'enfoque operativo',
      'organizacion del trabajo',
      'criterio directivo',
    ],
  },
];

/**
 * Normaliza una cadena de texto para comparación semántica:
 * Remueve acentos, puntuación innecesaria, espacios repetidos y pasa a minúsculas.
 */
export function normalizeText(text: string): string {
  if (!text) return '';
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Quitar tildes
    .replace(/[^\w\s]/gi, ' ') // Quitar signos de puntuación
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Capitaliza en formato título profesional español.
 */
export function toTitleCase(str: string): string {
  const clean = str.trim();
  if (!clean) return '';
  const exceptions = ['y', 'e', 'o', 'u', 'de', 'del', 'en', 'con', 'para', 'a', 'al', 'por'];
  return clean
    .split(' ')
    .filter(Boolean)
    .map((word, index) => {
      const lower = word.toLowerCase();
      if (index > 0 && exceptions.includes(lower)) {
        return lower;
      }
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(' ');
}

function hasWholePhrase(haystack: string, needle: string): boolean {
  if (!haystack || !needle) return false;
  if (haystack === needle) return true;
  return (
    haystack.startsWith(`${needle} `) ||
    haystack.endsWith(` ${needle}`) ||
    haystack.includes(` ${needle} `)
  );
}

function buildCustomClusterKey(normalized: string): string {
  return normalized.slice(0, 48);
}

/**
 * Mapea una habilidad candidata al catálogo canónico de Lidacta cuando existe una correspondencia clara y unívoca.
 * Evita asignaciones por coincidencias ambiguas de subcadenas o múltiples clústeres simultáneos.
 * Si no coincide claramente con ningún clúster canónico pero es una competencia válida,
 * la conserva en formato TitleCase sin forzarla dentro del catálogo de 9 clústeres.
 */
export function mapToCanonicalSkill(rawSkill: string): { canonicalName: string; cluster: string } | null {
  const rawClean = (rawSkill || '').trim();
  if (!rawClean) return null;

  // Filtrar textos genéricos, vacíos o mensajes de estado oficial
  const normalized = normalizeText(rawClean);
  if (
    normalized.length < 3 ||
    normalized === 'ninguna' ||
    normalized === 'ninguna habilidad' ||
    normalized === 'sin habilidad' ||
    normalized === 'n a' ||
    normalized === 'no aplica' ||
    normalized === 'sin evidencia' ||
    normalized === 'por definir' ||
    normalized === 'pendiente' ||
    normalized === 'habilidad 1' ||
    normalized === 'habilidad 2' ||
    normalized === 'habilidad' ||
    normalized === 'habilidades' ||
    isInsufficientEvidenceMessage(rawClean)
  ) {
    return null;
  }

  // 1. Priorizar coincidencia exacta con nombre canónico o keyword exacta
  for (const def of CANONICAL_LEADERSHIP_SKILLS) {
    if (normalized === normalizeText(def.canonicalName)) {
      return { canonicalName: def.canonicalName, cluster: def.cluster };
    }
    for (const kw of def.keywords) {
      if (normalized === normalizeText(kw)) {
        return { canonicalName: def.canonicalName, cluster: def.cluster };
      }
    }
  }

  // 2. Coincidencia por frase completa dentro de la habilidad candidata (sin subcadenas inversas ambiguas)
  const matchedDefs: CanonicalSkillDefinition[] = [];
  for (const def of CANONICAL_LEADERSHIP_SKILLS) {
    const canonicalNorm = normalizeText(def.canonicalName);
    let matched = hasWholePhrase(normalized, canonicalNorm);
    if (!matched) {
      for (const kw of def.keywords) {
        if (hasWholePhrase(normalized, normalizeText(kw))) {
          matched = true;
          break;
        }
      }
    }
    if (matched) {
      matchedDefs.push(def);
    }
  }

  // Solo normalizar a un clúster canónico si la correspondencia es clara y no ambigua (un único clúster)
  if (matchedDefs.length === 1) {
    return { canonicalName: matchedDefs[0].canonicalName, cluster: matchedDefs[0].cluster };
  }

  // Si no corresponde claramente a un clúster (0 coincidencias o mezcla ambigua de varios), no forzar clasificación
  return {
    canonicalName: toTitleCase(rawClean),
    cluster: buildCustomClusterKey(normalized),
  };
}

export interface Stage2EvidenceContext {
  caseTitle?: string;
  initialChallenge?: string;
  leaderUtterances?: string[];
}

export interface Stage34EvidenceContext extends Stage2EvidenceContext {
  leaderAlternatives?: string[];
  chosenAlternative?: string;
  hasStage4LeaderInput?: boolean;
}

export interface ConsolidateSkillOptions {
  requireEvidenceInStage2?: boolean;
  stage2EvidenceContext?: Stage2EvidenceContext;
  requireEvidenceInStages34?: boolean;
  stage34EvidenceContext?: Stage34EvidenceContext;
}

const STAGE2_STOPWORDS = new Set([
  'para', 'como', 'pero', 'porque', 'cuando', 'donde', 'sobre', 'entre', 'desde', 'hasta',
  'hacia', 'ante', 'bajo', 'contra', 'segun', 'durante', 'mediante', 'este', 'esta', 'estos',
  'estas', 'ese', 'esa', 'esos', 'esas', 'aquel', 'aquella', 'ello', 'ellos', 'ellas',
  'nosotros', 'ustedes', 'quien', 'quienes', 'cual', 'cuales', 'todo', 'toda', 'todos',
  'todas', 'algo', 'nada', 'mucho', 'poco', 'mas', 'menos', 'muy', 'bien', 'mal', 'aqui',
  'alli', 'ahora', 'antes', 'despues', 'siempre', 'nunca', 'solo', 'sola', 'también', 'tambien',
  'pero', 'sino', 'aunque', 'mientras', 'entonces', 'luego', 'pues', 'tener', 'tiene', 'tienen',
  'tengo', 'tuvo', 'hacer', 'hace', 'hizo', 'hacen', 'hago', 'estar', 'esta', 'estan', 'estoy',
  'estuvo', 'haber', 'habia', 'hubo', 'puede', 'pueden', 'puedo', 'pudo', 'poder', 'debe',
  'deben', 'debo', 'sera', 'fueron', 'siendo', 'sido', 'lider', 'lidacta', 'caso', 'etapa',
  'problema', 'situacion', 'reto', 'habilidad', 'habilidades', 'evidencia', 'relato',
  'menciono', 'comento', 'dijo', 'expreso', 'indico', 'senalo', 'cuenta', 'contar',
  'muestra', 'refleja', 'demuestra', 'necesita', 'requiere', 'fortalecer', 'desarrollar',
  'colaborador', 'colaboradores', 'equipo', 'persona', 'personas', 'area', 'trabajo',
]);

const STAGE2_SEMANTIC_CONCEPT_GROUPS: string[][] = [
  ['miedo', 'temor', 'teme', 'evit', 'incomod', 'confront'],
  ['enoj', 'molest', 'frustr', 'reacc', 'alter', 'impuls', 'calm', 'estres', 'presi'],
  ['habl', 'deci', 'dijo', 'convers', 'call', 'silenc', 'expres', 'comunic', 'plante'],
  ['report', 'entreg', 'tare', 'pendient', 'cumpl', 'plaz', 'fech', 'objetiv'],
  ['tard', 'retras', 'atras', 'demor', 'tiemp', 'puntual', 'horario'],
  ['deleg', 'control', 'asum', 'solt', 'central', 'microgest', 'autonom', 'responsab'],
  ['acuerd', 'regl', 'compromis', 'expectat', 'paut', 'lineamient', 'seguimient'],
  ['conflic', 'discus', 'roce', 'tens', 'desacuerd', 'diferenc', 'pele'],
  ['retroaliment', 'feedback', 'correg', 'observ', 'senalamient', 'desempen'],
  ['motiv', 'desanim', 'apat', 'reconoc', 'desinter', 'compromet', 'clima'],
  ['jefe', 'gerent', 'superv', 'coord', 'analis', 'direct', 'subordin'],
  ['sueld', 'salari', 'aument', 'pago', 'compens', 'tabulador'],
  ['vacacion', 'ausenc', 'falt', 'permis', 'asist', 'disciplin', 'norma', 'politic'],
  ['prioriz', 'decis', 'orden', 'urgenc', 'importan', 'organiz'],
];

function extractStage2ContentTokens(text: string): string[] {
  const norm = normalizeText(text);
  if (!norm) return [];
  return norm
    .split(' ')
    .filter((token) => token.length >= 4 && !STAGE2_STOPWORDS.has(token));
}

function isMetaOrOperationalStage2Text(text: string): boolean {
  const norm = normalizeText(text);
  if (!norm) return true;
  if (/^avanzando a etapa \d+/.test(norm)) return true;
  if (
    /^(si|no|ok|okey|vale|listo|de acuerdo|claro|perfecto|gracias|entendido|va|sale|avancemos|continuemos|siguiente)$/.test(
      norm
    )
  ) {
    return true;
  }
  return false;
}

export function isPertinentStage2SkillLabel(rawSkill: string): boolean {
  const rawClean = (rawSkill || '').trim();
  if (!rawClean || rawClean.length > 110) return false;
  const normalized = normalizeText(rawClean);
  const words = normalized.split(' ').filter(Boolean);
  if (words.length === 0 || words.length > 12) return false;
  if (!mapToCanonicalSkill(rawClean)) return false;

  if (
    /^(no se cuenta|falta de evidencia|evidencia insuficiente|no hay evidencia|el lider debe|recomiendo|sugiero)/.test(
      normalized
    )
  ) {
    return false;
  }
  return true;
}

export function isValidStage2ObservableEvidence(
  evidenceText: string,
  context?: Stage2EvidenceContext
): boolean {
  const clean = (evidenceText || '').trim();
  if (!clean) return false;
  if (isInsufficientEvidenceMessage(clean)) return false;

  const normEvidence = normalizeText(clean);
  const words = normEvidence.split(' ').filter(Boolean);
  if (normEvidence.length < 10 || words.length < 2) return false;

  // Rechazar marcadores explícitos de ausencia de evidencia o mera especulación sin sustento
  if (
    /\b(sin evidencia|no hay evidencia|no existe evidencia|evidencia insuficiente|sin registro|por definir|por confirmar|no especificado|no mencionado|aun no relata|no ha compartido|no aporto datos|no proporciono informacion|sin datos suficientes|solo por el titulo|basado en el titulo|se supone que|es probable que|probablemente|seguramente|quizas)\b/.test(
      normEvidence
    )
  ) {
    return false;
  }

  if (!context) {
    return true;
  }

  // Cuando hay contexto de sesión real, exigir narrativa observable mínima y anclaje verificable
  if (words.length < 4 && normEvidence.length < 20) {
    return false;
  }

  const rawUtterances = [
    ...(Array.isArray(context.leaderUtterances) ? context.leaderUtterances : []),
    ...(context.initialChallenge ? [context.initialChallenge] : []),
  ]
    .map((u) => (u || '').trim())
    .filter((u) => u.length > 0 && !isMetaOrOperationalStage2Text(u));

  const narrativeTokens = new Set<string>();
  for (const utt of rawUtterances) {
    for (const tok of extractStage2ContentTokens(utt)) {
      narrativeTokens.add(tok);
    }
  }

  // Si el líder todavía no ha aportado relato concreto alguno en el caso
  if (narrativeTokens.size < 3) {
    return false;
  }

  // Rechazar si solo repite el título del problema sin aportar conductas o hechos concretos
  const normTitle = normalizeText(context.caseTitle || '');
  if (normTitle) {
    if (normEvidence === normTitle) {
      return false;
    }
    const titleTokens = new Set(extractStage2ContentTokens(normTitle));
    const evidenceTokens = extractStage2ContentTokens(clean);
    const evidenceBeyondTitle = evidenceTokens.filter((t) => !titleTokens.has(t));
    if (titleTokens.size >= 2 && normEvidence.includes(normTitle) && evidenceBeyondTitle.length < 2) {
      return false;
    }
    // Si el único texto del caso es idéntico al título corto y sin detalle conductual
    const narrativeBeyondTitle = Array.from(narrativeTokens).filter((t) => !titleTokens.has(t));
    if (titleTokens.size >= 1 && narrativeBeyondTitle.length === 0 && evidenceBeyondTitle.length < 2) {
      return false;
    }
  }

  // Verificar anclaje real entre la evidencia propuesta y el relato del líder (cita o paráfrasis fiel)
  const evidenceContentTokens = extractStage2ContentTokens(clean);
  if (evidenceContentTokens.length === 0) {
    return false;
  }

  const narrativeList = Array.from(narrativeTokens);
  const hasStemOverlap = evidenceContentTokens.some((evTok) => {
    const evStem = evTok.slice(0, 4);
    return narrativeList.some((narTok) => {
      const narStem = narTok.slice(0, 4);
      return evTok === narTok || evStem === narStem;
    });
  });

  if (hasStemOverlap) {
    return true;
  }

  const hasConceptOverlap = STAGE2_SEMANTIC_CONCEPT_GROUPS.some((group) => {
    const evInGroup = evidenceContentTokens.some((tok) =>
      group.some((prefix) => tok.startsWith(prefix))
    );
    if (!evInGroup) return false;
    return narrativeList.some((tok) => group.some((prefix) => tok.startsWith(prefix)));
  });

  return hasConceptOverlap;
}

export function buildStage2EvidenceContext(params: {
  caseTitle?: string;
  initialChallenge?: string;
  history?: any[];
  latestUserMessage?: string;
}): Stage2EvidenceContext {
  const leaderMessages: string[] = [];
  for (const m of Array.isArray(params.history) ? params.history : []) {
    if (!m || typeof m !== 'object') continue;
    const isLeader = m.sender === 'leader' || m.role === 'user';
    if (!isLeader) continue;
    const msgStage = Number(m.stage);
    if (m.stage !== undefined && m.stage !== null && !Number.isNaN(msgStage) && msgStage > 2) {
      continue;
    }
    const text = String(m.text || m.content || '').trim();
    if (text && !isMetaOrOperationalStage2Text(text)) {
      leaderMessages.push(text);
    }
  }
  const latest = (params.latestUserMessage || '').trim();
  if (latest && !isMetaOrOperationalStage2Text(latest)) {
    leaderMessages.push(latest);
  }
  return {
    caseTitle: (params.caseTitle || '').trim() || undefined,
    initialChallenge: (params.initialChallenge || '').trim() || undefined,
    leaderUtterances: leaderMessages,
  };
}

export function buildStage2LocalContextRule(params: {
  caseTitle?: string;
  initialChallenge?: string;
  history?: any[];
  latestUserMessage?: string;
  leaderProfile?: any;
  companyContext?: any;
}): string {
  const stage1Utterances: string[] = [];
  const stage2Utterances: string[] = [];

  for (const m of Array.isArray(params.history) ? params.history : []) {
    if (!m || typeof m !== 'object') continue;
    if (m.sender !== 'leader' && m.role !== 'user') continue;
    const text = String(m.text || m.content || '').trim();
    if (!text || isMetaOrOperationalStage2Text(text)) continue;
    const msgStage = Number(m.stage);
    if (msgStage === 2) {
      stage2Utterances.push(text);
    } else if (!msgStage || msgStage === 1) {
      stage1Utterances.push(text);
    }
  }

  const latest = (params.latestUserMessage || '').trim();
  if (latest && !isMetaOrOperationalStage2Text(latest) && !stage2Utterances.includes(latest)) {
    stage2Utterances.push(latest);
  }

  const profileBits = [
    params.leaderProfile?.position ? `Puesto: ${params.leaderProfile.position}` : '',
    params.leaderProfile?.area ? `Área: ${params.leaderProfile.area}` : '',
    typeof params.leaderProfile?.directReports === 'number'
      ? `Personas a cargo: ${params.leaderProfile.directReports}`
      : '',
    params.companyContext?.industry ? `Industria: ${params.companyContext.industry}` : '',
  ]
    .filter(Boolean)
    .join(' | ');

  return `
REGLA LOCAL DE ETAPA 2 (DIAGNÓSTICO DE HABILIDADES CON EVIDENCIA VERIFICABLE):
- Contexto completo del caso actual (NO diagnostiques basándote solo en el último mensaje):
  * Título de referencia (no usar por sí solo como evidencia): ${params.caseTitle || 'Caso actual'}
  * Desafío inicial del caso: ${params.initialChallenge || 'No especificado'}
  * Relato del líder en Etapa 1: ${stage1Utterances.join(' | ') || 'Sin mensajes sustantivos previos'}
  * Aportes del líder en Etapa 2: ${stage2Utterances.join(' | ') || 'Aún sin aportes nuevos en Etapa 2'}
  * Perfil y contexto laboral (usar únicamente si aporta evidencia relevante al caso): ${profileBits || 'No especificado'}
- Requisitos obligatorios para proponer habilidades en "identifiedSkills":
  1. Cada habilidad DEBE enviarse como objeto { "skill": "...", "evidenceText": "..." } donde "evidenceText" sea una cita breve o paráfrasis fiel de comportamientos, decisiones o dificultades concretas relatadas por el líder en el caso actual (Etapa 1 o Etapa 2).
  2. PROHIBIDO proponer habilidades basadas únicamente en el título del problema, en suposiciones sobre el líder o en conductas no relatadas.
  3. Prioriza uno de los 9 clústeres canónicos cuando haya correspondencia clara; si una competencia válida no corresponde claramente a ninguno, nómbrala con precisión sin forzar un clúster ambiguo. Conserva la distinción entre los 9 clústeres canónicos y las 6 áreas de desarrollo de la Biblioteca Interna.
  4. Si todavía no existe evidencia observable suficiente en el relato del líder, devuelve "identifiedSkills": [], "readyToAdvance": false, "advancePrompt": null, y formula una pregunta concreta para recabar hechos o conductas antes de presentar habilidades como identificadas.`;
}

const STAGE34_CONTEXT_CONCEPT_GROUPS: string[][] = [
  ...STAGE2_SEMANTIC_CONCEPT_GROUPS,
  ['miedo', 'temor', 'teme', 'evit', 'incomod', 'confront', 'friccion', 'tens', 'defensiv', 'roce', 'desacuerd', 'diferenc', 'pele', 'conflic', 'discus'],
  ['enoj', 'molest', 'frustr', 'reacc', 'alter', 'impuls', 'calm', 'estres', 'presi', 'satur', 'desgast', 'sobrecarg', 'pacienc', 'seren', 'emocion'],
  ['habl', 'deci', 'dijo', 'convers', 'call', 'silenc', 'expres', 'comunic', 'plante', 'dialog', 'explic', 'indag', 'pregunt', 'escuch', 'interrump', 'direct', 'tono', 'mensaj', 'corre', 'escrit'],
  ['orden', 'exactament', 'impon', 'imposit', 'ultimatum', 'punitiv', 'amenaz', 'escal', 'exig', 'margen', 'autoritari', 'directriz', 'unilateral'],
  ['report', 'entreg', 'tare', 'pendient', 'cumpl', 'plaz', 'fech', 'objetiv', 'corte', 'bitacor', 'tard', 'retras', 'atras', 'demor', 'tiemp', 'puntual', 'horari'],
  ['deleg', 'control', 'asum', 'solt', 'central', 'microgest', 'autonom', 'responsab', 'haciend', 'absor', 'aprob', 'cubr', 'distribu', 'asign', 'operativ', 'personal'],
  ['acuerd', 'regl', 'compromis', 'expectat', 'paut', 'lineamient', 'seguimient', 'clarid', 'criteri'],
  ['retroaliment', 'feedback', 'correg', 'observ', 'senalamient', 'desempen', 'hecho', 'juici', 'subjetiv', 'critic'],
  ['motiv', 'desanim', 'apat', 'reconoc', 'desinter', 'compromet', 'clima', 'iniciativ', 'entusiasm'],
  ['prioriz', 'decis', 'orden', 'urgenc', 'importan', 'organiz', 'plan', 'alternativ', 'opcion', 'estrateg'],
  ['sueld', 'salari', 'aument', 'pago', 'compens', 'tabulador', 'presupuest', 'bono', 'vacacion', 'ausenc', 'falt', 'permis', 'asist', 'disciplin', 'norma', 'politic', 'corporat', 'estructur', 'proceso', 'sistem', 'extern', 'ajeno', 'rrhh', 'herramient', 'tecnic', 'restricc', 'alcance', 'autoridad', 'sindical', 'laboral'],
];

const STAGE34_SIMULATION_MARKERS = ['simulac', 'ensay', 'practic', 'roleplay', 'ejercic', 'escenari'];

const STAGE34_GENERIC_FILLER_TOKENS = new Set([
  'aplica', 'aplicar', 'corresponde', 'necesaria', 'necesario', 'cambiar', 'quitar', 'eliminar',
  'descartar', 'sustituir', 'reemplazar', 'mejor', 'otra', 'importante', 'general', 'actual',
  'proceso', 'gerente', 'puesto', 'empresa', 'liderazgo', 'competencia', 'aspecto', 'punto',
]);

function hasSpeculativeOrMissingEvidenceMarkers(normText: string): boolean {
  return /\b(sin evidencia|no hay evidencia|no existe evidencia|evidencia insuficiente|sin registro|por definir|por confirmar|no especificado|no mencionado|aun no relata|no ha compartido|no aporto datos|no proporciono informacion|sin datos suficientes|solo por el titulo|basado en el titulo|se supone que|es probable que|probablemente|seguramente|quizas|sin sustento|sin respaldo)\b/.test(
    normText
  );
}

function collectStage34NarrativeTokens(context: Stage34EvidenceContext): Set<string> {
  const rawUtterances = [
    ...(Array.isArray(context.leaderUtterances) ? context.leaderUtterances : []),
    ...(context.initialChallenge ? [context.initialChallenge] : []),
    ...(Array.isArray(context.leaderAlternatives) ? context.leaderAlternatives : []),
    ...(context.chosenAlternative ? [context.chosenAlternative] : []),
  ]
    .map((u) => (u || '').trim())
    .filter((u) => u.length > 0 && !isMetaOrOperationalStage2Text(u));

  const narrativeTokens = new Set<string>();
  for (const utt of rawUtterances) {
    for (const tok of extractStage2ContentTokens(utt)) {
      narrativeTokens.add(tok);
    }
  }
  return narrativeTokens;
}

function failsCaseTitleOnlyCheck(
  cleanText: string,
  normText: string,
  caseTitle: string | undefined,
  narrativeTokens: Set<string>
): boolean {
  const normTitle = normalizeText(caseTitle || '');
  if (!normTitle) return false;
  if (normText === normTitle) return true;

  const titleTokens = new Set(extractStage2ContentTokens(normTitle));
  const textTokens = extractStage2ContentTokens(cleanText);
  const textBeyondTitle = textTokens.filter((t) => !titleTokens.has(t));
  if (titleTokens.size >= 2 && normText.includes(normTitle) && textBeyondTitle.length < 2) {
    return true;
  }
  const narrativeBeyondTitle = Array.from(narrativeTokens).filter((t) => !titleTokens.has(t));
  if (titleTokens.size >= 1 && narrativeBeyondTitle.length === 0 && textBeyondTitle.length < 2) {
    return true;
  }
  return false;
}

function hasContextualSemanticMatch(
  candidateTokens: string[],
  narrativeTokens: Set<string>,
  hasStage4LeaderInput?: boolean
): boolean {
  const substantiveTokens = candidateTokens.filter((t) => !STAGE34_GENERIC_FILLER_TOKENS.has(t));
  if (substantiveTokens.length === 0) return false;

  const narrativeList = Array.from(narrativeTokens);
  const hasStemOverlap = substantiveTokens.some((evTok) => {
    const evStem = evTok.slice(0, 4);
    return narrativeList.some((narTok) => {
      const narStem = narTok.slice(0, 4);
      return evTok === narTok || evStem === narStem;
    });
  });
  if (hasStemOverlap) return true;

  const hasConceptOverlap = STAGE34_CONTEXT_CONCEPT_GROUPS.some((group) => {
    const evInGroup = substantiveTokens.some((tok) =>
      group.some((prefix) => tok.startsWith(prefix))
    );
    if (!evInGroup) return false;
    return narrativeList.some((tok) => group.some((prefix) => tok.startsWith(prefix)));
  });
  if (hasConceptOverlap) return true;

  if (hasStage4LeaderInput && substantiveTokens.length >= 3) {
    const mentionsSimulation = substantiveTokens.some((tok) =>
      STAGE34_SIMULATION_MARKERS.some((prefix) => tok.startsWith(prefix))
    );
    if (mentionsSimulation) return true;
  }

  return false;
}

/**
 * Valida evidencia contextual y paráfrasis pertinentes en Etapas 3 y 4.
 * No exige coincidencia literal de palabras y acepta aclaraciones o síntesis de simulación
 * ancladas al desafío e historial disponible del caso.
 */
export function isValidStage34ContextualEvidence(
  evidenceText: string,
  context?: Stage34EvidenceContext
): boolean {
  const clean = (evidenceText || '').trim();
  if (!clean) return false;
  if (isInsufficientEvidenceMessage(clean)) return false;

  const normEvidence = normalizeText(clean);
  const words = normEvidence.split(' ').filter(Boolean);
  if (normEvidence.length < 10 || words.length < 2) return false;

  if (hasSpeculativeOrMissingEvidenceMarkers(normEvidence)) {
    return false;
  }

  if (!context) {
    return true;
  }

  if (words.length < 4 && normEvidence.length < 22) {
    return false;
  }

  const narrativeTokens = collectStage34NarrativeTokens(context);
  if (narrativeTokens.size < 3) {
    return false;
  }

  if (failsCaseTitleOnlyCheck(clean, normEvidence, context.caseTitle, narrativeTokens)) {
    return false;
  }

  const evidenceContentTokens = extractStage2ContentTokens(clean);
  if (evidenceContentTokens.length === 0) {
    return false;
  }

  return hasContextualSemanticMatch(
    evidenceContentTokens,
    narrativeTokens,
    context.hasStage4LeaderInput
  );
}

/**
 * Valida la justificación de reconsideración (discard, replace, reactivate) en Etapas 3 y 4.
 * Acepta tanto conductas observables como aclaraciones contextuales pertinentes sobre el problema
 * o restricciones externas del caso.
 */
export function isValidReconsiderationJustification(
  justificationText: string,
  context?: Stage34EvidenceContext
): boolean {
  const clean = (justificationText || '').trim();
  if (!clean) return false;
  if (isInsufficientEvidenceMessage(clean)) return false;

  const normText = normalizeText(clean);
  const words = normText.split(' ').filter(Boolean);
  if (normText.length < 10 || words.length < 2) return false;

  if (hasSpeculativeOrMissingEvidenceMarkers(normText)) {
    return false;
  }

  const substantiveWithoutFiller = extractStage2ContentTokens(clean).filter(
    (t) => !STAGE34_GENERIC_FILLER_TOKENS.has(t)
  );
  if (substantiveWithoutFiller.length < 2) {
    return false;
  }

  if (!context) {
    return true;
  }

  if (words.length < 4 && normText.length < 22) {
    return false;
  }

  const narrativeTokens = collectStage34NarrativeTokens(context);
  if (narrativeTokens.size < 3) {
    return false;
  }

  if (failsCaseTitleOnlyCheck(clean, normText, context.caseTitle, narrativeTokens)) {
    return false;
  }

  const contentTokens = extractStage2ContentTokens(clean);
  if (contentTokens.length === 0) {
    return false;
  }

  return hasContextualSemanticMatch(
    contentTokens,
    narrativeTokens,
    context.hasStage4LeaderInput
  );
}

export function buildStage34EvidenceContext(params: {
  caseTitle?: string;
  initialChallenge?: string;
  history?: any[];
  latestUserMessage?: string;
  leaderAlternatives?: string[];
  chosenAlternative?: string | null;
  currentStage?: number;
}): Stage34EvidenceContext {
  const leaderMessages: string[] = [];
  let hasStage4LeaderInput = false;

  for (const m of Array.isArray(params.history) ? params.history : []) {
    if (!m || typeof m !== 'object') continue;
    const isLeader = m.sender === 'leader' || m.role === 'user';
    if (!isLeader) continue;
    const msgStage = Number(m.stage);
    if (m.stage !== undefined && m.stage !== null && !Number.isNaN(msgStage) && msgStage > 4) {
      continue;
    }
    const text = String(m.text || m.content || '').trim();
    if (text && !isMetaOrOperationalStage2Text(text)) {
      leaderMessages.push(text);
      if (msgStage === 4) {
        hasStage4LeaderInput = true;
      }
    }
  }

  const latest = (params.latestUserMessage || '').trim();
  if (latest && !isMetaOrOperationalStage2Text(latest)) {
    leaderMessages.push(latest);
    if (params.currentStage === 4) {
      hasStage4LeaderInput = true;
    }
  }

  const cleanAlternatives = Array.isArray(params.leaderAlternatives)
    ? params.leaderAlternatives
        .filter((a): a is string => typeof a === 'string' && a.trim().length > 0)
        .map((a) => a.trim())
    : [];

  return {
    caseTitle: (params.caseTitle || '').trim() || undefined,
    initialChallenge: (params.initialChallenge || '').trim() || undefined,
    leaderUtterances: leaderMessages,
    leaderAlternatives: cleanAlternatives.length > 0 ? cleanAlternatives : undefined,
    chosenAlternative:
      typeof params.chosenAlternative === 'string' && params.chosenAlternative.trim()
        ? params.chosenAlternative.trim()
        : undefined,
    hasStage4LeaderInput,
  };
}

export function buildStage3LocalContextRule(params: {
  existingSkills?: string[];
}): string {
  const activeList =
    Array.isArray(params.existingSkills) && params.existingSkills.length > 0
      ? params.existingSkills.join(', ')
      : 'Ninguna habilidad vigente registrada aún';

  return `
REGLA LOCAL DE ETAPA 3 (RECONOCIMIENTO DE DECISIONES):
- Si en el último mensaje el líder elige o confirma explícitamente una alternativa o camino de acción (ej. "me quedo con...", "elijo...", "vamos con...", "prefiero...", "haré esa") sin expresar dudas activas ni pedir comparación:
  * Reconoce y confirma explícitamente la alternativa elegida.
  * Está PROHIBIDO seguir comparando ventajas y desventajas después de una decisión firme.
  * Está PROHIBIDO proponer alternativas adicionales cuando el líder ya eligió.
  * Habilita el avance ("readyToAdvance": true y "advancePrompt" breve invitando a Etapa 4 opcional o Etapa 5).
- Si el líder todavía expresa dudas, solicita orientación o pregunta por consecuencias sin elegir, acompaña su análisis manteniendo "readyToAdvance": false.
- Contraste y trazabilidad de habilidades en Etapa 3:
  * Contrasta las habilidades vigentes (${activeList}) con la nueva información, alternativas o aclaraciones del líder.
  * No propongas habilidades nuevas sin evidencia suficiente vinculada al desafío y al historial del caso (envía objetos { "skill": "...", "evidenceText": "..." }).
  * Si la nueva información justifica descartar, precisar/sustituir o recuperar una habilidad previa (incluida una personalizada), usa "skillsReconsideration" con "discard", "replace" o "reactivate" (para "reactivate", incluye "evidence" con la justificación explícita y "newEvidenceText" con la nueva evidencia), siempre con respaldo contextual real.`;
}

export function buildStage4LocalContextRule(params: {
  existingSkills?: string[];
  isPracticeMode?: boolean;
}): string {
  const activeList =
    Array.isArray(params.existingSkills) && params.existingSkills.length > 0
      ? params.existingSkills.join(', ')
      : 'Ninguna habilidad vigente registrada aún';

  return `
REGLA LOCAL DE ETAPA 4 (PRÁCTICA OPCIONAL Y EVIDENCIA EN SIMULACIÓN):
- Habilidades vigentes previas a contrastar: ${activeList}${params.isPracticeMode ? ' (sesión en modo práctica/roleplay)' : ''}.
- Distingue con claridad las conductas observadas durante la simulación práctica (se registran como evidencia de simulación) frente a los hechos relatados de la experiencia real del líder.
- Si el líder participa en el ejercicio práctico, utiliza sus intervenciones reales para confirmar, precisar, descartar o sustituir habilidades con respaldo concreto en "identifiedSkills" ({ "skill": "...", "evidenceText": "..." }) o en "skillsReconsideration" ("discard", "replace" o "reactivate" con "evidence" y "newEvidenceText").
- PROHIBIDO inventar habilidades para completar el diagnóstico cuando falte evidencia suficiente, y PROHIBIDO reemplazar el criterio del líder o decidir por él.
- Si el líder omite la práctica o no realiza simulación, conserva intactas las habilidades previas sin inventar evidencia ni descartes.`;
}

export function buildFeedbackLanguageLocalRule(): string {
  return `
REGLA LOCAL DE LENGUAJE DE RETROALIMENTACIÓN Y RECONOCIMIENTO (OBLIGATORIA EN CONVERSACIÓN Y REPORTE FINAL):
- Reconoce avances, decisiones, reflexiones y conductas concretas únicamente cuando exista evidencia real en la conversación; explica brevemente qué hizo o identificó el líder y por qué resulta relevante para el desafío que está trabajando.
- Evita elogios vacíos, superlativos y aprobaciones automáticas ("excelente", "brillante", "perfecto", "muy bien") cuando no aporten información concreta.
- Evita atribuciones generales de personalidad o carácter ("gran madurez", "mucha valentía", "gran temple", "liderazgo maduro") que no estén sustentadas en conductas observables de la sesión.
- Diferencia con claridad la validación emocional legítima (acompañar carga, duda, frustración o preocupación sin juzgar) de la evaluación positiva del líder o de sus decisiones.
- No fuerces reconocimientos en cada intervención: si aún no hay evidencia suficiente, continúa de forma natural mediante escucha activa, reflexión o preguntas pertinentes.
- Mantén siempre un tono humano, cálido, cercano, respetuoso y natural; nunca vuelvas la mentoría fría, mecánica ni excesivamente formal.
- Distingue con precisión entre una intención, una decisión elegida, una acción diseñada, una acción programada (con fecha) y una acción efectivamente ejecutada.`;
}

/**
 * Directivas explícitas de reconsideración de habilidades basadas en evidencia observable.
 * Aplicables exclusivamente en etapas 3 y 4.
 */
export interface SkillReconsiderationDirective {
  discard?: Array<{
    skill: string;
    evidence: string;
  }>;
  replace?: Array<{
    from: string;
    to: string;
    evidence: string;
    newEvidenceText?: string;
    evidenceText?: string;
  }>;
  reactivate?: Array<{
    skill: string;
    evidence: string;
    newEvidenceText?: string;
    evidenceText?: string;
  }>;
}

/**
 * Etapas autorizadas para identificar o precisar habilidades:
 * Solo las etapas 2, 3 y 4 aportan evidencia válida para habilidades.
 */
export const SKILL_EVIDENCE_STAGES = new Set([2, 3, 4]);

export const INSUFFICIENT_EVIDENCE_MESSAGE =
  'No se cuenta con evidencia suficiente en este proceso para identificar habilidades específicas por fortalecer.';

export const INSUFFICIENT_STRENGTHS_MESSAGE =
  'No se cuenta con evidencia suficiente en este proceso para identificar fortalezas observables específicas.';

export function isInsufficientEvidenceMessage(text: string): boolean {
  if (typeof text !== 'string') return false;
  const trimmed = text.trim();
  if (!trimmed) return false;
  return (
    trimmed === INSUFFICIENT_EVIDENCE_MESSAGE ||
    normalizeText(trimmed) === normalizeText(INSUFFICIENT_EVIDENCE_MESSAGE)
  );
}

/**
 * Sanea y valida el arreglo de fortalezas detectadas:
 * 1. Filtra elementos válidos (strings no vacíos).
 * 2. Garantiza que el mensaje visual de transparencia nunca se almacene como elemento de datos.
 * 3. Limita a un máximo de 4 fortalezas.
 * 4. Permite un arreglo vacío ([]) sin forzar elementos artificiales.
 */
export function sanitizeDetectedStrengths(rawStrengths: any): string[] {
  if (!Array.isArray(rawStrengths)) return [];
  return rawStrengths
    .filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
    .map((s) => s.trim())
    .filter((s) => s !== INSUFFICIENT_STRENGTHS_MESSAGE)
    .slice(0, 4);
}

export interface Stage7StrengthCalibrationContext {
  skillEntries?: LeadershipSkillEntry[] | null;
  identifiedSkills?: string[] | null;
  stageTwoSkills?: string[] | null;
  conversationHistory?: Array<{
    sender?: string;
    role?: string;
    stage?: number | string;
    text?: string;
    content?: string;
  }> | null;
  actionPlan?: {
    what?: string;
    when?: string;
    withWhom?: string;
    how?: string;
    careReminders?: string;
    isCompleted?: boolean;
  } | null;
  chosenAlternative?: string | null;
  actionPlanExecutionStatus?: string | null;
  learnings?: {
    whatHappened?: string;
    whatWorked?: string;
    whatDidnt?: string;
    insights?: string;
    futureAdjustments?: string;
  } | null;
  isPracticeMode?: boolean;
}

interface ActiveSkillMatcher {
  cluster: string;
  canonicalNorm: string;
  phrases: string[];
  customTokens: string[];
}

const STRENGTH_GENERIC_SKILL_TOKENS = new Set([
  'habilidad', 'habilidades', 'competencia', 'competencias', 'capacidad', 'capacidades',
  'gestion', 'manejo', 'desarrollo', 'liderazgo', 'efectiva', 'efectivo', 'constructiva',
  'constructivo', 'basada', 'hechos', 'equipo', 'equipos', 'persona', 'personas',
  'clarificacion', 'empatica', 'empatico', 'activa', 'activo', 'estrategico', 'estrategica',
  'profesional', 'laboral', 'directivo', 'directiva',
]);

const STRENGTH_PROCESS_TRIVIAL_LEARNINGS = new Set([
  'aun no lo se', 'todavia no lo se', 'no lo se', 'no se', 'aun no', 'todavia no',
  'pendiente', 'ninguno', 'ninguna', 'nada', 'n a', 'na', 'no aplica', 'sin ejecucion',
  'sin comentarios', 'sin observaciones',
]);

function capitalizeSpanishSentence(text: string): string {
  const clean = text.trim();
  if (!clean) return '';
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

function buildActiveSkillMatchers(context?: Stage7StrengthCalibrationContext): ActiveSkillMatcher[] {
  if (!context) return [];
  const rawNames: string[] = [];
  const seen = new Set<string>();

  const pushSkillName = (name: unknown) => {
    if (typeof name !== 'string') return;
    const trimmed = name.trim();
    if (!trimmed || isInsufficientEvidenceMessage(trimmed)) return;
    const beforeEvidence = trimmed.split(/\s+[—-]\s+(?:Evidencia|Habilidad previamente)/i)[0].trim();
    if (!beforeEvidence || isInsufficientEvidenceMessage(beforeEvidence)) return;
    const key = normalizeText(beforeEvidence);
    if (!key || seen.has(key)) return;
    seen.add(key);
    rawNames.push(beforeEvidence);
  };

  if (Array.isArray(context.skillEntries) && context.skillEntries.length > 0) {
    for (const entry of getActiveSkillEntries(context.skillEntries)) {
      pushSkillName(entry.skill);
    }
  } else if (Array.isArray(context.identifiedSkills)) {
    for (const s of context.identifiedSkills) {
      pushSkillName(s);
    }
  }

  if (Array.isArray(context.stageTwoSkills)) {
    for (const s of context.stageTwoSkills) {
      pushSkillName(s);
    }
  }

  const matchers: ActiveSkillMatcher[] = [];
  for (const name of rawNames) {
    const mapped = mapToCanonicalSkill(name);
    const canonicalNorm = mapped ? normalizeText(mapped.canonicalName) : normalizeText(name);
    const canonicalDef = mapped
      ? CANONICAL_LEADERSHIP_SKILLS.find((d) => d.cluster === mapped.cluster)
      : undefined;

    const phrases = canonicalDef
      ? [normalizeText(canonicalDef.canonicalName), ...canonicalDef.keywords.map(normalizeText)]
      : [canonicalNorm];

    const customTokens = canonicalNorm
      .split(' ')
      .filter((t) => t.length >= 4 && !STAGE2_STOPWORDS.has(t) && !STRENGTH_GENERIC_SKILL_TOKENS.has(t));

    matchers.push({
      cluster: mapped ? mapped.cluster : canonicalNorm,
      canonicalNorm,
      phrases: Array.from(new Set(phrases.filter(Boolean))),
      customTokens,
    });
  }

  return matchers;
}

function matchesAnyActiveSkill(normStrength: string, matchers: ActiveSkillMatcher[]): boolean {
  if (!normStrength || matchers.length === 0) return false;

  for (const matcher of matchers) {
    if (matcher.phrases.some((phrase) => hasWholePhrase(normStrength, phrase))) {
      return true;
    }

    if (matcher.customTokens.length > 0) {
      const strengthTokens = new Set(normStrength.split(' ').filter(Boolean));
      const matchedTokens = matcher.customTokens.filter((tok) => strengthTokens.has(tok));
      const threshold = matcher.customTokens.length === 1 ? 1 : 2;
      if (matchedTokens.length >= threshold) {
        return true;
      }
    }
  }

  return false;
}

function hasMasteryOrConsolidationClaim(norm: string): boolean {
  return (
    /\b(?:dominio\s+(?:consolidado|pleno|solido|completo|total|sobresaliente|demostrado|efectivo|alto|profesional)|pleno\s+dominio|solido\s+dominio|alto\s+dominio|maestria(?:\s+(?:demostrada|consolidada|profesional))?|experto\s+en|experta\s+en)\b/.test(
      norm
    ) ||
    /\b(?:habilidad|competencia|capacidad|destreza)\s+(?:plenamente\s+|totalmente\s+|ya\s+)?(?:consolidada|dominada|desarrollada|madura)\b/.test(
      norm
    ) ||
    /\b(?:ya\s+domina|domina\s+(?:plenamente|con\s+soltura|por\s+completo|sin\s+dificultad)|manejo\s+(?:sobresaliente|experto|pleno|consolidado)|nivel\s+(?:experto|maestria|sobresaliente))\b/.test(
      norm
    ) ||
    /\b(?:capacidad\s+permanente|practica\s+permanente|habito\s+(?:plenamente\s+)?consolidado|de\s+forma\s+permanente|en\s+todo\s+momento\s+en\s+(?:su\s+)?(?:piso|trabajo|area|equipo)|desempeno\s+(?:sobresaliente|ejemplar)\s+consolidado|liderazgo\s+plenamente\s+consolidado)\b/.test(
      norm
    ) ||
    /\b(?:excelente|sobresaliente|solida|plena)\s+(?:capacidad|habilidad|competencia|manejo|gestion|destreza)\s+consolidada\b/.test(
      norm
    )
  );
}

function hasDirectTraitPraiseWithoutProcess(norm: string): boolean {
  if (
    /\b(?:excelente|sobresaliente|solida|alta|gran|notable|impecable|ejemplar|extraordinaria|fuerte|buena|brillante|admirable)\s+(?:capacidad|habilidad|competencia|manejo|gestion|destreza|comunicacion|delegacion|escucha|retroalimentacion|inteligencia|regulacion|motivacion|resolucion)\b/.test(
      norm
    )
  ) {
    return true;
  }

  return /^(?:comunicacion\s+asertiva|delegacion\s+efectiva|escucha\s+activa|inteligencia\s+emocional|regulacion\s+emocional|retroalimentacion\s+(?:basada\s+en\s+hechos|constructiva)|resolucion\s+(?:constructiva\s+)?de\s+conflictos|gestion\s+de\s+acuerdos|motivacion\s+y\s+desarrollo|pensamiento\s+estrategico)\b/.test(
    norm
  );
}

function hasPersonalTraitAttributionOrValuePraise(norm: string): boolean {
  if (
    /\b(?:excelente|brillante|perfect[ao]|extraordinari[ao]|admirable|ejemplar|notable|sobresaliente|impecable|magnific[ao]|fantastic[ao]|grandios[ao]|buen[ao]?)\s+(?:decision|eleccion|respuesta|intervencion|postura|actitud|lider|liderazgo|criterio|propuesta|accion|manejo|gestion|capacidad|habilidad|nivel)\b/.test(
      norm
    )
  ) {
    return true;
  }

  if (
    /\b(?:decision|eleccion|respuesta|postura|actitud|criterio)\s+(?:excelente|brillante|perfect[ao]|acertad[ao]|ejemplar|sobresaliente|valiente|madur[ao]|inteligente|extraordinari[ao])\b/.test(
      norm
    )
  ) {
    return true;
  }

  if (
    /\b(?:gran|mucha|enorme|alta|notable|ejemplar|admirable|extraordinaria|buena|solida)\s+(?:madurez|valentia|temple|caracter|criterio|determinacion|entereza|firmeza|serenidad|sabiduria|claridad|apertura|honestidad|autoconciencia)\b/.test(
      norm
    )
  ) {
    return true;
  }

  if (
    /\b(?:demuestra|demostro|muestra|mostro|evidencia|refleja|tiene|posee)\s+(?:una?\s+)?(?:gran\s+|mucha\s+|enorme\s+|alta\s+|notable\s+|admirable\s+|extraordinaria\s+)?(?:madurez|valentia|temple|caracter|liderazgo\s+maduro|capacidad\s+innata|criterio\s+excepcional|decision\s+brillante)\b/.test(
      norm
    )
  ) {
    return true;
  }

  if (
    /\bliderazgo\s+(?:maduro|ejemplar|extraordinario|brillante|sobresaliente|impecable)\b/.test(norm) ||
    /\b(?:un|una)\s+(?:gran|excelente|extraordinari[ao]|brillante|ejemplar)\s+lider\b/.test(norm) ||
    /\bmadurez\s+(?:reflexiva|emocional|personal|profesional|directiva|de\s+liderazgo)\b/.test(norm)
  ) {
    return true;
  }

  return /^(?:excelente|brillante|perfecto|muy\s+bien|bien\s+hecho|felicidades|es\s+una\s+excelente|fue\s+una\s+excelente)\b/.test(
    norm
  );
}

function hasConcreteBehavioralAction(norm: string): boolean {
  return /\b(?:reconocio|reconocer|identifico|identificar|distinguio|distinguir|separo|separar|diferencio|diferenciar|pauso|pausar|preparo|preparar|estructuro|estructurar|formulo|formular|propuso|proponer|pidio|pedir|escucho|escuchar|expuso|exponer|expreso|expresar|planteo|plantear|cuestiono|cuestionar|aclaro|aclarar|acepto|aceptar|corrigio|corregir|ajusto|ajustar|reprogramo|reprogramar|definio|definir|delimito|delimitar|diseno|disenar|acordo|acordar|asumio|asumir|solicito|solicitar|recibio|recibir|comunico|comunicar|ensayo|ensayar|practico|practicar|senalo|senalizar|explico|explicar|documento|documentar|trato|tratar|abordo|abordar|priorizo|priorizar|reviso|revisar|verifico|verificar|confirmo|confirmar|dialogo|dialogar|converso|conversar|pregunto|preguntar|indago|indagar|postergo|postergar|evito|evitar|intervino|intervenir|respondio|responder|organizo|organizar|establecio|establecer|concreto|concretar|cumplio|cumplir|aplic[oa]r?|sostuvo|sostener|mantuvo|mantener|escuchando|pidiendo|exponiendo|reconociendo|preguntando|validando|proponiendo|autoanalisis|habitos\s+propios)\b/.test(
    norm
  );
}

function isIsolatedAbstractNounStrength(norm: string): boolean {
  const hasAbstractQualityNoun = /\b(?:apertura|honestidad|autoconciencia|autocritica|disposicion|iniciativa|preparacion|transparencia|humildad|empatia|sensibilidad|respeto|serenidad|temple|madurez|valentia|caracter|criterio|claridad|compromiso)\b/.test(
    norm
  );
  if (!hasAbstractQualityNoun) return false;
  return !hasConcreteBehavioralAction(norm);
}

function hasObservableProcessBehavior(norm: string): boolean {
  return hasConcreteBehavioralAction(norm);
}

function isExplicitlyScopedToSimulation(norm: string): boolean {
  return /\b(?:en\s+(?:la\s+)?simulacion|durante\s+(?:la\s+)?simulacion|en\s+el\s+(?:ensayo|roleplay|role\s+play|ejercicio(?:\s+practico)?|escenario\s+de\s+practica)|durante\s+(?:la\s+practica|el\s+ensayo|el\s+ejercicio|el\s+roleplay)|en\s+la\s+practica\s+(?:guiada|de\s+etapa\s+4|simulada))\b/.test(
    norm
  );
}

function claimsGeneralizedPermanence(norm: string): boolean {
  return (
    /\b(?:habitualmente|cotidianamente|consistentemente|permanentemente|en\s+todas\s+sus\s+interacciones(?:\s+laborales)?|en\s+todo\s+momento|capacidad\s+permanente|habito\s+consolidado|de\s+forma\s+permanente)\b/.test(
      norm
    ) ||
    /\b(?:siempre\s+(?:aplica|demuestra|escucha|delega|retroalimenta|regula|comunica)|de\s+manera\s+(?:habitual|cotidiana|consistente|sistematica|permanente)\s+(?:en\s+(?:su\s+)?(?:trabajo|equipo|area|piso)|aplica|demuestra|implementa))\b/.test(
      norm
    )
  );
}

function claimsWorkplacePerformance(norm: string): boolean {
  return (
    /\b(?:en\s+(?:su|el)\s+trabajo(?:\s+(?:diario|cotidiano|habitual))?|en\s+piso|en\s+(?:su|la)\s+(?:operacion|area|planta)\s+(?:diaria|cotidiana)|en\s+el\s+dia\s+a\s+dia)\b/.test(
      norm
    ) ||
    /\b(?:desempeno\s+(?:habitual|diario|cotidiano|solido\s+en\s+(?:el\s+)?(?:trabajo|piso)|demostrado\s+en\s+(?:el\s+)?(?:trabajo|piso)|en\s+el\s+puesto)|aplica\s+.{0,40}\b(?:en\s+su\s+trabajo|habitualmente)|ya\s+(?:implementa|aplica)\s+.{0,30}\ben\s+su\s+(?:area|trabajo|piso))\b/.test(
      norm
    )
  );
}

function claimsStrengthExecutionOrResults(norm: string): boolean {
  if (isExplicitlyScopedToSimulation(norm)) return false;
  if (
    /\b(?:pendiente|no\s+(?:se\s+)?(?:ha\s+)?ejecut\w*|sin\s+ejecut\w*|antes\s+de\s+(?:conversar|actuar|ejecutar)|por\s+ejecut\w*|para\s+ejecut\w*|al\s+disenar|diseno\s+de|diseno\s+un)\b/.test(
      norm
    )
  ) {
    return false;
  }

  return (
    /\b(?:ya\s+(?:se\s+)?(?:ejecuto|realizo|implemento|cumplio|efectuo|concreto|llevo\s+a\s+cabo)|(?:accion|reunion|plan|conversacion)\s+(?:ya\s+)?(?:ejecutad[ao]|completad[ao]|implementad[ao]|concluid[ao]|realizad[ao]))\b/.test(
      norm
    ) ||
    /\b(?:ejecuto|implemento|llevo\s+a\s+cabo|concreto|cumplio|aplico)\s+(?:con\s+exito|exitosamente|eficazmente|en\s+(?:campo|piso|su\s+area)|el\s+plan|la\s+accion|la\s+reunion|la\s+conversacion|el\s+acuerdo)\b/.test(
      norm
    ) ||
    /\b(?:logro\s+(?:mejorar|resultados|que\s+(?:el\s+)?equipo|cambios\s+en)|obtuvo\s+resultados(?:\s+positivos|\s+favorables)?|al\s+aplicar\s+(?:su|el)\s+plan|tras\s+(?:ejecutar|aplicar|implementar)\s+(?:el\s+plan|la\s+accion|la\s+reunion)|sostuvo\s+(?:con\s+exito\s+)?la\s+(?:reunion|conversacion|charla).{0,35}\b(?:logrando|obteniendo|con\s+resultados))\b/.test(
      norm
    )
  );
}

function extractObservableBehaviorWithoutMastery(rawText: string): string | null {
  const clean = rawText.trim();
  if (!clean) return null;

  const colonSplit = clean.split(/\s*(?::|—|\s+-\s+)\s*/);
  if (colonSplit.length >= 2) {
    const leftNorm = normalizeText(colonSplit[0]);
    const rightRaw = colonSplit.slice(1).join(': ').trim();
    const rightNorm = normalizeText(rightRaw);
    const rightWords = rightNorm.split(' ').filter(Boolean);
    if (
      (hasMasteryOrConsolidationClaim(leftNorm) ||
        hasDirectTraitPraiseWithoutProcess(leftNorm) ||
        hasPersonalTraitAttributionOrValuePraise(leftNorm)) &&
      rightWords.length >= 4 &&
      !hasMasteryOrConsolidationClaim(rightNorm) &&
      !hasPersonalTraitAttributionOrValuePraise(rightNorm)
    ) {
      return capitalizeSpanishSentence(rightRaw);
    }
  }

  const directDecisionInfinitive = clean.match(
    /^(?:es|fue|tom[oó]|hizo)?\s*(?:una?\s+)?(?:excelente|brillante|perfecta|muy\s+buena|buena|notable|acertada|valiente|madura)\s+(?:decisi[oó]n|elecci[oó]n|postura|respuesta)\s+(?:el\s+|de\s+)?(.+)$/i
  );
  if (directDecisionInfinitive && directDecisionInfinitive[1]) {
    const tail = directDecisionInfinitive[1].trim();
    const tailNorm = normalizeText(tail);
    const tailWords = tailNorm.split(' ').filter(Boolean);
    if (
      !/^(?:al|cuando|mediante|para|porque)\b/i.test(tail) &&
      tailWords.length >= 4 &&
      hasConcreteBehavioralAction(tailNorm) &&
      !hasMasteryOrConsolidationClaim(tailNorm) &&
      !hasPersonalTraitAttributionOrValuePraise(tailNorm)
    ) {
      return capitalizeSpanishSentence(tail);
    }
  }

  const becauseOrWhenMatch = clean.match(/^.*?\b(?:porque|cuando)\s+(.+)$/i);
  if (becauseOrWhenMatch && becauseOrWhenMatch[1]) {
    const tail = becauseOrWhenMatch[1].trim();
    const tailNorm = normalizeText(tail);
    const tailWords = tailNorm.split(' ').filter(Boolean);
    if (
      tailWords.length >= 4 &&
      hasConcreteBehavioralAction(tailNorm) &&
      !hasMasteryOrConsolidationClaim(tailNorm) &&
      !hasPersonalTraitAttributionOrValuePraise(tailNorm)
    ) {
      return capitalizeSpanishSentence(tail);
    }
  }

  const clauseMatch = clean.match(
    /^.*?\b(?:al|cuando|mediante|para)\s+(.+)$/i
  );
  if (clauseMatch && clauseMatch[1]) {
    const fullLower = clean.toLowerCase();
    const tail = clauseMatch[1].trim();
    const tailNorm = normalizeText(tail);
    const tailWords = tailNorm.split(' ').filter(Boolean);
    if (
      tailWords.length >= 4 &&
      !hasMasteryOrConsolidationClaim(tailNorm) &&
      !hasPersonalTraitAttributionOrValuePraise(tailNorm)
    ) {
      const idx = fullLower.lastIndexOf(tail.toLowerCase());
      const prefixSegment = idx > 0 ? fullLower.slice(0, idx).trim() : '';
      if (/\bal$/.test(prefixSegment)) {
        return `Disposición observada al ${tail}`;
      }
      if (/\bpara$/.test(prefixSegment)) {
        return `Disposición para ${tail}`;
      }
      if (/\bmediante$/.test(prefixSegment)) {
        return `Conducta observada mediante ${tail}`;
      }
      if (/\bcuando$/.test(prefixSegment)) {
        return capitalizeSpanishSentence(tail);
      }
    }
  }

  return null;
}

function hasSubstantiveSessionEvidenceForStrengths(context: Stage7StrengthCalibrationContext): boolean {
  if (Array.isArray(context.skillEntries)) {
    for (const entry of context.skillEntries) {
      if (
        Array.isArray(entry?.evidenceHistory) &&
        entry.evidenceHistory.some((ev) => typeof ev?.evidenceText === 'string' && ev.evidenceText.trim().length >= 8)
      ) {
        return true;
      }
      if (
        Array.isArray(entry?.reconsiderationHistory) &&
        entry.reconsiderationHistory.some(
          (rec) => typeof rec?.reconsiderationReason === 'string' && rec.reconsiderationReason.trim().length >= 8
        )
      ) {
        return true;
      }
    }
  }

  if (Array.isArray(context.conversationHistory)) {
    for (const m of context.conversationHistory) {
      if (!m || typeof m !== 'object') continue;
      if (m.sender !== 'leader' && m.role !== 'user') continue;
      const text = String(m.text || m.content || '').trim();
      if (!text || isMetaOrOperationalStage2Text(text)) continue;
      const norm = normalizeText(text);
      const words = norm.split(' ').filter(Boolean);
      if (words.length >= 4 || norm.length >= 20) {
        return true;
      }
    }
  }

  if (
    typeof context.actionPlan?.what === 'string' &&
    context.actionPlan.what.trim().length >= 8 &&
    !isInsufficientEvidenceMessage(context.actionPlan.what)
  ) {
    return true;
  }

  if (
    typeof context.chosenAlternative === 'string' &&
    context.chosenAlternative.trim().length >= 8 &&
    !isInsufficientEvidenceMessage(context.chosenAlternative)
  ) {
    return true;
  }

  if (context.learnings && typeof context.learnings === 'object') {
    const learningVals = [
      context.learnings.whatHappened,
      context.learnings.whatWorked,
      context.learnings.whatDidnt,
      context.learnings.insights,
      context.learnings.futureAdjustments,
    ];
    for (const raw of learningVals) {
      if (typeof raw !== 'string') continue;
      const norm = normalizeText(raw);
      if (norm.length >= 8 && !STRENGTH_PROCESS_TRIVIAL_LEARNINGS.has(norm)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Calibra de manera determinística `detectedStrengths` en el cierre de Etapa 7:
 * 1. Evita que una habilidad activa por desarrollar (`stageTwoSkills`) aparezca como dominio consolidado o maestría.
 * 2. Conserva conductas observables positivas (reformulando la atribución de dominio si existe evidencia conductual).
 * 3. Impide atribuir desempeño habitual en el trabajo cuando la evidencia es únicamente de simulación de Etapa 4,
 *    permitiendo describir lo observado dentro de la simulación.
 * 4. Impide atribuir resultados de ejecución cuando la acción sigue pendiente o no ejecutada.
 * 5. Conserva `[]` cuando no existe evidencia suficiente sin inventar fortalezas.
 */
export function calibrateStage7DetectedStrengths(
  rawStrengths: unknown,
  context?: Stage7StrengthCalibrationContext
): string[] {
  if (!Array.isArray(rawStrengths) || rawStrengths.length === 0) {
    return [];
  }

  if (context && !hasSubstantiveSessionEvidenceForStrengths(context)) {
    return [];
  }

  const activeSkillMatchers = buildActiveSkillMatchers(context);

  const hasSimulationEvidence = Boolean(
    context &&
      (context.isPracticeMode ||
        (Array.isArray(context.skillEntries) &&
          context.skillEntries.some(
            (e) =>
              Array.isArray(e?.evidenceHistory) &&
              e.evidenceHistory.some(
                (ev) => ev?.sourceType === 'simulacion_practica' || Number(ev?.stage) === 4
              )
          )) ||
        (Array.isArray(context.conversationHistory) &&
          context.conversationHistory.some(
            (m) =>
              m &&
              (m.sender === 'leader' || m.role === 'user') &&
              Number(m.stage) === 4 &&
              !isMetaOrOperationalStage2Text(String(m.text || m.content || ''))
          )))
  );

  const executionStatus =
    context?.actionPlanExecutionStatus ||
    (context?.actionPlan?.isCompleted ? 'executed' : null);

  const isExplicitlyExecuted =
    executionStatus === 'executed' ||
    Boolean(
      context?.actionPlan?.isCompleted &&
        executionStatus !== 'not_executed' &&
        executionStatus !== 'pending_verification'
    );

  const isConfirmedUnexecuted =
    executionStatus === 'not_executed' || executionStatus === 'pending_verification';

  const hasPendingPlanWithoutExecution =
    Boolean(context?.actionPlan?.what && context.actionPlan.what.trim()) &&
    !isExplicitlyExecuted;

  const hasRealExperienceHistory = Boolean(
    context &&
      ((Array.isArray(context.skillEntries) &&
        context.skillEntries.some(
          (e) =>
            Array.isArray(e?.evidenceHistory) &&
            e.evidenceHistory.some(
              (ev) => ev?.sourceType === 'experiencia_relatada' || Number(ev?.stage) < 4
            )
        )) ||
        (Array.isArray(context.conversationHistory) &&
          context.conversationHistory.some(
            (m) =>
              m &&
              (m.sender === 'leader' || m.role === 'user') &&
              Number(m.stage) !== 4 &&
              !isMetaOrOperationalStage2Text(String(m.text || m.content || ''))
          )))
  );

  const calibrated: string[] = [];
  const seen = new Set<string>();

  const validateAndPush = (candidate: string) => {
    const trimmed = candidate.trim();
    if (!trimmed) return;
    if (trimmed === INSUFFICIENT_STRENGTHS_MESSAGE || isInsufficientEvidenceMessage(trimmed)) {
      return;
    }

    const norm = normalizeText(trimmed);
    const words = norm.split(' ').filter(Boolean);
    if (norm.length < 8 || words.length < 2) return;
    if (hasSpeculativeOrMissingEvidenceMarkers(norm)) return;

    const simulationScoped = isExplicitlyScopedToSimulation(norm);
    if (simulationScoped && context && !hasSimulationEvidence) {
      return;
    }

    if ((isConfirmedUnexecuted || hasPendingPlanWithoutExecution) && claimsStrengthExecutionOrResults(norm)) {
      return;
    }

    if (claimsGeneralizedPermanence(norm)) {
      return;
    }

    if (
      claimsWorkplacePerformance(norm) &&
      !isExplicitlyExecuted &&
      (hasSimulationEvidence || !hasRealExperienceHistory || isConfirmedUnexecuted)
    ) {
      return;
    }

    const matchesActive = matchesAnyActiveSkill(norm, activeSkillMatchers);
    const isMastery = hasMasteryOrConsolidationClaim(norm);
    const isBareTraitAttribution =
      (matchesActive || !hasObservableProcessBehavior(norm)) &&
      hasDirectTraitPraiseWithoutProcess(norm) &&
      !hasObservableProcessBehavior(norm);
    const isPersonalAttributionOrPraise = hasPersonalTraitAttributionOrValuePraise(norm);

    if (!isMastery && !isBareTraitAttribution && !isPersonalAttributionOrPraise) {
      if (isIsolatedAbstractNounStrength(norm)) {
        return;
      }
    }

    let finalCandidate = trimmed;

    if (isMastery || isBareTraitAttribution || isPersonalAttributionOrPraise) {
      const reformulated = extractObservableBehaviorWithoutMastery(trimmed);
      if (!reformulated) {
        return;
      }
      let candidateToCheck = reformulated;
      if (simulationScoped && !isExplicitlyScopedToSimulation(normalizeText(candidateToCheck))) {
        candidateToCheck = `En la simulación, ${candidateToCheck.charAt(0).toLowerCase()}${candidateToCheck.slice(1)}`;
      }
      const normRef = normalizeText(candidateToCheck);
      if (
        normRef.length < 10 ||
        hasMasteryOrConsolidationClaim(normRef) ||
        hasPersonalTraitAttributionOrValuePraise(normRef) ||
        isIsolatedAbstractNounStrength(normRef) ||
        claimsGeneralizedPermanence(normRef) ||
        ((isConfirmedUnexecuted || hasPendingPlanWithoutExecution) &&
          claimsStrengthExecutionOrResults(normRef)) ||
        (claimsWorkplacePerformance(normRef) &&
          !isExplicitlyExecuted &&
          (hasSimulationEvidence || !hasRealExperienceHistory || isConfirmedUnexecuted)) ||
        (hasDirectTraitPraiseWithoutProcess(normRef) &&
          !hasObservableProcessBehavior(normRef))
      ) {
        return;
      }
      finalCandidate = candidateToCheck;
    }

    const dedupKey = normalizeText(finalCandidate);
    if (!dedupKey || seen.has(dedupKey)) return;
    seen.add(dedupKey);
    calibrated.push(finalCandidate);
  };

  for (const item of rawStrengths) {
    if (typeof item !== 'string') continue;
    validateAndPush(item);
    if (calibrated.length >= 4) break;
  }

  return calibrated;
}

/**
 * Candidato de habilidad entrante con soporte para texto y tipo de evidencia observable.
 */
export interface IncomingSkillCandidate {
  skill: string;
  evidenceText?: string;
  sourceType?: EvidenceSourceType;
}

/**
 * Formatea un registro de evidencia individual distinguiendo con precisión metodológica
 * si proviene de la experiencia relatada del líder o de una simulación práctica en Etapa 4.
 */
export function formatEvidenceRecord(record: ObservedEvidenceRecord): string {
  if (!record || !record.evidenceText) return '';
  const cleanText = record.evidenceText.trim();
  if (record.sourceType === 'simulacion_practica') {
    return `Evidencia en simulación (Etapa ${record.stage}): ${cleanText}`;
  }
  return `Evidencia en experiencia laboral (Etapa ${record.stage}): ${cleanText}`;
}

/**
 * Filtra únicamente las entradas de habilidades activas ('vigente' o 'precisada').
 */
export function getActiveSkillEntries(entries: LeadershipSkillEntry[] = []): LeadershipSkillEntry[] {
  if (!Array.isArray(entries)) return [];
  return entries.filter((e) => e && (e.status === 'vigente' || e.status === 'precisada'));
}

/**
 * Obtiene los nombres canónicos de las habilidades activas.
 */
export function getActiveSkillNames(entries: LeadershipSkillEntry[] = []): string[] {
  return getActiveSkillEntries(entries).map((e) => e.skill);
}

/**
 * Convierte un arreglo de nombres de habilidades legadas a entradas estructuradas de habilidades,
 * preservando la retrocompatibilidad con sesiones previas.
 */
export function createSkillEntriesFromLegacy(
  legacySkills: string[] = [],
  stage: 2 | 3 | 4 = 2,
  nowIsoString?: string
): LeadershipSkillEntry[] {
  const normalized = normalizeExistingSessionSkills(legacySkills);
  const now = nowIsoString || new Date().toISOString();
  return normalized.map((skillName) => {
    const mapped = mapToCanonicalSkill(skillName);
    return {
      skill: mapped ? mapped.canonicalName : toTitleCase(skillName),
      cluster: mapped ? mapped.cluster : normalizeText(skillName).slice(0, 15),
      status: 'vigente',
      initialStage: stage,
      evidenceHistory: [],
      reconsiderationHistory: [],
      lastUpdatedStage: stage,
      createdAt: now,
      updatedAt: now,
    };
  });
}

function findExistingSkillEntry(
  entriesByCluster: Map<string, LeadershipSkillEntry>,
  rawSkill: string
): { key: string; entry: LeadershipSkillEntry } | null {
  const mapped = mapToCanonicalSkill(rawSkill);
  const normRaw = normalizeText(rawSkill);
  const normCanonical = mapped ? normalizeText(mapped.canonicalName) : '';

  if (mapped && entriesByCluster.has(mapped.cluster)) {
    const entry = entriesByCluster.get(mapped.cluster)!;
    return { key: mapped.cluster, entry };
  }

  for (const [key, entry] of entriesByCluster.entries()) {
    const normEntrySkill = normalizeText(entry.skill);
    const normEntryCluster = normalizeText(entry.cluster);
    if (
      (normCanonical && normEntrySkill === normCanonical) ||
      (normRaw && normEntrySkill === normRaw) ||
      (mapped && normEntryCluster === normalizeText(mapped.cluster))
    ) {
      return { key, entry };
    }
  }

  return null;
}

function isDistinctNewEvidenceForEntry(
  entry: LeadershipSkillEntry,
  candidateEvidenceText: string
): boolean {
  const normCandidate = normalizeText(candidateEvidenceText);
  if (!normCandidate) return false;

  if (
    Array.isArray(entry.evidenceHistory) &&
    entry.evidenceHistory.some((ev) => normalizeText(ev.evidenceText) === normCandidate)
  ) {
    return false;
  }

  if (
    Array.isArray(entry.reconsiderationHistory) &&
    entry.reconsiderationHistory.some(
      (rec) => normalizeText(rec.reconsiderationReason) === normCandidate
    )
  ) {
    return false;
  }

  return true;
}

/**
 * Motor central de consolidación de entradas de habilidades con evidencia observable e historial continuo.
 *
 * Reglas metodológicas:
 * 1. Únicamente las etapas 2, 3 y 4 aportan evidencia válida para crear, acumular evidencia o reconsiderar habilidades.
 * 2. Las etapas 1, 5, 6 y 7 NO generan, agregan ni modifican habilidades ni su estatus.
 * 3. En Etapas 3 y 4 se pueden aplicar directivas explícitas de descarte, sustitución o reactivación respaldadas por evidencia obligatoria.
 * 4. Las habilidades descartadas o sustituidas conservan su estatus y su razón de reconsideración en el historial,
 *    y tienen BLOQUEADA la reaparición espontánea ante menciones casuales posteriores.
 * 5. La evidencia observable se acumula por habilidad sin límites rígidos artificiales (no hay límite de 3).
 * 6. Se distingue estrictamente entre 'experiencia_relatada' y 'simulacion_practica'.
 *
 * @param existingEntries Entradas de habilidades previas de la sesión
 * @param incomingCandidates Candidatos entrantes (nombres en string u objetos con evidencia)
 * @param currentStage Etapa actual del acompañamiento (2, 3 o 4)
 * @param reconsideration Directivas de descarte, sustitución o reactivación con evidencia (Etapas 3 y 4)
 * @param nowIsoString Fecha ISO opcional para pruebas deterministas
 */
export function consolidateSkillEntries(
  existingEntries: LeadershipSkillEntry[] = [],
  incomingCandidates: (string | IncomingSkillCandidate)[] = [],
  currentStage: number,
  reconsideration?: SkillReconsiderationDirective,
  nowIsoString?: string,
  options?: ConsolidateSkillOptions
): LeadershipSkillEntry[] {
  const now = nowIsoString || new Date().toISOString();
  const requireEvidenceInStage2 = options?.requireEvidenceInStage2 !== false;
  const stage2Context = options?.stage2EvidenceContext;
  const requireEvidenceInStages34 = options?.requireEvidenceInStages34 !== false;
  const stage34Context = options?.stage34EvidenceContext;

  // Clonar entradas existentes para inmutabilidad
  const entriesByCluster = new Map<string, LeadershipSkillEntry>();
  if (Array.isArray(existingEntries)) {
    for (const entry of existingEntries) {
      if (!entry || (!entry.cluster && !entry.skill)) continue;
      const mapKey = entry.cluster || buildCustomClusterKey(normalizeText(entry.skill));
      entriesByCluster.set(mapKey, {
        ...entry,
        cluster: mapKey,
        evidenceHistory: Array.isArray(entry.evidenceHistory) ? [...entry.evidenceHistory] : [],
        reconsiderationHistory: Array.isArray(entry.reconsiderationHistory)
          ? [...entry.reconsiderationHistory]
          : [],
      });
    }
  }

  // REGLA CRÍTICA: Etapas no generativas (1, 5, 6, 7) NO modifican ni agregan habilidades
  if (!SKILL_EVIDENCE_STAGES.has(currentStage)) {
    return Array.from(entriesByCluster.values());
  }

  const validStage = currentStage as 2 | 3 | 4;
  const stageSourceType: EvidenceSourceType =
    validStage === 4 ? 'simulacion_practica' : 'experiencia_relatada';

  // 1. PROCESAR RECONSIDERACIONES (EXCLUSIVAMENTE EN ETAPAS 3 Y 4)
  if ((validStage === 3 || validStage === 4) && reconsideration) {
    const validationContextForReconsideration = requireEvidenceInStages34
      ? stage34Context
      : undefined;

    // 1.1 Descartes con justificación contextual obligatoria (por clúster o nombre normalizado)
    if (Array.isArray(reconsideration.discard)) {
      for (const d of reconsideration.discard) {
        if (
          !d ||
          typeof d.skill !== 'string' ||
          !d.skill.trim() ||
          typeof d.evidence !== 'string' ||
          !isValidReconsiderationJustification(d.evidence, validationContextForReconsideration)
        ) {
          continue; // Rechazar directiva sin justificación válida
        }

        const found = findExistingSkillEntry(entriesByCluster, d.skill);
        const entry = found?.entry;
        if (entry && (entry.status === 'vigente' || entry.status === 'precisada')) {
          entry.status = 'descartada';
          entry.lastUpdatedStage = validStage;
          entry.updatedAt = now;
          if (!entry.reconsiderationHistory) {
            entry.reconsiderationHistory = [];
          }
          entry.reconsiderationHistory.push({
            stage: validStage,
            reconsiderationReason: d.evidence.trim(),
            timestamp: now,
          });
        }
      }
    }

    // 1.2 Sustituciones con evidencia obligatoria y origen activo existente
    if (Array.isArray(reconsideration.replace)) {
      for (const r of reconsideration.replace) {
        if (
          !r ||
          typeof r.from !== 'string' ||
          !r.from.trim() ||
          typeof r.to !== 'string' ||
          !r.to.trim() ||
          typeof r.evidence !== 'string' ||
          !isValidReconsiderationJustification(r.evidence, validationContextForReconsideration)
        ) {
          continue; // Rechazar directiva sin justificación válida
        }

        if (!isPertinentStage2SkillLabel(r.to)) {
          continue;
        }

        const mappedFrom = mapToCanonicalSkill(r.from);
        const mappedTo = mapToCanonicalSkill(r.to);
        if (!mappedFrom || !mappedTo) continue;

        const fromFound = findExistingSkillEntry(entriesByCluster, r.from);
        const fromEntry = fromFound?.entry;
        // La habilidad origen DEBE existir y estar activa ('vigente' o 'precisada'); nunca crear destino si no existe origen
        if (!fromEntry || (fromEntry.status !== 'vigente' && fromEntry.status !== 'precisada')) {
          continue;
        }

        const toFound = findExistingSkillEntry(entriesByCluster, r.to);
        let toEntry = toFound?.entry;

        // Evitar auto-sustitución sobre la misma entrada
        if (toEntry && toEntry === fromEntry) {
          continue;
        }

        const rawOptionalNewEv = (r.newEvidenceText || r.evidenceText || '').trim();
        // Si el destino estaba descartado, no sobrescribir ni reactivar sin nueva evidencia válida
        if (toEntry && toEntry.status === 'descartada') {
          const hasValidNewEvidence =
            Boolean(rawOptionalNewEv) &&
            isValidStage34ContextualEvidence(rawOptionalNewEv, validationContextForReconsideration) &&
            isDistinctNewEvidenceForEntry(toEntry, rawOptionalNewEv);
          if (!hasValidNewEvidence) {
            continue;
          }
        }

        // Desactivar origen conservando intacto su evidenceHistory
        fromEntry.status = 'sustituida';
        fromEntry.lastUpdatedStage = validStage;
        fromEntry.updatedAt = now;
        if (!fromEntry.reconsiderationHistory) {
          fromEntry.reconsiderationHistory = [];
        }
        fromEntry.reconsiderationHistory.push({
          stage: validStage,
          reconsiderationReason: r.evidence.trim(),
          replacedBySkill: toEntry ? toEntry.skill : mappedTo.canonicalName,
          timestamp: now,
        });

        // Crear o actualizar destino precisado
        if (!toEntry) {
          const initialEvidence: ObservedEvidenceRecord[] = [];
          if (
            rawOptionalNewEv &&
            (!requireEvidenceInStages34 ||
              isValidStage34ContextualEvidence(rawOptionalNewEv, validationContextForReconsideration))
          ) {
            initialEvidence.push({
              id: `ev-${validStage}-1-${Math.random().toString(36).substring(2, 7)}`,
              stage: validStage,
              sourceType: stageSourceType,
              evidenceText: rawOptionalNewEv,
              timestamp: now,
            });
          }

          toEntry = {
            skill: mappedTo.canonicalName,
            cluster: mappedTo.cluster,
            status: 'precisada',
            initialStage: validStage,
            evidenceHistory: initialEvidence,
            reconsiderationHistory: [
              {
                stage: validStage,
                reconsiderationReason: r.evidence.trim(),
                replacesSkill: fromEntry.skill,
                timestamp: now,
              },
            ],
            lastUpdatedStage: validStage,
            createdAt: now,
            updatedAt: now,
          };
          entriesByCluster.set(mappedTo.cluster, toEntry);
        } else {
          toEntry.status = 'precisada';
          toEntry.lastUpdatedStage = validStage;
          toEntry.updatedAt = now;
          if (!toEntry.reconsiderationHistory) {
            toEntry.reconsiderationHistory = [];
          }
          toEntry.reconsiderationHistory.push({
            stage: validStage,
            reconsiderationReason: r.evidence.trim(),
            replacesSkill: fromEntry.skill,
            timestamp: now,
          });
          if (
            rawOptionalNewEv &&
            (!requireEvidenceInStages34 ||
              isValidStage34ContextualEvidence(rawOptionalNewEv, validationContextForReconsideration)) &&
            isDistinctNewEvidenceForEntry(toEntry, rawOptionalNewEv)
          ) {
            toEntry.evidenceHistory.push({
              id: `ev-${validStage}-${toEntry.evidenceHistory.length + 1}-${Math.random().toString(36).substring(2, 7)}`,
              stage: validStage,
              sourceType: stageSourceType,
              evidenceText: rawOptionalNewEv,
              timestamp: now,
            });
          }
        }
      }
    }

    // 1.3 Reactivación / recuperación explícita de una habilidad descartada (requiere nueva evidencia + justificación)
    if (Array.isArray(reconsideration.reactivate)) {
      for (const rec of reconsideration.reactivate) {
        if (
          !rec ||
          typeof rec.skill !== 'string' ||
          !rec.skill.trim() ||
          typeof rec.evidence !== 'string' ||
          !isValidReconsiderationJustification(rec.evidence, validationContextForReconsideration)
        ) {
          continue;
        }

        const rawNewEvidence = (rec.newEvidenceText || rec.evidenceText || '').trim();
        if (
          !rawNewEvidence ||
          !isValidStage34ContextualEvidence(rawNewEvidence, validationContextForReconsideration)
        ) {
          continue;
        }

        const found = findExistingSkillEntry(entriesByCluster, rec.skill);
        const entry = found?.entry;
        if (!entry || entry.status !== 'descartada') {
          continue;
        }

        if (!isDistinctNewEvidenceForEntry(entry, rawNewEvidence)) {
          continue;
        }

        entry.status = 'precisada';
        entry.lastUpdatedStage = validStage;
        entry.updatedAt = now;
        entry.evidenceHistory.push({
          id: `ev-${validStage}-${entry.evidenceHistory.length + 1}-${Math.random().toString(36).substring(2, 7)}`,
          stage: validStage,
          sourceType: stageSourceType,
          evidenceText: rawNewEvidence,
          timestamp: now,
        });
        if (!entry.reconsiderationHistory) {
          entry.reconsiderationHistory = [];
        }
        entry.reconsiderationHistory.push({
          stage: validStage,
          reconsiderationReason: rec.evidence.trim(),
          timestamp: now,
        });
      }
    }
  }

  // 2. PROCESAR CANDIDATOS ENTRANTES (Etapas 2, 3 y 4)
  if (Array.isArray(incomingCandidates) && incomingCandidates.length > 0) {
    for (const item of incomingCandidates) {
      let rawSkill = '';
      let evidenceText = '';

      // REGLA METODOLÓGICA ESTRICTA: El origen de la evidencia lo determina exclusivamente la etapa.
      // Etapas 2 y 3: siempre 'experiencia_relatada'.
      // Etapa 4: siempre 'simulacion_practica'.
      // El motor no permite que el modelo ni el payload entrante sobrescriban esta clasificación.
      const sourceType: EvidenceSourceType = stageSourceType;

      if (typeof item === 'string') {
        rawSkill = item;
      } else if (item && typeof item === 'object') {
        rawSkill = item.skill || '';
        evidenceText = (item.evidenceText || '').trim();
      }

      if (!isPertinentStage2SkillLabel(rawSkill)) {
        continue;
      }

      const mapped = mapToCanonicalSkill(rawSkill);
      if (!mapped) continue;

      const foundExisting = findExistingSkillEntry(entriesByCluster, rawSkill);
      const existing = foundExisting?.entry;

      if (existing) {
        // REGLA CRÍTICA DE PREVENCIÓN DE REAPARICIÓN:
        // Una habilidad descartada o sustituida NO puede reaparecer por mención casual ni sobrescritura simple
        if (existing.status === 'descartada' || existing.status === 'sustituida') {
          continue;
        }

        // Si la habilidad está activa ('vigente' o 'precisada'), registrar nueva evidencia si se provee y es válida
        const canAttachEvidence =
          Boolean(evidenceText) &&
          (validStage === 2
            ? !requireEvidenceInStage2 ||
              isValidStage2ObservableEvidence(evidenceText, stage2Context)
            : !requireEvidenceInStages34 ||
              isValidStage34ContextualEvidence(evidenceText, stage34Context));

        if (canAttachEvidence) {
          const isDuplicate = existing.evidenceHistory.some(
            (ev) => normalizeText(ev.evidenceText) === normalizeText(evidenceText)
          );
          if (!isDuplicate) {
            const evId = `ev-${validStage}-${existing.evidenceHistory.length + 1}-${Math.random().toString(36).substring(2, 7)}`;
            existing.evidenceHistory.push({
              id: evId,
              stage: validStage,
              sourceType,
              evidenceText,
              timestamp: now,
            });
            existing.lastUpdatedStage = validStage;
            existing.updatedAt = now;
          }
        }
      } else {
        // En Etapa 2, ninguna habilidad nueva puede registrarse como 'vigente' sin evidencia observable verificable
        if (
          validStage === 2 &&
          requireEvidenceInStage2 &&
          !isValidStage2ObservableEvidence(evidenceText, stage2Context)
        ) {
          continue;
        }

        // En Etapas 3 y 4, ninguna habilidad nueva puede registrarse como 'vigente' sin evidencia contextual válida
        if (
          (validStage === 3 || validStage === 4) &&
          requireEvidenceInStages34 &&
          !isValidStage34ContextualEvidence(evidenceText, stage34Context)
        ) {
          continue;
        }

        // Nueva habilidad activa para la sesión
        const initialEvidence: ObservedEvidenceRecord[] = [];
        if (evidenceText) {
          const evId = `ev-${validStage}-1-${Math.random().toString(36).substring(2, 7)}`;
          initialEvidence.push({
            id: evId,
            stage: validStage,
            sourceType,
            evidenceText,
            timestamp: now,
          });
        }

        const newEntry: LeadershipSkillEntry = {
          skill: mapped.canonicalName,
          cluster: mapped.cluster,
          status: 'vigente',
          initialStage: validStage,
          evidenceHistory: initialEvidence,
          reconsiderationHistory: [],
          lastUpdatedStage: validStage,
          createdAt: now,
          updatedAt: now,
        };
        entriesByCluster.set(mapped.cluster, newEntry);
      }
    }
  }

  return Array.from(entriesByCluster.values());
}

/**
 * Función de consolidación y deduplicación de habilidades de liderazgo para llamadas legadas con strings.
 * Mantiene compatibilidad total con api/mentor/respond.ts y server.ts delegando en el motor central.
 */
export function consolidateSkills(
  existingSkills: string[] = [],
  incomingSkills: string[] = [],
  currentStage: number,
  reconsideration?: SkillReconsiderationDirective
): string[] {
  const existingNormalized = normalizeExistingSessionSkills(existingSkills);

  if (!SKILL_EVIDENCE_STAGES.has(currentStage)) {
    return existingNormalized;
  }

  const existingEntries = createSkillEntriesFromLegacy(
    existingNormalized,
    (currentStage === 3 || currentStage === 4 ? currentStage : 2) as 2 | 3 | 4
  );

  const updatedEntries = consolidateSkillEntries(
    existingEntries,
    incomingSkills,
    currentStage,
    reconsideration,
    undefined,
    { requireEvidenceInStage2: false, requireEvidenceInStages34: false }
  );

  return getActiveSkillNames(updatedEntries);
}

/**
 * Normaliza habilidades de sesiones anteriores (backward compatibility).
 * Elimina duplicados por mayúsculas, acentos o sinónimos sin alterar la historia de la sesión
 * y conservando todas las habilidades legítimas sin recortes rígidos.
 */
export function normalizeExistingSessionSkills(skills: string[] = []): string[] {
  if (!Array.isArray(skills) || skills.length === 0) return [];

  const clusterMap = new Map<string, string>();

  for (const skill of skills) {
    const mapped = mapToCanonicalSkill(skill);
    if (!mapped) continue;
    if (!clusterMap.has(mapped.cluster)) {
      clusterMap.set(mapped.cluster, mapped.canonicalName);
    }
  }

  return Array.from(clusterMap.values());
}

/**
 * Construye los elementos de la sección `stageTwoSkills` del Reporte Final de Etapa 7,
 * diferenciando con total claridad:
 * A) La habilidad de liderazgo que el líder necesita fortalecer (Área de desarrollo).
 * B) La evidencia observable real obtenida en la conversación o en la práctica simulada.
 *
 * Reglas:
 * 1. NUNCA inventa evidencias ni utiliza catálogos prefabricados estáticos.
 * 2. Si no hay habilidades con evidencia en la sesión, devuelve el mensaje obligatorio exacto:
 *    "No se cuenta con evidencia suficiente en este proceso para identificar habilidades específicas por fortalecer."
 * 3. En sesiones legadas (donde solo existían strings sin texto de evidencia), indica:
 *    "${skill} — Habilidad previamente identificada (sin registro de evidencia textual conservado)."
 * 4. Para habilidades con evidencias observables, distingue con claridad:
 *    - 'simulacion_practica': "Evidencia en simulación (Etapa 4): ..."
 *    - 'experiencia_relatada': "Evidencia en experiencia laboral (Etapa X): ..."
 *
 * @param skillsOrEntries Arreglo de entradas estructuradas o strings de habilidades
 * @param evidenceRecords Evidencias textuales complementarias opcionales
 */
export function formatStageTwoSkillsWithEvidence(
  skillsOrEntries: (string | LeadershipSkillEntry)[] = [],
  evidenceRecords?: string[]
): string[] {
  if (!Array.isArray(skillsOrEntries) || skillsOrEntries.length === 0) {
    return [INSUFFICIENT_EVIDENCE_MESSAGE];
  }

  // Detectar si son LeadershipSkillEntry estructuradas
  const isStructuredList = skillsOrEntries.some(
    (item) => item && typeof item === 'object' && 'skill' in item && 'status' in item
  );

  if (isStructuredList) {
    const entries = skillsOrEntries as LeadershipSkillEntry[];
    const activeEntries = getActiveSkillEntries(entries);

    if (activeEntries.length === 0) {
      return [INSUFFICIENT_EVIDENCE_MESSAGE];
    }

    return activeEntries.map((entry) => {
      if (Array.isArray(entry.evidenceHistory) && entry.evidenceHistory.length > 0) {
        const formattedList = entry.evidenceHistory
          .map(formatEvidenceRecord)
          .filter(Boolean);

        if (formattedList.length > 0) {
          return `${entry.skill} — ${formattedList.join(' | ')}`;
        }
      }

      // Entrada sin evidencia textual registrada
      return `${entry.skill} — Habilidad previamente identificada (sin registro de evidencia textual conservado).`;
    });
  }

  // Si son strings (sesiones históricas o llamadas con strings)
  const stringSkills = skillsOrEntries.filter(
    (item): item is string => typeof item === 'string'
  );

  // Proteger explícitamente el mensaje oficial de evidencia insuficiente como mensaje de estado
  const nonStatusStrings = stringSkills.filter(
    (s) => s.trim().length > 0 && !isInsufficientEvidenceMessage(s)
  );

  if (nonStatusStrings.length === 0) {
    return [INSUFFICIENT_EVIDENCE_MESSAGE];
  }

  // Si las cadenas ya vienen con formato de evidencia previo o histórico, conservarlas directamente
  const hasPreformatted = nonStatusStrings.some(
    (s) =>
      s.includes('— Evidencia') ||
      s.includes('— Habilidad previamente identificada') ||
      s.includes('— Habilidad identificada')
  );

  if (hasPreformatted) {
    const cleaned = nonStatusStrings.map((s) => s.trim()).filter(Boolean);
    return cleaned.length > 0 ? cleaned : [INSUFFICIENT_EVIDENCE_MESSAGE];
  }

  const normalized = normalizeExistingSessionSkills(nonStatusStrings);

  if (normalized.length === 0) {
    return [INSUFFICIENT_EVIDENCE_MESSAGE];
  }

  return normalized.map((skill, index) => {
    const customEvidence =
      evidenceRecords && evidenceRecords[index] ? evidenceRecords[index].trim() : null;

    if (customEvidence) {
      return `${skill} — Evidencia observable: ${customEvidence}`;
    }

    // Sesión histórica sin catálogo estático inventado
    return `${skill} — Habilidad previamente identificada (sin registro de evidencia textual conservado).`;
  });
}

/**
 * Resuelve de forma autoritativa las habilidades de Etapa 7 (`stageTwoSkills`)
 * exclusivamente a partir de las entradas consolidadas de Etapas 2–4 o, en sesiones
 * legadas sin `skillEntries`, de `identifiedSkills` previas. Nunca incorpora habilidades
 * generadas en Etapa 7 ni transforma `INSUFFICIENT_EVIDENCE_MESSAGE` en habilidad.
 */
export function resolveConsolidatedStageTwoSkills(
  skillEntries?: LeadershipSkillEntry[] | null,
  legacyIdentifiedSkills?: string[] | null
): string[] {
  if (Array.isArray(skillEntries) && skillEntries.length > 0) {
    return formatStageTwoSkillsWithEvidence(skillEntries);
  }
  if (Array.isArray(legacyIdentifiedSkills) && legacyIdentifiedSkills.length > 0) {
    return formatStageTwoSkillsWithEvidence(legacyIdentifiedSkills);
  }
  return [INSUFFICIENT_EVIDENCE_MESSAGE];
}
