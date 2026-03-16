# HIRECAR Member Services Portal — Developer Handoff

**Date:** March 15, 2026
**Author:** Claude (AI assistant) + Ken Eckman (CreditWithKen)
**Repo:** https://github.com/kenetbc-afk/hirecar-portal.git
**Live:** https://hirecar-portal.pages.dev
**Legacy:** https://hirecarken.github.io/hirecar-portal/

---

## 1. Project Overview

HIRECAR is an automated credit repair client onboarding pipeline. The portal is a **single-file HTML SPA** (no build step) serving as the client dashboard where members track credit repair progress, exchange documents, manage tradelines, and communicate with the admin team via Slack-backed messaging.

**Business entities:** CreditWithKen, LLC / ASAP Auto Loan / HIRECAR Member Services / SeedXchange

---

## 2. Architecture

```
Client Browser
    |
    v
Cloudflare Pages (static hosting)
  /dist/index.html  <-- single-file SPA (~5475 lines)
    |
    v  (fetch API calls)
Cloudflare Worker ("hirecar-onboarding")
    |
    +---> KV: CLIENTS   (auth, tokens, client index)
    +---> KV: DASHBOARDS (portal display data per client)
    +---> R2: hirecar-documents (pending activation)
    +---> Slack Bot API (messages, modals, slash commands)
    +---> PassKit (wallet pass webhooks -> auto-account creation)
```

### Single-File SPA
- All CSS in one `<style>` block
- All HTML inline
- All JS in `<script>` blocks at the bottom
- Base64-encoded logos (no external image deps)
- Zero build step: edit the file and deploy
- `localStorage` for client-side PIN/nickname/email, comm files, and tradelines

---

## 3. Key File Paths

| Component | Path |
|-----------|------|
| **Portal HTML** | `/Users/hirecarken/Desktop/CREDITWITHKEN/PassKit/hirecar-portal/dist/index.html` |
| **OG image** | `/Users/hirecarken/Desktop/CREDITWITHKEN/PassKit/hirecar-portal/dist/og-image.png` |
| **Santiago client copy** | `/Users/hirecarken/Desktop/CREDITWITHKEN/PassKit/hirecar-portal/dist/santiago-urias.html` |
| **Worker entry** | `/Users/hirecarken/Desktop/CREDITWITHKEN/PassKit/hirecar-worker/src/index.js` |
| **Worker handlers** | `/Users/hirecarken/Desktop/CREDITWITHKEN/PassKit/hirecar-worker/src/handlers/` |
| **Wrangler config** | `/Users/hirecarken/Desktop/CREDITWITHKEN/PassKit/hirecar-worker/wrangler.toml` |
| **This handoff** | `/Users/hirecarken/Desktop/CREDITWITHKEN/PassKit/hirecar-portal/HANDOFF.md` |

### Worker Handler Files
| File | Responsibility |
|------|---------------|
| `index.js` | Router, CORS, admin auth middleware |
| `handlers/webhook.js` | PassKit webhook receiver |
| `handlers/auth.js` | Email + PIN client auth |
| `handlers/dashboard.js` | Get/update client dashboard data |
| `handlers/documents.js` | Upload, list, download documents |
| `handlers/messages.js` | Client and admin message handlers |
| `handlers/modules.js` | Module access management |
| `handlers/admin.js` | List all clients |
| `handlers/slack.js` | Slash commands + interactivity (modals, block_actions, view_submission) |
| `handlers/token.js` | Personalized link token validation + revocation |

---

## 4. Cloudflare Infrastructure

| Resource | Value |
|----------|-------|
| Account email | kene.tbc@gmail.com |
| Account ID | `ea237ab47beb2ea9a722083a01cc7590` |
| Worker name | `hirecar-onboarding` |
| KV CLIENTS ID | `d26715fa0d904470aecc278a56feeb44` |
| KV DASHBOARDS ID | `81c38c67872b470f80ae4a5f51bd2001` |
| R2 bucket | `hirecar-documents` (commented out in wrangler.toml, not yet activated) |
| Pages project | `hirecar-portal` (Cloudflare Pages) |
| CORS origins | `https://portal.hirecar.app`, `https://hirecar-portal.pages.dev`, `http://localhost:3456`, `https://kenetbc-afk.github.io` |

