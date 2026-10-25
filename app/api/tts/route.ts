// Next.js App Router API Route (Proxy) for ElevenLabs Text-to-Speech
// Endpoint: POST /api/tts

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { text } = body || {};

    if (!text || typeof text !== 'string') {
      return new Response(JSON.stringify({ error: 'Texto requerido para síntesis' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const apiKey =
      process.env.ELEVENLABS_API_KEY ||
      process.env.NEXT_PUBLIC_ELEVENLABS_API_KEY ||
      'sk_f1522d73b2c5a237197337c9b0adacd87302c5f64d4806d9';

    const voiceId = process.env.ELEVENLABS_VOICE_ID || '4pxgXWex1CwQ1I4uyCVG';

    const cleanText = text
      .replace(/\[.*?\]/g, '')
      .replace(/#{1,6}\s+/g, '')
      .replace(/\*{1,3}(.*?)\*{1,3}/g, '$1')
      .replace(/_{1,3}(.*?)_{1,3}/g, '$1')
      .replace(/`{1,3}.*?`{1,3}/g, '')
      .replace(/^\s*[-*•]\s+/gm, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (!cleanText) {
      return new Response(JSON.stringify({ error: 'Texto limpio vacío' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
        'Accept': 'audio/mpeg',
      },
      body: JSON.stringify({
        text: cleanText,
        model_id: 'eleven_multilingual_v2',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return new Response(JSON.stringify({ error: 'ElevenLabs API error', details: errorText }), {
        status: response.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(response.body, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error?.message || 'Internal Server Error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
