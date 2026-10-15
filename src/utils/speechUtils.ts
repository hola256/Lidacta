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

export function createSpeechRecognizer(
  onResult: (transcript: string) => void,
  onEnd?: () => void
): { start: () => void; stop: () => void } | null {
  if (!isSpeechRecognitionSupported()) return null;

  const SpeechRecognition =
    (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

  const recognizer = new SpeechRecognition();
  recognizer.lang = 'es-MX';
  recognizer.continuous = false;
  recognizer.interimResults = false;

  recognizer.onresult = (event: any) => {
    const transcript = event.results[0]?.[0]?.transcript || '';
    if (transcript) {
      onResult(transcript);
    }
  };

  recognizer.onend = () => {
    if (onEnd) onEnd();
  };

  recognizer.onerror = () => {
    if (onEnd) onEnd();
  };

  return {
    start: () => recognizer.start(),
    stop: () => recognizer.stop(),
  };
}
