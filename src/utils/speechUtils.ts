// Global voice cache and subscription to speechSynthesis.onvoiceschanged
let cachedVoices: SpeechSynthesisVoice[] = [];

export function loadAvailableVoices(): SpeechSynthesisVoice[] {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    return [];
  }
  const voices = window.speechSynthesis.getVoices();
  if (voices && voices.length > 0) {
    cachedVoices = voices;
  }
  return cachedVoices;
}

// Subscribe immediately to onvoiceschanged for proactive voice discovery
if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  loadAvailableVoices();
  window.speechSynthesis.addEventListener('voiceschanged', () => {
    loadAvailableVoices();
  });
}

/**
 * Ensures voices are loaded asynchronously before playback
 */
export function ensureVoicesLoaded(): Promise<SpeechSynthesisVoice[]> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      resolve([]);
      return;
    }
    const current = window.speechSynthesis.getVoices();
    if (current && current.length > 0) {
      cachedVoices = current;
      resolve(current);
      return;
    }
    let resolved = false;
    const handler = () => {
      if (resolved) return;
      resolved = true;
      const v = window.speechSynthesis.getVoices();
      if (v.length > 0) cachedVoices = v;
      resolve(cachedVoices);
    };
    window.speechSynthesis.addEventListener('voiceschanged', handler, { once: true });
    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        const v = window.speechSynthesis.getVoices();
        if (v.length > 0) cachedVoices = v;
        resolve(cachedVoices);
      }
    }, 300);
  });
}

/**
 * Intelligent voice selection prioritizing neural/natural high-definition voices in Spanish (Mexico / Latin America)
 */
export function getBestNaturalSpanishVoice(): SpeechSynthesisVoice | null {
  const voices = loadAvailableVoices();
  if (!voices || voices.length === 0) return null;

  // 1. Voces 'Natural' o 'Neural' en es-MX (ej. Microsoft Dalia Online (Natural), Jorge Online (Natural))
  const esMxNatural = voices.find(
    (v) =>
      /^es[-_]MX/i.test(v.lang) &&
      (v.name.toLowerCase().includes('natural') ||
        v.name.toLowerCase().includes('neural') ||
        v.name.toLowerCase().includes('dalia') ||
        v.name.toLowerCase().includes('jorge'))
  );
  if (esMxNatural) return esMxNatural;

  // 2. Google español de México o Google español latino
  const googleEsMx = voices.find(
    (v) =>
      (/^es[-_]MX/i.test(v.lang) && v.name.toLowerCase().includes('google')) ||
      (v.lang.startsWith('es') &&
        v.name.toLowerCase().includes('google') &&
        (v.name.toLowerCase().includes('m\u00e9xico') ||
          v.name.toLowerCase().includes('mexico') ||
          v.name.toLowerCase().includes('estados unidos') ||
          v.lang.includes('US')))
  );
  if (googleEsMx) return googleEsMx;

  // 3. Voces 'Natural' o 'Neural' en cualquier variante de español (es-US, es-419, es-LA, es-ES)
  const anyEsNatural = voices.find(
    (v) =>
      v.lang.startsWith('es') &&
      (v.name.toLowerCase().includes('natural') ||
        v.name.toLowerCase().includes('neural') ||
        v.name.toLowerCase().includes('online'))
  );
  if (anyEsNatural) return anyEsNatural;

  // 4. Voces Google en cualquier variante de español (ej. 'Google español')
  const googleEs = voices.find(
    (v) => v.lang.startsWith('es') && v.name.toLowerCase().includes('google')
  );
  if (googleEs) return googleEs;

  // 5. Voces Microsoft o Apple/Siri de alta calidad en español
  const highQualityEs = voices.find(
    (v) =>
      v.lang.startsWith('es') &&
      (v.name.toLowerCase().includes('microsoft') ||
        v.name.toLowerCase().includes('apple') ||
        v.name.toLowerCase().includes('siri') ||
        v.name.toLowerCase().includes('paulina') ||
        v.name.toLowerCase().includes('sabina') ||
        v.name.toLowerCase().includes('monica'))
  );
  if (highQualityEs) return highQualityEs;

  // 6. Cualquier voz específica en es-MX
  const anyEsMx = voices.find((v) => /^es[-_]MX/i.test(v.lang));
  if (anyEsMx) return anyEsMx;

  // 7. Cualquier voz en español latino (es-US, es-419, es-AR, es-CO, etc.)
  const anyEsLatin = voices.find((v) => /^es[-_](US|419|AR|CO|CL|PE)/i.test(v.lang));
  if (anyEsLatin) return anyEsLatin;

  // 8. Cualquier voz en español disponible
  const anyEs = voices.find((v) => v.lang.startsWith('es'));
  if (anyEs) return anyEs;

  return null;
}

