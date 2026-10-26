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

export const ELEVENLABS_VOICE_ID = (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_ELEVENLABS_VOICE_ID) || '4pxgXWex1CwQlI4uyCVG';
export const ELEVENLABS_STREAM_URL = `https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}/stream`;
export const ELEVENLABS_API_KEY: string =
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_ELEVENLABS_API_KEY) ||
  (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_ELEVENLABS_API_KEY) ||
  '';

let currentAudioElement: HTMLAudioElement | null = null;
let currentAudioBlobUrl: string | null = null;

export function stopSpeaking() {
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
 * Main Text-to-Speech function
 * Directly and exclusively calls ElevenLabs official streaming route for cloned voice 'Lidacta Mentora':
 * https://api.elevenlabs.io/v1/text-to-speech/4pxgXWex1CwQ1I4uyCVG/stream
 *
 * NOTE: window.speechSynthesis and native browser voices are strictly removed.
 * If the API key is missing or the request fails, it produces no audio and logs the error in the console.
 */
export async function speakText(
  text: string,
  onEnd?: () => void,
  onStart?: () => void,
  onLoading?: (isLoading: boolean) => void
): Promise<void> {
  const cleanText = cleanTextForSpeech(text);
  if (!cleanText) {
    if (onLoading) onLoading(false);
    if (onEnd) onEnd();
    return;
  }

  // Stop any currently playing audio
  stopSpeaking();

  if (onLoading) onLoading(true);

  if (!ELEVENLABS_API_KEY) {
    console.error(
      '[ElevenLabs TTS Error] API Key no configurada (VITE_ELEVENLABS_API_KEY o NEXT_PUBLIC_ELEVENLABS_API_KEY ausente). No se reproduce audio.'
    );
    if (onLoading) onLoading(false);
    if (onEnd) onEnd();
    return;
  }

  try {
    const response = await fetch(ELEVENLABS_STREAM_URL, {
      method: 'POST',
      headers: {
        'xi-api-key': ELEVENLABS_API_KEY,
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
      const errText = await response.text();
      console.error(
        `[ElevenLabs TTS Error] Status: ${response.status} | Voice ID: ${ELEVENLABS_VOICE_ID} | Endpoint: ${ELEVENLABS_STREAM_URL} | Detalle:`,
        errText
      );
      if (onLoading) onLoading(false);
      if (onEnd) onEnd();
      return;
    }

    const blob = await response.blob();
    if (!blob || blob.size === 0) {
      console.error('[ElevenLabs TTS Error] Respuesta de audio vacía.');
      if (onLoading) onLoading(false);
      if (onEnd) onEnd();
      return;
    }

    const blobUrl = URL.createObjectURL(blob);
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

    audio.onerror = (e) => {
      console.error('[ElevenLabs TTS Error] Error al reproducir el archivo de audio:', e);
      if (onLoading) onLoading(false);
      stopSpeaking();
      if (onEnd) onEnd();
    };

    await audio.play();
  } catch (error) {
    console.error('[ElevenLabs TTS Error] Error de conexión con la API de ElevenLabs:', error);
    if (onLoading) onLoading(false);
    stopSpeaking();
    if (onEnd) onEnd();
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
