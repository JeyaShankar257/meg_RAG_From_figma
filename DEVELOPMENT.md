# MedNova Backend — Development Setup

This guide covers local setup for the TypeScript API (`apps/api`), background
worker (`apps/worker`), and Python agent service (`apps/agents`).

---

## Prerequisites

| Tool | Min version | Install |
|------|------------|---------|
| Node.js | 20 | [nodejs.org](https://nodejs.org) |
| pnpm | 9 | `npm install -g pnpm@9` |
| Python | 3.11 | [python.org](https://python.org) |
| Supabase CLI | latest | `npm install -g supabase` |

---

## 1. Install dependencies

```bash
# TypeScript workspaces (run from repo root)
pnpm install

# Python agent service
cd apps/agents
python -m venv .venv
.venv\Scripts\activate      # Windows
# source .venv/bin/activate  # macOS/Linux
pip install -e ".[dev]"
cd ../..
```

---

## 2. Configure environment variables

```bash
# API
copy .env.example apps\api\.env

# Worker
copy .env.example apps\worker\.env
```

Edit each `.env` file and fill in:

| Variable | Where to get it |
|---|---|
| `SUPABASE_URL` | Supabase project → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase project → Settings → API |
| `SUPABASE_ANON_KEY` | Supabase project → Settings → API |
| `RESEND_API_KEY` | [resend.com](https://resend.com) → API Keys |
| `RESEND_FROM_ADDRESS` | A verified sender in Resend |
| `GEMINI_API_KEY` | [ai.google.dev](https://ai.google.dev) |
| `AGENTS_INTERNAL_SECRET` | Any strong random string (keep same in API + Worker + Agents) |

> **Demo mode**: Set `DEMO_MODE=true` in development to allow seed routes and
> mock fallbacks. Must be `false` or unset in production.

---

## 3. Set up Supabase

The repository is initialized as a Supabase CLI project. For a local database,
make sure Docker Desktop is running and use:

```bash
pnpm run supabase:start
pnpm run supabase:status
pnpm run supabase:db:reset
```

The reset command applies every migration under `supabase/migrations`. It is
destructive to the local database only and should not be used against a hosted
project.

For a new hosted Supabase project:

```bash
# Link to your Supabase project
supabase login
supabase link --project-ref <your-project-ref>

# Apply migrations
supabase db push

# (Optional) Load demo seed data
pnpm --filter @mednova/api seed:demo
```

Copy the hosted project's API URL, anon key, and service-role key into
`apps/api/.env` and `apps/worker/.env` from `.env.example`. The service-role
key is server-only and must never be placed in Vite variables or committed.

---

## 4. Start services

Open four terminals:

```bash
# Terminal 1 — Frontend (already running in Figma Make, port 8443 or 5173)
pnpm dev

# Terminal 2 — API (port 3001)
pnpm --filter @mednova/api dev

# Terminal 3 — Worker
pnpm --filter @mednova/worker dev

# Terminal 4 — Python agent service (port 8001)
cd apps/agents
uvicorn main:app --reload --port 8001
```

---

## 5. Verify health

```bash
# API health check
curl http://localhost:3001/health
# Expected: {"status":"ok","service":"mednova-api","demoMode":true,...}

# Agent service health
curl http://localhost:8001/health/live
# Expected: {"status":"ok","service":"mednova-agents",...}

# Readiness is separate from liveness and reports only non-sensitive status.
curl http://localhost:3001/health/ready
curl http://localhost:8001/health/ready
```

To verify the configured API and agent endpoints together without printing any
credentials, run:

```bash
pnpm run verify:integration
```

For the isolated demo workflow (doctor session, patient session, protected
reads, consent, and correction boundary), run:

```bash
pnpm run e2e:demo
```

---

## 6. Run checks

```bash
# TypeScript type checking
pnpm --filter @mednova/api typecheck
pnpm --filter @mednova/worker typecheck

# TypeScript tests
pnpm --filter @mednova/api test
pnpm --filter @mednova/worker test

# Frontend type check
pnpm typecheck

# Python tests
cd apps/agents && pytest

# Formatting, all checks, and the demo workflow smoke test
cd ../..
pnpm run format:check
pnpm run verify:ci
```

The worker currently provides a lifecycle-only entrypoint. It validates
configuration, reports startup/shutdown, and does not claim or mutate clinical
jobs until the durable worker change is implemented.

The Python service uses LangGraph for the explicit validation, prompt,
provider, and result-classification workflow. LangChain/provider integrations
remain behind this internal dispatch boundary. Agent results are advisory and
always require doctor review; the agent service cannot authenticate users,
make RLS decisions, persist clinical records, or activate prescriptions.

---

## Environment variable reference

All variables accepted by `apps/api` and `apps/worker`:

| Variable | Required | Default | Description |
|---|---|---|---|
| `SUPABASE_URL` | ✓ | — | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | ✓ | — | Service role key (server-only) |
| `SUPABASE_ANON_KEY` | ✓ | — | Anon key (used for client auth) |
| `API_PORT` | | `3001` | Port the API listens on |
| `API_ORIGIN` | | `http://localhost:5173` | Frontend origin for CORS |
| `CORS_ALLOWED_ORIGINS` | | `API_ORIGIN` | Comma-separated CORS origins |
| `REPORTS_BUCKET_NAME` | | `medical-reports` | Supabase Storage bucket |
| `SIGNED_URL_EXPIRY_SECONDS` | | `300` | Signed URL lifetime |
| `RESEND_API_KEY` | ✓ | — | Resend API key |
| `RESEND_WEBHOOK_SECRET` | | — | Svix/Resend signing secret used to authenticate delivery webhooks |
| `RESEND_FROM_ADDRESS` | ✓ | — | Verified sender email |
| `GEMINI_API_KEY` | ✓ | — | Gemini API key (server-only) |
| `GEMINI_MODEL` | | `gemini-1.5-pro` | Model identifier |
| `AGENTS_SERVICE_URL` | ✓ | — | Python agent service base URL |
| `AGENTS_INTERNAL_SECRET` | ✓ | — | Shared secret for API↔Agents auth |
| `DEMO_MODE` | | `false` | Enable seed routes and mock fallbacks |
| `WORKER_POLL_INTERVAL_MS` | | `5000` | Job poll interval |
| `WORKER_MAX_CONCURRENT_JOBS` | | `5` | Max parallel job execution |

> **Security**: Never log, commit, or expose `SERVICE_ROLE_KEY`, `RESEND_API_KEY`,
> `GEMINI_API_KEY`, or `AGENTS_INTERNAL_SECRET`. All secrets stay server-side only.

## Security review controls

The API enforces the following controls before demo or production deployment:

- Report upload, listing, review, and signed-link requests use the shared patient
  authorization policy; storage paths must be scoped to the authorized patient.
- Dose events are patient-owned, restricted to patient accounts, and validate the
  schedule-to-patient relationship before insertion.
- Prescription rejection requires an active doctor assignment, matching the
  approval workflow.
- Resend webhooks verify Svix signatures and timestamps when
  `RESEND_WEBHOOK_SECRET` is configured outside demo mode, and terminal delivery
  states cannot be downgraded by replayed events.

The API/backend owner is responsible for keeping these checks covered by route
tests when schema or provider integrations change.
