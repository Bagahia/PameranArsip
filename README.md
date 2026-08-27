# Kuis Pameran Arsip

Interactive quiz SPA for exhibition/archive events. Participants answer randomized questions and receive scores. Sponsor logos are displayed dynamically on the landing page.

## Live Site

Deployed on Netlify: `https://<your-site>.netlify.app`

## Architecture

```
Browser (SPA)
    ↓ fetch
Netlify Function (server-side proxy) ← reads env vars
    ↓ fetch with API key injected
Google Apps Script (secured API gateway)
    ↓ reads
Google Sheet (private database)
```

**Security model:** The Google Sheet is private. The API key is stored only in Netlify env vars and injected server-side by the Netlify Function. The browser never sees the key or the Sheet URL.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | HTML5, Tailwind CSS (CDN), Vanilla ES6+ JavaScript |
| Effects | Canvas-Confetti (CDN) — confetti burst on perfect score |
| Proxy | Netlify Functions (Node.js) — `/.netlify/functions/quiz` |
| Backend | Google Apps Script — `doGet(e)` returns JSON |
| Database | Google Sheets (2 tabs: Settings + Questions) |
| Hosting | Netlify (static + serverless functions) |

## Project Structure

```
PameranArsip/
├── index.html                  ← Single-page app (all 3 views in one file)
├── Code.gs                     ← Google Apps Script backend (paste into script.google.com)
├── netlify.toml                ← Netlify config (functions dir, publish dir)
├── netlify/
│   └── functions/
│       └── quiz.js             ← Server-side proxy (reads GOOGLE_SHEET_API_URL + API_KEY env vars)
├── assets/
│   ├── logo1.png               ← Sponsor logo 1 (auto-detected)
│   ├── logo2.png               ← Sponsor logo 2 (auto-detected)
│   └── ...                     ← Up to logo10 in any format (png/svg/jpg/jpeg/webp/gif)
├── .gitignore                  ← Excludes node_modules, .netlify, OS files
├── SETUP.md                    ← Step-by-step setup guide (7 steps + troubleshooting)
└── README.md                   ← This file
```

## SPA Views (State Machine)

The app has 3 views, all in `index.html`. JavaScript toggles visibility with `showView()`.

### View 1: Landing (`#view-landing`)
- Sponsor logos auto-detected from `assets/logo1.png` through `logo10.png`
- Title: "Kuis Pameran Arsip"
- Subtitle: "Jawab pertanyaanya dan dapatkan hadiah yang menarik"
- CTA button: "Mulai Sekarang" → calls `startQuiz()`
- Loading state: button text changes to "Memuat Soal..." while fetching

### View 2: Quiz (`#view-quiz`)
- Header: progress counter ("Soal 3 / 10") + target indicator ("Target: 100")
- Progress bar animates per question
- Question card with 4 option buttons (A, B, C, D badges)
- On click: highlights correct (green) / incorrect (red), then advances after 600ms

### View 3: Results (`#view-results`)
- Score normalized to 100-point scale: `Math.round((correctAnswers / totalQuestions) * 100)`
- **Score == 100:** Trophy icon, "Skor Sempurna!", confetti burst, "Kembali ke Beranda" button
- **Score < 100:** Retry icon, "Coba Lagi!", score display, "Coba Lagi" button
- Both buttons call `resetToLanding()` which resets all state

## Google Apps Script Backend (`Code.gs`)

### Sheet Structure

**Settings tab:**
| A | B |
|---|---|
| QuestionCount | 5 |

Cell B1 controls how many questions per quiz (editable by admin anytime).

**Questions tab:**
| Question | OptionA | OptionB | OptionC | OptionD | CorrectIndex |
|----------|---------|---------|---------|---------|--------------|
| Contoh pertanyaan? | Jawaban A | Jawaban B | Jawaban C | Jawaban D | 1 |

- `CorrectIndex`: 0 = OptionA, 1 = OptionB, 2 = OptionC, 3 = OptionD
- Supports 100+ rows

