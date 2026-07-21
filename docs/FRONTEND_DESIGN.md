# CCM Frontend — Design Structure & Screenshots

> Correspondence / Contract Management (CCM) — React 18 + Vite 7 single-page app served under the `/master/` base path. This document captures the **current frontend design structure** and provides a **screenshots catalogue** of every page in the application.

---

## 1. Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React 18 (class + function components) |
| Build tool | Vite 7 (dev server on port `5000`, base path `/master/`) |
| UI kit | Ant Design (`antd`) — Table, Modal, Form, Button, Select, Tooltip |
| Layout kit | reactstrap (Card / CardBody), CoreUI-style layout |
| Icons | `@ant-design/icons`, `lucide-react` |
| Animation | `framer-motion`, `react-joyride` (guided tour) |
| State | Redux (`redux`, `react-redux`) + component state |
| Backend API | FastAPI (uvicorn on `127.0.0.1:4445`) |

Note: `.js` files are compiled as JSX. Frontend changes hot-reload; backend changes require a manual uvicorn restart.

---

## 2. Directory Structure

```
frontend/src/
├── app.js                     # Root app shell
├── routes.js                  # Route table (path → component)
├── _nav.js                    # Sidebar navigation tree (MASTER + Admin groups)
├── private-route.js           # Auth-guarded route wrapper
├── external-dashboard.js      # External/public dashboard entry
├── reduxStore.js              # Redux store config
│
├── authentication/            # Login / OTP / login state
│
├── ccm/                       # ── CCM CORE ──
│   ├── ccm-api.js             # CCM API client
│   ├── ccm.css
│   └── views/
│       ├── dashboard.js       # CCM Dashboard
│       └── ai-drafting.js     # AI Drafting (GPT-like) workspace
│
├── master/                    # ── MASTER / ADMIN sub-app ──
│   ├── common/                # Shared master widgets
│   ├── controller/            # Base controller → /common/* API calls
│   └── views/                 # 46 master + view + admin pages
│       ├── project-master.js          + project-master.css (redesigned)
│       ├── contract-master.js
│       ├── contractor-master.js
│       ├── activity-group-master.js
│       ├── activity-master.js
│       ├── variation-order-master.js
│       ├── monthly-breakup-master.js
│       ├── department-master.js
│       ├── location-master.js
│       ├── unit-master.js
│       ├── designation-master.js
│       ├── module-master.js / module-group-master.js
│       ├── role-master.js / role-right-master.js
│       ├── user-master.js / user-role-master.js
│       ├── lookup-master.js
│       ├── reference-document-master.js
│       ├── autonotification-master.js
│       └── view-*.js          # Read-only counterparts + user logs/errors
│
├── containers/
│   └── default-layout/
│       ├── index.js
│       ├── modern-sidebar.js  + modern-sidebar.css   # Collapsible animated sidebar
│       ├── modern-header.js
│       └── external-header.js / external-layout.js
│
├── components/                # Shared UI components
├── config/                    # App config
├── helper/
│   ├── table-helper.js        # Shared Table config: Scroll, LargeScroll, Pagination, TableHelper
│   └── form-helper.js
├── redux/                     # actions / reducers
└── styles/
    ├── app.css                # Global styles (~3000+ lines)
    ├── index.css
    ├── scss/
    └── img/
```

---

## 3. Layout System

- **Shell**: `containers/default-layout/index.js` composes the sidebar + header + routed content area.
- **Sidebar** (`modern-sidebar.js`): collapsible, animated (framer-motion), icon-mapped via `lucide-react`. Two top-level groups — **MASTER** and **Admin** — driven by `_nav.js`. Includes a `react-joyride` guided tour.
- **Header** (`modern-header.js`): top bar with branding and user controls. SYSTRA branding retained.
- **Routing**: `routes.js` maps `/master/*` paths to lazy-loaded components; `private-route.js` guards them behind auth.

---

## 4. Design System (Project Details redesign — `.pm-page`)

The Project Details page defines the current design language, scoped under `.pm-page` (see [`project-master.css`](../frontend/src/master/views/project-master.css)). Intended to be rolled out to other master pages.

### Palette (CSS custom properties)

| Token | Value | Use |
|-------|-------|-----|
| `--pm-primary` | `#2F3A67` | Primary buttons, headers, accents |
| `--pm-accent` | `#D62828` | Destructive / alerts |
| `--pm-bg` | `#F6F7FB` | Page background |
| `--pm-card` | `#FFFFFF` | Cards / surfaces |
| `--pm-border` | `#E5E7EB` | Borders / dividers |
| `--pm-text` | `#1F2937` | Primary text |
| `--pm-muted` | `#6B7280` | Secondary text |
| `--pm-hover` | `#F1F5FB` | Row hover |

### Typography

| Element | Size / Weight |
|---------|---------------|
| Page title | 28px / 700 |
| Section title | 18px / 600 |
| Table header | 13px / 600 |
| Body content | 14px |
| Secondary / meta | 12–13px muted |

