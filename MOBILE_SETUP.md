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

Pending work (pick up where we left off):
1. "E" animation trigger — Make the letter E in the HIRECAR logo trigger the sidebar menu toggle animation
2. Document section redesign — Add HC naming (HC-2025-CAT-NNN) and source logos to document cards
3. React FileUpload component — Adapt to vanilla HTML/CSS/JS for the upload zone

Start by reading dist/index.html to get oriented.
```

---

## Notes
- The GitHub button at the bottom of Claude Code mobile lets you connect directly to your repo
- Claude Code will be able to read and edit files, make commits, and push
- All recent changes are already pushed to main (commit 5e15ce1)