### Logic Flow
1. Validate `e.parameter.key` against `API_SECRET_KEY` → 403 if invalid
2. Read `QuestionCount` from Settings sheet (fallback: 5)
3. Read all rows from Questions sheet
4. Fisher-Yates shuffle all questions
5. Slice to `QuestionCount`
6. Return JSON with `ContentService.MimeType.JSON`

### Deployment
- Deploy as Web App → Execute as: Me → Who has access: Anyone
- URL format: `https://script.google.com/macros/s/AKfycbx.../exec`
- Must create new deployment after editing Code.gs

## Netlify Function Proxy (`netlify/functions/quiz.js`)

Reads two env vars:
- `GOOGLE_SHEET_API_URL` — the Apps Script Web app URL
- `GOOGLE_SHEET_API_KEY` — the secret API key

Fetches the Apps Script URL with `?key=<API_KEY>` and returns the JSON response. Sets `Cache-Control: no-store` to prevent caching.

## Sponsor Logo System

### How It Works
The app probes `assets/logo1` through `assets/logo10` in 6 formats (png, svg, jpg, jpeg, webp, gif). Only logos that exist are displayed. If no logos are found, a default SVG "Q!" badge is shown.

### Adding/Removing Sponsors
1. Place files in `assets/` with naming: `logo1.png`, `logo2.svg`, `logo3.jpg`, etc.
2. First matching extension wins per number (e.g., if `logo1.png` and `logo1.svg` both exist, only `.png` loads)
3. Logos display in a responsive flex row: `h-20` on mobile, `h-28` on desktop, max width 140px

### Supported Formats
`png`, `svg`, `jpg`, `jpeg`, `webp`, `gif`

## Environment Variables (Netlify)

| Variable | Where Used | Description |
|----------|-----------|-------------|
| `GOOGLE_SHEET_API_URL` | `netlify/functions/quiz.js` | Apps Script Web app URL |
| `GOOGLE_SHEET_API_KEY` | `netlify/functions/quiz.js` | Must match `API_SECRET_KEY` in `Code.gs` |

**NEVER** put these in `index.html` or any committed file.

## UI Customization

All customization points are marked with `<!-- CUSTOMIZATION -->` comments in `index.html`.

| What | Where | How |
|------|-------|-----|
| Title | `<h1>` in landing view | Change text |
| Subtitle | `<p>` in landing view | Change text |
| Button text | `<button id="btn-start">` | Change text |
| Theme colors | `tailwind.config` in `<script>` | Change hex values |
| Font | Google Fonts `@import` in `<style>` | Swap font name |
| Logo sizes | `loadSponsorLogos()` in JS | Change `h-20 md:h-28` classes |
| Max logos | `MAX_LOGOS` constant | Change from 10 to any number |

## Common Tasks

### Add a new question
Open Google Sheet → Questions tab → add a row. No code changes needed. Takes effect on next request.

### Change question count
Open Google Sheet → Settings tab → change cell B1. Takes effect immediately.

### Change theme color
Edit `tailwind.config` in `index.html`:
```js
accent: { 400: '#818cf8', 500: '#6366f1', 600: '#4f46e5', 700: '#4338ca' }
```

### Update Apps Script
1. Edit `Code.gs` in script.google.com
2. Deploy → Manage deployments → Edit → New version → Deploy
3. No frontend changes needed

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| "Gagal Memuat. Cek API" | Env vars not set or wrong | Check Netlify env vars match Code.gs |
| 403 / Unauthorized | API key mismatch | Ensure `GOOGLE_SHEET_API_KEY` = `API_SECRET_KEY` |
| Function 500 error | Apps Script URL wrong or not deployed | Check URL ends with `/exec`, redeploy |
| Blank page | JS error | Open DevTools Console (F12) |
| Logos not showing | Files not in assets/ or wrong naming | Check filename is `logo1.png` etc. |
| Questions not updating | Apps Script caching | Redeploy the Web App |

## Git & Deployment

### Push Changes
```bash
git add .
git commit -m "Your message"
git push
```
Netlify auto-deploys on push to `main`.

### Git Config (this repo)
- User: `Bagahia`
- Email: `fuad.muhammad.f@gmail.com`
- Remote: `https://github.com/Bagahia/PameranArsip.git`

## License

Internal use for exhibition/archive events.
