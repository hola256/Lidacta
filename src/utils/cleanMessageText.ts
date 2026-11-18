/**
 * Utilidad pura para sanitizar y limpiar las respuestas de Lidacta,
 * garantizando que el líder vea exclusivamente el contenido conversacional destinado a él.
 * 
 * Elimina:
 * - Volcados accidentales de payloads JSON (llaves, comillas, corchetes, nombres de campos técnicos).
 * - Cercos de código markdown (```json o ```).
 * - Etiquetas de pensamiento o razonamiento interno (<thought>...</thought>, <think>...</think>).
 * - Marcadores técnicos de depuración ([Pensamiento:...], [Análisis:...]).
 * 
 * Conserva íntegramente:
 * - Acentos (á, é, í, ó, ú, ñ, etc.).
 * - Puntuación española e internacional (¿?, ¡!, ., ,, ;, :, —, ").
 * - Saltos de línea y estructura de párrafos.
 * - Viñetas legítimas de la conversación (•, -).
 * - Formato en negrita (**texto**) o cursiva (*texto*).
 */

export function cleanConversationalText(raw: string | undefined | null): string {
  if (!raw || typeof raw !== 'string') return '';

  let text = raw.trim();

  // 1. Eliminar etiquetas de pensamiento o introspección interna (<thought>...</thought>, <think>...</think>)
  text = text.replace(/<(?:thought|think)>[\s\S]*?<\/(?:thought|think)>/gi, '').trim();

  // 2. Si el texto completo viene envuelto en bloques de código markdown (```json ... ``` o ``` ... ```)
  const codeBlockMatch = text.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (codeBlockMatch && codeBlockMatch[1]) {
    text = codeBlockMatch[1].trim();
  }

  // 3. Detectar si el texto contiene una estructura de objeto JSON o un volcado crudo
  const hasJsonStructure =
    (text.startsWith('{') && text.endsWith('}')) ||
    text.includes('"replyText"') ||
    text.includes('"reply"') ||
    text.includes('"mensaje"');

  if (hasJsonStructure) {
    // Intento A: Parsear como JSON estándar
    try {
      const firstBrace = text.indexOf('{');
      const lastBrace = text.lastIndexOf('}');
      const jsonCandidate =
        firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace
          ? text.substring(firstBrace, lastBrace + 1)
          : text;

      const parsed = JSON.parse(jsonCandidate);
      const extracted =
        parsed.replyText ||
        parsed.reply ||
        parsed.text ||
        parsed.response ||
        parsed.mensaje ||
        parsed.content;

      if (typeof extracted === 'string' && extracted.trim().length > 0) {
        return cleanConversationalText(extracted);
      }
    } catch {
      // Intento B: Si JSON.parse falla por imperfección de sintaxis (comas o comillas internas),
      // extraer directamente el valor del campo conversacional mediante regex dirigida
      const fieldMatch =
        text.match(/"replyText"\s*:\s*"((?:[^"\\]|\\.)*)"/) ||
        text.match(/"reply"\s*:\s*"((?:[^"\\]|\\.)*)"/) ||
        text.match(/"text"\s*:\s*"((?:[^"\\]|\\.)*)"/) ||
        text.match(/"mensaje"\s*:\s*"((?:[^"\\]|\\.)*)"/);

      if (fieldMatch && fieldMatch[1]) {
        try {
          const decoded = JSON.parse(`"${fieldMatch[1]}"`);
          if (typeof decoded === 'string' && decoded.trim().length > 0) {
            return cleanConversationalText(decoded);
          }
        } catch {
          const unescaped = fieldMatch[1]
            .replace(/\\"/g, '"')
            .replace(/\\n/g, '\n')
            .replace(/\\r/g, '')
            .replace(/\\t/g, '\t')
            .replace(/\\\\/g, '\\')
            .trim();
          if (unescaped.length > 0) {
            return unescaped;
          }
        }
      }
    }
  }

  // 4. Limpiar cercos de código markdown dispersos (```json o ```) si quedaron en el texto
  if (text.includes('```')) {
    text = text.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim();
  }

  // 5. Eliminar cualquier marcador técnico de depuración que haya podido anteponerse
  text = text.replace(/^\[(?:Pensamiento|Análisis|Analysis|Internal|Prompt|Stage\s*\d+)\]:?\s*/i, '').trim();

  return text;
}
