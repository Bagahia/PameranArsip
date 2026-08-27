# Quiz Challenge App - Setup Guide

## Prerequisites

- [Google Account](https://accounts.google.com) (for Sheets + Apps Script)
- [Netlify Account](https://app.netlify.com) (free tier works)
- [GitHub Account](https://github.com) (for version control)
- [Git](https://git-scm.com/downloads) installed on your machine
- (Optional) [Node.js](https://nodejs.org) — only needed for local testing with `netlify dev`

---

## Step 0: Generate a Secure API Key

You need a random secret key to protect your API endpoint.

### macOS / Linux
```bash
openssl rand -hex 32
```

### Windows (PowerShell)
```powershell
-join ((48..57) + (65..90) + (97..122) | Get-Random -Count 64 | ForEach-Object { [char]$_ })
```

Copy the output — this is your `API_SECRET_KEY`. You'll use it in Steps 2 and 3.

---

## Step 1: Create & Secure Your Google Sheet

1. Go to [Google Sheets](https://sheets.google.com) and create a new spreadsheet.
2. Name the first sheet **Settings** and enter:

   | A | B |
   |---|---|
   | QuestionCount | 5 |

3. Create a second sheet named **Questions** with these headers in row 1:

   | Question | OptionA | OptionB | OptionC | OptionD | CorrectIndex |
   |----------|---------|---------|---------|---------|--------------|
   | What is 2+2? | 3 | 4 | 5 | 6 | 1 |
   | Capital of France? | London | Berlin | Paris | Madrid | 2 |

   - `CorrectIndex` is 0-based: **0** = OptionA, **1** = OptionB, **2** = OptionC, **3** = OptionD.
   - Add as many rows as you want (supports 100+).
   - You can edit these rows at any time — changes take effect immediately.

4. **Keep the sheet private.** In Google Drive, right-click the sheet → Share → ensure access is **Restricted (Only you)**. Do NOT add anyone else.

---

## Step 2: Deploy Google Apps Script

1. In your spreadsheet, go to **Extensions → Apps Script**.
2. Delete any default code in `Code.gs` and paste the entire contents of the `Code.gs` file from this project.
3. **Set your API key** — edit line 3 of `Code.gs`:

   ```js
   const API_SECRET_KEY = "paste_your_generated_key_here";
   ```

   Use the key you generated in Step 0.

4. Click **Save** (floppy disk icon or Ctrl+S).
5. Click **Deploy → New deployment**.
6. Configure the deployment:
   - **Type:** Select "Web app"
   - **Description:** "Quiz API" (or anything you like)
   - **Execute as:** Me (your email)
   - **Who has access:** Anyone
7. Click **Deploy**.
8. **Copy the Web app URL** — it looks like:
   ```
   https://script.google.com/macros/s/AKfycbx...ABC123.../exec
   ```
   Save this URL — you'll need it in Step 3.

> **Important:** Every time you edit `Code.gs`, you must go to **Deploy → Manage deployments → Edit (pencil icon) → New version → Deploy** for changes to take effect.

---

## Step 3: Set Netlify Environment Variables

Your secrets live here — **never** in `index.html` or any committed file.

1. Go to [app.netlify.com](https://app.netlify.com) → click your site (or create a new one later after pushing to GitHub).
2. Navigate to **Site settings → Environment variables**.
3. Click **Add a variable** and add both:

   | Key | Value |
   |-----|-------|
   | `GOOGLE_SHEET_API_URL` | The Web app URL from Step 2 |
   | `GOOGLE_SHEET_API_KEY` | The same API key you set in `Code.gs` |

4. Click **Save** for each.

### How the Security Works

```
Browser  →  /.netlify/functions/quiz  →  Google Apps Script
          (no secrets visible)         (key injected server-side)
```

The frontend calls a Netlify Function. The function reads your env vars, adds the API key, and forwards the request. The key **never** reaches the browser.

---

## Step 4: Customize the UI (Optional)

### Sponsor Logos
The app auto-detects and displays sponsor logos from the `assets/` folder.

1. Place your logo files in the `assets/` folder with this naming convention:
   ```
   assets/
   ├── logo1.png    ← First sponsor
   ├── logo2.png    ← Second sponsor
   ├── logo3.svg    ← Third sponsor (any format)
   └── logo4.jpg    ← Fourth sponsor
   ```

2. Supported formats: `png`, `svg`, `jpg`, `jpeg`, `webp`, `gif`

3. The app checks for `logo1` through `logo10` and **only displays logos that exist**:
   - 3 files → 3 logos shown in a row
   - 1 file → 1 logo shown
   - 0 files → default SVG fallback shown

4. Logos are displayed in a responsive flex row with consistent height (h-16 on mobile, h-20 on desktop).

### Edit Text & Colors
Open `index.html` and look for the `CUSTOMIZATION` comment block near the top:

```html
<!-- ============================================================
     CUSTOMIZATION — Edit these values to brand your quiz app
     ============================================================ -->
```

| What to change | Where | Example |
|----------------|-------|---------|
| App title | `<h1>` tag in landing view | "My Quiz" |
| Subtitle | `<p>` tag in landing view | "Test your knowledge!" |
| Button text | `<button id="btn-start">` | "Begin" |
| Theme colors | `tailwind.config` colors object | Change indigo hex values |
| Font | Google Fonts `<link>` in `<head>` | Swap "Inter" for "Poppins" |

### Change Theme Colors
In the `<script>` block with `tailwind.config`, modify the hex values:

```js
colors: {
  surface: { 800: '#1e293b', 900: '#0f172a', 950: '#020617' },
  accent:  { 400: '#818cf8', 500: '#6366f1', 600: '#4f46e5', 700: '#4338ca' }
}
```

Use [Tailwind Color Picker](https://tailwindcss.com/docs/customizing-colors) to find new values.

---

## Step 5: Push to GitHub

### Option A: GitHub CLI (Terminal)

```bash
# Navigate to the project folder
cd path/to/KuisPameran

# Initialize git
git init
git branch -M main

# Set your identity
git config user.name "Bagahia"
git config user.email "fuad.muhammad.f@gmail.com"

# Stage all files
git add .

# Commit
git commit -m "Initial commit: quiz app with Netlify Functions proxy"

# Create the GitHub repo and push
gh repo create PameranArsip --public --source=. --remote=origin --push
```

> If `gh` is not installed, download it from [cli.github.com](https://cli.github.com) or create the repo manually at [github.com/new](https://github.com/new) with name `PameranArsip`, then:
> ```bash
> git remote add origin https://github.com/Bagahia/PameranArsip.git
> git push -u origin main
> ```

### Option B: GitHub Desktop (GUI)

1. Download and install [GitHub Desktop](https://desktop.github.com) if you haven't.
2. Open GitHub Desktop → **File → Add local repository** → select the `KuisPameran` folder.
3. If prompted to initialize git, click **Yes**.
4. In the left panel:
   - **Summary:** `Initial commit: quiz app with Netlify Functions proxy`
   - Click **Commit to main**
5. Click **Publish repository** → uncheck "Keep this code private" → name it `PameranArsip` → click **Publish repository**.
6. Verify at: [github.com/Bagahia/PameranArsip](https://github.com/Bagahia/PameranArsip)

---

## Step 6: Connect to Netlify

1. Go to [app.netlify.com](https://app.netlify.com) → **Add new site → Import an existing project**.
2. Select **GitHub** → authorize if prompted.
3. Find and select **Bagahia/PameranArsip**.
4. Configure deploy settings:
   - **Branch:** `main`
   - **Build command:** *(leave empty)*
   - **Publish directory:** `.`
5. Click **Deploy site**.
6. Go to **Site settings → Environment variables** and add:

   | Key | Value |
   |-----|-------|
   | `GOOGLE_SHEET_API_URL` | Your Google Apps Script Web app URL |
   | `GOOGLE_SHEET_API_KEY` | Your secret API key |

7. Wait for the deploy to finish, then click the generated URL to test.

---

## Step 7: Local Testing (Optional)

Test the full app locally before deploying.

1. Install Netlify CLI:
   ```bash
   npm install -g netlify-cli
   ```

2. Log in:
   ```bash
   netlify login
   ```

3. In the project folder, link to your Netlify site:
   ```bash
   netlify link
   ```

4. Set environment variables locally:
   ```bash
   netlify env:set GOOGLE_SHEET_API_URL "your_script_url"
   netlify env:set GOOGLE_SHEET_API_KEY "your_secret_key"
   ```

5. Start the dev server:
   ```bash
   netlify dev
   ```

6. Open the URL shown (usually `http://localhost:8888`) and test the quiz.

---

## Managing Questions

After setup, you can add, edit, or remove questions anytime:

1. Open your Google Sheet.
2. Go to the **Questions** sheet.
3. Edit rows directly — no code changes needed.
4. Changes take effect on the next quiz request (no redeploy needed).

To change the number of questions per quiz:
1. Go to the **Settings** sheet.
2. Change the value in cell **B1** (e.g., `10` for 10 questions).

---

## Troubleshooting

### "Failed to load questions" on the landing page
- **Check env vars:** Go to Netlify → Site settings → Environment variables. Both `GOOGLE_SHEET_API_URL` and `GOOGLE_SHEET_API_KEY` must be set.
- **Check the URL:** The Apps Script URL must end with `/exec` (not `/dev`).
- **Redeploy:** After setting env vars, trigger a new deploy (Deploys → Trigger deploy → Deploy site).

### 403 / Unauthorized error
- The `GOOGLE_SHEET_API_KEY` in Netlify doesn't match the `API_SECRET_KEY` in `Code.gs`. They must be identical.

### Netlify Function returns 500
- Go to Netlify → Functions → `quiz` → check the function logs for the specific error.

### CORS error in browser console
- This shouldn't happen with the proxy setup. If you see it, you're calling the Google Apps Script URL directly instead of `/.netlify/functions/quiz`. Check `API_URL` in `index.html`.

### Blank page after deploy
- Open browser DevTools (F12) → Console tab. Check for JavaScript errors.
- Ensure `index.html` is in the root of the repo (not in a subfolder).

### Questions not updating after editing the sheet
- The Apps Script may be caching. Try redeploying the Web App (Deploy → Manage deployments → Edit → New version).

---

## Project Structure

```
PameranArsip/
├── index.html                  ← Frontend SPA (no secrets)
├── Code.gs                     ← Google Apps Script backend
├── netlify.toml                ← Netlify config
├── netlify/
│   └── functions/
│       └── quiz.js             ← Server-side proxy (reads env vars)
├── assets/
│   ├── logo1.png               ← Sponsor logo 1 (optional)
│   ├── logo2.png               ← Sponsor logo 2 (optional)
│   └── ...                     ← Up to logo10 in any format
└── SETUP.md                    ← This file
```

## Security Checklist

- [ ] Google Sheet sharing is **Restricted** (only you).
- [ ] `API_SECRET_KEY` in `Code.gs` is a strong random string (Step 0).
- [ ] `GOOGLE_SHEET_API_KEY` env var in Netlify matches the key in `Code.gs`.
- [ ] `GOOGLE_SHEET_API_URL` env var holds your Web app URL.
- [ ] **No secrets** in `index.html`, `netlify.toml`, or any committed file.
- [ ] Apps Script Web App deployed as **Execute as: Me** + **Anyone** access.
