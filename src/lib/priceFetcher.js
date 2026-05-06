import { extractJSON } from './helpers.js';
import { apiKey } from './gemini.js';

const STOOQ_URL =
  'https://stooq.com/q/l/?s=qqq.us+vti.us+vt.us+qld.us&f=sd2t2ohlcv&h&e=csv';

const GEMINI_ENDPOINT =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent';

const STOOQ_TO_TICKER = {
  'QQQ.US': 'QQQ',
  'VTI.US': 'VTI',
  'VT.US': 'VT',
  'QLD.US': 'QLD',
};

const parseStooqCsv = (csv) => {
  const lines = csv.trim().split(/\r?\n/);
  if (lines.length < 2) return {};
  const result = {};
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(',');
    if (parts.length < 7) continue;
    const ticker = STOOQ_TO_TICKER[parts[0].trim().toUpperCase()];
    if (!ticker) continue;
    const date = parts[1].trim();
    const close = parseFloat(parts[6]);
    if (!date || date === 'N/D' || !Number.isFinite(close)) continue;
    result[ticker] = { date, close };
  }
  return result;
};

const fetchFromStooq = async () => {
  const response = await fetch(STOOQ_URL);
  if (!response.ok) throw new Error(`Stooq HTTP ${response.status}`);
  const text = await response.text();
  const parsed = parseStooqCsv(text);
  if (Object.keys(parsed).length < 4) {
    throw new Error('Stooq returned incomplete data');
  }
  return parsed;
};

const fetchFromGemini = async () => {
  if (!apiKey) throw new Error('Gemini API key not configured');
  const today = new Date().toISOString().split('T')[0];
  const prompt = `
    Find the most recent closing prices for these US ETFs as of ${today}.
    If markets are closed today, use the previous trading day's close.

    Return ONLY valid JSON. No markdown.
    {
      "date": "YYYY-MM-DD",
      "qqq": number,
      "vti": number,
      "vt": number,
      "qld": number
    }
  `;
  const response = await fetch(`${GEMINI_ENDPOINT}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      tools: [{ google_search: {} }],
    }),
  });
  if (!response.ok) throw new Error(`Gemini HTTP ${response.status}`);
  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  const json = extractJSON(text);
  if (!json || !json.date) throw new Error('Gemini returned invalid data');
  const result = {};
  if (Number.isFinite(json.qqq)) result.QQQ = { date: json.date, close: json.qqq };
  if (Number.isFinite(json.vti)) result.VTI = { date: json.date, close: json.vti };
  if (Number.isFinite(json.vt)) result.VT = { date: json.date, close: json.vt };
  if (Number.isFinite(json.qld)) result.QLD = { date: json.date, close: json.qld };
  return result;
};

export const fetchLatestPrices = async () => {
  try {
    return await fetchFromStooq();
  } catch (e) {
    console.warn('[priceFetcher] Stooq failed, falling back to Gemini:', e.message);
    return await fetchFromGemini();
  }
};
