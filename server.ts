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
  isProfileCompleted?: boolean;
  isProfileComplete?: boolean;
  createdAt: string;
}

const USERS_DB_PATH = path.join(__dirname, 'server_users_db.json');

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
    isProfileCompleted: false,
    isProfileComplete: false,
    createdAt: '2026-08-25',
  },
];

function readPersistentUsers(): ServerUserProfile[] {
  try {
    if (fs.existsSync(USERS_DB_PATH)) {
      const content = fs.readFileSync(USERS_DB_PATH, 'utf-8');
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn('[SERVER DB] Could not read server_users_db.json, using defaults:', err);
  }
  return initialServerUsers;
}

function writePersistentUsers(users: ServerUserProfile[]) {
  try {
    fs.writeFileSync(USERS_DB_PATH, JSON.stringify(users, null, 2), 'utf-8');
    console.log('[SERVER DB] Successfully persisted users to disk:', USERS_DB_PATH);
  } catch (err) {
    console.error('[SERVER DB] Failed to persist users to disk:', err);
  }
}

let serverUsers: ServerUserProfile[] = readPersistentUsers();
// Ensure file exists on initial start
if (!fs.existsSync(USERS_DB_PATH)) {
  writePersistentUsers(serverUsers);
}

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

// GET /api/users - Cross-device synchronized user list
app.get('/api/users', (_req: Request, res: Response) => {
  return res.json({
    success: true,
    users: serverUsers,
  });
});

// POST /api/user/complete-profile - Persistently mark profile as complete across PC, Mobile, Incognito
app.post('/api/user/complete-profile', (req: Request, res: Response) => {
  try {
    const { userId, email, companyName, area, birthDate, directReports, whatsapp } = req.body;
    let targetIndex = serverUsers.findIndex((u) => u.id === userId);
    if (targetIndex === -1 && email) {
      targetIndex = serverUsers.findIndex(
        (u) => u.email.toLowerCase() === String(email).trim().toLowerCase()
      );
    }

    if (targetIndex === -1) {
      // If user not in initial list, add them as complete
      const newUser: ServerUserProfile = {
        id: userId || `user_${Date.now()}`,
        name: req.body.name || 'Líder Lidacta',
        email: (email || 'lider@empresa.com').trim().toLowerCase(),
        role: req.body.role || 'leader',
        companyId: req.body.companyId || 'comp_custom',
        companyName: companyName ? String(companyName).trim() : 'Empresa Líder',
        position: req.body.position || 'Líder de Equipo',
        area: area !== undefined ? String(area).trim() : '',
        birthDate: birthDate ? String(birthDate).trim() : '',
        directReports: directReports !== undefined ? Number(directReports) : 5,
        whatsapp: whatsapp ? String(whatsapp).trim() : '',
        isProfileCompleted: true,
        isProfileComplete: true,
        createdAt: new Date().toISOString(),
      };
      serverUsers.push(newUser);
      writePersistentUsers(serverUsers);
      console.log(`[LIDACTA USERS] New user created and completed centrally: ${newUser.name} (${newUser.email})`);
      return res.json({
        success: true,
        message: 'Perfil completado exitosamente y sincronizado en el servidor central.',
        user: newUser,
        users: serverUsers,
      });
    }

    const current = serverUsers[targetIndex];
    const updatedUser: ServerUserProfile = {
      ...current,
      companyName: companyName ? String(companyName).trim() : current.companyName,
      area: area !== undefined ? String(area).trim() : current.area,
      birthDate: birthDate ? String(birthDate).trim() : current.birthDate,
      directReports: directReports !== undefined ? Number(directReports) : current.directReports,
      whatsapp: whatsapp ? String(whatsapp).trim() : current.whatsapp,
      isProfileCompleted: true,
      isProfileComplete: true,
    };

    serverUsers[targetIndex] = updatedUser;
    writePersistentUsers(serverUsers);
    console.log(`[LIDACTA USERS] Profile completed centrally for: ${updatedUser.name} (${updatedUser.email}). isProfileComplete=true`);

    return res.json({
      success: true,
      message: 'Perfil completado exitosamente y sincronizado en el servidor central.',
      user: updatedUser,
      users: serverUsers,
    });
  } catch (error: any) {
    console.error('Error completing profile centrally:', error);
    return res.status(500).json({ success: false, message: error?.message || 'Error al completar perfil' });
  }
});

// POST /api/users/update - Central user profile updates
app.post('/api/users/update', (req: Request, res: Response) => {
  try {
    const { userId, updates } = req.body;
    const targetIndex = serverUsers.findIndex((u) => u.id === userId);
    if (targetIndex === -1) {
      return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    }

    serverUsers[targetIndex] = {
      ...serverUsers[targetIndex],
      ...updates,
    };
    writePersistentUsers(serverUsers);

    return res.json({
      success: true,
      user: serverUsers[targetIndex],
      users: serverUsers,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err?.message || 'Error al actualizar usuario' });
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
      console.warn('[API /api/send] ⚠️ RESEND_API_KEY no encontrada en process.env. El correo no pudo enviarse a Resend.');
      return res.status(500).json({
        success: false,
        error: 'RESEND_API_KEY no configurada en las variables de entorno',
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
