# Kuis Pameran Arsip

Interactive quiz SPA for exhibition/archive events. Participants answer randomized questions and receive scores. Sponsor logos are displayed dynamically on the landing page.

## Live Site

Deployed on Netlify: `https://<your-site>.netlify.app`

## Architecture

```
Browser (SPA)
    ↓ fetch (GET/POST)
Netlify Function (server-side proxy) ← reads env vars
    ↓ fetch with API key injected
Google Apps Script (secured API gateway)
    ↓ reads/writes
Google Sheet (private database: Settings + Questions + Attempts)
```

**Security model:** The Google Sheet is private. The API key is stored only in Netlify env vars and injected server-side by the Netlify Function. The browser never sees the key or the Sheet URL. Quiz attempts are validated server-side with device fingerprinting + daily limits.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | HTML5, Tailwind CSS (CDN), Vanilla ES6+ JavaScript |
| Effects | Canvas-Confetti (CDN) — confetti burst on perfect score |
| Fingerprint | FingerprintJS (CDN) — device identification for attempt tracking |
| Proxy | Netlify Functions (Node.js) — `/.netlify/functions/quiz` |
| Backend | Google Apps Script — `doGet(e)` for questions, `doPost(e)` for submissions |
| Database | Google Sheets (3 tabs: Settings + Questions + Attempts) |
| Hosting | Netlify (static + serverless functions) |

## Project Structure

```
PameranArsip/
├── index.html                  ← Single-page app (all views in one file)
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

The app has 5 views, all in `index.html`. JavaScript toggles visibility with `showView()`.

### View 1: Landing (`#view-landing`)
- Sponsor logos auto-detected from `assets/logo1.png` through `logo10.png`
- Title: "Kuis Pameran Arsip"
- Subtitle: "Jawab pertanyaanya dan dapatkan hadiah yang menarik"
- **Name input (required)**: User must enter their name before starting
- CTA button: "Mulai Sekarang" → calls `startQuiz()`
- Loading state: button text changes to "Memuat Soal..." while fetching

### View 2: Quiz (`#view-quiz`)
- **Tab switch warning banner**: Shows when user leaves quiz tab
- **Sponsor logo**: First detected logo displayed in header (always visible during quiz)
- Header: progress counter ("Soal 3 / 10") + target indicator ("Target: 100")
- Progress bar animates per question
- Question card with 4 option buttons (A, B, C, D badges)
- On click: highlights correct (green) / incorrect (red), then advances after 600ms
- **No-select CSS**: Prevents text selection on quiz content

### View 3: Results (`#view-results`)
- **Personalized greeting**: "Selamat, [Name]!" displayed above score
- Score normalized to 100-point scale: `Math.round((correctAnswers / totalQuestions) * 100)`
- **Timing metadata**: Shows total duration and tab switch count
- **Submission status**: Shows whether score was saved to server
- **Score == 100:** Trophy icon, "Skor Sempurna!", confetti burst, "Kembali ke Beranda" button
- **Score < 100:** Retry icon, "Coba Lagi!", score display, "Coba Lagi" button
- Both buttons call `resetToLanding()` which resets all state and clears name

### View 4: Already Attempted (`#view-attempted`)
- Shown when user has already taken the quiz today
- Displays previous score and personalized message
- "Kembali ke Beranda" button

### View 5: Admin (`#view-admin`)
- Accessible via `?admin=true` URL parameter
- Password-protected admin panel for resetting user attempts
- Enter admin password and target user name to allow retake

## Security Features (7 Layers)

### Layer 1: Device Fingerprinting
- Uses FingerprintJS to generate a unique browser ID
- Stored in `localStorage` after first quiz attempt
- Combined with name for server-side duplicate detection

### Layer 2: Quiz Timing & Metadata Tracking
- Records `quizStartTime` when quiz begins, calculates `totalDuration` on completion
- Tracks per-question response times in `questionTimes[]` array
- Flagged if average time per question < 3 seconds (potential bot/cheat)

### Layer 3: Tab/Window Switch Detection
- Listens for `visibilitychange` and `blur` events
- Counts tab switches in `tabSwitchCount`
- Shows warning banner when user leaves quiz tab
- Stored in submission data for admin review

### Layer 4: Screenshot Prevention (Basic Deterrent)
- Disables right-click via `contextmenu` event during quiz
- Blocks `PrintScreen`, `Ctrl+Shift+S`, `Ctrl+P`, `Ctrl+U`, `F12` keyboard shortcuts
- CSS `user-select: none` on quiz content
- **Note**: Determined cheaters can bypass this, but it stops casual screenshotting

### Layer 5: Server-Side Score Submission
- On quiz completion, POST to Netlify function with full metadata
- Google Apps Script writes to "Attempts" sheet
- Prevents client-side score manipulation

### Layer 6: One-Attempt-Per-Day Enforcement
- Before starting quiz, checks server: "Has this name+fingerprint attempted today?"
- If attempt exists: shows "Sudah Mengerjakan" view with previous score
- Stored in Google Sheet "Attempts" tab with date column for daily filtering