### Secrets (set via `wrangler secret put`)
- `PASSKIT_WEBHOOK_SECRET` — HMAC key from PassKit
- `PASSKIT_API_KEY` — PassKit long-lived API token
- `PASSKIT_PROGRAM_ID` — PassKit program ID
- `SLACK_WEBHOOK_URL` — Slack incoming webhook
- `SLACK_BOT_TOKEN` — Slack bot token (xoxb-...)
- `SLACK_DOCS_CHANNEL` — Slack channel ID for document notifications
- `ADMIN_API_KEY` — Bearer key for admin endpoints

---

## 5. Worker API Routes (19 endpoints)

### Public
| Method | Path | Handler |
|--------|------|---------|
| POST | `/webhook/passkit` | PassKit wallet pass webhook |
| POST | `/auth/verify` | Email + PIN login |
| GET | `/auth/token/:token` | Validate personalized link token |
| GET | `/client/:id/dashboard` | Fetch dashboard data |
| POST | `/client/:id/documents` | Client uploads document |
| GET | `/client/:id/documents` | List client documents |
| GET | `/client/:id/documents/:docId` | Download document |
| POST | `/client/:id/messages` | Client sends message |
| GET | `/client/:id/messages` | Get message history |

### Admin (require `Authorization: Bearer <ADMIN_API_KEY>`)
| Method | Path | Handler |
|--------|------|---------|
| POST | `/admin/client/:id/dashboard` | Update dashboard data |
| POST | `/admin/client/:id/documents` | Admin uploads doc to client |
| POST | `/admin/client/:id/messages` | Admin sends message to client |
| POST | `/admin/client/:id/modules` | Add/remove module access |
| GET | `/admin/clients` | List all clients |
| DELETE | `/admin/token/:token` | Revoke access token |

### Slack
| Method | Path | Handler |
|--------|------|---------|
| POST | `/slack/commands` | 8 slash commands |
| POST | `/slack/interactivity` | Modals, block_actions, view_submission |

---

## 6. Slack Integration

### Message Flow
```
Client types in portal  -->  POST /client/:id/messages
                                |
                                v
                        Worker stores in KV + posts to Slack channel
                                |
                                v
                        Admin replies via Slack modal/thread
                                |
                                v
                        handleSlackInteractivity() stores reply in KV
                                |
                                v
                        Portal polls GET /client/:id/messages every 5s
                                |
                                v
                        New messages appear in portal chat
```

### Slack App Config Required
- **Slash Commands URL:** `https://hirecar-onboarding.<subdomain>.workers.dev/slack/commands`
- **Interactivity URL:** `https://hirecar-onboarding.<subdomain>.workers.dev/slack/interactivity`
- **Bot Token Scopes:** `chat:write`, `files:write`, `commands`, `users:read`

---

## 7. Portal HTML Structure (index.html)

