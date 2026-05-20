import { extractJSON, parseStockCSV } from './helpers.js';
import { apiKey } from './gemini.js';

const STOOQ_URL =
  'https://stooq.com/q/l/?s=qqq.us+vti.us+vt.us+qld.us+soxx.us&f=sd2t2ohlcv&h&e=csv';

const GEMINI_ENDPOINT =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent';

const STOOQ_TO_TICKER = {
  'QQQ.US': 'QQQ',
  'VTI.US': 'VTI',
  'VT.US': 'VT',
  'QLD.US': 'QLD',
  'SOXX.US': 'SOXX',
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
  if (Object.keys(parsed).length < 1) {
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
      "qld": number,
      "soxx": number
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
  if (Number.isFinite(json.soxx)) result.SOXX = { date: json.date, close: json.soxx };
  return result;
};

export const fetchLatestPrices = async () => {
  // Yahoo first: returns the unadjusted regular-session close, which is
  // what brokers / Google Finance show. Stooq's /q/l/ can hold an intraday
  // last price and its data is dividend-adjusted; Gemini's google_search
  // often grounds on Stooq too.
  try {
    return await fetchYahooLatest(['QQQ', 'VTI', 'VT', 'QLD', 'SOXX']);
  } catch (e) {
    console.warn('[priceFetcher] Yahoo failed, trying Stooq:', e.message);
  }
  try {
    return await fetchFromStooq();
  } catch (e) {
    console.warn('[priceFetcher] Stooq failed, falling back to Gemini:', e.message);
    return await fetchFromGemini();
  }
};

const CORS_PROXIES = [
  (u) => `https://corsproxy.io/?url=${encodeURIComponent(u)}`,
  (u) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
];

const fetchCsv = async (url) => {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const text = await response.text();
  if (!text || text.trim().length === 0) throw new Error('empty body');
  return text;
};

// Fetch latest unadjusted close prices from Yahoo Finance via CORS proxies.
// Yahoo's v8 chart endpoint returns the actual market close (not the dividend-
// adjusted one), which matches what brokers and Google Finance show.
//
// `tickers` is an array of US ETF symbols; we fetch one URL per ticker in
// parallel (Yahoo's v8 endpoint is single-symbol). For each ticker we try
// direct first, then each CORS proxy. Returns { TICKER: { date, close } }.
// Throws if all attempts for at least one required ticker fail.
export const fetchYahooLatest = async (tickers) => {
  const fetchOne = async (ticker) => {
    const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=5d`;
    const attempts = [yahooUrl, ...CORS_PROXIES.map((p) => p(yahooUrl))];
    for (const url of attempts) {
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const result = data?.chart?.result?.[0];
        if (!result) throw new Error('no chart result');
        const closes = result?.indicators?.quote?.[0]?.close;
        const timestamps = result?.timestamp;
        if (!closes?.length || !timestamps?.length) throw new Error('no data');
        // Last non-null close (today's may be null if market hasn't closed)
        let lastIdx = closes.length - 1;
        while (lastIdx >= 0 && (closes[lastIdx] == null || !Number.isFinite(closes[lastIdx]))) {
          lastIdx--;
        }
        if (lastIdx < 0) throw new Error('no valid close');
        const close = closes[lastIdx];
        const date = new Date(timestamps[lastIdx] * 1000).toISOString().split('T')[0];
        return { ticker, entry: { date, close } };
      } catch (e) {
        console.warn(`[Yahoo] ${ticker} fetch failed for ${url.slice(0, 80)}...: ${e.message}`);
      }
    }
    return { ticker, entry: null };
  };

  const results = await Promise.all(tickers.map(fetchOne));
  const out = {};
  for (const { ticker, entry } of results) {
    if (entry) out[ticker] = entry;
  }
  if (Object.keys(out).length === 0) {
    throw new Error('Yahoo returned no prices (all tickers failed)');
  }
  return out;
};

export const fetchHistoricalPrices = async (ticker) => {
  const stooqUrl = `https://stooq.com/q/d/l/?s=${ticker.toLowerCase()}.us&i=d`;
  const attempts = [stooqUrl, ...CORS_PROXIES.map((p) => p(stooqUrl))];

  let lastErr = null;
  for (const url of attempts) {
    try {
      const text = await fetchCsv(url);
      const result = parseStockCSV(text);
      if (result.error) throw new Error(result.error);
      if (!result.data || result.data.length === 0) {
        throw new Error('no historical data');
      }
      return result.data;
    } catch (e) {
      lastErr = e;
      console.warn(`[priceFetcher] history fetch failed for ${url}:`, e.message);
    }
  }
  throw new Error(
    `無法取得 ${ticker} 歷史價 (${lastErr?.message || 'unknown'})。Stooq CORS 與代理皆失敗,請手動上傳 CSV。`
  );
};
