# CLAUDE.md

Guidance for Claude Code when working in this repository.

## Hard rules

1. **Everything in this repository must be written in English.** Documentation,
   code, comments, identifiers, UI copy, commit messages, branch names — all of
   it. This holds even when the conversation happens in another language. Do not
   mirror the language of the prompt into project files.

2. **Never add Claude as a co-author.** Do not append `Co-Authored-By: Claude`
   (or any similar attribution) to commit messages, and do not add
   "Generated with Claude Code" footers to commits or pull requests.

3. **Commit messages are a single line, written in English.** No body, no
   bullet list, no footer — one line and nothing else, under ~72 characters.

   **Say what you did, directly, in the past tense.** Start with a plain verb:
   `Added`, `Updated`, `Fixed`, `Removed`, `Renamed`, `Moved`.

   **Never use Conventional Commits prefixes.** No `chore:`, `feat:`, `fix:`,
   `docs:`, `refactor:`, `style:`, `test:`, and no scopes like `fix(routing):`.
   They add nothing — write the sentence instead.

   ```
   Added JSON 404 handler for unknown API routes
   Updated routing so only /api/* runs through the Worker
   Fixed SPA deep links returning a Hono 404
   Removed unused demo assets from the template
   ```

   Not this:

   ```
   chore: establish SaaS starter foundation
   feat(api): add health endpoint
   Add health endpoint
   ```

   ```
   Updated routing

   - changed wrangler.json
   - added notFound handler

   Co-Authored-By: Claude <noreply@anthropic.com>
   ```

## What this project is

A reusable base template for building SaaS products. It is not a product itself —
it is the starting point that future SaaS projects get cloned from. Every
decision should favour clarity and reusability over cleverness.

The template is built in phases. Each phase adds one capability, is verified end
to end, and leaves the repository in a working state. Do not implement anything
belonging to a later phase unless it is explicitly requested.

## Stack

- **React** + **Vite** + **TypeScript** — frontend
- **Hono** — backend, running on **Cloudflare Workers**
- **Cloudflare Workers Static Assets** — serves the built SPA
- Scaffolded from Cloudflare's official `cloudflare/templates/vite-react-template`

Runtime dependencies are deliberately minimal: `hono`, `react`, `react-dom`.

## Structure

```
src/react-app/     Frontend (React + Vite)
src/worker/        Backend (Hono on Cloudflare Workers)
index.html         Frontend entry point
vite.config.ts     Vite + @cloudflare/vite-plugin
wrangler.json      Worker config + static assets
tsconfig.json      References the three projects below
  tsconfig.app.json      only src/react-app, DOM types
  tsconfig.worker.json   only src/worker, Workers types
  tsconfig.node.json     only vite.config.ts
worker-configuration.d.ts   Generated — never edit by hand
```

Frontend and backend are separated twice over: by directory, and by TypeScript
project. Keep it that way — the two sides must not be able to import each
other's types by accident.

## Routing

Traffic is split by `run_worker_first: ["/api/*"]` in `wrangler.json`:

- `/api/*` runs through the Hono Worker.
- Everything else is served by Static Assets, with
  `not_found_handling: "single-page-application"` returning `index.html` so SPA
  deep links and hard refreshes work.

Consequences to respect:

- **Do not add a Hono catch-all** that proxies unmatched requests to `ASSETS`.
  SPA routing is the asset router's job, not Hono's.
- All backend routes must live under `/api/`. A route outside that prefix will
  never reach the Worker.
- Unknown `/api/*` routes return a JSON 404 via `app.notFound`.

The `ASSETS` binding is declared and typed but currently unused.

## Database

Cloudflare D1 accessed through Drizzle ORM. Binding `DB`, database name
`saas-template-db`.

```
src/worker/db/schema.ts   Drizzle schema
src/worker/db/index.ts    getDb() / getTenantDb()
drizzle/                  Generated migrations — the single source of truth
drizzle.config.ts         Drizzle Kit configuration
```

Rules:

- **Always go through `getDb(env)`.** Never call `drizzle(...)` anywhere else,
  and never reach for `env.DB` directly outside `src/worker/db/`.
- **`getTenantDb(env)` delegates to `getDb(env)` and must stay trivial.** It is a
  future abstraction point only. Do not implement tenants, organizations,
  memberships, roles or database routing behind it until a phase asks for it.
- **Migrations are generated, never hand-written.** Run `npm run db:generate`
  after changing the schema, inspect the SQL, then apply it with
  `npm run db:migrate:local`. Do not copy migrations between directories, do not
  write a custom migration runner, and do not use `drizzle-kit push` to migrate.
- `wrangler.json` sets `migrations_dir` to `./drizzle` so Wrangler consumes the
  Drizzle output directly.
- Changing `database_id` repoints local D1 at a different database — re-run
  `npm run db:migrate:local` afterwards.

Dependency policy: pin every direct dependency to an exact version, stable
releases only. Stay on React 19, Vite 7, TypeScript 5.9.x, ESLint 9,
typescript-eslint 8 and Hono 4 unless a phase explicitly says otherwise.

## Commands

| Command              | Purpose                                          |
| -------------------- | ------------------------------------------------ |
| `npm run dev`        | Dev server, frontend + worker (port 5173)        |
| `npm run typecheck`  | `tsc -b` across all three TS projects            |
| `npm run lint`       | ESLint                                           |
| `npm run build`      | Typecheck + production build into `dist/`        |
| `npm run preview`    | Build + local preview of the production bundle   |
| `npm run check`      | Typecheck + lint + build + `deploy --dry-run`    |
| `npm run db:generate`       | Generate a migration from the schema     |
| `npm run db:migrate:local`  | Apply migrations to local D1             |
| `npm run db:migrate:remote` | Apply migrations to remote D1            |
| `npm run deploy`     | Build + deploy to Cloudflare Workers             |
| `npm run cf-typegen` | Regenerate `worker-configuration.d.ts`           |

Run `npm run cf-typegen` after any change to `wrangler.json`, then commit the
regenerated types.

## Before finishing any phase

Run the full gate and confirm it is green:

```
npm run cf-typegen   # if wrangler.json changed
npm run typecheck
npm run lint
npm run build
npm run check
```

Then verify the actual behaviour at runtime — do not rely on a successful build
alone. Use `npx wrangler dev` for anything routing- or Workers-related, since it
exercises the real runtime rather than Vite's emulation.

## Conventions

- Keep changes minimal and scoped to what was asked.
- No stub files, no commented-out scaffolding, no unused dependencies.
- Tabs for indentation, double quotes — match the existing files.
- `worker-configuration.d.ts` is generated and is excluded from ESLint.
- The Worker name lives in `wrangler.json` (`name`) and should be changed per
  project derived from this template.
