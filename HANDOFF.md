# HIRECAR Member Services Portal — Developer Handoff

**Date:** March 13, 2026
**Author:** Claude (AI assistant) + Ken Eckman (CreditWithKen)
**Repo:** https://github.com/kenetbc-afk/hirecar-portal.git
**Live:** https://hirecarken.github.io/hirecar-portal/

---

## 1. Project Overview

HIRECAR is an automated credit repair client onboarding pipeline. The portal is a **single-file HTML SPA** (no build step) serving as the client dashboard where members track credit repair progress, exchange documents, and communicate with the admin team via Slack-backed messaging.

**Business entities:** CreditWithKen / ASAP Auto Loan / HIRECAR Member Services / SeedXchange

---

## 2. Architecture

```
Client Browser
    |
    v
GitHub Pages (static hosting)
  /dist/index.html  <-- single-file SPA (3858 lines, ~810 KB)
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
- `localStorage` for client-side PIN/nickname/email

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
| CORS origins | `https://portal.hirecar.app`, `http://localhost:3456`, `https://kenetbc-afk.github.io` |

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

### Line Map (approximate, as of 2026-03-13)
| Lines | Content |
|-------|---------|
| 1-25 | Head, meta tags, OG image, Google Fonts |
| 26-35 | CSS variables (`:root`) |
| 36-430 | All CSS: sidebar, topbar, cards, tables, badges, animations, responsive |
| ~117-130 | Topbar CSS: hamburger, brands, smart carousel (`.topbar-cycle-wrap`, `.topbar-cycle-track`) |
| ~325-340 | Mobile responsive CSS (768px breakpoint) |
| 431-930 | Intro screen HTML (matrix rain, PIN entry, logo sequence) |
| ~935-950 | Topbar HTML (hamburger with HIRECAR logo, animated SVG menu toggle, "POWERED BY", 3 logo slides) |
| ~950-1000 | Sidebar HTML (9 nav items, user avatar, collapse toggle) |
| 1000-3100 | 9 section content blocks + chatbot overlay |
| ~3110-3120 | CLIENT_PROFILE object (single source of truth for client data) |
| ~3120-3150 | `updateAllClientElements()` function |
| ~3900-3940 | Sidebar toggle + hamburger sync JS |
| ~4045-4054 | `toggleMenuIcon()` — syncs SVG animation with sidebar state |
| ~4056-4095 | Smart carousel IIFE — inline vs cycling mode based on available width |
| 4100+ | Message polling, document handlers, playbooks JS |

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

### 9 Navigation Sections
| # | data-sec | Label | Icon |
|---|----------|-------|------|
| 1 | `sec-dashboard` | Dashboard | grid |
| 2 | `sec-statistics` | Statistics | chart |
| 3 | `sec-documents` | Documents | folder |
| 4 | `sec-evidence` | Evidence Vault | shield |
| 5 | `sec-communications` | Communications | phone |
| 6 | `sec-messages` | Message Center | chat |
| 7 | `sec-strategy` | Strategy | target |
| 8 | `sec-billing` | Billing | credit card |
| 9 | `sec-playbooks` | Playbooks | book |

### Tab Switching
Sidebar buttons have class `menu-tab` + `data-sec` attribute. JS IIFE (~line 2872) adds click listeners:
1. Remove `.active` from all sidebar items
2. Add `.active` to clicked item
3. Hide all `.section` divs
4. Show matching `#sec-*` div
5. Close mobile sidebar if open

### Sidebar Behavior
- **Desktop:** `.sidebar-toggle` toggles `.collapsed` class. 260px -> 64px, text labels hidden (opacity:0, width:0), icons only.
- **Mobile (<=768px):** Sidebar off-screen via `transform:translateX(-100%)`. Hamburger (`#topbar-hamburger`) toggles `.mobile-open`. Backdrop `#sidebar-backdrop` overlays content.

---

## 8. Intro Animation Flow

1. Matrix rain canvas fills screen (green characters)
2. HIRECAR logo fades in, red glow intensifies (~3s)
3. CreditWithKen logo fades in with ambient glow (~5s)
4. PIN entry appears (4-digit code)
5. Correct PIN -> intro fades out, main portal fades in
6. "SKIP" button (fixed bottom-right, z-index:10001) bypasses at any stage

### PIN Logic
- First-time: Create 5-digit PIN -> confirm -> saved to `localStorage.hirecar_pin`
- Returning: Verify against stored PIN, 3 wrong attempts -> 30s lockout

