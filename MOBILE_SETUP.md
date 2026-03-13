# Claude Code Mobile — Quick Start Prompt

Copy and paste this into the Claude Code mobile app input box:

---

## Step 1: Tap the GitHub "Choos..." button at the bottom

Select the repo: **kenetbc-afk/hirecar-portal** (main branch)

## Step 2: Paste this prompt

```
Connect to my GitHub repo kenetbc-afk/hirecar-portal on the main branch.

The project is a single-file HTML portal at dist/index.html — all HTML, CSS, and JS live in that one file (~5000+ lines).

Key context:
- This is the HIRECAR Member Services portal for CreditWithKen
- Preview: the file is a self-contained SPA, no build step needed
- The CWK logo is a base64 PNG embedded in the file (class: .cwk-logo-img)
- The bot avatar in the Evidence section reuses that logo via JS (copies src at runtime)
- Login can be skipped in dev with the SKIP button on the splash screen
- The "E" in HIRECAR (topbar) is an easter-egg sidebar toggle (id: hirecar-e-trigger)
- Documents use HC-YYYY-CAT-NNN naming with source badges (HIRECAR/CWK/CLIENT)
- See HANDOFF.md for full architecture, API routes, PassKit field mapping, and deploy steps

Pending work (pick up where we left off):
1. R2 bucket activation — Uncomment [[r2_buckets]] in wrangler.toml for document storage
2. Production domain — Set up DNS for portal.hirecar.app, update CORS origins
3. Server-side auth — Wire portal intro PIN to the worker /auth/verify endpoint
4. Dynamic client data — Replace static per-client HTML files with KV-backed API calls
5. Service worker — Add for offline support and cache management
6. Extract base64 images — Move embedded logos to CDN to reduce file size (~810KB)

Start by reading dist/index.html to get oriented.
```

---

## Notes
- The GitHub button at the bottom of Claude Code mobile lets you connect directly to your repo
- Claude Code will be able to read and edit files, make commits, and push
- All recent changes are pushed to main

## Recently Completed
- "E" animation trigger — letter E in topbar HIRECAR text toggles sidebar (gold flash effect)
- Document HC naming (HC-2025-CAT-NNN) with source badges and combined filtering
- Hash-based deep linking for PassKit back-of-pass navigation
- Credit Score Diagnostics card (Equifax/Experian/TransUnion)
- PassKit full field mapping + auto-sync on dashboard updates
- Coming Soon page for Reservations/Funding features
- Email updated to member@hirecar.la across portal
