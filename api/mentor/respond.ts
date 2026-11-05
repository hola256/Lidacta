const STAGE_NAMES: Record<number, string> = {
  1: 'Detectar qué sucede',
  2: 'Analizar perspectivas y habilidades',
  3: 'Diseñar alternativas',
  4: 'Practicar antes de actuar',
  5: 'Actuar (Plan de Acción)',
  6: 'Aprender y reflexionar',
  7: 'Cierre y retroalimentación',
};

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
    } = body || {};

    currentStageNum = Number(stage || activeStage) || 1;
    leaderFirstName = (leaderProfile?.name || 'Líder').split(' ')[0];
    const resolvedUserMessage = (userMessage || currentMessage || '').trim();
    const resolvedHistory = Array.isArray(conversationHistory)
      ? conversationHistory
      : Array.isArray(history)
      ? history
      : [];

    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      const fallbackReply = `Hola ${leaderFirstName}. Gracias por compartir tu situación en esta Etapa ${currentStageNum}. ¿Qué aspecto específico te gustaría abordar primero para avanzar con claridad?`;
      return res.status(200).json({
        success: true,
        text: fallbackReply,
        reply: fallbackReply,
        data: {
          replyText: fallbackReply,
          readyToAdvance: false,
          advancePrompt: null,
          identifiedSkills: [],
          detectedTheme: 'Liderazgo',
          isTherapeuticCase: false,
        },
      });
    }

    const systemPrompt = `Eres LIDACTA, mentora sénior de liderazgo. Tu misión es acompañar a los líderes en su entorno laboral cotidiano mediante una conversación guiada, estructurada y orientada a la acción.

Reglas estrictas:
1. Límite Terapéutico: NO eres psicólogo ni das terapia. Si detectas crisis emocional clínica o terapéutica, deriva amablemente a un profesional de la salud mental sin bloquear la sesión y marca "isTherapeuticCase": true.
2. Autonomía del Líder: NO tomas decisiones por el líder; cuestionas, orientas y sugieres.
3. Cero Consejos Genéricos: Personaliza cada intervención al contexto del líder.
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
        // Gemini requires contents to start with a 'user' turn
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

    // Ensure the latest userMessage is included as the final "user" turn
    if (resolvedUserMessage) {
      pushTurn('user', resolvedUserMessage);
    }

    if (contents.length === 0) {
      pushTurn('user', `Hola Lidacta, estoy en la Etapa ${currentStageNum}.`);
    }

    const modelsToTry = ['gemini-3.8-flash', 'gemini-3.7-flash', 'gemini-3.5-flash'];
    let data: any = null;
    let ok = false;

    for (const modelName of modelsToTry) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);
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

        data = await response.json();
        if (response.ok) {
          ok = true;
          break;
        }

        console.warn(`Gemini API (${modelName}) status ${response.status}:`, JSON.stringify(data));
      } catch (fetchErr) {
        clearTimeout(timeoutId);
        console.warn(`Fetch/Timeout error with ${modelName}:`, fetchErr);
      }
    }

    if (!ok) {
      const fallbackReply = `Entiendo lo que planteas, ${leaderFirstName}. Para seguir avanzando en esta Etapa ${currentStageNum}, ¿qué es lo que más te preocupa o qué resultado concreto te gustaría lograr en esta situación?`;
      return res.status(200).json({
        success: true,
        text: fallbackReply,
        reply: fallbackReply,
        data: {
          replyText: fallbackReply,
          readyToAdvance: false,
          advancePrompt: null,
          identifiedSkills: [],
          detectedTheme: 'Liderazgo',
          isTherapeuticCase: false,
        },
      });
    }

    const rawText = (data.candidates?.[0]?.content?.parts?.[0]?.text || '')
      .trim()
      .replace(/^```json\s*/i, '')
      .replace(/```$/i, '')
      .trim();

    let parsed: any;
    try {
      parsed = JSON.parse(rawText || '{}');
    } catch {
      parsed = {
        replyText: rawText || `Gracias por compartirlo, ${leaderFirstName}. ¿Qué te gustaría explorar a continuación?`,
        readyToAdvance: false,
        advancePrompt: null,
        identifiedSkills: [],
        detectedTheme: 'Liderazgo',
        isTherapeuticCase: false,
      };
    }

    const replyText =
      parsed.replyText ||
      `Gracias por compartirlo, ${leaderFirstName}. ¿Qué aspecto consideras clave atender primero?`;

    return res.status(200).json({
      success: true,
      text: replyText,
      reply: replyText,
      data: { ...parsed, replyText },
    });
  } catch (err: any) {
    console.error('Internal Error in /api/mentor/respond:', err);
    const fallbackReply = `Gracias por compartirlo, ${leaderFirstName}. ¿Qué aspecto específico de esta situación te gustaría analizar primero?`;
    return res.status(200).json({
      success: true,
      text: fallbackReply,
      reply: fallbackReply,
      data: {
        replyText: fallbackReply,
        readyToAdvance: false,
        advancePrompt: null,
        identifiedSkills: [],
        detectedTheme: 'Liderazgo',
        isTherapeuticCase: false,
      },
    });
  }
}
