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

export interface ConsolidateSkillOptions {
  requireEvidenceInStage2?: boolean;
  stage2EvidenceContext?: Stage2EvidenceContext;
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

/**
 * Motor central de consolidación de entradas de habilidades con evidencia observable e historial continuo.
 *
 * Reglas metodológicas:
 * 1. Únicamente las etapas 2, 3 y 4 aportan evidencia válida para crear, acumular evidencia o reconsiderar habilidades.
 * 2. Las etapas 1, 5, 6 y 7 NO generan, agregan ni modifican habilidades ni su estatus.
 * 3. En Etapas 3 y 4 se pueden aplicar directivas explícitas de descarte o sustitución respaldadas por evidencia obligatoria.
 * 4. Las habilidades descartadas o sustituidas conservan su estatus y su razón de reconsideración en el historial,
 *    y tienen BLOQUEADA la reaparición espontánea ante menciones casuales posteriores.
 * 5. La evidencia observable se acumula por habilidad sin límites rígidos artificiales (no hay límite de 3).
 * 6. Se distingue estrictamente entre 'experiencia_relatada' y 'simulacion_practica'.
 *
 * @param existingEntries Entradas de habilidades previas de la sesión
 * @param incomingCandidates Candidatos entrantes (nombres en string u objetos con evidencia)
 * @param currentStage Etapa actual del acompañamiento (2, 3 o 4)
 * @param reconsideration Directivas de descarte o sustitución con evidencia (Etapas 3 y 4)
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

  // Clonar entradas existentes para inmutabilidad
  const entriesByCluster = new Map<string, LeadershipSkillEntry>();
  if (Array.isArray(existingEntries)) {
    for (const entry of existingEntries) {
      if (!entry || !entry.cluster) continue;
      entriesByCluster.set(entry.cluster, {
        ...entry,
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

  // 1. PROCESAR RECONSIDERACIONES (EXCLUSIVAMENTE EN ETAPAS 3 Y 4)
  if ((validStage === 3 || validStage === 4) && reconsideration) {
    // 1.1 Descartes con evidencia obligatoria
    if (Array.isArray(reconsideration.discard)) {
      for (const d of reconsideration.discard) {
        if (
          !d ||
          typeof d.skill !== 'string' ||
          !d.skill.trim() ||
          typeof d.evidence !== 'string' ||
          !d.evidence.trim()
        ) {
          continue; // Rechazar directiva sin evidencia válida
        }

        const mapped = mapToCanonicalSkill(d.skill);
        if (!mapped) continue;

        const entry = entriesByCluster.get(mapped.cluster);
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

    // 1.2 Sustituciones con evidencia obligatoria
    if (Array.isArray(reconsideration.replace)) {
      for (const r of reconsideration.replace) {
        if (
          !r ||
          typeof r.from !== 'string' ||
          !r.from.trim() ||
          typeof r.to !== 'string' ||
          !r.to.trim() ||
          typeof r.evidence !== 'string' ||
          !r.evidence.trim()
        ) {
          continue; // Rechazar directiva sin evidencia válida
        }

        const mappedFrom = mapToCanonicalSkill(r.from);
        const mappedTo = mapToCanonicalSkill(r.to);
        if (!mappedFrom || !mappedTo) continue;

        // Desactivar origen
        const fromEntry = entriesByCluster.get(mappedFrom.cluster);
        if (fromEntry && (fromEntry.status === 'vigente' || fromEntry.status === 'precisada')) {
          fromEntry.status = 'sustituida';
          fromEntry.lastUpdatedStage = validStage;
          fromEntry.updatedAt = now;
          if (!fromEntry.reconsiderationHistory) {
            fromEntry.reconsiderationHistory = [];
          }
          fromEntry.reconsiderationHistory.push({
            stage: validStage,
            reconsiderationReason: r.evidence.trim(),
            replacedBySkill: mappedTo.canonicalName,
            timestamp: now,
          });
        }

        // Crear o activar destino precisado
        let toEntry = entriesByCluster.get(mappedTo.cluster);
        if (!toEntry) {
          toEntry = {
            skill: mappedTo.canonicalName,
            cluster: mappedTo.cluster,
            status: 'precisada',
            initialStage: validStage,
            evidenceHistory: [],
            reconsiderationHistory: [
              {
                stage: validStage,
                reconsiderationReason: r.evidence.trim(),
                replacesSkill: mappedFrom.canonicalName,
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
            replacesSkill: mappedFrom.canonicalName,
            timestamp: now,
          });
        }
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
      const sourceType: EvidenceSourceType =
        validStage === 4 ? 'simulacion_practica' : 'experiencia_relatada';

      if (typeof item === 'string') {
        rawSkill = item;
      } else if (item && typeof item === 'object') {
        rawSkill = item.skill || '';
        evidenceText = (item.evidenceText || '').trim();
      }

      if (validStage === 2 && !isPertinentStage2SkillLabel(rawSkill)) {
        continue;
      }

      const mapped = mapToCanonicalSkill(rawSkill);
      if (!mapped) continue;

      const existing =
        entriesByCluster.get(mapped.cluster) ||
        Array.from(entriesByCluster.values()).find(
          (entry) => normalizeText(entry.skill) === normalizeText(mapped.canonicalName)
        );

      if (existing) {
        // REGLA CRÍTICA DE PREVENCIÓN DE REAPARICIÓN:
        // Una habilidad descartada o sustituida NO puede reaparecer por mención casual
        if (existing.status === 'descartada' || existing.status === 'sustituida') {
          continue;
        }

        // Si la habilidad está activa ('vigente' o 'precisada'), registrar nueva evidencia si se provee y es válida
        const canAttachEvidence =
          Boolean(evidenceText) &&
          (validStage !== 2 ||
            !requireEvidenceInStage2 ||
            isValidStage2ObservableEvidence(evidenceText, stage2Context));

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
    { requireEvidenceInStage2: false }
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