### Line Map (approximate, as of 2026-03-15)
| Lines | Content |
|-------|---------|
| 1-25 | Head, meta tags, OG image, Google Fonts |
| 26-35 | CSS variables (`:root`) |
| 36-430 | All CSS: sidebar, topbar, cards, tables, badges, animations, responsive |
| ~117-130 | Topbar CSS: hamburger, brands, smart carousel |
| ~325-345 | Mobile responsive CSS (768px breakpoint) |
| 431-930 | Intro screen HTML (matrix rain, PIN entry, logo sequence) |
| ~935-950 | Topbar HTML (hamburger with HIRECAR logo, animated SVG menu toggle, "POWERED BY", 3 logo slides) |
| ~950-940 | Sidebar HTML (10 nav items, user avatar, collapse toggle) |
| ~980-1000 | Dashboard header: service provider info + last login/update bar |
| ~2130-2260 | Credit & Funding Communications section (7 channels with file upload) |
| ~2263-2400 | Tradelines section (stat cards + editable table) |
| ~3110-3120 | CLIENT_PROFILE object (single source of truth for client data) |
| ~3120-3150 | `updateAllClientElements()` function |
| ~3900-3940 | Sidebar toggle + hamburger sync JS |
| ~3955-3970 | Hash-based deep link routing |
| ~4045-4054 | `toggleMenuIcon()` — syncs SVG animation with sidebar state |
| ~4056-4095 | Smart carousel IIFE — inline vs cycling mode based on available width |
| 4100+ | Message polling, document handlers, comms files, tradelines JS |

### CSS Variables
```css
:root {
  --ink:#f0f2f7; --paper:#111827; --cream:#1a2236;
  --gold:#b8922a; --gold-light:#d4aa4a;
  --sidebar-width:260px; --sidebar-collapsed:64px; --topbar-height:56px;
  --sidebar-bg: linear-gradient(180deg, #000 0%, #020408 20%, #060a14 45%, #0a0e1a 70%, #0d1525 100%);
  --sidebar-active-border:#2a6bb8;
}
```

### 10 Navigation Sections
| # | data-sec | Label | Icon |
|---|----------|-------|------|
| 1 | `sec-dashboard` | Dashboard | grid |
| 2 | `sec-statistics` | Statistics | chart |
| 3 | `sec-documents` | Documents | folder |
| 4 | `sec-evidence` | Evidence Vault | shield |
| 5 | `sec-communications` | Communications | phone |
| 6 | `sec-messages` | Message Center | chat |
| 7 | `sec-tradelines` | Tradelines | chart-bar |
| 8 | `sec-strategy` | Strategy | target |
| 9 | `sec-billing` | Calendar & Billing | credit card |
| 10 | `sec-playbooks` | Playbooks | book |

### Tab Switching
Sidebar buttons have class `menu-tab` + `data-sec` attribute. JS IIFE adds click listeners:
1. Remove `.active` from all sidebar items
2. Add `.active` to clicked item
3. Hide all `.section` divs
4. Show matching `#sec-*` div
5. Close mobile sidebar if open

### Sidebar Behavior
- **Desktop:** `.sidebar-toggle` toggles `.collapsed` class. 260px -> 64px, text labels hidden (opacity:0, width:0), icons only.
- **Mobile (<=768px):** Sidebar off-screen via `transform:translateX(-100%)`. Hamburger (`#topbar-hamburger`) toggles `.mobile-open`. Backdrop `#sidebar-backdrop` overlays content.

---

## 8. Credit & Funding Communications (Comms Section)

Redesigned from generic messaging to credit-specific communication channels with persistent file upload/retrieval.

### 7 Communication Channels
| Code | Channel Name | Purpose |
|------|-------------|---------|
| HC | HIRECAR Member Services / Credit Advisor | Primary credit advisor communication |
| EQ | Equifax | Bureau-specific disputes & correspondence |
| EX | Experian | Bureau-specific disputes & correspondence |
| TU | TransUnion | Bureau-specific disputes & correspondence |
| CK | CreditWithKen / Dispute Strategy | Dispute strategy & analysis |
| FN | Funding & Lending | Funding applications & approvals |
| AM | Account Manager | Account management & billing |

### File Persistence
- Files attached via `attachCommFile()` are stored in `localStorage` key `hc_comm_files`
- `_commFiles` object maps channel IDs to arrays of file objects
- Files persist across browser sessions
- Each file has download and remove capabilities
- `loadCommFiles()` runs on page init to restore files
- `saveCommFiles()` called after every attach/remove operation

---

## 9. Tradelines Section

Full CRUD tradeline management with localStorage persistence.

