import { GoogleGenAI } from '@google/genai';

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
      sessionData,
      isPracticeMode,
    } = body || {};

    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ success: false, error: 'Missing GEMINI_API_KEY' });
    }

    const currentStageNum = Number(stage || activeStage) || 1;
    const resolvedUserMessage = userMessage || currentMessage || '';
    const resolvedHistory = conversationHistory || history || [];

    const systemPrompt = `
Eres LIDACTA, un mentor y facilitador de desarrollo de liderazgo interactivo. Tu misión es acompañar a los líderes en su entorno laboral cotidiano mediante una conversación guiada, estructurada y orientada a la acción.

1. Límite Terapéutico: NO eres psicólogo ni das terapia. Si detectas crisis emocional clínica o terapéutica, deriva amablemente a un profesional de la salud mental sin bloquear la sesión y marca "isTherapeuticCase": true.
2. Autonomía del Líder: NO tomas decisiones por el líder; cuestionas, orientas y sugieres.
3. Cero Consejos Genéricos: Personaliza cada intervención al contexto del líder.
4. Tono: Profesional, cercano, empático, claro y ejecutivo (1 a 3 párrafos cortos). Una pregunta a la vez.

Contexto de la sesión:
- Empresa: ${companyContext?.name || 'Empresa'}
- Líder: ${leaderProfile?.name || 'Líder'} (${leaderProfile?.position || 'Líder'})
- Etapa actual: Etapa ${currentStageNum} - ${STAGE_NAMES[currentStageNum] || ''}

Responde SIEMPRE en JSON estricto:
{
  "replyText": "Tu intervención empática, humana y reflexiva para el líder.",
  "readyToAdvance": false,
  "advancePrompt": null,
  "identifiedSkills": [],
  "detectedTheme": "Liderazgo",
  "isTherapeuticCase": false,
  "therapeuticReason": null
}
`;

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
Datos previos guardados: ${JSON.stringify(sessionData || {})}

IMPORTANTE: Responde de forma empática, humana y reflexiva, validando la emoción expresada y formulando una pregunta de seguimiento específica basada estrictamente en la última intervención del líder. Nunca repitas respuestas anteriores.

Genera tu respuesta como Lidacta para la Etapa ${currentStageNum} en formato JSON estricto.`;

    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: 'application/json',
        temperature: 0.7,
      },
    });

    const rawText = (response.text || '').trim().replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
    let parsed: any;
    try {
      parsed = JSON.parse(rawText || '{}');
    } catch {
      parsed = {
        replyText: rawText,
        readyToAdvance: false,
        advancePrompt: null,
        identifiedSkills: [],
        detectedTheme: 'Liderazgo',
        isTherapeuticCase: false,
      };
    }

    return res.status(200).json({ success: true, text: parsed.replyText, data: parsed });
  } catch (err: any) {
    console.error('Error in /api/mentor/respond:', err);
    return res.status(500).json({ success: false, error: err?.message || 'Error interno en /api/mentor/respond' });
  }
}