### localStorage Keys
| Key | Purpose |
|-----|---------|
| `hirecar_pin` | 5-digit access code |
| `hirecar_nickname` | Display name |
| `hirecar_email` | Client email |

---

## 9. Color System & Design

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

## 10. Recent Changes (completed as of 2026-03-13)

1. **Sidebar nav redesign** — replaced top nav bar with left sidebar (black-to-blue gradient, 260px, collapsible)
2. **Topbar added** — thin 56px header with hamburger + brand logos
3. **Sidebar collapse** — desktop toggle (260px -> 64px icons-only) + mobile hamburger slide-out
4. **Active Dispute badge** — green badge with `@keyframes dotPulse` slow-flashing green dot
5. **Active Litigation grayed** — `badge-grayed` class (dimmed, no color)
6. **Body gradient** — heavy black coverage transitioning to deep navy
7. **Message bubbles** — changed from gold to blue gradient (`#2563b0 -> #3b82d6`)
8. **"Ken Eckman" -> "Message Member Services"** — renamed in 4 HTML + 2 JS locations
9. **Polling interval** — reduced from 30s to 5s for near-real-time messaging
10. **Dashboard Send button** — gold to blue gradient
11. **Tab badges** — gold to blue gradient (`.tab-badge-gold` class)
12. **Playbooks tab** — added as 9th tab with bit.ai-style document viewer + inner sidebar
13. **Slack interactivity** — `handleSlackInteractivity()` wired for modals + block actions
14. **GitHub Pages deployment** — live at https://hirecarken.github.io/hirecar-portal/
15. **PassKit full field mapping** — `updatePassKitMember()` now sends all 10+ pass fields (displayName, activePlans, score, billing, status, etc.) instead of just portalLink
16. **PassKit auto-sync** — admin dashboard updates to stats/billing now trigger `syncPassFromDashboard()` to keep the wallet pass current
17. **Credit Score Diagnostics** — added CRDTSNP credit score diagnostic card to dashboard with Equifax/Experian/TransUnion placeholders, average/range/target, positive/negative factors
18. **Email updated to member@hirecar.la** — all member-facing email references changed from `team@hirecar.la` to `member@hirecar.la` across portal
19. **Hash-based deep linking** — portal now supports `#section` URL fragments for PassKit back-of-pass navigation (e.g., `#evidence`, `#messages`, `#playbook`, `#scores`, `#upload`)
20. **Coming Soon page** — `dist/coming-soon.html` created for features under development (Reservations, Funding); accepts `?feature=` param for dynamic title/icon
21. **Document control naming** — all 12 on-file documents assigned HC-YYYY-CAT-NNN identifiers (e.g., HC-2025-FIL-001, HC-2025-CRT-001). Category codes: AGR=Agreement, FIL=Filing, CRT=Court, NTC=Notice, EVD=Evidence, FIN=Financial
22. **Document source attribution** — each doc card displays a source badge: `HIRECAR` (gold) for court filings/notices, `CWK` (blue) for CreditWithKen agreements, `CLIENT` for pending/uploaded items. Source filter dropdown added alongside search.
23. **Combined document filtering** — tab, source dropdown, and text search now work together as a unified filter system (`_applyDocFilters()`)
24. **Topbar brand cycling banner** — replaced static text-heavy "POWERED BY | CREDITWITHKEN | HIRECAR" with smart logo carousel. Shows all 3 logos (SeedXchange, CWK, HIRECAR) inline on desktop; auto-switches to horizontal R→L carousel on narrow screens. 4s interval, 1s smooth transition, pause-on-hover.
25. **White HIRECAR logo** — replaced SeedXchange topbar logo with white HIRECAR logo from `/Users/hirecarken/Desktop/White logo - no background.png`, embedded as base64
26. **Animated SVG menu toggle** — custom animated SVG hamburger icon in topbar, synced with sidebar collapse/expand state via `toggleMenuIcon()`
27. **Mobile hamburger with HIRECAR branding** — hamburger button shows white HIRECAR logo + "Member Services" label on mobile
28. **CLIENT_PROFILE memberSince fix** — fixed broken JS syntax (`'March '25'` → `"March '25"`) caused by sed escaping failure
29. **Member Since slide removed** — removed from topbar carousel per user request; topbar now shows only the 3 brand logos

---

## 11. PassKit Access Pass — Field Mapping

### Pass Template ID
`7t4cG3EhKw6EF0GLCxUCBi` (Draft — promote to Live for production)

### Field Mapping (Worker → PassKit)