### Layer 7: Admin Override Password
- Hidden admin page at `?admin=true` URL parameter
- Admin enters password (set as `ADMIN_PASSWORD` in Code.gs)
- Can search by name and reset their attempt for today
- Sets `adminReset = TRUE` in Attempts sheet (original record preserved for audit)

## Google Apps Script Backend (`Code.gs`)

### Sheet Structure

**Settings tab:**
| A | B |
|---|---|
| QuestionCount | 10 |

Cell B1 controls how many questions per quiz (editable by admin anytime).

**Questions tab:**
| Question | OptionA | OptionB | OptionC | OptionD | CorrectIndex |
|----------|---------|---------|---------|---------|--------------|
| Contoh pertanyaan? | Jawaban A | Jawaban B | Jawaban C | Jawaban D | B |

- `CorrectIndex`: Accepts **letters** (A, B, C, D) or numbers (0, 1, 2, 3)
  - A = OptionA, B = OptionB, C = OptionC, D = OptionD
  - Legacy numeric format still works for backward compatibility
- Supports 1000+ rows

**Attempts tab (auto-created):**
| timestamp | name | fingerprint | score | totalQuestions | duration | questionTimes | tabSwitchCount | date | flagged | adminReset |
|-----------|------|-------------|-------|---------------|----------|---------------|----------------|------|---------|------------|

- `flagged`: TRUE if suspicious activity detected (fast time or many tab switches)
- `adminReset`: TRUE if admin allowed this user to retake

### Logic Flow

**GET requests (`doGet`):**
1. Validate `e.parameter.key` against `API_SECRET_KEY` → 403 if invalid
2. If `action=checkAttempt`: check Attempts sheet for today's attempt by name+fingerprint
3. Otherwise: return quiz questions (read from cache or sheet, shuffle, slice)

**POST requests (`doPost`):**
1. Validate `e.parameter.key` against `API_SECRET_KEY` → 403 if invalid
2. Parse JSON body for `action` field
3. If `action=submitQuiz`: write attempt to Attempts sheet
4. If `action=adminReset`: validate `adminPassword`, mark attempts as reset

### Deployment
- Deploy as Web App → Execute as: Me → Who has access: Anyone
- URL format: `https://script.google.com/macros/s/AKfycbx.../exec`
- Must create new deployment after editing Code.gs

## Netlify Function Proxy (`netlify/functions/quiz.js`)

Reads two env vars:
- `GOOGLE_SHEET_API_URL` — the Apps Script Web app URL
- `GOOGLE_SHEET_API_KEY` — the secret API key

**GET requests:** Forwards to Apps Script with `?key=<API_KEY>` and optional `action=checkAttempt` params.

**POST requests:** Forwards JSON body to Apps Script with `?key=<API_KEY>`.

Sets `Cache-Control: no-store` to prevent caching of attempt data.

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

### Reset a user's quiz attempt (Admin)
1. Navigate to `https://<your-site>.netlify.app/?admin=true`
2. Enter admin password and target user name
3. Click "Reset Percobaan"
4. User can now retake the quiz today

### View quiz attempts
1. Open your Google Sheet
2. Go to the **Attempts** tab
3. Review all submissions with scores, timing, and flagged status

## Performance Optimization

### Caching Strategy (3 Layers)

| Layer | Location | TTL | Effect |
|-------|----------|-----|--------|
| Server-side | Apps Script in-memory | 5 min | Skip Google Sheet read on warm invocations |
| Network | Netlify Function → Browser | 60s | `Cache-Control: public, max-age=60` |
| Client-side | localStorage | 5 min | Instant replay, no network requests |

### Client-Side Shuffle
- Questions shuffled in browser using Fisher-Yates algorithm
- First load: fetch from API → cache in localStorage → shuffle → pick 10
- Replay: read from localStorage → shuffle → pick 10 (instant)
- Cache expires after 5 minutes, then fresh data is fetched

### Expected Performance
| Scenario | Before | After |
|----------|--------|-------|
| First load (cold) | 3-8s | 3-8s |
| First load (warm) | 1-3s | <500ms |
| Replay quiz | 3-8s | **<10ms** |

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| "Gagal Memuat. Cek API" | Env vars not set or wrong | Check Netlify env vars match Code.gs |
| 403 / Unauthorized | API key mismatch | Ensure `GOOGLE_SHEET_API_KEY` = `API_SECRET_KEY` |
| Function 500 error | Apps Script URL wrong or not deployed | Check URL ends with `/exec`, redeploy |
| Blank page | JS error | Open DevTools Console (F12) |
| Logos not showing | Files not in assets/ or wrong naming | Check filename is `logo1.png` etc. |
| Questions not updating | Caching in Apps Script or browser | Wait 5 min for cache to expire, or redeploy Apps Script |
| Name input not working | Browser JS disabled | Enable JavaScript in browser settings |
| "Sudah Mengerjakan" shows incorrectly | Fingerprint mismatch | Clear localStorage and retry, or use admin reset |
| Admin reset fails | Wrong password | Ensure `ADMIN_PASSWORD` in Code.gs matches what you enter |
| Score not saving | Network error or Apps Script issue | Check Function logs in Netlify dashboard |

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
