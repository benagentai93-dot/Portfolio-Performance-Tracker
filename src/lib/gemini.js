// Gemini API key. Provide via VITE_GEMINI_API_KEY env, or runtime injection.
export const apiKey = import.meta.env.VITE_GEMINI_API_KEY || '';

const MODEL_ENDPOINT =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent';

export const callGemini = async (body) => {
  const response = await fetch(`${MODEL_ENDPOINT}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error('AI service error');
  return response.json();
};
