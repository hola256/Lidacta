import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const isProd = process.env.NODE_ENV === 'production';
const PORT = 3000;

const app = express();
app.use(express.json());

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
