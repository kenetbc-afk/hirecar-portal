# HIRECAR Membership Portal — Full Audit: Links & Data Sources

**Date:** 2026-03-14
**Scope:** All links, navigation, API endpoints, data sources, third-party integrations, and configuration

---

## 1. LINKS & NAVIGATION

### 1.1 Internal Navigation (React Router NavLinks)

All internal navigation uses React Router v7 `<NavLink>` components. No traditional `<a>` anchor tags are used.

| Route Path | Page Component | Location Defined |
|------------|---------------|-----------------|
| `/` | Dashboard | `App.jsx`, `Layout.jsx` |
| `/login` | Login | `App.jsx` |
| `/statistics` | Statistics | `App.jsx`, `Layout.jsx` |
| `/documents` | Documents | `App.jsx`, `Layout.jsx` |
| `/evidence` | Disputes/Evidence | `App.jsx`, `Layout.jsx` |
| `/communications` | Communications | `App.jsx`, `Layout.jsx` |
| `/messages` | Messages | `App.jsx`, `Layout.jsx` |
| `/strategy` | Strategy | `App.jsx`, `Layout.jsx` |
| `/billing` | Billing | `App.jsx`, `Layout.jsx` |

**Navigation defined in:** `src/components/Layout.jsx` (lines 61-84 desktop, lines 116-120 mobile sidebar)

### 1.2 Redirects

| Redirect | Condition | File |
|----------|-----------|------|
| `→ /login` | User not authenticated | `App.jsx:26` |
| `→ /` | Authenticated user visits `/login` | `App.jsx:42` |
| `→ /` | Catch-all 404 route | `App.jsx:60` |

### 1.3 External URLs

| URL | Purpose | File |
|-----|---------|------|
| `https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=DM+Sans:wght@300;400;500;600&family=Share+Tech+Mono&display=swap` | Google Fonts (Playfair Display, DM Sans, Share Tech Mono) | `index.html:9` |

### 1.4 Links NOT Present

- No `mailto:` links
- No `tel:` links
- No `target="_blank"` links
- No traditional `<a href>` tags
- No external website links in user-facing content

---

## 2. API ENDPOINTS & DATA SOURCES

### 2.1 API Client Configuration

**File:** `src/api/client.js`

- **Base URL:** `import.meta.env.VITE_API_URL` or fallback to `/api`
- **Dev Proxy Target:** `https://hirecar-onboarding.hirecar.workers.dev` (via `vite.config.js`)
- **Auth Headers:** `Authorization: Bearer <token>`, `X-Client-Id: <clientId>`

### 2.2 Public API Endpoints (Client-Facing)

| # | Method | Endpoint | Purpose | Used By |
|---|--------|----------|---------|---------|
| 1 | `POST` | `/auth/verify` | Login with email + PIN | `Login.jsx` |
| 2 | `GET` | `/auth/token/{token}` | Validate PassKit token | `AuthContext.jsx` |
| 3 | `GET` | `/client/{clientId}/dashboard` | Load all dashboard data | Dashboard, Statistics, Documents, Disputes, Communications, Strategy, Billing, Milestones |
| 4 | `GET` | `/client/{clientId}/documents` | List documents | `Documents.jsx` |
| 5 | `POST` | `/client/{clientId}/documents` | Upload document (FormData) | `Documents.jsx` |
| 6 | `GET` | `/client/{clientId}/documents/{docId}` | Download document (blob) | `Documents.jsx` |
| 7 | `GET` | `/client/{clientId}/messages` | Get message history | `Messages.jsx` |
| 8 | `POST` | `/client/{clientId}/messages` | Send message | `Messages.jsx` |

### 2.3 Dashboard Data Shape

The `/client/{clientId}/dashboard` endpoint returns a single payload consumed by most pages:

```
{
  stats: { creditScore, documentsOnFile, itemsRemoved },
  messages: [...],
  disputes: [...],
  milestones: [...],
  defendants: [...],
  causesOfAction: [...],
  evidenceAnswers: {...},
  documents: [...],
  uploadedFiles: [...],
  communications: [...],
  statistics: {...},
  strategy: {...},
  billing: {...},
  damages: {...},
  goals: {...}
}
```

### 2.4 Data Fetching by Page

| Page | API Call | Fallback Data |
|------|----------|---------------|
| Login | `verifyLogin()` | None |
| Dashboard | `getDashboard()` | `DEFAULT_DEFENDANTS`, `DEFAULT_COA` |
| Statistics | `getDashboard()` | `DEFAULT_STATS` (key figures, plaintiff, defendants, timelines) |
| Documents | `getDashboard()` + upload/download | `DOC_ICONS`, `CATEGORY_OPTIONS` |
| Disputes/Evidence | `getDashboard()` | `EVIDENCE_SECTIONS` (18 questions across 5 sections) |
| Communications | `getDashboard()` | `DEFAULT_COMMS` (4 default communications) |
| Messages | `getMessages()` + `sendMessage()` | `CONTACTS`, `AVATAR_STYLES` |
| Strategy | `getDashboard()` | `DEFAULT_STRATEGY` |
| Billing | `getDashboard()` | `DEFAULT_BILLING` (agreement, payments, projections) |
| Milestones | `getDashboard()` | `DEFAULT_STRATEGY` |
| Chatbot | None (simulated) | `QUICK_ACTIONS` |