### Summary Stat Cards
- Open Accounts
- Total Credit Limit
- Utilization Rate
- Negative Items

### Editable Table Columns
| Column | Type |
|--------|------|
| Creditor | Text input |
| Account Type | Select (Credit Card, Auto Loan, Mortgage, Personal Loan, Student Loan, Other) |
| Status | Select (Open, Closed, Collection, Charge-Off) |
| Balance | Text input |
| Limit | Text input |
| Reported | Text input (date) |
| Action | Remove button |

### Tradeline JS Functions
- `_tradelines` array stored in localStorage key `hc_tradelines`
- `addTradeline()` — creates new row with default values
- `removeTradeline(id)` — removes by ID
- `updateTradeline(id, field, value)` — inline editing
- `updateTradelineStats()` — recalculates summary cards
- `renderTradelines()` — renders editable table rows
- `saveTradelines()` / `loadTradelines()` — localStorage persistence

---

## 10. Topbar Layout

### Desktop
- **Left:** Animated SVG hamburger menu icon (syncs with sidebar collapse)
- **Center-left:** "POWERED BY" text + smart logo carousel (SeedXchange, CreditWithKen, HIRECAR)
- Carousel: 4s interval, 1s smooth transition, pause-on-hover
- CreditWithKen logo: 22px height
- HIRECAR logo: 17px height (white, brightness/invert filtered)

### Mobile (≤768px)
- **Far left:** Menu toggle icon (26x26px, absolutely positioned at left:12px)
- **Left of brands:** HIRECAR hamburger logo (11px height) + "MEMBER SERVICES" label (static, one line)
- **"POWERED BY"** text: visible, bold (font-weight:700)
- Only CreditWithKen logo slide shown (carousel disabled)
- Topbar has 46px left padding to make room for menu icon

### Key CSS Classes
- `.topbar-cycle-wrap` — flex container for carousel
- `.topbar-cycle-track` — flex row of slides
- `.topbar-cycle-slide` — individual logo container
- `.topbar-brands` — "POWERED BY" text container
- `.topbar-hamburger` — HIRECAR logo + Member Services label
- `.topbar-member-label` — "MEMBER SERVICES" text (white-space:nowrap)
- `#menu-toggle-icon` — animated SVG hamburger/X icon

---

## 11. Dashboard Info Bar

Located below the service provider header (~line 988-991):

```html
<div style="...background:rgba(184,146,42,.06);border-left:3px solid var(--gold);">
  <span>Last login: <strong id="last-login">Loading...</strong></span>
  <span>Last update from HIRECAR Member Services: <strong id="last-hirecar-update">--</strong></span>
  <span>Active Session</span>
</div>
```

Service provider displays as: **HIRECAR: Member Services / CREDITWITHKEN, LLC**

---

## 12. Intro Animation Flow

1. Matrix rain canvas fills screen (green characters)
2. HIRECAR logo fades in, red glow intensifies (~3s)
3. CreditWithKen logo fades in with ambient glow (~5s)
4. PIN entry appears (5-digit code)
5. Correct PIN -> intro fades out, main portal fades in
6. "SKIP ▸" button (fixed bottom-right, z-index:10001) bypasses at any stage

### PIN Logic
- First-time: Create 5-digit PIN -> confirm -> saved to `localStorage.hirecar_pin`
- Returning: Verify against stored PIN, 3 wrong attempts -> 30s lockout

### localStorage Keys
| Key | Purpose |
|-----|---------|
| `hirecar_pin` | 5-digit access code |
| `hirecar_nickname` | Display name |
| `hirecar_email` | Client email |
| `hc_comm_files` | Communication channel file attachments (JSON) |
| `hc_tradelines` | Tradeline data (JSON array) |

---

## 13. Hash-Based Deep Linking

Portal supports `#section` URL fragments for PassKit back-of-pass navigation:

