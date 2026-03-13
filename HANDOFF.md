# HIRECAR Member Services Portal — Full Handoff Document

**Date:** March 12, 2026
**Author:** Claude (AI) + Ken (CreditWithKen)
**Repo:** `kenetbc-afk/hirecar-portal` on GitHub

---

## 1. Project Overview

The HIRECAR Member Services Portal is a single-page HTML application serving as a secure client dashboard for CreditWithKen's credit repair and auto loan preparation services. It provides clients with real-time case visibility, document management, evidence tracking, communication logs, and strategic planning — all behind a cinematic login experience.

### Business Context
- **Company:** HIRECAR, LLC dba HIRECREDIT / CreditWithKen
- **Service:** Credit repair, auto loan readiness (ASAP Auto Loan Approval Program)
- **Target:** Individual clients needing credit restoration before financing
- **Delivery:** Static HTML portal deployed via GitHub Pages

---

## 2. Architecture

### Single-File SPA
The entire portal is a self-contained `index.html` file (~2900+ lines, ~750KB) with:
- **Inline CSS** — all styles embedded in `<style>` tags
- **Inline JS** — all logic embedded in `<script>` tags
- **Base64 assets** — logos encoded directly in HTML (no external image deps)
- **Zero build step** — served as a static file via any HTTP server
- **No backend required** — all data stored in `localStorage`

### Tech Stack
| Component | Technology |
|-----------|-----------|
| Fonts | Playfair Display, DM Sans, Share Tech Mono (Google Fonts CDN) |
| Storage | `localStorage` (PIN, nickname, email, preferences) |
| Hosting | GitHub Pages (`gh-pages` branch or `dist/` folder on `main`) |
| Server (dev) | Python `http.server` on port 3456 |

### Design System
| Token | Value |
|-------|-------|
| `--ink` | `#0d0d0d` (near-black text) |
| `--paper` | `#f5f2ee` (warm paper background) |
| `--gold` | `#b8922a` (accent, badges) |
| `--error` | `#e31e2d` (red alerts) |
| `--success` | `#1a6b3c` (green confirmations) |
| Login BG | Red/black with matrix rain animation |

---

## 3. File Structure

```
PassKit/hirecar-portal/
├── dist/
│   ├── index.html          # BLANK TEMPLATE (no client data)
│   ├── santiago-urias.html  # Santiago Urias client-specific version
│   └── og-image.png         # Open Graph preview image
├── vite.config.js            # Vite config (legacy, not used for dist serving)
├── package.json              # Node deps (legacy)
├── .gitignore                # dist/ is gitignored but force-added
└── HANDOFF.md                # This document
```

---

## 4. Login & Intake Flow

### Phase 1: Cinematic Intro (0–8s)
1. **HIRECAR logo** fades in on black background (~3s)
2. **CreditWithKen logo** appears with red matrix rain effect (~5s)
3. Transitions to PIN entry screen

### Phase 2: PIN Entry
- **First-time users** (no `hirecar_pin` in localStorage):
  - Label: "CREATE YOUR ACCESS CODE"
  - Sublabel: "CHOOSE A 5-DIGIT PIN"
  - Enter PIN → label changes to "CONFIRM YOUR CODE" / "RE-ENTER YOUR 5-DIGIT PIN"
  - Mismatch → "PINS DID NOT MATCH — TRY AGAIN" → resets
  - Match → PIN saved to `localStorage.hirecar_pin`
- **Returning users**:
  - Label: "ENTER ACCESS CODE"
  - Verify against stored PIN using timing-safe comparison
  - 3 wrong attempts → 30s lockout

### Phase 3: Intake (first-time only)
1. **Nickname prompt**: "WHAT SHOULD I CALL YOU?" — saved to `hirecar_nickname`
2. **Email prompt**: "CONFIRM YOUR EMAIL" — saved to `hirecar_email`

### Phase 4: Unlock Transition
- Full-screen black overlay with typed terminal lines:
  - `> ESTABLISHING SECURE CHANNEL...`
  - `> ENCRYPTION: AES-256 // VERIFIED`
  - `> RECIPIENT: [CLIENT NAME]`
  - `> CLEARANCE: MEMBER SERVICES — LEVEL 2`
  - `> STATUS: CREDIT REPAIR PORTAL READY`
  - `Welcome, [Name].`
  - `Your credit file is ready.`
- Matrix rain overlay dissolves into dashboard

---

## 5. Dashboard Tabs (8 Sections)

| Tab | Section ID | Description |
|-----|-----------|-------------|
| Dashboard | `sec-dashboard` | Case overview, timeline, stats, goals |
| Statistics | `sec-statistics` | Key figures, client info, defendants, causes of action |
| Documents | `sec-documents` | Document filing system with tabs (All/On File/Pending/Counsel) |
| Evidence | `sec-evidence` | 18-question evidence checklist with upload zones |
| Communications | `sec-communications` | Communication log with file attachments |
| Messages | `sec-messages` | Direct message interface (Twilio-powered) |
| Action Plan | `sec-strategy` | Legal analysis, strategy checklist, contingency plans |
| Billing | `sec-billing` | Payment tracking |

### Tab Navigation
- Desktop: horizontal tab bar in nav
- Mobile: hamburger menu toggles vertical dropdown
- JS handles show/hide via `.section.visible` class
- Active tab highlighted with gold underline

---

## 6. JavaScript Architecture

### Two Script Contexts (Critical!)
The portal has **two separate script scopes** — this is the most important architectural detail:

1. **Outer `<script>` block** (~lines 1604–1683):
   - `showNicknamePrompt()`, `submitNickname()`
   - `showEmailPrompt()`, `submitEmail()`
   - `escHtml()` (duplicated here for cross-scope access)

2. **IIFE `(function(){...})()`** (~lines 1685+):
   - Core portal logic: `verify()`, `unlock()`, `proceedAfterPin()`
   - PIN handling, localStorage management
   - `escHtml()` (original definition)
   - Tab navigation, chatbot, evidence tracking
   - `unlock` exposed globally via `window.unlock = function unlock(){...}`

**Why this matters:** Functions in the outer scope calling IIFE functions will get `ReferenceError` unless the IIFE function is exposed on `window`. This was the root cause of multiple bugs fixed in this session.

### Key Variables
```javascript
var _storedPin = localStorage.getItem('hirecar_pin') || '';
var _isFirstTime = !_storedPin;
var _setupStep = 0;    // 0 = first entry, 1 = confirmation
var _firstEntry = '';   // first PIN attempt during setup
var CLIENT = preferredName || 'Client';
```

### localStorage Keys
| Key | Purpose |
|-----|---------|
| `hirecar_pin` | 5-digit access code |
| `hirecar_nickname` | Display name |
| `hirecar_email` | Client email |

---

## 7. Blank Template vs Client Versions

### Blank Template (`index.html`)
- All case fields show `--` placeholders
- Case number: `CR-0000-0000`
- No names, addresses, or case-specific data
- Unlock transition: `RECIPIENT: [CLIENT NAME]` (dynamic from nickname)
- Generic chatbot responses
- Generic timeline (all pending)
- Single placeholder defendant card

### Santiago Urias Version (`santiago-urias.html`)
- Full case data: court, defendants (Chong Oh, Youngse Kwon, etc.)
- Specific timeline with dates
- Populated causes of action table
- Real chatbot responses with case details
- Unlock: `RECIPIENT: [NAME] URIAS`

### Creating New Client Versions
1. Copy `santiago-urias.html` (or `index.html`) as `[client-name].html`
2. Search-replace client-specific fields:
   - Name, case number, court info
   - Defendant names and details
   - Timeline dates and events
   - Financial figures
   - Chatbot responses (deposit/deadline/document answers)
   - Unlock transition text (line ~2198)
   - Watermark text (line ~2803)
3. Update `.client-name-dynamic` spans (auto-populated from nickname)
4. Force-add to git: `git add -f dist/[client-name].html`

---

## 8. Deployment

### GitHub Pages
```bash
cd /Users/hirecarken/Desktop/CREDITWITHKEN/PassKit/hirecar-portal
git add -f dist/index.html dist/santiago-urias.html
git commit -m "Update portal"
git push origin main
```

### Local Dev
```bash
python3 -m http.server 3456 --directory dist/
# Open http://localhost:3456/index.html
```

### Launch Config (`.claude/launch.json`)
```json
{
  "name": "hirecar-portal",
  "runtimeExecutable": "python3",
  "runtimeArgs": ["-m", "http.server", "3456", "--directory", "/Users/hirecarken/Desktop/CREDITWITHKEN/PassKit/hirecar-portal/dist"],
  "port": 3456
}
```

---

## 9. Backend Integration (Future / In Progress)

### Cloudflare Worker (`hirecar-onboarding`)
- 19 API routes, 13 source files
- KV Namespaces: CLIENTS + DASHBOARDS
- R2 Bucket: `hirecar-documents`
- Worker code: `/PassKit/hirecar-worker/src/`

### PassKit Integration
- Wallet pass scan → webhook → auto-account creation
- Links to portal login

### Slack Integration
- Webhooks + bot token
- 8 slash commands for admin management

---

## 10. Known Issues & Tech Debt

1. **Scoping architecture** — outer script vs IIFE creates fragile cross-scope dependencies. Future refactor should consolidate into a single module or use ES modules.
2. **No backend auth** — PIN stored in localStorage is client-side only. Cloudflare Worker integration will add server-side auth.
3. **Static client data** — each client version is a separate HTML file. Future: dynamic data loading from KV/API.
4. **Large file size** — ~750KB per HTML file due to base64 images. Could extract to CDN.
5. **dist/ in .gitignore** — files are force-added. Consider removing dist/ from gitignore or using a proper build pipeline.

---

## 11. Playbook System (New — In Development)

### Source
The HIRECAR Playbook content originates from bit.ai (`hirecar.bitdocs.ai`). The playbook is a 15-section client guide for the ASAP Auto Loan Approval Program.

### Playbook Sections
1. Welcome + How to Use This Playbook
2. Client Profile / CreditWithKen Score
3. Program Overview (SKU, deliverables, support, expectations)
4. Payment + Enrollment
5. Start Here — Onboarding Gate ("Clock Start")
6. Secure Upload Vault
7. Program Dashboard (Progress + Status)
8. Score & Credit File Tracking
9. Credit Sweep + Cleanup Plan
10. Tradelines & Authorized User (AU) Coordination
11. Counseling Sessions Hub (3 × 30 Minutes)
12. Lender Readiness Toolkit
13. Dealer & Deal Support
14. Messages, Q&A, and Decisions Log
15. Completion Packet

### Implementation Plan
- New "Playbooks" tab in portal navigation
- bit.ai-style document viewer with sidebar TOC + rich content area
- Collapsible sections, tables, status badges
- Embedded in the same single-file SPA architecture
