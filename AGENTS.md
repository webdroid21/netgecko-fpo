# FPO App — agent notes

## Workflow

- Always commit finished work — commit without being asked once a change is complete and verified.
- Verify with `npx tsc --noEmit` and `npx eslint <changed files>` before committing.
- Client env vars use the `VITE_` prefix (root `.env`); server config lives in `server/.env`.

## Architecture

- Vite + React + MUI frontend, Capacitor for mobile (`com.netgecko.fpoapp`).
- `server/index.js` is an Express proxy in front of Airtable (auth via Firebase token + Airtable role check; `requireEditor` gates writes).
- Attachments upload straight to Airtable via `POST /api/v1/:resource/:id/attachments` → Airtable `uploadAttachment` (5MB/file limit). Do not reintroduce Firebase Storage for attachments.
- Images are compressed before upload by `src/utils/compress-image.ts` (1600px, JPEG q0.6).
- List views share `ListFilters`/`matchesListFilters`/`recordSearchText` from `src/components/list-filters` — the search box must cover all record fields, not just listed columns.
