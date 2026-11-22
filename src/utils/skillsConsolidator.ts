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

/**
 * Mapea una habilidad candidata al catálogo canónico de Lidacta si existe equivalencia semántica.
 * Si no coincide con ninguna categoría canónica predeterminada pero es un término válido y profesional,
 * la normaliza en formato TitleCase para conservarla sin inventar ni distorsionar.
 */
export function mapToCanonicalSkill(rawSkill: string): { canonicalName: string; cluster: string } | null {
  const rawClean = (rawSkill || '').trim();
  if (!rawClean) return null;

  // Filtrar textos genéricos o vacíos
  const normalized = normalizeText(rawClean);
  if (
    normalized.length < 3 ||
    normalized === 'ninguna' ||
    normalized === 'n a' ||
    normalized === 'habilidad 1' ||
    normalized === 'habilidad 2' ||
    normalized === 'habilidad' ||
    normalized === 'habilidades'
  ) {
    return null;
  }

  // Búsqueda por keywords y clusters
  for (const def of CANONICAL_LEADERSHIP_SKILLS) {
    const canonicalNorm = normalizeText(def.canonicalName);
    if (normalized === canonicalNorm || normalized.includes(canonicalNorm) || canonicalNorm.includes(normalized)) {
      return { canonicalName: def.canonicalName, cluster: def.cluster };
    }
    for (const kw of def.keywords) {
      const kwNorm = normalizeText(kw);
      if (normalized === kwNorm || normalized.includes(kwNorm) || kwNorm.includes(normalized)) {
        return { canonicalName: def.canonicalName, cluster: def.cluster };
      }
    }
  }

  // Si no está en el catálogo exacto pero es una habilidad válida, formatear limpiamente
  return {
    canonicalName: toTitleCase(rawClean),
    cluster: normalized.slice(0, 15),
  };
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
  nowIsoString?: string
): LeadershipSkillEntry[] {
  const now = nowIsoString || new Date().toISOString();

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

      const mapped = mapToCanonicalSkill(rawSkill);
      if (!mapped) continue;

      const existing = entriesByCluster.get(mapped.cluster);

      if (existing) {
        // REGLA CRÍTICA DE PREVENCIÓN DE REAPARICIÓN:
        // Una habilidad descartada o sustituida NO puede reaparecer por mención casual
        if (existing.status === 'descartada' || existing.status === 'sustituida') {
          continue;
        }

        // Si la habilidad está activa ('vigente' o 'precisada'), registrar nueva evidencia si se provee
        if (evidenceText) {
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
    reconsideration
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

  // Si las cadenas ya vienen con formato de evidencia previo o histórico, conservarlas directamente
  const hasPreformatted = stringSkills.some(
    (s) =>
      s.includes('— Evidencia') ||
      s.includes('— Habilidad previamente identificada') ||
      s.includes('— Habilidad identificada')
  );

  if (hasPreformatted) {
    const cleaned = stringSkills.map((s) => s.trim()).filter(Boolean);
    return cleaned.length > 0 ? cleaned : [INSUFFICIENT_EVIDENCE_MESSAGE];
  }

  const normalized = normalizeExistingSessionSkills(stringSkills);

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
