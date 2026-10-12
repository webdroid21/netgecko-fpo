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

## Deployment

- Package manager is **yarn** (`yarn.lock` is authoritative and has capacitor entries). `package-lock.json` is stale; `pnpm-lock.yaml` is out of sync with `package.json` — do NOT `pnpm install`, it resolves drifted versions that break `tsc` in the build. Use `yarn install` / `yarn build`.
- `main` = source. `ovh-deploy` = production static bundle served from repo root (`index.html`, `_assets/`, `.htaccess`, `assets/`, `fonts/`, `logo*`, `favicon.ico`).
- Deploy: `yarn build` on main → `git checkout ovh-deploy` → `git rm -rq .` (stages deletion of tracked files only — never `rsync --delete`, it wiped untracked .env files once) → `cp -R dist/. .` → `git add index.html .htaccess _assets assets fonts logo* favicon.ico` → verify `git status` shows only build files → commit "Deploy build YYYY-MM-DD — <note>" → `git push origin ovh-deploy` → `git checkout main`.
- NEVER `git add -A` on `ovh-deploy` — the branch has no `.gitignore`, so it sweeps `.env`, `node_modules`, `.vercel/`, `dist/` and every untracked file into the deploy commit (happened once, push was luckily rejected). Explicit paths only; `git rm -rq .` already stages deletions.
- Untracked-but-real files that must survive deploys: `.env`, `server/.env`, `server/serviceAccount.json`, `node_modules`, `dist`.
