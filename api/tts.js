/**
 * api/tts.js — SkipFlow
 *
 * Vercel serverless function: POST /api/tts, body { text, voiceName? }.
 * Enige doel: de Gemini TTS-aanroep server-side doen zodat GEMINI_API_KEY
 * nooit in clientcode terechtkomt (CLAUDE.md: deze app heeft verder geen
 * backend). Doet verder niets — geen Firestore, geen Storage, geen kennis
 * van competitionId/announcementId/caching. Alle orkestratie blijft
 * client-side in AppContext.jsx.
 *
 * Zie "Aankondigingen (TTS)" in ARCHITECTURE.md.
 */

// gemini-2.5-flash-preview-tts (het oorspronkelijk gekozen model, overgenomen
// uit de oude Apps Script-versie) staat door Google gepland om op 17 november
// 2026 stopgezet te worden — vlak vóór die datum gaf het al stilletjes geen
// audio meer terug (finishReason "OTHER", nul outputtokens, geen duidelijke
// foutmelding). gemini-3.8-flash-tts is de door Google aangewezen vervanger
// voor creatieve/langere spraak (het andere alternatief, het goedkopere/
// snellere gemini-3.8-flash-lite-tts, is gericht op hoog-volume/real-time
// gebruik). Zie https://ai.google.dev/gemini-api/docs/deprecations.
const GEMINI_MODEL = 'gemini-3.8-flash-tts';
const DEFAULT_VOICE_NAME = 'Enceladus';
const SYSTEM_INSTRUCTION_PREFIX =
  'Je bent omroeper op een Vlaamse ropeskipping wedstrijd en kondigt de deelnemers op een vlotte wijze aan met een heldere en opgewekte stem: ';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Alleen POST toegestaan.' });
    return;
  }

  const { text, voiceName = DEFAULT_VOICE_NAME } = req.body ?? {};
  if (!text || typeof text !== 'string') {
    res.status(400).json({ error: '"text" is verplicht.' });
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'GEMINI_API_KEY is niet ingesteld op de server.' });
    return;
  }

  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;
  const payload = {
    contents: [{ parts: [{ text: SYSTEM_INSTRUCTION_PREFIX + text }] }],
    generationConfig: {
      responseModalities: ['AUDIO'],
      temperature: 0.0,
      speechConfig: {
        voiceConfig: { prebuiltVoiceConfig: { voiceName } },
        languageCode: 'nl-NL',
      },
    },
  };

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const responseBody = await response.json();

    if (!response.ok) {
      res.status(response.status).json({ error: `Gemini TTS-fout ${response.status}: ${JSON.stringify(responseBody)}` });
      return;
    }

    const part = responseBody?.candidates?.[0]?.content?.parts?.[0]?.inlineData;
    if (!part?.data) {
      const reason = responseBody?.promptFeedback?.blockReason
        ?? responseBody?.candidates?.[0]?.finishReason
        ?? 'onbekend';
      // "OTHER" zonder outputtokens (candidatesTokenCount ontbreekt) is geen
      // contentfilter (SAFETY/RECITATION) en geen lengteprobleem (MAX_TOKENS)
      // — Gemini accepteert de prompt maar genereert zelf niets. In de
      // praktijk meestal een API-sleutel/project zonder audio-outputtoegang
      // (bv. geen facturatie gekoppeld), of een TTS-model dat stopgezet is of
      // op het punt staat stopgezet te worden (zie GEMINI_MODEL hierboven).
      const generatedNothing = reason === 'OTHER' && !responseBody?.usageMetadata?.candidatesTokenCount;
      const hint = generatedNothing
        ? ` Dit patroon (geen outputtokens, reden "OTHER") wijst meestal op een Gemini-API-sleutel/project zonder audio-outputtoegang (controleer facturatie in Google AI Studio/Cloud Console), of op een TTS-model dat niet meer (volledig) ondersteund wordt — zie https://ai.google.dev/gemini-api/docs/deprecations voor de actuele status van "${GEMINI_MODEL}".`
        : '';
      res.status(502).json({
        error: `Geen audio ontvangen van Gemini TTS (reden: ${reason}).${hint} Volledige respons: ${JSON.stringify(responseBody)}`,
      });
      return;
    }

    res.status(200).json({ audioBase64: part.data, mimeType: part.mimeType ?? null });
  } catch (err) {
    res.status(500).json({ error: err.message ?? 'Onbekende fout bij het aanroepen van Gemini TTS.' });
  }
}