/**
 * Cleans markdown formatting, symbols, and stage tags for natural human cadence
 */
function cleanTextForSpeech(text: string): string {
  return text
    .replace(/\[.*?\]/g, '') // Eliminar etiquetas como [Etapa 1]
    .replace(/#{1,6}\s+/g, '') // Encabezados markdown
    .replace(/\*{1,3}(.*?)\*{1,3}/g, '$1') // Asteriscos de negrita/cursiva
    .replace(/_{1,3}(.*?)_{1,3}/g, '$1') // Guiones bajos
    .replace(/`{1,3}.*?`{1,3}/g, '') // Código
    .replace(/^\s*[-*•]\s+/gm, '') // Viñetas
    .replace(/\s+/g, ' ')
    .trim();
}

export const ELEVENLABS_VOICE_ID = '4pxgXWex1CwQ1I4uyCVG';
export const ELEVENLABS_API_KEY =
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_ELEVENLABS_API_KEY) ||
  'sk_f1522d73b2c5a237197337c9b0adacd87302c5f64d4806d9';

let currentAudioElement: HTMLAudioElement | null = null;
let currentAudioBlobUrl: string | null = null;

export function stopSpeaking() {
  // Cancel Web Speech API synthesis
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
    } catch {
      // ignore
    }
  }

  // Stop HTML5 Audio Element if playing
  if (currentAudioElement) {
    try {
      currentAudioElement.pause();
      currentAudioElement.currentTime = 0;
    } catch {
      // ignore
    }
    currentAudioElement = null;
  }

  // Clean up object URL
  if (currentAudioBlobUrl) {
    try {
      URL.revokeObjectURL(currentAudioBlobUrl);
    } catch {
      // ignore
    }
    currentAudioBlobUrl = null;
  }
}

/**
 * Fallback to Web Speech API (es-MX) if ElevenLabs is unavailable or quota is exceeded
 */
function executeWebSpeech(
  cleanText: string,
  onEnd?: () => void,
  onStart?: () => void
) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    if (onEnd) onEnd();
    return;
  }

  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(cleanText);
  utterance.lang = 'es-MX';
  utterance.rate = 0.96;
  utterance.pitch = 0.99;

  const bestVoice = getBestNaturalSpanishVoice();
  if (bestVoice) {
    utterance.voice = bestVoice;
    utterance.lang = bestVoice.lang;
  }

  utterance.onstart = () => {
    if (onStart) onStart();
  };

  utterance.onend = () => {
    if (onEnd) onEnd();
  };

  utterance.onerror = () => {
    if (onEnd) onEnd();
  };

  window.speechSynthesis.speak(utterance);
}

/**
 * Main Text-to-Speech function
 * Tries ElevenLabs (Lidacta Mentora voice) first, falling back automatically to local SpeechSynthesis
 */
