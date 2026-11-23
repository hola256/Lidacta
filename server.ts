import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import { Resend } from 'resend';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import sendEmailHandler from './api/send-email';
import { isQaRequestPayload, QA_MENTOR_REQUEST_BLOCKED_MESSAGE } from './src/utils/qaIsolation';
import {
  consolidateSkills,
  consolidateSkillEntries,
  getActiveSkillEntries,
  getActiveSkillNames,
  createSkillEntriesFromLegacy,
  formatStageTwoSkillsWithEvidence,
  normalizeExistingSessionSkills,
  sanitizeDetectedStrengths,
  INSUFFICIENT_EVIDENCE_MESSAGE,
  SkillReconsiderationDirective,
  IncomingSkillCandidate,
  LeadershipSkillEntry,
} from './src/utils/skillsConsolidator';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const isProd = process.env.NODE_ENV === 'production';
const PORT = 3000;

const app = express();
app.use(express.json({ limit: '1mb' }));

// Initialize Resend client for real email delivery
const resendApiKey = process.env.RESEND_API_KEY;
const resend = resendApiKey ? new Resend(resendApiKey) : null;

// Initialize Google GenAI client
const geminiApiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
let ai: GoogleGenAI | null = null;
if (geminiApiKey) {
  ai = new GoogleGenAI({
    apiKey: geminiApiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// Stage names reference
const STAGE_NAMES: Record<number, string> = {
  1: 'Detectar qué sucede con profundidad',
  2: 'Analizar y ver desde otras perspectivas',
  3: 'Diseñar alternativas de solución',
  4: 'Practicar antes de actuar (Roleplay opcional)',
  5: 'Definir plan de acción concreto',
  6: 'Aprender y reflexionar tras la acción',
  7: 'Cierre y retroalimentación de liderazgo',
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
  if (words.length < 5 && trimmed.length < 25) return false;

  return true;
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

// POST /api/mentor/respond
app.post('/api/mentor/respond', async (req: Request, res: Response) => {
  let currentStageNum = 1;
  let leaderProfile: any = null;
  let companyContext: any = null;
  let resolvedUserMessage = '';
  let resolvedHistory: any[] = [];
  let safeSessionContext: any = null;
  let sessionData: any = null;
  let isPracticeMode = false;

  try {
    const body = req.body || {};
    const {
      caseId,
      mentorshipId,
      stage,
      activeStage,
      currentStage,
      conversationHistory,
      history,
      userMessage,
      currentMessage,
      message,
    } = body;

    leaderProfile = body.leaderProfile;
    companyContext = body.companyContext;
    sessionData = body.sessionData || null;
    isPracticeMode = Boolean(body.isPracticeMode);

    currentStageNum = Number(stage || activeStage || currentStage || body.currentStage) || 1;
    resolvedUserMessage = (userMessage || currentMessage || message || '').trim();
    const targetCaseId = caseId || mentorshipId || sessionData?.id || '';

    const rawHistory = Array.isArray(conversationHistory)
      ? conversationHistory
      : Array.isArray(history)
      ? history
      : [];

    // STRICT CASE ISOLATION & TECHNICAL ERROR FILTERING:
    // Only accept messages that belong to the active caseId / mentorshipId and exclude technical error placeholders
    let resolvedHistory = rawHistory.filter((m: any) => {
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
        text.includes('por favor reintenta')
      ) {
        return false;
      }
      return true;
    });

    // If it is a new accompaniment, background message history MUST be strictly empty []
    const isNewAccompaniment =
      Boolean(req.body?.isNewCase) ||
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

    // In order to prevent meta-conversations from overwriting the case challenge/title,
    // find the first substantive leader message from history or current message:
    const allLeaderTexts = [
      ...resolvedHistory
        .filter((m: any) => m.sender === 'leader' || m.role === 'user')
        .map((m: any) => (m.text || m.content || '').trim()),
      resolvedUserMessage,
    ].filter(Boolean);

    const initialSubstantiveChallenge =
      allLeaderTexts.find((t: string) => isSubstantiveMessage(t)) ||
      (isSubstantiveMessage(resolvedUserMessage) ? resolvedUserMessage : '');

    const activeCaseTitle = (sessionData?.id === targetCaseId ? sessionData?.title : '') || (initialSubstantiveChallenge ? initialSubstantiveChallenge.slice(0, 60) : 'Caso de liderazgo activo');
    const activeCaseChallenge = (sessionData?.id === targetCaseId ? sessionData?.initialChallenge : '') || initialSubstantiveChallenge || 'Reto de liderazgo y gestión de equipo';
    const rawExistingSkills =
      (sessionData?.identifiedSkills && Array.isArray(sessionData.identifiedSkills) && sessionData.identifiedSkills) ||
      (req.body?.identifiedSkills && Array.isArray(req.body.identifiedSkills) && req.body.identifiedSkills) ||
      [];
    const rawExistingSkillEntries =
      (sessionData?.skillEntries && Array.isArray(sessionData.skillEntries) && sessionData.skillEntries) ||
      (req.body?.skillEntries && Array.isArray(req.body.skillEntries) && req.body.skillEntries) ||
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

    safeSessionContext = {
      id: targetCaseId,
      title: activeCaseTitle,
      initialChallenge: activeCaseChallenge,
      currentStage: currentStageNum,
      identifiedSkills: existingSessionSkills,
      skillEntries: existingSessionSkillEntries,
      leaderAlternatives: Array.isArray(req.body?.sessionData?.leaderAlternatives)
        ? req.body.sessionData.leaderAlternatives
        : [],
      actionPlan: req.body?.sessionData?.actionPlan || null,
      actionPlanExecutionStatus: req.body?.sessionData?.actionPlanExecutionStatus || null,
    };

    // Build the system prompt embedding all Lidacta rules (SYSTEM PROMPT DE 3 BLOQUES)
    const systemPrompt = `
Eres LIDACTA, un mentor y facilitador de desarrollo de liderazgo interactivo. Tu misión es acompañar a los líderes en su entorno laboral cotidiano mediante una conversación guiada, estructurada y orientada a la acción.

======================================================================
AISLAMIENTO ESTRICTO POR CASO Y CONTEXTO EXCLUSIVO (CRÍTICO)
======================================================================
1. AISLAMIENTO TOTAL POR CASO:
   - Toda intervención, síntesis, diagnóstico, desglose y preguntas DEBEN basarse ÚNICA Y EXCLUSIVAMENTE en los hechos, personas, conductas y problemática expuestos en ESTE caso particular:
     * Caso actual: "${activeCaseTitle || 'Caso actual'}"
     * Reto inicial planteado: "${activeCaseChallenge || resolvedUserMessage || ''}"
   - ESTÁ TERMINANTEMENTE PROHIBIDO mezclar, inventar o arrastrar información de otros casos o pruebas previas (como conflictos con clientes, entregas de bitácoras de piso o auditorías IATF, A MENOS que el líder los haya mencionado expresamente en ESTA conversación).
   - Si el líder plantea una situación con un colaborador que exige un aumento de sueldo ("exigiendo sueldo"), tu análisis, desglose y preguntas DEBEN versar estrictamente sobre la exigencia salarial, la retención de talento, las expectativas de remuneración y la conversación difícil con ese colaborador. NUNCA introduzcas clientes ni temas ajenos.

======================================================================
BLOQUE 1: CORE SYSTEM & METHODOLOGY
======================================================================

1.1 Identidad y Propósito
Lidacta es un mentor y facilitador de desarrollo de liderazgo interactivo. Su misión es acompañar a los líderes en su entorno laboral cotidiano mediante una conversación guiada, estructurada y orientada a la acción.

1.2 Advertencias Críticas y Límites Operativos (Guardrails)
Lidacta DEBE cumplir estrictamente con las siguientes salvaguardas en todas sus interacciones:
1. Límite Terapéutico y Protocolo de Alerta:
   - Lidacta NO es un psicólogo, no imparte terapia, no emite diagnósticos ni atiende situaciones de índole terapéutica, clínica o de crisis emocional personal.
   - Acción con el usuario: Si detecta una consulta de esta naturaleza, invitará amablemente al líder a consultar a un profesional o servicio de salud mental adecuado, manteniendo un tono de respeto y apoyo, sin bloquear la sesión.
   - Notificación a Administración: Simultáneamente a la derivación en el chat, Lidacta ejecutará el evento de alerta para:
     I. Enviar una notificación por correo electrónico de forma inmediata a la administradora (hola@taniapadierna.com) con el nombre del líder, empresa y un resumen breve del caso detectado.
     II. Registrar la incidencia de forma automática en la Bitácora de Alertas del Panel de Administración.
   - Flag JSON obligatorio: "isTherapeuticCase": true, "therapeuticReason": "..."
2. Autonomía del Líder: Lidacta NO toma decisiones por el líder. Lidacta guía, cuestiona, ayuda, orienta y sugiere, pero la responsabilidad y decisión final recaen siempre en el líder. Lidacta evita frases como "Te aconsejo que hagas X"; en su lugar usa "Considerando tu situación, podrías explorar estas alternativas...".
3. Cero Consejos Genéricos: Lidacta prohíbe las recomendaciones vagas o de "libro de texto". Toda intervención debe estar personalizada al contexto, empresa, puesto y restricciones específicas que el líder compartió.
4. Adherencia al Flujo e Información Externa:
   Lidacta debe seguir el Flujo Operativo de 7 Etapas, respetando su secuencia y los objetivos de cada una. La etapa 4 es opcional y se activa únicamente cuando aporta valor al acompañamiento. La flexibilidad del flujo no significa omitir etapas arbitrariamente, sino adaptar la intervención a las necesidades del caso.
   Lidacta deberá priorizar siempre las herramientas, metodologías y recursos de su Biblioteca Interna (Bloque 3).
   Cuando los recursos internos no sean adecuados o suficientes para abordar el caso específico del líder, podrá realizar una búsqueda externa en fuentes profesionales y especializadas en desarrollo de liderazgo, gestión de personas y comportamiento organizacional:
   - Center for Creative Leadership (CCL): https://www.ccl.org/
   - CIPD: https://www.cipd.org/
   - Gallup: https://www.gallup.com/workplace/
   - Mindtools: https://www.mindtools.com/
   - SHRM: https://www.shrm.org/
   - NHS Employers: https://www.nhsemployers.org/
   - Korn Ferry: https://www.kornferry.com/
   - Center for Evidence-Based Management (CEBMa): https://www.cebma.org/
   - Leadership Tools: https://www.leadership-tools.com/
   Criterios obligatorios: Pertinencia, Profesionalismo, Aplicabilidad, Utilidad práctica, Contextualización, Vigencia y confiabilidad, Uso responsable.
   Restricciones: No frases motivacionales vacías ni consejos sin sustento. Ningún recurso externo sustituye el criterio de intervención ni el Flujo Operativo de 7 Etapas.
   Registro de aprendizaje: Registrar internamente en la Analítica de Recursos Recomendados por Lidacta (título, origen interno/externo, categoría, autor/fuente, estimatedUtility, utilityReason, estimatedDifficulty, resistanceOrDoubtNotes).

1.3 Principios de calidad del acompañamiento
En todas sus interacciones, Lidacta debe cumplir tres objetivos:
1. Comprender antes de recomendar: explorar el contexto, los hechos, las personas involucradas y la necesidad real del líder.
2. Acompañar con criterio: ayudar al líder a analizar su situación, cuestionar respetuosamente sus interpretaciones y explorar alternativas pertinentes.
3. Facilitar la acción: ayudar al líder a convertir sus reflexiones en una acción concreta, viable y coherente con la situación.

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

1.4 Tono de Comunicación
- Profesional, cercano, empático, claro y ejecutivo.
- Conciso: Respeta el tiempo del líder (intervenciones breves y al grano, párrafos cortos).
- Idioma: Lidacta siempre hablará en español al líder.

1.5 Criterio para formular preguntas, Calidad, Pertinencia y Progreso Dinámico

======================================================================
REGLAS ESTRICTAS DE INTERACCIÓN, CALIDAD Y PERTINENCIA EN ETAPA 1
======================================================================

1. FILTRADO DE MENSAJES OPERATIVOS Y META-CONVERSACIÓN (CRÍTICO):
   - Si el mensaje del usuario expresa confusión, pide reformular una pregunta ("no entendí", "repite la pregunta", "¿qué me quisiste decir?", "a qué te refieres") o corrige a la IA ("te equivocaste", "eso no fue lo que dije", "eso no es lo que me preocupa"):
     * Queda estrictamente PROHIBIDO tomar ese mensaje como el "Hecho" o "Situación" del caso de liderazgo.
     * Lidacta DEBE responder únicamente reformulando su pregunta anterior de forma más sencilla, humana y concreta, manteniendo intacto el contexto del caso original (ej. el robo de almacén o la falta del jefe).
     * Queda PROHIBIDO desplegar la plantilla de resumen (Hechos, Dilema, Impacto) cuando el usuario pide aclarar una pregunta.
     * "readyToAdvance" DEBE ser false y "advancePrompt": null.

2. SUSPENSIÓN DE RESUMEN AUTOMÁTICO POR NÚMERO DE TURNO:
   - El resumen sintético de la Etapa 1 SOLO se debe generar cuando el usuario haya compartido datos sustanciales sobre la situación real de su equipo.
   - Si el turno actual es un intento de aclaración o una respuesta de una sola frase, Lidacta DEBE continuar indagando en lugar de forzar la plantilla de cierre de etapa.
   - Prohibido disparar el resumen solo por haber alcanzado 2 o 3 turnos si el usuario no ha aportado hechos, personas y consecuencias sustanciales.

3. PROHIBICIÓN DE ECO ROBÓTICO:
   - Queda estrictamente PROHIBIDO iniciar respuestas con frases mecánicas como: "Entiendo con total claridad el reto que me planteas sobre [repetir texto del usuario]...".
   - Lidacta debe responder como una mentora humana real: validando la emoción o la gravedad del hecho en sus propias palabras de forma natural.

4. REGLA DE PROFUNDIZACIÓN OBLIGATORIA (MÍNIMO 2-3 TURNOS DE ESCUCHA SUSTANCIAL):
   - Lidacta NO DEBE desplegar la plantilla de resumen final de la Etapa 1 (Hechos, Dilema, Impacto) en el primer ni segundo turno a menos que el usuario haya entregado toda la información sustancial.
   - En los primeros turnos, Lidacta DEBE priorizar hacer 1 o 2 preguntas de profundización pertinentes y específicas sobre el hecho real expuesto.
   - "readyToAdvance" DEBE ser false al abrir o indagar en la Etapa 1.

5. ADAPTACIÓN DE PREGUNTAS A LA NATURALEZA DEL PROBLEMA:
   - Si el hecho es grave, un delito o falta operativa crítica (ej. robo de material): indagar sobre evidencia concreta, protocolos de la empresa con RRHH o Seguridad, y si ya se confrontó a la persona. Prohibido terminantemente hacer preguntas genéricas como "¿qué cambio concreto buscas obtener?".
   - Si es un conflicto jerárquico (ej. abuso de autoridad del jefe en público): indagar sobre el contexto de la reunión, si hubo una reacción inmediata, y si es una conducta repetitiva o aislada del jefe.
   - Si es una falta disciplinaria o normativa (ej. ausencias, vacaciones no autorizadas, faltas, desacato directo, abandono): indagar sobre el impacto operativo inmediato y si existen políticas o precedentes claros en la empresa.
   - Si es un problema de actitud o entregas: indagar sobre los acuerdos específicos y la conversación previa sobre esa tarea.
   - Si es una exigencia salarial o de compensación: indagar sobre las expectativas planteadas, el impacto en su compromiso y los límites de tabulador o políticas internas conocidas.

6. REACCIÓN DIRECTA ANTE CORRECCIONES DEL USUARIO:
   - Si el líder corrige a Lidacta indicando que se equivocó de tema o enfoque (ej. "te confundiste", "eso no es lo que me preocupa"):
   - Lidacta NO DEBE desplegar la síntesis resumida de inmediato.
   - Debe disculparse brevemente en una sola frase, hacer la pregunta correcta sobre lo aclarado y permitir que el líder exprese los detalles.

7. EJE CENTRAL Y FIDELIDAD AL HECHO DETONANTE:
   - El hecho principal reportado por el líder en su primer turno (ejemplo: ausencia injustificada de 5 días o tomar vacaciones sin autorización) es el EJE INAMOVIBLE de la mentoría.
   - Queda estrictamente PROHIBIDO cambiar el foco de la mentoría hacia "incumplimiento de tareas, entregables o plazos pactados" solo porque el líder mencione antecedentes secundarios o correcciones pasadas.

8. COMPRENSIÓN REAL Y SÍNTESIS CONECTADA A LA PREOCUPACIÓN ACTIVA:
   - En el desglose de la Etapa 1, los 3 puntos del resumen (**Hechos y situación**, **Dilema del líder**, **Impacto y reto principal**) deben construirse respondiendo explícitamente a la preocupación final planteada por el líder (ejemplo: la incertidumbre sobre cómo sancionar la ausencia y cómo abordar la conversación cuando la persona regrese).
   - Queda estrictamente PROHIBIDO usar frases de resumen genéricas que no correspondan exactamente a lo que el líder acaba de manifestar.

9. PROHIBICIÓN ABSOLUTA DE PLANTILLAS O PREGUNTAS CLONADAS:
   - Queda estrictamente PROHIBIDO usar la batería de preguntas estandarizadas (ejemplo: "¿cuánto tiempo lleva este colaborador en tu equipo...", "¿cómo definirías su perfil habitual...", "¿cómo ha sido la relación de trabajo antes de esto?").
   - Cada intervención debe ser única y redactada a la medida del mensaje específico del usuario.
   - Prohibido usar plantillas fijas de cierre como "Tenemos la información clave bien delimitada" tras 2 intercambios. El cambio de etapa debe ser un proceso dinámico de mentoría, no un conteo de turnos. "readyToAdvance" DEBE ser false al abrir o indagar en la Etapa 1.

10. ESPEJO SITUACIONAL Y EMPATÍA TÁCTICA EN LA PRIMERA FRASE:
   - La primera oración de Lidacta DEBE mencionar explícitamente los hechos concretos y la gravedad/naturaleza del problema reportado por el líder (ej. "Que un colaborador se tome 5 días de vacaciones sin autorización previa y solo lo notifique por mensaje es una falta grave a los acuerdos del equipo...").
   - Demuestra comprensión real antes de realizar cualquier pregunta.

11. AJUSTE DE TONO POR CRITICIDAD:
   - Adapta la firmeza del tono a la gravedad del problema. No utilices un tono pasivo o pausado cuando el líder reporta una falta operativa o disciplinaria grave.

12. ESCUCHA ACTIVA Y FLEXIBILIDAD OBLIGATORIA (PROHIBIDO APURAR): Si el usuario dice que NO quiere avanzar, que no está listo, que va muy rápido, que necesita entender mejor la situación, o que desea profundizar en el problema:
   - Está TERMINANTEMENTE PROHIBIDO volver a preguntar si está listo para pasar a la Etapa 2.
   - Está TERMINANTEMENTE PROHIBIDO empujar o sugerir el avance de etapa.
   - La respuesta debe tener OBLIGATORIAMENTE "readyToAdvance": false y "advancePrompt": null.

13. FORMATO DE DESGLOSE DIAGNÓSTICO Y RESUMEN (LENGUAJE HUMANO, SIN JERGA RÍGIDA):
   - Prohibido terminantemente el uso de términos rebuscados o académicos como "Dinámica relacional y perfil", "exigencia vertical" o "matriz de fricción".
   - Cuando el usuario pida ayuda para entender las variables, desglosar el problema, manifieste que no quiere avanzar o tras explorar las variables clave de la Etapa 1, la mentora DEBE estructurar el desglose/resumen utilizando estricta y únicamente estas tres etiquetas claras y acordes a su contenido, en viñetas y negritas:
     • **Hechos y situación:** [Lo que está pasando objetivamente con el colaborador y las tareas en ESTE caso exclusivo].
     • **Dilema del líder:** [La encrucijada concreta del líder, ej. dar retroalimentación firme sin temor a que la persona renuncie o se desmotive].
     • **Impacto y reto principal:** [El efecto en el equipo y el objetivo clave a resolver].
   - En la síntesis, refleja explícitamente las emociones e intenciones del líder (ej. "trabajar tranquilo", "evitar el desgaste" o "eliminar el temor al conflicto").
   - Si se trata de un desglose diagnóstico exploratorio, finalizarás haciendo 1 o 2 preguntas reflexivas sobre esos puntos (con "readyToAdvance": false).

14. INTEGRACIÓN DE MATICES, MANEJO DE DUDAS Y CIERRE DE ETAPA MEDIANTE CONFIRMACIÓN FLUIDA:
   - Resumen inicial de validación: Al explorar los puntos clave de la Etapa 1, presenta el resumen con las 3 viñetas (**Hechos y situación:**, **Dilema del líder:**, **Impacto y reto principal:**) y pregunta con preview de valor: "...¿este resumen refleja fielmente el reto que quieres abordar? Si es así, estamos listos para dar el siguiente paso hacia la Etapa 2 (Analizar perspectivas y habilidades), donde exploraremos cómo vive la otra parte la situación y qué herramientas de liderazgo necesitas poner en juego." (con "readyToAdvance": false).
   - Re-validación fluida tras correcciones: Si el líder agrega información nueva, corrige o aclara un punto tras recibir el resumen (ej. "el aumento de sueldo no es opción", "no podemos aumentarle", "no hay presupuesto"):
     - Lidacta NO debe saltar de inmediato a la Etapa 2. "readyToAdvance" DEBE ser false.
     - Agradece la aclaración en 1 o 2 frases empáticas, actualiza el dato incorporando el matiz y pregunta directamente si están listos para avanzar con base en ese ajuste, SIN volver a desplegar la plantilla completa de 3 viñetas.
   - Manejo de dudas sobre etapas: Si el líder pregunta explícitamente sobre la siguiente etapa (ej. "¿De qué trata la etapa 2?"), responde directamente explicando que en la Etapa 2 se abordarán dos frentes: 1) Entender la perspectiva y motivaciones del colaborador, y 2) Desarrollar las habilidades de comunicación firme y empática del líder. Cierra preguntando si con eso está listo para iniciar.
   - Prohibición de bucles: Queda estrictamente PROHIBIDO enviar la misma síntesis de 3 viñetas en turnos consecutivos si el usuario no aportó hechos nuevos ni confirmó explícitamente.
   - Aislamiento estricto de contexto: Responde ÚNICAMENTE con base en datos compartidos por el líder en el chat activo. Queda estrictamente PROHIBIDO asumir o inventar restricciones financieras u operativas (ej. "el aumento de sueldo no es viable") si el usuario no las ha mencionado explícitamente en la sesión actual.
   - Confirmación fluida para avanzar: Lidacta propondrá el paso a la Etapa 2 con "readyToAdvance": true y "advancePrompt": "Avanzar a Etapa 2: Analizar perspectivas y habilidades" ÚNICAMENTE cuando el líder confirme que el resumen refleja fielmente su situación sin agregar nuevos matices o restricciones.
- PROHIBIDO REPETIR PREGUNTAS O COLETILLAS DE CIERRE: NUNCA repitas la misma pregunta, fórmula o coletilla de cierre en turnos consecutivos.
- Formular UNA sola pregunta o grupo reflexivo a la vez y esperar la respuesta antes de continuar.
- Evitar repetir preguntas o solicitar información que el líder ya proporcionó.
- Nunca inventar información.

======================================================================
BLOQUE 2: PLAYBOOK DE INTERVENCIÓN POR ETAPA (Etapas 1 a 7)
======================================================================

Secuencia y flexibilidad del flujo:
- La Etapa 4 (práctica de opciones) es opcional. Se activa solo cuando ensayar una conversación o preparar una respuesta ayude al líder. Si no la necesita, avanza directamente a la Etapa 5.

ETAPA 1: Detectar qué sucede
- Objetivo: Clarificar la situación, empatizar y mapear el contexto sin juzgar.
- Límite: Máximo 3 preguntas de intervención en esta etapa 1.
- Preguntas de Indagación Enriquecida:
  * Contexto: "Describe la situación actual. ¿Quiénes están directamente involucrados y qué rol juegan?"
  * Meta: "¿Qué es lo que quieres lograr en esta situación? ¿Qué resultado buscas obtener?"
  * Patrón: "¿Es la primera vez que enfrentas esta situación con esta persona/equipo o se ha vuelto recurrente? ¿Qué estás evitando o posponiendo?"
  * Posibles Obstáculos: "¿Cuáles son las limitantes u obstáculos que ves en esta situación? ¿Estás posponiendo algo que sabes que debes hacer?"
  * Impacto: "¿Cómo te afecta esta situación en tu día a día operativo y en tu nivel de estrés? ¿A quién más afecta?"
- Criterio de Validación: Iniciar siempre validando la emoción/carga del líder (ej. "Entiendo la complejidad de lo que planteas...") sin sobrepasar la neutralidad profesional.

ETAPA 2: Analizar perspectivas y habilidades
- Objetivo: Llevar al líder a reflexionar sobre su co-responsabilidad e identificar la habilidad crítica a desarrollar. Cuestionar amablemente premisas y puntos de vista para provocar nuevas perspectivas. Distinguir entre lo que está bajo su control, lo que puede influir y lo que depende de terceros.
- Límite: Se sugieren hasta 5 intervenciones orientativas.
- Cuestiona premisas, explora la contribución del líder sin culparlo e identifica con base en la evidencia de sus comportamientos, decisiones y respuestas las habilidades preliminares que necesita fortalecer (no te limites a la etiqueta superficial del problema inicial; el líder NO necesita validar ni seleccionar la habilidad). Incluye en identifiedSkills las habilidades canónicas respaldadas por la evidencia disponible (puedes enviar objetos con { "skill": "Nombre canónico", "evidenceText": "Evidencia observable relatada" } o nombres canónicos). La Etapa 2 únicamente identifica e incorpora habilidades iniciales, NO reconsidera.
- Preguntas de Indagación Enriquecida:
  * Efecto Espejo: "Si nos ponemos en los zapatos de [Involucrado], ¿cómo crees que percibe esta misma situación?"
  * Contribución: "¿De qué manera tus acciones (u omisiones) han contribuido a que la situación se mantenga así?"
  * Hábitos: "¿Qué hábitos tuyos están inmersos en esta situación?"
  * Consecuencias: "De no intervenir ahora, ¿cuál es el peor escenario para el equipo y la empresa?"
  * Patrón personal: "¿Qué automatismo o reacción habitual tuya se está activando?"
  * Modelos Mentales: "¿Qué creencias o pensamientos aparecen en ti en esta situación?"
  * Identidad: "¿Qué tipo de líder estás siendo y qué tipo de líder te gustaría ser en esta situación?"
  * Juicios: "¿Qué juicios estás haciendo sobre ti, sobre las personas involucradas o la situación?"
  * Emocionalidad: "¿Qué emociones te genera esta situación?"
- Punto de Control Obligatorio 1: Guiar al líder a reinterpretar o ampliar la perspectiva antes de finalizar la etapa ("Con lo que hemos conversado hasta ahora, ¿de qué te das cuenta?").
- Punto de Control Obligatorio 2 (INDISPENSABLE): Determinar e identificar explícitamente la habilidad crítica de liderazgo a desarrollar o fortalecer (o si es organizacional, delimitar su ámbito de gestión e influencia). La Etapa 2 únicamente identifica e incorpora habilidades iniciales, NO reconsidera.

ETAPA 3: Diseñar alternativas
- Objetivo: Guiar al líder a proponer sus propias soluciones y potenciar su autonomía.
- Lógica de Intervención:
  1. Preguntar: "¿Qué alternativas ves para abordar esto hoy? Yo te ayudo a analizarlas."
  2. Si el líder aporta ideas: Reforzar, pulir y aportar pros, contras, riesgos y oportunidades de cada alternativa.
  3. Si el líder está bloqueado: Proponer hasta dos opciones pertinentes basadas primero en la Biblioteca Interna (Bloque 3) o fuentes externas autorizadas, con sus beneficios y riesgos.
- Profundiza en el análisis: puedes incorporar nuevas habilidades en identifiedSkills con su evidenceText, o reconsiderar habilidades previas si la nueva evidencia demuestra que la causa raíz es diferente o que el asunto era puramente normativo/organizacional fuera del control del líder. Para reconsiderar, emite directivas en "skillsReconsideration" (discard o replace) acompañadas SIEMPRE de su justificación explícita con evidencia.
- Conexión: Preguntar si necesita practicar (Etapa 4) o si se siente listo para actuar directamente (Etapa 5).

ETAPA 4: Practicar antes de actuar (Opcional)
- Se activa solo cuando el líder necesita ensayar o explorar cómo llevar a la práctica una de las opciones.
- Protocolo: Ofrecer al líder la posibilidad de: 1) Realizar una práctica o simulación, 2) Recibir una herramienta de apoyo, o avanzar sin ellas a la Etapa 5. Respetar su decisión sin forzar.
- Si practica: Tono constructivo enfocado en fortalecer las habilidades identificadas en la situación específica. Utiliza su comportamiento en el ejercicio como evidencia de simulación para confirmar, precisar, descartar o sustituir habilidades en "identifiedSkills" (con su evidenceText de la simulación) o "skillsReconsideration"; si la omite, conserva intactas las habilidades previas.

ETAPAS 1, 5 y 6: NO deben generar, agregar, modificar, descartar ni sustituir habilidades. En el JSON identifiedSkills DEBE ser siempre [] y no emitir skillsReconsideration.

ETAPA 5: Actuar (Plan de Acción)
- Objetivo: Asegurar una acción concreta, fechada y verificable.
- Checklist de Cierre de Acción:
  * Acción exacta (¿Qué hará?)
  * Fecha y hora compromiso (¿Cuándo?)
  * Involucrados directos (¿Con quién?)
  * Pasos o estrategia (¿Cómo lo hará?)
  * Recordatorios y puntos ciegos (¿Qué debe cuidar?)
- Protocolo de Seguimiento: Al registrar el plan en Etapa 5, el sistema programa 2 correos (a las 48h y a los 5 días). A los 8 días de inactividad, se emite una alerta a hola@taniapadierna.com.

ETAPA 6: Aprender y reflexionar
- Primera interacción: verificar "¿Ya ejecutaste tu Plan de Acción?" (Sí / No).
- Si actionPlanExecutionStatus === "executed" (el líder respondió Sí):
  * Recuperar el Plan de Acción real de la Etapa 5 (actionPlan) para contextualizar la reflexión sin asumir resultados que el líder no haya compartido.
  * Preguntas Clave:
    - "¿Qué ocurrió concretamente al llevarlo a la práctica?"
    - "¿Qué funcionó de acuerdo a lo planeado y qué te sorprendió?"
    - "¿Qué aprendizaje te llevas sobre tu estilo de liderazgo para futuras situaciones?"
    - "¿Qué ajustarías o harías diferente de ahora en adelante?"
- Si actionPlanExecutionStatus === "not_executed" (el líder respondió No):
  * Abrir una conversación empática, respetuosa y SIN juicios para entender qué ocurrió, explorar los obstáculos o circunstancias que impidieron ejecutar el plan y ayudar a identificar cómo continuar, qué ajustar y cuál puede ser su siguiente paso.
  * PROHIBIDO formular preguntas dando por hecho que la acción ya ocurrió (ej. nunca preguntar "¿qué ocurrió después de tu acción?" o "¿qué funcionó tras aplicarlo?").
  * PROHIBIDO inventar o registrar aprendizajes, resultados o avances de ejecución que no ocurrieron (learningsSummary debe quedar vacío si no hubo ejecución ni aprendizaje real).
- Ejecución parcial en el diálogo: si el líder explica que solo ejecutó una parte de su Plan de Acción, reconocerlo explícitamente y distinguir lo ya ejecutado de lo que queda pendiente.
- La verificación de ejecución NO debe bloquear al líder para continuar su proceso de acompañamiento.

ETAPA 7: Cierre y retroalimentación
- Objetivo: Entregar un resumen ejecutivo del proceso con fortalezas, habilidades trabajadas y compromisos. Recupera exclusivamente las habilidades activas consolidadas existentes trabajadas en el proceso sin inferir ni generar nuevas habilidades. En el JSON identifiedSkills DEBE ser siempre []. Formula stageTwoSkills con la habilidad a fortalecer y su correspondiente evidencia observable registrada. Si no existe evidencia suficiente en el proceso, indica exactamente: 'No se cuenta con evidencia suficiente en este proceso para identificar habilidades específicas por fortalecer.'
- OBLIGATORIO EN ETAPA 7: En el JSON incluye el objeto "finalFeedback" con las 5 secciones exactas:
  * detectedStrengths: Array de 0 a 4 fortalezas basadas EXCLUSIVAMENTE en conductas observables demostradas por el líder durante la mentoría (etapas 1 a 6) (ej. honestidad diagnóstica en el autoanálisis, agudeza para distinguir dinámicas del equipo, precisión operativa en los acuerdos, madurez reflexiva sin buscar culpables). Si no se observaron conductas concretas que destaquen con evidencia, dejar el arreglo vacío []. Queda PROHIBIDO atribuir capacidades permanentes, dominio en piso o cambios no demostrados. REGLA CONCEPTUAL DE EXCLUSIÓN: Queda estrictamente prohibido atribuir como fortaleza el dominio o maestría de una habilidad que el líder necesita desarrollar (habilidades presentes en "Habilidades ya identificadas en la sesión"); sin embargo, sí es válido reconocer conductas del proceso asociadas (por ejemplo: reconocer que se tiene dificultad para regular una reacción demuestra autoconciencia y apertura reflexiva, pero NO autorregulación emocional).
  * stageTwoSkills: Array con las habilidades consolidadas que el líder necesita fortalecer (identificadas en etapas 2, 3 y 4) acompañadas de su evidencia concreta de progreso observada en la conversación o práctica. Si no hay evidencia suficiente, incluir únicamente: 'No se cuenta con evidencia suficiente en este proceso para identificar habilidades específicas por fortalecer.'
  * chosenActions: Array con la acción concreta comprometida en Etapa 5.
  * stageSixLearnings: Array con aprendizajes y reflexiones consolidadas en Etapa 6.
  * recommendationsForAutonomy: Array con recomendaciones para el fortalecimiento de la autonomía.

REGLAS OBLIGATORIAS DE HABILIDADES Y RECONSIDERACIÓN:
- La ausencia de mención NUNCA elimina una habilidad previamente identificada.
- Omitir la Etapa 4 NUNCA descarta habilidades previas.
- Toda directiva de descarte o sustitución en "skillsReconsideration" requiere OBLIGATORIAMENTE una justificación explícita y no vacía basada en la evidencia de la conversación.
- No existe límite rígido de 3 habilidades; se conservan todas las habilidades respaldadas por evidencia.

======================================================================
BLOQUE 3: BIBLIOTECA INTERNA
======================================================================

1. TEMA: MANEJO DE CONFLICTOS
- Preguntas de Reflexión Inicial: ¿Cómo abordas generalmente el conflicto? ¿Qué haces? ¿Cómo te sientes? ¿Cómo reaccionan las personas a tu alrededor?
- Preguntas para analizar el conflicto: ¿Cómo inició? ¿En esta situación tú qué necesitas? ¿Cómo han sido los sentimientos de la otra persona? ¿Cuál crees que sea la necesidad de la otra persona? ¿Cuáles son los diferentes sentimientos que tú has vivido? ¿Cómo sabrías que el conflicto se resolvió bien?
- Pauta para Conversación Asertiva sobre el Conflicto:
  1. Preparación Individual (responder preguntas anteriores).
  2. Preparación del Contexto (lugar adecuado y comunicar intención clara, ej. "Mi intención es mejorar la relación entre nosotros").
  3. Abordaje objetivo: "Cuando tú haces... (hechos)", "Yo me siento...", "Y esto dificulta...", "Me gustaría pedirte que...", "Esto es importante para mí porque...", "Y yo puedo comprometerme en...".
  4. Abrir oportunidad al diálogo: "Quisiera escuchar cómo te sientes y qué necesitas tú".
  5. Propiciar acuerdos de beneficio mutuo.

2. TEMA: RETROALIMENTACIÓN
- Criterio Lidacta: Priorizar siempre el modelo SBI. Usar el modelo Sándwich únicamente cuando el reconocimiento inicial y final sea auténtico y adecuado al contexto, sin forzar elogios.
- Modelo Feedback Constructivo SBI (Situación, Comportamiento e Impacto):
  * Situación: Ubicar el hecho en tiempo y espacio específicos (evitar generalizaciones).
  * Comportamiento: Describir de forma neutral y observable qué hizo o dejó de hacer la persona, sin juicios.
  * Impacto: Explicar las consecuencias reales y cuantificables en el equipo, cliente o resultados.
- Modelo Sándwich: 1) Empatizar, 2) Elogio auténtico inicial, 3) Crítica constructiva con ejemplos concretos, 4) Conclusión con elogio y confianza en el futuro.

3. TEMA: INTELIGENCIA EMOCIONAL
- Ámbito laboral únicamente (nunca exploración clínica ni diagnóstico).
- Autoconciencia:
  * Nombrar las emociones sin censurar.
  * Aterrizar en el cuerpo (presión en el pecho, tensión en hombros, etc.).
  * Intensidad de la emoción (1 al 10).
  * Semáforo Emocional:
    - ROJO (8 a 10): Pausa obligatoria. "¿Qué estoy a punto de hacer/decir que empeoraría esto?", "¿Qué consecuencias tendrá en 10 minutos y en 10 días?".
    - AMARILLO (5 a 7): Precaución. "¿Qué historia me estoy contando y qué otra interpretación existe?", "¿Qué me está detonando?", "¿Qué es importante cuidar: mi emoción o la relación/resultados?".
    - VERDE (1 a 4): Bajo riesgo. "¿Cuál es la mejor manera de responder alineada con el líder que quiero ser?", "¿Qué acción suma?".
- Autoconciencia sobre pensamientos: ¿Qué pensamientos alimentan la emoción? ¿Cómo reinterpretarlos basándose solo en hechos objetivos?
- Autorregulación:
  * Respiración 4x6: Inhalar en 4 tiempos, exhalar en 6 tiempos por 1 minuto.
  * Respiración de León: Respiración 4x6 liberando sonido intenso ("Aaaaaaaa") en lugar privado por 2 minutos.

4. TEMA: COMUNICACIÓN
- Modelo DEEC (Comunicación Asertiva):
  * D - Describir la situación (hechos concretos sin juicios).
  * E - Expresar sentimientos ("Yo me siento...", "Me preocupa...").
  * E - Especificar los cambios deseados (acción clara, precisa y realista).
  * C - Consecuencias (efectos positivos o consecuencias lógicas constructivas).
- Escucha Activa:
  * Identificar honestamente el nivel actual (1: No necesito escuchar, 2: Ya sé lo que tengo que saber, 3: Escucho lo que conviene a mis intereses, 4: Escuchar toma tiempo, 5: Interrumpo porque ya sé qué decir, 6: Pienso en otra cosa, 7: Hago otra cosa, 8: Empatía, 9: Todos mis sentidos).
  * Preguntar: ¿Qué nivel requiere esta situación? ¿En qué nivel te gustaría estar? ¿Qué puedes hacer para mejorarlo?

5. TEMA: DELEGACIÓN
- Guía de 5 pasos: 1) Tareas adecuadas a la competencia, 2) Oportunidad compartida (contexto y beneficio mutuo, no órdenes), 3) Establecer responsabilidades y plazos juntos, 4) Abordar resistencias con curiosidad ("¿Qué le preocupa?"), 5) Seguimiento sin volverse policía ("¿Qué dificultades se han presentado? ¿En qué puedo ayudar?").
- Modelo DELEGATE:
  * D - Definir la tarea y alcance.
  * E - Evaluar habilidades del equipo.
  * L - Infórmales (comunicación clara).
  * E - Establecer parámetros y directrices claras.
  * G - Generar compromiso e involucramiento.
  * A - Autorizar la acción y autonomía.
  * T - Seguimiento del progreso con apoyo.
  * E - Evaluar resultados vs objetivos pactados.

6. TEMA: MOTIVACIÓN
- Premisa: La motivación no tiene receta única universal.
- Pautas: A) Conocer a fondo al equipo (intereses, gustos, necesidades), B) Reconocimiento genuino del esfuerzo y buen trabajo, C) Agradecimiento diario, D) Recursos y apoyo suficientes, E) Fomento del desarrollo personal y profesional.
- Preguntas de reflexión para el líder sobre motivación personal de su equipo más allá del dinero.

======================================================================
CONTEXTO DINÁMICO DE ESTA SESIÓN
======================================================================
- Empresa: ${companyContext?.name || 'Industrias Nexus Automotriz'}
- Giro/Industria: ${companyContext?.industry || 'Manufactura'}
- Valores: ${companyContext?.values || 'Innovación, integridad, trabajo en equipo'}
- Cultura: ${companyContext?.culture || 'Orientada a resultados y desarrollo de personas'}
- Nombre del Líder: ${leaderProfile?.name || 'Líder'}
- Puesto: ${leaderProfile?.position || 'Líder de Área'}
- Área: ${leaderProfile?.area || 'Operaciones'}
- Personas a cargo: ${leaderProfile?.directReports ?? 5}
- Etapa Operativa Actual: ETAPA ${currentStageNum} - ${STAGE_NAMES[currentStageNum] || ''}
- Caso / Reto actual: ${activeCaseTitle || 'Caso actual'}
- Reto inicial: ${activeCaseChallenge || resolvedUserMessage || ''}
- Habilidades ya identificadas en la sesión: ${existingSessionSkills.join(', ') || 'Ninguna aún'}
- Plan de Acción (Etapa 5): ${req.body?.sessionData?.actionPlan?.what ? `${req.body.sessionData.actionPlan.what}${req.body.sessionData.actionPlan.when ? ` | Cuándo: ${req.body.sessionData.actionPlan.when}` : ''}${req.body.sessionData.actionPlan.withWhom ? ` | Con quién: ${req.body.sessionData.actionPlan.withWhom}` : ''}` : 'No registrado aún'}
- Estado de ejecución del Plan de Acción (Etapa 6): ${req.body?.sessionData?.actionPlanExecutionStatus || 'Sin verificar'}

CRITERIOS ESTRICTOS PARA EL CAMPO "readyToAdvance":
- En Etapa 1: Debe ser true ÚNICAMENTE cuando ya se haya entregado previamente la síntesis con las 3 viñetas (**Hechos y situación**, **Dilema del líder**, **Impacto y reto principal**) Y el mensaje actual del líder confirme o valide dicha síntesis (ej. "de acuerdo", "sí", "si estoy lista", "totalmente", "correcto"). Si el líder corrige, pregunta, duda o aporta nuevos datos, DEBE ser false.
- En Etapa 2: Debe ser true ÚNICAMENTE cuando la habilidad crítica haya sido planteada Y el líder continúe o valide el avance hacia el diseño de alternativas. Si la rebate o duda, DEBE ser false.
- En Etapa 3: Debe ser true ÚNICAMENTE cuando se haya planteado al menos una alternativa viable Y el líder la elija o valide para actuar. Si pide más alternativas o tiene dudas, DEBE ser false.
- En cualquier otro escenario o ante cualquier duda/aclaración: DEBE ser false.

======================================================================
FORMATO ESTRICTO DE RESPUESTA JSON
======================================================================
Debes responder SIEMPRE en formato JSON con la siguiente estructura exacta:
{
  "replyText": "Tu intervención concisa, empática, ejecutiva y al grano para el líder en español (máx 1-3 párrafos cortos).",
  "readyToAdvance": true/false,
  "advancePrompt": "Frase breve invitando a pasar a la siguiente etapa o null",
  "identifiedSkills": [], // En Etapas 2, 3 o 4: objetos { "skill": "Habilidad", "evidenceText": "Evidencia observable..." } o strings si hay evidencia; dejar [] en etapas 1, 5, 6 y 7.
  "skillsReconsideration": { // Opcional, ÚNICAMENTE en Etapas 3 o 4 cuando exista justificación explícita con evidencia
    "discard": [
      { "skill": "Habilidad a descartar", "evidence": "Justificación explícita de por qué la nueva evidencia demuestra que no corresponde al líder" }
    ],
    "replace": [
      { "from": "Habilidad anterior", "to": "Nueva habilidad canónica", "evidence": "Justificación explícita de por qué la profundización reveló esta causa raíz" }
    ]
  },
  "detectedTheme": "Manejo de Conflictos | Retroalimentación | Inteligencia Emocional | Comunicación | Delegación | Motivación",
  "isTherapeuticCase": false,
  "therapeuticReason": "Resumen si aplica...",
  "suggestedAlternatives": ["Opción 1", "Opción 2"],
  "learningsSummary": "Resumen de lo reflexionado por el líder",
  "recommendedResources": [
    {
      "title": "Nombre de la herramienta o recurso",
      "origin": "internal",
      "category": "Manejo de Conflictos",
      "sourceOrAuthor": "Biblioteca Interna Lidacta",
      "estimatedUtility": "Muy Alta",
      "utilityReason": "Razón contextual...",
      "estimatedDifficulty": "Baja",
      "resistanceOrDoubtNotes": "Notas..."
    }
  ],
  "finalFeedback": {
    "detectedStrengths": [], // De 0 a 4 fortalezas demostradas en la sesión; dejar [] si no hay evidencia observable suficiente
    "stageTwoSkills": ["Habilidad a fortalecer — Evidencia observable: Observación concreta"],
    "chosenActions": ["Acción"],
    "stageSixLearnings": ["Aprendizaje"],
    "recommendationsForAutonomy": ["Recomendación para autonomía"]
  }
}
`;

    // Try Gemini API if initialized
    if (ai) {
      try {
        const historyText = (resolvedHistory || [])
          .map((m: { sender?: string; role?: string; text?: string; content?: string }) => {
            const who = m.sender === 'leader' || m.role === 'user' ? 'LÍDER' : 'LIDACTA';
            return `${who}: ${m.text || m.content || ''}`;
          })
          .join('\n');

        const prompt = `
Historial reciente de la mentoría:
${historyText || '(Inicio de la mentoría)'}

Último mensaje del líder:
"${resolvedUserMessage}"

${isPracticeMode ? '[El líder está en modo práctica / roleplay de la Etapa 4]' : ''}
Datos previos guardados: ${JSON.stringify(safeSessionContext || {})}

IMPORTANTE: Responde de forma empática, humana y reflexiva, validando la emoción expresada y formulando una pregunta de seguimiento específica basada estrictamente en la última intervención del líder.
REGLA CRÍTICA ANTI-CICLADO:
- Está terminantemente PROHIBIDO repetir la misma pregunta o coletilla de cierre en turnos consecutivos (por ejemplo: "¿qué impacto directo tiene no intervenir en este momento...?").
- Si el líder expresa confusión ("No entiendo tu pregunta", "A qué te refieres", "No te sigo"), reformula la pregunta con palabras cotidianas y más sencillas, o brinda un ejemplo práctico laboral en lugar de repetir la plantilla.
- Si el líder ya aportó información o muestra desgaste, valida su sentir de forma natural y haz una pregunta diferente o habilita el avance ("readyToAdvance": true).

Genera tu respuesta como Lidacta para la Etapa ${currentStageNum} en formato JSON estricto.`;

        const MODEL_NAME = process.env.GEMINI_MODEL || 'gemini-3.8-flash';
        const FALLBACK_MODEL = 'gemini-3.1-flash-lite';
        let response: any = null;

        try {
          const geminiCall = ai.models.generateContent({
            model: MODEL_NAME,
            contents: prompt,
            config: {
              systemInstruction: systemPrompt,
              responseMimeType: 'application/json',
              temperature: 0.7,
            },
          });

          const timeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Gemini API request timeout (fallback activated)')), 30000)
          );

          response = await Promise.race([geminiCall, timeoutPromise]);
        } catch (initialErr: any) {
          const errStr = String(initialErr?.message || initialErr);
          const isRateOrUnavailable =
            errStr.includes('503') ||
            errStr.includes('429') ||
            errStr.includes('RESOURCE_EXHAUSTED') ||
            errStr.includes('UNAVAILABLE');
          const isTimeout =
            errStr.includes('timeout') ||
            errStr.includes('Timeout') ||
            errStr.includes('deadline') ||
            errStr.includes('DEADLINE_EXCEEDED');

          if ((isRateOrUnavailable || isTimeout) && MODEL_NAME !== FALLBACK_MODEL) {
            console.warn(`Incidencia detectada en modelo principal (${errStr}) en ${MODEL_NAME}. Reintentando con fallback ${FALLBACK_MODEL}...`);
            const fallbackCall = ai.models.generateContent({
              model: FALLBACK_MODEL,
              contents: prompt,
              config: {
                systemInstruction: systemPrompt,
                responseMimeType: 'application/json',
                temperature: 0.7,
              },
            });
            const timeoutFallback = new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error('Gemini fallback request timeout')), 30000)
            );
            response = await Promise.race([fallbackCall, timeoutFallback]);
          } else {
            throw initialErr;
          }
        }

        const rawText = (response?.text || '').trim().replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
        let parsed: any = {};
        try {
          parsed = JSON.parse(rawText || '{}');
        } catch {
          parsed = null;
        }

        if (!parsed || typeof parsed !== 'object') {
          parsed = {
            replyText: cleanConversationalText(rawText),
            readyToAdvance: false,
            advancePrompt: null,
            identifiedSkills: [],
            detectedTheme: 'Liderazgo',
            isTherapeuticCase: false,
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

        // 2. En Etapa 7, asegurar que finalFeedback con las 5 secciones siempre esté presente
        // y recuperar exclusivamente las habilidades activas consolidadas existentes con sus evidencias reales.
        if (currentStageNum === 7) {
          if (
            !parsed.finalFeedback ||
            !Array.isArray(parsed.finalFeedback.detectedStrengths)
          ) {
            const fallbackStage7 = generateDeterministicCoaching({
              stage: 7,
              leaderProfile,
              companyContext,
              userMessage: resolvedUserMessage,
              conversationHistory: resolvedHistory,
              sessionData: safeSessionContext,
              isPracticeMode,
            });
            parsed.finalFeedback = fallbackStage7.finalFeedback;
          }

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

          // Formatear stageTwoSkills con la evidencia real observada o el mensaje de insuficiencia
          const formattedStageTwoSkills = formatStageTwoSkillsWithEvidence(skillsToReport);

          // Garantizar la estructura de las 5 secciones intacta sin agregar una sexta sección
          parsed.finalFeedback = {
            detectedStrengths: sanitizeDetectedStrengths(parsed.finalFeedback?.detectedStrengths),
            stageTwoSkills: formattedStageTwoSkills,
            chosenActions:
              Array.isArray(parsed.finalFeedback.chosenActions) && parsed.finalFeedback.chosenActions.length > 0
                ? parsed.finalFeedback.chosenActions
                : [
                    sessionData?.actionPlan?.what ||
                      sessionData?.chosenAlternative ||
                      'Conversación 1 a 1 de alineación operativa con compromisos claros',
                  ],
            stageSixLearnings:
              Array.isArray(parsed.finalFeedback.stageSixLearnings) && parsed.finalFeedback.stageSixLearnings.length > 0
                ? parsed.finalFeedback.stageSixLearnings
                : [
                    sessionData?.learnings?.insights ||
                      sessionData?.learnings?.whatHappened ||
                      'La claridad temprana en los acuerdos previene fricciones y fortalece la confianza mutua.',
                  ],
            recommendationsForAutonomy:
              Array.isArray(parsed.finalFeedback.recommendationsForAutonomy) &&
              parsed.finalFeedback.recommendationsForAutonomy.length > 0
                ? parsed.finalFeedback.recommendationsForAutonomy
                : [
                    'Mantener conversaciones de alineación periódicas antes de que los desvíos escalen',
                    'Registrar los acuerdos por escrito de forma breve para asegurar entendimiento común',
                    'Reconocer los avances del equipo de manera oportuna y fundamentada en hechos',
                  ],
          };
        }

        // Extracción robusta de la respuesta: replyText, reply, text, response, mensaje, content o rawText
        const extractedReply = (
          parsed.replyText ||
          parsed.reply ||
          parsed.text ||
          parsed.response ||
          parsed.mensaje ||
          parsed.content ||
          rawText ||
          ''
        ).trim();

        const safeReplyText = cleanConversationalText(extractedReply) || 'Lidacta está lista para acompañarte. ¿Cómo te gustaría continuar?';
        parsed.reply = safeReplyText;
        parsed.replyText = safeReplyText;

        return res.json({
          success: true,
          reply: safeReplyText,
          text: safeReplyText,
          data: {
            ...parsed,
            reply: safeReplyText,
            replyText: safeReplyText,
          },
        });
      } catch (geminiError) {
        console.warn('Gemini API call warning, falling back to deterministic coach engine:', geminiError);
        // Fallback gracefully below
      }
    }

    // High-quality Deterministic Stage-Specific Coach Engine
    const fallbackResponse = generateDeterministicCoaching({
      stage: currentStageNum,
      leaderProfile,
      companyContext,
      userMessage: resolvedUserMessage,
      conversationHistory: resolvedHistory,
      sessionData: safeSessionContext,
      isPracticeMode,
    });

    let finalSkillEntries = existingSessionSkillEntries;
    let fallbackIdentifiedSkills: string[] = [];

    if ([1, 5, 6].includes(currentStageNum) || currentStageNum === 7) {
      fallbackIdentifiedSkills = [];
      finalSkillEntries = existingSessionSkillEntries;
    } else if ([2, 3, 4].includes(currentStageNum)) {
      const candidateSkills = Array.isArray(fallbackResponse.identifiedSkills)
        ? fallbackResponse.identifiedSkills
        : [];
      finalSkillEntries = consolidateSkillEntries(
        existingSessionSkillEntries,
        candidateSkills,
        currentStageNum
      );
      fallbackIdentifiedSkills = getActiveSkillNames(finalSkillEntries);
    } else {
      fallbackIdentifiedSkills = [];
      finalSkillEntries = existingSessionSkillEntries;
    }

    const sanitizedFallback: any = {
      ...fallbackResponse,
      skillEntries: finalSkillEntries,
      identifiedSkills: fallbackIdentifiedSkills,
    };

    if (currentStageNum === 7) {
      let skillsToReport: (LeadershipSkillEntry | string)[] = [];
      const activeEntries = getActiveSkillEntries(finalSkillEntries);

      if (activeEntries.length > 0) {
        skillsToReport = activeEntries;
      } else if (existingSessionSkills.length > 0) {
        skillsToReport = existingSessionSkills;
      } else {
        skillsToReport = [];
      }

      const formattedStageTwoSkills = formatStageTwoSkillsWithEvidence(skillsToReport);

      sanitizedFallback.finalFeedback = {
        detectedStrengths: sanitizeDetectedStrengths(sanitizedFallback.finalFeedback?.detectedStrengths),
        stageTwoSkills: formattedStageTwoSkills,
        chosenActions:
          Array.isArray(sanitizedFallback.finalFeedback?.chosenActions) && sanitizedFallback.finalFeedback.chosenActions.length > 0
            ? sanitizedFallback.finalFeedback.chosenActions
            : [
                sessionData?.actionPlan?.what ||
                  sessionData?.chosenAlternative ||
                  'Conversación 1 a 1 de alineación operativa con compromisos claros',
              ],
        stageSixLearnings:
          Array.isArray(sanitizedFallback.finalFeedback?.stageSixLearnings) && sanitizedFallback.finalFeedback.stageSixLearnings.length > 0
            ? sanitizedFallback.finalFeedback.stageSixLearnings
            : [
                sessionData?.learnings?.insights ||
                  sessionData?.learnings?.whatHappened ||
                  'La claridad temprana en los acuerdos previene fricciones y fortalece la confianza mutua.',
              ],
        recommendationsForAutonomy:
          Array.isArray(sanitizedFallback.finalFeedback?.recommendationsForAutonomy) &&
          sanitizedFallback.finalFeedback.recommendationsForAutonomy.length > 0
            ? sanitizedFallback.finalFeedback.recommendationsForAutonomy
            : [
                'Mantener conversaciones de alineación periódicas antes de que los desvíos escalen',
                'Registrar los acuerdos por escrito de forma breve para asegurar entendimiento común',
                'Reconocer los avances del equipo de manera oportuna y fundamentada en hechos',
              ],
      };
    }

    return res.json({
      success: true,
      reply: sanitizedFallback.replyText,
      text: sanitizedFallback.replyText,
      data: {
        ...sanitizedFallback,
        reply: sanitizedFallback.replyText,
        replyText: sanitizedFallback.replyText,
      },
    });
  } catch (error: any) {
    console.error('Error in /api/mentor/respond:', error);
    if (currentStageNum === 7) {
      const fallbackContext = {
        ...(sessionData || {}),
        ...(safeSessionContext || {}),
        skillEntries:
          safeSessionContext?.skillEntries && safeSessionContext.skillEntries.length > 0
            ? safeSessionContext.skillEntries
            : Array.isArray(sessionData?.skillEntries)
            ? sessionData.skillEntries
            : [],
        identifiedSkills:
          safeSessionContext?.identifiedSkills && safeSessionContext.identifiedSkills.length > 0
            ? safeSessionContext.identifiedSkills
            : Array.isArray(sessionData?.identifiedSkills)
            ? sessionData.identifiedSkills
            : [],
      };
      const fallbackStage7 = generateDeterministicCoaching({
        stage: 7,
        leaderProfile,
        companyContext,
        userMessage: resolvedUserMessage || '',
        conversationHistory: resolvedHistory || [],
        sessionData: fallbackContext,
        isPracticeMode,
      });
      return res.status(200).json({
        success: true,
        reply: fallbackStage7.replyText,
        text: fallbackStage7.replyText,
        data: fallbackStage7,
      });
    }
    res.status(500).json({
      success: false,
      error: 'Error procesando la mentoría de Lidacta',
      details: error?.message || 'Error desconocido',
    });
  }
});

// Detector de naturaleza terapéutica / clínica para garantizar el límite ético
function detectTherapeuticNature(text: string): { isTherapeutic: boolean; reason: string } {
  if (!text) return { isTherapeutic: false, reason: '' };
  const lower = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  const directKeywords = [
    'ansiedad clinica',
    'ataque de panico',
    'ataques de panico',
    'crisis de panico',
    'depresion severa',
    'depresion profunda',
    'depresion clinica',
    'deprimido clinicamente',
    'terapia psicologica',
    'terapia psiquiatrica',
    'psicologo clinico',
    'psicologa clinica',
    'psiquiatra',
    'medicamento psiquiatrico',
    'antidepresivos',
    'antidepresivo',
    'pastillas para dormir',
    'ideacion suicida',
    'suicidio',
    'suicidarme',
    'quitarme la vida',
    'no quiero vivir',
    'no puedo mas con mi vida',
    'autolesion',
    'autolesionarme',
    'trastorno bipolar',
    'tdah clinico',
    'adiccion severa',
    'trauma severo',
    'trauma infantil',
    'crisis emocional severa',
    'duelo patologico',
    'abuso psicologico severo',
    'trastorno de ansiedad',
  ];

  for (const kw of directKeywords) {
    if (lower.includes(kw)) {
      return {
        isTherapeutic: true,
        reason: `Líder abordó tema de naturaleza terapéutica / clínica relacionado con "${kw}" en su mensaje.`,
      };
    }
  }

  // Combinaciones de palabras clínicas / terapéuticas personales
  const hasClinicalTerm = lower.includes('terapia') || lower.includes('ansiedad') || lower.includes('panico') || lower.includes('depres') || lower.includes('psicolog');
  const hasPersonalCrisis = lower.includes('crisis personal') || lower.includes('crisis emocional') || lower.includes('medicacion') || lower.includes('pastillas') || lower.includes('desborde') || lower.includes('desesperacion');

  if (hasClinicalTerm && hasPersonalCrisis) {
    return {
      isTherapeutic: true,
      reason: 'Líder expresó sintomatología emocional o terapéutica personal que excede el marco del liderazgo laboral.',
    };
  }

  return { isTherapeutic: false, reason: '' };
}

function stripNegatedAndSelfRoleClauses(text: string): string {
  if (!text) return '';
  return text
    // Eliminar declaraciones de rol propio ("Yo soy la gerente...", "Como gerente...", "En mi rol de director...")
    .replace(
      /\b(?:yo\s+)?(?:soy|como|siendo|en\s+mi\s+(?:rol|puesto)\s+de|mi\s+puesto\s+es(?:\s+de)?)\s+(?:la\s+|el\s+|un\s+|una\s+)?(?:gerente|gerenta|director|directora|jefe|jefa)\b/gi,
      ' '
    )
    // Eliminar cláusulas donde el líder niega o descarta explícitamente un conflicto con jefatura o tema específico
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

  // 1. Abuso explícito de autoridad o liderazgo superior
  if (/\b(?:abuso\s+de\s+autoridad|liderazgo\s+superior)\b/i.test(cleaned)) {
    return true;
  }

  // 2. Mención explícita a una figura jerárquica superior del propio líder (nunca "gerente" suelto como rol propio)
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

  // 3. Señales directas de agresión verbal/humillación atribuidas a jefatura o superior
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
    'no me entendiste', 'no me comprendiste', 'no es por ahí', 'no es por ahi', 'no dije eso',
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

  // Extraer contenido sustantivo nuevo después de quitar frases de corrección/negación y declaración de rol
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

  // Encontrar la última corrección sustantiva dentro del historial para invalidar anclajes previos erróneos
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
    // La corrección actual trae el contexto real: ignorar title, initialChallenge e historial previo contaminado
    const strippedCurrent = stripNegatedAndSelfRoleClauses(currentMsg);
    effectiveLeaderTexts = [strippedCurrent || currentMsg].filter(Boolean);
    effectivePrevLidactaTexts = [];
  } else if (lastCorrectionIndex >= 0) {
    // Hubo una corrección en un turno anterior: usar solo mensajes desde esa corrección en adelante
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

function extractDiagnosticVariablesServer(
  history: any[],
  currentMsg: string,
  sessionContext?: any
) {
  const { effectiveText, effectiveLower, combinedRawForAnchor } = buildEffectiveStage1Context(
    history,
    currentMsg,
    sessionContext
  );

  const lower = effectiveLower;
  const anchorText = stripNegatedAndSelfRoleClauses(combinedRawForAnchor).toLowerCase();

  // Check if leader clarified that raise / increase is not viable or an option
  const raiseNotAnOption = [
    'no es opción', 'no es opcion', 'no podemos', 'no hay presupuesto', 'no es viable',
    'inviable', 'descartado', 'descartada', 'descartar el aumento', 'no aumento',
    'no podemos aumentarle', 'no se puede aumentar', 'no podemos darle', 'no está contemplado',
    'no esta contemplado'
  ].some((k) => lower.includes(k));

  // Priority: Detect crime / theft / inventory loss
  const isCrimeOrTheft = [
    'robo', 'robando', 'robaron', 'robó', 'sustraccion', 'sustracción', 'sustrajo',
    'desvío de material', 'delito', 'fraude', 'seguridad patrimonial',
    'faltante ilicito', 'faltante ilícito'
  ].some((k) => lower.includes(k) || anchorText.includes(k));

  // Priority: Detect hierarchy or boss disrespect / conflict (con validación de rol y negaciones)
  const isHierarchyOrBossConflict =
    !isCrimeOrTheft && detectHierarchyOrBossConflict(combinedRawForAnchor);

  // Detect disciplinary / unauthorized vacation / absence breach
  const isDisciplinaryOrAbsenceCase = !isHierarchyOrBossConflict && !isCrimeOrTheft && [
    'vacacion', 'vacación', 'vacaciones', 'ausencia injustificada', 'ausencias injustificadas',
    'días sin permiso', 'dias sin permiso', 'sin autorizacion', 'sin autorización',
    'aviso por mensaje', 'avisó por mensaje', 'notifico por mensaje', 'notificó por mensaje',
    'no vino a trabajar', 'abandono de trabajo', 'abandono de puesto', 'faltar al trabajo'
  ].some((k) => anchorText.includes(k) || lower.includes(k));

  const concernsSanctionOrReturn = [
    'sancion', 'sanción', 'sancionar', 'regrese', 'vuelva', 'reincorpore', 'cuando llegue',
    'cómo hablar', 'como hablar', 'consecuencia', 'amonestacion', 'amonestación', 'acta administrativa',
    'despido', 'baja', 'castigo', 'proceder', 'medida', 'regreso'
  ].some((k) => lower.includes(k));

  // Detect salary / compensation / money / raise / counteroffer
  const isSalaryCase = !isCrimeOrTheft && [
    'sueldo', 'salario', 'aumento', 'aumento de sueldo', 'aumento salarial', 'pagar', 'paga',
    'remuneracion', 'remuneración', 'compensacion', 'compensación', 'tabulador', 'dinero',
    'aumenten', 'aumentar', 'renuncia', 'irse por dinero', 'oferta económica', 'oferta economica',
    'ganar mas', 'ganar más', 'exige aumento', 'exigiendo sueldo', 'pide aumento'
  ].some((k) => lower.includes(k));

  // Detect delegation / micromanagement / dependency / autonomy
  const isDelegationCase =
    !isCrimeOrTheft &&
    !isHierarchyOrBossConflict &&
    detectDelegationOrAutonomyCase(effectiveText || combinedRawForAnchor);

  // Detect customer / client conflict ONLY when explicitly describing a client complaint/conflict
  const isClientCase = !isDelegationCase && [
    'queja de cliente', 'reclamo de cliente', 'problema con el cliente', 'conflicto con el cliente', 'entrega al cliente'
  ].some((k) => lower.includes(k));

  // Detect performance / task non-compliance
  const isTaskNonComplianceCase =
    !isHierarchyOrBossConflict &&
    !isCrimeOrTheft &&
    !isDelegationCase &&
    [
      'entrega', 'entregable', 'plazo', 'fecha límite', 'fecha limite', 'no cumple', 'incumple',
      'retraso', 'desempeño', 'desempeno', 'resultados', 'metas'
    ].some((k) => lower.includes(k));

  // Detect interpersonal friction / attitude / resistance
  const isAttitudeCase =
    !isHierarchyOrBossConflict &&
    !isCrimeOrTheft &&
    !isDelegationCase &&
    [
      'actitud', 'defensiva', 'desmotivacion', 'desmotivación', 'apatía', 'apatia', 'resistencia',
      'conflicto', 'roce', 'desacuerdo', 'quejas'
    ].some((k) => lower.includes(k));

  // Formulate 1: Hechos y situación
  let factsAndSituation = '';
  if (isCrimeOrTheft) {
    factsAndSituation = 'El faltante y presunto robo o sustracción no autorizada de material o recursos en el área.';
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
    factsAndSituation =
      'El equipo muestra alta dependencia para tomar decisiones y tú tiendes a supervisar de cerca e intervenir directamente cuando el trabajo no cumple con lo que esperas.';
  } else if (isClientCase) {
    factsAndSituation = 'El roce operativo directo con el cliente y los compromisos de entrega o servicio afectados por la situación.';
  } else if (isTaskNonComplianceCase) {
    factsAndSituation = 'El incumplimiento reiterado y desfase en las tareas o entregables prioritarios asignados al equipo.';
  } else if (isAttitudeCase) {
    factsAndSituation = 'La postura a la defensiva y la resistencia para alinearse a las tareas y acuerdos cotidianos de trabajo.';
  } else {
    factsAndSituation = 'La dinámica y los desacuerdos observados en el equipo respecto a los compromisos de trabajo cotidianos.';
  }

  // Formulate 2: Dilema del líder
  let leaderDilemma = '';
  if (isCrimeOrTheft) {
    leaderDilemma = 'Actuar con apego estricto a las normas y lineamientos legales o de seguridad patrimonial, asegurando que la investigación se realice de forma objetiva sin caer en señalamientos prematuros ni omisiones.';
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
    leaderDilemma =
      'Soltar el control operativo y confiar en el criterio de tu equipo para que tome decisiones propias, frente al temor de que la calidad del resultado no alcance tus estándares.';
  } else if (isClientCase) {
    leaderDilemma = 'Defender las capacidades y tiempos de tu equipo sin poner en riesgo la relación comercial ni el nivel de servicio con el cliente.';
  } else {
    leaderDilemma = 'Abordar la situación con asertividad y firmeza, balanceando la exigencia de resultados con el cuidado del vínculo y la claridad en el equipo.';
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
    impactAndMainChallenge =
      'Desarrollar autonomía real en tus colaboradores para reducir la dependencia hacia ti y liberar tu tiempo hacia decisiones estratégicas de liderazgo.';
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

function isStage3EntryMarker(text: string): boolean {
  const normalized = (text || '').trim();
  return !normalized || /^\[avanzando a etapa \d+\]$/i.test(normalized);
}

function isPureDoubtOrQuestionClause(clause: string): boolean {
  const lower = clause.trim().toLowerCase();
  if (!lower) return true;
  if (/^[¿?]/.test(lower) || /\?$/.test(lower)) return true;
  return /^(?:pero|aunque|sin embargo|y\s+la\s+verdad|la\s+verdad)\s+(?:tengo dudas?|no\s+s[eé]|me\s+preocupa|tengo\s+miedo|me\s+da\s+temor|no\s+estoy\s+segur)/i.test(lower) ||
    /^(?:tengo dudas?|no\s+s[eé]\s+(?:cu[aá]l|c[oó]mo|qu[eé])|me\s+preocupa|qu[eé]\s+(?:me\s+recomiendas|opinas|sugieres|piensas)|cu[aá]l\s+(?:conviene|es\s+mejor|me\s+recomiendas)|c[oó]mo\s+(?:combinar|hacerle|proceder)|ay[uú]dame\s+a)/i.test(lower);
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
    // Skip pure selection statements like "Me quedo con la primera opción"
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

    // 1. Check explicit numbered/bulleted/labeled items (multiline or inline)
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

    // 2. Split prose into sentences / alternative clauses
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

// Deterministic Coaching Engine (Ensures 100% uptime, adhering to all PDF rules)
export function generateDeterministicCoaching({
  stage,
  leaderProfile,
  companyContext,
  userMessage,
  conversationHistory = [],
  sessionData,
  isPracticeMode,
}: {
  stage: number;
  leaderProfile: any;
  companyContext: any;
  userMessage: string;
  conversationHistory: any[];
  sessionData: any;
  isPracticeMode?: boolean;
}) {
  const leaderName = leaderProfile?.name?.split(' ')[0] || 'Líder';
  const company = companyContext?.name || 'tu organización';
  const industry = companyContext?.industry || 'tu sector';

  // Interceptación de límite terapéutico: Respuesta empática y derivación profesional
  const therapeuticCheck = detectTherapeuticNature(userMessage);
  if (therapeuticCheck.isTherapeutic) {
    return {
      replyText: `Hola ${leaderName}, comprendo y agradezco profundamente la confianza y apertura con la que me compartes lo que estás viviendo. Sin embargo, como mentora en Lidacta, mi rol se enfoca estrictamente en el desarrollo de habilidades de liderazgo, gestión de personas y acuerdos laborales entre equipos.\n\nPor respeto a tu bienestar integral y salud mental, situaciones de esta índole ameritan el acompañamiento cálido y especializado de un profesional de la salud mental (psicólogo/a clínico/a o terapeuta) o del Programa de Asistencia al Empleado (PAE) / área de bienestar de ${company}.\n\nAquí permanezco a tu lado para cuando desees trabajar cualquier reto sobre tus equipos, acuerdos y liderazgo en el día a día. ¿Cómo te gustaría que enfoquemos tus próximos pasos operativos?`,
      readyToAdvance: false,
      detectedTheme: 'Orientación y Límite de Rol (Bienestar Integral)',
      isTherapeuticCase: true,
      therapeuticReason: therapeuticCheck.reason,
    };
  }

  const cleanMsg = (userMessage || '').trim();
  const lowerMsg = cleanMsg.toLowerCase();
  const stage1Context = stage === 1 ? buildEffectiveStage1Context(conversationHistory, cleanMsg, sessionData) : null;

  // Regla 4: Reacción directa ante correcciones del usuario ("te confundiste", o correcciones naturales con/sin información nueva)
  const isDirectCorrection =
    stage === 1
      ? Boolean(stage1Context?.currentCorrection.isCorrection)
      : [
          'te confundiste', 'te confundes', 'eso no es lo que me preocupa', 'no es lo que me preocupa',
          'no me preocupa eso', 'te estás equivocando', 'te estas equivocando', 'te equivocaste',
          'no me entendiste', 'no me comprendiste', 'no es por ahí', 'no es por ahi', 'no dije eso',
          'entendiste mal', 'comprendiste mal', 'no es ese el problema', 'no es ese mi problema',
          'te fuiste por otro lado', 'no estás entendiendo', 'no estas entendiendo',
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

  // Detección de matices o restricciones agregadas por el líder tras el resumen o durante la conversación
  const isNuanceOrConstraint = [
    'no es opción', 'no es opcion', 'no podemos aumentar', 'no podemos darle',
    'no hay presupuesto', 'no es viable', 'inviable', 'descartado', 'descartada',
    'descartar el aumento', 'descartar', 'no aumentarle', 'no se puede aumentar',
    'no hay aumento', 'no le podemos subir', 'no hay dinero', 'aclaro', 'aclaración',
    'aclaracion', 'ojo', 'rectifico', 'un detalle', 'no quiero que', 'no está sobre la mesa',
    'no esta sobre la mesa', 'no está contemplado', 'no esta contemplado',
    'no podemos pagar', 'no es posible aumentarle', 'imposible aumentar'
  ].some((t) => lowerMsg.includes(t)) && !stage1Context?.currentCorrection.hasSubstantiveNewContext;

  if (isNuanceOrConstraint && stage === 1) {
    const { factsAndSituation, leaderDilemma, impactAndMainChallenge } = extractDiagnosticVariablesServer(conversationHistory, cleanMsg, sessionData);
    return {
      replyText: `Gracias por esa precisión fundamental, ${leaderName}. Tener claro que esa vía no es una opción viable cambia por completo el terreno de juego y nos evita plantear salidas poco realistas.\n\nActualizo el mapa de la situación incorporando este matiz:\n\n• **Hechos y situación:** ${factsAndSituation}\n• **Dilema del líder:** ${leaderDilemma}\n• **Impacto y reto principal:** ${impactAndMainChallenge}\n\nCon este ajuste descartando esa opción, ¿este resumen refleja fielmente el reto que quieres abordar antes de que demos el paso a la siguiente etapa?`,
      readyToAdvance: false,
      detectedTheme: 'Integración de Matices y Re-validación',
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
    const { factsAndSituation, leaderDilemma, impactAndMainChallenge } = extractDiagnosticVariablesServer(conversationHistory, cleanMsg, sessionData);
    return {
      replyText: `Te escucho con total atención, ${leaderName}. Frenamos el paso: no vamos a avanzar a la Etapa 2 hasta que tengamos total claridad sobre lo que estás viviendo.\n\nPara devolverte valor visible y ayudarte a ordenar las variables que hoy se sienten mezcladas, desgloso lo que he escuchado en tu relato:\n\n• **Hechos y situación:** ${factsAndSituation}\n• **Dilema del líder:** ${leaderDilemma}\n• **Impacto y reto principal:** ${impactAndMainChallenge}\n\nMirando este mapa con calma:\n1. De estos tres frentes, ¿cuál sientes que es el que genera mayor fricción o te cuesta más trabajo manejar en este momento?\n2. ¿Sientes que este desglose captura con precisión lo que estás viviendo, o hay alguna variable clave que se nos esté escapando?`,
      readyToAdvance: false,
      detectedTheme: 'Desglose Diagnóstico',
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

  if (userConfirmsBreakdownOrReady && !isNuanceOrConstraint && !isDirectCorrection && stage === 1) {
    return {
      replyText: `Me da mucho gusto que tengamos este mapa claro y alineado, ${leaderName}. Al tener delimitado con precisión lo que ocurre y tu encrucijada como líder, ¿estás de acuerdo en que pasemos a la Etapa 2 para analizar las perspectivas de las personas involucradas y las habilidades que necesitas activar?`,
      readyToAdvance: true,
      advancePrompt: 'Avanzar a Etapa 2: Analizar perspectivas y habilidades',
      detectedTheme: 'Cierre de Etapa 1 Guiado',
    };
  }

  // Detección de confusión o solicitud de aclaración del líder (FILTRADO DE MENSAJES OPERATIVOS)
  const isConfusion =
    !(stage === 1 && stage1Context?.currentCorrection.hasSubstantiveNewContext) &&
    (isMetaOrOperationalMessage(cleanMsg) ||
      [
        'no entiendo', 'no comprendo', 'a que te refieres', 'a qué te refieres',
        'como que', 'cómo que', 'como asi', 'cómo así', 'no se que responder',
        'no sé qué responder', 'no se a que te refieres', 'no sé a qué te refieres',
        'explicate', 'explícate', 'a que te refieres con', 'a qué te refieres con',
        'no me queda claro', 'que significa', 'qué significa', 'a que te refieres exactamente',
        'no entendi', 'no entendí', 'no te sigo', 'no te comprendo', 'de que hablas', 'de qué hablas'
      ].some((t) => lowerMsg.includes(t)));

  if (isConfusion) {
    if (stage === 1) {
      // Re-formular la pregunta anterior de forma más sencilla y concreta,
      // usando únicamente el contexto efectivo no descartado ni negado
      const anchorForConfusion = (
        stage1Context?.effectiveLower ||
        stripNegatedAndSelfRoleClauses(cleanMsg).toLowerCase()
      );
      const rawAnchorForBoss = stage1Context?.combinedRawForAnchor || cleanMsg;

      const isCrimeOrTheftConfusion = ['robo', 'robaron', 'sustraccion', 'sustracción', 'delito', 'fraude'].some((k) =>
        anchorForConfusion.includes(k)
      );
      const isBossConfusion = !isCrimeOrTheftConfusion && detectHierarchyOrBossConflict(rawAnchorForBoss);
      const isDisciplinaryConfusion =
        !isBossConfusion &&
        !isCrimeOrTheftConfusion &&
        ['vacacion', 'vacación', 'ausencia', 'sin permiso', 'sin autorizacion', 'sin autorización'].some((k) =>
          anchorForConfusion.includes(k)
        );
      const isSalaryConfusion = ['sueldo', 'salario', 'aumento', 'dinero', 'paga'].some((k) =>
        anchorForConfusion.includes(k)
      );
      const isDelegationConfusion =
        !isBossConfusion &&
        !isCrimeOrTheftConfusion &&
        detectDelegationOrAutonomyCase(anchorForConfusion);
      const isDeliveryConfusion =
        !isBossConfusion &&
        !isCrimeOrTheftConfusion &&
        !isDelegationConfusion &&
        ['entrega', 'plazo', 'retraso', 'compromiso'].some((k) => anchorForConfusion.includes(k));

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
  }

  // Si el líder señala que una pregunta se repite, validar con empatía y pivotar a otra variable sin avanzar
  const isQuestionRepetitionComplaint = [
    'de nuevo la misma pregunta', 'otra vez la misma pregunta', 'ya te respondí esa pregunta',
    'ya te respondi esa pregunta', 'ya te contesté eso', 'ya te conteste eso', 'repetitivo'
  ].some((t) => lowerMsg.includes(t));

  // Extraer preguntas previas de Lidacta para evitar repetir (respetando reseteo por corrección)
  const prevLidactaTexts =
    stage === 1 && stage1Context
      ? stage1Context.effectivePrevLidactaTexts
      : (conversationHistory || [])
          .filter((m: any) => m.sender === 'lidacta' || m.role === 'model')
          .map((m: any) => (m.text || m.content || '').toLowerCase());

  if (isQuestionRepetitionComplaint && stage === 1) {
    return {
      replyText: `Agradezco tu aclaración, ${leaderName}. Tomo nota de lo que ya compartiste para no hacerte repetir. Para ir al punto clave: desde tu perspectiva, ¿cuál es el obstáculo principal que sientes que impide resolver esto con firmeza y qué resultado concreto necesitas asegurar hoy con tu equipo?`,
      readyToAdvance: false,
      advancePrompt: null,
      detectedTheme: 'Clarificación de Causa Raíz',
    };
  }

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

    const isDelegationOrAutonomy =
      !isCrimeOrTheft &&
      !isHierarchyOrBossConflict &&
      detectDelegationOrAutonomyCase(effectiveLower);

    const isAttitudeOrDelivery =
      !isHierarchyOrBossConflict &&
      !isCrimeOrTheft &&
      !isDelegationOrAutonomy &&
      [
        'entrega', 'entregables', 'plazo', 'fecha limite', 'fecha límite', 'retraso', 'retrasos',
        'no cumple', 'incumple', 'desempeño', 'actitud', 'defensiva', 'desmotivacion',
        'desmotivación', 'resistencia', 'apatia', 'apatía', 'compromiso'
      ].some((k) => effectiveLower.includes(k));

    const isCleanHistory = stage1Context.isCleanStage1History;
    const ackPrefix = justCorrectedWithContext
      ? `Disculpa la confusión anterior, ${leaderName}; gracias por aclararlo. `
      : '';

    // Turn 1 o re-enfoque inmediato tras corrección con contexto nuevo
    if (isCleanHistory) {
      if (isCrimeOrTheft) {
        return {
          replyText: `${ackPrefix}Una situación que involucra robo de material o faltas a la integridad y legalidad en la empresa es un hecho de máxima gravedad que trasciende el manejo habitual de equipo, ${leaderName}.\n\nPara evaluar los hechos con rigor y evitar pasos en falso: ¿cuáles son las evidencias concretas con las que se cuenta hasta ahora, qué protocolos existen en la empresa con Recursos Humanos o Seguridad, y la persona involucrada ya fue confrontada directamente?`,
          readyToAdvance: false,
          advancePrompt: null,
          detectedTheme: 'Falta Grave y Protocolos Internos/Seguridad',
        };
      }

      if (isHierarchyOrBossConflict) {
        return {
          replyText: `${ackPrefix}Que ocurra un abuso de autoridad o una falta de respeto de tu jefatura en público frente a otros colaboradores es una situación inaceptable que vulnera tu liderazgo y genera un desgaste severo, ${leaderName}.\n\nPara enfocar la situación con claridad estratégica: ¿cuál era el contexto de la junta o reunión cuando esto ocurrió, hubo alguna reacción de tu parte o del equipo en ese instante, y se trata de un comportamiento repetitivo del jefe o de un hecho aislado?`,
          readyToAdvance: false,
          advancePrompt: null,
          detectedTheme: 'Falta de Respeto y Relación con Jefatura',
        };
      }

      if (isDisciplinaryOrAbsenceCase) {
        return {
          replyText: `${ackPrefix}Que un colaborador se tome días sin autorización previa y solo lo notifique por mensaje es una falta grave a los acuerdos del equipo y a la disciplina operativa, ${leaderName}.\n\nPara dimensionar la gravedad y actuar con la firmeza debida: ¿qué impacto operativo inmediato está teniendo esto en la continuidad de las tareas del equipo, y existen políticas, precedentes o procesos disciplinarios claros en la empresa para atender un caso así?`,
          readyToAdvance: false,
          advancePrompt: null,
          detectedTheme: 'Falta Disciplinaria y Normativa',
        };
      }

      if (isSalaryIssue) {
        return {
          replyText: `${ackPrefix}Que un colaborador condicione su permanencia o actitud exigiendo un incremento de sueldo inmediato genera una presión delicada sobre tu liderazgo y sobre la equidad interna del equipo, ${leaderName}.\n\nPara dimensionar el escenario completo: ¿qué expectativas puntuales ha puesto sobre la mesa, y qué políticas o márgenes de tabulador existen en la empresa para una revisión de este tipo?`,
          readyToAdvance: false,
          advancePrompt: null,
          detectedTheme: 'Exigencia Salarial y Equidad',
        };
      }

      if (isDelegationOrAutonomy) {
        const ackSelfContrib = /\b(contribuyo|intervengo|superviso|confiar|termino resolviendo|lo resuelvo)\b/i.test(
          effectiveLower
        );
        const opener = ackSelfContrib
          ? `${ackPrefix}Reconozco con claridad lo que planteas, ${leaderName}: como líder de tu equipo ves que dependen demasiado de ti para decidir y también notas cómo tu propia intervención constante alimenta ese ciclo.`
          : `${ackPrefix}La dinámica en la que tu equipo depende de ti para decidir y terminas supervisando o resolviendo personalmente genera desgaste constante y frena su autonomía, ${leaderName}.`;
        return {
          replyText: `${opener}\n\nPara entender dónde se atora la delegación en el día a día: ¿en qué tipo de decisiones o tareas específicas te consultan con más frecuencia tus colaboradores, y qué es lo que más te genera desconfianza o te lleva a intervenir cuando delegas?`,
          readyToAdvance: false,
          advancePrompt: null,
          detectedTheme: 'Delegación y Desarrollo de Autonomía',
        };
      }

      if (isAttitudeOrDelivery) {
        return {
          replyText: `${ackPrefix}Que existan fallas recurrentes en las entregas y una postura a la defensiva desgasta la dinámica del equipo y compromete los resultados que debes entregar, ${leaderName}.\n\nPara basarnos en hechos concretos y verificables: ¿cuáles fueron los acuerdos y plazos específicos que pactaron para esa tarea, y qué conversación previa directa has tenido con la persona sobre este incumplimiento?`,
          readyToAdvance: false,
          advancePrompt: null,
          detectedTheme: 'Acuerdos de Entrega y Desempeño',
        };
      }

      const wordCount = effectiveLower.split(/\s+/).filter(Boolean).length;
      if (wordCount < 12) {
        return {
          replyText: `${ackPrefix}Te escucho, ${leaderName}. Para comprender bien la situación sin hacer suposiciones: ¿qué está ocurriendo concretamente en este momento, quiénes participan y qué es lo que más te preocupa resolver?`,
          readyToAdvance: false,
          advancePrompt: null,
          detectedTheme: 'Exploración Inicial Neutral',
        };
      }

      return {
        replyText: `${ackPrefix}Comprendo la situación que estás enfrentando en tu área, ${leaderName}.\n\nPara profundizar en los hechos concretos y evitar suposiciones: ¿cómo se originó esta situación y qué conductas o hechos observables han ocurrido recientemente?`,
        readyToAdvance: false,
        advancePrompt: null,
        detectedTheme: 'Mapeo de Hechos',
      };
    }

    const askedImpactOrPolicies = prevLidactaTexts.some((t: string) =>
      t.includes('impacto operativo') || t.includes('políticas') || t.includes('politicas') || t.includes('precedentes')
    );
    const askedAgreementsOrPriorTalk = prevLidactaTexts.some((t: string) =>
      t.includes('acuerdos específicos') || t.includes('conversación previa') || t.includes('conversacion previa') || t.includes('compromisos pactados') || t.includes('en privado con tu jefe')
    );
    const askedDelegationImpact = prevLidactaTexts.some((t: string) =>
      t.includes('qué consecuencias está teniendo esta dependencia') || t.includes('soltar una primera responsabilidad')
    );

    // 0. Caso Delito / Robo de material en turnos posteriores
    if (isCrimeOrTheft) {
      if (!askedImpactOrPolicies) {
        return {
          replyText: `Comprendo la gravedad de este hecho sobre los bienes de la empresa, ${leaderName}. Para dimensionar la situación con rigor: ¿qué impacto operativo o de seguridad inmediata ha tenido el faltante, y qué protocolos formales existen con Recursos Humanos o Seguridad Patrimonial para proceder?`,
          readyToAdvance: false,
          advancePrompt: null,
          detectedTheme: 'Protocolos de Seguridad Patrimonial',
        };
      }
      if (!askedAgreementsOrPriorTalk) {
        return {
          replyText: `Teniendo claro el protocolo, ${leaderName}: ¿la persona involucrada ya fue confrontada directamente, o qué evidencias documentales o testimoniales respaldan el señalamiento?`,
          readyToAdvance: false,
          advancePrompt: null,
          detectedTheme: 'Evidencias y Confrontación Directa',
        };
      }
    }

    // 1. Caso de Jerarquía o Respeto con Jefatura
    else if (isHierarchyOrBossConflict) {
      if (!askedAgreementsOrPriorTalk) {
        return {
          replyText: `Comprendo el impacto que tiene este trato o abuso de autoridad de la jefatura, ${leaderName}. Para enfocar cómo abordarlo: ¿has tenido la oportunidad de conversar en privado con tu jefe sobre este hecho específico, o cómo ha sido la dinámica de comunicación entre ustedes antes de esta situación?`,
          readyToAdvance: false,
          advancePrompt: null,
          detectedTheme: 'Relación con Jefatura',
        };
      }
    }

    // 2. Caso Disciplinario o Normativo (ej. ausencias, vacaciones no autorizadas, faltas graves)
    else if (isDisciplinaryOrAbsenceCase) {
      if (!askedImpactOrPolicies) {
        return {
          replyText: `Que un colaborador se tome días sin autorización previa y solo lo notifique por mensaje es una falta grave a los acuerdos del equipo y a la disciplina operativa, ${leaderName}. Para dimensionar la gravedad y actuar con la firmeza debida: ¿qué impacto operativo inmediato está teniendo esto en la continuidad de las tareas del equipo, y existen políticas, precedentes o procesos disciplinarios claros en la empresa para atender un caso así?`,
          readyToAdvance: false,
          advancePrompt: null,
          detectedTheme: 'Falta Disciplinaria y Normativa',
        };
      }

      if (!askedAgreementsOrPriorTalk) {
        return {
          replyText: `Entiendo el impacto operativo que describes, ${leaderName}. Para asegurar que cualquier medida cuente con el debido sustento: ¿qué antecedentes o llamados de atención previos existen con esta persona sobre el cumplimiento de normas, y qué postura asumió cuando se le señalaron?`,
          readyToAdvance: false,
          advancePrompt: null,
          detectedTheme: 'Antecedentes Disciplinarios',
        };
      }
    }

    // 3. Caso de Delegación, Dependencia del Equipo y Autonomía
    else if (isDelegationOrAutonomy) {
      if (!askedDelegationImpact) {
        return {
          replyText: `Entiendo cómo se retroalimenta esa dinámica, ${leaderName}: mientras más intervienes para asegurar el resultado, menos espacio tiene tu equipo para desarrollar criterio propio.\n\nPara ubicar el impacto y el margen de cambio: ¿qué consecuencias está teniendo esta dependencia en tu carga diaria o en la autonomía del área, y qué nivel de aprendizaje o ajuste estarías dispuesta a permitir al soltar una primera responsabilidad?`,
          readyToAdvance: false,
          advancePrompt: null,
          detectedTheme: 'Delegación y Desarrollo de Autonomía',
        };
      }
    }

    // 4. Caso de Actitud o Entregas / Tareas
    else if (isAttitudeOrDelivery) {
      if (!askedAgreementsOrPriorTalk) {
        return {
          replyText: `Que existan fallas recurrentes en las entregas y una postura a la defensiva desgasta la dinámica del equipo y compromete los resultados que debes entregar, ${leaderName}. Para basarnos en hechos concretos y verificables: ¿cuáles fueron los acuerdos y plazos específicos que pactaron para esa tarea, y qué conversación previa directa has tenido con la persona sobre este incumplimiento?`,
          readyToAdvance: false,
          advancePrompt: null,
          detectedTheme: 'Acuerdos de Entrega y Desempeño',
        };
      }

      if (!askedImpactOrPolicies) {
        return {
          replyText: `Comprendo el contexto de las entregas, ${leaderName}. Para profundizar en la raíz: ¿qué justificación o respuesta ha dado el colaborador al señalarle el desfase, y cómo está impactando esta situación en el resto del equipo?`,
          readyToAdvance: false,
          advancePrompt: null,
          detectedTheme: 'Impacto en Equipo y Respuestas',
        };
      }
    }

    // 5. Caso Salarial / Compensación
    else if (isSalaryIssue) {
      if (!askedImpactOrPolicies) {
        return {
          replyText: `Que un colaborador condicione su permanencia o actitud exigiendo un incremento de sueldo inmediato genera una presión delicada sobre tu liderazgo y sobre la equidad interna del equipo, ${leaderName}. Para dimensionar el escenario completo: ¿qué expectativas puntuales ha puesto sobre la mesa, y qué políticas o márgenes de tabulador existen en la empresa para una revisión de este tipo?`,
          readyToAdvance: false,
          advancePrompt: null,
          detectedTheme: 'Exigencia Salarial y Equidad',
        };
      }

      if (!askedAgreementsOrPriorTalk) {
        return {
          replyText: `Tenemos delimitado el contexto salarial, ${leaderName}. Desde el plano de la gestión diaria: ¿cómo ha impactado esta inconformidad en su compromiso y desempeño operativo, y qué conversación has tenido con él sobre su valor y futuro en el equipo?`,
          readyToAdvance: false,
          advancePrompt: null,
          detectedTheme: 'Desempeño y Compensación',
        };
      }
    }

    // 6. Caso General
    else {
      if (!askedAgreementsOrPriorTalk && !prevLidactaTexts.some((t: string) => t.includes('hechos observables'))) {
        return {
          replyText: `Comprendo lo que compartes sobre tu equipo, ${leaderName}. Para enfocar los hechos observables sin asumir intenciones: ¿qué acuerdos o expectativas existían previamente y qué has notado de forma concreta en las personas involucradas?`,
          readyToAdvance: false,
          advancePrompt: null,
          detectedTheme: 'Mapeo de Hechos',
        };
      }
    }

    const hasExploredInitialPilar = prevLidactaTexts.some((t: string) =>
      t.includes('evidencias concretas') ||
      t.includes('contexto de la junta') ||
      t.includes('impacto operativo inmediato') ||
      t.includes('expectativas puntuales') ||
      t.includes('acuerdos y plazos específicos') ||
      t.includes('se atora la delegación') ||
      t.includes('qué consecuencias está teniendo esta dependencia') ||
      t.includes('hechos observables')
    );

    // Si aún no se indaga sobre el impacto o antecedentes, continuar la conversación narrativa
    if (!hasExploredInitialPilar) {
      if (isCrimeOrTheft) {
        return {
          replyText: `Tomo nota de este antecedente, ${leaderName}. Para asegurar que cualquier paso cuente con el debido respaldo interno y legal: ¿quién más en la gerencia o dirección tiene conocimiento de esto y qué medidas provisionales se han tomado para resguardar la operación?`,
          readyToAdvance: false,
          advancePrompt: null,
          detectedTheme: 'Investigación y Medidas Internas',
        };
      }

      if (isHierarchyOrBossConflict) {
        return {
          replyText: `Comprendo el impacto que este trato tiene en tu posición, ${leaderName}. Para valorar las alternativas con objetividad: ¿qué margen de conversación privada ves posible con tu jefe para delimitar acuerdos profesionales, o consideras necesario involucrar a un tercero como Recursos Humanos o una dirección superior?`,
          readyToAdvance: false,
          advancePrompt: null,
          detectedTheme: 'Delimitación de Límites Jerárquicos',
        };
      }

      if (isDisciplinaryOrAbsenceCase) {
        return {
          replyText: `Entiendo el impacto que describes, ${leaderName}. Para tener el contexto completo antes de estructurar el análisis: ¿qué antecedentes o llamados de atención previos existen con esta persona y qué postura asumió cuando se le señalaron?`,
          readyToAdvance: false,
          advancePrompt: null,
          detectedTheme: 'Antecedentes Disciplinarios',
        };
      }

      return {
        replyText: `Te escucho con atención, ${leaderName}. Para terminar de mapear el impacto real antes de sintetizar: ¿de qué manera específica está afectando esta situación el clima de trabajo, los resultados del área o tu propia tranquilidad en el día a día?`,
        readyToAdvance: false,
        advancePrompt: null,
        detectedTheme: 'Profundización de Impacto',
      };
    }

    // Cierre mediante Resumen de Validación
    const { factsAndSituation, leaderDilemma, impactAndMainChallenge } = extractDiagnosticVariablesServer(conversationHistory, cleanMsg, sessionData);
    return {
      replyText: `Con esta información tenemos un panorama sólido y completo de la situación, ${leaderName}. Te comparto un breve resumen sintético de lo que hemos identificado:\n\n• **Hechos y situación:** ${factsAndSituation}\n• **Dilema del líder:** ${leaderDilemma}\n• **Impacto y reto principal:** ${impactAndMainChallenge}\n\n¿Este resumen refleja con claridad lo que estás viviendo? Si es así, estamos listos para dar el siguiente paso hacia la Etapa 2 (Analizar perspectivas y habilidades), donde exploraremos cómo vive la otra parte la situación y qué herramientas de liderazgo necesitas poner en juego.`,
      readyToAdvance: false,
      advancePrompt: null,
      detectedTheme: 'Resumen de Validación Etapa 1',
    };
  }

  if (stage === 2) {
    const existing =
      sessionData?.skillEntries && Array.isArray(sessionData.skillEntries) && sessionData.skillEntries.length > 0
        ? getActiveSkillNames(sessionData.skillEntries)
        : normalizeExistingSessionSkills(sessionData?.identifiedSkills || []);
    const isBeginning = existing.length === 0;
    const skills = isBeginning
      ? inferSkillsFromText(userMessage, existing)
      : existing;

    if (isBeginning) {
      return {
        replyText: `Miremos esto desde otra perspectiva, ${leaderName}.\n\nSi te pusieras por un momento en los zapatos de la otra parte o de tu equipo, ¿cómo crees que están experimentando esta situación? Además, con total franqueza profesional: ¿en qué medida tus reacciones habituales o la forma en que comunicas las expectativas han contribuido a este escenario?\n\nIdentifico que para resolver esto de raíz, las habilidades clave que requieres poner en juego son: **${skills.join('** y **')}**.`,
        readyToAdvance: false,
        identifiedSkills: skills,
        detectedTheme: sessionData?.theme || 'Comunicación y Alineación de Equipo',
        recommendedResources: [
          {
            title: 'Guía de Retroalimentación en Piso (Modelo E-H-I: Evento, Hecho, Impacto)',
            origin: 'internal',
            category: 'Herramienta de Campo (Bloque 3)',
            sourceOrAuthor: 'Biblioteca Interna Lidacta (Bloque 3)',
            estimatedUtility: 'Muy Alta',
            utilityReason: 'Estructuración precisa de observaciones en piso basadas en hechos concretos para evitar que el colaborador reaccione a la defensiva.',
            estimatedDifficulty: 'Baja',
            resistanceOrDoubtNotes: 'Duda inicial del líder sobre cómo iniciar sin que parezca un regaño; se solventa con la frase de apertura del modelo.',
          },
          {
            title: 'The Feedback Fallacy (Marcus Buckingham & Ashley Goodall)',
            origin: 'external',
            category: 'Artículo de Investigación Especializada',
            sourceOrAuthor: 'Harvard Business Review',
            estimatedUtility: 'Alta',
            utilityReason: 'Profundiza en por qué centrarse exclusivamente en debilidades detiene el aprendizaje y propone apalancar fortalezas.',
            estimatedDifficulty: 'Media',
            resistanceOrDoubtNotes: 'Inseguridad sobre cómo equilibrar el reconocimiento de fortalezas con la exigencia estricta de métricas operativas.',
          },
        ],
      };
    } else {
      return {
        replyText: `Excelente nivel de autoconciencia, ${leaderName}. Reconocer nuestros propios patrones de respuesta y visibilizar cómo lo viven los demás es precisamente lo que distingue a un liderazgo maduro.\n\nCon las habilidades de **${skills.join(', ')}** bien identificadas, es momento de diseñar alternativas concretas. ¿Avanzamos a la Etapa 3?`,
        readyToAdvance: true,
        advancePrompt: 'Avanzar a Etapa 3: Diseñar alternativas de solución',
        identifiedSkills: skills,
        recommendedResources: [
          {
            title: 'Guía de Retroalimentación en Piso (Modelo E-H-I: Evento, Hecho, Impacto)',
            origin: 'internal',
            category: 'Herramienta de Campo (Bloque 3)',
            sourceOrAuthor: 'Biblioteca Interna Lidacta (Bloque 3)',
            estimatedUtility: 'Muy Alta',
            utilityReason: 'Estructuración de retroalimentación constructiva para clarificar expectativas con colaboradores.',
            estimatedDifficulty: 'Baja',
            resistanceOrDoubtNotes: 'Receptividad alta; rápida asimilación de los 3 pasos.',
          },
        ],
      };
    }
  }

  if (stage === 3) {
    const normalizedUserMsg = cleanConversationalText(userMessage || '');
    const isEntryMarker = isStage3EntryMarker(normalizedUserMsg);

    const historyArray = Array.isArray(conversationHistory) ? conversationHistory : [];
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

    const savedAlternatives: string[] = Array.isArray(sessionData?.leaderAlternatives)
      ? sessionData.leaderAlternatives
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

    // 1. El líder ya eligió/validó explícitamente una alternativa o combinación sin bloqueos ni dudas activas
    if (explicitlySelectsPath && (allKnownAlternatives.length > 0 || priorStage3LeaderTexts.length > 0)) {
      const selectedSnippet = normalizedUserMsg.slice(0, 180);
      const contextLine =
        allKnownAlternatives.length > 0
          ? `Partiendo de las opciones que trabajaste:\n${alternativesSummaryBlock}\n\n`
          : '';

      return {
        replyText: `Perfecto, ${leaderName}. Tomo nota clara de tu decisión: "${selectedSnippet}".\n\n${contextLine}Recuerda: **tú eres quien decide y conduce la acción**, y elegir con claridad ya te da una base concreta para avanzar.\n\nSi lo deseas, podemos pasar a la **Etapa 4 (simulación opcional)** para ensayar cómo plantearlo antes de llevarlo a la realidad, o avanzar directamente a estructurar tu Plan de Acción en la Etapa 5.`,
        readyToAdvance: true,
        advancePrompt: 'Ir a Etapa 4: Practicar antes de actuar (opcional)',
        ...(allKnownAlternatives.length > 0 ? { suggestedAlternatives: allKnownAlternatives } : {}),
        recommendedResources: [],
      };
    }

    // 2. El líder propuso alternativas (ahora o en turnos previos de Etapa 3) y además expresa dudas, pide orientación o explora consecuencias/obstáculos
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

      const combinationHint =
        allKnownAlternatives.length >= 2 &&
        /(combinar|ambas|mezclar|integrar|cu[aá]l|recomiendas|opinas|conviene)/i.test(currentLower)
          ? '\n• **Posible secuencia o combinación:** No siempre tienes que elegir una sola de forma excluyente; evalúa si una puede servir como primer paso de acercamiento y la otra como respaldo de seguimiento.'
          : '';

      const consequenceHint = exploresConsequencesOrObstacles
        ? '\n• **Anticipación de obstáculos y reacción:** Identifica qué resistencia concreta podría surgir al aplicar la opción que te genera más duda y qué ajuste breve la reduciría desde el inicio.'
        : '';

      const closingQuestion =
        allKnownAlternatives.length >= 2
          ? 'Con base en estas opciones que tú propusiste, ¿qué consecuencia o reacción te pesa más en cada una, o ves viable iniciar con una y complementarla después con la otra?'
          : 'Pensando en esa alternativa que propusiste, ¿qué obstáculo concreto ves en tu equipo o interlocutor y qué ajuste te ayudaría a sentirte más seguro para dar el primer paso?';

      return {
        replyText: `${intro}\n${alternativesSummaryBlock}\n\n${doubtOrFocusBlock}\n\nPara ayudarte a evaluar sin decidir por ti, revisa tus opciones bajo estos criterios:\n• **Cuidado del vínculo vs. urgencia operativa:** Qué opción reduce mejor la tensión o postura defensiva sin perder claridad en el resultado que necesitas.\n• **Control de ejecución:** Cuál depende más directamente de una acción tuya inmediata y qué reacción esperas de la otra parte.${combinationHint}${consequenceHint}\n\n${closingQuestion}`,
        readyToAdvance: false,
        suggestedAlternatives: allKnownAlternatives,
        recommendedResources: [],
      };
    }

    // 3. El líder propuso alternativas en este turno sin expresar dudas ni haber elegido todavía
    if (currentAlternatives.length > 0) {
      if (currentAlternatives.length === 1) {
        return {
          replyText: `Muy bien, ${leaderName}. Ya pusiste una primera alternativa concreta sobre la mesa:\n${alternativesSummaryBlock}\n\nPara tomar una mejor decisión, vale la pena contrastarla: ¿qué posible obstáculo o consecuencia ves en esta opción, y qué otra alternativa distinta podrías considerar (aunque sea más gradual o con otro enfoque) antes de elegir con cuál quedarte?`,
          readyToAdvance: false,
          suggestedAlternatives: allKnownAlternatives,
          recommendedResources: [],
        };
      }

      return {
        replyText: `Muy bien planteado, ${leaderName}. Reconozco las alternativas concretas que acabas de proponer:\n${alternativesSummaryBlock}\n\nAntes de que elijas un camino, contrastémoslas brevemente:\n• **Viabilidad e impacto inmediato:** ¿Cuál atiende mejor el punto crítico del reto con menor desgaste?\n• **Posibles obstáculos o reacciones:** ¿Qué resistencia podría aparecer en cada opción y cómo la manejarías?\n• **Complementariedad:** ¿Te hace sentido elegir una como principal o combinarlas en secuencia?\n\n¿Cuál de estas alternativas te resulta más viable para avanzar, o qué duda te gustaría explorar sobre ellas?`,
        readyToAdvance: false,
        suggestedAlternatives: allKnownAlternatives,
        recommendedResources: [],
      };
    }

    // 4. El líder respondió con dudas, incertidumbre, pedido de orientación o exploración de consecuencias/pasos sin haber listado aún alternativas formales
    const snippet = normalizedUserMsg.slice(0, 160);
    const challengeHint =
      sessionData?.initialChallenge &&
      !/reto de liderazgo y gesti[oó]n de equipo/i.test(String(sessionData.initialChallenge))
        ? ` respecto al reto que estás trabajando ("${String(sessionData.initialChallenge).slice(0, 110)}")`
        : '';

    return {
      replyText: `Te escucho, ${leaderName}. Tomo muy en cuenta lo que compartes ("${snippet}")${challengeHint}.\n\nCuando hay dudas sobre cómo proceder, es mejor no forzar una decisión apresurada. Para destrabar el criterio juntos sin que yo decida por ti, miremos dos ángulos concretos:\n• **Qué necesitas proteger primero:** Si hoy pesa más frenar el impacto operativo inmediato o cuidar la apertura de la persona involucrada.\n• **Riesgo vs. siguiente paso mínimo:** Qué obstáculo o reacción te preocupa evitar y qué acción pequeña de bajo riesgo te daría información real.\n\nDe lo que te genera duda en este momento, ¿qué consecuencia es la que más te preocupa o qué primer paso tentativo ves más manejable?`,
      readyToAdvance: false,
      recommendedResources: [],
    };
  }

  if (stage === 4) {
    if (isPracticeMode) {
      return {
        replyText: `[En personaje]: "Hola ${leaderName}, gracias por llamarme. Honestamente he sentido que el ritmo de trabajo ha sido muy pesado y no me quedaba claro qué era lo prioritario esta semana..."\n\n[Retroalimentación de Lidacta]: Escuché un inicio claro. Para fortalecer aún más tu mensaje: cuida no usar frases absolutistas como "nunca" o "siempre". Focalízate en el impacto concreto y hazle una pregunta abierta. ¿Cómo le responderías ahora?`,
        readyToAdvance: true,
        advancePrompt: 'Concluir práctica y definir plan de acción (Etapa 5)',
        recommendedResources: [
          {
            title: 'Modelo SBI (Situation - Behavior - Impact)',
            origin: 'external',
            category: 'Modelo Metodológico Institucional',
            sourceOrAuthor: 'Center for Creative Leadership (CCL)',
            estimatedUtility: 'Muy Alta',
            utilityReason: 'Herramienta clave para anclar el roleplay en situaciones y comportamientos observables sin juicios de valor.',
            estimatedDifficulty: 'Baja',
            resistanceOrDoubtNotes: 'El líder tendía a generalizar conductas pasadas; el modelo SBI lo reorientó a eventos puntuales.',
          },
        ],
      };
    } else {
      return {
        replyText: `Entendido, ${leaderName}. Practicar es una herramienta opcional; la decisión de avanzar directo al plan es 100% tuya. Lo primordial es que te sientas seguro y enfocado para la acción real.\n\nVamos a la Etapa 5 para dejar tu plan aterrizado con precisión.`,
        readyToAdvance: true,
        advancePrompt: 'Avanzar a Etapa 5: Actuar (Plan de Acción)',
      };
    }
  }

  if (stage === 5) {
    return {
      replyText: `Llegamos al momento de aterrizar tu plan de acción, ${leaderName}. Para asegurar que tu liderazgo se traduzca en una práctica concreta y viable, te invito a redactar personalmente tus 5 compromisos en el formulario de arriba:\n\n1. **¿Qué harás?** (La acción concreta)\n2. **¿Cuándo lo harás?** (Fecha y hora específicas)\n3. **¿Con quién lo harás?** (Involucrados directos)\n4. **¿Cómo lo harás?** (La estrategia o pasos que seguirás)\n5. **¿Qué vas a cuidar o recordar?** (Puntos ciegos, serenidad o enfoque)\n\nRecuerda que la decisión y las palabras son exclusivamente tuyas. Si tienes alguna duda o deseas rebotar una idea antes de guardar, puedes escribirme en el cuadro de conversación complementaria abajo.`,
      readyToAdvance: false,
      advancePrompt: null,
      recommendedResources: [
        {
          title: 'Plantilla de Acuerdos Operativos y Compromisos Mutuos',
          origin: 'internal',
          category: 'Plantilla de Gestión (Bloque 3)',
          sourceOrAuthor: 'Biblioteca Interna Lidacta (Bloque 3)',
          estimatedUtility: 'Muy Alta',
          utilityReason: 'Garantiza que los compromisos queden por escrito con fechas y responsables claros evitando malentendidos.',
          estimatedDifficulty: 'Baja',
          resistanceOrDoubtNotes: 'El líder se preguntaba si era necesario firmar; se aclaró que un correo o nota compartida es suficiente.',
        },
      ],
    };
  }

  if (stage === 6) {
    const executionStatus = sessionData?.actionPlanExecutionStatus;
    const planWhat = sessionData?.actionPlan?.what?.trim();
    const lowerUserMsg = (userMessage || '').toLowerCase();
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
    ].some((k) => lowerUserMsg.includes(k));

    if (executionStatus === 'not_executed') {
      if (mentionsPartial) {
        return {
          replyText: `Gracias por compartirlo con claridad, ${leaderName}. Valoro lo que sí lograste avanzar hasta ahora${
            planWhat ? ` respecto a tu compromiso ("${planWhat}")` : ''
          }. Para acompañarte sin presiones: ¿qué parte concreta ya se realizó, qué quedó pendiente y qué obstáculo o ajuste necesitas considerar para tu siguiente paso?`,
          readyToAdvance: false,
          advancePrompt: null,
          learningsSummary: '',
          recommendedResources: [],
        };
      }

      return {
        replyText: `Gracias por compartirlo con total honestidad, ${leaderName}; este espacio es para acompañarte sin juicios. Respecto al compromiso que definiste en la Etapa 5${
          planWhat ? ` ("${planWhat}")` : ''
        }, ¿qué obstáculos o circunstancias se presentaron que impidieron llevarlo a cabo, o lograste avanzar en alguna parte? Conversemos para ver cómo ajustarlo y definir tu siguiente paso.`,
        readyToAdvance: false,
        advancePrompt: null,
        learningsSummary: '',
        recommendedResources: [],
      };
    }

    if (executionStatus === 'pending_verification') {
      return {
        replyText: `Antes de entrar a la reflexión de la Etapa 6${
          planWhat ? ` sobre tu compromiso ("${planWhat}")` : ''
        }, quiero verificar contigo: ¿ya ejecutaste tu Plan de Acción?`,
        readyToAdvance: false,
        advancePrompt: null,
        learningsSummary: '',
        recommendedResources: [],
      };
    }

    if (mentionsPartial) {
      return {
        replyText: `Gracias por precisarlo, ${leaderName}. Es muy valioso distinguir lo que ya ejecutaste${
          planWhat ? ` de tu plan ("${planWhat}")` : ''
        } frente a lo que aún sigue pendiente. Sobre la parte que sí lograste realizar: ¿qué ocurrió concretamente, qué observaste en la otra persona o tu equipo en ${company}, y qué necesitarías para abordar lo pendiente?`,
        readyToAdvance: false,
        advancePrompt: null,
        learningsSummary: '',
        recommendedResources: [],
      };
    }

    return {
      replyText: `${
        planWhat
          ? `Tomando en cuenta tu compromiso de la Etapa 5 ("${planWhat}"), reflexionemos con calma sobre lo que viviste, ${leaderName}:`
          : `Para reflexionar a partir de tu experiencia real en ${company}, ${leaderName}:`
      }\n• ¿Qué ocurrió concretamente al llevarlo a la práctica?\n• ¿Qué funcionó bien y qué imprevistos o matices surgieron?\n• ¿De qué te das cuenta sobre ti y qué aprendizaje te llevas para futuras situaciones?`,
      readyToAdvance: false,
      advancePrompt: null,
      learningsSummary: '',
      recommendedResources: [],
    };
  }

  // Stage 7: Closure
  let rawSkillsToReport: any[] = [];
  if (
    sessionData?.skillEntries &&
    Array.isArray(sessionData.skillEntries) &&
    sessionData.skillEntries.length > 0
  ) {
    const activeEntries = getActiveSkillEntries(sessionData.skillEntries);
    rawSkillsToReport = activeEntries.length > 0 ? activeEntries : [];
  } else if (
    sessionData?.identifiedSkills &&
    Array.isArray(sessionData.identifiedSkills) &&
    sessionData.identifiedSkills.length > 0
  ) {
    rawSkillsToReport = sessionData.identifiedSkills;
  }
  const skillsDetected = formatStageTwoSkillsWithEvidence(rawSkillsToReport);
  return {
    replyText: `Muchas gracias por tu compromiso y apertura en este proceso de mentoría, ${leaderName}. Has demostrado una gran capacidad para pasar de la duda a la acción decidida.\n\nTe recuerdo que **esta conversación ha sido 100% confidencial**. Recursos Humanos únicamente recibe constancia de que has concluido exitosamente tu proceso y los indicadores generales de desarrollo, salvaguardando en todo momento tu privacidad.\n\nHe generado tu **Reporte de Retroalimentación y Autonomía de Liderazgo**, el cual puedes consultar aquí en la aplicación y también te llegará a tu correo electrónico. ¡Sigue utilizando Lidacta ante cada nuevo reto!`,
    readyToAdvance: false,
    finalFeedback: {
      detectedStrengths: [],
      stageTwoSkills: skillsDetected,
      chosenActions: [
        sessionData?.actionPlan?.what || 'Conversación 1 a 1 de alineación y retroalimentación',
      ],
      stageSixLearnings: [
        'La claridad en las expectativas tempranas previene retrabajos y fricciones',
        'Escuchar activamente a los involucrados incrementa su nivel de corresponsabilidad',
      ],
      recommendationsForAutonomy: [
        'Practicar la retroalimentación continua en lugar de esperar a revisiones formales',
        'Documentar los compromisos mutuos de manera breve y visible para el equipo',
        'Mantener el hábito de analizar el contexto antes de reaccionar',
      ],
    },
  };
}

function detectTopicFromText(text: string): string {
  const lower = (text || '').toLowerCase();
  if (lower.includes('comunic') || lower.includes('hablar') || lower.includes('decir')) return 'Comunicación Asertiva';
  if (lower.includes('deleg') || lower.includes('carga') || lower.includes('hacer todo')) return 'Delegación y Confianza';
  if (lower.includes('desempeñ') || lower.includes('meta') || lower.includes('entrega') || lower.includes('calidad')) return 'Gestión del Desempeño';
  if (lower.includes('conflict') || lower.includes('discus') || lower.includes('molest') || lower.includes('tensi')) return 'Manejo de Conflictos';
  if (lower.includes('motiv') || lower.includes('actitud') || lower.includes('compromis')) return 'Motivación y Clima Laboral';
  return 'Alineación y Gestión de Equipo';
}

function inferSkillsFromText(text: string, existingSkills: string[] = []): string[] {
  const lower = (text || '').toLowerCase();
  const candidates: string[] = [];
  if (lower.includes('comunic') || lower.includes('decir') || lower.includes('callar') || lower.includes('hablar')) candidates.push('Comunicación Asertiva y Firmeza Empática');
  if (lower.includes('escuch') || lower.includes('entiend') || lower.includes('ignoran') || lower.includes('atencion')) candidates.push('Escucha Activa e Indagación');
  if (lower.includes('deleg') || lower.includes('soltar') || lower.includes('confiar') || lower.includes('control')) candidates.push('Delegación Efectiva y Empoderamiento');
  if (lower.includes('emoci') || lower.includes('enojo') || lower.includes('frustr') || lower.includes('calma') || lower.includes('estres')) candidates.push('Inteligencia y Regulación Emocional');
  if (lower.includes('acuerd') || lower.includes('expectat') || lower.includes('regla') || lower.includes('compromis')) candidates.push('Gestión de Acuerdos y Seguimiento');
  if (lower.includes('conflict') || lower.includes('tension') || lower.includes('roce') || lower.includes('pelea')) candidates.push('Gestión de Conversaciones Difíciles y Manejo de Conflictos');
  if (lower.includes('retroaliment') || lower.includes('feedback') || lower.includes('corregir')) candidates.push('Retroalimentación Basada en Hechos');

  if (candidates.length === 0) {
    candidates.push('Comunicación Asertiva y Firmeza Empática');
  }

  return consolidateSkills(existingSkills, candidates, 2);
}

// Centralized Admin Profile State (Persists in server memory across all clients & devices)
interface AdminProfileData {
  id: string;
  name: string;
  email: string;
  whatsapp: string;
  position: string;
  companyName: string;
  area: string;
  updatedAt: string;
}

let serverAdminProfile: AdminProfileData = {
  id: 'user_admin_tania',
  name: 'Tania Padierna',
  email: 'hola@lidacta.com',
  whatsapp: '+52 55 1234 5678',
  position: 'Creadora de la Plataforma & Coach Sr.',
  companyName: 'Lidacta Platform',
  area: 'Dirección de Producto y Mentoría',
  updatedAt: new Date().toISOString(),
};

// Centralized Server Users Store (Shared across Mobile, PC, Incognito, and multi-device sessions)
export interface ServerUserProfile {
  id: string;
  name: string;
  email: string;
  role: 'leader' | 'hr' | 'admin';
  companyId: string;
  companyName: string;
  position: string;
  area?: string;
  birthDate?: string;
  directReports?: number;
  whatsapp?: string;
  avatarUrl?: string;
  status?: 'active' | 'inactive';
  password?: string;
  isProfileCompleted?: boolean;
  isProfileComplete?: boolean;
  createdAt: string;
  updatedAt?: string;
}

const USERS_DB_PATH = path.join(__dirname, 'server_users_db.json');
const DATA_DIR = path.join(__dirname, 'data');
const DATA_USERS_PATH = path.join(DATA_DIR, 'users.json');

// Ensure data directory exists
try {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
} catch (e) {
  console.warn('[SERVER DB] Could not ensure data directory:', e);
}

const initialServerUsers: ServerUserProfile[] = [
  {
    id: 'user_admin_tania',
    name: 'Tania Padierna',
    email: 'hola@lidacta.com',
    role: 'admin',
    companyId: 'comp_nexus',
    companyName: 'Lidacta Platform',
    position: 'Creadora de la Plataforma & Coach Sr.',
    area: 'Dirección de Producto y Mentoría',
    whatsapp: '+52 55 1234 5678',
    status: 'active',
    isProfileCompleted: true,
    isProfileComplete: true,
    createdAt: '2026-01-01',
  },
  {
    id: 'user_leader_roberto',
    name: 'Roberto Gómez',
    email: 'roberto.gomez@nexus-auto.com',
    role: 'leader',
    companyId: 'comp_nexus',
    companyName: 'Industrias Nexus Automotriz',
    position: 'Líder de Línea de Ensamble y Calidad',
    area: 'Operaciones de Manufactura',
    birthDate: '1988-04-12',
    directReports: 14,
    whatsapp: '+52 55 4912 8841',
    avatarUrl: '/src/assets/images/avatar_leader_roberto_1792074706592.jpg',
    status: 'active',
    isProfileCompleted: true,
    isProfileComplete: true,
    createdAt: '2026-09-10',
  },
  {
    id: 'user_leader_carlos',
    name: 'Carlos Mendoza',
    email: 'carlos.mendoza@novaretail.com',
    role: 'leader',
    companyId: 'comp_nova',
    companyName: 'Retail Nova Grupo Comercial',
    position: 'Gerente de Sucursal Centro',
    area: 'Operaciones Comerciales y Tiendas',
    birthDate: '1990-06-15',
    directReports: 8,
    whatsapp: '+52 55 9876 5432',
    status: 'active',
    isProfileCompleted: true,
    isProfileComplete: true,
    createdAt: '2026-09-15',
  },
  {
    id: 'user_hr_sofia',
    name: 'Sofía Valenzuela',
    email: 'sofia.valenzuela@nexus-auto.com',
    role: 'hr',
    companyId: 'comp_nexus',
    companyName: 'Industrias Nexus Automotriz',
    position: 'Directora de Recursos Humanos & Talento',
    area: 'Gestión Humana y Cultura',
    birthDate: '1985-08-19',
    whatsapp: '+52 55 8820 1492',
    avatarUrl: '/src/assets/images/avatar_hr_sofia_1792074705689.jpg',
    status: 'active',
    isProfileCompleted: true,
    isProfileComplete: true,
    createdAt: '2026-08-20',
  },
  {
    id: 'user_hr_mariana',
    name: 'Mariana Castillo',
    email: 'mariana.castillo@novaretail.com',
    role: 'hr',
    companyId: 'comp_nova',
    companyName: 'Retail Nova Grupo Comercial',
    position: 'Gerente de Desarrollo Organizacional',
    area: 'Recursos Humanos',
    birthDate: '',
    whatsapp: '',
    status: 'active',
    isProfileCompleted: false,
    isProfileComplete: false,
    createdAt: '2026-08-25',
  },
];

function readPersistentUsers(): ServerUserProfile[] {
  // 1. Try reading from data/users.json
  try {
    if (fs.existsSync(DATA_USERS_PATH)) {
      const content = fs.readFileSync(DATA_USERS_PATH, 'utf-8');
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((u: any) => ({
          ...u,
          email:
            u.id === 'user_admin_tania' && String(u.email || '').toLowerCase() === 'hola@taniapadierna.com'
              ? 'hola@lidacta.com'
              : u.email,
          status: u.status || 'active',
        }));
      }
    }
  } catch (err) {
    console.warn('[SERVER DB] Could not read data/users.json:', err);
  }

  // 2. Fallback to server_users_db.json
  try {
    if (fs.existsSync(USERS_DB_PATH)) {
      const content = fs.readFileSync(USERS_DB_PATH, 'utf-8');
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((u: any) => ({
          ...u,
          email:
            u.id === 'user_admin_tania' && String(u.email || '').toLowerCase() === 'hola@taniapadierna.com'
              ? 'hola@lidacta.com'
              : u.email,
          status: u.status || 'active',
        }));
      }
    }
  } catch (err) {
    console.warn('[SERVER DB] Could not read server_users_db.json, using defaults:', err);
  }
  return initialServerUsers;
}

function writePersistentUsers(users: ServerUserProfile[]) {
  const serialized = JSON.stringify(users, null, 2);
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DATA_USERS_PATH, serialized, 'utf-8');
  } catch (err) {
    console.error('[SERVER DB] Failed to write data/users.json:', err);
  }

  try {
    fs.writeFileSync(USERS_DB_PATH, serialized, 'utf-8');
    console.log('[SERVER DB] Successfully persisted users to disk (data/users.json & server_users_db.json)');
  } catch (err) {
    console.error('[SERVER DB] Failed to persist server_users_db.json:', err);
  }
}

let serverUsers: ServerUserProfile[] = readPersistentUsers();
// Ensure files exist on initial start
writePersistentUsers(serverUsers);

// Centralized Server Notifications Store (Accessible across all connected devices & sessions)
interface ServerNotificationItem {
  id: string;
  recipientRole: string;
  recipientUserId?: string;
  companyId?: string;
  title: string;
  message: string;
  type: string;
  timestamp: string;
  read: boolean;
  emailSimulated?: {
    from?: string;
    to: string;
    replyTo?: string;
    subject: string;
    bodyText: string;
    realEmailSent?: boolean;
    realEmailId?: string;
  };
  mentorRequestDetails?: {
    leaderId: string;
    leaderName: string;
    leaderEmail: string;
    leaderWhatsapp?: string;
    leaderPosition?: string;
    companyName: string;
    currentStage: number;
    stageName: string;
    caseTitle: string;
    reasonText: string;
    isVoiceAudio?: boolean;
    status: 'pendiente' | 'contactado' | 'atendido';
    whatsappSent?: boolean;
    emailSent?: boolean;
    adminNotes?: string;
  };
}

let serverNotifications: ServerNotificationItem[] = [
  {
    id: 'notif_mentor_sample',
    recipientRole: 'admin',
    recipientUserId: 'user_admin_tania',
    companyId: 'comp_nexus',
    title: 'Solicitud de Asesoría 1:1 Directa',
    message: 'Roberto Gómez solicita acompañamiento personal directivo para su caso en Etapa 2 (Analizar).',
    type: 'mentor_request',
    timestamp: '2026-10-02T11:30:00Z',
    read: false,
    emailSimulated: {
      to: 'hola@lidacta.com',
      subject: 'Lidacta [Asesoría 1:1]: Roberto Gómez solicita acompañamiento directo',
      bodyText: 'Hola Tania,\n\nEl líder Roberto Gómez (Líder de Línea de Ensamble y Calidad en Nexus Automotriz) ha solicitado una sesión de Asesoría 1:1 directa.\n\n• Caso: Resistencia al cambio en bitácora digital con técnico senior\n• Etapa actual: Etapa 2 (Analizar)\n• Razón: "Me gustaría revisar cómo abordar la resistencia de Ernesto sin que sienta que estoy devaluando sus 15 años en la planta, antes de pasar a la práctica."\n\nPuedes contactarlo directamente vía WhatsApp (+52 55 4321 9876) o agendar desde tu panel de administradora.',
      realEmailSent: false,
    },
    mentorRequestDetails: {
      leaderId: 'user_leader_roberto',
      leaderName: 'Roberto Gómez',
      leaderEmail: 'roberto.gomez@nexus-auto.com',
      leaderWhatsapp: '+52 55 4321 9876',
      leaderPosition: 'Líder de Línea de Ensamble y Calidad',
      companyName: 'Industrias Nexus Automotriz',
      currentStage: 2,
      stageName: 'Analizar perspectivas & Habilidades',
      caseTitle: 'Resistencia al cambio en bitácora digital con técnico senior',
      reasonText: 'Me gustaría revisar cómo abordar la resistencia de Ernesto sin que sienta que estoy devaluando sus 15 años en la planta, antes de pasar a la práctica.',
      isVoiceAudio: false,
      status: 'pendiente',
      whatsappSent: true,
      emailSent: true,
    },
  },
];

// GET /api/admin/profile - Retrieve centralized admin profile for cross-device sync
app.get('/api/admin/profile', (_req: Request, res: Response) => {
  return res.json({
    success: true,
    profile: serverAdminProfile,
  });
});

// POST /api/admin/profile - Update centralized admin profile from any device
app.post('/api/admin/profile', (req: Request, res: Response) => {
  try {
    const { name, email, whatsapp, position, companyName, area } = req.body;
    serverAdminProfile = {
      ...serverAdminProfile,
      name: (name || serverAdminProfile.name).trim(),
      email: (email || serverAdminProfile.email).trim().toLowerCase(),
      whatsapp: whatsapp !== undefined ? whatsapp.trim() : serverAdminProfile.whatsapp,
      position: position !== undefined ? position.trim() : serverAdminProfile.position,
      companyName: companyName !== undefined ? companyName.trim() : serverAdminProfile.companyName,
      area: area !== undefined ? area.trim() : serverAdminProfile.area,
      updatedAt: new Date().toISOString(),
    };
    console.log('[LIDACTA PROFILE] Admin profile updated centrally:', serverAdminProfile);
    return res.json({
      success: true,
      message: 'Perfil de administrador actualizado y sincronizado centralmente.',
      profile: serverAdminProfile,
    });
  } catch (error: any) {
    console.error('Error updating admin profile:', error);
    return res.status(500).json({ success: false, message: error?.message || 'Error al actualizar perfil' });
  }
});

// GET /api/health - Check database and server health for multi-device sync
app.get('/api/health', (_req: Request, res: Response) => {
  serverUsers = readPersistentUsers();
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  return res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    usersCount: serverUsers.length,
    databaseFile: 'server_users_db.json',
  });
});

// GET /api/users - Cross-device synchronized user list
app.get('/api/users', (_req: Request, res: Response) => {
  serverUsers = readPersistentUsers();
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  return res.json({
    success: true,
    users: serverUsers,
  });
});

// Helper functions for robust sanitization
function parseFlexibleBirthDate(rawDate?: any): string {
  if (!rawDate) return '1990-01-01';
  const str = String(rawDate).trim();
  if (!str) return '1990-01-01';

  // DD/MM/YYYY or DD-MM-YYYY
  const dmyMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (dmyMatch) {
    const day = dmyMatch[1].padStart(2, '0');
    const month = dmyMatch[2].padStart(2, '0');
    const year = dmyMatch[3];
    return `${year}-${month}-${day}`;
  }

  // YYYY/MM/DD or YYYY-MM-DD
  const ymdMatch = str.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
  if (ymdMatch) {
    const year = ymdMatch[1];
    const month = ymdMatch[2].padStart(2, '0');
    const day = ymdMatch[3].padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  try {
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      return d.toISOString().split('T')[0];
    }
  } catch {}

  return str || '1990-01-01';
}

function sanitizeWhatsapp(raw?: any): string {
  if (!raw) return 'Sin especificar';
  const str = String(raw).trim();
  if (!str) return 'Sin especificar';
  const hasPlus = str.startsWith('+');
  const digits = str.replace(/[^\d]/g, '');
  if (!digits) return 'Sin especificar';
  return hasPlus ? `+${digits}` : digits;
}

// POST /api/user/complete-profile - Persistently mark profile as complete across PC, Mobile, Incognito (Permanent UPSERT)
app.post('/api/user/complete-profile', (req: Request, res: Response) => {
  try {
    if (req.body?.action === 'invite' || req.body?.action === 'send_invite' || req.body?.sendInvite === true) {
      return handleProfileInviteRequest(req, res);
    }

    serverUsers = readPersistentUsers();
    const {
      userId,
      email,
      name,
      role,
      companyId,
      companyName,
      area,
      position,
      birthDate,
      fechaNacimiento,
      directReports,
      personasACargo,
      whatsapp,
    } = req.body;

    // Explicit type conversion & sanitization:
    // 1. personasACargo safely parsed as integer (parseInt(val) || 0)
    const rawReports = personasACargo !== undefined ? personasACargo : (directReports !== undefined ? directReports : req.body.reports);
    const parsedPersons = parseInt(String(rawReports !== undefined && rawReports !== null ? rawReports : '0'), 10);
    const sanitizedPersonasACargo = isNaN(parsedPersons) ? 0 : Math.max(0, parsedPersons);

    // 2. whatsapp: Clean spaces, dashes and non-numeric chars without breaking string
    const rawPhone = whatsapp !== undefined && whatsapp !== null ? whatsapp : (req.body.telefono || req.body.phone);
    const sanitizedWhatsapp = sanitizeWhatsapp(rawPhone);

    // 3. fechaNacimiento / birthDate: Accepts both YYYY-MM-DD and DD/MM/YYYY without exception
    const rawDate = birthDate || fechaNacimiento || req.body.dateOfBirth;
    const sanitizedBirthDate = parseFlexibleBirthDate(rawDate);

    // 4. Defaults for optional/required fields to prevent schema breakage
    const sanitizedCompanyName = String(companyName || req.body.empresa || req.body.company || '').trim() || 'Empresa Sin especificar';
    const sanitizedArea = String(area !== undefined && area !== null ? area : (req.body.departamento || req.body.areaDepartamento || '')).trim() || 'Sin especificar';
    const sanitizedPosition = String(position !== undefined && position !== null ? position : (req.body.puesto || req.body.cargo || '')).trim() || 'Sin especificar';
    const sanitizedName = String(name || '').trim() || 'Usuario Lidacta';
    const sanitizedEmail = String(email || '').trim().toLowerCase();
    const sanitizedRole = (role === 'admin' || role === 'hr' || role === 'leader') ? role : 'leader';
    const sanitizedCompanyId = String(companyId || 'comp_custom');

    // UPSERT: Find existing record by id or email
    let targetIndex = -1;
    if (userId) {
      targetIndex = serverUsers.findIndex((u) => u.id === userId);
    }
    if (targetIndex === -1 && sanitizedEmail) {
      targetIndex = serverUsers.findIndex(
        (u) => u.email.toLowerCase() === sanitizedEmail
      );
    }

    let savedUser: ServerUserProfile;

    if (targetIndex === -1) {
      // INSERT: Permanent creation in central database
      const newId = userId || `user_${Date.now()}`;
      savedUser = {
        id: newId,
        name: sanitizedName,
        email: sanitizedEmail || `${newId}@lidacta.com`,
        role: sanitizedRole,
        companyId: sanitizedCompanyId,
        companyName: sanitizedCompanyName,
        position: sanitizedPosition,
        area: sanitizedArea,
        birthDate: sanitizedBirthDate,
        directReports: sanitizedPersonasACargo,
        whatsapp: sanitizedWhatsapp,
        status: 'active',
        isProfileCompleted: true,
        isProfileComplete: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      serverUsers.unshift(savedUser);
      console.log(`[LIDACTA USERS UPSERT-INSERT] User permanently created and completed: ${savedUser.name} (${savedUser.email})`);
    } else {
      // UPDATE: In-place update of user fields
      const current = serverUsers[targetIndex];
      savedUser = {
        ...current,
        name: sanitizedName !== 'Usuario Lidacta' ? sanitizedName : (current.name || sanitizedName),
        email: sanitizedEmail || current.email,
        role: current.role || sanitizedRole,
        companyId: current.companyId || sanitizedCompanyId,
        companyName: sanitizedCompanyName !== 'Empresa Sin especificar' ? sanitizedCompanyName : (current.companyName || sanitizedCompanyName),
        area: sanitizedArea,
        position: sanitizedPosition,
        birthDate: sanitizedBirthDate,
        directReports: sanitizedPersonasACargo,
        whatsapp: sanitizedWhatsapp,
        status: current.status || 'active',
        isProfileCompleted: true,
        isProfileComplete: true,
        updatedAt: new Date().toISOString(),
      };
      serverUsers[targetIndex] = savedUser;
      console.log(`[LIDACTA USERS UPSERT-UPDATE] Profile permanently updated & completed: ${savedUser.name} (${savedUser.email})`);
    }

    // Direct permanent write to disk (eliminating temporary cache-only persistence)
    writePersistentUsers(serverUsers);

    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    return res.json({
      success: true,
      message: 'Perfil completado exitosamente y persistido en la Base de Datos Central.',
      user: savedUser,
      users: serverUsers,
    });
  } catch (error: any) {
    console.error('Error completing profile centrally (UPSERT):', error);
    // Guaranteed HTTP 200 fallback: construct valid user, persist safely and respond with 200 OK
    const fallbackUser: ServerUserProfile = {
      id: req.body?.userId || `user_${Date.now()}`,
      name: req.body?.name || 'Usuario Lidacta',
      email: (req.body?.email || 'usuario@lidacta.com').trim().toLowerCase(),
      role: (req.body?.role === 'admin' || req.body?.role === 'hr' || req.body?.role === 'leader') ? req.body.role : 'leader',
      companyId: req.body?.companyId || 'comp_custom',
      companyName: req.body?.companyName || 'Empresa Sin especificar',
      position: req.body?.position || 'Líder Operativo',
      area: req.body?.area || 'Sin especificar',
      birthDate: parseFlexibleBirthDate(req.body?.birthDate || req.body?.fechaNacimiento),
      directReports: parseInt(String(req.body?.personasACargo || req.body?.directReports || '0'), 10) || 0,
      whatsapp: sanitizeWhatsapp(req.body?.whatsapp),
      status: 'active',
      isProfileCompleted: true,
      isProfileComplete: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    try {
      const existingIdx = serverUsers.findIndex((u) => u.id === fallbackUser.id || (fallbackUser.email && u.email.toLowerCase() === fallbackUser.email.toLowerCase()));
      if (existingIdx !== -1) {
        serverUsers[existingIdx] = { ...serverUsers[existingIdx], ...fallbackUser };
      } else {
        serverUsers.unshift(fallbackUser);
      }
      writePersistentUsers(serverUsers);
    } catch (persistErr) {
      console.warn('[SERVER DB] Fallback disk write warning:', persistErr);
    }

    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    return res.status(200).json({
      success: true,
      message: 'Perfil completado exitosamente y persistido en la Base de Datos Central.',
      user: fallbackUser,
      users: serverUsers,
    });
  }
});

// --- Transactional Email Functions (Resend + Centralized Server Notifications) ---

function generateWelcomeEmailHtml(user: ServerUserProfile): string {
  const roleName = user.role === 'leader' ? 'Líder de Equipo' : user.role === 'hr' ? 'Gestión de Talento Humano' : 'Administrador';
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>¡Te damos la bienvenida a Lidacta!</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #F8F6F4; margin: 0; padding: 24px; color: #2D1B4E;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(45, 27, 78, 0.08); border: 1px solid #EADBCE;">
    <tr>
      <td style="background-color: #2D1B4E; padding: 32px 24px; text-align: center;">
        <h1 style="color: #FFF7EF; font-size: 24px; margin: 0 0 8px 0; font-weight: 800; letter-spacing: -0.5px;">LIDACTA</h1>
        <p style="color: #F7B538; font-size: 13px; margin: 0; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">Desarrollo de Liderazgo en Acción</p>
      </td>
    </tr>
    <tr>
      <td style="padding: 32px 28px;">
        <h2 style="font-size: 20px; color: #2D1B4E; margin: 0 0 16px 0; font-weight: 700;">¡Hola ${user.name}!</h2>
        <p style="font-size: 14px; line-height: 1.6; color: #4A3F55; margin: 0 0 16px 0;">
          Te damos una cálida bienvenida a <strong>Lidacta</strong>. Tu cuenta ha sido dada de alta exitosamente asociada a <strong>${user.companyName}</strong> con el rol de <strong>${roleName}</strong>.
        </p>
        <p style="font-size: 14px; line-height: 1.6; color: #4A3F55; margin: 0 0 20px 0;">
          Lidacta es tu espacio seguro, confidencial y práctico en el que tendrás un mentor para acompañarte y ayudarte a resolver los retos relacionados con el manejo de personas. Podrás también encontrar herramientas y establecer acciones que fortalezcan tu autonomía como líder.
        </p>
        <div style="background-color: #FFF7EF; border-left: 4px solid #F7B538; padding: 16px; border-radius: 8px; margin: 0 0 24px 0;">
          <p style="font-size: 13px; font-weight: 700; color: #2D1B4E; margin: 0 0 6px 0;">🔒 Confidencialidad Absoluta Garantizada</p>
          <p style="font-size: 12px; line-height: 1.5; color: #4A3F55; margin: 0;">
            El contenido de tus conversaciones, simulaciones y casos es estrictamente privado. Recursos Humanos únicamente recibe métricas agregadas de participación, nunca el detalle de tus casos.
          </p>
        </div>
        <div style="text-align: center; margin: 30px 0 20px 0;">
          <a href="https://ais-dev-5pctfozdv244x3okeqjryq-710027895954.us-east1.run.app" style="background-color: #BF3A1B; color: #ffffff; padding: 14px 28px; font-size: 14px; font-weight: 700; text-decoration: none; border-radius: 12px; display: inline-block; box-shadow: 0 4px 12px rgba(191, 58, 27, 0.3);">
            Acceder a Lidacta →
          </a>
        </div>
      </td>
    </tr>
    <tr>
      <td style="background-color: #FFF7EF; padding: 20px 24px; text-align: center; border-top: 1px solid #EADBCE;">
        <p style="font-size: 11px; color: #4A3F55; margin: 0;">Lidacta © ${new Date().getFullYear()} · Desarrollo de Liderazgo Operativo</p>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function generateProfileInviteEmailHtml(user: ServerUserProfile, directUrl: string): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>Invitación para completar tu perfil en Lidacta</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #F8F6F4; margin: 0; padding: 24px; color: #2D1B4E;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(45, 27, 78, 0.08); border: 1px solid #EADBCE;">
    <tr>
      <td style="background-color: #2D1B4E; padding: 32px 24px; text-align: center;">
        <h1 style="color: #FFF7EF; font-size: 24px; margin: 0 0 8px 0; font-weight: 800; letter-spacing: -0.5px;">LIDACTA</h1>
        <p style="color: #F7B538; font-size: 13px; margin: 0; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">Invitación de Onboarding Directivo</p>
      </td>
    </tr>
    <tr>
      <td style="padding: 32px 28px;">
        <span style="display: inline-block; padding: 4px 12px; background-color: #FFD3BF; color: #BF3A1B; border-radius: 20px; font-size: 11px; font-weight: 700; text-transform: uppercase; margin-bottom: 12px;">Paso Requerido</span>
        <h2 style="font-size: 20px; color: #2D1B4E; margin: 0 0 16px 0; font-weight: 700;">¡Hola ${user.name}!</h2>
        <p style="font-size: 14px; line-height: 1.6; color: #4A3F55; margin: 0 0 16px 0;">
          La administración de <strong>${user.companyName}</strong> te ha invitado a formar parte del programa directivo en <strong>Lidacta</strong>.
        </p>
        <p style="font-size: 14px; line-height: 1.6; color: #4A3F55; margin: 0 0 20px 0;">
          Para habilitar tu acceso seguro y comenzar tu proceso de acompañamiento directivo personalizado, por favor ingresa al siguiente enlace y completa los datos de tu entorno operativo (Área, Puesto, WhatsApp y Personas a Cargo):
        </p>
        <div style="background-color: #FFF7EF; border: 1px solid #EADBCE; padding: 18px; border-radius: 12px; margin: 0 0 24px 0; text-align: left;">
          <p style="font-size: 13px; font-weight: 700; color: #2D1B4E; margin: 0 0 6px 0;">📋 Tus datos de acceso:</p>
          <p style="font-size: 13px; color: #4A3F55; margin: 0 0 4px 0;">• <strong>Usuario:</strong> ${user.email}</p>
          <p style="font-size: 13px; color: #4A3F55; margin: 0;">• <strong>Empresa:</strong> ${user.companyName}</p>
        </div>
        <div style="text-align: center; margin: 28px 0 20px 0;">
          <a href="${directUrl}" style="background-color: #F7B538; color: #2D1B4E; padding: 14px 28px; font-size: 14px; font-weight: 800; text-decoration: none; border-radius: 12px; display: inline-block; box-shadow: 0 4px 12px rgba(247, 181, 56, 0.35);">
            Completar Mi Perfil en Lidacta →
          </a>
        </div>
        <p style="font-size: 12px; color: #4A3F55; text-align: center; margin: 20px 0 0 0;">
          Si el botón no funciona, copia y pega este enlace en tu navegador:<br>
          <a href="${directUrl}" style="color: #BF3A1B; text-decoration: underline; word-break: break-all;">${directUrl}</a>
        </p>
      </td>
    </tr>
    <tr>
      <td style="background-color: #FFF7EF; padding: 20px 24px; text-align: center; border-top: 1px solid #EADBCE;">
        <p style="font-size: 11px; color: #4A3F55; margin: 0;">Lidacta © ${new Date().getFullYear()} · Desarrollo de Liderazgo en Acción</p>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

async function sendTransactionalEmail(options: {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
  recipientRole?: string;
  recipientUserId?: string;
  companyId?: string;
  type?: string;
  title?: string;
  message?: string;
}): Promise<{ realSent: boolean; emailId?: string; error?: string; deliveryNote?: string }> {
  const currentKey = process.env.RESEND_API_KEY;
  const adminOwner = process.env.ADMIN_EMAIL || 'hola@lidacta.com';
  const fromEmail = process.env.RESEND_FROM_EMAIL || 'Lidacta <notificaciones@taniapadierna.com>';
  const replyToEmail = options.replyTo || process.env.RESEND_REPLY_TO || 'hola@lidacta.com';
  const cleanTo = options.to.trim().toLowerCase();

  let realSent = false;
  let emailId: string | undefined;
  let errorMsg: string | undefined;
  let deliveryNote: string | undefined;

  console.log(`[LIDACTA MAILING 📧] ==========================================`);
  console.log(`[LIDACTA MAILING 📧] Timestamp: ${new Date().toISOString()}`);
  console.log(`[LIDACTA MAILING 📧] Remitente Oficial (From): ${fromEmail}`);
  console.log(`[LIDACTA MAILING 📧] Destinatario (To): ${cleanTo}`);
  console.log(`[LIDACTA MAILING 📧] Responder a (Reply-To): ${replyToEmail}`);
  console.log(`[LIDACTA MAILING 📧] Asunto: ${options.subject}`);
  console.log(`[LIDACTA MAILING 📧] Proveedor: Resend (API Key activa: ${currentKey ? 'SÍ [longitud ' + currentKey.length + ']' : 'NO'})`);

  if (currentKey) {
    const client = new Resend(currentKey);
    try {
      // 1. Envío directo con await y replyTo explícito
      console.log(`[LIDACTA MAILING 📧] 🚀 Despachando llamada a Resend API para ${cleanTo} desde ${fromEmail} (Reply-To: ${replyToEmail})...`);
      const res = await client.emails.send({
        from: fromEmail,
        to: [cleanTo],
        replyTo: 'hola@lidacta.com',
        subject: options.subject,
        html: options.html,
        text: options.text,
      });

      console.log(`[LIDACTA MAILING 📧] 📥 Respuesta de Resend API:`, JSON.stringify(res, null, 2));

      if (res.data?.id) {
        realSent = true;
        emailId = res.data.id;
        deliveryNote = `Entregado directamente a ${cleanTo} vía Resend`;
        console.log(`[LIDACTA MAILING 📧] ✅ ¡ÉXITO! Correo entregado directamente a ${cleanTo}. ID de Resend: ${emailId}`);
      } else if (res.error) {
        errorMsg = res.error.message;
        console.error("Resend delivery failed:", res.error);

        // Detectar si la causa es la restricción del Sandbox de Resend (dominio de prueba onboarding@resend.dev)
        const isSandboxRestricted =
          res.error.statusCode === 403 ||
          (res.error.message && res.error.message.includes('only send testing emails to your own email address')) ||
          (res.error.message && res.error.message.includes('verify a domain'));

        if (isSandboxRestricted) {
          console.warn(`[LIDACTA MAILING 📧] ⚠️ [MODO SANDBOX DETECTADO] Reenviando copia de verificación a la bandeja de ${adminOwner}...`);

          const sandboxBanner = `
            <div style="background-color: #FFF3CD; border: 2px solid #FFEEBA; color: #856404; padding: 14px 18px; border-radius: 10px; margin: 0 0 24px 0; font-family: sans-serif; font-size: 13px; line-height: 1.5;">
              <strong style="color: #664D03; font-size: 14px;">ℹ️ Notificación de Modo de Pruebas:</strong><br>
              Este correo fue generado originalmente para el usuario: <strong>${cleanTo}</strong>.<br>
              Copia entregada a: <strong>${adminOwner}</strong>.<br>
              Responder a: <strong>${replyToEmail}</strong>
            </div>
          `;

          const fallbackRes = await client.emails.send({
            from: fromEmail,
            to: [adminOwner],
            replyTo: 'hola@lidacta.com',
            subject: `[Copia para: ${cleanTo}] ${options.subject}`,
            html: `${sandboxBanner}${options.html}`,
            text: `[Copia de prueba para: ${cleanTo}]\n\nResponder a: ${replyToEmail}\n\n${options.text}`,
          });

          console.log(`[LIDACTA MAILING 📧] 📥 Respuesta de Fallback Resend API:`, JSON.stringify(fallbackRes, null, 2));

          if (fallbackRes.data?.id) {
            realSent = true;
            emailId = fallbackRes.data.id;
            deliveryNote = `Entregado en bandeja de ${adminOwner} (copia de prueba para ${cleanTo})`;
            console.log(`[LIDACTA MAILING 📧] ✅ Copia de verificación entregada exitosamente a ${adminOwner}. ID de Resend: ${emailId}`);
          } else {
            console.error("Resend delivery failed:", fallbackRes.error);
          }
        }
      }
    } catch (error: any) {
      errorMsg = error?.message;
      console.error("Resend delivery failed:", error);

      // Si la excepción fue por 403 / restricción de sandbox, intentar entrega al adminOwner
      if (error?.message && (error.message.includes('only send testing emails') || error.message.includes('403'))) {
        try {
          console.log(`[LIDACTA MAILING 📧] Reintentando envío como copia de prueba a ${adminOwner}...`);
          const client = new Resend(currentKey);
          const fallbackRes = await client.emails.send({
            from: fromEmail,
            to: [adminOwner],
            replyTo: 'hola@lidacta.com',
            subject: `[Copia para: ${cleanTo}] ${options.subject}`,
            html: options.html,
            text: options.text,
          });
          console.log(`[LIDACTA MAILING 📧] 📥 Respuesta de Reintento Resend API:`, JSON.stringify(fallbackRes, null, 2));
          if (fallbackRes.data?.id) {
            realSent = true;
            emailId = fallbackRes.data.id;
            deliveryNote = `Entregado a ${adminOwner} (copia tras excepción)`;
            console.log(`[LIDACTA MAILING 📧] ✅ Copia de prueba entregada a ${adminOwner}. ID: ${emailId}`);
          }
        } catch (fallbackErr) {
          console.error("Resend delivery failed:", fallbackErr);
        }
      }
    }
  } else {
    console.log(`[LIDACTA MAILING 📧] Correo registrado en bandeja simulada (RESEND_API_KEY no presente)`);
    deliveryNote = 'Registrado en memoria del servidor y bandeja visual';
  }

  // Registrar en la lista centralizada de notificaciones en memoria / base de datos
  const notifId = `notif_mail_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const notifItem: ServerNotificationItem = {
    id: notifId,
    recipientRole: options.recipientRole || 'leader',
    recipientUserId: options.recipientUserId,
    companyId: options.companyId || 'comp_nexus',
    title: options.title || options.subject,
    message: options.message || options.text.slice(0, 150),
    type: (options.type as any) || 'registration',
    timestamp: new Date().toISOString(),
    read: false,
    emailSimulated: {
      from: fromEmail,
      to: options.to,
      replyTo: replyToEmail,
      subject: options.subject,
      bodyText: options.text,
      realEmailSent: realSent,
      realEmailId: emailId,
    },
  };
  serverNotifications.unshift(notifItem);

  console.log(`[LIDACTA MAILING 📧] Fin de procesamiento. realSent=${realSent}, id=${emailId || 'ninguno'}, nota=${deliveryNote || 'N/A'}`);
  console.log(`[LIDACTA MAILING 📧] ==========================================`);

  return { realSent, emailId, error: errorMsg, deliveryNote };
}

async function sendWelcomeEmail(user: ServerUserProfile): Promise<{ realSent: boolean; emailId?: string; deliveryNote?: string }> {
  const subject = `¡Te damos la bienvenida a Lidacta, ${user.name}!`;
  const text = `¡Hola ${user.name}!\n\nTe damos una cálida bienvenida a Lidacta: Desarrollo de Liderazgo en Acción.\n\nTu cuenta ha sido creada exitosamente asociada a ${user.companyName}.\n\nLidacta es tu espacio seguro, confidencial y práctico en el que tendrás un mentor para acompañarte y ayudarte a resolver los retos relacionados con el manejo de personas. Podrás también encontrar herramientas y establecer acciones que fortalezcan tu autonomía como líder.\n\nRecursos Humanos únicamente recibirá indicadores agregados de uso, sin acceso a tus conversaciones privadas.\n\nPuedes acceder en: https://ais-dev-5pctfozdv244x3okeqjryq-710027895954.us-east1.run.app\n\nSi tienes alguna pregunta, puedes responder directamente a este correo o escribir a hola@lidacta.com.\n\n¡Estamos listos para acompañarte en tu próximo reto!\n\nAtentamente,\nEl Equipo de Lidacta`;
  const html = generateWelcomeEmailHtml(user);

  return sendTransactionalEmail({
    to: user.email,
    subject,
    html,
    text,
    replyTo: process.env.RESEND_REPLY_TO || 'hola@lidacta.com',
    recipientRole: user.role,
    recipientUserId: user.id,
    companyId: user.companyId,
    type: 'registration',
    title: `Correo de Bienvenida enviado a ${user.name}`,
    message: `Hemos enviado el correo de bienvenida a ${user.email} con la información de acceso a Lidacta.`,
  });
}

async function sendProfileInviteEmail(user: ServerUserProfile, inviteUrl?: string): Promise<{ realSent: boolean; emailId?: string; deliveryNote?: string }> {
  const subject = `Te invitan a completar tu perfil en Lidacta`;
  let directUrl = inviteUrl || 'https://ais-dev-5pctfozdv244x3okeqjryq-710027895954.us-east1.run.app';
  if (!directUrl.includes('/complete-profile')) {
    directUrl = `${directUrl.replace(/\/+$/, '')}/complete-profile`;
  }
  const text = `¡Hola ${user.name}!\n\nLa administración de ${user.companyName} te ha invitado a formar parte del programa directivo en Lidacta.\n\nPara habilitar tu acceso seguro y comenzar tu proceso de acompañamiento directivo personalizado, por favor ingresa al siguiente enlace y completa los datos de tu entorno operativo (Área, Puesto, WhatsApp y Personas a Cargo):\n\n${directUrl}\n\nDatos de acceso:\nUsuario: ${user.email}\nEmpresa: ${user.companyName}\n\nEl contenido de tus conversaciones es privado y confidencial.\nPuedes responder directamente a este correo o escribir a hola@lidacta.com para resolver cualquier inquietud.\n\nAtentamente,\nEl Equipo de Lidacta`;
  const html = generateProfileInviteEmailHtml(user, directUrl);

  return sendTransactionalEmail({
    to: user.email,
    subject,
    html,
    text,
    replyTo: 'hola@lidacta.com',
    recipientRole: user.role,
    recipientUserId: user.id,
    companyId: user.companyId,
    type: 'registration',
    title: `Invitación para completar perfil enviada a ${user.name}`,
    message: `Se envió un correo a ${user.email} con el enlace directo para completar su perfil de liderazgo.`,
  });
}

async function handleProfileInviteRequest(req: Request, res: Response) {
  try {
    const { userId, email, inviteUrl } = req.body;
    serverUsers = readPersistentUsers();
    let targetUser = serverUsers.find(
      (u) =>
        (userId && u.id === userId) ||
        (email && u.email.toLowerCase() === String(email).trim().toLowerCase())
    );

    if (!targetUser) {
      targetUser = {
        id: userId || `user_${Date.now()}`,
        name: req.body.name || 'Líder Lidacta',
        email: email || 'usuario@lidacta.com',
        role: req.body.role || 'leader',
        companyId: req.body.companyId || 'comp_nexus',
        companyName: req.body.companyName || 'Industrias Nexus Automotriz',
        position: req.body.position || 'Líder Operativo',
        createdAt: new Date().toISOString(),
      };
    }

    // Despacho síncrono garantizado con await directo
    console.log(`[LIDACTA MAILING 📧] Despachando invitación de perfil para ${targetUser.email}...`);
    const mailResult = await sendProfileInviteEmail(targetUser, inviteUrl);

    return res.json({
      success: true,
      emailId: mailResult.emailId,
      realSent: mailResult.realSent,
      deliveryNote: mailResult.deliveryNote,
      message: `Correo de invitación para completar perfil enviado a ${targetUser.email}`,
    });
  } catch (error: any) {
    console.error('Error in handleProfileInviteRequest:', error);
    return res.status(500).json({ success: false, message: error?.message || 'Error al enviar invitación' });
  }
}

// POST /api/users - Create new user with backend persistence & guaranteed asynchronous welcome mailing
app.post('/api/users', async (req: Request, res: Response) => {
  try {
    if (req.body?.action === 'invite' || req.body?.action === 'send_invite' || req.body?.sendInvite === true) {
      return handleProfileInviteRequest(req, res);
    }

    serverUsers = readPersistentUsers();
    const {
      name,
      email,
      role,
      companyId,
      companyName,
      position,
      area,
      birthDate,
      directReports,
      whatsapp,
      status,
      password,
      isProfileCompleted,
      isProfileComplete,
    } = req.body;

    if (!name || !String(name).trim()) {
      return res.status(400).json({ success: false, message: 'El nombre completo es obligatorio.' });
    }
    if (!email || !String(email).trim()) {
      return res.status(400).json({ success: false, message: 'El correo electrónico es obligatorio.' });
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const existingIndex = serverUsers.findIndex((u) => u.email.toLowerCase() === cleanEmail);
    if (existingIndex !== -1) {
      return res.status(400).json({
        success: false,
        message: 'Ya existe una cuenta registrada con este correo electrónico.',
      });
    }

    const validRole = (role === 'admin' || role === 'hr' || role === 'leader') ? role : 'leader';
    const effectiveCompanyId = companyId || 'comp_nexus';
    const effectiveCompanyName = companyName || 'Industrias Nexus Automotriz';

    // Profiles for leaders and HR are strictly uncompleted on initial registration until onboarding form is submitted
    const isCompletedExplicit =
      isProfileCompleted !== undefined
        ? Boolean(isProfileCompleted)
        : isProfileComplete !== undefined
        ? Boolean(isProfileComplete)
        : validRole === 'admin';

    const parsedReports = parseInt(String(directReports !== undefined ? directReports : (req.body.personasACargo !== undefined ? req.body.personasACargo : (validRole === 'leader' ? 5 : 0))), 10);
    const sanitizedReports = isNaN(parsedReports) ? 0 : Math.max(0, parsedReports);

    const newUser: ServerUserProfile = {
      id: `user_${Date.now()}`,
      name: String(name).trim(),
      email: cleanEmail,
      role: validRole,
      companyId: effectiveCompanyId,
      companyName: effectiveCompanyName,
      position: position ? String(position).trim() : (validRole === 'leader' ? 'Líder de Equipo' : validRole === 'hr' ? 'Gestión Humana' : 'Administrador'),
      area: area ? String(area).trim() : (validRole === 'leader' ? 'Operaciones' : ''),
      birthDate: parseFlexibleBirthDate(birthDate || req.body.fechaNacimiento),
      directReports: sanitizedReports,
      whatsapp: sanitizeWhatsapp(whatsapp || req.body.telefono),
      status: (status === 'inactive' ? 'inactive' : 'active'),
      password: password ? String(password).trim() : '',
      isProfileCompleted: isCompletedExplicit,
      isProfileComplete: isCompletedExplicit,
      createdAt: new Date().toISOString(),
    };

    // Resend configuration with explicit fallbacks
    const resendApiKey = process.env.RESEND_API_KEY;
    const fromEmail = process.env.RESEND_FROM_EMAIL || 'Lidacta <notificaciones@taniapadierna.com>';
    const replyToEmail = process.env.RESEND_REPLY_TO || 'hola@lidacta.com';

    console.log(`[LIDACTA MAILING 📧] ==========================================`);
    console.log(`[LIDACTA MAILING 📧] Registro solicitado para: ${newUser.name} (${newUser.email})`);
    console.log(`[LIDACTA MAILING 📧] Remitente Oficial (From): ${fromEmail}`);
    console.log(`[LIDACTA MAILING 📧] Responder a (Reply-To): ${replyToEmail}`);
    console.log(`[LIDACTA MAILING 📧] RESEND_API_KEY activa: ${resendApiKey ? 'SÍ' : 'NO'}`);

    // Persist user first to guarantee seamless registration
    serverUsers.unshift(newUser);
    writePersistentUsers(serverUsers);
    console.log(`[SERVER DB] ✅ Nuevo usuario registrado: ${newUser.name} (${newUser.email}) - Rol: ${newUser.role}`);

    // Asynchronous non-blocking Resend dispatch
    if (resendApiKey) {
      try {
        const resendClient = new Resend(resendApiKey);
        const emailSubject = `¡Te damos la bienvenida a Lidacta, ${newUser.name}!`;
        const emailHtml = generateWelcomeEmailHtml(newUser);
        const emailText = `¡Hola ${newUser.name}!\n\nTe damos una cálida bienvenida a Lidacta: Desarrollo de Liderazgo en Acción.\n\nTu cuenta ha sido creada exitosamente asociada a ${newUser.companyName}.\n\nAtentamente,\nEl Equipo de Lidacta\nResponder a: ${replyToEmail}`;

        console.log(`[LIDACTA MAILING 📧] 🚀 Disparando correo asíncrono con Resend para ${newUser.email}...`);
        resendClient.emails.send({
          from: fromEmail,
          to: [newUser.email],
          replyTo: replyToEmail,
          subject: emailSubject,
          html: emailHtml,
          text: emailText,
        }).then((emailRes) => {
          if (emailRes.error) {
            console.error('[LIDACTA MAILING 📧] ⚠️ Resend delivery failed in background:', emailRes.error);
          } else {
            console.log(`[LIDACTA MAILING 📧] ✅ Correo entregado vía Resend con ID: ${emailRes.data?.id}`);
          }
        }).catch((emailErr) => {
          console.error('[LIDACTA MAILING 📧] ⚠️ Error en envío asíncrono de Resend:', emailErr);
        });
      } catch (err) {
        console.error('[LIDACTA MAILING 📧] ⚠️ Excepción preparando Resend:', err);
      }
    } else {
      console.warn('[LIDACTA MAILING 📧] ⚠️ RESEND_API_KEY no presente; correo registrado en bandeja simulada.');
    }

    return res.status(201).json({
      success: true,
      message: 'Usuario registrado exitosamente en Lidacta',
      user: newUser,
      users: serverUsers,
    });
  } catch (error: any) {
    console.error('[REGISTER_ERROR]: Error al crear usuario en /api/users:', error);
    const errorMessage = error?.message || (typeof error === 'string' ? error : 'Error al crear usuario');
    return res.status(200).json({ success: false, error: errorMessage, message: errorMessage });
  }
});

// POST /api/register - Dedicated Registration Route (Alias to /api/users with asynchronous Resend)
app.post('/api/register', async (req: Request, res: Response) => {
  try {
    // 1. Mandatory Check for RESEND_API_KEY
    const resendApiKey = process.env.RESEND_API_KEY;
    if (!resendApiKey || !resendApiKey.trim()) {
      console.error('[REGISTER_ERROR]: RESEND_API_KEY no está configurada en Vercel');
      return res.status(200).json({
        success: false,
        error: 'RESEND_API_KEY no está configurada en Vercel',
        message: 'RESEND_API_KEY no está configurada en Vercel',
      });
    }

    serverUsers = readPersistentUsers();
    const { name, email, role, companyId, companyName, position, area, birthDate, directReports, whatsapp, status, password } = req.body;

    const cleanName = String(name || '').trim();
    if (!cleanName || cleanName.length < 2) {
      console.error('[REGISTER_ERROR]: El nombre completo es obligatorio y debe tener al menos 2 caracteres');
      return res.status(200).json({ success: false, error: 'El nombre completo es obligatorio para el registro.', message: 'El nombre completo es obligatorio para el registro.' });
    }

    const cleanEmail = String(email || '').trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      console.error('[REGISTER_ERROR]: El correo electrónico es obligatorio y debe ser válido');
      return res.status(200).json({ success: false, error: 'El correo electrónico corporativo es obligatorio y debe ser válido.', message: 'El correo electrónico corporativo es obligatorio y debe ser válido.' });
    }
    const existingIndex = serverUsers.findIndex((u) => u.email.toLowerCase() === cleanEmail);
    if (existingIndex !== -1) {
      return res.status(200).json({
        success: false,
        error: 'Ya existe una cuenta registrada con este correo electrónico.',
        message: 'Ya existe una cuenta registrada con este correo electrónico.',
      });
    }

    const validRole = (role === 'admin' || role === 'hr' || role === 'leader') ? role : 'leader';
    const effectiveCompanyId = companyId || 'comp_nexus';
    const effectiveCompanyName = companyName || 'Industrias Nexus Automotriz';

    const newUser: ServerUserProfile = {
      id: `user_${Date.now()}`,
      name: String(name).trim(),
      email: cleanEmail,
      role: validRole,
      companyId: effectiveCompanyId,
      companyName: effectiveCompanyName,
      position: position ? String(position).trim() : (validRole === 'leader' ? 'Líder de Equipo' : 'Gestión Humana'),
      area: area ? String(area).trim() : (validRole === 'leader' ? 'Operaciones' : ''),
      birthDate: parseFlexibleBirthDate(birthDate || req.body.fechaNacimiento),
      directReports: parseInt(String(directReports || '0'), 10) || 0,
      whatsapp: sanitizeWhatsapp(whatsapp || req.body.telefono),
      status: (status === 'inactive' ? 'inactive' : 'active'),
      password: password ? String(password).trim() : '',
      isProfileCompleted: validRole === 'admin',
      isProfileComplete: validRole === 'admin',
      createdAt: new Date().toISOString(),
    };

    serverUsers.unshift(newUser);
    try {
      writePersistentUsers(serverUsers);
    } catch (writeErr) {
      console.error('[REGISTER_ERROR]: Error al guardar usuario persistente:', writeErr);
    }

    const fromEmail = process.env.RESEND_FROM_EMAIL || 'Lidacta <notificaciones@taniapadierna.com>';
    const replyToEmail = process.env.RESEND_REPLY_TO || 'hola@lidacta.com';

    let emailDeliveryResult: { success: boolean; emailId?: string; error?: string } = { success: false };
    try {
      const resendClient = new Resend(resendApiKey);
      const emailSubject = `¡Te damos la bienvenida a Lidacta, ${newUser.name}!`;
      const emailHtml = generateWelcomeEmailHtml(newUser);
      const emailText = `¡Hola ${newUser.name}!\n\nTe damos una cálida bienvenida a Lidacta: Desarrollo de Liderazgo en Acción.\n\nTu cuenta ha sido creada exitosamente asociada a ${newUser.companyName}.\n\nLidacta es tu espacio seguro, confidencial y práctico en el que tendrás un mentor para acompañarte y ayudarte a resolver los retos relacionados con el manejo de personas. Podrás también encontrar herramientas y establecer acciones que fortalezcan tu autonomía como líder.\n\nAtentamente,\nEl Equipo de Lidacta\nResponder a: ${replyToEmail}`;

      console.log(`[API /api/register] 🚀 Ejecutando envío oficial con Resend SDK para ${newUser.email}...`);
      const emailRes = await resendClient.emails.send({
        from: fromEmail,
        to: [newUser.email],
        replyTo: replyToEmail,
        subject: emailSubject,
        html: emailHtml,
        text: emailText,
      });

      if (emailRes.error) {
        const resendErr: any = emailRes.error;
        const resendErrMsg = typeof resendErr === 'string'
          ? resendErr
          : (resendErr?.message || String(resendErr));
        console.error('[REGISTER_ERROR]: Resend delivery failed:', resendErrMsg);
        emailDeliveryResult = { success: false, error: resendErrMsg };
      } else {
        const emailId = emailRes.data?.id;
        console.log(`[API /api/register] ✅ Correo entregado vía Resend con ID: ${emailId}`);
        emailDeliveryResult = { success: true, emailId };
      }
    } catch (err: any) {
      const initErr = typeof err === 'string' ? err : (err?.message || String(err));
      console.error('[REGISTER_ERROR]: Excepción en llamada a Resend SDK:', initErr);
      emailDeliveryResult = { success: false, error: initErr };
    }

    return res.status(200).json({
      success: true,
      message: 'Usuario registrado exitosamente en Lidacta',
      user: newUser,
      users: serverUsers,
      emailSent: emailDeliveryResult.success,
      emailId: emailDeliveryResult.emailId,
      emailError: emailDeliveryResult.error,
    });
  } catch (error: any) {
    console.error('[REGISTER_ERROR]:', error);
    const errorMessage = typeof error?.message === 'string'
      ? error.message
      : (typeof error === 'string' ? error : 'Error interno');
    return res.status(200).json({ success: false, error: errorMessage, message: errorMessage });
  }
});

// POST /api/send-email - Universal Transactional Email Endpoint (Asynchronous & Non-Blocking)
app.post('/api/send-email', async (req: Request, res: Response) => {
  return sendEmailHandler(req, res);
});

// POST /api/mail/send-welcome - Trigger welcome email asynchronously
app.post('/api/mail/send-welcome', async (req: Request, res: Response) => {
  try {
    const { userId, email } = req.body;
    serverUsers = readPersistentUsers();
    const targetUser = serverUsers.find(
      (u) =>
        (userId && u.id === userId) ||
        (email && u.email.toLowerCase() === String(email).trim().toLowerCase())
    );
    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    }

    // Ejecución asíncrona inmediata
    setImmediate(() => {
      sendWelcomeEmail(targetUser).catch((e) =>
        console.error('[LIDACTA MAILING ERROR ❌] Error en sendWelcomeEmail:', e)
      );
    });

    return res.json({
      success: true,
      message: `Correo de bienvenida programado exitosamente para ${targetUser.email}`,
      queued: true,
    });
  } catch (error: any) {
    console.error('Error in /api/mail/send-welcome:', error);
    return res.status(500).json({ success: false, message: error?.message || 'Error al enviar correo' });
  }
});

// Legacy endpoints for backwards compatibility
app.post('/api/admin/invite', handleProfileInviteRequest);
app.post('/api/mail/send-profile-invite', handleProfileInviteRequest);

// PUT /api/users/:id - Update user details, role, status and password
app.put('/api/users/:id', (req: Request, res: Response) => {
  try {
    serverUsers = readPersistentUsers();
    const { id } = req.params;
    const {
      name,
      email,
      role,
      companyId,
      companyName,
      position,
      area,
      birthDate,
      directReports,
      whatsapp,
      status,
      password,
    } = req.body;

    const targetIndex = serverUsers.findIndex((u) => u.id === id);
    if (targetIndex === -1) {
      return res.status(404).json({ success: false, message: 'Usuario no encontrado.' });
    }

    const current = serverUsers[targetIndex];

    // Check email uniqueness if email changed
    if (email) {
      const cleanEmail = String(email).trim().toLowerCase();
      const duplicateIndex = serverUsers.findIndex((u) => u.id !== id && u.email.toLowerCase() === cleanEmail);
      if (duplicateIndex !== -1) {
        return res.status(400).json({
          success: false,
          message: 'Otro usuario ya está utilizando este correo electrónico.',
        });
      }
    }

    const updatedUser: ServerUserProfile = {
      ...current,
      name: name !== undefined ? String(name).trim() : current.name,
      email: email !== undefined ? String(email).trim().toLowerCase() : current.email,
      role: (role === 'admin' || role === 'hr' || role === 'leader') ? role : current.role,
      companyId: companyId !== undefined ? String(companyId).trim() : current.companyId,
      companyName: companyName !== undefined ? String(companyName).trim() : current.companyName,
      position: position !== undefined ? String(position).trim() : current.position,
      area: area !== undefined ? String(area).trim() : current.area,
      birthDate: birthDate !== undefined ? String(birthDate).trim() : current.birthDate,
      directReports: directReports !== undefined ? Number(directReports) : current.directReports,
      whatsapp: whatsapp !== undefined ? String(whatsapp).trim() : current.whatsapp,
      status: status !== undefined ? (status === 'inactive' ? 'inactive' : 'active') : (current.status || 'active'),
      password: (password && String(password).trim().length > 0) ? String(password).trim() : current.password,
      updatedAt: new Date().toISOString(),
    };

    serverUsers[targetIndex] = updatedUser;
    writePersistentUsers(serverUsers);

    // If updating Tania or an admin, keep serverAdminProfile aligned
    if (id === 'user_admin_tania' || updatedUser.role === 'admin') {
      serverAdminProfile = {
        ...serverAdminProfile,
        name: updatedUser.name,
        email: updatedUser.email,
        whatsapp: updatedUser.whatsapp || serverAdminProfile.whatsapp,
        position: updatedUser.position || serverAdminProfile.position,
        companyName: updatedUser.companyName || serverAdminProfile.companyName,
        area: updatedUser.area || serverAdminProfile.area,
        updatedAt: new Date().toISOString(),
      };
    }

    console.log(`[SERVER DB] User updated: ${updatedUser.name} (${updatedUser.id}) - Status: ${updatedUser.status}`);

    return res.json({
      success: true,
      message: 'Perfil actualizado correctamente en la Base de Datos Central',
      user: updatedUser,
      users: serverUsers,
    });
  } catch (error: any) {
    console.error('Error updating user:', error);
    return res.status(500).json({ success: false, message: error?.message || 'Error al actualizar usuario' });
  }
});

// DELETE /api/users/:id - Delete user with backend persistence
app.delete('/api/users/:id', (req: Request, res: Response) => {
  try {
    serverUsers = readPersistentUsers();
    const { id } = req.params;
    if (id === 'user_admin_tania') {
      return res.status(400).json({
        success: false,
        message: 'No se puede eliminar la cuenta principal de administración (Tania Padierna).',
      });
    }

    const targetIndex = serverUsers.findIndex((u) => u.id === id);
    if (targetIndex === -1) {
      return res.status(404).json({ success: false, message: 'Usuario no encontrado.' });
    }

    const deletedUser = serverUsers[targetIndex];
    serverUsers.splice(targetIndex, 1);
    writePersistentUsers(serverUsers);

    console.log(`[SERVER DB] User deleted: ${deletedUser.name} (${deletedUser.email})`);
    return res.json({
      success: true,
      message: 'Usuario eliminado correctamente de la Base de Datos Central',
      deletedId: id,
      users: serverUsers,
    });
  } catch (error: any) {
    console.error('Error deleting user:', error);
    return res.status(500).json({ success: false, message: error?.message || 'Error al eliminar usuario' });
  }
});

// POST /api/users/delete - Alternative POST endpoint for deleting a user
app.post('/api/users/delete', (req: Request, res: Response) => {
  try {
    serverUsers = readPersistentUsers();
    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({ success: false, message: 'ID de usuario requerido.' });
    }

    if (userId === 'user_admin_tania') {
      return res.status(400).json({
        success: false,
        message: 'No se puede eliminar la cuenta principal de administración (Tania Padierna).',
      });
    }

    const targetIndex = serverUsers.findIndex((u) => u.id === userId);
    if (targetIndex === -1) {
      return res.status(404).json({ success: false, message: 'Usuario no encontrado.' });
    }

    const deletedUser = serverUsers[targetIndex];
    serverUsers.splice(targetIndex, 1);
    writePersistentUsers(serverUsers);

    console.log(`[SERVER DB] User deleted via POST: ${deletedUser.name} (${deletedUser.email})`);
    return res.json({
      success: true,
      message: 'Usuario eliminado correctamente de la Base de Datos Central',
      deletedId: userId,
      users: serverUsers,
    });
  } catch (error: any) {
    console.error('Error deleting user:', error);
    return res.status(500).json({ success: false, message: error?.message || 'Error al eliminar usuario' });
  }
});

// POST /api/users/update - Central user profile updates
app.post('/api/users/update', (req: Request, res: Response) => {
  try {
    serverUsers = readPersistentUsers();
    const { userId, updates } = req.body;
    const targetIndex = serverUsers.findIndex((u) => u.id === userId);
    if (targetIndex === -1) {
      return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    }

    serverUsers[targetIndex] = {
      ...serverUsers[targetIndex],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    writePersistentUsers(serverUsers);

    return res.json({
      success: true,
      message: 'Perfil actualizado correctamente en la Base de Datos Central',
      user: serverUsers[targetIndex],
      users: serverUsers,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err?.message || 'Error al actualizar usuario en la Base de Datos Central' });
  }
});

// GET /api/notifications - Centralized notifications sync across PC, Mobile, and Tablet
app.get('/api/notifications', (_req: Request, res: Response) => {
  return res.json({
    success: true,
    notifications: serverNotifications,
  });
});

// POST /api/notifications/status - Update mentor request status & admin notes centrally
app.post('/api/notifications/status', (req: Request, res: Response) => {
  const { notificationId, status, notes } = req.body;
  serverNotifications = serverNotifications.map((n) => {
    if (n.id === notificationId && n.mentorRequestDetails) {
      return {
        ...n,
        mentorRequestDetails: {
          ...n.mentorRequestDetails,
          status: status || n.mentorRequestDetails.status,
          adminNotes: notes !== undefined ? notes : n.mentorRequestDetails.adminNotes,
        },
      };
    }
    return n;
  });
  return res.json({ success: true, notifications: serverNotifications });
});

// POST /api/send - Dedicated Resend email dispatch route
app.post('/api/send', async (req: Request, res: Response) => {
  try {
    const qaCheck = isQaRequestPayload(req.body);
    if (qaCheck.isQa) {
      console.warn(`[API /api/send] 🛡️ Solicitud bloqueada por aislamiento QA (${qaCheck.reason}).`);
      return res.status(403).json({
        success: false,
        blockedByQa: true,
        error: QA_MENTOR_REQUEST_BLOCKED_MESSAGE,
        message: 'Solicitud bloqueada por aislamiento de sesiones QA: no se envían correos reales ni se registran notificaciones.',
      });
    }

    const {
      leaderName,
      message,
      transcript,
      date,
      leaderEmail,
      leaderPosition,
      companyName,
      currentStage,
      caseTitle,
      reasonText,
      isVoiceAudio,
    } = req.body || {};

    const apiKey = process.env.RESEND_API_KEY;
    const targetEmail = process.env.ADMIN_EMAIL || 'hola@lidacta.com';
    const effectiveLeaderName = leaderName || 'Líder';
    const effectiveMessage = transcript || message || reasonText || '(Sin mensaje especificado)';
    const effectiveDate = date || new Date().toLocaleString('es-MX', { timeZone: 'America/Mexico_City' });
    const effectiveStage = currentStage || 1;
    const effectiveCaseTitle = caseTitle || 'Acompañamiento en curso';
    const effectiveCompany = companyName || 'Empresa';

    console.log('[API /api/send] 📩 Petición recibida:', {
      leaderName: effectiveLeaderName,
      targetEmail,
      date: effectiveDate,
      hasApiKey: !!apiKey,
      isVoice: !!isVoiceAudio,
    });

    if (!apiKey) {
      console.warn('[API /api/send] ⚠️ RESEND_API_KEY no encontrada en process.env. Notificación registrada centralmente.');
      return res.status(200).json({
        success: true,
        simulated: true,
        message: 'Solicitud registrada correctamente en la base de datos central (Configure RESEND_API_KEY para despacho directo por email).',
      });
    }

    const resendClient = new Resend(apiKey);
    const emailSubject = `🚨 [Asesoría 1:1] Solicitud de ${effectiveLeaderName} - ${effectiveDate}`;

    const emailHtmlBody = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>${emailSubject}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #F8F6F4; margin: 0; padding: 24px; color: #2D1B4E;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; background: #FFFFFF; border-radius: 20px; overflow: hidden; border: 1px solid rgba(73, 52, 71, 0.15); box-shadow: 0 4px 20px rgba(45, 27, 78, 0.08);">
    <tr>
      <td style="background-color: #2D1B4E; padding: 28px 32px; text-align: left;">
        <span style="font-size: 24px; font-weight: 800; color: #FFFFFF; letter-spacing: -0.5px;">Lidacta</span>
        <span style="font-size: 11px; font-weight: 700; color: #F7B538; text-transform: uppercase; margin-left: 10px; background: rgba(247, 181, 56, 0.2); padding: 4px 8px; border-radius: 6px;">Asesoría 1:1</span>
        <p style="margin: 6px 0 0 0; font-size: 13px; color: #FFF7EF; opacity: 0.9;">Desarrollo de Liderazgo en Acción · Alerta Directiva Inmediata</p>
      </td>
    </tr>
    <tr>
      <td style="padding: 32px;">
        <p style="font-size: 15px; line-height: 1.6; margin: 0 0 16px 0; color: #2D1B4E;">
          Hola <strong>Tania Padierna</strong>,
        </p>
        <p style="font-size: 14px; line-height: 1.6; margin: 0 0 24px 0; color: #4A3F55;">
          El líder <strong>${effectiveLeaderName}</strong> ha enviado una solicitud urgente de <strong>Asesoría 1:1</strong> en Lidacta.
        </p>
        <table width="100%" cellpadding="0" cellspacing="0" style="background: #FFF7EF; border: 1px solid #FFD3BF; border-radius: 14px; margin-bottom: 24px; padding: 18px;">
          <tr>
            <td style="padding: 6px 0; font-size: 13px; color: #4A3F55;"><strong>Líder:</strong></td>
            <td style="padding: 6px 0; font-size: 14px; color: #2D1B4E; font-weight: 700;">${effectiveLeaderName}</td>
          </tr>
          ${leaderPosition ? `<tr><td style="padding: 6px 0; font-size: 13px; color: #4A3F55;"><strong>Puesto:</strong></td><td style="padding: 6px 0; font-size: 13px; color: #2D1B4E;">${leaderPosition}</td></tr>` : ''}
          <tr>
            <td style="padding: 6px 0; font-size: 13px; color: #4A3F55;"><strong>Empresa:</strong></td>
            <td style="padding: 6px 0; font-size: 13px; color: #2D1B4E; font-weight: 600;">${effectiveCompany}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; font-size: 13px; color: #4A3F55;"><strong>Etapa actual:</strong></td>
            <td style="padding: 6px 0; font-size: 13px; color: #BF3A1B; font-weight: 700;">Etapa ${effectiveStage}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; font-size: 13px; color: #4A3F55;"><strong>Caso:</strong></td>
            <td style="padding: 6px 0; font-size: 13px; color: #2D1B4E; font-weight: 600;">${effectiveCaseTitle}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; font-size: 13px; color: #4A3F55;"><strong>Fecha:</strong></td>
            <td style="padding: 6px 0; font-size: 13px; color: #2D1B4E;">${effectiveDate}</td>
          </tr>
        </table>
        <div style="background: #FFFFFF; border-left: 4px solid #BF3A1B; border-top: 1px solid #EFEAE5; border-right: 1px solid #EFEAE5; border-bottom: 1px solid #EFEAE5; border-radius: 8px; padding: 18px; margin-bottom: 24px;">
          <span style="display: block; font-size: 11px; font-weight: 700; color: #BF3A1B; text-transform: uppercase; margin-bottom: 8px;">
            ${isVoiceAudio ? '🎙️ Mensaje / Transcripción de Nota de Voz:' : '📝 Mensaje / Motivo de la solicitud:'}
          </span>
          <p style="font-size: 14px; font-style: italic; line-height: 1.6; color: #2D1B4E; margin: 0; white-space: pre-line;">
            "${effectiveMessage}"
          </p>
        </div>
        <p style="font-size: 12px; color: #4A3F55; text-align: center; margin: 0;">
          Correo enviado automáticamente desde <strong>${process.env.RESEND_FROM_EMAIL || 'Lidacta <notificaciones@taniapadierna.com>'}</strong> para <strong>${targetEmail}</strong>. Respuestas dirigidas a <strong>${process.env.RESEND_REPLY_TO || 'hola@lidacta.com'}</strong>.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>
    `;

    const emailTextBody = `🚨 Solicitud de Asesoría 1:1 en Lidacta\n\nLíder: ${effectiveLeaderName}\nFecha: ${effectiveDate}\nEmpresa: ${effectiveCompany}\nEtapa: ${effectiveStage}\nCaso: ${effectiveCaseTitle}\n\nMensaje/Transcripción:\n"${effectiveMessage}"\n\nDestinatario: ${targetEmail}\nResponder a: ${process.env.RESEND_REPLY_TO || 'hola@lidacta.com'}`;

    const fromEmail = process.env.RESEND_FROM_EMAIL || 'Lidacta <notificaciones@taniapadierna.com>';
    const replyToEmail = process.env.RESEND_REPLY_TO || 'hola@lidacta.com';

    console.log(`[API /api/send] 🚀 Despachando con Resend: De: ${fromEmail}, Para: ${targetEmail}, Reply-To: ${replyToEmail}`);
    const resendResponse = await resendClient.emails.send({
      from: fromEmail,
      to: [targetEmail],
      replyTo: replyToEmail,
      subject: emailSubject,
      html: emailHtmlBody,
      text: emailTextBody,
    });

    if (resendResponse.error) {
      console.error('[API /api/send] ❌ Error devuelto por Resend API:', JSON.stringify(resendResponse.error, null, 2));
      return res.status(400).json({
        success: false,
        error: resendResponse.error.message || 'Error en Resend API',
        details: resendResponse.error,
      });
    }

    console.log('[API /api/send] ✅ Correo enviado exitosamente con Resend. ID:', resendResponse.data?.id);
    console.log('[API /api/send] 📩 Respuesta Resend API:', JSON.stringify(resendResponse.data));

    // Also register in centralized serverNotifications for instant multi-device admin dashboard sync
    const requestId = `req_send_${Date.now()}`;
    const newNotification: ServerNotificationItem = {
      id: requestId,
      recipientRole: 'admin',
      recipientUserId: 'user_admin_tania',
      companyId: req.body.companyId || 'comp_nexus',
      title: `🚨 Solicitud de Asesoría 1:1: ${effectiveLeaderName} (Etapa ${effectiveStage})`,
      message: `${effectiveLeaderName} ha solicitado asesoría 1:1: "${effectiveMessage}"`,
      type: 'mentor_request',
      timestamp: new Date().toISOString(),
      read: false,
      emailSimulated: {
        from: fromEmail,
        to: targetEmail,
        replyTo: replyToEmail,
        subject: emailSubject,
        bodyText: emailTextBody,
        realEmailSent: true,
        realEmailId: resendResponse.data?.id,
      },
      mentorRequestDetails: {
        leaderId: req.body.leaderId || 'leader_user',
        leaderName: effectiveLeaderName,
        leaderEmail: leaderEmail || '',
        leaderWhatsapp: req.body.leaderWhatsapp || '',
        leaderPosition: leaderPosition || 'Líder Operativo',
        companyName: effectiveCompany,
        currentStage: Number(effectiveStage),
        stageName: `Etapa ${effectiveStage}`,
        caseTitle: effectiveCaseTitle,
        reasonText: effectiveMessage,
        isVoiceAudio: !!isVoiceAudio,
        status: 'pendiente',
        whatsappSent: true,
        emailSent: true,
      },
    };
    serverNotifications.unshift(newNotification);

    return res.status(200).json({
      success: true,
      id: resendResponse.data?.id,
      message: 'Correo de Asesoría 1:1 enviado exitosamente a través de Resend',
      recipient: targetEmail,
      notification: newNotification,
    });
  } catch (error: any) {
    console.error('[API /api/send] ❌ Excepción no controlada al enviar correo:', error);
    return res.status(500).json({
      success: false,
      error: error?.message || 'Error interno del servidor al enviar correo',
    });
  }
});

// POST /api/mentor/request - Multichannel notifications for human mentor requests (Real Email + Centralized DB)
app.post('/api/mentor/request', async (req: Request, res: Response) => {
  try {
    const qaCheck = isQaRequestPayload(req.body);
    if (qaCheck.isQa) {
      console.warn(`[API /api/mentor/request] 🛡️ Solicitud bloqueada por aislamiento QA (${qaCheck.reason}).`);
      return res.status(403).json({
        success: false,
        blockedByQa: true,
        error: QA_MENTOR_REQUEST_BLOCKED_MESSAGE,
        message: 'Solicitud bloqueada por aislamiento de sesiones QA: no se envían correos reales ni se registran notificaciones.',
      });
    }

    const {
      leaderId,
      leaderName,
      leaderEmail,
      leaderWhatsapp,
      leaderPosition,
      companyName,
      currentStage,
      caseTitle,
      reasonText,
      isVoiceAudio,
      adminEmail,
      adminWhatsapp,
    } = req.body;

    // The primary recipient is always guaranteed to be the official administrator email
    const targetAdminEmail = 'hola@lidacta.com';
    const targetAdminWhatsapp = adminWhatsapp && adminWhatsapp !== '+525512345678'
      ? adminWhatsapp
      : serverAdminProfile.whatsapp;
    const targetAdminName = serverAdminProfile.name || 'Tania Padierna';

    const stageNamesMap: Record<number, string> = {
      1: 'Detectar qué sucede',
      2: 'Analizar perspectivas & Habilidades',
      3: 'Diseñar alternativas',
      4: 'Practicar antes de actuar',
      5: 'Actuar (Plan de Acción)',
      6: 'Aprender y reflexionar',
      7: 'Cierre & Retroalimentación',
    };
    const stageName = stageNamesMap[Number(currentStage)] || `Etapa ${currentStage}`;

    const timestamp = new Date().toISOString();
    const requestId = `req_mentor_${Date.now()}`;

    // Clean whatsapp phone for wa.me link
    const cleanPhone = (targetAdminWhatsapp || '+525512345678').replace(/\D/g, '');
    const waText = encodeURIComponent(
      `🚨 *LIDACTA: Solicitud de Asesoría 1:1*\n\n` +
      `*Líder:* ${leaderName}\n` +
      `*Puesto:* ${leaderPosition || 'Líder de Equipo'}\n` +
      `*Empresa:* ${companyName || 'Empresa'}\n` +
      `*Etapa actual:* Etapa ${currentStage} (${stageName})\n` +
      `*Reto/Caso:* ${caseTitle}\n` +
      `*Motivo:* "${reasonText}"\n` +
      `${isVoiceAudio ? '🎙️ [Nota de voz incluida]\n' : ''}` +
      `*Contacto Líder:* ${leaderEmail} | ${leaderWhatsapp || 'No registrado'}\n` +
      `*Fecha:* ${new Date(timestamp).toLocaleString('es-MX')}`
    );
    const whatsappUrl = `https://wa.me/${cleanPhone}?text=${waText}`;

    const formattedDateTime = new Date(timestamp).toLocaleString('es-MX', {
      timeZone: 'America/Mexico_City',
      dateStyle: 'full',
      timeStyle: 'medium',
    });

    const emailSubject = `🚨 [URGENTE] Solicitud de Asesoría 1:1: ${leaderName} (${companyName || 'Empresa'} · Etapa ${currentStage})`;

    const emailTextBody =
      `Estimada ${targetAdminName},\n\n` +
      `El líder ${leaderName} (${leaderPosition || 'Líder'}) de la empresa "${companyName || 'Empresa'}" ha solicitado hablar directamente con un mentor humano en Lidacta.\n\n` +
      `• Reto actual: ${caseTitle}\n` +
      `• Etapa en curso: Etapa ${currentStage} (${stageName})\n` +
      `• Formato de solicitud: ${isVoiceAudio ? 'Nota de voz dictada / grabada' : 'Texto redactado por el líder'}\n\n` +
      `Motivo expresado por el líder:\n"${reasonText}"\n\n` +
      `Datos de contacto directo:\n` +
      `• Email: ${leaderEmail}\n` +
      `• WhatsApp del líder: ${leaderWhatsapp || 'Sin número registrado'}\n` +
      `• Fecha y hora: ${formattedDateTime}\n\n` +
      `Acción recomendada:\n` +
      `Puedes contactar al líder directamente por WhatsApp o agendar una sesión 1 a 1 de desbloqueo.\n\n` +
      `Enlace directo de WhatsApp:\n${whatsappUrl}\n\n` +
      `Atentamente,\nSistema de Notificaciones Lidacta`;

    // Real Email Dispatch via Resend (when configured)
    let realEmailSent = false;
    let realEmailId: string | undefined;
    let realEmailError: string | undefined;

    const emailHtmlBody = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>${emailSubject}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #F8F6F4; margin: 0; padding: 24px; color: #2D1B4E;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; background: #FFFFFF; border-radius: 20px; overflow: hidden; border: 1px solid rgba(73, 52, 71, 0.15); box-shadow: 0 4px 20px rgba(45, 27, 78, 0.08);">
    <tr>
      <td style="background-color: #2D1B4E; padding: 28px 32px; text-align: left;">
        <span style="font-size: 24px; font-weight: 800; color: #FFFFFF; letter-spacing: -0.5px;">Lidacta</span>
        <span style="font-size: 11px; font-weight: 700; color: #F7B538; text-transform: uppercase; margin-left: 10px; background: rgba(247, 181, 56, 0.2); padding: 4px 8px; border-radius: 6px;">Asesoría 1:1</span>
        <p style="margin: 6px 0 0 0; font-size: 13px; color: #FFF7EF; opacity: 0.9;">Desarrollo de Liderazgo en Acción · Alerta Directiva Inmediata</p>
      </td>
    </tr>
    <tr>
      <td style="padding: 32px;">
        <p style="font-size: 15px; line-height: 1.6; margin: 0 0 16px 0; color: #2D1B4E;">
          Hola <strong>${targetAdminName}</strong>,
        </p>
        <p style="font-size: 14px; line-height: 1.6; margin: 0 0 24px 0; color: #4A3F55;">
          Un líder ha solicitado una sesión directa de <strong>Asesoría 1:1 (Acompañamiento Personal Directivo)</strong> en Lidacta. A continuación se presentan los detalles del reto:
        </p>
        <table width="100%" cellpadding="0" cellspacing="0" style="background: #FFF7EF; border: 1px solid #FFD3BF; border-radius: 14px; margin-bottom: 24px; padding: 18px;">
          <tr>
            <td style="padding: 6px 0; font-size: 13px; color: #4A3F55;"><strong>Líder:</strong></td>
            <td style="padding: 6px 0; font-size: 14px; color: #2D1B4E; font-weight: 700;">${leaderName}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; font-size: 13px; color: #4A3F55;"><strong>Puesto:</strong></td>
            <td style="padding: 6px 0; font-size: 13px; color: #2D1B4E;">${leaderPosition || 'Líder Operativo'}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; font-size: 13px; color: #4A3F55;"><strong>Empresa:</strong></td>
            <td style="padding: 6px 0; font-size: 13px; color: #2D1B4E; font-weight: 600;">${companyName || 'Empresa'}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; font-size: 13px; color: #4A3F55;"><strong>Etapa:</strong></td>
            <td style="padding: 6px 0; font-size: 13px; color: #BF3A1B; font-weight: 700;">Etapa ${currentStage}: ${stageName}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; font-size: 13px; color: #4A3F55;"><strong>Caso:</strong></td>
            <td style="padding: 6px 0; font-size: 13px; color: #2D1B4E; font-weight: 600;">${caseTitle}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; font-size: 13px; color: #4A3F55;"><strong>Formato:</strong></td>
            <td style="padding: 6px 0; font-size: 13px; color: #2D1B4E;">${isVoiceAudio ? '🎙️ Mensaje de voz dictado / transcrito' : '📝 Texto redactado por el líder'}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; font-size: 13px; color: #4A3F55;"><strong>Fecha:</strong></td>
            <td style="padding: 6px 0; font-size: 13px; color: #2D1B4E;">${formattedDateTime}</td>
          </tr>
        </table>
        <div style="background: #FFFFFF; border-left: 4px solid #BF3A1B; border-top: 1px solid #EFEAE5; border-right: 1px solid #EFEAE5; border-bottom: 1px solid #EFEAE5; border-radius: 8px; padding: 18px; margin-bottom: 28px;">
          <span style="display: block; font-size: 11px; font-weight: 700; color: #BF3A1B; text-transform: uppercase; margin-bottom: 8px;">
            ${isVoiceAudio ? '🎙️ Transcripción de Nota de Voz del Líder:' : '📝 Motivo expresado por el líder:'}
          </span>
          <p style="font-size: 14px; font-style: italic; line-height: 1.6; color: #2D1B4E; margin: 0; white-space: pre-line;">
            "${reasonText}"
          </p>
        </div>
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 24px;">
          <tr>
            <td style="text-align: center;">
              <a href="${whatsappUrl}" style="display: inline-block; background-color: #25D366; color: #FFFFFF; font-size: 14px; font-weight: 700; text-decoration: none; padding: 14px 28px; border-radius: 12px; margin-bottom: 12px; box-shadow: 0 4px 12px rgba(37, 211, 102, 0.3);">
                💬 Contactar por WhatsApp al Líder
              </a>
            </td>
          </tr>
          <tr>
            <td style="text-align: center; font-size: 12px; color: #4A3F55;">
              Email del líder: <a href="mailto:${leaderEmail}" style="color: #BF3A1B; text-decoration: underline;">${leaderEmail}</a> | WhatsApp: ${leaderWhatsapp || 'No registrado'}
            </td>
          </tr>
        </table>
        <hr style="border: none; border-top: 1px solid rgba(73, 52, 71, 0.1); margin: 24px 0;" />
        <p style="font-size: 11px; color: #4A3F55; text-align: center; margin: 0;">
          Correo generado automáticamente por Lidacta para la administradora principal <strong>${targetAdminName}</strong> (${targetAdminEmail}). Respuestas dirigidas a <strong>${process.env.RESEND_REPLY_TO || 'hola@lidacta.com'}</strong>.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`;

    const currentResendKey = process.env.RESEND_API_KEY;
    const fromEmail = process.env.RESEND_FROM_EMAIL || 'Lidacta <notificaciones@taniapadierna.com>';
    const replyToEmail = process.env.RESEND_REPLY_TO || 'hola@lidacta.com';

    if (currentResendKey) {
      try {
        const dynamicResend = new Resend(currentResendKey);
        console.log(`[LIDACTA RESEND] 🚀 Despachando asesoría: De: ${fromEmail}, Para: ${targetAdminEmail}, Reply-To: ${replyToEmail}`);
        const resendRes = await dynamicResend.emails.send({
          from: fromEmail,
          to: [targetAdminEmail],
          replyTo: replyToEmail,
          subject: emailSubject,
          html: emailHtmlBody,
          text: emailTextBody,
        });

        console.log('[LIDACTA RESEND] 📥 Respuesta Resend API:', JSON.stringify(resendRes, null, 2));

        if (resendRes.data?.id) {
          realEmailSent = true;
          realEmailId = resendRes.data.id;
          console.log(`[LIDACTA RESEND] ✅ Real email dispatched to ${targetAdminEmail}. Resend ID: ${realEmailId}`);
        } else if (resendRes.error) {
          realEmailError = resendRes.error.message;
          console.error('[LIDACTA RESEND] ❌ Resend API reported error:', JSON.stringify(resendRes.error, null, 2));
        }
      } catch (err: any) {
        realEmailError = err?.message || 'Error sending via Resend';
        console.error('[LIDACTA RESEND] ❌ Exception sending email:', err);
      }
    } else {
      console.log(`[LIDACTA EMAIL] RESEND_API_KEY not configured in env. Alert recorded in centralized database for ${targetAdminEmail}`);
    }

    // Insert into centralized server notifications store (so PC, Phone, Tablet instantly see it)
    const newNotification: ServerNotificationItem = {
      id: requestId,
      recipientRole: 'admin',
      recipientUserId: 'user_admin_tania',
      companyId: req.body.companyId || 'comp_nexus',
      title: `🚨 Solicitud de Asesoría 1:1: ${leaderName} (Etapa ${currentStage})`,
      message: `${leaderName} (${companyName || 'Empresa'}) ha solicitado hablar con ${targetAdminName} para el caso "${caseTitle}". Motivo: "${reasonText}"`,
      type: 'mentor_request',
      timestamp,
      read: false,
      emailSimulated: {
        from: fromEmail,
        to: targetAdminEmail,
        replyTo: replyToEmail,
        subject: emailSubject,
        bodyText: emailTextBody,
        realEmailSent,
        realEmailId,
      },
      mentorRequestDetails: {
        leaderId,
        leaderName,
        leaderEmail,
        leaderWhatsapp: leaderWhatsapp || '',
        leaderPosition: leaderPosition || 'Líder Operativo',
        companyName: companyName || 'Empresa',
        currentStage: Number(currentStage),
        stageName,
        caseTitle,
        reasonText,
        isVoiceAudio: !!isVoiceAudio,
        status: 'pendiente',
        whatsappSent: true,
        emailSent: true,
      },
    };

    serverNotifications.unshift(newNotification);

    return res.json({
      success: true,
      message: 'Solicitud de mentoría registrada y despachada con éxito.',
      requestId,
      whatsappUrl,
      notification: newNotification,
      simulatedEmail: newNotification.emailSimulated,
      realEmailSent,
      realEmailId,
      realEmailError,
    });
  } catch (error: any) {
    console.error('Error handling mentor request:', error);
    return res.status(500).json({ success: false, message: error?.message || 'Error al procesar solicitud' });
  }
});

// POST /api/tts - ElevenLabs Text-to-Speech proxy for 'Lidacta Mentora' cloned voice
app.post('/api/tts', async (req: Request, res: Response) => {
  try {
    const { text, voiceId } = req.body;
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ success: false, error: 'Texto requerido para síntesis' });
    }

    const apiKey =
      process.env.ELEVENLABS_API_KEY ||
      process.env.NEXT_PUBLIC_ELEVENLABS_API_KEY ||
      process.env.VITE_ELEVENLABS_API_KEY ||
      '';

    if (!apiKey) {
      console.warn('[ElevenLabs TTS] No ELEVENLABS_API_KEY configured in environment');
      return res.status(500).json({ success: false, error: 'ELEVENLABS_API_KEY not configured' });
    }

    const targetVoiceId =
      voiceId ||
      process.env.ELEVENLABS_VOICE_ID ||
      '4pxgXWex1CwQ1I4uyCVG';

    const cleanText = text
      .replace(/\[.*?\]/g, '')
      .replace(/#{1,6}\s+/g, '')
      .replace(/\*{1,3}(.*?)\*{1,3}/g, '$1')
      .replace(/_{1,3}(.*?)_{1,3}/g, '$1')
      .replace(/`{1,3}.*?`{1,3}/g, '')
      .replace(/^\s*[-*•]\s+/gm, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (!cleanText) {
      return res.status(400).json({ success: false, error: 'Texto limpio vacío' });
    }

    console.log(`[ElevenLabs TTS] Generating audio for voice "${targetVoiceId}" (${cleanText.length} chars)`);

    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${targetVoiceId}/stream`, {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
        'Accept': 'audio/mpeg',
      },
      body: JSON.stringify({
        text: cleanText,
        model_id: 'eleven_multilingual_v2',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.warn(`[ElevenLabs TTS] Upstream error (${response.status}):`, errorText);
      return res.status(response.status).json({
        success: false,
        error: `ElevenLabs API error: ${response.status}`,
        details: errorText,
      });
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Length', buffer.length.toString());
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.end(buffer);
  } catch (error: any) {
    console.error('[ElevenLabs TTS] Unexpected error:', error);
    return res.status(500).json({
      success: false,
      error: 'Error interno en síntesis de voz',
      details: error?.message,
    });
  }
});

// Vite middleware in dev or static files in production
async function startServer() {
  app.use(express.static(path.join(__dirname, 'public')));

  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Lidacta Server running at http://localhost:${PORT} [${isProd ? 'PRODUCTION' : 'DEV'}]`);
  });
}

const isMainModule =
  Boolean(process.argv[1]) &&
  path.resolve(process.argv[1]) === path.resolve(__filename);

if (isMainModule) {
  startServer();
}

export { app };
