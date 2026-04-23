# Portfolio Performance Tracker

A React dashboard that tracks personal ETF performance against QQQ / VTI / VT "all-in" benchmarks, with Firestore sync, Gemini-powered price auto-fill, image receipt scanning, and AI investment advisory chat.

## Tech stack

- Vite + React 18
- Tailwind CSS (`tailwindcss-animate`)
- Firebase (Auth + Firestore)
- Recharts (composed area + line charts)
- Lucide icons
- Google Gemini 2.5 Flash (text + vision + grounded search)

## Setup

```bash
npm install
cp .env.example .env.local   # fill in Firebase + Gemini keys
npm run dev
```

Then open http://localhost:5173.

### Required env vars

See `.env.example`. Without Firebase credentials the app stays on the loading screen (anonymous sign-in fails). Without `VITE_GEMINI_API_KEY` the AI features (price auto-fill, screenshot OCR, advisor chat) return errors but the rest of the app still works.

## Build

```bash
npm run build       # outputs dist/
npm run preview     # serve dist/ locally
```

## Project layout

```
src/
  App.jsx                          # main InvestmentTracker page
  main.jsx                         # React root
  index.css                        # Tailwind + global utilities
  lib/
    firebase.js                    # Firebase init, exports auth/db/appId
    helpers.js                     # CSV/JSON export, parseStockCSV, extractJSON
    gemini.js                      # Gemini API helper + apiKey
  components/
    Toast.jsx
    StatCard.jsx
    ComparisonCard.jsx
    ConfirmDialog.jsx
    CustomTooltip.jsx
    AiAnalysisModal.jsx
    HistoryModal.jsx
    DataManagementModal.jsx
```

Firestore data is stored under `artifacts/{VITE_APP_ID}/users/{uid}/{deposits|portfolioHistory|settings|marketData}`.
