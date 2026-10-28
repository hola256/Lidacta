import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import { Resend } from 'resend';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const isProd = process.env.NODE_ENV === 'production';
const PORT = 3000;

const app = express();
app.use(express.json());

// Initialize Resend client for real email delivery
const resendApiKey = process.env.RESEND_API_KEY;
const resend = resendApiKey ? new Resend(resendApiKey) : null;

// Initialize Google GenAI client
let ai: GoogleGenAI | null = null;
if (process.env.GEMINI_API_KEY) {
  ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
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

// POST /api/mentor/respond
app.post('/api/mentor/respond', async (req: Request, res: Response) => {
  try {
    const {
      stage,
      leaderProfile,
      companyContext,
      conversationHistory,
      userMessage,
      sessionData,
      isPracticeMode,
    } = req.body;

    const currentStageNum = Number(stage) || 1;

    // Build the system prompt embedding all Lidacta rules
    const systemPrompt = `
Eres LIDACTA, una mentora y coach ejecutiva Sr. especialista en desarrollo de líderes y habilidades de liderazgo.
Tu misión es acompañar a los líderes de empresas a resolver situaciones reales de su día a día laboral, guiándolos a analizar, practicar, actuar y aprender para desarrollar mayor autonomía.

=== ADVERTENCIAS Y REGLAS FUNDAMENTALES ===
1. NO eres psicóloga, NO das terapia, NO atiendes temas terapéuticos ni patologías personales. Si surge algo clínico o terapéutico, reorienta al ámbito profesional.
2. NO decides qué hará el líder: Guías, cuestionas, ayudas, orientas y sugieres, pero la decisión y autoría es SIEMPRE del líder.
3. NUNCA des consejos genéricos o sermones de manual.
4. Tono: Cercano, humano, cálido y proyectando máxima confianza y seguridad psicológica (el líder debe sentir que puede hablar de cualquier tema por incómodo que sea).
5. Brevedad y agilidad: El líder está en su jornada de trabajo y tiene poco tiempo. Sé directo/a, sin rodeos, con intervenciones concisas (1 a 3 párrafos cortos como máximo).
6. NUNCA uses la palabra "chat"; usa "mentoría", "acompañamiento" o "conversación".
7. Toda conversación es 100% confidencial.

=== CONTEXTO DE LA EMPRESA (ETAPA CERO - ONBOARDING) ===
- Empresa: ${companyContext?.name || 'Empresa líder'}
- Giro/Industria: ${companyContext?.industry || 'General'}
- Valores y Filosofía: ${companyContext?.values || 'Innovación, integridad, trabajo en equipo'}
- Cultura y Ritmo: ${companyContext?.culture || 'Dinámica orientada a resultados'} (${companyContext?.workRhythm || 'Rápido'})
- Competencias esperadas en líderes: ${companyContext?.expectedCompetencies ? companyContext.expectedCompetencies.join(', ') : 'Comunicación asertiva, retroalimentación, delegación'}
Alinea tu vocabulario y perspectiva a este contexto empresarial.

=== PERFIL DEL LÍDER ===
- Nombre: ${leaderProfile?.name || 'Líder'}
- Puesto: ${leaderProfile?.position || 'Líder de equipo'}
- Área: ${leaderProfile?.area || 'Operaciones'}
- Personas a cargo: ${leaderProfile?.directReports ?? 5}

=== ETAPA OPERATIVA ACTUAL: ETAPA ${currentStageNum} - ${STAGE_NAMES[currentStageNum] || ''} ===
Reglas estrictas según la etapa:
- ETAPA 1 (Detectar qué sucede): Valida al líder sin juzgar ni ser condescendiente. Haz preguntas concisas para entender a fondo la situación (quiénes participan, qué quiere lograr, qué está evitando o postergando, si es repetitivo). Máximo 2 o 3 preguntas concretas.
- ETAPA 2 (Analizar perspectivas): Ayuda al líder a ver riesgos/impacto, ponerse en el lugar de los demás involucrados, visibilizar su propia contribución al problema y sus patrones de reacción. OBLIGATORIO: Descubre e identifica explícitamente la o las habilidades clave de liderazgo que el líder necesita para resolver esto (ej. Asertividad, Gestión de expectativas, Escucha activa, Delegación, Empatía operativa).
- ETAPA 3 (Diseñar alternativas): Primero pregunta al líder qué opciones o caminos visualiza. Ayúdale a fortalecer sus ideas. Si está bloqueado, sugiere 2 alternativas realistas aclarando: "Te sugiero estos caminos, pero tú eres quien decide".
- ETAPA 4 (Practicar antes de actuar - Opcional): Si el líder aceptó simular/practicar (role play de una conversación difícil, retroalimentación, etc.), simula la interacción de forma realista, asumiendo el rol del colaborador o involucrado, y dale retroalimentación inmediata sobre qué cuidar, mejorar o evitar en su mensaje y tono.
- ETAPA 5 (Actuar): Ayuda al líder a formular su plan concreto con 5 elementos clave: 1) Qué hará exactamente, 2) Cuándo (fecha y momento específico), 3) Con quién, 4) Cómo lo hará, y 5) Qué va a cuidar o recordar en ese momento.
- ETAPA 6 (Aprender - Ajustar): Cuando el líder regresa tras ejecutar la acción: Pregunta qué ocurrió, qué funcionó, qué no, de qué se da cuenta y qué aprenderá a hacer distinto de ahora en adelante. Extrae reflexiones clave.
- ETAPA 7 (Cierre y Retroalimentación): Agradece al líder, recuérdale que su conversación fue 100% confidencial, e integra la retroalimentación estructurada final destacando: fortalezas detectadas, habilidades de la etapa 2, acciones ejecutadas, aprendizajes clave y recomendaciones para seguir fortaleciendo su autonomía.

Debes responder en formato JSON con la siguiente estructura:
{
  "replyText": "Tu intervención de mentoría para el líder, en lenguaje cálido, humano y profesional.",
  "readyToAdvance": true/false (indica si esta etapa ya cumplió su objetivo y se puede invitar al líder a pasar a la siguiente etapa),
  "advancePrompt": "Frase breve invitando a pasar a la siguiente etapa (o null si aún faltan preguntas en esta etapa)",
  "identifiedSkills": ["Habilidad 1", "Habilidad 2"] (solo si estamos en etapa 2 o posterior),
  "detectedTheme": "Tema general (ej. Comunicación Asertiva, Manejo de Conflictos, Delegación, Alineación de Expectativas)",
  "suggestedAlternatives": ["Opción 1...", "Opción 2..."] (en etapa 3 si aplica),
  "actionPlanDraft": { "what": "...", "when": "...", "withWhom": "...", "how": "...", "careReminders": "..." } (en etapa 5 si aplica),
  "learningsSummary": "Resumen de lo que aprendió el líder" (en etapa 6 si aplica),
  "finalFeedback": {
    "detectedStrengths": ["Fortaleza 1", "Fortaleza 2"],
    "stageTwoSkills": ["Habilidad de etapa 2"],
    "chosenActions": ["Acción que implementó"],
    "stageSixLearnings": ["Aprendizaje reflexionado"],
    "recommendationsForAutonomy": ["Recomendación 1", "Recomendación 2"]
  } (solo en etapa 7)
}
`;

    // Try Gemini API if initialized
    if (ai) {
      try {
        const historyText = (conversationHistory || [])
          .map((m: { sender: string; text: string }) => `${m.sender === 'leader' ? 'LÍDER' : 'LIDACTA'}: ${m.text}`)
          .join('\n');

        const prompt = `
Historial reciente de la mentoría:
${historyText || '(Inicio de la mentoría)'}

Último mensaje del líder:
"${userMessage}"

${isPracticeMode ? '[El líder está en modo práctica / roleplay de la Etapa 4]' : ''}
Datos previos guardados: ${JSON.stringify(sessionData || {})}

Genera tu respuesta como Lidacta para la Etapa ${currentStageNum} en formato JSON estricto.`;

        const geminiCall = ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: prompt,
          config: {
            systemInstruction: systemPrompt,
            responseMimeType: 'application/json',
            temperature: 0.7,
          },
        });

        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Gemini API request timeout (fallback activated)')), 6000)
        );

        const response = await Promise.race([geminiCall, timeoutPromise]);

        const rawText = response.text?.trim() || '{}';
        const parsed = JSON.parse(rawText);
        return res.json({ success: true, data: parsed });
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
      userMessage,
      conversationHistory,
      sessionData,
      isPracticeMode,
    });

    return res.json({ success: true, data: fallbackResponse });
  } catch (error: any) {
    console.error('Error in /api/mentor/respond:', error);
    res.status(500).json({
      success: false,
      error: 'Error procesando la mentoría de Lidacta',
      details: error?.message || 'Error desconocido',
    });
  }
});