---

## 3. AUTHENTICATION & SESSION

### 3.1 Auth Flow

```
App Load
  ├─ Check URL for ?t=<token> → validateToken() API
  ├─ Check sessionStorage "hc_session" → validateToken() API
  └─ If neither: show Login page
       └─ User enters email + PIN → verifyLogin() API
            └─ Save to sessionStorage + setUser()
```

### 3.2 Storage

| Key | Storage | Purpose |
|-----|---------|---------|
| `hc_session` | sessionStorage | `{ clientId, token }` — persists login across refreshes |
| `window.location.search` | URL | `?t=<token>` — PassKit deep-link auth |

### 3.3 Access Control

Navigation items are filtered by `user.modules` array — each route maps to a module key, and only enabled modules are shown in the sidebar.

---

## 4. THIRD-PARTY INTEGRATIONS

### 4.1 Google Fonts (Frontend)
- **Service:** Google Fonts API
- **URL:** `fonts.googleapis.com`
- **Fonts:** Playfair Display, DM Sans, Share Tech Mono
- **Location:** `index.html`

### 4.2 Twilio (Backend Only)
- **Service:** SMS/Email messaging
- **Integration:** Backend Cloudflare Worker handles Twilio API calls
- **Portal References:** UI labels in `Billing.jsx`, `Messages.jsx`
- **No frontend API keys or SDK loaded**

### 4.3 PassKit (Backend Only)
- **Service:** Apple/Google Wallet passes
- **Integration:** Backend webhook syncs pass fields from dashboard data
- **Portal References:** Token-based deep link auth (`?t=<token>`)
- **Pass Template ID:** `7t4cG3EhKw6EF0GLCxUCBi` (draft)

### 4.4 Slack (Backend Only)
- **Service:** Admin communication relay
- **Integration:** Worker posts client messages to Slack; admin replies via modal
- **Portal References:** None visible in frontend code

### 4.5 NOT Integrated
- No Google Analytics or tracking pixels
- No Sentry or error monitoring
- No Stripe or payment processing SDK
- No other third-party JavaScript loaded

---

## 5. ENVIRONMENT & CONFIGURATION

### 5.1 Environment Variables

| Variable | Purpose | Default |
|----------|---------|---------|
| `VITE_API_URL` | API base URL override | `/api` (uses Vite proxy in dev) |

### 5.2 Vite Dev Server

- **Port:** 3000
- **Proxy:** `/api` → `https://hirecar-onboarding.hirecar.workers.dev`
- **Rewrite:** Strips `/api` prefix before forwarding

### 5.3 Backend Infrastructure (from HANDOFF.md)

| Resource | Value |
|----------|-------|
| Worker | `hirecar-onboarding` |
| KV: CLIENTS | Auth records, tokens, client index |
| KV: DASHBOARDS | Portal display data per client |
| R2: hirecar-documents | Document storage (pending activation) |
| CORS Origins | `https://portal.hirecar.app`, `http://localhost:3456`, `https://kenetbc-afk.github.io` |

---

## 6. STATIC ASSETS & RESOURCES

### 6.1 Images/Icons

- **Favicon:** `public/hirecar-favicon.png` (referenced in `index.html`)
- **All other icons:** Inline SVG paths rendered in `Layout.jsx` sidebar
- **No external image CDNs used**

### 6.2 CSS/Styles

- **Tailwind CSS** v3.4 — utility-first framework
- **Custom styles:** `src/styles/` directory
- **No external CSS CDNs** (except Google Fonts)

---

## 7. SECURITY OBSERVATIONS

| Area | Finding |
|------|---------|
| **Auth tokens** | Stored in sessionStorage (cleared on tab close) |
| **API auth** | Bearer token + X-Client-Id headers on all requests |
| **CORS** | Restricted to 3 specific origins |
| **External links** | None — no clickjacking or phishing vectors |
| **Third-party JS** | None loaded in frontend (Twilio, PassKit, Slack are backend-only) |
| **URL params** | Token cleaned from URL after extraction via `history.replaceState` |
| **No `.env` files** | No committed environment files found |

---

## 8. SUMMARY

| Category | Count |
|----------|-------|
| Internal navigation routes | 9 |
| External URLs (frontend) | 1 (Google Fonts) |
| API endpoints (client-facing) | 8 |
| Context providers | 2 (Auth, Toast) |
| Pages with data fetching | 10 |
| Hardcoded fallback datasets | 9 |
| Third-party integrations | 4 (Fonts, Twilio, PassKit, Slack) |
| Frontend third-party JS SDKs | 0 |
| Environment variables | 1 |
| Storage keys | 1 (sessionStorage) |

**The portal is a self-contained React SPA** with no external navigation links, no third-party JavaScript SDKs, and all external service integrations handled server-side through the Cloudflare Worker backend.