export async function speakText(
  text: string,
  onEnd?: () => void,
  onStart?: () => void,
  onLoading?: (isLoading: boolean) => void
): Promise<void> {
  const cleanText = cleanTextForSpeech(text);
  if (!cleanText) {
    if (onEnd) onEnd();
    return;
  }

  // Stop any current audio
  stopSpeaking();

  if (onLoading) onLoading(true);

  // 1. Attempt ElevenLabs via backend proxy or direct API
  try {
    let audioBlob: Blob | null = null;

    // Try backend proxy /api/tts first (avoids CORS issues, secure server-side headers)
    try {
      const serverResponse = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: cleanText,
        }),
      });

      if (serverResponse.ok) {
        const blob = await serverResponse.blob();
        if (blob && blob.size > 200) {
          audioBlob = blob;
        }
      } else {
        console.warn(`[TTS] /api/tts returned ${serverResponse.status}, attempting direct ElevenLabs endpoint...`);
      }
    } catch (proxyErr) {
      console.warn('[TTS] /api/tts proxy unreachable, trying direct ElevenLabs endpoint:', proxyErr);
    }

    // Direct ElevenLabs call as backup if proxy failed: https://api.elevenlabs.io/v1/text-to-speech/4pxgXWex1CwQ1I4uyCVG
    if (!audioBlob) {
      const directResponse = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'xi-api-key': ELEVENLABS_API_KEY,
            'Accept': 'audio/mpeg',
          },
          body: JSON.stringify({
            text: cleanText,
            model_id: 'eleven_multilingual_v2',
          }),
        }
      );

      if (directResponse.ok) {
        const blob = await directResponse.blob();
        if (blob && blob.size > 200) {
          audioBlob = blob;
        }
      }
    }

    if (audioBlob) {
      const blobUrl = URL.createObjectURL(audioBlob);
      currentAudioBlobUrl = blobUrl;
      const audio = new Audio(blobUrl);
      currentAudioElement = audio;

      audio.onplay = () => {
        if (onLoading) onLoading(false);
        if (onStart) onStart();
      };

      audio.onended = () => {
        if (onLoading) onLoading(false);
        stopSpeaking();
        if (onEnd) onEnd();
      };

      audio.onerror = () => {
        console.warn('[TTS] Audio playback error on blob, falling back to Web Speech API');
        if (onLoading) onLoading(false);
        stopSpeaking();
        executeWebSpeech(cleanText, onEnd, onStart);
      };

      await audio.play();
      return;
    }
  } catch (elevenLabsError) {
    console.warn('[TTS] ElevenLabs request failed, falling back to Web Speech API:', elevenLabsError);
  }

  // 2. Fallback: Local Web Speech API (es-MX)
  if (onLoading) onLoading(false);
  if (cachedVoices.length === 0) {
    ensureVoicesLoaded().then(() => {
      executeWebSpeech(cleanText, onEnd, onStart);
    });
  } else {
    executeWebSpeech(cleanText, onEnd, onStart);
  }
}

export function isSpeechRecognitionSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
}

export interface SpeechRecognizerHandle {
  start: () => void;
  stop: () => void;
  abort: () => void;
}

export function createSpeechRecognizer(
  onResult: (finalTranscript: string, isFinal: boolean) => void,
  onEnd?: () => void,
  onError?: (err: any) => void
): SpeechRecognizerHandle | null {
  if (!isSpeechRecognitionSupported()) return null;

  try {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    const recognizer = new SpeechRecognition();
    recognizer.lang = 'es-MX';
    recognizer.continuous = true;
    recognizer.interimResults = true;
    recognizer.maxAlternatives = 1;

    recognizer.onresult = (event: any) => {
      let interim = '';
      let final = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const item = event.results[i];
        if (item.isFinal) {
          final += item[0].transcript;
        } else {
          interim += item[0].transcript;
        }
      }

      if (final) {
        onResult(final.trim(), true);
      } else if (interim) {
        onResult(interim.trim(), false);
      }
    };

    recognizer.onend = () => {
      if (onEnd) onEnd();
    };

    recognizer.onerror = (e: any) => {
      if (onError) onError(e);
      if (onEnd) onEnd();
    };

    return {
      start: () => {
        try {
          recognizer.start();
        } catch {
          // ignore duplicate start errors
        }
      },
      stop: () => {
        try {
          recognizer.stop();
        } catch {
          // ignore stop errors
        }
      },
      abort: () => {
        try {
          recognizer.abort();
        } catch {
          // ignore abort errors
        }
      },
    };
  } catch (err) {
    if (onError) onError(err);
    return null;
  }
}