| Fragment | Target Section |
|----------|---------------|
| `#dashboard` | sec-dashboard |
| `#scores` | sec-dashboard (credit diagnostics card) |
| `#evidence`, `#claims` | sec-evidence |
| `#communications` | sec-communications |
| `#messages`, `#qa` | sec-messages |
| `#tradelines` | sec-tradelines |
| `#strategy` | sec-strategy |
| `#billing` | sec-billing |
| `#playbook` | sec-playbooks |
| `#upload` | sec-documents (opens upload modal) |

Routing map at ~line 3959-3960.

---

## 14. Color System & Design

| Role | Color | Notes |
|------|-------|-------|
| Brand gold | `#b8922a` | Logo text, some badges — being phased toward blue for UI elements |
| Blue accent | `#2a6bb8` / `#3b82d6` / `#60a5fa` | Sidebar active, buttons, message bubbles, tab badges |
| Background | `#000 -> #0d1525 -> #152545` | Black-heavy gradient, fixed |
| Success green | `#34d399` | Active Dispute badge, pulse dot |
| Error red | `#f87171` | Alerts, errors |
| Muted text | `#a0aec0` | Secondary labels |

### Fonts
- **Playfair Display** (serif) — headings, sidebar brand text
- **DM Sans** (sans-serif) — body, UI, tables
- **Share Tech Mono** (monospace) — intro screen, PIN entry

---

## 15. PassKit Access Pass — Field Mapping

### Pass Template ID
`7t4cG3EhKw6EF0GLCxUCBi` (Draft — promote to Live for production)

### Field Mapping (Worker → PassKit)

#### Front Face Fields
| PassKit Template Variable | metaData Key | Source | Example Value |
|--------------------------|-------------|--------|---------------|
| `[displayName]` | `displayName` | `authRecord.fullName` | "Santiago Urias" |
| `[activePlans]` | `activePlans` | Derived from `program` | "A$AP Auto Loan Approval" |
| `CRDTSNP SCORE ----` | `crdtsnpScore` | `dashboard.stats.scoreCurrent` | "682" or "Pending" |
| `CO-INSURANCE N/A` | `coInsurance` | `clientData.coInsurance` | "N/A" |
| `PLAYBOOK TYPE` | `playbookType` | Derived from `program` | "A$AP AUTO LOAN APPROVAL" |
| `CAR RENTAL BILLING $$$` | `carRentalBilling` | `dashboard.billing.amount` | "$149/monthly" or "See Portal" |
| `NEXT BILLING DUE MM/DD/YY` | `nextBillingDue` | Calculated from billing history | "04/13/26" |

#### Back Fields
| PassKit Template Variable | metaData Key | Source | Example Value |
|--------------------------|-------------|--------|---------------|
| `[status]` | `status` | `authRecord.status` | "Active" |
| `[funding]` | `funding` | `clientData.funding` | "None Pending" |
| `[refer]` | `refer` | `clientData.referralCode` | "Contact Member Services" |
| Portal link | `portalLink` | Generated URL with token | `https://portal.hirecar.app?t=abc123...` |

#### Built-in Person Fields
| PassKit Field | Source |
|--------------|--------|
| `person.displayName` | `authRecord.fullName` |
| `person.emailAddress` | `authRecord.email` |
| `person.mobileNumber` | `authRecord.phone` |

### Auto-Sync Behavior
- **On client creation** (webhook.js): All fields populated via `updatePassKitMember()`
- **On admin dashboard update** (dashboard.js): If `stats` or `billing` change, pass auto-syncs via `syncPassFromDashboard()`

### Back-of-Pass Link Routing

| # | Pass Item | Target URL |
|---|-----------|-----------|
| 4 | Reservations | `.../coming-soon.html?feature=reservations` |
| 5 | CRDTSNP Score | `.../hirecar-portal/#scores` |
| 6 | Dispute Tracking | `.../hirecar-portal/#evidence` |
| 7 | Playbook | `.../hirecar-portal/#playbook` |
| 8 | Client Q&A | `.../hirecar-portal/#messages` |
| 9 | Phone | `tel:+16616510858` |
| 10 | Email | `mailto:member@hirecar.la` |
| 11 | Funding Request | `.../coming-soon.html?feature=funding` |
| 12 | Secure Upload Vault | `.../hirecar-portal/#upload` |
| 13 | MarketWatch | (keep current link) |
| 14 | Scanner Barcode | `https://hirecar.la` (placeholder) |

