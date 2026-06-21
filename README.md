# Unison Web Client

The web client for [Unison](https://unisonlabs.ai) — a Next.js (App Router) app
that talks to the Unison API over REST + SSE. This repository is a standalone
extract of the client; the backend is closed-source.

## Stack

- **Next.js 16** (App Router, Turbopack) + **React 19**
- **Tailwind CSS 4**, Radix UI, lucide icons
- **TanStack Query** for data fetching
- **Supabase** for auth (`@supabase/ssr`)
- **Bun** workspace; shared `@unison/contracts` (wire types) and
  `@unison/client-core` (SSE + transcription) are vendored under `packages/`.

## Getting started

```bash
bun install
cp .env.example .env.local   # fill in API + Supabase values
bun run dev                  # http://localhost:3001
```

## Scripts

| Command | What it does |
|---|---|
| `bun run dev` | Dev server on port 3001 |
| `bun run build` | Production build (`next build`) |
| `bun run typecheck` | `tsc --noEmit` |
| `bun run lint` | Biome check |
| `bun run test` | Unit tests (Bun test runner) |

## Environment

See `.env.example`. All client config is `NEXT_PUBLIC_*` (baked at build time):

- `NEXT_PUBLIC_API_BASE_URL` — Unison API base URL
- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` — Supabase auth

## Deployment

Hosted on Vercel, deployed by GitHub Actions (`.github/workflows/`):

- Push to **`main`** → deploys to **staging** (`app.staging.unisonlabs.ai`)
- Push to **`prod`** → deploys to **production** (`app.unisonlabs.ai`)
- Pull requests run typecheck · lint · build · test (no deploy)

Promote staging → production by fast-forwarding `prod` to `main`:

```bash
git checkout prod && git merge --ff-only main && git push
```

`NEXT_PUBLIC_*` values are baked at build time, so each environment is built
with its own settings (a staging build is never aliased to production).
