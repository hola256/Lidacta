export function speakText(text: string, onEnd?: () => void) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    if (onEnd) onEnd();
    return;
  }

  // Cancel any ongoing speech
  window.speechSynthesis.cancel();

  // Strip stage tags or brackets for cleaner natural voice
  const cleanText = text
    .replace(/\[.*?\]/g, '')
    .replace(/\*\*/g, '')
    .trim();

  const utterance = new SpeechSynthesisUtterance(cleanText);
  utterance.lang = 'es-MX';
  utterance.rate = 1.0;
  utterance.pitch = 1.0;

  // Prefer natural Spanish voices if available
  const voices = window.speechSynthesis.getVoices();
  const esVoice =
    voices.find((v) => v.lang.startsWith('es') && (v.name.includes('Natural') || v.name.includes('Sabina') || v.name.includes('Paulina'))) ||
    voices.find((v) => v.lang.startsWith('es'));

  if (esVoice) {
    utterance.voice = esVoice;
  }

  utterance.onend = () => {
    if (onEnd) onEnd();
  };

  utterance.onerror = () => {
    if (onEnd) onEnd();
  };

  window.speechSynthesis.speak(utterance);
}

export function stopSpeaking() {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
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