The worker sends all fields via `updatePassKitMember()` in `token.js`. PassKit template variables must match these `metaData` keys exactly.

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
| Barcode `${pId}` | Auto (PassKit) | PassKit pass ID | Auto-generated |

#### Back Fields
| PassKit Template Variable | metaData Key | Source | Example Value |
|--------------------------|-------------|--------|---------------|
| `[status]` | `status` | `authRecord.status` | "Active" |
| `${universal.expiryDate}` | Built-in | PassKit expiry config | Auto from program |
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
- **Sync function** lives in `token.js` — looks up auth + dashboard from KV, rebuilds all fields, sends to PassKit API

### Back-of-Pass Link Routing (set in PassKit dashboard)

| # | Pass Item | Target URL | Notes |
|---|-----------|-----------|-------|
| 4 | Reservations (HireCar Member Services) | `.../coming-soon.html?feature=reservations` | Coming Soon page |
| 5 | CRDTSNP Score | `.../hirecar-portal/#scores` | Dashboard → credit diagnostics card |
| 6 | Dispute Tracking | `.../hirecar-portal/#evidence` | "Log into your portfolio, select My Claims" |
| 7 | Playbook | `.../hirecar-portal/#playbook` | Playbooks section in dashboard |
| 8 | Client Q&A | `.../hirecar-portal/#messages` | Messages section |
| 9 | Phone | `tel:+16616510858` | Triggers phone dialer / SMS prompt |
| 10 | Email | `mailto:member@hirecar.la` | Opens email compose |
| 11 | Funding Request | `.../coming-soon.html?feature=funding` | Coming Soon page |
| 12 | Secure Upload Vault | `.../hirecar-portal/#upload` | Documents tab → opens upload modal |
| 13 | MarketWatch | (keep current link) | Verified working |
| 14 | Scanner Barcode | `https://hirecar.la` | Disabled/placeholder for now |

> **Base URL:** `https://kenetbc-afk.github.io/hirecar-portal/` (or `https://portal.hirecar.app/` once DNS configured)

### Contact Email
- **Member-facing:** `member@hirecar.la` (PassKit pass, portal, messaging)
- **Legal:** `legal@hirecar.la` (urgent/legal matters — unchanged)

### PassKit Dashboard TODO (manual changes required)
1. **Fix typo**: Back field "Client Documents" section says "lease upload" — change to "**Please upload**"
2. **Remove "----coming soon----"** from MarketWatch field (or hide until ready)
3. **Fix DBA name**: Push notification says "HIRECAR, LLC dba HIRECREDIT" — should be "HIRECAR, LLC dba CREDITWITHKEN" for consistency
4. **Promote to Live Project** once all fields verified (draft passes expire after 48 hours)
5. **Set all back-of-pass links** per the routing table above
6. **Update contact email** on pass to `member@hirecar.la`
7. **Scanner barcode** — map to `https://hirecar.la` (placeholder until referral system ready)

---

### P1 — Topbar Banner Redesign ✅ COMPLETED
Topbar converted from text-heavy to clean logo-only banner with smart carousel:

**Current Implementation (as of 2026-03-13):**
- Static "POWERED BY" text on the left
- 3 brand logo slides: SeedXchange, CreditWithKen, HIRECAR
- **Smart display mode:** All logos shown inline when space permits; auto-switches to horizontal R→L carousel on narrow screens
- Carousel: 4s interval, 1s smooth cubic-bezier transition, pause-on-hover
- CSS class `.cycling` added dynamically to `.topbar-cycle-wrap` when carousel activates
- All logos normalized to 16px height (13px on mobile)
- Animated SVG hamburger menu synced with sidebar toggle
- White HIRECAR logo in hamburger button (mobile only)
- "Member Since" slide removed from carousel (was causing clutter)

**Key CSS (lines ~122-130):**
- `.topbar-cycle-wrap` — flex container, switches to `position:relative;overflow:hidden` when `.cycling`
- `.topbar-cycle-track` — flex row of slides, `transition: transform 1s` when cycling
- `.topbar-cycle-slide` — individual logo container, `flex-shrink:0`

**Key JS (lines ~4056-4095):**
- Smart carousel IIFE: `needsCarousel()` measures total slide widths vs wrap width
- `enableCarousel()` / `disableCarousel()` toggle between inline and cycling modes
- Resize handler recalculates and switches modes dynamically

### P2 — Fix Topbar Bleed ✅ COMPLETED
- `.portal-body` padding-top set to `calc(var(--topbar-height) + 20px)`
- Sidebar collapse transitions properly with `margin-left` animation
- Tested with sidebar expanded and collapsed

