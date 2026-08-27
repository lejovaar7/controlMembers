# SaaS Template

Reusable base template for future SaaS projects.

**Stack:** React + Vite + TypeScript + Hono on Cloudflare Workers.
Generated from Cloudflare's official `cloudflare/templates/vite-react-template`.

## Structure

```
src/
  react-app/      # Frontend (React + Vite)
  worker/         # Backend (Hono on Cloudflare Workers)
index.html        # Frontend entry point
vite.config.ts    # Vite + @cloudflare/vite-plugin
wrangler.json     # Worker and static assets configuration
tsconfig.*.json   # Separate TS projects: app / worker / node
```

Frontend and backend share a single dev process: `@cloudflare/vite-plugin` runs
the Worker inside Vite, so `/api/*` is handled by Hono and everything else is
served by Vite. In production, `wrangler.json` points the Worker at
`./dist/client` as a SPA.

## Endpoints

| Method | Path          | Response             |
| ------ | ------------- | -------------------- |
| GET    | `/api/health` | `{ "status": "ok" }` |

## Development

```bash
npm install
npm run dev          # http://localhost:5173
curl http://localhost:5173/api/health
```

## Scripts

| Script               | Description                                       |
| -------------------- | ------------------------------------------------- |
| `npm run dev`        | Dev server (frontend + worker)                    |
| `npm run typecheck`  | `tsc -b` across all three TS projects             |
| `npm run lint`       | ESLint                                            |
| `npm run build`      | Typecheck + production build into `dist/`         |
| `npm run preview`    | Build + local preview of the production bundle    |
| `npm run check`      | Typecheck + build + `wrangler deploy --dry-run`   |
| `npm run deploy`     | Build + deploy to Cloudflare Workers              |
| `npm run cf-typegen` | Regenerate `worker-configuration.d.ts`            |

## Deploy

```bash
npx wrangler login
npm run deploy
```

The Worker name is defined in `wrangler.json` (`name`). Change it per project.
