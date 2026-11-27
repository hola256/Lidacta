// Self-contained skillsConsolidator subset to avoid ERR_MODULE_NOT_FOUND in Vercel Node ESM runtime.
// Sincronizado exactamente con src/utils/skillsConsolidator.ts y src/types/lidacta.ts (sin modificarlos).

type SkillStatus = 'vigente' | 'precisada' | 'sustituida' | 'descartada';

type EvidenceSourceType = 'experiencia_relatada' | 'simulacion_practica';

interface ObservedEvidenceRecord {
  id: string;
  stage: 2 | 3 | 4;
  sourceType: EvidenceSourceType;
  evidenceText: string;
  timestamp: string;
}

interface SkillReconsiderationRecord {
  stage: 3 | 4;
  reconsiderationReason: string;
  replacesSkill?: string;
  replacedBySkill?: string;
  timestamp: string;
}

interface LeadershipSkillEntry {
  skill: string;
  cluster: string;
  status: SkillStatus;
  initialStage: 2 | 3 | 4;
  evidenceHistory: ObservedEvidenceRecord[];
  reconsiderationHistory?: SkillReconsiderationRecord[];
  lastUpdatedStage: 2 | 3 | 4;
  createdAt: string;
  updatedAt: string;
}

interface CanonicalSkillDefinition {
  canonicalName: string;
  cluster: string;
  keywords: string[];
}

const CANONICAL_LEADERSHIP_SKILLS: CanonicalSkillDefinition[] = [
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

function normalizeText(text: string): string {
  if (!text) return '';
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function toTitleCase(str: string): string {
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

function mapToCanonicalSkill(rawSkill: string): { canonicalName: string; cluster: string } | null {
  const rawClean = (rawSkill || '').trim();
  if (!rawClean) return null;

  const normalized = normalizeText(rawClean);
  if (
    normalized.length < 3 ||
    normalized === 'ninguna' ||
    normalized === 'n a' ||
    normalized === 'habilidad 1' ||
    normalized === 'habilidad 2' ||
    normalized === 'habilidad' ||
    normalized === 'habilidades' ||
    isInsufficientEvidenceMessage(rawClean)
  ) {
    return null;
  }

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

  return {
    canonicalName: toTitleCase(rawClean),
    cluster: normalized.slice(0, 15),
  };
}

interface SkillReconsiderationDirective {
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

const SKILL_EVIDENCE_STAGES = new Set([2, 3, 4]);

const INSUFFICIENT_EVIDENCE_MESSAGE =
  'No se cuenta con evidencia suficiente en este proceso para identificar habilidades específicas por fortalecer.';

const INSUFFICIENT_STRENGTHS_MESSAGE =
  'No se cuenta con evidencia suficiente en este proceso para identificar fortalezas observables específicas.';

function isInsufficientEvidenceMessage(text: string): boolean {
  if (typeof text !== 'string') return false;
  const trimmed = text.trim();
  if (!trimmed) return false;
  return (
    trimmed === INSUFFICIENT_EVIDENCE_MESSAGE ||
    normalizeText(trimmed) === normalizeText(INSUFFICIENT_EVIDENCE_MESSAGE)
  );
}

function sanitizeDetectedStrengths(rawStrengths: any): string[] {
  if (!Array.isArray(rawStrengths)) return [];
  return rawStrengths
    .filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
    .map((s) => s.trim())
    .filter((s) => s !== INSUFFICIENT_STRENGTHS_MESSAGE)
    .slice(0, 4);
}

interface IncomingSkillCandidate {
  skill: string;
  evidenceText?: string;
  sourceType?: EvidenceSourceType;
}

function formatEvidenceRecord(record: ObservedEvidenceRecord): string {
  if (!record || !record.evidenceText) return '';
  const cleanText = record.evidenceText.trim();
  if (record.sourceType === 'simulacion_practica') {
    return `Evidencia en simulación (Etapa ${record.stage}): ${cleanText}`;
  }
  return `Evidencia en experiencia laboral (Etapa ${record.stage}): ${cleanText}`;
}

function getActiveSkillEntries(entries: LeadershipSkillEntry[] = []): LeadershipSkillEntry[] {
  if (!Array.isArray(entries)) return [];
  return entries.filter((e) => e && (e.status === 'vigente' || e.status === 'precisada'));
}

function getActiveSkillNames(entries: LeadershipSkillEntry[] = []): string[] {
  return getActiveSkillEntries(entries).map((e) => e.skill);
}

function createSkillEntriesFromLegacy(
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

function consolidateSkillEntries(
  existingEntries: LeadershipSkillEntry[] = [],
  incomingCandidates: (string | IncomingSkillCandidate)[] = [],
  currentStage: number,
  reconsideration?: SkillReconsiderationDirective,
  nowIsoString?: string
): LeadershipSkillEntry[] {
  const now = nowIsoString || new Date().toISOString();

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

  if (!SKILL_EVIDENCE_STAGES.has(currentStage)) {
    return Array.from(entriesByCluster.values());
  }

  const validStage = currentStage as 2 | 3 | 4;

  if ((validStage === 3 || validStage === 4) && reconsideration) {
    if (Array.isArray(reconsideration.discard)) {
      for (const d of reconsideration.discard) {
        if (
          !d ||
          typeof d.skill !== 'string' ||
          !d.skill.trim() ||
          typeof d.evidence !== 'string' ||
          !d.evidence.trim()
        ) {
          continue;
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
          continue;
        }

        const mappedFrom = mapToCanonicalSkill(r.from);
        const mappedTo = mapToCanonicalSkill(r.to);
        if (!mappedFrom || !mappedTo) continue;

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

  if (Array.isArray(incomingCandidates) && incomingCandidates.length > 0) {
    for (const item of incomingCandidates) {
      let rawSkill = '';
      let evidenceText = '';

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
        if (existing.status === 'descartada' || existing.status === 'sustituida') {
          continue;
        }

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

function normalizeExistingSessionSkills(skills: string[] = []): string[] {
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

function formatStageTwoSkillsWithEvidence(
  skillsOrEntries: (string | LeadershipSkillEntry)[] = [],
  evidenceRecords?: string[]
): string[] {
  if (!Array.isArray(skillsOrEntries) || skillsOrEntries.length === 0) {
    return [INSUFFICIENT_EVIDENCE_MESSAGE];
  }

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

      return `${entry.skill} — Habilidad previamente identificada (sin registro de evidencia textual conservado).`;
    });
  }

  const stringSkills = skillsOrEntries.filter(
    (item): item is string => typeof item === 'string'
  );

  const nonStatusStrings = stringSkills.filter(
    (s) => s.trim().length > 0 && !isInsufficientEvidenceMessage(s)
  );

  if (nonStatusStrings.length === 0) {
    return [INSUFFICIENT_EVIDENCE_MESSAGE];
  }

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

    return `${skill} — Habilidad previamente identificada (sin registro de evidencia textual conservado).`;
  });
}

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

function cleanConversationalText(raw: string | undefined | null): string {
  if (!raw || typeof raw !== 'string') return '';

  let text = raw.trim();

  // 1. Eliminar etiquetas de pensamiento o introspección interna (<thought>...</thought>, <think>...</think>)
  text = text.replace(/<(?:thought|think)>[\s\S]*?<\/(?:thought|think)>/gi, '').trim();

  // 2. Si el texto completo viene envuelto en bloques de código markdown (```json ... ``` o ``` ... ```)
  const codeBlockMatch = text.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (codeBlockMatch && codeBlockMatch[1]) {
    text = codeBlockMatch[1].trim();
  }

  // 3. Detectar si el texto contiene una estructura de objeto JSON o un volcado crudo
  const hasJsonStructure =
    (text.startsWith('{') && text.endsWith('}')) ||
    text.includes('"replyText"') ||
    text.includes('"reply"') ||
    text.includes('"mensaje"');

  if (hasJsonStructure) {
    try {
      const firstBrace = text.indexOf('{');
      const lastBrace = text.lastIndexOf('}');
      const jsonCandidate =
        firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace
          ? text.substring(firstBrace, lastBrace + 1)
          : text;

      const parsed = JSON.parse(jsonCandidate);
      const extracted =
        parsed.replyText ||
        parsed.reply ||
        parsed.text ||
        parsed.response ||
        parsed.mensaje ||
        parsed.content;

      if (typeof extracted === 'string' && extracted.trim().length > 0) {
        return cleanConversationalText(extracted);
      }
    } catch {
      const fieldMatch =
        text.match(/"replyText"\s*:\s*"((?:[^"\\]|\\.)*)"/) ||
        text.match(/"reply"\s*:\s*"((?:[^"\\]|\\.)*)"/) ||
        text.match(/"text"\s*:\s*"((?:[^"\\]|\\.)*)"/) ||
        text.match(/"mensaje"\s*:\s*"((?:[^"\\]|\\.)*)"/);

      if (fieldMatch && fieldMatch[1]) {
        try {
          const decoded = JSON.parse(`"${fieldMatch[1]}"`);
          if (typeof decoded === 'string' && decoded.trim().length > 0) {
            return cleanConversationalText(decoded);
          }
        } catch {
          const unescaped = fieldMatch[1]
            .replace(/\\"/g, '"')
            .replace(/\\n/g, '\n')
            .replace(/\\r/g, '')
            .replace(/\\t/g, '\t')
            .replace(/\\\\/g, '\\')
            .trim();
          if (unescaped.length > 0) {
            return unescaped;
          }
        }
      }
    }
  }

  // 4. Limpiar cercos de código markdown dispersos (```json o ```) si quedaron en el texto
  if (text.includes('```')) {
    text = text.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim();
  }

  // 5. Eliminar cualquier marcador técnico de depuración que haya podido anteponerse
  text = text.replace(/^\[(?:Pensamiento|Análisis|Analysis|Internal|Prompt|Stage\s*\d+)\]:?\s*/i, '').trim();

  return text;
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

function stripNegatedAndSelfRoleClauses(text: string): string {
  if (!text) return '';
  return text
    .replace(
      /\b(?:yo\s+)?(?:soy|como|siendo|en\s+mi\s+(?:rol|puesto)\s+de|mi\s+puesto\s+es(?:\s+de)?)\s+(?:la\s+|el\s+|un\s+|una\s+)?(?:gerente|gerenta|director|directora|jefe|jefa)\b/gi,
      ' '
    )
    .replace(
      /\bno\s+(?:es|son|se\s+trata\s+de|estoy\s+hablando\s+de|hablo\s+de|me\s+refiero\s+a|tengo|hay|existe)\s+(?:ning[uú]n\s+|un\s+|una\s+)?(?:problema\s+(?:con|de)\s+|tema\s+(?:con|de)\s+)?(?:mi\s+|el\s+|la\s+|tu\s+)?(?:jefe|jefa|jefatura|superior|director|directora|gerente|gerencia|falta\s+de\s+respeto|abuso(?:\s+de\s+autoridad)?|robo|aumento(?:\s+de\s+sueldo)?|vacaciones)\b/gi,
      ' '
    )
    .replace(
      /\bni\s+(?:tampoco\s+)?(?:(?:estoy\s+hablando|hablo|se\s+trata)\s+de\s+|tengo\s+(?:un\s+)?|de\s+)?(?:una?\s+)?(?:falta\s+de\s+respeto|abuso(?:\s+de\s+autoridad)?|problema\s+con\s+(?:mi\s+|el\s+|la\s+)?(?:jefe|jefa|jefatura|superior)|robo)\b/gi,
      ' '
    )
    .replace(/\b(?:no\s+(?:hubo|existe|hay)|sin)\s+(?:faltas?\s+de\s+respeto|maltrato|abuso(?:\s+de\s+autoridad)?)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function detectHierarchyOrBossConflict(text: string): boolean {
  const cleaned = stripNegatedAndSelfRoleClauses(text).toLowerCase();
  if (!cleaned) return false;

  if (/\b(?:abuso\s+de\s+autoridad|liderazgo\s+superior)\b/i.test(cleaned)) {
    return true;
  }

  const hasSuperiorActor =
    /\b(?:mi\s+jefe|mi\s+jefa|mi\s+jefatura|mi\s+superior|mi\s+director|mi\s+directora|mi\s+gerente|el\s+jefe|la\s+jefa|la\s+jefatura|el\s+director|la\s+directora|la\s+direcci[oó]n)\b/i.test(
      cleaned
    );

  const hasDisrespectOrConflictSignal =
    /\b(?:falta\s+de\s+respeto|falt[oó]\s+al\s+respeto|me\s+grit[oó]|grit[oó]|descalific[oó]|humill[oó]|maltrato|trato\s+injusto|trato\s+prepotente|prepotente|problema\s+con|conflicto\s+con|tensi[oó]n\s+con|me\s+exhibi[oó]|me\s+invalida|no\s+me\s+respalda|me\s+presiona|en\s+p[uú]blico|frente\s+a\s+(?:todos|el\s+equipo|otros)|junta)\b/i.test(
      cleaned
    );

  if (hasSuperiorActor && hasDisrespectOrConflictSignal) {
    return true;
  }

  if (
    hasSuperiorActor &&
    /\b(?:respeto|autoritari|injust|tenso|tensa|dignidad|l[ií]mites)\b/i.test(cleaned)
  ) {
    return true;
  }

  return false;
}

function detectDelegationOrAutonomyCase(text: string): boolean {
  const cleaned = stripNegatedAndSelfRoleClauses(text).toLowerCase();
  if (!cleaned) return false;

  const directTerms = [
    'delegar',
    'delegación',
    'delegacion',
    'microgestión',
    'microgestion',
    'micromanagement',
    'centralizo',
    'centralizar',
    'centralización',
    'centralizacion',
    'cuello de botella',
    'soltar el control',
    'miedo a delegar',
    'supervisores novatos',
    'absorber',
    'auditoría',
    'auditoria',
    'iatf',
  ];
  if (directTerms.some((k) => cleaned.includes(k))) {
    return true;
  }

  return /\b(?:dependen\s+(?:demasiado|mucho|totalmente|siempre)?\s*(?:de\s+m[ií]|de\s+su\s+l[ií]der)|me\s+consultan\s+(?:casi\s+|pr[aá]cticamente\s+)?(?:todo|todas|cada)|consultan\s+(?:casi\s+|pr[aá]cticamente\s+)?todas?\s+las?\s+decisiones|no\s+toman\s+decisiones|tom[ea]n?\s+decisiones\s+(?:por\s+s[ií]|sol[oa]s?|propi[oa]s?)|desarrollar\s+autonom[ií]a|mayor\s+autonom[ií]a|autonom[ií]a\s+(?:en|de)\s+(?:mi|el|su)\s+equipo|superviso\s+(?:constantemente|todo|demasiado|de\s+m[aá]s)|supervisi[oó]n\s+constante|intervengo\s+(?:constantemente|siempre|demasiado|y\s+termino)|termino\s+(?:resolviendo|haci[eé]ndolo|haciendo)\s+(?:yo|personalmente|todo)|revisar\s+todo|revisando\s+(?:todo|cada\s+detalle)|cuesta\s+confiar|confiar\s+en\s+(?:la\s+calidad|su\s+trabajo|que\s+lo\s+hagan)|absorber\s+(?:tareas|todo)|hago\s+el\s+trabajo\s+de\s+(?:ellos|mi\s+equipo))\b/i.test(
    cleaned
  );
}

function detectNaturalCorrection(text: string): {
  isCorrection: boolean;
  hasSubstantiveNewContext: boolean;
  substantiveContent: string;
} {
  const clean = (text || '').trim();
  const lower = clean.toLowerCase();
  if (!clean) {
    return { isCorrection: false, hasSubstantiveNewContext: false, substantiveContent: '' };
  }

  const literalCorrections = [
    'te confundiste', 'te confundes', 'eso no es lo que me preocupa', 'no es lo que me preocupa',
    'no me preocupa eso', 'te estás equivocando', 'te estas equivocando', 'te equivocaste',
    'no me entendiste', 'no me has entendido', 'no me comprendiste', 'no es por ahí', 'no es por ahi', 'no dije eso',
    'entendiste mal', 'comprendiste mal', 'no es ese el problema', 'no es ese mi problema',
    'te fuiste por otro lado', 'no estás entendiendo', 'no estas entendiendo',
  ];

  const hasLiteralCorrection = literalCorrections.some((t) => lower.includes(t));

  const hasNaturalCorrection =
    /\bno\s+(?:estoy\s+hablando|hablo|se\s+trata|es)\s+(?:de\s+)?(?:un\s+problema\s+con|una\s+falta\s+de\s+respeto|eso|ese\s+tema|mi\s+jefe|mi\s+jefatura|abuso)/i.test(
      lower
    ) ||
    /\bno\s+tengo\s+(?:un\s+|ning[uú]n\s+)?problema\s+con\s+(?:mi\s+)?(?:jefe|jefa|jefatura|superior|director)/i.test(
      lower
    ) ||
    /\b(?:me\s+malinterpretaste|malinterpretaste|interpretaste\s+mal|entendiste\s+al\s+rev[eé]s|no\s+va\s+por\s+ah[ií]|no\s+se\s+trata\s+de\s+eso|no\s+es\s+un\s+tema\s+de\s+(?:mi\s+jefe|abuso|falta\s+de\s+respeto)|te\s+aclaro\s+que\s+no|cambiemos\s+el\s+enfoque)\b/i.test(
      lower
    ) ||
    (/\b(?:yo\s+soy\s+(?:la|el)\s+(?:gerente|gerenta|jefa|jefe|directora?|l[ií]der))\b/i.test(lower) &&
      /\b(?:no\s+(?:estoy|tengo|es)|mi\s+preocupaci[oó]n|lo\s+que\s+(?:realmente\s+)?(?:pasa|me\s+preocupa))\b/i.test(
        lower
      ));

  const isCorrection = hasLiteralCorrection || hasNaturalCorrection;
  if (!isCorrection) {
    return { isCorrection: false, hasSubstantiveNewContext: false, substantiveContent: clean };
  }

  let remaining = stripNegatedAndSelfRoleClauses(clean);
  for (const phrase of literalCorrections) {
    remaining = remaining.replace(new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), ' ');
  }
  remaining = remaining
    .replace(/\b(?:no\s+va\s+por\s+ah[ií]|no\s+se\s+trata\s+de\s+eso|me\s+malinterpretaste|malinterpretaste|interpretaste\s+mal|entendiste\s+al\s+rev[eé]s|te\s+aclaro\s+que\s+no|cambiemos\s+el\s+enfoque)\b/gi, ' ')
    .replace(/\b(?:y\s+mi\s+preocupaci[oó]n\s+es\s+que|lo\s+que\s+(?:realmente\s+)?(?:pasa|me\s+preocupa)\s+es\s+que)\b/gi, ' ')
    .replace(/^[,.\s;:y]+|[,.\s;:]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  const words = remaining.split(/\s+/).filter((w) => w.length >= 2);
  const hasSubstantiveNewContext =
    words.length >= 6 ||
    detectDelegationOrAutonomyCase(remaining) ||
    /\b(?:colaborador|colaboradores|equipo|delegar|decisiones|sueldo|salario|vacaciones|ausencia|robo|entregas|retraso|actitud|confiar|intervengo|superviso)\b/i.test(
      remaining
    );

  return {
    isCorrection: true,
    hasSubstantiveNewContext,
    substantiveContent: remaining || clean,
  };
}

function buildEffectiveStage1Context(
  history: any[],
  currentMsg: string,
  sessionContext?: any
) {
  const stage1History = (history || []).filter(
    (m: any) => !m?.stage || Number(m.stage) === 1
  );

  let lastCorrectionIndex = -1;
  for (let i = 0; i < stage1History.length; i++) {
    const m = stage1History[i];
    if (m?.sender === 'leader' || m?.role === 'user') {
      const txt = String(m?.text || m?.content || '').trim();
      if (txt && detectNaturalCorrection(txt).isCorrection) {
        lastCorrectionIndex = i;
      }
    }
  }

  const currentCorrection = detectNaturalCorrection(currentMsg);
  const currentOverridesAnchor =
    currentCorrection.isCorrection && currentCorrection.hasSubstantiveNewContext;

  let effectiveLeaderTexts: string[] = [];
  let effectivePrevLidactaTexts: string[] = [];

  if (currentOverridesAnchor) {
    const strippedCurrent = stripNegatedAndSelfRoleClauses(currentMsg);
    effectiveLeaderTexts = [strippedCurrent || currentMsg].filter(Boolean);
    effectivePrevLidactaTexts = [];
  } else if (lastCorrectionIndex >= 0) {
    const postCorrectionMsgs = stage1History.slice(lastCorrectionIndex);
    effectiveLeaderTexts = postCorrectionMsgs
      .filter((m: any) => m?.sender === 'leader' || m?.role === 'user')
      .map((m: any) => stripNegatedAndSelfRoleClauses(String(m?.text || m?.content || '')))
      .filter((t: string) => Boolean(t) && !isMetaOrOperationalMessage(t));
    if (currentMsg && !isMetaOrOperationalMessage(currentMsg)) {
      effectiveLeaderTexts.push(stripNegatedAndSelfRoleClauses(currentMsg));
    }
    effectivePrevLidactaTexts = stage1History
      .slice(lastCorrectionIndex + 1)
      .filter((m: any) => m?.sender === 'lidacta' || m?.role === 'model')
      .map((m: any) => String(m?.text || m?.content || '').toLowerCase())
      .filter(Boolean);
  } else {
    const historyLeaderTexts = stage1History
      .filter((m: any) => m?.sender === 'leader' || m?.role === 'user')
      .map((m: any) => String(m?.text || m?.content || '').trim())
      .filter((t: string) => Boolean(t) && !isMetaOrOperationalMessage(t));

    if (historyLeaderTexts.length === 0) {
      if (sessionContext?.title && !isMetaOrOperationalMessage(sessionContext.title)) {
        effectiveLeaderTexts.push(stripNegatedAndSelfRoleClauses(sessionContext.title));
      }
      if (
        sessionContext?.initialChallenge &&
        !isMetaOrOperationalMessage(sessionContext.initialChallenge)
      ) {
        effectiveLeaderTexts.push(stripNegatedAndSelfRoleClauses(sessionContext.initialChallenge));
      }
    } else {
      effectiveLeaderTexts.push(...historyLeaderTexts.map(stripNegatedAndSelfRoleClauses));
    }

    if (currentMsg && !isMetaOrOperationalMessage(currentMsg)) {
      effectiveLeaderTexts.push(stripNegatedAndSelfRoleClauses(currentMsg));
    }

    effectivePrevLidactaTexts = stage1History
      .filter((m: any) => m?.sender === 'lidacta' || m?.role === 'model')
      .map((m: any) => String(m?.text || m?.content || '').toLowerCase())
      .filter(Boolean);
  }

  const combinedRawForAnchor = [
    ...(currentOverridesAnchor
      ? [currentMsg]
      : lastCorrectionIndex >= 0
      ? stage1History
          .slice(lastCorrectionIndex)
          .filter((m: any) => m?.sender === 'leader' || m?.role === 'user')
          .map((m: any) => String(m?.text || m?.content || ''))
          .concat(currentMsg ? [currentMsg] : [])
      : [
          ...(stage1History.length === 0
            ? [sessionContext?.initialChallenge || '', sessionContext?.title || '']
            : []),
          ...stage1History
            .filter((m: any) => m?.sender === 'leader' || m?.role === 'user')
            .map((m: any) => String(m?.text || m?.content || '')),
          currentMsg,
        ]),
  ]
    .filter(Boolean)
    .join(' ');

  const effectiveText = effectiveLeaderTexts.filter(Boolean).join(' ').trim();
  const effectiveLower = effectiveText.toLowerCase();

  return {
    effectiveText,
    effectiveLower,
    combinedRawForAnchor,
    effectivePrevLidactaTexts,
    currentCorrection,
    hasPriorCorrection: lastCorrectionIndex >= 0,
    isCleanStage1History:
      currentOverridesAnchor ||
      effectivePrevLidactaTexts.length === 0,
  };
}

function isStage3EntryMarker(text: string): boolean {
  const normalized = (text || '').trim();
  return !normalized || /^\[avanzando a etapa \d+\]$/i.test(normalized);
}

function isPureDoubtOrQuestionClause(clause: string): boolean {
  const lower = clause.trim().toLowerCase();
  if (!lower) return true;
  if (/^[¿?]/.test(lower) || /\?$/.test(lower)) return true;
  return (
    /^(?:pero|aunque|sin embargo|y\s+la\s+verdad|la\s+verdad)\s+(?:tengo dudas?|no\s+s[eé]|me\s+preocupa|tengo\s+miedo|me\s+da\s+temor|no\s+estoy\s+segur)/i.test(
      lower
    ) ||
    /^(?:tengo dudas?|no\s+s[eé]\s+(?:cu[aá]l|c[oó]mo|qu[eé])|me\s+preocupa|qu[eé]\s+(?:me\s+recomiendas|opinas|sugieres|piensas)|cu[aá]l\s+(?:conviene|es\s+mejor|me\s+recomiendas)|c[oó]mo\s+(?:combinar|hacerle|proceder)|ay[uú]dame\s+a)/i.test(
      lower
    )
  );
}

function stripLeadingAlternativeLabel(text: string): string {
  return text
    .replace(/^(?:mis\s+(?:dos|\d+)?\s*(?:alternativas|opciones)\s*(?:son|ser[ií]an)?\s*[:.-]?\s*)/i, '')
    .replace(/^(?:se\s+me\s+ocurren(?:\s+\d+|\s+dos)?\s*(?:alternativas|opciones)?\s*[:.-]?\s*)/i, '')
    .replace(/^(?:(?:opci[oó]n|alternativa)\s*\d+\s*[:.)-]\s*)/i, '')
    .replace(/^(?:\d+[.)]\s*|[-•*]\s+)/, '')
    .replace(/^(?:por\s+un\s+lado|por\s+otro\s+lado|por\s+otra\s+parte|la\s+primera(?:\s+opci[oó]n|\s+alternativa)?(?:\s+es|\s+ser[ií]a)?|la\s+segunda(?:\s+opci[oó]n|\s+alternativa)?(?:\s+es|\s+ser[ií]a)?)\s*[:,]?\s*/i, '')
    .trim();
}

function extractStage3AlternativesFromTexts(texts: string[]): string[] {
  const results: string[] = [];
  const seen = new Set<string>();

  const pushCandidate = (raw: string) => {
    const cleaned = stripLeadingAlternativeLabel(
      raw
        .replace(/\b(?:pero|aunque|sin embargo)\s+(?:tengo dudas?|no\s+s[eé]|me\s+preocupa|tengo\s+miedo|me\s+da\s+temor|no\s+estoy\s+segur).*$/i, '')
        .replace(/¿[^?]*\??/g, '')
        .replace(/[.:\s]+$/g, '')
        .trim()
    );
    if (!cleaned || cleaned.length < 12) return;
    if (isPureDoubtOrQuestionClause(cleaned)) return;
    if (/^(?:me\s+quedo\s+con|elijo|selecciono|vamos\s+con|me\s+decido\s+por|prefiero)\s+(?:la\s+)?(?:primera|segunda|esa|ambas|las\s+dos)(?:\s+opci[oó]n|\s+alternativa)?$/i.test(cleaned)) {
      return;
    }
    const key = cleaned.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      results.push(cleaned.slice(0, 160));
    }
  };

  for (const rawText of texts) {
    const text = cleanConversationalText(rawText || '');
    if (!text || isStage3EntryMarker(text)) continue;

    const strippedQuestions = text.replace(/¿[^?]*\??/g, '').trim();
    const numberedSplit = strippedQuestions
      .split(/(?:^|\n|\s+)(?=(?:\d+[.)]|[-•*]|(?:opci[oó]n|alternativa)\s*\d+\s*[:.)-]?)\s+)/i)
      .map((part) => part.trim())
      .filter(Boolean);

    const hasExplicitMarkers = numberedSplit.some((part) =>
      /^(?:\d+[.)]|[-•*]|(?:opci[oó]n|alternativa)\s*\d+\s*[:.)-]?)\s+/i.test(part)
    );

    if (hasExplicitMarkers) {
      for (const part of numberedSplit) {
        if (/^(?:\d+[.)]|[-•*]|(?:opci[oó]n|alternativa)\s*\d+\s*[:.)-]?)\s+/i.test(part)) {
          pushCandidate(part);
        }
      }
      if (results.length > 0) continue;
    }

    const proseWithoutQuestions = strippedQuestions
      .split(/(?<=[.!])\s+|\n+/)
      .filter((s) => !isPureDoubtOrQuestionClause(s))
      .join(' ');

    const clauses = proseWithoutQuestions
      .split(/(?:,\s*o\s+(?:tambi[eé]n\s+|bien\s+)?|\s+o\s+(?:bien|tambi[eé]n)\s+|\s*;\s*|\bpor\s+otro\s+lado\b|\bpor\s+otra\s+parte\b|\.\s+)/i)
      .map((c) => c.trim())
      .filter(Boolean);

    const actionVerbHint = /\b(podr[ií]a|har[ií]a|ser[ií]a|hablar|conversar|reunir|junta|acuerdo|acordar|delegar|capacitar|revisar|ajustar|establecer|implementar|redistribuir|acompa[nñ]ar|pedir|negociar|definir|monitorear|seguimiento|tablero|sesi[oó]n|reuni[oó]n|retroalimentaci[oó]n|alternativa|opci[oó]n|planteo|propongo|se\s+me\s+ocurre|pienso\s+en)\b/i;

    for (const clause of clauses) {
      if (actionVerbHint.test(clause) || clauses.length >= 2) {
        pushCandidate(clause);
      }
    }
  }

  return results.slice(0, 4);
}