### P3 — Verify Sidebar Collapse ✅ COMPLETED
- Desktop toggle and mobile hamburger both work
- SVG menu icon animation synced with sidebar state
- Mobile sidebar slides in/out with backdrop overlay

### P4 — Convert Remaining Gold to Blue (optional)
Various `badge-gold` instances for "NEEDED", "PARTIAL", "OUTSTANDING" labels. Evaluate case-by-case whether they should become blue to match the new theme.

### P5 — R2 Bucket Activation
Uncomment `[[r2_buckets]]` section in `wrangler.toml` and redeploy worker when ready.

### P6 — Production Domain
Set up DNS for `portal.hirecar.app` pointing to the deployment target. Update CORS origins and meta tags.

---

## 13. Deployment

### Portal (GitHub Pages)
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
npx vite preview
# or: python3 -m http.server 3456 --directory dist/
```

### Browser Caching Warning
After deploying via `gh-pages`, browsers cache aggressively. Users need hard-refresh (`Cmd+Shift+R`) to see updates. Consider adding cache-busting meta tag or query param.

---

## 14. Git History

```
671b008 Add Active Dispute badge, fix background bleed, sidebar collapse
65b2414 Dark slate theme with gradient bleeding + wire Slack messaging
523afb2 Add Playbooks tab with bit.ai-style document viewer + handoff doc
dd386b3 Add blank portal template + Santiago Urias client version
2675425 Replace React SPA with single-page HTML portal matching reference design
8e017ad HIRECAR Member Services Portal — full redesign matching reference
```

---

## 15. Important Architectural Notes

### Two Script Scopes
The portal has **two separate script scopes** — this is the most important thing to know:
1. **Outer `<script>`** — nickname/email prompts, some utility functions
2. **IIFE `(function(){...})()`** — core portal logic: PIN handling, tab navigation, chatbot, messaging

Functions in the outer scope cannot call IIFE functions unless exposed via `window.functionName`. This has caused bugs before.

### Playbooks Inner Sidebar
The Playbooks tab has its own sidebar (`.pb-sidebar`) independent of the main nav sidebar. Different CSS classes, separate JS toggle. They don't conflict.

### Chatbot Overlay
Fixed bottom-right (`z-index:1001`), independent of the nav sidebar (`z-index:1000`). No overlap issues.

### Message Polling
`setInterval` at ~line 3251 polls `GET /client/:id/messages` every 5000ms. Admin replies sent via Slack interactivity are stored in KV and picked up on the next poll cycle.

---

## 16. Quick Reference

| Task | Command |
|------|---------|
| Edit portal | Open `dist/index.html` in any editor |
| Deploy portal | `cd hirecar-portal && npx gh-pages -d dist` |
| Deploy worker | `cd hirecar-worker && npx wrangler deploy` |
| Set worker secret | `cd hirecar-worker && npx wrangler secret put SECRET_NAME` |
| Check KV data | Cloudflare Dashboard -> Workers & Pages -> KV |
| View live site | https://hirecarken.github.io/hirecar-portal/ |
| Tail worker logs | `cd hirecar-worker && npx wrangler tail` |
| Local preview | `cd hirecar-portal && npx vite preview` |

---

## 17. Known Tech Debt

1. **Dual script scopes** — outer script + IIFE creates fragile cross-scope deps. Consolidate when possible.
2. **Client-side PIN only** — localStorage PIN is not real auth. Worker API provides server-side auth but the portal intro doesn't use it yet.
3. **Static client data** — each client is a separate HTML file. Future: dynamic data from KV via API.
4. **Large file** — ~85k tokens (~5000+ lines) due to base64 images. Could extract to CDN.
5. **dist/ in gitignore** — force-added. Consider removing from `.gitignore`.
6. **No service worker** — could add for offline support and cache management.
7. **Topbar logo visibility** — SeedXchange logo may appear too dark on the dark topbar gradient. Consider brightness filter or white variant.

---

## 18. Pending Feature Requests (from user sessions)

| Priority | Request | Status |
|----------|---------|--------|
| Medium | Remove "Five-Layer Dispute Strategy System" section | Not started |
| Medium | Add example results to evidence matrix section | Not started |
| Medium | Feature Steps animate only once (play-once on scroll) | Not started |
| Low | Use the "E" in HIRECAR to start entry animation | Not started |
| Low | Document section redesign with HC naming + source logos | Plan exists at `~/.claude/plans/distributed-skipping-twilight.md` |

---

*Contact: Ken Eckman (kene.tbc@gmail.com)*