### PassKit Dashboard TODO (manual)
1. Fix typo: "lease upload" → "**Please upload**"
2. Remove "----coming soon----" from MarketWatch field
3. Fix DBA: "HIRECAR, LLC dba HIRECREDIT" → "HIRECAR, LLC dba CREDITWITHKEN"
4. Promote to Live Project (draft passes expire after 48 hours)
5. Set all back-of-pass links per routing table
6. Update contact email on pass to `member@hirecar.la`
7. Scanner barcode → `https://hirecar.la`

---

## 16. Deployment

### Portal (Cloudflare Pages — PRIMARY)
```bash
cd /Users/hirecarken/Desktop/CREDITWITHKEN/PassKit/hirecar-portal
git add -f dist/index.html && git commit -m "description"
git push origin main
npx wrangler pages deploy dist --project-name=hirecar-portal
# Live at: https://hirecar-portal.pages.dev
```

### Portal (GitHub Pages — LEGACY)
```bash
cd /Users/hirecarken/Desktop/CREDITWITHKEN/PassKit/hirecar-portal
npx gh-pages -d dist
# Deploys to: https://hirecarken.github.io/hirecar-portal/
```

### Worker (Cloudflare)
```bash
cd /Users/hirecarken/Desktop/CREDITWITHKEN/PassKit/hirecar-worker
npx wrangler deploy
```

### Local Dev
```bash
cd /Users/hirecarken/Desktop/CREDITWITHKEN/PassKit/hirecar-portal
npx vite preview --port 3456
```

### Important Notes
- `dist/` is in `.gitignore` — must use `git add -f dist/index.html` to stage
- Browsers cache aggressively — users need hard-refresh (`Cmd+Shift+R`)
- Preview server runs on port 3456

---

## 17. Git History (latest)

```
e28145e Update portal: credit & funding comms, tradelines section, UI refinements
bd393ee Hide carousel navigation dots
7a473a3 Proportion bot and news card: bot larger (3:2 ratio), no blank space
1099387 Move Market Watch news carousel next to bot container at top
ca6a48e Remove HIRECAR MARKET WATCH header from MW card
c057593 Remove top border on MW card, blend image from top and bottom
1e194a5 Expand Market Watch carousel excerpts to fill blank space
9c854dd Fix broken student loans image URL
6c2fd82 Revert "Make Market Watch card full-width with edge-bleed images"
fb8a706 Make Market Watch card full-width with edge-bleed images
89bd168 Make carousel hero images taller for portrait-style layout
95d7bb5 Replace SVG hero illustrations with Unsplash photos in Market Watch carousel
308549b Make HC Run button glow very subtle
d39e620 Change all btn-primary buttons to blue color scheme
25ddd13 Change action buttons to blue with glow on HC Run button
```

---

## 18. Uncommitted Changes (as of 2026-03-15)

- **"POWERED BY" text made bold on mobile** — added `font-weight:700` to `.topbar-brands>span` in mobile media query (line 332)
- This change is NOT deployed to Cloudflare Pages yet

---

## 19. Important Architectural Notes

### Two Script Scopes
The portal has **two separate script scopes**:
1. **Outer `<script>`** — nickname/email prompts, some utility functions
2. **IIFE `(function(){...})()`** — core portal logic: PIN handling, tab navigation, chatbot, messaging

Functions in the outer scope cannot call IIFE functions unless exposed via `window.functionName`.

### Playbooks Inner Sidebar
The Playbooks tab has its own sidebar (`.pb-sidebar`) independent of the main nav sidebar. Different CSS classes, separate JS toggle.

