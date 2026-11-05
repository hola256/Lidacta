const STAGE_NAMES: Record<number, string> = {
  1: 'Detectar qué sucede',
  2: 'Analizar perspectivas y habilidades',
  3: 'Diseñar alternativas',
  4: 'Practicar antes de actuar',
  5: 'Actuar (Plan de Acción)',
  6: 'Aprender y reflexionar',
  7: 'Cierre y retroalimentación',
};

function generateContextualCoachReply(
  stage: number,
  leaderName: string,
  userMsg: string,
  history: any[]
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

  if (stage === 1) {
    if (history.length > 2) {
      return {
        replyText: `Comprendo el punto que señalas sobre "${cleanMsg.slice(0, 60)}${cleanMsg.length > 60 ? '...' : ''}". Para cerrar esta primera etapa de detección: ¿qué impacto directo tiene no intervenir en este momento y qué resultado concreto buscas obtener al resolver esta situación?`,
        readyToAdvance: true,
        advancePrompt: 'Avanzar a Etapa 2: Analizar perspectivas y habilidades',
        detectedTheme: 'Clarificación de Situación',
        isTherapeuticCase: false,
      };
    }
    return {
      replyText: `Poniendo foco en lo que comentas: ¿quiénes son las personas clave involucradas en esta situación y qué postura o reacción están teniendo?`,
      readyToAdvance: false,
      advancePrompt: null,
      detectedTheme: 'Mapeo de Involucrados',
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
      stage,
      activeStage,
      leaderProfile,
      companyContext,
      conversationHistory,
      history,
      userMessage,
      currentMessage,
      message,
    } = body || {};

    currentStageNum = Number(stage || activeStage) || 1;
    leaderFirstName = (leaderProfile?.name || 'Líder').split(' ')[0];
    const resolvedUserMessage = (userMessage || currentMessage || message || '').trim();
    const resolvedHistory = Array.isArray(conversationHistory)
      ? conversationHistory
      : Array.isArray(history)
      ? history
      : [];

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
        resolvedHistory
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

    const systemPrompt = `Eres LIDACTA, mentora sénior de liderazgo. Tu misión es acompañar a los líderes en su entorno laboral cotidiano mediante una conversación guiada, estructurada y orientada a la acción.

Reglas estrictas:
1. Límite Terapéutico: NO eres psicólogo ni das terapia. Si detectas crisis emocional clínica o terapéutica, deriva amablemente a un profesional de la salud mental sin bloquear la sesión y marca "isTherapeuticCase": true.
2. Autonomía del Líder: NO tomas decisiones por el líder; cuestionas, orientas y sugieres.
3. Cero Consejos Genéricos: Personaliza cada intervención al contexto del líder. NUNCA respondas con saludos de bienvenida genéricos repetitivos (por ejemplo: "Hola [Nombre], entiendo la situación que estás enfrentando..."). Responde de forma directa al contenido del mensaje del líder.
4. Tono: Profesional, cercano, empático, claro y ejecutivo (1 a 3 párrafos cortos). Formula UNA pregunta a la vez.
5. Validación Emocional y Seguimiento Específico: Valida la emoción expresada y formula una pregunta de seguimiento específica basada estrictamente en la última intervención del líder. Nunca repitas respuestas anteriores.

Contexto de la sesión:
- Empresa: ${companyContext?.name || 'Empresa'}
- Líder: ${leaderProfile?.name || 'Líder'} (${leaderProfile?.position || 'Líder'})
- Etapa actual: Etapa ${currentStageNum} - ${STAGE_NAMES[currentStageNum] || ''}

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
        resolvedHistory
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
