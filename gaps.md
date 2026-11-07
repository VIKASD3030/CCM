# CCM gaps outside the public API

Things the system needs that the CCM public API (`/api/v1`) does not provide, or
that need work beyond calling its endpoints. To pick up **after every endpoint
has been tested on the mock and on the real backend**.

Status: `open` · `in progress` · `done`. Priority: P1 blocks real use, P2 needed
soon after, P3 improvement.

## Platform

| # | Gap | Why | Priority | Status |
|---|---|---|---|---|
| 1 | Login without the old FastAPI backend | Login (`/api/auth/*`, dev-login, Azure token exchange) still calls FastAPI. With one backend, sign-in must work from Azure AD (MSAL) alone, and the app must stop relying on the `UserId` / `token<id>` cookies set by FastAPI. | P1 | open |
| 2 | Production proxy that holds the API token | The Vite dev proxy adds the bearer token only in development. A production build needs a small proxy (nginx or a short Node/Python service) that checks the user's Azure login, adds the token and forwards `/api/v1`. The token must never reach the browser. | P1 | open |
| 3 | Per-user access control | One business-unit token sees all assigned projects. The API leaves user-level permissions (who may see or draft for which project) to the caller, so the proxy or app must enforce them. | P2 | open |
| 4 | Token rotation handling | `POST /auth/rotate` returns a new token once; the old one dies after 5 minutes. The proxy needs a safe way to rotate and store the token, and a recovery path with the operator. | P2 | open |
| 5 | Dashboard on the new API | `views/dashboard.js` still calls the old backend (stats, queue). Needs rebuilding from `/projects`, letter `counts`, saved drafts and `/audit`. | P2 | open |
| 6 | Knowledge Base screen | `views/knowledge-base.js` uses the old backend's document store and search. The API has no general document search; decide whether to drop the screen or replace it with contract volumes and letters views. | P2 | open |
| 7 | Master data screens | Users, roles, modules and the other `/common` master screens depend on FastAPI. Decide which are still needed with one backend, and where that data lives. | P2 | open |

## Drafting workflow

| # | Gap | Why | Priority | Status |
|---|---|---|---|---|
| 8 | Long letters and attachment control | Letter + attachments must fit 12,000 characters (`CCM_MAX_LETTER_CHARS`) or the API returns `input_too_long`; it never truncates. Users need to see the size, untick attachments, and add their own attachment text (the API expects the caller to supply attachments). | P1 | open |
| 9 | Resume a draft that is still generating | If the user leaves or reloads during generation, the job finishes on the server but the screen forgets it, and a second click starts a new job. Keep the job ID and Idempotency-Key locally and resume polling. | P1 | open |
| 10 | Approval step | The API has no approve/reject state, and CCM does not send letters. If approval should be recorded in CCM (who approved, when, notes), it needs storage outside the API. Otherwise document the external approval process. | P1 (decision) | open |
| 11 | Team view of drafts | Saved drafts are per `user` label, so a reviewer cannot see colleagues' drafts in My Drafts. Needs a list of team members or a shared store. | P2 | open |
| 12 | Draft version history | The API keeps one draft per project + letter + user; regenerating replaces it. The old version list and "compare with previous version" are gone. Needs local or server-side history. | P2 | open |
| 13 | Sources shared across browsers | Generation results (clauses, earlier letters, warnings) expire with the job after one hour. They are cached only in the browser that generated them. Other browsers see "linked on the server" without details. | P2 | open |
| 14 | Unsaved-changes guard inside the app | The warning works on tab close or reload, not when navigating to another CCM screen. | P3 | open |
| 15 | Formatted draft preview | Drafts are Markdown and shown raw in the editor. Add a formatted preview before export. | P3 | open |
| 16 | Audit trail screen | `GET /audit` (actions, export stats per project) is not shown anywhere. | P3 | open |
| 17 | Branded letter output | The old SYSTRA-branded PDF was removed; export is now the API's DOCX. Check whether the DOCX layout is acceptable or a branded template is needed (the API does not accept new templates). | P3 | open |

## Project setup

| # | Gap | Why | Priority | Status |
|---|---|---|---|---|
| 18 | No way to delete or rename a project | The API has no delete endpoint and the project ID is fixed. Test projects on the real server stay forever; agree a cleanup path with the operator. | P2 | open |
| 19 | Approval before Apply | The API docs say Apply is technical activation and the client collects any approval first. There is no approval step before rules are applied. | P3 | open |
| 20 | Guided rule editing | Rules are edited as raw TOML after creation. A form for common sections (categories, business rules, drafting guidance) would reduce errors. | P3 | open |
| 21 | Outgoing folder for older projects | Projects created before the incoming/outgoing split have one upload folder. The Letters tab shows the lines to add, but it does not add them automatically. | P3 | open |

## Testing notes

Findings from testing every endpoint on the mock and on the real backend go here.

| Endpoint / screen | Mock | Real | Notes |
|---|---|---|---|
| | | | |