function extractDiagnosticVariables(
  history: any[],
  currentMsg: string,
  leaderName: string,
  sessionContext?: any
) {
  const { effectiveText, effectiveLower, combinedRawForAnchor } = buildEffectiveStage1Context(
    history,
    currentMsg,
    sessionContext
  );

  const lower = effectiveLower;
  const anchorText = stripNegatedAndSelfRoleClauses(combinedRawForAnchor).toLowerCase();

  const raiseNotAnOption = [
    'no es opción', 'no es opcion', 'no podemos', 'no hay presupuesto', 'no es viable',
    'inviable', 'descartado', 'descartada', 'descartar el aumento', 'no aumento',
    'no podemos aumentarle', 'no se puede aumentar', 'no podemos darle', 'no está contemplado',
    'no esta contemplado'
  ].some((k) => lower.includes(k));

  // 1. Casos Éticos / Faltas Graves / Delitos (robo, fuga de información, acoso)
  const isCrimeOrTheft = [
    'robo', 'robando', 'robaron', 'robó', 'robo de material', 'hurto', 'sustracción',
    'sustraccion', 'sustrajo', 'desvío de material', 'delito', 'fraude', 'almacén', 'almacen'
  ].some((k) => anchorText.includes(k) || lower.includes(k));

  // 2. Conflictos / Jerarquía / Abuso de autoridad (validando rol propio y negaciones)
  const isHierarchyOrBossConflict =
    !isCrimeOrTheft && detectHierarchyOrBossConflict(combinedRawForAnchor);

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
  const isDelegationCase =
    !isCrimeOrTheft &&
    !isHierarchyOrBossConflict &&
    detectDelegationOrAutonomyCase(effectiveText || combinedRawForAnchor);

  // 6. Retroalimentación / Desempeño / Entregas
  const isTaskNonComplianceCase =
    !isHierarchyOrBossConflict &&
    !isCrimeOrTheft &&
    !isDelegationCase &&
    [
      'entrega', 'entregable', 'plazo', 'fecha límite', 'fecha limite', 'no cumple', 'incumple',
      'retraso', 'desempeño', 'desempeno', 'resultados', 'metas'
    ].some((k) => lower.includes(k));

  // 7. Motivación / Actitud
  const isAttitudeCase =
    !isHierarchyOrBossConflict &&
    !isCrimeOrTheft &&
    !isDelegationCase &&
    [
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
    factsAndSituation = 'El equipo muestra alta dependencia para tomar decisiones y tú tiendes a supervisar de cerca o absorber revisiones operativas por temor a fallas.';
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
    leaderDilemma = 'Soltar el control operativo y dar espacio de autonomía al equipo frente al temor de que ocurra un error crítico o no alcance tus estándares bajo tu responsabilidad.';
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
    impactAndMainChallenge = 'Desarrollar autonomía real en tu equipo para reducir su dependencia y liberar tu tiempo hacia decisiones estratégicas de liderazgo.';
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

export function generateContextualCoachReply(
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
  skillEntries?: LeadershipSkillEntry[];
  isTherapeuticCase: boolean;
  finalFeedback?: {
    detectedStrengths: string[];
    stageTwoSkills: string[];
    chosenActions: string[];
    stageSixLearnings: string[];
    recommendationsForAutonomy: string[];
  };
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

  const stage1Context = stage === 1 ? buildEffectiveStage1Context(history, cleanMsg, sessionContext) : null;

  // 2. Reacción directa ante correcciones del usuario ("te confundiste", "eso no es lo que me preocupa", o correcciones naturales)
  const isDirectCorrection =
    stage === 1
      ? Boolean(stage1Context?.currentCorrection.isCorrection)
      : [
          'te confundiste', 'te confundes', 'eso no es lo que me preocupa', 'no es lo que me preocupa',
          'no me preocupa eso', 'te estás equivocando', 'te estas equivocando', 'te equivocaste',
          'no me entendiste', 'no me has entendido', 'no me comprendiste', 'no es por ahí', 'no es por ahi', 'no dije eso',
          'entendiste mal', 'comprendiste mal', 'no es ese el problema', 'no es ese mi problema',
          'te fuiste por otro lado', 'no estás entendiendo', 'no estas entendiendo'
        ].some((t) => lowerMsg.includes(t));

  if (isDirectCorrection && stage === 1 && !stage1Context?.currentCorrection.hasSubstantiveNewContext) {
    return {
      replyText: `Una disculpa por la confusión, ${leaderName}; te agradezco la aclaración.\n\nPara enfocar exactamente lo que necesitas: ¿qué es lo que más te preocupa en este momento respecto a esta situación y qué detalles adicionales nos faltan por poner sobre la mesa?`,
      readyToAdvance: false,
      advancePrompt: null,
      detectedTheme: 'Reorientación por Corrección',
      isTherapeuticCase: false,
    };
  }

  // 3. Manejo de meta-conversación, aclaraciones o confusión
  const isConfusion =
    !(stage === 1 && stage1Context?.currentCorrection.hasSubstantiveNewContext) &&
    isMetaOrOperationalMessage(cleanMsg);
  if (isConfusion && stage === 1) {
    const anchorForConfusion = (
      stage1Context?.effectiveLower ||
      stripNegatedAndSelfRoleClauses(cleanMsg).toLowerCase()
    );
    const rawAnchorForBoss = stage1Context?.combinedRawForAnchor || cleanMsg;

    const isCrimeOrTheftConfusion = [
      'robo', 'robando', 'robaron', 'robó', 'robo de material', 'hurto', 'sustracción',
      'sustraccion', 'sustrajo', 'desvío de material', 'delito', 'fraude', 'almacén', 'almacen'
    ].some((k) => anchorForConfusion.includes(k));

    const isBossConfusion = !isCrimeOrTheftConfusion && detectHierarchyOrBossConflict(rawAnchorForBoss);

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

    const isDelegationConfusion =
      !isBossConfusion && !isCrimeOrTheftConfusion && detectDelegationOrAutonomyCase(anchorForConfusion);

    const isDeliveryConfusion = !isBossConfusion && !isCrimeOrTheftConfusion && !isDelegationConfusion && [
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
    } else if (isDelegationConfusion) {
      simplifiedQuestion = `Te lo planteo de forma más directa y concreta, ${leaderName}: sobre esa dependencia de tu equipo al consultarte o cuando terminas interviniendo en su trabajo, ¿en qué tipo de decisiones concretas pasa más seguido y qué te preocupa que suceda si los dejas resolver por su cuenta?`;
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
  ].some((t) => lowerMsg.includes(t)) && !stage1Context?.currentCorrection.hasSubstantiveNewContext;

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

  if (userConfirmsBreakdownOrReady && !isNuanceOrConstraint && !isDirectCorrection && stage === 1) {
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
  if (stage === 1 && stage1Context) {
    const effectiveLower = stage1Context.effectiveLower;
    const rawAnchor = stage1Context.combinedRawForAnchor;
    const justCorrectedWithContext =
      stage1Context.currentCorrection.isCorrection &&
      stage1Context.currentCorrection.hasSubstantiveNewContext;

    const isCrimeOrTheft = [
      'robo', 'robando', 'robaron', 'robó', 'robo de material', 'hurto', 'sustracción',
      'sustraccion', 'sustrajo', 'desvío de material', 'delito', 'fraude'
    ].some((k) => effectiveLower.includes(k));

    const isHierarchyOrBossConflict =
      !isCrimeOrTheft && detectHierarchyOrBossConflict(rawAnchor);

    const isDisciplinaryOrAbsenceCase = !isHierarchyOrBossConflict && !isCrimeOrTheft && [
      'vacacion', 'vacación', 'vacaciones', 'ausencia injustificada', 'ausencias injustificadas',
      'días sin permiso', 'dias sin permiso', 'sin autorizacion', 'sin autorización',
      'aviso por mensaje', 'avisó por mensaje', 'notifico por mensaje', 'notificó por mensaje',
      'no vino a trabajar', 'abandono de trabajo', 'abandono de puesto', 'faltar al trabajo'
    ].some((k) => effectiveLower.includes(k));

    const isSalaryIssue = !isCrimeOrTheft && [
      'sueldo', 'salario', 'aumento', 'aumento salarial', 'dinero', 'remuneracion', 'remuneración',
      'compensacion', 'compensación', 'pagar', 'paga', 'exigiendo sueldo', 'pide aumento'
    ].some((k) => effectiveLower.includes(k));

    const isDelegation =
      !isCrimeOrTheft &&
      !isHierarchyOrBossConflict &&
      detectDelegationOrAutonomyCase(effectiveLower);

    const isAttitudeOrDelivery =
      !isHierarchyOrBossConflict &&
      !isCrimeOrTheft &&
      !isDelegation &&
      [
        'entrega', 'entregables', 'plazo', 'fecha limite', 'fecha límite', 'retraso', 'retrasos',
        'no cumple', 'incumple', 'desempeño', 'calidad', 'actitud', 'defensiva', 'desmotivacion',
        'desmotivación', 'resistencia', 'apatia', 'apatía', 'compromiso'
      ].some((k) => effectiveLower.includes(k));

    const prevLidactaTexts = stage1Context.effectivePrevLidactaTexts;
    const isCleanHistory = stage1Context.isCleanStage1History;
    const ackPrefix = justCorrectedWithContext
      ? `Disculpa la confusión anterior, ${leaderName}; gracias por aclararlo. `
      : '';

    if (isCleanHistory) {
      if (isCrimeOrTheft) {
        return {
          replyText: `${ackPrefix}Una situación que involucra robo de material o faltas a la integridad y legalidad en la empresa es un hecho de máxima gravedad que trasciende el manejo habitual de equipo, ${leaderName}.\n\nPara evaluar los hechos con rigor y evitar pasos en falso: ¿cuáles son las evidencias concretas con las que se cuenta hasta ahora, qué protocolos existen en la empresa con Recursos Humanos o Seguridad, y la persona involucrada ya fue confrontada directamente?`,
          readyToAdvance: false,
          advancePrompt: null,
          detectedTheme: 'Falta Grave y Protocolos Internos/Seguridad',
          isTherapeuticCase: false,
        };
      }

      if (isHierarchyOrBossConflict) {
        return {
          replyText: `${ackPrefix}Que ocurra un abuso de autoridad o una falta de respeto de tu jefatura en público frente a otros colaboradores es una situación inaceptable que vulnera tu liderazgo y genera un desgaste severo, ${leaderName}.\n\nPara enfocar la situación con claridad estratégica: ¿cuál era el contexto de la junta o reunión cuando esto ocurrió, hubo alguna reacción de tu parte o del equipo en ese instante, y se trata de un comportamiento repetitivo del jefe o de un hecho aislado?`,
          readyToAdvance: false,
          advancePrompt: null,
          detectedTheme: 'Falta de Respeto y Relación con Jefatura',
          isTherapeuticCase: false,
        };
      }

      if (isDisciplinaryOrAbsenceCase) {
        return {
          replyText: `${ackPrefix}Que un colaborador se tome días sin autorización previa y solo lo notifique por mensaje es una falta grave a los acuerdos del equipo y a la disciplina operativa, ${leaderName}.\n\nPara dimensionar la gravedad y actuar con la firmeza debida: ¿qué impacto operativo inmediato está teniendo esto en la continuidad de las tareas del equipo, y existen políticas, precedentes o procesos disciplinarios claros en la empresa para atender un caso así?`,
          readyToAdvance: false,
          advancePrompt: null,
          detectedTheme: 'Falta Disciplinaria y Normativa',
          isTherapeuticCase: false,
        };
      }

      if (isSalaryIssue) {
        return {
          replyText: `${ackPrefix}Que un colaborador condicione su permanencia o actitud exigiendo un incremento de sueldo inmediato genera una presión delicada sobre tu liderazgo y sobre la equidad interna del equipo, ${leaderName}.\n\nPara dimensionar el escenario completo: ¿qué expectativas puntuales ha puesto sobre la mesa, y qué políticas o márgenes de tabulador existen en la empresa para una revisión de este tipo?`,
          readyToAdvance: false,
          advancePrompt: null,
          detectedTheme: 'Exigencia Salarial y Equidad',
          isTherapeuticCase: false,
        };
      }

      if (isDelegation) {
        return {
          replyText: `${ackPrefix}La sobrecarga provocada por absorber tareas o la dificultad para soltar el control desgasta tu energía y limita la autonomía del equipo, ${leaderName}.\n\nPara clarificar el punto de partida: ¿cuáles son las tareas o decisiones específicas que hoy más te cuesta delegar y qué temores o riesgos visualizas si permites que otros las asuman?`,
          readyToAdvance: false,
          advancePrompt: null,
          detectedTheme: 'Delegación y Claridad de Roles',
          isTherapeuticCase: false,
        };
      }

      if (isAttitudeOrDelivery) {
        return {
          replyText: `${ackPrefix}Que existan fallas recurrentes en las entregas y una postura a la defensiva desgasta la dinámica del equipo y compromete los resultados que debes entregar, ${leaderName}.\n\nPara basarnos en hechos concretos y verificables: ¿cuáles fueron los acuerdos y plazos específicos que pactaron para esa tarea, y qué conversación previa directa has tenido con la persona sobre este incumplimiento?`,
          readyToAdvance: false,
          advancePrompt: null,
          detectedTheme: 'Acuerdos de Entrega y Desempeño',
          isTherapeuticCase: false,
        };
      }

      return {
        replyText: `${ackPrefix}Comprendo la complejidad de la situación que estás enfrentando en tu área y el impacto que esto genera en tu liderazgo, ${leaderName}.\n\nPara profundizar en los hechos concretos y evitar suposiciones: ¿cómo se originó esta situación y qué hechos observables han ocurrido recientemente entre las personas involucradas?`,
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
      identifiedSkills: [],
      skillEntries: [],
      isTherapeuticCase: false,
    };
  }

  if (stage === 3) {
    const normalizedUserMsg = cleanConversationalText(userMsg || '');
    const isEntryMarker = isStage3EntryMarker(normalizedUserMsg);

    const historyArray = Array.isArray(history) ? history : [];
    const hasNumericStages = historyArray.some((m: any) => typeof m?.stage === 'number');

    const stage3History = hasNumericStages
      ? historyArray.filter((m: any) => m?.stage === 3)
      : (() => {
          const openingIdx = historyArray.findIndex((m: any) => {
            const isCoach = m?.sender === 'lidacta' || m?.role === 'model';
            const txt = String(m?.text || m?.content || '').toLowerCase();
            return (
              isCoach &&
              (txt.includes('para diseñar las posibles salidas') ||
                txt.includes('alternativas o caminos de solución'))
            );
          });
          return openingIdx >= 0 ? historyArray.slice(openingIdx) : [];
        })();

    const priorStage3LeaderTexts = stage3History
      .filter((m: any) => m?.sender === 'leader' || m?.role === 'user')
      .map((m: any) => cleanConversationalText(String(m?.text || m?.content || '')))
      .filter((t: string) => Boolean(t) && !isStage3EntryMarker(t));

    const savedAlternatives: string[] = Array.isArray(sessionContext?.leaderAlternatives)
      ? sessionContext.leaderAlternatives
          .map((a: any) => cleanConversationalText(String(a || '')))
          .filter(Boolean)
      : [];

    const hasCurrentLeaderReply = !isEntryMarker && normalizedUserMsg.length > 0;
    const isInitial =
      !hasCurrentLeaderReply &&
      priorStage3LeaderTexts.length === 0 &&
      savedAlternatives.length === 0;

    if (isInitial) {
      return {
        replyText: `Para diseñar las posibles salidas, ${leaderName}, quiero escucharte a ti primero:\n\n¿Qué alternativas o caminos de solución visualizas tú para resolver esta problemática? Piensa en al menos 2 opciones (por ejemplo, una conversación directa de alineación, una revisión estructurada de acuerdos o un ajuste en la dinámica de seguimiento). ¿Qué se te ocurre?`,
        readyToAdvance: false,
        advancePrompt: null,
        detectedTheme: 'Diseño de Alternativas',
        isTherapeuticCase: false,
      };
    }

    const currentLower = normalizedUserMsg.toLowerCase();
    const currentAlternatives = hasCurrentLeaderReply
      ? extractStage3AlternativesFromTexts([normalizedUserMsg])
      : [];
    const priorAlternatives = [
      ...savedAlternatives,
      ...extractStage3AlternativesFromTexts(priorStage3LeaderTexts),
    ].filter((alt, idx, arr) => arr.findIndex((x) => x.toLowerCase() === alt.toLowerCase()) === idx);

    const allKnownAlternatives = [...currentAlternatives, ...priorAlternatives]
      .filter((alt, idx, arr) => arr.findIndex((x) => x.toLowerCase() === alt.toLowerCase()) === idx)
      .slice(0, 4);

    const expressesDoubt =
      /(\bduda|\bdudas\b|\bno s[eé]\b|\bno estoy segur|\bme preocupa|\btengo miedo|\btemor|\bincertidumbre|\bme cuesta|\bconfundid|\binsegur|\bdefensiv|\brechazo|\bcomplicad|\bdif[ií]cil decidir|\bno me queda claro|\bindecis)/i.test(
        currentLower
      );

    const requestsGuidance =
      /(\bqu[eé] me recomiendas|\bqu[eé] sugieres|\bqu[eé] opinas|\bqu[eé] ves mejor|\bcu[aá]l conviene|\bcu[aá]l elegir|\bcu[aá]l es mejor|\bay[uú]dame|\borientaci[oó]n|\bgu[ií]a|\bconsejo|\bc[oó]mo combinar|\bcombinarlas|\bmezclarlas|\bintegrarlas|\bqu[eé] camino|\bqu[eé] har[ií]as|\bc[oó]mo ves|\bme orientas|\bqu[eé] me aconsejas)/i.test(
        currentLower
      ) || /\?/.test(normalizedUserMsg);

    const exploresConsequencesOrObstacles =
      /(\bconsecuencia|\bimpacto|\befecto|\bobst[aá]culo|\bbarrera|\bfreno|\bresistencia|\briesgo|\bdesventaja|\bcontra\b|\bsiguiente paso|\bpr[oó]ximo paso|\bc[oó]mo empezar|\bpor d[oó]nde empezar|\breacci[oó]n|\bqu[eé] pasar[ií]a|\bqu[eé] pasa si)/i.test(
        currentLower
      );

    const explicitlySelectsPath =
      !expressesDoubt &&
      !requestsGuidance &&
      !/\?/.test(normalizedUserMsg) &&
      /(\bme quedo con\b|\belijo\b|\bselecciono\b|\bvamos con\b|\bme decido por\b|\bprefiero (?:la|esa|esta|ambas)\b|\bopt[oó] por\b|\btomar[eé] (?:la|esa)\b|\baplicar[eé] (?:la|esa|ambas|las dos)\b|\bhar[eé] (?:la|esa|las dos|ambas)\b|\bvoy a (?:aplicar|implementar|elegir|combinar|hacer)\b|\best[aá] decidido\b|\bya eleg[ií]\b|\bavancemos con esa\b|\bme parece mejor la\b)/i.test(
        currentLower
      );

    const alternativesSummaryBlock =
      allKnownAlternatives.length >= 2
        ? allKnownAlternatives.map((alt, idx) => `${idx + 1}. ${alt}`).join('\n')
        : allKnownAlternatives.length === 1
        ? `• ${allKnownAlternatives[0]}`
        : '';

    // 1. El líder ya eligió explícitamente una alternativa: confirmar elección, detener comparación y habilitar avance
    if (explicitlySelectsPath && (allKnownAlternatives.length > 0 || priorStage3LeaderTexts.length > 0)) {
      const selectedSnippet = normalizedUserMsg.slice(0, 180);
      const matchedChosen =
        allKnownAlternatives.find((alt) => currentLower.includes(alt.toLowerCase().slice(0, 20))) ||
        (/primera|opci[oó]n\s*1|alternativa\s*1/i.test(currentLower) ? allKnownAlternatives[0] : undefined) ||
        (/segunda|opci[oó]n\s*2|alternativa\s*2/i.test(currentLower) ? allKnownAlternatives[1] : undefined) ||
        selectedSnippet;

      return {
        replyText: `Perfecto, ${leaderName}. Confirmo tu decisión elegida: "${matchedChosen}".\n\nRecuerda: **tú eres quien decide y conduce la acción**, y tener definida esta ruta ya te da una base concreta para avanzar.\n\nSi lo deseas, podemos pasar a la **Etapa 4 (simulación opcional)** para ensayar cómo plantearlo antes de llevarlo a la realidad, o avanzar directamente a estructurar tu Plan de Acción en la Etapa 5.`,
        readyToAdvance: true,
        advancePrompt: 'Ir a Etapa 4: Practicar antes de actuar (opcional)',
        detectedTheme: 'Diseño de Alternativas',
        ...(allKnownAlternatives.length > 0 ? { suggestedAlternatives: allKnownAlternatives } : {}),
        isTherapeuticCase: false,
      };
    }

    // 2. El líder propuso alternativas y expresa dudas, pide orientación o explora consecuencias
    if (
      allKnownAlternatives.length > 0 &&
      (expressesDoubt || requestsGuidance || exploresConsequencesOrObstacles)
    ) {
      const intro =
        currentAlternatives.length > 0
          ? `Gracias por compartir tus opciones, ${leaderName}. Veo claramente lo que estás poniendo sobre la mesa:`
          : `Retomo las alternativas que ya planteaste en esta etapa, ${leaderName}:`;

      const doubtOrFocusBlock = expressesDoubt
        ? 'Es completamente válido tener reservas antes de actuar; observar ese riesgo desde ahora te ayuda a cuidar el manejo de la situación.'
        : exploresConsequencesOrObstacles
        ? 'Analizar de frente los posibles obstáculos y consecuencias te da mucha mayor precisión antes de dar el paso.'
        : 'Con gusto te ayudo a contrastar tus opciones para que decidas con mayor claridad.';

      const closingQuestion =
        allKnownAlternatives.length >= 2
          ? 'Con base en estas opciones que tú propusiste, ¿qué consecuencia o reacción te pesa más en cada una, o ves viable iniciar con una y complementarla después con la otra?'
          : 'Pensando en esa alternativa que propusiste, ¿qué obstáculo concreto ves en tu equipo o interlocutor y qué ajuste te ayudaría a sentirte más seguro para dar el primer paso?';

      return {
        replyText: `${intro}\n${alternativesSummaryBlock}\n\n${doubtOrFocusBlock}\n\n${closingQuestion}`,
        readyToAdvance: false,
        advancePrompt: null,
        detectedTheme: 'Diseño de Alternativas',
        ...(allKnownAlternatives.length > 0 ? { suggestedAlternatives: allKnownAlternatives } : {}),
        isTherapeuticCase: false,
      };
    }

    // 3. El líder propuso alternativas sin haber elegido todavía
    if (currentAlternatives.length > 0) {
      if (currentAlternatives.length === 1) {
        return {
          replyText: `Muy bien, ${leaderName}. Ya pusiste una primera alternativa concreta sobre la mesa:\n${alternativesSummaryBlock}\n\n¿Qué posible obstáculo ves en esta opción o qué otra alternativa distinta podrías considerar antes de elegir con cuál quedarte?`,
          readyToAdvance: false,
          advancePrompt: null,
          detectedTheme: 'Diseño de Alternativas',
          ...(allKnownAlternatives.length > 0 ? { suggestedAlternatives: allKnownAlternatives } : {}),
          isTherapeuticCase: false,
        };
      }

      return {
        replyText: `Muy bien planteado, ${leaderName}. Reconozco las alternativas concretas que acabas de proponer:\n${alternativesSummaryBlock}\n\n¿Cuál de estas alternativas te resulta más viable para avanzar, o qué duda te gustaría explorar sobre ellas?`,
        readyToAdvance: false,
        advancePrompt: null,
        detectedTheme: 'Diseño de Alternativas',
        ...(allKnownAlternatives.length > 0 ? { suggestedAlternatives: allKnownAlternatives } : {}),
        isTherapeuticCase: false,
      };
    }

    // 4. El líder responde con dudas sin haber listado alternativas aún
    const snippet = normalizedUserMsg.slice(0, 160);
    return {
      replyText: `Te escucho, ${leaderName}. Tomo en cuenta lo que compartes ("${snippet}").\n\nDe lo que te genera duda en este momento, ¿qué consecuencia es la que más te preocupa o qué primer paso tentativo ves más manejable?`,
      readyToAdvance: false,
      advancePrompt: null,
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
      replyText: `Llegamos a la Etapa 5 para concretar tu plan de acción. Te invito a redactar personalmente tus 5 compromisos en el formulario arriba. Recuerda que la decisión y la redacción son 100% tuyas. Si deseas rebotar alguna idea, puedes consultarme aquí abajo.`,
      readyToAdvance: false,
      advancePrompt: null,
      detectedTheme: 'Plan de Acción',
      isTherapeuticCase: false,
    };
  }

  if (stage === 6) {
    const rawExecutionStatus = sessionContext?.actionPlanExecutionStatus;
    const deterministicCorrection = detectStage6ExecutionCorrection(cleanMsg, rawExecutionStatus);
    const executionStatus = deterministicCorrection || rawExecutionStatus;
    const planWhat = sessionContext?.actionPlan?.what?.trim();
    const mentionsPartial = [
      'parte',
      'parcial',
      'solo alcancé',
      'solo alcance',
      'solo pude',
      'a medias',
      'avancé algo',
      'avance algo',
      'me faltó',
      'me falto',
      'todavía falta',
      'todavia falta',
    ].some((k) => lowerMsg.includes(k));

    if (executionStatus === 'not_executed') {
      const correctionFields =
        deterministicCorrection === 'not_executed'
          ? { correctedExecutionStatus: 'not_executed' as const }
          : {};
      if (mentionsPartial) {
        return {
          replyText: `Gracias por compartirlo con claridad, ${leaderName}. Valoro mucho lo que sí lograste avanzar hasta ahora${
            planWhat ? ` respecto a tu compromiso ("${planWhat}")` : ''
          }. Para acompañarte sin presiones: ¿qué parte concreta ya se llevó a cabo, qué quedó pendiente y qué obstáculo o ajuste necesitas considerar para tu siguiente paso?`,
          readyToAdvance: false,
          advancePrompt: null,
          detectedTheme: 'Acompañamiento sobre Plan Pendiente (Avance Parcial)',
          isTherapeuticCase: false,
          ...correctionFields,
        };
      }

      return {
        replyText: `${
          deterministicCorrection === 'not_executed'
            ? `Gracias por aclararlo con total honestidad, ${leaderName}. Tomo nota de que aún no has ejecutado tu Plan de Acción y actualizo tu seguimiento a plan pendiente.`
            : `Gracias por compartirlo con honestidad, ${leaderName}; este espacio es para acompañarte sin juicios.`
        } Respecto al compromiso que definiste en la Etapa 5${
          planWhat ? ` ("${planWhat}")` : ''
        }, ¿qué obstáculos o circunstancias se presentaron que impidieron llevarlo a cabo, o hubo alguna parte en la que sí lograste avanzar? Conversemos para ver qué ajustar y definir tu siguiente paso.`,
        readyToAdvance: false,
        advancePrompt: null,
        detectedTheme: 'Acompañamiento sobre Plan Pendiente',
        isTherapeuticCase: false,
        ...correctionFields,
      };
    }

    if (executionStatus === 'pending_verification') {
      return {
        replyText: `Antes de entrar a la reflexión de la Etapa 6${
          planWhat ? ` sobre tu compromiso ("${planWhat}")` : ''
        }, quiero confirmar contigo: ¿ya ejecutaste tu Plan de Acción?`,
        readyToAdvance: false,
        advancePrompt: null,
        detectedTheme: 'Verificación de Ejecución del Plan',
        isTherapeuticCase: false,
      };
    }

    if (mentionsPartial) {
      return {
        replyText: `Gracias por precisarlo, ${leaderName}. Es muy valioso distinguir lo que ya ejecutaste${
          planWhat ? ` de tu plan ("${planWhat}")` : ''
        } frente a lo que aún sigue pendiente. Sobre la parte que sí lograste realizar: ¿qué ocurrió concretamente, qué observaste en la otra persona o el equipo, y qué necesitarías para abordar la parte restante?`,
        readyToAdvance: false,
        advancePrompt: null,
        detectedTheme: 'Reflexión sobre Ejecución Parcial',
        isTherapeuticCase: false,
      };
    }

    return {
      replyText: `${
        planWhat
          ? `Tomando en cuenta tu compromiso de la Etapa 5 ("${planWhat}"), reflexionemos sobre tu experiencia real, ${leaderName}:`
          : `Para reflexionar a partir de tu experiencia real, ${leaderName}:`
      } ¿qué ocurrió concretamente al llevarlo a la práctica, qué funcionó bien y qué aprendizaje te llevas sobre tu liderazgo?`,
      readyToAdvance: false,
      advancePrompt: null,
      detectedTheme: 'Aprendizaje y Reflexión',
      isTherapeuticCase: false,
    };
  }

  // Stage 7: Cierre y Reporte de Retroalimentación y Autonomía
  let rawSkillsToReport: any[] = [];
  if (
    sessionContext?.skillEntries &&
    Array.isArray(sessionContext.skillEntries) &&
    sessionContext.skillEntries.length > 0
  ) {
    const activeEntries = getActiveSkillEntries(sessionContext.skillEntries);
    rawSkillsToReport = activeEntries.length > 0 ? activeEntries : [];
  } else if (
    sessionContext?.identifiedSkills &&
    Array.isArray(sessionContext.identifiedSkills) &&
    sessionContext.identifiedSkills.length > 0
  ) {
    rawSkillsToReport = sessionContext.identifiedSkills;
  }
  const skillsDetected = formatStageTwoSkillsWithEvidence(rawSkillsToReport);
  const actionWhat =
    sessionContext?.actionPlan?.what ||
    sessionContext?.chosenAlternative ||
    'Conversación 1 a 1 de alineación operativa';
  const stageSixLearning =
    sessionContext?.learnings?.insights ||
    sessionContext?.learnings?.whatHappened ||
    'La claridad temprana en los acuerdos previene fricciones y fortalece la confianza mutua.';

  return {
    replyText: `Muchas gracias por tu compromiso y apertura en este proceso de mentoría, ${leaderName}. Has demostrado una gran capacidad para pasar de la duda a la acción decidida.\n\nTe recuerdo que **esta conversación ha sido 100% confidencial**. Recursos Humanos únicamente recibe constancia de que has concluido exitosamente tu proceso y los indicadores generales de desarrollo, salvaguardando en todo momento tu privacidad.\n\nHe generado tu **Reporte de Retroalimentación y Autonomía de Liderazgo**, el cual puedes consultar aquí en la aplicación y también te llegará a tu correo electrónico registrado. ¡Sigue utilizando Lidacta ante cada nuevo reto!`,
    readyToAdvance: false,
    advancePrompt: null,
    detectedTheme: 'Cierre y Consolidación',
    isTherapeuticCase: false,
    finalFeedback: {
      detectedStrengths: [],
      stageTwoSkills: skillsDetected,
      chosenActions: [actionWhat],
      stageSixLearnings: [
        stageSixLearning,
        'Escuchar activamente a los involucrados incrementa sustancialmente su nivel de corresponsabilidad',
      ],
      recommendationsForAutonomy: [
        'Practicar la retroalimentación continua en lugar de esperar a revisiones formales',
        'Documentar los acuerdos de forma breve y visible para el equipo',
        'Mantener el hábito de analizar el contexto y las perspectivas antes de reaccionar',
      ],
    },
  };
}

export function extractGeminiCandidateText(data: any): string {
  const parts = data?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts) || parts.length === 0) {
    return '';
  }

  const nonThoughtTexts = parts
    .filter((p: any) => p && !p.thought && typeof p.text === 'string' && p.text.trim().length > 0)
    .map((p: any) => p.text);

  if (nonThoughtTexts.length > 0) {
    return nonThoughtTexts.join('');
  }

  const fallbackFirstPart = parts[0]?.text;
  return typeof fallbackFirstPart === 'string' ? fallbackFirstPart : '';
}

function isCleanStage7String(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  const upper = trimmed.toUpperCase();
  const lower = trimmed.toLowerCase();
  if (
    upper.startsWith('ERROR DE SERVIDOR') ||
    lower.includes('error de servidor') ||
    lower.includes('no pudo responder en este momento') ||
    lower.includes('por favor reintenta')
  ) {
    return false;
  }
  return true;
}

function isStage7InsufficientPlaceholder(value: string): boolean {
  const norm = value.trim().toLowerCase();
  return (
    norm === INSUFFICIENT_EVIDENCE_MESSAGE.toLowerCase() ||
    norm === INSUFFICIENT_STRENGTHS_MESSAGE.toLowerCase() ||
    norm.startsWith('no se cuenta con evidencia suficiente')
  );
}

function normalizeStage6ComparisonText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function detectStage6ExecutionCorrection(
  userMessage: string,
  currentStatus?: string | null
): 'not_executed' | null {
  if (typeof userMessage !== 'string' || !userMessage.trim()) return null;
  if (currentStatus === 'not_executed') return null;

  const norm = normalizeStage6ComparisonText(userMessage);

  const hasButtonErrorSignal =
    /(?:(?:me equivoque|presione|aprete|le di|seleccione|toque|marque|oprimi)\s+(?:el\s+boton|por\s+error|sin\s+querer|accidentalmente|"?si"?\s*(?:por\s+error|sin\s+querer|accidentalmente)?))|(?:por\s+error\s+(?:presione|aprete|seleccione|marque|le\s+di)\s+(?:a\s+)?(?:el\s+boton|"?si"?))|(?:(?:boton|por\s+error|sin\s+querer|accidentalmente).*(?:no\s+(?:he|lo|la)|aun\s+no|todavia\s+no))/.test(
      norm
    );

  const affirmsAlreadyExecuted =
    /\b(?:ya|si)\s+(?:lo\s+|la\s+)?(?:ejecute|realice|hice|lleve\s+a\s+cabo)\b/.test(norm);

  if (affirmsAlreadyExecuted && !hasButtonErrorSignal) {
    return null;
  }

  const hasExplicitNonExecution =
    /(?:^|\b)(?:aun\s+|todavia\s+)?no\s+(?:he\s+|lo\s+|la\s+)?(?:ejecutado|realizado|llevado\s+a\s+cabo|hecho|cumplido|implementado|aplicado|tenido\s+la\s+conversacion)\b/.test(
      norm
    ) ||
    /(?:todavia|aun)\s+no\s+(?:lo\s+|la\s+)?(?:hago|ejecuto|realizo|aplico|cumplo)\b/.test(
      norm
    ) ||
    /\bno\s+pude\s+(?:ejecutar|realizar|llevar\s+a\s+cabo|hacer|tener\s+la\s+conversacion)\b/.test(
      norm
    );

  if (hasButtonErrorSignal || hasExplicitNonExecution) {
    return 'not_executed';
  }

  return null;
}

function isExplicitStage6ExecutionAffirmation(userMessage: string): boolean {
  if (typeof userMessage !== 'string' || !userMessage.trim()) return false;
  if (detectStage6ExecutionCorrection(userMessage, 'executed') === 'not_executed') {
    return false;
  }
  const norm = normalizeStage6ComparisonText(userMessage);
  return (
    /\b(?:ya|si)\s+(?:lo\s+|la\s+)?(?:ejecute|realice|hice|lleve\s+a\s+cabo)\b/.test(norm) ||
    /\bsi\s+ya\s+ejecute\s+mi\s+plan\s+de\s+accion\b/.test(norm)
  );
}

function stripExecutionStatusClarificationClauses(norm: string): string {
  return norm
    .replace(
      /\b(?:la\s+verdad|honestamente|perdon|disculpa|disculpen|solo\s+para\s+aclarar|para\s+aclarar|queria\s+aclarar)\b/g,
      ' '
    )
    .replace(
      /\bme\s+equivoque(?:\s+al\s+(?:presionar|apretar|darle|seleccionar|tocar|marcar|oprimir)(?:\s+(?:a\s+|en\s+)?(?:el\s+boton(?:\s+(?:de\s+)?si)?|"?si"?))?)?\b/g,
      ' '
    )
    .replace(
      /\b(?:presione|aprete|le\s+di|seleccione|toque|marque|oprimi)\s+(?:a\s+|en\s+)?(?:el\s+boton(?:\s+(?:de\s+)?si)?|por\s+error|sin\s+querer|accidentalmente|"?si"?(?:\s*(?:por\s+error|sin\s+querer|accidentalmente))?)\b/g,
      ' '
    )
    .replace(
      /\bpor\s+error\s+(?:presione|aprete|seleccione|marque|le\s+di)(?:\s+(?:a\s+)?(?:el\s+boton|"?si"?))?\b/g,
      ' '
    )
    .replace(/\b(?:por\s+error|sin\s+querer|accidentalmente)\b/g, ' ')
    .replace(
      /\b(?:aun|todavia)\s+no\s+(?:he\s+|lo\s+|la\s+)?(?:ejecutado|realizado|llevado\s+a\s+cabo|hecho|cumplido|implementado|aplicado|tenido\s+la\s+conversacion|hago|ejecuto|realizo|aplico|cumplo)(?:\s+(?:el\s+plan(?:\s+de\s+accion)?|la\s+accion|esto|eso))?(?:\s+(?:aun|todavia))?\b/g,
      ' '
    )
    .replace(
      /\bno\s+(?:he\s+|lo\s+|la\s+)?(?:ejecutado|realizado|llevado\s+a\s+cabo|hecho|cumplido|implementado|aplicado|tenido\s+la\s+conversacion)(?:\s+(?:el\s+plan(?:\s+de\s+accion)?|la\s+accion|esto|eso))?(?:\s+(?:aun|todavia))?\b/g,
      ' '
    )
    .replace(
      /\bno\s+pude\s+(?:ejecutar|realizar|llevar\s+a\s+cabo|hacer|tener\s+la\s+conversacion)(?:lo|la)?(?:\s+(?:el\s+plan(?:\s+de\s+accion)?|la\s+accion|esto|eso))?(?:\s+(?:aun|todavia))?\b/g,
      ' '
    )
    .replace(/\b(?:el\s+plan|la\s+accion)\s+(?:sigue|esta|permanece)\s+pendiente(?:\s+de\s+ejecucion)?\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isNonSubstantiveNonExecutionNote(value: string): boolean {
  const norm = normalizeStage6ComparisonText(value);
  if (!norm) return true;

  const pureUncertaintyOrFiller = [
    'aun no lo se',
    'todavia no lo se',
    'no lo se',
    'no se',
    'aun no',
    'todavia no',
    'pendiente',
    'ninguno',
    'ninguna',
    'nada',
    'n a',
    'na',
    'no aplica',
    'sin ejecucion',
  ];
  if (pureUncertaintyOrFiller.includes(norm)) return true;

  if (detectStage6ExecutionCorrection(value, 'executed') === 'not_executed') {
    const remainder = stripExecutionStatusClarificationClauses(norm);
    if (!remainder) return true;
    const trivialStatusTokens = new Set([
      'y', 'o', 'pero', 'que', 'de', 'el', 'la', 'los', 'las', 'un', 'una', 'a', 'en',
      'con', 'por', 'para', 'mi', 'su', 'lo', 'le', 'se', 'aun', 'todavia', 'ya', 'si', 'no',
      'boton', 'plan', 'accion', 'eso', 'esto',
    ]);
    const meaningfulRemainderWords = remainder
      .split(' ')
      .filter((w) => w.length >= 2 && !trivialStatusTokens.has(w));
    return meaningfulRemainderWords.length < 3;
  }

  return false;
}

const STAGE6_TRIVIAL_FIELD_VALUES = new Set([
  'aun no lo se',
  'todavia no lo se',
  'no lo se',
  'no se',
  'aun no',
  'todavia no',
  'pendiente',
  'ninguno',
  'ninguna',
  'nada',
  'n a',
  'na',
  'no aplica',
  'sin ejecucion',
  'sin comentarios',
  'sin observaciones',
]);

export interface StructuredStage6Learnings {
  executionStatus: string;
  results: string[];
  obstacles: string[];
  insights: string[];
  futureAdjustments: string[];
}

export function extractStructuredStage6Learnings(
  sessionData: any,
  effectiveExecutionStatus?: string | null
): StructuredStage6Learnings {
  const status = effectiveExecutionStatus ?? sessionData?.actionPlanExecutionStatus ?? null;
  const isUnexecuted = status === 'not_executed' || status === 'pending_verification';
  const empty: StructuredStage6Learnings = {
    executionStatus: status || 'unverified',
    results: [],
    obstacles: [],
    insights: [],
    futureAdjustments: [],
  };

  const learnings = sessionData?.learnings;
  if (!learnings || typeof learnings !== 'object') return empty;

  const seen = new Set<string>();
  const cleanField = (raw: unknown): string | null => {
    if (!isCleanStage7String(raw)) return null;
    const trimmed = raw.trim();
    if (isStage7InsufficientPlaceholder(trimmed)) return null;
    const norm = normalizeStage6ComparisonText(trimmed);
    if (!norm || STAGE6_TRIVIAL_FIELD_VALUES.has(norm)) return null;
    if (isUnexecuted && isNonSubstantiveNonExecutionNote(trimmed)) return null;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) return null;
    seen.add(key);
    return trimmed;
  };

  const results = isUnexecuted
    ? []
    : ([cleanField(learnings.whatHappened), cleanField(learnings.whatWorked)].filter(
        Boolean
      ) as string[]);
  const obstacles = [cleanField(learnings.whatDidnt)].filter(Boolean) as string[];
  const insights = [cleanField(learnings.insights)].filter(Boolean) as string[];
  const futureAdjustments = [cleanField(learnings.futureAdjustments)].filter(Boolean) as string[];

  return {
    executionStatus: status || 'unverified',
    results,
    obstacles,
    insights,
    futureAdjustments,
  };
}

export function indicatesPendingOrUnexecutedAction(text: string): boolean {
  const norm = normalizeStage6ComparisonText(text);
  if (!norm) return false;
  return (
    /\b(?:pendient\w*|no\s+(?:se\s+)?(?:ha\s+)?ejecut\w*|no\s+ejecut\w*|por\s+ejecut\w*|reprogram\w*|pospus\w*|pospuest\w*|reagend\w*|diferid\w*|aplazad\w*)\b/.test(
      norm
    ) ||
    /\b(?:sin\s+(?:haberse\s+)?(?:ejecut\w*|realiz\w*|inici\w*|concret\w*|efectu\w*|aplic\w*|llev\w*|cumpl\w*|implement\w*))\b/.test(
      norm
    ) ||
    /\b(?:aun|todavia)\s+(?:no\b|por\s+(?:hac\w*|realiz\w*|ejecut\w*|inici\w*|concret\w*|aplic\w*))\b/.test(
      norm
    ) ||
    /\bno\s+(?:se\s+)?(?:realizo|concreto|efectuo|llevo\s+a\s+cabo|inicio|cumplio|implemento)\b/.test(
      norm
    ) ||
    /\b(?:en\s+(?:espera|pausa)|queda\s+por|falta\s+(?:por|realizar|ejecutar|concretar|sostener|llevar)|resta\s+(?:por|realizar|ejecutar))\b/.test(
      norm
    ) ||
    /\b(?:agendad|programad|previst|planificad|calendarizad)[ao]s?\s+para\b/.test(norm)
  );
}

export function claimsActionAlreadyExecuted(text: string): boolean {
  const norm = normalizeStage6ComparisonText(text);
  if (!norm) return false;
  if (indicatesPendingOrUnexecutedAction(norm)) return false;
  return (
    /\b(?:ya\s+(?:se\s+)?(?:ejecuto|realizo|implemento|cumplio|efectuo|concreto|llevo\s+a\s+cabo)|(?:accion|reunion|plan|conversacion)\s+(?:ya\s+)?(?:ejecutad[ao]|completad[ao]|implementad[ao]|concluid[ao]|realizad[ao]))\b/.test(
      norm
    ) ||
    /\b(?:se\s+(?:ejecuto|realizo|implemento|concreto|llevo\s+a\s+cabo)\s+(?:con\s+exito|exitosamente|el|la|en|durante))\b/.test(
      norm
    )
  );
}

export function resolveStage7ChosenActions(
  cleanChosenActions: string[],
  registeredChosenActions: string[],
  sessionData: any,
  isUnexecutedStage7: boolean
): string[] {
  if (cleanChosenActions.length === 0) return registeredChosenActions;
  if (!isUnexecutedStage7) return cleanChosenActions;

  if (cleanChosenActions.some(claimsActionAlreadyExecuted)) {
    return registeredChosenActions.length > 0 ? registeredChosenActions : [];
  }

  if (cleanChosenActions.some(indicatesPendingOrUnexecutedAction)) {
    return cleanChosenActions;
  }

  const rawWhat = isCleanStage7String(sessionData?.actionPlan?.what)
    ? normalizeStage6ComparisonText(sessionData.actionPlan.what).replace(/[.,;:]+$/g, '')
    : '';
  const onlyEchoedRawPlanWhat =
    Boolean(rawWhat) &&
    cleanChosenActions.length === 1 &&
    normalizeStage6ComparisonText(cleanChosenActions[0]).replace(/[.,;:]+$/g, '') === rawWhat;

  if (onlyEchoedRawPlanWhat && registeredChosenActions.length > 0) {
    return registeredChosenActions;
  }

  const when = isCleanStage7String(sessionData?.actionPlan?.when)
    ? sessionData.actionPlan.when.trim()
    : '';
  const normWhen = when ? normalizeStage6ComparisonText(when) : '';

  return cleanChosenActions.map((item, idx) => {
    if (idx > 0) return item;
    const normItem = normalizeStage6ComparisonText(item);
    const scheduleSuffix =
      when && normWhen && !normItem.includes(normWhen) ? ` (Programada: ${when})` : '';
    return `${item}${scheduleSuffix} — Estado: pendiente de ejecución`;
  });
}

export function extractRegisteredStage5Actions(
  sessionData: any,
  effectiveExecutionStatus?: string | null
): string[] {
  const what = sessionData?.actionPlan?.what;
  const chosenAlt = isCleanStage7String(sessionData?.chosenAlternative)
    ? sessionData.chosenAlternative.trim()
    : '';
  const status = effectiveExecutionStatus ?? sessionData?.actionPlanExecutionStatus;
  const isUnexecuted = status === 'not_executed' || status === 'pending_verification';

  if (!isCleanStage7String(what)) {
    if (chosenAlt && !isStage7InsufficientPlaceholder(chosenAlt)) {
      return [
        isUnexecuted
          ? `Alternativa elegida (Etapa 3): ${chosenAlt} — Pendiente de concretar y ejecutar`
          : `Alternativa elegida (Etapa 3): ${chosenAlt}`,
      ];
    }
    return [];
  }

  const trimmedWhat = what.trim();
  const when = isCleanStage7String(sessionData?.actionPlan?.when)
    ? sessionData.actionPlan.when.trim()
    : '';
  const withWhom = isCleanStage7String(sessionData?.actionPlan?.withWhom)
    ? sessionData.actionPlan.withWhom.trim()
    : '';

  const normWhat = normalizeStage6ComparisonText(trimmedWhat).replace(/[.,;:]+$/g, '');
  const normChosenAlt = chosenAlt
    ? normalizeStage6ComparisonText(chosenAlt).replace(/[.,;:]+$/g, '')
    : '';
  const hasDistinctChosenAlt =
    Boolean(normChosenAlt) &&
    normChosenAlt !== normWhat &&
    !normWhat.includes(normChosenAlt) &&
    !normChosenAlt.includes(normWhat);

  if (isUnexecuted) {
    const primary = `${trimmedWhat}${when ? ` (Programada: ${when})` : ''}${withWhom ? ` — Con: ${withWhom}` : ''} — Estado: pendiente de ejecución`;
    return hasDistinctChosenAlt
      ? [primary, `Alternativa elegida en Etapa 3 (previa al plan): ${chosenAlt}`]
      : [primary];
  }

  if (status === 'executed') {
    const contextParts = [
      when ? `Programada: ${when}` : '',
      withWhom ? `Con: ${withWhom}` : '',
    ].filter(Boolean);
    const primary =
      contextParts.length > 0
        ? `${trimmedWhat} (${contextParts.join(' | ')}) — Estado: ejecutada`
        : trimmedWhat;
    return hasDistinctChosenAlt
      ? [primary, `Alternativa elegida en Etapa 3 (previa al plan): ${chosenAlt}`]
      : [primary];
  }

  return hasDistinctChosenAlt
    ? [trimmedWhat, `Alternativa elegida en Etapa 3 (previa al plan): ${chosenAlt}`]
    : [trimmedWhat];
}

export function extractRegisteredStage6Learnings(
  sessionData: any,
  effectiveExecutionStatus?: string | null,
  options?: { labeled?: boolean }
): string[] {
  const structured = extractStructuredStage6Learnings(sessionData, effectiveExecutionStatus);
  if (options?.labeled) {
    return [
      ...structured.results.map((item) => `Resultado obtenido: ${item}`),
      ...structured.obstacles.map((item) => `Obstáculo / dificultad: ${item}`),
      ...structured.insights.map((item) => `Aprendizaje del líder: ${item}`),
      ...structured.futureAdjustments.map((item) => `Ajuste / pendiente: ${item}`),
    ];
  }
  return [
    ...structured.insights,
    ...structured.results,
    ...structured.obstacles.map((item) => `Obstáculo identificado: ${item}`),
    ...structured.futureAdjustments,
  ];
}

function hasSubstantiveStage7Items(arr: unknown): boolean {
  return (
    Array.isArray(arr) &&
    arr.some((item) => isCleanStage7String(item) && !isStage7InsufficientPlaceholder(item))
  );
}

function isValidStage7FinalFeedbackPayload(
  finalFeedback: any,
  options?: {
    hasSessionSkills?: boolean;
    hasRegisteredActions?: boolean;
    hasRegisteredLearnings?: boolean;
    executionStatus?: string | null;
  }
): { valid: boolean; reason?: string } {
  if (!finalFeedback || typeof finalFeedback !== 'object' || Array.isArray(finalFeedback)) {
    return { valid: false, reason: 'missing_final_feedback' };
  }
  if (
    !Array.isArray(finalFeedback.detectedStrengths) ||
    !finalFeedback.detectedStrengths.every(isCleanStage7String)
  ) {
    return { valid: false, reason: 'invalid_detected_strengths' };
  }
  if (
    finalFeedback.stageTwoSkills !== undefined &&
    (!Array.isArray(finalFeedback.stageTwoSkills) ||
      !finalFeedback.stageTwoSkills.every(isCleanStage7String))
  ) {
    return { valid: false, reason: 'invalid_stage_two_skills' };
  }
  const isCleanStringArray = (arr: unknown) =>
    Array.isArray(arr) && arr.every(isCleanStage7String);
  if (!isCleanStringArray(finalFeedback.chosenActions)) {
    return { valid: false, reason: 'invalid_chosen_actions' };
  }
  if (!isCleanStringArray(finalFeedback.stageSixLearnings)) {
    return { valid: false, reason: 'invalid_stage_six_learnings' };
  }
  if (!isCleanStringArray(finalFeedback.recommendationsForAutonomy)) {
    return { valid: false, reason: 'invalid_recommendations_for_autonomy' };
  }

  const hasAuthoritativeSkills =
    options?.hasSessionSkills !== undefined
      ? Boolean(options.hasSessionSkills)
      : hasSubstantiveStage7Items(finalFeedback.stageTwoSkills);

  const isUnexecuted =
    options?.executionStatus === 'not_executed' ||
    options?.executionStatus === 'pending_verification';

  const hasSubstantiveChosenActions =
    Array.isArray(finalFeedback.chosenActions) &&
    finalFeedback.chosenActions.some(
      (item: unknown) =>
        isCleanStage7String(item) &&
        !isStage7InsufficientPlaceholder(item) &&
        (!isUnexecuted || !claimsActionAlreadyExecuted(item))
    );

  const hasSubstantiveLearnings =
    Array.isArray(finalFeedback.stageSixLearnings) &&
    finalFeedback.stageSixLearnings.some(
      (item: unknown) =>
        isCleanStage7String(item) &&
        !isStage7InsufficientPlaceholder(item) &&
        (!isUnexecuted || !isNonSubstantiveNonExecutionNote(item))
    );

  const hasAnySubstantiveContent =
    hasSubstantiveStage7Items(finalFeedback.detectedStrengths) ||
    hasAuthoritativeSkills ||
    hasSubstantiveChosenActions ||
    Boolean(options?.hasRegisteredActions) ||
    hasSubstantiveLearnings ||
    Boolean(options?.hasRegisteredLearnings) ||
    hasSubstantiveStage7Items(finalFeedback.recommendationsForAutonomy);

  if (!hasAnySubstantiveContent) {
    return { valid: false, reason: 'empty_final_feedback' };
  }

  return { valid: true };
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
  let safeSessionContext: any = null;
  let sessionData: any = null;
  let resolvedUserMessage = '';
  let resolvedHistory: any[] = [];
  const requestStartTime = Date.now();
  const requestTraceId =
    typeof globalThis.crypto?.randomUUID === 'function'
      ? globalThis.crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  let usageRequestStats: {
    stage: number;
    historyTurns: number;
    contentsTurns: number;
    systemPromptChars: number;
    contentsChars: number;
    requestBodyBytes: number | null;
  } = {
    stage: 1,
    historyTurns: 0,
    contentsTurns: 0,
    systemPromptChars: 0,
    contentsChars: 0,
    requestBodyBytes: null,
  };

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
      isPracticeMode,
    } = body || {};

    sessionData = body?.sessionData || null;
    currentStageNum = Number(stage || activeStage || body?.currentStage) || 1;
    leaderFirstName = (leaderProfile?.name || 'Líder').split(' ')[0];
    resolvedUserMessage = (userMessage || currentMessage || message || '').trim();
    const targetCaseId = caseId || mentorshipId || sessionData?.id || '';

    const rawHistory = Array.isArray(conversationHistory)
      ? conversationHistory
      : Array.isArray(history)
      ? history
      : [];

    // STRICT CASE ISOLATION & TECHNICAL ERROR FILTERING:
    // Solo descartar mensajes que pertenezcan explícitamente a otro caso; conservar mensajes válidos sin caseId,
    // y excluir mensajes técnicos de error para no contaminar el contexto enviado al modelo.
    const isolatedHistory = rawHistory.filter((m: any) => {
      if (!m || typeof m !== 'object') return false;
      const mCase = m.caseId || m.mentorshipId;
      if (targetCaseId && mCase && mCase !== targetCaseId) {
        return false;
      }
      const text = (m.text || m.content || '').toLowerCase();
      if (
        (m.id && String(m.id).includes('_err')) ||
        m.isError ||
        text.includes('no pudo responder en este momento') ||
        text.includes('por favor reintenta') ||
        text.includes('error de servidor')
      ) {
        return false;
      }
      return true;
    });
    resolvedHistory = [...isolatedHistory];

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
      for (const m of isolatedHistory || []) {
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
    const rawExistingSkills =
      (sessionData?.identifiedSkills && Array.isArray(sessionData.identifiedSkills) && sessionData.identifiedSkills) ||
      (body?.identifiedSkills && Array.isArray(body.identifiedSkills) && body.identifiedSkills) ||
      [];
    const rawExistingSkillEntries =
      (sessionData?.skillEntries && Array.isArray(sessionData.skillEntries) && sessionData.skillEntries) ||
      (body?.skillEntries && Array.isArray(body.skillEntries) && body.skillEntries) ||
      [];

    // Priorizar el registro estructurado skillEntries cuando exista; si no, crear desde identifiedSkills legadas
    let existingSessionSkillEntries: LeadershipSkillEntry[] = [];
    if (rawExistingSkillEntries.length > 0) {
      existingSessionSkillEntries = rawExistingSkillEntries;
    } else if (rawExistingSkills.length > 0) {
      existingSessionSkillEntries = createSkillEntriesFromLegacy(rawExistingSkills, 2);
    }

    const existingSessionSkills =
      existingSessionSkillEntries.length > 0
        ? getActiveSkillNames(existingSessionSkillEntries)
        : normalizeExistingSessionSkills(rawExistingSkills);

    const existingLeaderAlternatives = Array.isArray(sessionData?.leaderAlternatives)
      ? sessionData.leaderAlternatives
      : Array.isArray(body?.leaderAlternatives)
      ? body.leaderAlternatives
      : [];
    const existingSuggestedAlternatives = Array.isArray(sessionData?.suggestedAlternatives)
      ? sessionData.suggestedAlternatives
      : Array.isArray(body?.suggestedAlternatives)
      ? body.suggestedAlternatives
      : [];
    const existingChosenAlternative =
      typeof sessionData?.chosenAlternative === 'string' && sessionData.chosenAlternative.trim()
        ? sessionData.chosenAlternative.trim()
        : typeof body?.chosenAlternative === 'string' && body.chosenAlternative.trim()
        ? body.chosenAlternative.trim()
        : null;

    const deterministicStage6Correction =
      currentStageNum === 6
        ? detectStage6ExecutionCorrection(
            resolvedUserMessage,
            sessionData?.actionPlanExecutionStatus
          )
        : null;

    const effectiveSessionExecutionStatus: string | null =
      deterministicStage6Correction ||
      sessionData?.actionPlanExecutionStatus ||
      null;

    const effectiveStage7ExecutionStatus: string | null =
      currentStageNum === 7
        ? (() => {
            if (effectiveSessionExecutionStatus === 'not_executed') return 'not_executed';
            const stage6LeaderMsgs = (resolvedHistory || []).filter(
              (m: any) =>
                (m.stage === 6 || m.stage === '6') &&
                (m.sender === 'leader' || m.role === 'user')
            );
            for (let i = stage6LeaderMsgs.length - 1; i >= 0; i--) {
              const msgText = (
                stage6LeaderMsgs[i]?.text ||
                stage6LeaderMsgs[i]?.content ||
                ''
              ).trim();
              if (!msgText) continue;
              if (
                detectStage6ExecutionCorrection(msgText, effectiveSessionExecutionStatus) ===
                'not_executed'
              ) {
                return 'not_executed';
              }
              if (
                effectiveSessionExecutionStatus === 'executed' &&
                isExplicitStage6ExecutionAffirmation(msgText)
              ) {
                return 'executed';
              }
            }
            return effectiveSessionExecutionStatus;
          })()
        : effectiveSessionExecutionStatus;

    const reconciledExecutionStatus: string | null =
      currentStageNum === 7 ? effectiveStage7ExecutionStatus : effectiveSessionExecutionStatus;

    const effectiveSessionActionPlan =
      sessionData?.actionPlan && typeof sessionData.actionPlan === 'object'
        ? reconciledExecutionStatus === 'not_executed'
          ? {
              ...sessionData.actionPlan,
              isCompleted: false,
              completedAt: undefined,
            }
          : sessionData.actionPlan
        : null;

    const structuredStage6Learnings = extractStructuredStage6Learnings(
      sessionData,
      reconciledExecutionStatus
    );

    safeSessionContext = {
      id: targetCaseId,
      title: activeCaseTitle,
      initialChallenge: activeCaseChallenge,
      currentStage: currentStageNum,
      identifiedSkills: existingSessionSkills,
      skillEntries: existingSessionSkillEntries,
      leaderAlternatives: existingLeaderAlternatives,
      ...(existingSuggestedAlternatives.length > 0 ? { suggestedAlternatives: existingSuggestedAlternatives } : {}),
      ...(existingChosenAlternative ? { chosenAlternative: existingChosenAlternative } : {}),
      actionPlan: effectiveSessionActionPlan,
      actionPlanExecutionStatus: reconciledExecutionStatus,
      ...(currentStageNum === 7
        ? {
            learnings: structuredStage6Learnings,
          }
        : {}),
    };

    const apiKey =
      process.env.GEMINI_API_KEY ||
      process.env.API_KEY ||
      process.env.GOOGLE_API_KEY ||
      process.env.VITE_GEMINI_API_KEY ||
      process.env.NEXT_PUBLIC_GEMINI_API_KEY;

    usageRequestStats.stage = currentStageNum;
    usageRequestStats.historyTurns = resolvedHistory.length;

    if (!apiKey) {
      console.error('ERROR: No se detectó ninguna GEMINI_API_KEY en process.env');
      console.warn(
        `[Lidacta Usage] ${JSON.stringify({
          event: 'server_error',
          outcome: 'config_error',
          traceId: requestTraceId,
          attempt: 0,
          attemptTotal: 0,
          attemptRole: 'none',
          usedFallback: false,
          model: null,
          modelVersion: null,
          usageMetadataAvailable: false,
          promptTokenCount: null,
          candidatesTokenCount: null,
          thoughtsTokenCount: null,
          totalTokenCount: null,
          cachedContentTokenCount: null,
          status: 500,
          googleErrorCode: null,
          googleErrorStatus: null,
          errorClassification: 'missing_api_key',
          isTimeout: false,
          headersElapsedMs: null,
          bodyReadElapsedMs: null,
          totalElapsedMs: Date.now() - requestStartTime,
          requestElapsedMs: Date.now() - requestStartTime,
          ...usageRequestStats,
        })}`
      );
      return res.status(500).json({
        success: false,
        responseSource: 'error',
        isFallback: false,
        isGeminiVerified: false,
        error: 'Configuración de servidor incompleta para procesar la solicitud.',
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
- Cuestiona premisas, explora la contribución del líder sin culparlo e identifica con base en la evidencia de sus comportamientos, decisiones y respuestas las habilidades preliminares que necesita fortalecer (no te limites a la etiqueta superficial del problema inicial; el líder NO necesita validar ni seleccionar la habilidad). Incluye en identifiedSkills las habilidades canónicas respaldadas por la evidencia disponible (puedes enviar objetos con { "skill": "Nombre canónico", "evidenceText": "Evidencia observable relatada" } o nombres canónicos). La Etapa 2 únicamente identifica e incorpora habilidades iniciales, NO reconsidera.

ETAPA 3: DISEÑAR ALTERNATIVAS
- Estimula al líder a proponer opciones. Si se bloquea, sugiere hasta 2 opciones basadas en la Biblioteca Interna (SBI, DEEC, Delegate, Semáforo Emocional).
- Profundiza en el análisis: puedes incorporar nuevas habilidades en identifiedSkills con su evidenceText, o reconsiderar habilidades previas si la nueva evidencia demuestra que la causa raíz es diferente o que el asunto era puramente normativo/organizacional fuera del control del líder. Para reconsiderar, emite directivas en "skillsReconsideration" (discard o replace) acompañadas SIEMPRE de su justificación explícita con evidencia.

ETAPA 4: PRACTICAR ANTES DE ACTUAR (OPCIONAL)
- Ofrece simular la conversación o brindar una herramienta si aporta valor al caso. La práctica es opcional: si el líder practica, utiliza su comportamiento en el ejercicio como evidencia de simulación para confirmar, precisar, descartar o sustituir habilidades en "identifiedSkills" (con su evidenceText de la simulación) o "skillsReconsideration"; si la omite, conserva intactas las habilidades previas.

ETAPA 6: APRENDER Y REFLEXIONAR
- Primera interacción: verifica "¿Ya ejecutaste tu Plan de Acción?" (Sí / No).
- Si actionPlanExecutionStatus === "executed" (el líder respondió Sí):
  * Recupera el Plan de Acción real de la Etapa 5 (actionPlan.what, when, withWhom, how, careReminders) para contextualizar la reflexión.
  * Haz preguntas de reflexión sobre resultados reales, qué funcionó y qué aprendió, SIN asumir resultados que el líder no haya compartido.
- Si actionPlanExecutionStatus === "not_executed" (el líder respondió No):
  * Abre una conversación empática, respetuosa y SIN juicios ni reproches para entender qué ocurrió, explorar los obstáculos o circunstancias que impidieron ejecutarlo y ayudar a identificar cómo continuar, qué ajustar y un siguiente paso realista.
  * PROHIBIDO formular preguntas dando por hecho que la acción ya ocurrió (ej. nunca preguntar "¿qué ocurrió después de tu acción?" o "¿cómo reaccionó la persona tras aplicarlo?").
  * PROHIBIDO inventar o registrar aprendizajes, resultados o avances de ejecución que no ocurrieron.
- Ejecución parcial en el diálogo: si el líder explica que solo ejecutó una parte de su Plan de Acción, reconócelo explícitamente y distingue con claridad lo ya ejecutado de lo que queda pendiente.
- La verificación de ejecución NO debe bloquear al líder para continuar su proceso de acompañamiento.

ETAPAS 1, 5 y 6: NO deben generar, agregar, modificar, descartar ni sustituir habilidades. En el JSON identifiedSkills DEBE ser siempre [] y no emitir skillsReconsideration.

ETAPA 7: CIERRE Y RETROALIMENTACIÓN
- Entrega resumen ejecutivo con fortalezas, habilidades trabajadas y compromisos. Recupera exclusivamente las habilidades activas consolidadas existentes trabajadas en el proceso sin inferir ni generar nuevas habilidades. En el JSON identifiedSkills DEBE ser siempre []. Formula stageTwoSkills con la habilidad a fortalecer y su correspondiente evidencia observable registrada. Si no existe evidencia suficiente en el proceso, indica exactamente: 'No se cuenta con evidencia suficiente en este proceso para identificar habilidades específicas por fortalecer.'
- OBLIGATORIO EN ETAPA 7: En el JSON incluye el objeto "finalFeedback" con las 5 secciones:
  * detectedStrengths: Array de 0 a 4 fortalezas basadas EXCLUSIVAMENTE en conductas observables demostradas por el líder durante la mentoría (etapas 1 a 6) (ej. honestidad diagnóstica en el autoanálisis, agudeza para distinguir dinámicas del equipo, precisión operativa en los acuerdos, madurez reflexiva sin buscar culpables). Si no se observaron conductas concretas que destaquen con evidencia, dejar el arreglo vacío []. Queda PROHIBIDO atribuir capacidades permanentes, dominio en piso o cambios no demostrados. REGLA CONCEPTUAL DE EXCLUSIÓN: Queda estrictamente prohibido atribuir como fortaleza el dominio o maestría de una habilidad que el líder necesita desarrollar (habilidades presentes en "Habilidades ya identificadas en la sesión"); sin embargo, sí es válido reconocer conductas del proceso asociadas (por ejemplo: reconocer que se tiene dificultad para regular una reacción demuestra autoconciencia y apertura reflexiva, pero NO autorregulación emocional).
  * stageTwoSkills: Array con las habilidades consolidadas que el líder necesita fortalecer (identificadas en etapas 2, 3 y 4) acompañadas de su evidencia concreta de progreso observada en la conversación o práctica. Si no hay evidencia suficiente, incluir únicamente: 'No se cuenta con evidencia suficiente en este proceso para identificar habilidades específicas por fortalecer.'
  * chosenActions: Array con las acciones concretas comprometidas en Etapa 5. Si no se registró Plan de Acción en Etapa 5 ni hubo compromisos verificables, dejar el arreglo vacío []. PROHIBIDO inventar acciones que el líder no haya registrado.
  * stageSixLearnings: Array con aprendizajes y reflexiones reales consolidados en Etapa 6. Si el plan no se ejecutó (not_executed) o no existen aprendizajes reales registrados en el diálogo o en Etapa 6, dejar el arreglo vacío []. PROHIBIDO inventar aprendizajes o resultados de ejecución que no ocurrieron.
  * recommendationsForAutonomy: Array con recomendaciones concretas para el fortalecimiento de la autonomía basadas exclusivamente en el caso trabajado; si no existe evidencia suficiente en el proceso para emitir recomendaciones específicas, dejar el arreglo vacío [] sin inventar frases genéricas de relleno.

REGLAS OBLIGATORIAS DE HABILIDADES Y RECONSIDERACIÓN:
- La ausencia de mención NUNCA elimina una habilidad previamente identificada.
- Omitir la Etapa 4 NUNCA descarta habilidades previas.
- Toda directiva de descarte o sustitución en "skillsReconsideration" requiere OBLIGATORIAMENTE una justificación explícita y no vacía basada en la evidencia de la conversación.
- No existe límite rígido de 3 habilidades; se conservan todas las habilidades respaldadas por evidencia.

Contexto de la sesión:
- Empresa: ${companyContext?.name || 'Empresa'}
- Líder: ${leaderProfile?.name || 'Líder'} (${leaderProfile?.position || 'Líder'})
- Etapa actual: Etapa ${currentStageNum} - ${STAGE_NAMES[currentStageNum] || ''}
- Caso / Reto actual: ${activeCaseTitle || 'Caso actual'}
- Reto inicial: ${activeCaseChallenge || resolvedUserMessage || ''}
- Habilidades ya identificadas en la sesión: ${existingSessionSkills.join(', ') || 'Ninguna aún'}
- Plan de Acción (Etapa 5): ${effectiveSessionActionPlan?.what ? `${effectiveSessionActionPlan.what}${effectiveSessionActionPlan.when ? ` | Cuándo: ${effectiveSessionActionPlan.when}` : ''}${effectiveSessionActionPlan.withWhom ? ` | Con quién: ${effectiveSessionActionPlan.withWhom}` : ''}` : 'No registrado aún'}
- Estado de ejecución del Plan de Acción (Etapa 6): ${reconciledExecutionStatus || 'Sin verificar'}
- Reflexiones y aprendizajes registrados (Etapa 6): ${extractRegisteredStage6Learnings(sessionData, reconciledExecutionStatus, { labeled: true }).join(' | ') || 'Sin reflexiones registradas aún'}

CRITERIOS ESTRICTOS PARA EL CAMPO "readyToAdvance":
- En Etapa 1: Debe ser true ÚNICAMENTE cuando ya se haya entregado previamente la síntesis con las 3 viñetas (**Hechos y situación**, **Dilema del líder**, **Impacto y reto principal**) Y el mensaje actual del líder confirme o valide dicha síntesis (ej. "de acuerdo", "sí", "si estoy lista", "totalmente", "correcto"). Si el líder corrige, pregunta, duda o aporta nuevos datos, DEBE ser false.
- En Etapa 2: Debe ser true ÚNICAMENTE cuando la habilidad crítica haya sido planteada Y el líder continúe o valide el avance hacia el diseño de alternativas. Si la rebate o duda, DEBE ser false.
- En Etapa 3: Debe ser true ÚNICAMENTE cuando se haya planteado al menos una alternativa viable Y el líder la elija o valide para actuar. Si pide más alternativas o tiene dudas, DEBE ser false.
- En cualquier otro escenario o ante cualquier duda/aclaración: DEBE ser false.

Responde SIEMPRE en JSON estricto con esta estructura:
{
  "replyText": "Tu intervención empática, humana y reflexiva para el líder.",
  "readyToAdvance": false,
  "advancePrompt": null,
  "identifiedSkills": [], // En Etapas 2, 3 o 4: objetos { "skill": "Habilidad", "evidenceText": "Evidencia observable..." } o strings si hay evidencia; dejar [] en etapas 1, 5, 6 y 7.
  "skillsReconsideration": { // Opcional, ÚNICAMENTE en Etapas 3 o 4 cuando exista justificación explícita con evidencia
    "discard": [
      { "skill": "Habilidad a descartar", "evidence": "Justificación explícita de por qué la nueva evidencia demuestra que no corresponde al líder" }
    ],
    "replace": [
      { "from": "Habilidad anterior", "to": "Nueva habilidad canónica", "evidence": "Justificación explícita de por qué la profundización reveló esta causa raíz" }
    ]
  },
  "detectedTheme": "Liderazgo",
  "isTherapeuticCase": false,
  "therapeuticReason": null,
  "finalFeedback": {
    "detectedStrengths": [], // De 0 a 4 fortalezas demostradas en la sesión; dejar [] si no hay evidencia observable suficiente
    "stageTwoSkills": ["Habilidad a fortalecer — Evidencia observable: Observación concreta"],
    "chosenActions": [], // Acción comprometida en etapa 5; dejar [] si no se registró ni hubo compromiso real (no inventar)
    "stageSixLearnings": [], // Aprendizaje real consolidado en etapa 6; dejar [] si no se ejecutó o no hay aprendizajes reales (no inventar)
    "recommendationsForAutonomy": [] // Recomendaciones basadas en el caso; dejar [] si no hay evidencia suficiente (no inventar)
  }
}`;

    // Build Gemini contents array preserving sequence, stage/role labels, explicit session context,
    // and clear delimitation of the latest leader message + local conversational continuity rules
    // (without modifying the global systemPrompt).
    const contents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];

    const pushHistoryTurn = (role: 'user' | 'model', text: string, msgStage?: number | string) => {
      const clean = text.trim();
      if (!clean) return;
      const roleLabel = role === 'user' ? 'LÍDER' : 'LIDACTA';
      const stagePrefix = msgStage ? `[Etapa ${msgStage} | ${roleLabel}] ` : `[${roleLabel}] `;
      const labeledText = `${stagePrefix}${clean}`;

      if (contents.length === 0 && role === 'model') {
        contents.push({ role: 'user', parts: [{ text: 'Hola Lidacta, necesito apoyo con una situación de liderazgo.' }] });
      }
      const last = contents[contents.length - 1];
      if (last && last.role === role) {
        const existingSegments = last.parts[0].text.split('\n\n---\n\n');
        const prevSegment = existingSegments[existingSegments.length - 1] || '';
        if (prevSegment.trim() !== labeledText.trim()) {
          last.parts[0].text = `${last.parts[0].text}\n\n---\n\n${labeledText}`;
        }
      } else {
        contents.push({
          role,
          parts: [{ text: labeledText }],
        });
      }
    };

    for (const msg of resolvedHistory) {
      const msgText = (msg.text || msg.content || '').trim();
      if (!msgText) continue;
      const role: 'user' | 'model' =
        msg.sender === 'leader' || msg.role === 'user' ? 'user' : 'model';
      pushHistoryTurn(role, msgText, msg.stage);
    }

    let trailingUnrepliedUserHistory = '';
    if (contents.length > 0 && contents[contents.length - 1].role === 'user') {
      const popped = contents.pop();
      trailingUnrepliedUserHistory = popped?.parts?.[0]?.text || '';
    }

    const effectiveLatestMessage =
      resolvedUserMessage || `Hola Lidacta, estoy en la Etapa ${currentStageNum}.`;

    const stage3LocalRule =
      currentStageNum === 3
        ? `
REGLA LOCAL DE ETAPA 3 (RECONOCIMIENTO DE DECISIONES):
- Si en el último mensaje el líder elige o confirma explícitamente una alternativa o camino de acción (ej. "me quedo con...", "elijo...", "vamos con...", "prefiero...", "haré esa") sin expresar dudas activas ni pedir comparación:
  * Reconoce y confirma explícitamente la alternativa elegida.
  * Está PROHIBIDO seguir comparando ventajas y desventajas después de una decisión firme.
  * Está PROHIBIDO proponer alternativas adicionales cuando el líder ya eligió.
  * Habilita el avance ("readyToAdvance": true y "advancePrompt" breve invitando a Etapa 4 opcional o Etapa 5).
- Si el líder todavía expresa dudas, solicita orientación o pregunta por consecuencias sin elegir, acompaña su análisis manteniendo "readyToAdvance": false.`
        : '';

    const stage6LocalRule =
      currentStageNum === 6
        ? `
REGLA LOCAL DE ETAPA 6 (RECONOCIMIENTO DEL ESTADO REAL DEL COMPROMISO):
- La aclaración más reciente y explícita del líder SIEMPRE tiene prioridad sobre una selección previa de botón (actionPlanExecutionStatus).
- Si el líder aclara que aún no ha ejecutado su Plan de Acción, que presionó «Sí» por error o que la acción sigue pendiente:
  * Reconoce su aclaración con empatía y sin juicios.
  * Orienta el 100% de tu respuesta al acompañamiento de plan pendiente (explorar obstáculos, circunstancias, ajustes o reprogramación/siguiente paso).
  * PROHIBIDO preguntar por resultados de una ejecución que no ocurrió o pedir aprendizajes como si ya la hubiera realizado.
  * Incluye obligatoriamente en tu JSON el campo "correctedExecutionStatus": "not_executed".
- Si no hay contradicción de estado, omite "correctedExecutionStatus" o envíalo en null.`
        : '';

    const stage7IsUnexecutedPrompt =
      effectiveStage7ExecutionStatus === 'not_executed' ||
      effectiveStage7ExecutionStatus === 'pending_verification';

    const stage7LocalRule =
      currentStageNum === 7
        ? `
ESTADO REAL DEL COMPROMISO PARA EL CIERRE (ETAPA 7):
- Alternativa elegida en Etapa 3: ${existingChosenAlternative || 'No registrada por separado'}
- Acción diseñada (Etapa 5): ${effectiveSessionActionPlan?.what?.trim() || 'No registrada'}
- Programación prevista (Etapa 5): ${effectiveSessionActionPlan?.when?.trim() || 'Sin fecha programada'}${effectiveSessionActionPlan?.withWhom?.trim() ? ` | Con quién: ${effectiveSessionActionPlan.withWhom.trim()}` : ''}
- Cómo y cuidados previstos (Etapa 5): ${[effectiveSessionActionPlan?.how?.trim(), effectiveSessionActionPlan?.careReminders?.trim()].filter(Boolean).join(' | ') || 'No especificados'}
- Estado real de ejecución: ${
            effectiveStage7ExecutionStatus === 'not_executed'
              ? 'PENDIENTE DE EJECUCIÓN (el líder aclaró o registró que aún NO ejecuta la acción)'
              : effectiveStage7ExecutionStatus === 'pending_verification'
              ? 'PENDIENTE DE VERIFICACIÓN'
              : effectiveStage7ExecutionStatus === 'executed'
              ? 'EJECUTADA'
              : 'Sin verificar'
          }
- Resultados reales reportados (Etapa 6): ${
            structuredStage6Learnings.results.join(' | ') ||
            (stage7IsUnexecutedPrompt ? 'Ninguno (la acción aún no se ejecuta)' : 'Sin resultados registrados')
          }
- Obstáculos o qué no funcionó (Etapa 6): ${structuredStage6Learnings.obstacles.join(' | ') || 'Ninguno registrado'}
- Aprendizajes y reflexiones del líder (Etapa 6): ${structuredStage6Learnings.insights.join(' | ') || 'Ninguno registrado'}
- Ajustes futuros / reprogramación / siguientes pasos (Etapa 6): ${structuredStage6Learnings.futureAdjustments.join(' | ') || 'Ninguno registrado'}
- Instrucción obligatoria de síntesis y distinción del proceso:
  * Sintetiza el proceso con lenguaje ejecutivo claro sin copiar literalmente los campos del formulario cuando puedas integrarlos con fidelidad.
  * Distingue con precisión entre lo identificado (habilidades/causas), la alternativa elegida en Etapa 3, la acción diseñada y programada en Etapa 5, lo ejecutado, los resultados obtenidos, los obstáculos, los aprendizajes y lo que permanece pendiente o reprogramado (no confundas la alternativa elegida con el plan final si cambió).
  * ${
    stage7IsUnexecutedPrompt
      ? 'Como la acción NO ha sido ejecutada: en "chosenActions" sintetiza la acción comprometida, su programación o reprogramación y su estado pendiente o aún no concretado; en "stageSixLearnings" PROHIBIDO inventar resultados de ejecución inexistentes o incluir respuestas evasivas ("Aún no lo sé") o disculpas por haber presionado el botón por error, pero SÍ sintetiza obstáculos reales, decisiones o aprendizajes sustantivos (o déjalo en [] si no hay); y en "recommendationsForAutonomy" incluye el siguiente paso o reprogramación concreta.'
      : 'Como la acción SÍ fue ejecutada: en "chosenActions" distingue la acción ejecutada respecto de la alternativa previa si evolucionó; en "stageSixLearnings" sintetiza los resultados que efectivamente reportó el líder, los obstáculos enfrentados (si existen) y los aprendizajes/ajustes sin inventar datos.'
  }`
        : '';

    const finalTurnPrompt = `${
      trailingUnrepliedUserHistory
        ? `Mensajes previos del líder en el historial (anteriores al mensaje actual):\n${trailingUnrepliedUserHistory}\n\n========================================\n`
        : ''
    }${isPracticeMode ? '[El líder está en modo práctica / roleplay de la Etapa 4]\n' : ''}Datos previos guardados de la sesión (respeta skillEntries, sus estados/evidencias y leaderAlternatives):
${JSON.stringify(safeSessionContext || {})}

=== ÚLTIMO MENSAJE DEL LÍDER (PRIORITARIO) ===
"${effectiveLatestMessage}"

INSTRUCCIONES LOCALES DE CONTINUIDAD Y CALIDAD CONVERSACIONAL:
- Prioriza estrictamente el ÚLTIMO MENSAJE DEL LÍDER sobre hilos o supuestos anteriores.
- Si el líder aclara, corrige o precisa qué le preocupa realmente, actualiza de inmediato tu comprensión y reorienta el 100% de la conversación hacia esa preocupación real, sin volver al anclaje anterior ni repetir la plantilla de 3 viñetas tras un matiz puntual.
- Si el líder solicita detenerse, ir más despacio o profundizar ("no quiero avanzar", "espérate", "profundizar"), respeta su ritmo, no empujes el avance de etapa y devuelve "readyToAdvance": false y "advancePrompt": null.
- Está terminantemente PROHIBIDO repetir preguntas que el líder ya respondió o pedir información ya compartida.
- Está terminantemente PROHIBIDO repetir síntesis, explicaciones previas o coletillas de cierre en turnos consecutivos.
- REGLA CRÍTICA ANTI-CICLADO: si el líder expresa confusión ("no entendí", "a qué te refieres") o indica que ya contestó, reformula con palabras cotidianas y sencillas (o un ejemplo breve laboral) sin repetir la pregunta o plantilla previa; si ya aportó información o muestra desgaste, avanza con una pregunta diferente o habilita el avance cuando corresponda.
- Mantén tu respuesta breve, directa y proporcional (1 a 3 párrafos cortos), sin explicaciones innecesariamente extensas.${stage3LocalRule}${stage6LocalRule}${stage7LocalRule}

Genera tu respuesta como Lidacta para la Etapa ${currentStageNum} en formato JSON estricto.`;

    contents.push({
      role: 'user',
      parts: [{ text: finalTurnPrompt }],
    });

    const MODEL_NAME = process.env.GEMINI_MODEL || 'gemini-3.8-flash';
    const FALLBACK_MODEL = 'gemini-3.1-flash-lite';
    const attemptQueue = [
      MODEL_NAME,
      ...(MODEL_NAME !== FALLBACK_MODEL ? [FALLBACK_MODEL] : []),
    ];
    const initialQueueLength = attemptQueue.length;
    const FAST_TRANSIENT_ERROR_MS = 5000;
    const MAX_TOTAL_BUDGET_MS = 55000; // Margen seguro dentro de maxDuration = 60s
    const requestLoopStartTime = Date.now();
    let extraRetryUsed = false;

    const requestBodyPayload = JSON.stringify({
      systemInstruction: {
        parts: [{ text: systemPrompt }],
      },
      contents,
      generationConfig: {
        responseMimeType: 'application/json',
        thinkingConfig: {
          thinkingLevel: 'LOW',
        },
      },
    });
    const contentsChars = contents.reduce(
      (acc, turn) =>
        acc +
        (Array.isArray(turn?.parts)
          ? turn.parts.reduce(
              (partAcc, part) => partAcc + (typeof part?.text === 'string' ? part.text.length : 0),
              0
            )
          : 0),
      0
    );
    const requestStats = {
      stage: currentStageNum,
      historyTurns: resolvedHistory.length,
      contentsTurns: contents.length,
      systemPromptChars: systemPrompt.length,
      contentsChars,
      requestBodyBytes: new TextEncoder().encode(requestBodyPayload).length,
    };
    usageRequestStats = requestStats;

    let data: any = null;
    let ok = false;
    let lastStatus = 0;
    let lastErrorText = '';
    let lastErrorWasTimeout = false;
    let lastAttemptModel = '';

    for (let i = 0; i < attemptQueue.length; i++) {
      const modelName = attemptQueue[i];
      const attemptRole = i === 0 ? 'primary' : i < initialQueueLength ? 'fallback' : 'retry';
      // Reiniciar estado de error en cada intento para no mezclar resultados entre modelos
      lastAttemptModel = modelName;
      lastStatus = 0;
      lastErrorText = '';
      lastErrorWasTimeout = false;

      const timerScheduledTime = Date.now();
      const controller = new AbortController();
      const timeoutMs = 22000; // 22 segundos de timeout individual
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      const fetchStartTime = Date.now();
      let headersReceived = false;
      let headersElapsedMs = 0;

      console.log(
        `[Lidacta Telemetry] [${modelName}] Iniciando petición a Gemini (intento ${i + 1}/${attemptQueue.length}).\n` +
        `  - Temporizador programado: ${new Date(timerScheduledTime).toISOString()}\n` +
        `  - Inicio fetch: ${new Date(fetchStartTime).toISOString()}\n` +
        `  - Diferencia de arranque: ${fetchStartTime - timerScheduledTime}ms`
      );

      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: requestBodyPayload,
        });

        headersReceived = true;
        headersElapsedMs = Date.now() - fetchStartTime;
        lastStatus = response.status;
        console.log(`[Lidacta Telemetry] [${modelName}] Encabezados HTTP recibidos en ${headersElapsedMs}ms. Status: ${response.status}`);

        if (response.ok) {
          const bodyReadStartTime = Date.now();
          data = await response.json();
          clearTimeout(timeoutId);
          const totalElapsedMs = Date.now() - fetchStartTime;
          const bodyReadElapsedMs = Date.now() - bodyReadStartTime;
          console.log(`[Lidacta Telemetry] [${modelName}] Cuerpo JSON leído con éxito. Lectura body: ${bodyReadElapsedMs}ms | Tiempo total: ${totalElapsedMs}ms`);
          const usage = data?.usageMetadata ?? null;
          console.log(
            `[Lidacta Usage] ${JSON.stringify({
              event: 'gemini_success',
              outcome: 'success',
              traceId: requestTraceId,
              attempt: i + 1,
              attemptTotal: attemptQueue.length,
              attemptRole,
              usedFallback: attemptRole !== 'primary',
              model: modelName,
              modelVersion: typeof data?.modelVersion === 'string' ? data.modelVersion : null,
              usageMetadataAvailable: Boolean(usage),
              promptTokenCount: typeof usage?.promptTokenCount === 'number' ? usage.promptTokenCount : null,
              candidatesTokenCount: typeof usage?.candidatesTokenCount === 'number' ? usage.candidatesTokenCount : null,
              thoughtsTokenCount: typeof usage?.thoughtsTokenCount === 'number' ? usage.thoughtsTokenCount : null,
              totalTokenCount: typeof usage?.totalTokenCount === 'number' ? usage.totalTokenCount : null,
              cachedContentTokenCount: typeof usage?.cachedContentTokenCount === 'number' ? usage.cachedContentTokenCount : null,
              status: response.status,
              googleErrorCode: null,
              googleErrorStatus: null,
              errorClassification: 'none',
              isTimeout: false,
              headersElapsedMs,
              bodyReadElapsedMs,
              totalElapsedMs,
              requestElapsedMs: Date.now() - requestStartTime,
              ...requestStats,
            })}`
          );
          ok = true;
          break;
        }

        const bodyReadStartTime = Date.now();
        lastErrorText = await response.text();
        clearTimeout(timeoutId);
        const totalElapsedMs = Date.now() - fetchStartTime;
        const bodyReadElapsedMs = Date.now() - bodyReadStartTime;
        console.warn(`[Lidacta Telemetry] [${modelName}] Error HTTP ${response.status} en ${headersElapsedMs}ms (Lectura body error: ${bodyReadElapsedMs}ms, Total: ${totalElapsedMs}ms)`);

        let googleErrorCode: number | null = null;
        let googleErrorStatus: string | null = null;
        try {
          const parsedErr = JSON.parse(lastErrorText);
          if (typeof parsedErr?.error?.code === 'number') {
            googleErrorCode = parsedErr.error.code;
          }
          if (typeof parsedErr?.error?.status === 'string') {
            googleErrorStatus = parsedErr.error.status;
          }
        } catch {
          // Ignorar si el cuerpo de error no es JSON
        }

        const httpErrorClassification =
          response.status === 429 || googleErrorStatus === 'RESOURCE_EXHAUSTED'
            ? 'rate_limit'
            : response.status === 503 || googleErrorStatus === 'UNAVAILABLE'
            ? 'unavailable'
            : 'http_error';

        console.warn(
          `[Lidacta Usage] ${JSON.stringify({
            event: 'gemini_http_error',
            outcome: 'http_error',
            traceId: requestTraceId,
            attempt: i + 1,
            attemptTotal: attemptQueue.length,
            attemptRole,
            usedFallback: attemptRole !== 'primary',
            model: modelName,
            modelVersion: null,
            usageMetadataAvailable: false,
            promptTokenCount: null,
            candidatesTokenCount: null,
            thoughtsTokenCount: null,
            totalTokenCount: null,
            cachedContentTokenCount: null,
            status: response.status,
            googleErrorCode,
            googleErrorStatus,
            errorClassification: httpErrorClassification,
            isTimeout: false,
            headersElapsedMs,
            bodyReadElapsedMs,
            totalElapsedMs,
            requestElapsedMs: Date.now() - requestStartTime,
            ...requestStats,
          })}`
        );

        const hasMoreModels = i < attemptQueue.length - 1;
        // Si devuelve 503 (saturación) o 429 (límite de tasa), hacemos fallback automático al siguiente modelo;
        // si ya estamos en el último modelo y la falla 503/429 fue rápida (<5s), permitimos máximo 1 reintento secuencial con jitter dentro del presupuesto temporal.
        if (response.status === 503 || response.status === 429) {
          if (hasMoreModels) {
            console.warn(`Saturación/límite de tasa detectado (${response.status}) en ${modelName}. Procediendo con fallback automático...`);
            await new Promise((resolve) => setTimeout(resolve, 500));
          } else if (!extraRetryUsed && totalElapsedMs <= FAST_TRANSIENT_ERROR_MS) {
            const jitterDelayMs = 1200 + Math.floor(Math.random() * 600);
            const projectedTotalMs = (Date.now() - requestLoopStartTime) + jitterDelayMs + timeoutMs;
            if (projectedTotalMs <= MAX_TOTAL_BUDGET_MS) {
              extraRetryUsed = true;
              console.warn(
                `[Lidacta Telemetry] [${modelName}] Error rápido ${response.status} (${totalElapsedMs}ms). ` +
                `Ejecutando 1 reintento secuencial tras ${jitterDelayMs}ms (presupuesto proyectado: ${projectedTotalMs}ms/${MAX_TOTAL_BUDGET_MS}ms).`
              );
              await new Promise((resolve) => setTimeout(resolve, jitterDelayMs));
              attemptQueue.push(modelName);
            }
          }
        }
      } catch (fetchErr: any) {
        clearTimeout(timeoutId);
        const now = Date.now();
        const errorElapsedFromFetch = now - fetchStartTime;
        const errorElapsedFromTimer = now - timerScheduledTime;
        const wasSignalAborted = controller.signal.aborted;
        const errorName = fetchErr?.name || 'Error';
        lastErrorText = fetchErr?.message || String(fetchErr);

        // Clasificación diagnóstica ajustada por prioridad de causa raíz:
        let errorOrigin = 'Error de red o cancelación externa';
        if (wasSignalAborted) {
          errorOrigin = 'Aborto local confirmado (controller.signal.aborted = true)';
        } else if (headersReceived) {
          errorOrigin = 'Fallo durante la lectura del cuerpo de la respuesta después de recibir encabezados HTTP';
        }

        console.warn(
          `[Lidacta Telemetry] [${modelName}] EXCEPCIÓN DETECTADA:\n` +
          `  - Origen diagnosticado: ${errorOrigin}\n` +
          `  - Tiempo desde inicio de fetch: ${errorElapsedFromFetch}ms\n` +
          `  - Tiempo desde programación del temporizador: ${errorElapsedFromTimer}ms\n` +
          `  - Encabezados recibidos: ${headersReceived ? `Sí (${headersElapsedMs}ms)` : 'No'}\n` +
          `  - controller.signal.aborted: ${wasSignalAborted}\n` +
          `  - Tipo de error (name): ${errorName}\n` +
          `  - Mensaje original: ${lastErrorText}`
        );

        const isTimeout =
          wasSignalAborted ||
          fetchErr?.name === 'AbortError' ||
          lastErrorText.toLowerCase().includes('aborted') ||
          lastErrorText.toLowerCase().includes('timeout');

        lastErrorWasTimeout = isTimeout;

        console.warn(
          `[Lidacta Usage] ${JSON.stringify({
            event: 'gemini_exception',
            outcome: isTimeout ? 'timeout' : 'exception',
            traceId: requestTraceId,
            attempt: i + 1,
            attemptTotal: attemptQueue.length,
            attemptRole,
            usedFallback: attemptRole !== 'primary',
            model: modelName,
            modelVersion: null,
            usageMetadataAvailable: false,
            promptTokenCount: null,
            candidatesTokenCount: null,
            thoughtsTokenCount: null,
            totalTokenCount: null,
            cachedContentTokenCount: null,
            status: null,
            googleErrorCode: null,
            googleErrorStatus: null,
            errorClassification: isTimeout ? 'timeout' : 'network_or_sdk_error',
            errorName,
            isTimeout,
            wasSignalAborted,
            headersReceived,
            headersElapsedMs: headersReceived ? headersElapsedMs : null,
            bodyReadElapsedMs: null,
            totalElapsedMs: errorElapsedFromFetch,
            errorElapsedMs: errorElapsedFromFetch,
            requestElapsedMs: Date.now() - requestStartTime,
            ...requestStats,
          })}`
        );

        const hasMoreModels = i < attemptQueue.length - 1;

        if (isTimeout) {
          if (hasMoreModels) {
            console.warn(
              `[Lidacta Telemetry] [${modelName}] Timeout alcanzado (${timeoutMs}ms). ` +
              `Activando automáticamente modelo de respaldo (${attemptQueue[i + 1]})...`
            );
            continue;
          } else {
            console.warn(
              `[Lidacta Telemetry] [${modelName}] Timeout alcanzado en el modelo de respaldo. ` +
              `Se detiene el ciclo para retornar respuesta de error controlada.`
            );
            break;
          }
        }
      }
    }

    const candidatePartText = extractGeminiCandidateText(data);
    if (!ok || !candidatePartText) {
      const errorMsg = lastErrorText || 'No se recibió respuesta válida de los candidatos de la API de Gemini.';
      const errorHttpStatus =
        lastStatus === 429 || lastStatus === 503
          ? lastStatus
          : lastErrorWasTimeout
          ? 504
          : lastStatus >= 400 && lastStatus < 600
          ? lastStatus
          : 502;
      console.error(
        `[Lidacta API] Fallo final en /api/mentor/respond (stage=${currentStageNum}, modelo=${lastAttemptModel}, status=${errorHttpStatus}, ` +
        `rawStatus=${lastStatus || 'N/A'}, timeout=${lastErrorWasTimeout}): ${errorMsg}`
      );
      if (currentStageNum === 7) {
        console.warn(
          `[Lidacta Usage] ${JSON.stringify({
            event: 'stage7_closure_error',
            outcome: 'stage7_aborted',
            traceId: requestTraceId,
            attempt: attemptQueue.length,
            attemptTotal: attemptQueue.length,
            attemptRole: 'none',
            usedFallback: false,
            model: lastAttemptModel || null,
            modelVersion: null,
            usageMetadataAvailable: false,
            promptTokenCount: null,
            candidatesTokenCount: null,
            thoughtsTokenCount: null,
            totalTokenCount: null,
            cachedContentTokenCount: null,
            status: errorHttpStatus,
            googleErrorCode: lastStatus || null,
            googleErrorStatus: null,
            errorClassification: !ok
              ? lastErrorWasTimeout
                ? 'timeout'
                : lastStatus === 429
                ? 'rate_limit'
                : lastStatus === 503
                ? 'unavailable'
                : 'http_error'
              : 'empty_candidate',
            isTimeout: lastErrorWasTimeout,
            headersElapsedMs: null,
            bodyReadElapsedMs: null,
            totalElapsedMs: Date.now() - requestStartTime,
            requestElapsedMs: Date.now() - requestStartTime,
            ...requestStats,
          })}`
        );
      }
      return res.status(errorHttpStatus).json({
        success: false,
        responseSource: 'error',
        isFallback: false,
        isGeminiVerified: false,
        statusCode: errorHttpStatus,
        error: lastErrorWasTimeout
          ? 'Tiempo de espera agotado al procesar la solicitud de mentoría.'
          : errorHttpStatus === 429 || errorHttpStatus === 503
          ? 'El servicio de mentoría está temporalmente saturado. Por favor reintenta.'
          : 'No se pudo procesar la respuesta de mentoría en este momento.',
      });
    }

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

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      if (currentStageNum === 7) {
        console.warn(
          `[Lidacta Usage] ${JSON.stringify({
            event: 'stage7_invalid_response',
            outcome: 'invalid_json',
            traceId: requestTraceId,
            attempt: attemptQueue.length,
            attemptTotal: attemptQueue.length,
            attemptRole: 'none',
            usedFallback: false,
            model: lastAttemptModel || MODEL_NAME,
            modelVersion: typeof data?.modelVersion === 'string' ? data.modelVersion : null,
            usageMetadataAvailable: false,
            promptTokenCount: null,
            candidatesTokenCount: null,
            thoughtsTokenCount: null,
            totalTokenCount: null,
            cachedContentTokenCount: null,
            status: 502,
            googleErrorCode: null,
            googleErrorStatus: null,
            errorClassification: 'invalid_stage7_json',
            isTimeout: false,
            headersElapsedMs: null,
            bodyReadElapsedMs: null,
            totalElapsedMs: Date.now() - requestStartTime,
            requestElapsedMs: Date.now() - requestStartTime,
            ...requestStats,
          })}`
        );
        return res.status(502).json({
          success: false,
          responseSource: 'error',
          isFallback: false,
          isGeminiVerified: false,
          statusCode: 502,
          error: 'La respuesta de Gemini para el cierre de Etapa 7 no tiene formato JSON válido.',
        });
      }
      parsed = {
        replyText: cleanConversationalText(candidatePartText || rawText),
        readyToAdvance: false,
        advancePrompt: null,
        identifiedSkills: [],
      };
    }

    // 1. Postprocesamiento de skillEntries e identifiedSkills según la etapa del flujo
    let finalSkillEntries = existingSessionSkillEntries;

    if ([1, 5, 6].includes(currentStageNum) || currentStageNum === 7) {
      // Requisito C: Las etapas 1, 5, 6 y 7 NO generan, agregan, modifican, descartan ni sustituyen habilidades.
      // En la respuesta devuelta por estas etapas, identifiedSkills es SIEMPRE un arreglo vacío ([]),
      // aunque Gemini haya devuelto habilidades o directivas en su JSON.
      parsed.identifiedSkills = [];
      parsed.skillEntries = existingSessionSkillEntries;
      finalSkillEntries = existingSessionSkillEntries;
    } else if ([2, 3, 4].includes(currentStageNum)) {
      // En las etapas 2, 3 y 4: procesar habilidades candidatas y directivas de reconsideración
      const rawCandidates = Array.isArray(parsed.identifiedSkills)
        ? parsed.identifiedSkills
        : typeof parsed.identifiedSkills === 'string' && parsed.identifiedSkills.trim()
        ? [parsed.identifiedSkills.trim()]
        : parsed.identifiedSkills && typeof parsed.identifiedSkills === 'object' && parsed.identifiedSkills.skill
        ? [parsed.identifiedSkills]
        : [];

      const candidateSkills: (string | IncomingSkillCandidate)[] = [];
      for (const item of rawCandidates) {
        if (typeof item === 'string' && item.trim()) {
          candidateSkills.push(item.trim());
        } else if (item && typeof item === 'object' && typeof item.skill === 'string' && item.skill.trim()) {
          candidateSkills.push({
            skill: item.skill.trim(),
            evidenceText: typeof item.evidenceText === 'string' ? item.evidenceText.trim() : undefined,
          });
        }
      }

      // Directivas de reconsideración (válidas EXCLUSIVAMENTE en etapas 3 y 4 con evidencia explícita)
      const reconsiderationDirective: SkillReconsiderationDirective | undefined =
        (currentStageNum === 3 || currentStageNum === 4) &&
        parsed.skillsReconsideration &&
        typeof parsed.skillsReconsideration === 'object'
          ? parsed.skillsReconsideration
          : undefined;

      // Consolidar usando el motor central sobre skillEntries
      finalSkillEntries = consolidateSkillEntries(
        existingSessionSkillEntries,
        candidateSkills,
        currentStageNum,
        reconsiderationDirective
      );

      parsed.skillEntries = finalSkillEntries;
      parsed.identifiedSkills = getActiveSkillNames(finalSkillEntries);
    } else {
      parsed.identifiedSkills = [];
      parsed.skillEntries = existingSessionSkillEntries;
      finalSkillEntries = existingSessionSkillEntries;
    }

    // 2. En Etapa 7, validar estrictamente la respuesta y finalFeedback generados por Gemini
    // sin generar fallbacks genéricos ni ocultar respuestas incompletas o malformadas,
    // recuperando exclusivamente las habilidades activas consolidadas existentes con sus evidencias reales.
    if (currentStageNum === 7) {
      const candidateStage7Reply = cleanConversationalText(parsed?.replyText || parsed?.reply || '');
      // Requisito D: Recuperar exclusivamente las habilidades activas consolidadas y sus evidencias reales
      let skillsToReport: (LeadershipSkillEntry | string)[] = [];
      const activeEntries = getActiveSkillEntries(finalSkillEntries);

      if (activeEntries.length > 0) {
        skillsToReport = activeEntries;
      } else if (existingSessionSkills.length > 0) {
        skillsToReport = existingSessionSkills;
      } else {
        skillsToReport = [];
      }

      const registeredChosenActions = extractRegisteredStage5Actions(
        sessionData,
        effectiveStage7ExecutionStatus
      );
      const registeredStage6Learnings = extractRegisteredStage6Learnings(
        sessionData,
        effectiveStage7ExecutionStatus
      );

      const feedbackValidation = isValidStage7FinalFeedbackPayload(parsed.finalFeedback, {
        hasSessionSkills: skillsToReport.length > 0,
        hasRegisteredActions: registeredChosenActions.length > 0,
        hasRegisteredLearnings: registeredStage6Learnings.length > 0,
        executionStatus: effectiveStage7ExecutionStatus,
      });

      if (!isCleanStage7String(candidateStage7Reply) || !feedbackValidation.valid) {
        console.warn(
          `[Lidacta Usage] ${JSON.stringify({
            event: 'stage7_invalid_response',
            outcome: 'invalid_final_feedback',
            traceId: requestTraceId,
            attempt: attemptQueue.length,
            attemptTotal: attemptQueue.length,
            attemptRole: 'none',
            usedFallback: false,
            model: lastAttemptModel || MODEL_NAME,
            modelVersion: typeof data?.modelVersion === 'string' ? data.modelVersion : null,
            usageMetadataAvailable: false,
            promptTokenCount: null,
            candidatesTokenCount: null,
            thoughtsTokenCount: null,
            totalTokenCount: null,
            cachedContentTokenCount: null,
            status: 502,
            googleErrorCode: null,
            googleErrorStatus: null,
            errorClassification: !isCleanStage7String(candidateStage7Reply)
              ? 'invalid_stage7_reply'
              : feedbackValidation.reason || 'invalid_final_feedback',
            isTimeout: false,
            headersElapsedMs: null,
            bodyReadElapsedMs: null,
            totalElapsedMs: Date.now() - requestStartTime,
            requestElapsedMs: Date.now() - requestStartTime,
            ...usageRequestStats,
          })}`
        );
        return res.status(502).json({
          success: false,
          responseSource: 'error',
          isFallback: false,
          isGeminiVerified: false,
          statusCode: 502,
          error: 'No se recibió un reporte de cierre válido y completo de Gemini para concluir la Etapa 7.',
        });
      }

      // Formatear stageTwoSkills con la evidencia real observada o el mensaje de insuficiencia
      const formattedStageTwoSkills = formatStageTwoSkillsWithEvidence(skillsToReport);

      const isUnexecutedStage7 =
        effectiveStage7ExecutionStatus === 'not_executed' ||
        effectiveStage7ExecutionStatus === 'pending_verification';

      const cleanChosenActions = parsed.finalFeedback.chosenActions
        .map((s: string) => s.trim())
        .filter((s: string) => !isStage7InsufficientPlaceholder(s));
      const cleanStageSixLearnings = parsed.finalFeedback.stageSixLearnings
        .map((s: string) => s.trim())
        .filter(
          (s: string) =>
            !isStage7InsufficientPlaceholder(s) &&
            (!isUnexecutedStage7 ||
              (!isNonSubstantiveNonExecutionNote(s) && !claimsActionAlreadyExecuted(s)))
        );
      const cleanRecommendations = parsed.finalFeedback.recommendationsForAutonomy
        .map((s: string) => s.trim())
        .filter((s: string) => !isStage7InsufficientPlaceholder(s));

      const resolvedChosenActions = resolveStage7ChosenActions(
        cleanChosenActions,
        registeredChosenActions,
        sessionData,
        isUnexecutedStage7
      );

      // Garantizar la estructura de las 5 secciones conservando acciones/reflexiones reales sin inventar datos faltantes
      parsed.finalFeedback = {
        detectedStrengths: sanitizeDetectedStrengths(parsed.finalFeedback.detectedStrengths),
        stageTwoSkills: formattedStageTwoSkills,
        chosenActions: resolvedChosenActions,
        stageSixLearnings:
          cleanStageSixLearnings.length > 0
            ? cleanStageSixLearnings
            : registeredStage6Learnings,
        recommendationsForAutonomy: cleanRecommendations,
      };
    }

    let validatedStage6Correction: 'not_executed' | null = null;
    if (currentStageNum === 6) {
      if (
        parsed?.correctedExecutionStatus === 'not_executed' ||
        deterministicStage6Correction === 'not_executed'
      ) {
        validatedStage6Correction = 'not_executed';
      }
      if (validatedStage6Correction) {
        parsed.correctedExecutionStatus = validatedStage6Correction;
      } else {
        delete parsed.correctedExecutionStatus;
      }
    } else if (parsed && typeof parsed === 'object') {
      delete parsed.correctedExecutionStatus;
    }

    const rawReply =
      currentStageNum === 7
        ? parsed?.replyText || parsed?.reply || ''
        : parsed?.replyText || parsed?.reply || rawText || candidatePartText;
    const responseText = cleanConversationalText(rawReply);
    if (!responseText) {
      return res.status(502).json({
        success: false,
        responseSource: 'error',
        isFallback: false,
        isGeminiVerified: false,
        statusCode: 502,
        error: 'Gemini devolvió una respuesta vacía.',
      });
    }
    parsed.reply = responseText;
    parsed.replyText = responseText;
    const verifiedModel = lastAttemptModel || MODEL_NAME;

    return res.status(200).json({
      success: true,
      responseSource: 'gemini',
      isFallback: false,
      isGeminiVerified: true,
      model: verifiedModel,
      reply: responseText,
      text: responseText,
      readyToAdvance: Boolean(parsed.readyToAdvance),
      advancePrompt: parsed.advancePrompt ?? null,
      ...(validatedStage6Correction ? { correctedExecutionStatus: validatedStage6Correction } : {}),
      data: {
        ...parsed,
        reply: responseText,
        replyText: responseText,
        responseSource: 'gemini',
        isFallback: false,
        isGeminiVerified: true,
        model: verifiedModel,
      },
    });
  } catch (error: any) {
    console.error('Error en mentor respond:', error);
    console.warn(
      `[Lidacta Usage] ${JSON.stringify({
        event: 'server_error',
        outcome: 'server_error',
        traceId: requestTraceId,
        attempt: 0,
        attemptTotal: 0,
        attemptRole: 'none',
        usedFallback: false,
        model: null,
        modelVersion: null,
        usageMetadataAvailable: false,
        promptTokenCount: null,
        candidatesTokenCount: null,
        thoughtsTokenCount: null,
        totalTokenCount: null,
        cachedContentTokenCount: null,
        status: 500,
        googleErrorCode: null,
        googleErrorStatus: null,
        errorClassification: 'unhandled_exception',
        isTimeout: false,
        headersElapsedMs: null,
        bodyReadElapsedMs: null,
        totalElapsedMs: Date.now() - requestStartTime,
        requestElapsedMs: Date.now() - requestStartTime,
        ...usageRequestStats,
      })}`
    );
    return res.status(500).json({
      success: false,
      responseSource: 'error',
      isFallback: false,
      isGeminiVerified: false,
      error: error?.message || 'Error en servidor',
    });
  }
}