### Chatbot Overlay
Fixed bottom-right (`z-index:1001`), independent of the nav sidebar (`z-index:1000`).

### Message Polling
`setInterval` polls `GET /client/:id/messages` every 5000ms. Admin replies from Slack are picked up on next poll.

### localStorage Persistence Pattern
Both comms files and tradelines use the same pattern:
1. Module-level variable (`_commFiles`, `_tradelines`)
2. `save*()` writes to localStorage as JSON
3. `load*()` reads from localStorage on page init
4. All mutations call `save*()` then `render*()`

---

## 20. Pending Work

| Priority | Task | Status |
|----------|------|--------|
| **High** | Push "POWERED BY" bold change + redeploy to Cloudflare | Ready (uncommitted) |
| **High** | OG/Twitter meta tags updated to Cloudflare Pages URLs | Done (2026-03-15) |
| **High** | Browser chrome meta tags (theme-color black, Safari status bar) | Done (2026-03-15) |
| **High** | prefers-reduced-motion CSS added | Done (2026-03-15) |
| **High** | Skip-nav link + ARIA roles (sidebar, modals, toasts, chatbot) | Done (2026-03-15) |
| **High** | Global focus-visible rings for keyboard accessibility | Done (2026-03-15) |
| **High** | Duplicate escHtml consolidated to single global | Done (2026-03-15) |
| **High** | Hardcoded test-client-001 fallback removed (guards added) | Done (2026-03-15) |
| **High** | Mobile thread selector for Message Center | Done (2026-03-15) |
| **High** | Font preconnect hints added | Done (2026-03-15) |
| **High** | noscript fallback added | Done (2026-03-15) |
| **High** | dist/ removed from .gitignore | Done (2026-03-15) |
| **High** | Carousel total derived from DOM instead of hardcoded | Done (2026-03-15) |
| Medium | R2 Bucket Activation (uncomment in wrangler.toml) | Not started |
| Medium | Production Domain (portal.hirecar.app DNS) | Not started |
| Medium | Convert remaining gold badges to blue | Not started |
| Medium | Remove "Five-Layer Dispute Strategy System" section | Not started |
| Medium | Add example results to evidence matrix | Not started |
| Medium | Feature Steps animate only once (play-once on scroll) | Not started |
| Low | "E" in HIRECAR entry animation | Not started |
| Low | Document section redesign with HC naming + source logos | Plan exists |

---

## 21. Quick Reference

| Task | Command |
|------|---------|
| Edit portal | Open `dist/index.html` in any editor |
| Deploy portal (CF Pages) | `npx wrangler pages deploy dist --project-name=hirecar-portal` |
| Deploy worker | `cd hirecar-worker && npx wrangler deploy` |
| Set worker secret | `cd hirecar-worker && npx wrangler secret put SECRET_NAME` |
| Check KV data | Cloudflare Dashboard → Workers & Pages → KV |
| View live site | https://hirecar-portal.pages.dev |
| Tail worker logs | `cd hirecar-worker && npx wrangler tail` |
| Local preview | `cd hirecar-portal && npx vite preview --port 3456` |
| Git force-add dist | `git add -f dist/index.html` |

---

## 22. Known Tech Debt

1. **Dual script scopes** — outer script + IIFE creates fragile cross-scope deps
2. **Client-side PIN only** — localStorage PIN is not real auth; Worker API has server-side auth but portal doesn't use it
3. **Static client data** — each client is a separate HTML file; future: dynamic from KV
4. **Large file** — ~85k tokens (~5475 lines) due to base64 images; could extract to CDN
5. **dist/ in .gitignore** — force-added; consider removing from `.gitignore`
6. **No service worker** — could add for offline support
7. **localStorage limits** — comm files and tradelines stored as JSON strings; large file attachments could exceed ~5MB limit

---

*Contact: Ken Eckman (kene.tbc@gmail.com)*