// Realistic contextual voice note transcripts tailored for each stage of the Lidacta methodology
export const STAGE_VOICE_SAMPLE_TRANSCRIPTS: Record<number, string[]> = {
  1: [
    'El hecho detonante ocurrió el lunes: el cliente adelantó la entrega y dos supervisores tuvieron desacuerdos sobre reasignar recursos sin consultar previamente.',
    'Detecto que la situación principal no es técnica, sino falta de acuerdos previos claros sobre quién asume la decisión final ante imprevistos.',
    'Lo que sucedió concretamente es que surgieron tensiones en el equipo operativo por asignación desigual de prioridades en el cierre de mes.',
  ],
  2: [
    'Poniéndome en el lugar del equipo, perciben que exijo rapidez sin darles margen de maniobra. La habilidad clave que necesito activar es la escucha empática y la asertividad serena.',
    'Desde su perspectiva, sienten que no confío en su criterio porque reviso cada detalle. Mi desafío directivo es practicar el empoderamiento y la delegación efectiva.',
    'Reconozco que faltó sensibilidad ante su sobrecarga de trabajo. Necesito poner en juego inteligencia emocional y retroalimentación constructiva.',
  ],
  3: [
    'Para avanzar en esta etapa visualizo dos alternativas viables: delegar la coordinación operativa en Mariana con criterios de éxito claros, o calendarizar sincronizaciones quincenales en vez de revisiones diarias.',
    'Diseño tres opciones: transferir la toma de decisiones inmediata de casos estándar, implementar un tablero de autogestión y reservar mi intervención solo para excepciones.',
    'Una alternativa sólida es acordar plazos de entrega escalonados y otorgar autonomía de firma a los coordinadores para agilizar el flujo de trabajo.',
  ],
  4: [
    'Lidacta, quiero practicar el diálogo antes de la reunión: Hola Carlos, te cité para revisar cómo nos fue con las últimas entregas y acordar juntos cómo fortalecer tu autonomía.',
    'Simulemos la conversación difícil: Necesito expresar con firmeza que los plazos acordados son prioritarios, pero escuchando genuinamente qué obstáculos enfrentaron.',
    'Quiero entrenar mi respuesta en caso de que el colaborador reaccione a la defensiva o justifique retrasos responsabilizando a otras áreas.',
  ],
  5: [
    'Aterrizo mi plan de acción: el próximo jueves a las 10:30 AM tendré la sesión 1 a 1 de 30 minutos con el coordinador. Cuidaré enfocarme en hechos medibles y no juzgar.',
    'Plan concreto: este viernes a primera hora presentaré al equipo el nuevo esquema de delegación; cuidaré escuchar activamente el 80% del tiempo.',
    'Compromiso de acción: el martes a las 9:00 AM firmaremos el acuerdo de metas compartidas, manteniendo serenidad y claridad en las expectativas.',
  ],
  6: [
    'Llevé a cabo la conversación y el resultado fue muy positivo. El equipo se sintió respaldado. Mi gran aprendizaje es que cuando no supongo intenciones negativas, la colaboración fluye con madurez.',
    'Lo que mejor funcionó fue hacer preguntas poderosas en lugar de imponer soluciones. Aprendí que delegar con confianza acelera los tiempos y fortalece al equipo.',
    'La sesión se dio con apertura. Me di cuenta de que mi necesidad excesiva de control era el principal freno para la autonomía del área.',
  ],
  7: [
    'He analizado a fondo mi reporte confidencial de retroalimentación. Me parece muy acertado el reconocimiento de mis fortalezas y asumo el compromiso de sostener mi autonomía directiva.',
    'El recorrido por las 7 etapas con Lidacta me permitió ordenar mis decisiones y resolver este reto con serenidad, profesionalismo y confianza.',
    'Agradezco este espacio confidencial. Me llevo herramientas claras para continuar delegando y consolidando un liderazgo inspirador con mi equipo.',
  ],
};

export function getRandomVoiceSample(stage: number): string {
  const samples = STAGE_VOICE_SAMPLE_TRANSCRIPTS[stage] || STAGE_VOICE_SAMPLE_TRANSCRIPTS[1];
  const index = Math.floor(Math.random() * samples.length);
  return samples[index];
}