### Spacing & shape

- 8px spacing system (page padding `24px 32px 32px`).
- Card radius `12px`, button radius `8px`.
- Subtle shadows: cards `0 4px 12px rgba(0,0,0,.06)`.
- Table: sticky header, ~52px rows, zebra striping (`#fbfcfe`), hover highlight, softened header (no vertical dividers).
- Numeric columns right-aligned (`.col-numeric`); action columns centered (`.col-center`).
- Empty state: centered icon badge + title + helper text + "Create Project" CTA.
- Responsive breakpoints at 1440px and 1200px.

### Global table rules (`styles/app.css`)

- Tables fit container width (no horizontal scroll); `table-layout: fixed`, cells wrap at spaces only (`word-break: normal; overflow-wrap: break-word`).
- Shared `Scroll` / `LargeScroll` constants (`table-helper.js`) keep vertical scroll only — no forced `x: max-content`.

---

## 5. Pages Catalogue

### CCM Core

| Page | Route | Component |
|------|-------|-----------|
| Dashboard | `/master/dashboard` | `ccm/views/dashboard.js` |
| AI Drafting | `/master/ai-drafting` | `ccm/views/ai-drafting.js` |

### MASTER group

| Page | Route | Component |
|------|-------|-----------|
| Project | `/master/project-master` | `project-master.js` ⭐ redesigned |
| Project Details | `/master/project-master-details` | `project-master-details.js` |
| Contractor | `/master/contractor-master` | `contractor-master.js` |
| Contract | `/master/contract-master` | `contract-master.js` |
| Activity Group | `/master/activity-group-master` | `activity-group-master.js` |
| Activity | `/master/activity-master` | `activity-master.js` |
| Variation Order | `/master/variation-order-master` | `variation-order-master.js` |
| Monthly BreakUp | `/master/monthly-breakup-master` | `monthly-breakup-master.js` |
| Reference Document | `/master/reference-document-master` | `reference-document-master.js` |
| Department | `/master/department-master` | `department-master.js` |
| Location | `/master/location-master` | `location-master.js` |
| Unit | `/master/unit-master` | `unit-master.js` |
| Designation | `/master/designation-master` | `designation-master.js` |
| Module Group | `/master/module-group-master` | `module-group-master.js` |
| Module | `/master/module-master` | `module-master.js` |
| Lookup | `/master/lookup-master` | `lookup-master.js` |
| Auto Notification | `/master/autonotification-master` | `autonotification-master.js` |

### Admin group

| Page | Route | Component |
|------|-------|-----------|
| User | `/master/user-master` | `user-master.js` |
| Role | `/master/role-master` | `role-master.js` |
| User Role | `/master/user-role-master` | `user-role-master.js` |
| Role Right Details | `/master/role-right-master` | `role-right-master.js` |
| View User Logs | `/master/view-user-logs` | `view-user-logs.js` |
| View User Errors | `/master/view-user-errors` | `view-user-errors.js` |
| Api Test | `/master/api-test` | `api-test.js` |

Each MASTER/Admin page also has a read-only `view-*` counterpart (e.g. `/master/view-project-master`, `/master/view-contract-master`, …).

---

## 6. Screenshots

> Images live in [`docs/screenshots/`](screenshots/). Drop a PNG named exactly as listed below and it will render here.
>
> **How to capture:** run the stack (frontend on `http://localhost:5000/master/`), log in, open each page, and take a full-page screenshot (browser DevTools → *Capture full size screenshot*, or Win+Shift+S). Save into `docs/screenshots/` with the filenames below.

### Authentication
![Login](screenshots/login.png)

### CCM Core
![Dashboard](screenshots/dashboard.png)
![AI Drafting](screenshots/ai-drafting.png)

### MASTER
![Project (redesigned)](screenshots/project-master.png)
![Project Details](screenshots/project-master-details.png)
![Contractor](screenshots/contractor-master.png)
![Contract](screenshots/contract-master.png)
![Activity Group](screenshots/activity-group-master.png)
![Activity](screenshots/activity-master.png)
![Variation Order](screenshots/variation-order-master.png)
![Monthly BreakUp](screenshots/monthly-breakup-master.png)
![Reference Document](screenshots/reference-document-master.png)
![Department](screenshots/department-master.png)
![Location](screenshots/location-master.png)
![Unit](screenshots/unit-master.png)
![Designation](screenshots/designation-master.png)
![Module Group](screenshots/module-group-master.png)
![Module](screenshots/module-master.png)
![Lookup](screenshots/lookup-master.png)
![Auto Notification](screenshots/autonotification-master.png)

### Admin
![User](screenshots/user-master.png)
![Role](screenshots/role-master.png)
![User Role](screenshots/user-role-master.png)
![Role Right Details](screenshots/role-right-master.png)
![View User Logs](screenshots/view-user-logs.png)
![View User Errors](screenshots/view-user-errors.png)
![Api Test](screenshots/api-test.png)

---

*Last updated: 2026-07-18*