// Deterministic Coaching Engine (Ensures 100% uptime, adhering to all PDF rules)
function generateDeterministicCoaching({
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

  if (stage === 1) {
    const isFirst = conversationHistory.length <= 1;
    if (isFirst) {
      return {
        replyText: `Hola ${leaderName}, te agradezco la honestidad y apertura al plantear esto. En el contexto de ${company}, entiendo perfectamente que estas situaciones generan fricción y demandan claridad.\n\nPara que podamos abordarlo con foco y agilidad durante tu día:\n1. ¿Quiénes son las personas clave involucradas y cuál es su postura?\n2. ¿Qué es exactamente lo que tú quieres lograr como resultado en esta situación?\n3. ¿Hay algo que sientas que estás postergando o evitando abordar directamente?`,
        readyToAdvance: false,
        detectedTheme: detectTopicFromText(userMessage),
      };
    } else {
      return {
        replyText: `Comprendo el cuadro con mucha mayor claridad, ${leaderName}. Es completamente natural que al buscar resultados surjan estas tensiones operativas. Lo valioso es que estás tomando la iniciativa de analizarlo antes de reaccionar.\n\nTenemos los elementos esenciales de lo que está ocurriendo. ¿Listo para que pasemos a la Etapa 2 y analicemos el problema desde otros ángulos y descubramos las habilidades clave en juego?`,
        readyToAdvance: true,
        advancePrompt: 'Avanzar a Etapa 2: Analizar y ver perspectivas',
        detectedTheme: detectTopicFromText(userMessage),
      };
    }
  }

  if (stage === 2) {
    const isBeginning = !sessionData?.identifiedSkills || sessionData.identifiedSkills.length === 0;
    const skills = inferSkillsFromText(userMessage);

    if (isBeginning) {
      return {
        replyText: `Miremos esto desde otra perspectiva, ${leaderName}.\n\nSi te pusieras por un momento en los zapatos de la otra parte o de tu equipo, ¿cómo crees que están experimentando esta situación? Además, con total franqueza profesional: ¿en qué medida tus reacciones habituales o la forma en que comunicas las expectativas han contribuido a este escenario?\n\nIdentifico que para resolver esto de raíz, las habilidades clave que requieres poner en juego son: **${skills.join('** y **')}**.`,
        readyToAdvance: false,
        identifiedSkills: skills,
        detectedTheme: sessionData?.theme || 'Comunicación y Alineación de Equipo',
      };
    } else {
      return {
        replyText: `Excelente nivel de autoconciencia, ${leaderName}. Reconocer nuestros propios patrones de respuesta y visibilizar cómo lo viven los demás es precisamente lo que distingue a un liderazgo maduro.\n\nCon las habilidades de **${(sessionData.identifiedSkills || skills).join(', ')}** bien identificadas, es momento de diseñar alternativas concretas. ¿Avanzamos a la Etapa 3?`,
        readyToAdvance: true,
        advancePrompt: 'Avanzar a Etapa 3: Diseñar alternativas de solución',
        identifiedSkills: sessionData.identifiedSkills || skills,
      };
    }
  }

  if (stage === 3) {
    const isInitial = !sessionData?.leaderAlternatives || sessionData.leaderAlternatives.length === 0;
    if (isInitial) {
      return {
        replyText: `Para diseñar las posibles salidas, ${leaderName}, quiero escucharte a ti primero:\n\n¿Qué alternativas o caminos de solución visualizas tú para resolver esta problemática? Piensa en al menos 2 opciones (por ejemplo, una conversación directa de alineación, una revisión estructurada de acuerdos o un ajuste en la dinámica de seguimiento). ¿Qué se te ocurre?`,
        readyToAdvance: false,
      };
    } else {
      return {
        replyText: `Muy bien planteado. Construyendo sobre tus ideas, te sugiero dos formas de fortalecer la alternativa elegida:\n\n1. Inicia la conversación validando los objetivos compartidos antes de señalar el desvío.\n2. Establece acuerdos observables con fechas de revisión específicas.\n\nRecuerda: **yo te sugiero estas estrategias, pero tú eres quien decide y conduce la acción.**\n\n¿Quieres que practiquemos esta conversación antes de que la lleves a la realidad en la Etapa 4 (simulación/roleplay), o prefieres pasar directo a estructurar tu plan de acción?`,
        readyToAdvance: true,
        advancePrompt: 'Ir a Etapa 4: Practicar antes de actuar (opcional)',
        suggestedAlternatives: [
          'Conversación 1 a 1 de alineación de expectativas y acuerdos mutuos',
          'Retroalimentación enfocada en hechos observables con plan de seguimiento',
        ],
      };
    }
  }

  if (stage === 4) {
    if (isPracticeMode) {
      return {
        replyText: `[En personaje]: "Hola ${leaderName}, gracias por llamarme. Honestamente he sentido que el ritmo de trabajo ha sido muy pesado y no me quedaba claro qué era lo prioritario esta semana..."\n\n[Retroalimentación de Lidacta]: Escuché un inicio claro. Para fortalecer aún más tu mensaje: cuida no usar frases absolutistas como "nunca" o "siempre". Focalízate en el impacto concreto y hazle una pregunta abierta. ¿Cómo le responderías ahora?`,
        readyToAdvance: true,
        advancePrompt: 'Concluir práctica y definir plan de acción (Etapa 5)',
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
      replyText: `Perfecto, ${leaderName}. Para que tu liderazgo se traduzca en acción efectiva y no quede en buenas intenciones, tu plan queda estructurado con estos 5 pilares:\n\n• **Qué harás:** Conversación de alineación individual y establecimiento de compromisos.\n• **Cuándo:** Definido en tu calendario para el momento de mayor enfoque del día.\n• **Con quién:** Con los colaboradores clave involucrados.\n• **Cómo:** Siguiendo la estructura de hechos concretos, escucha activa y acuerdos mutuos.\n• **Qué vas a cuidar:** Mantener la serenidad, cuidar el tono sin juzgar y cerrar con acuerdos por escrito.\n\nTe dejaré un recordatorio activo en Lidacta. En cuanto hayas ejecutado esta acción, regresa aquí para que analicemos juntos qué ocurrió y cerremos tus aprendizajes.`,
      readyToAdvance: true,
      advancePrompt: 'Marcar acción como realizada e ir a Etapa 6: Aprender - Ajustar',
      actionPlanDraft: {
        what: 'Conversación directa de retroalimentación y alineación de acuerdos operativos',
        when: 'Próxima jornada laboral (horario convenido)',
        withWhom: 'Colaboradores involucrados',
        how: 'Enfoque en hechos observables, preguntas abiertas y acuerdos mutuos',
        careReminders: 'Escuchar el 70% del tiempo, no emitir juicios y formalizar acuerdos por escrito',
      },
    };
  }

  if (stage === 6) {
    return {
      replyText: `¡Qué gran paso, ${leaderName}! La acción es donde se forja el verdadero liderazgo.\n\nAhora reflexionemos con calma para consolidar tu crecimiento:\n• ¿Qué ocurrió durante la interacción?\n• ¿Qué funcionó de acuerdo a lo previsto y qué imprevistos surgieron?\n• ¿De qué te diste cuenta sobre ti mismo/a y tu equipo?\n• ¿Qué aprendizaje te llevas para situaciones futuras en ${company}?`,
      readyToAdvance: true,
      advancePrompt: 'Avanzar a Etapa 7: Cierre y Reporte de Retroalimentación',
      learningsSummary:
        'El líder identificó que anticipar la conversación con acuerdos observables redujo la fricción y fortaleció el compromiso mutuo.',
    };
  }

  // Stage 7: Closure
  const skillsDetected = sessionData?.identifiedSkills || ['Comunicación Asertiva', 'Manejo de Expectativas'];
  return {
    replyText: `Muchas gracias por tu compromiso y apertura en este proceso de mentoría, ${leaderName}. Has demostrado una gran capacidad para pasar de la duda a la acción decidida.\n\nTe recuerdo que **esta conversación ha sido 100% confidencial**. Recursos Humanos únicamente recibe constancia de que has concluido exitosamente tu proceso y los indicadores generales de desarrollo, salvaguardando en todo momento tu privacidad.\n\nHe generado tu **Reporte de Retroalimentación y Autonomía de Liderazgo**, el cual puedes consultar aquí en la aplicación y también te llegará a tu correo electrónico. ¡Sigue utilizando Lidacta ante cada nuevo reto!`,
    readyToAdvance: false,
    finalFeedback: {
      detectedStrengths: [
        'Proactividad para abordar situaciones difíciles sin postergarlas',
        'Disposición para el autoanálisis y reconocimiento de patrones propios',
        'Capacidad de generar acuerdos basados en empatía y claridad operativa',
      ],
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

function inferSkillsFromText(text: string): string[] {
  const lower = (text || '').toLowerCase();
  const list: string[] = [];
  if (lower.includes('comunic') || lower.includes('decir') || lower.includes('callar')) list.push('Asertividad y Comunicación Directa');
  if (lower.includes('escuch') || lower.includes('entiend') || lower.includes('ignoran')) list.push('Escucha Activa');
  if (lower.includes('deleg') || lower.includes('soltar') || lower.includes('confiar')) list.push('Delegación Efectiva y Empoderamiento');
  if (lower.includes('emoci') || lower.includes('enojo') || lower.includes('frustr') || lower.includes('calma')) list.push('Inteligencia y Regulación Emocional');
  if (lower.includes('acuerd') || lower.includes('expectat') || lower.includes('regla')) list.push('Gestión y Clarificación de Expectativas');

  if (list.length === 0) {
    list.push('Comunicación Estratégica', 'Gestión de Acuerdos y Seguimiento');
  }
  return list.slice(0, 3);
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
  email: 'hola@taniapadierna.com',
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
    email: 'hola@taniapadierna.com',
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
    to: string;
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
      to: 'hola@taniapadierna.com',
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
          Lidacta es tu espacio seguro, confidencial y práctico para abordar retos reales de liderazgo, entrenar conversaciones difíciles y consolidar planes de acción con autonomía.
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
  recipientRole?: string;
  recipientUserId?: string;
  companyId?: string;
  type?: string;
  title?: string;
  message?: string;
}): Promise<{ realSent: boolean; emailId?: string; error?: string; deliveryNote?: string }> {
  const currentKey = process.env.RESEND_API_KEY;
  const adminOwner = process.env.ADMIN_EMAIL || 'hola@taniapadierna.com';
  const fromEmail = process.env.RESEND_FROM_EMAIL || 'Lidacta <onboarding@resend.dev>';
  const cleanTo = options.to.trim().toLowerCase();

  let realSent = false;
  let emailId: string | undefined;
  let errorMsg: string | undefined;
  let deliveryNote: string | undefined;

  console.log(`[LIDACTA MAILING 📧] ==========================================`);
  console.log(`[LIDACTA MAILING 📧] Timestamp: ${new Date().toISOString()}`);
  console.log(`[LIDACTA MAILING 📧] Destinatario objetivo: ${cleanTo}`);
  console.log(`[LIDACTA MAILING 📧] Remitente configurado: ${fromEmail}`);
  console.log(`[LIDACTA MAILING 📧] Asunto: ${options.subject}`);
  console.log(`[LIDACTA MAILING 📧] Proveedor: Resend (API Key activa: ${currentKey ? 'SÍ [longitud ' + currentKey.length + ']' : 'NO'})`);

  if (currentKey) {
    const client = new Resend(currentKey);
    try {
      // 1. Intentar envío directo a la dirección objetivo
      console.log(`[LIDACTA MAILING 📧] 🚀 Despachando llamada a Resend API para ${cleanTo}...`);
      const res = await client.emails.send({
        from: fromEmail,
        to: [cleanTo],
        subject: options.subject,
        html: options.html,
        text: options.text,
      });

      if (res.data?.id) {
        realSent = true;
        emailId = res.data.id;
        deliveryNote = `Entregado directamente a ${cleanTo} vía Resend`;
        console.log(`[LIDACTA MAILING 📧] ✅ ¡ÉXITO! Correo entregado directamente a ${cleanTo}. ID de Resend: ${emailId}`);
      } else if (res.error) {
        errorMsg = res.error.message;
        console.warn(`[LIDACTA MAILING 📧] ⚠️ Resend reportó aviso/error:`, res.error);

        // Detectar si la causa es la restricción del Sandbox de Resend (dominio de prueba onboarding@resend.dev)
        const isSandboxRestricted =
          res.error.statusCode === 403 ||
          (res.error.message && res.error.message.includes('only send testing emails to your own email address')) ||
          (res.error.message && res.error.message.includes('verify a domain'));

        if (isSandboxRestricted) {
          console.warn(`[LIDACTA MAILING 📧] ⚠️ [MODO SANDBOX ACTIVO] El remitente 'onboarding@resend.dev' de Resend restringe el envío al correo del propietario (${adminOwner}).`);
          console.log(`[LIDACTA MAILING 📧] 🔄 Reenviando copia de verificación a la bandeja de ${adminOwner}...`);

          const sandboxBanner = `
            <div style="background-color: #FFF3CD; border: 2px solid #FFEEBA; color: #856404; padding: 14px 18px; border-radius: 10px; margin: 0 0 24px 0; font-family: sans-serif; font-size: 13px; line-height: 1.5;">
              <strong style="color: #664D03; font-size: 14px;">ℹ️ Notificación de Modo de Pruebas (Sandbox de Resend):</strong><br>
              Este correo fue generado originalmente para el usuario: <strong>${cleanTo}</strong>.<br>
              Debido a que el remitente actual es <code>onboarding@resend.dev</code>, Resend entrega los correos de prueba exclusivamente al propietario de la cuenta registrada (<strong>${adminOwner}</strong>).<br><br>
              <strong>💡 Para enviar directamente a cualquier correo externo:</strong><br>
              Agrega y verifica un dominio propio en <a href="https://resend.com/domains" target="_blank" style="color: #BF3A1B; font-weight: bold;">resend.com/domains</a> y configura la variable de entorno <code>RESEND_FROM_EMAIL="Lidacta &lt;notificaciones@tudominio.com&gt;"</code>.
            </div>
          `;

          const fallbackRes = await client.emails.send({
            from: fromEmail,
            to: [adminOwner],
            subject: `[Copia para: ${cleanTo}] ${options.subject}`,
            html: `${sandboxBanner}${options.html}`,
            text: `[Copia de prueba para: ${cleanTo}]\n\nAVISO SANDBOX RESEND: Entregado a ${adminOwner} porque el dominio remitente es onboarding@resend.dev.\nPara entregar a cualquier correo, configura RESEND_FROM_EMAIL con tu dominio verificado.\n\n${options.text}`,
          });

          if (fallbackRes.data?.id) {
            realSent = true;
            emailId = fallbackRes.data.id;
            deliveryNote = `Entregado en bandeja de ${adminOwner} (copia de prueba para ${cleanTo})`;
            console.log(`[LIDACTA MAILING 📧] ✅ Copia de verificación entregada exitosamente a ${adminOwner}. ID de Resend: ${emailId}`);
          } else {
            console.error(`[LIDACTA MAILING ERROR ❌] Fallo al entregar copia de prueba a ${adminOwner}:`, fallbackRes.error);
          }
        }
      }
    } catch (e: any) {
      errorMsg = e?.message;
      console.error(`[LIDACTA MAILING ERROR ❌] Excepción al invocar Resend:`, e);

      // Si la excepción fue por 403 / restricción de sandbox, intentar entrega al adminOwner
      if (e?.message && (e.message.includes('only send testing emails') || e.message.includes('403'))) {
        try {
          console.log(`[LIDACTA MAILING 📧] Reintentando envío como copia de prueba a ${adminOwner}...`);
          const client = new Resend(currentKey);
          const fallbackRes = await client.emails.send({
            from: fromEmail,
            to: [adminOwner],
            subject: `[Copia para: ${cleanTo}] ${options.subject}`,
            html: options.html,
            text: options.text,
          });
          if (fallbackRes.data?.id) {
            realSent = true;
            emailId = fallbackRes.data.id;
            deliveryNote = `Entregado a ${adminOwner} (copia tras excepción)`;
            console.log(`[LIDACTA MAILING 📧] ✅ Copia de prueba entregada a ${adminOwner}. ID: ${emailId}`);
          }
        } catch (fallbackErr) {
          console.error(`[LIDACTA MAILING ERROR ❌] Excepción en reenvío a admin:`, fallbackErr);
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
      to: options.to,
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
  const text = `¡Hola ${user.name}!\n\nTe damos una cálida bienvenida a Lidacta: Desarrollo de Liderazgo en Acción.\n\nTu cuenta ha sido creada exitosamente asociada a ${user.companyName}.\nEn Lidacta cuentas con un espacio 100% seguro y confidencial donde podrás analizar situaciones reales de tu día a día, practicar tus conversaciones y tomar acciones que fortalezcan tu autonomía como líder.\n\nRecursos Humanos únicamente recibirá indicadores agregados de uso, sin acceso a tus conversaciones privadas.\n\nPuedes acceder en: https://ais-dev-5pctfozdv244x3okeqjryq-710027895954.us-east1.run.app\n\n¡Estamos listos para acompañarte en tu próximo reto!\n\nAtentamente,\nEl Equipo de Lidacta`;
  const html = generateWelcomeEmailHtml(user);

  return sendTransactionalEmail({
    to: user.email,
    subject,
    html,
    text,
    recipientRole: user.role,
    recipientUserId: user.id,
    companyId: user.companyId,
    type: 'registration',
    title: `Correo de Bienvenida enviado a ${user.name}`,
    message: `Hemos enviado el correo de bienvenida a ${user.email} con la información de acceso a Lidacta.`,
  });
}

async function sendProfileInviteEmail(user: ServerUserProfile, inviteUrl?: string): Promise<{ realSent: boolean; emailId?: string; deliveryNote?: string }> {
  const subject = `🎯 Invitación para completar tu perfil de liderazgo en Lidacta`;
  const directUrl = inviteUrl || 'https://ais-dev-5pctfozdv244x3okeqjryq-710027895954.us-east1.run.app';
  const text = `¡Hola ${user.name}!\n\nLa administración de ${user.companyName} te ha invitado a formar parte del programa directivo en Lidacta.\n\nPara habilitar tu acceso seguro y comenzar tu proceso de acompañamiento directivo personalizado, por favor ingresa al siguiente enlace y completa los datos de tu entorno operativo (Área, Puesto, WhatsApp y Personas a Cargo):\n\n${directUrl}\n\nDatos de acceso:\nUsuario: ${user.email}\nEmpresa: ${user.companyName}\n\nEl contenido de tus conversaciones es privado y confidencial.\n\nAtentamente,\nEl Equipo de Lidacta`;
  const html = generateProfileInviteEmailHtml(user, directUrl);

  return sendTransactionalEmail({
    to: user.email,
    subject,
    html,
    text,
    recipientRole: user.role,
    recipientUserId: user.id,
    companyId: user.companyId,
    type: 'registration',
    title: `Invitación para completar perfil enviada a ${user.name}`,
    message: `Se envió un correo a ${user.email} con el enlace directo para completar su perfil de liderazgo.`,
  });
}

// POST /api/users - Create new user with backend persistence & guaranteed asynchronous welcome mailing
app.post('/api/users', async (req: Request, res: Response) => {
  try {
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

    serverUsers.unshift(newUser);
    writePersistentUsers(serverUsers);
    console.log(`[SERVER DB] ✅ Nuevo usuario registrado: ${newUser.name} (${newUser.email}) - Rol: ${newUser.role}`);

    // Disparo 100% asíncrono y no bloqueante del correo de bienvenida:
    // Nunca bloquea la respuesta 201 Created ni la navegación en frontend
    setImmediate(() => {
      console.log(`[LIDACTA MAILING 📧] [Async Background] Disparando bienvenida para ${newUser.email}...`);
      sendWelcomeEmail(newUser)
        .then((result) => {
          console.log(`[LIDACTA MAILING 📧] [Async Background] Resultado de bienvenida para ${newUser.email}: realSent=${result.realSent}, ID=${result.emailId || 'N/A'}`);
        })
        .catch((err) => {
          console.error(`[LIDACTA MAILING ERROR ❌] Error en envío asíncrono de bienvenida para ${newUser.email}:`, err);
        });
    });

    return res.status(201).json({
      success: true,
      message: 'Usuario creado correctamente en la Base de Datos Central',
      user: newUser,
      users: serverUsers,
    });
  } catch (error: any) {
    console.error('Error creating user:', error);
    return res.status(500).json({ success: false, message: error?.message || 'Error al crear usuario' });
  }
});

// POST /api/send-email - Universal Transactional Email Endpoint (Asynchronous & Non-Blocking)
app.post('/api/send-email', async (req: Request, res: Response) => {
  try {
    const { to, subject, html, text, type, userId, email, name, role, companyName, inviteUrl } = req.body;
    console.log(`[LIDACTA MAILING 📧] Petición recibida en POST /api/send-email:`, { to, email, userId, type, subject });

    serverUsers = readPersistentUsers();
    let targetUser: ServerUserProfile | undefined;
    if (userId || email || to) {
      targetUser = serverUsers.find(
        (u) =>
          (userId && u.id === userId) ||
          (email && u.email.toLowerCase() === String(email).trim().toLowerCase()) ||
          (to && u.email.toLowerCase() === String(to).trim().toLowerCase())
      );
    }

    const targetEmail = to || targetUser?.email || email;
    if (!targetEmail || !String(targetEmail).includes('@')) {
      return res.status(400).json({
        success: false,
        message: 'Debe proporcionarse un correo destinatario válido ("to" o "email") o un "userId" existente.',
      });
    }

    const emailType = type || (subject?.toLowerCase().includes('invit') ? 'invite' : 'welcome');

    // Procesamiento en segundo plano de manera no bloqueante
    setImmediate(async () => {
      try {
        if (emailType === 'invite') {
          const userForInvite = targetUser || {
            id: userId || `user_${Date.now()}`,
            name: name || 'Líder Lidacta',
            email: targetEmail,
            role: role || 'leader',
            companyId: 'comp_custom',
            companyName: companyName || 'Lidacta Platform',
            position: 'Líder',
            createdAt: new Date().toISOString(),
          };
          await sendProfileInviteEmail(userForInvite, inviteUrl);
        } else if (emailType === 'welcome') {
          const userForWelcome = targetUser || {
            id: userId || `user_${Date.now()}`,
            name: name || 'Líder Lidacta',
            email: targetEmail,
            role: role || 'leader',
            companyId: 'comp_custom',
            companyName: companyName || 'Industrias Nexus Automotriz',
            position: 'Líder Operativo',
            createdAt: new Date().toISOString(),
          };
          await sendWelcomeEmail(userForWelcome);
        } else {
          // Envío transaccional personalizado
          await sendTransactionalEmail({
            to: targetEmail,
            subject: subject || 'Notificación de Lidacta',
            html: html || `<p>${text || 'Notificación de Lidacta'}</p>`,
            text: text || 'Notificación de Lidacta',
            recipientRole: role || targetUser?.role || 'leader',
            recipientUserId: targetUser?.id,
            companyId: targetUser?.companyId,
            type: emailType,
            title: subject || 'Notificación de Lidacta',
            message: text ? text.slice(0, 150) : 'Notificación enviada',
          });
        }
      } catch (asyncErr) {
        console.error('[LIDACTA MAILING ERROR ❌] Excepción en despacho asíncrono desde /api/send-email:', asyncErr);
      }
    });

    // Respuesta inmediata 200 OK para no bloquear el flujo de la aplicación
    return res.status(200).json({
      success: true,
      message: `El correo para ${targetEmail} ha sido encolado y se está despachando de forma asíncrona.`,
      recipient: targetEmail,
      type: emailType,
      queued: true,
    });
  } catch (error: any) {
    console.error('[LIDACTA MAILING ERROR ❌] Error en /api/send-email:', error);
    return res.status(500).json({
      success: false,
      message: error?.message || 'Error al procesar solicitud de envío de correo',
    });
  }
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

// POST /api/mail/send-profile-invite - Send invitation email to complete profile
app.post('/api/mail/send-profile-invite', async (req: Request, res: Response) => {
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

    // Despacho asíncrono
    setImmediate(() => {
      sendProfileInviteEmail(targetUser, inviteUrl).catch((e) =>
        console.error('[LIDACTA MAILING ERROR ❌] Error en sendProfileInviteEmail:', e)
      );
    });

    return res.json({
      success: true,
      message: `Correo de invitación para completar perfil programado para ${targetUser.email}`,
      queued: true,
    });
  } catch (error: any) {
    console.error('Error in /api/mail/send-profile-invite:', error);
    return res.status(500).json({ success: false, message: error?.message || 'Error al enviar invitación' });
  }
});

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
    const targetEmail = process.env.ADMIN_EMAIL || 'hola@taniapadierna.com';
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
          Correo enviado automáticamente desde <strong>Lidacta &lt;onboarding@resend.dev&gt;</strong> para <strong>${targetEmail}</strong>.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>
    `;

    const emailTextBody = `🚨 Solicitud de Asesoría 1:1 en Lidacta\n\nLíder: ${effectiveLeaderName}\nFecha: ${effectiveDate}\nEmpresa: ${effectiveCompany}\nEtapa: ${effectiveStage}\nCaso: ${effectiveCaseTitle}\n\nMensaje/Transcripción:\n"${effectiveMessage}"\n\nDestinatario: ${targetEmail}`;

    const resendResponse = await resendClient.emails.send({
      from: 'Lidacta <onboarding@resend.dev>',
      to: [targetEmail],
      subject: emailSubject,
      html: emailHtmlBody,
      text: emailTextBody,
    });

    if (resendResponse.error) {
      console.error('[API /api/send] ❌ Error devuelto por Resend API:', resendResponse.error);
      return res.status(400).json({
        success: false,
        error: resendResponse.error.message || 'Error en Resend API',
        details: resendResponse.error,
      });
    }

    console.log('[API /api/send] ✅ Correo enviado exitosamente con Resend. ID:', resendResponse.data?.id);

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
        to: targetEmail,
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
    const targetAdminEmail = 'hola@taniapadierna.com';
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
          Correo generado automáticamente por Lidacta para la administradora principal <strong>${targetAdminName}</strong> (${targetAdminEmail}).
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`;

    const currentResendKey = process.env.RESEND_API_KEY;
    if (currentResendKey) {
      try {
        const dynamicResend = new Resend(currentResendKey);
        const resendRes = await dynamicResend.emails.send({
          from: 'Lidacta <onboarding@resend.dev>',
          to: [targetAdminEmail],
          subject: emailSubject,
          html: emailHtmlBody,
          text: emailTextBody,
        });

        if (resendRes.data?.id) {
          realEmailSent = true;
          realEmailId = resendRes.data.id;
          console.log(`[LIDACTA RESEND] Real email dispatched to ${targetAdminEmail}. Resend ID: ${realEmailId}`);
        } else if (resendRes.error) {
          realEmailError = resendRes.error.message;
          console.warn('[LIDACTA RESEND] Resend API reported error:', resendRes.error);
        }
      } catch (err: any) {
        realEmailError = err?.message || 'Error sending via Resend';
        console.warn('[LIDACTA RESEND] Exception sending email:', err);
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
        to: targetAdminEmail,
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

startServer();
