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

## Free-tier setup guide

All three external services used by this project have free tiers that are more than enough for personal use.

### Firebase (Spark plan — free)

1. Go to <https://console.firebase.google.com> and create a new project.
2. Add a **Web app** → copy the six config values into `.env.local` as `VITE_FIREBASE_*`.
3. **Authentication** → Sign-in method → enable **Anonymous**.
4. **Firestore Database** → Create database → start in *test mode* (or set proper rules before going public).

Free quota: 50K reads, 20K writes, 20K deletes per day, 1 GB storage, unlimited anonymous auth.

### Gemini API (Google AI Studio — free)

1. Visit <https://aistudio.google.com> and sign in with a **personal** Google account (Workspace accounts are sometimes blocked by admin policy).
2. Open <https://aistudio.google.com/apikey> (or click the key icon in the sidebar).
3. Click **Create API key** → *Create API key in new project* (Studio will auto-create a free Cloud project).
4. Copy the key — it starts with `AIzaSy...`. The full string is shown once, so save it.
5. Confirm the "Plan" column shows **Free tier**.
6. Paste into `.env.local`:
   ```bash
   VITE_GEMINI_API_KEY=AIzaSyDo-465FNf74IRTD0xl32vpjvh_o2WLSCk
   ```
7. Restart `npm run dev` (Vite does not hot-reload env files).

Free quota for Gemini 2.5 Flash: 15 RPM / 1M TPM / 1,500 requests per day.

**Troubleshooting**

| Symptom | Cause / fix |
|---|---|
| `API_KEY_INVALID` | Stray whitespace in the key — copy again |
| `User location is not supported` | Free tier is unavailable in some regions; use a VPN or a different Google account |
| `PERMISSION_DENIED` | Browser extension (adblock) blocks the request — disable it |
| Empty response | The model occasionally returns non-JSON; check DevTools Network tab |

### Hardening the key for public deployment

The key is embedded in the browser bundle, so for public hosting:

1. AI Studio → **API key** → click the key name → **Edit API key restrictions**.
2. **Application restrictions** → *HTTP referrers* → add your domain(s) (e.g. `https://your-site.vercel.app/*`).
3. **API restrictions** → *Restrict key* → allow only *Generative Language API*.

For stronger protection, proxy the Gemini call through a serverless function and never ship the key to the browser.

### Deploying for free

- **Vercel** — import the GitHub repo, add the `VITE_*` env vars, deploy.
- **Netlify** or **Cloudflare Pages** — same flow.
- **Firebase Hosting** — `npm i -g firebase-tools && firebase init hosting` (public dir = `dist`), then `npm run build && firebase deploy`.

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
