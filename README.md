# LeanLoop

Low-code, self-hosted workflow automation for Indian SMEs — a template-first layer on top of [n8n](https://n8n.io/).

Customers don't see the raw n8n canvas. They pick a template, connect their accounts, and hit Activate. All data stays on the customer's own VPS.

## Monorepo layout

```
apps/
  dashboard/   Next.js 14 frontend (the user-facing UI)
  n8n/         Customized n8n image + slots for LeanLoop custom nodes
packages/
  templates/   Template-first definitions (schema.ts + .json templates)
scripts/       Install/setup helpers
docker-compose.yml
install.sh     1-click installer for a fresh VPS
```

## Architecture

```
 ┌──────────────┐   REST API    ┌──────────────┐
 │  Dashboard   │ ─────────────▶│      n8n     │
 │  (Next.js)   │               │  (TypeScript)│
 └──────────────┘               └──────┬───────┘
        ▲                              │
        │                              ▼
   Browser UI                    ┌──────────────┐
  (templates,                    │  PostgreSQL  │
   logs, health)                 └──────────────┘
```

- **Dashboard** calls the n8n REST API from the server side (API key never reaches the browser).
- **n8n** runs the actual workflows, stores credentials encrypted in Postgres.
- **Templates** are JSON files that the dashboard POSTs to n8n's `/workflows` endpoint on activation.
- **WhatsApp alerts** are issued by the dashboard (or a dedicated n8n workflow) when executions land in the retry queue or dead-letter queue.

## Run locally

```bash
cp .env.example .env
# Edit .env — set N8N_ENCRYPTION_KEY, DB passwords, etc.
docker compose up -d --build
```

- Dashboard: http://localhost:3000
- n8n:       http://localhost:5678

In n8n: Settings → API → create a personal API key, put it into `.env` as `N8N_API_KEY`, then `docker compose up -d` again.

## Run on a fresh VPS

```bash
./install.sh   # first run writes .env with a generated encryption key
./install.sh   # second run brings the stack up
```

## Current status

- [x] Monorepo with npm workspaces
- [x] Docker Compose: Postgres + n8n + dashboard
- [x] Next.js dashboard shell (Home / Templates / Integrations / Logs)
- [x] n8n REST API client (server-side) with human-readable log translation
- [x] Template JSON contract + 3 sample templates
- [x] 3-step setup wizard (select → connect → activate)
- [x] Activation API that pushes a template to n8n and enables the workflow
- [x] WhatsApp Business API alerting (`/api/alerts/execution-failed`)
- [x] Retry + dead-letter queue + poller (`/api/queue/process`)
- [x] Custom n8n nodes scaffolded: Razorpay, Tally, Shiprocket, GST invoice
- [ ] Real OAuth flows per provider (wizard currently stubs "Connected")
- [ ] Persist queue to Redis/Postgres so retries survive restarts
- [ ] SSL auto-config in `install.sh`

## API surface (dashboard)

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/templates/:id/activate` | Deploy a template to n8n + activate it |
| POST | `/api/alerts/execution-failed` | Webhook for n8n error workflows → WhatsApp |
| GET  | `/api/queue/process` | Poll n8n for failures, queue them, fire alerts |
| GET  | `/api/queue/process?peek=1` | Snapshot of the retry + DLQ state |

## Custom n8n nodes

Lives in [`apps/n8n/custom-nodes/`](./apps/n8n/custom-nodes/). Each package builds to `dist/` and is loaded by the n8n container from `/home/node/.n8n/custom`. To build them:

```bash
cd apps/n8n/custom-nodes/razorpay && npm install && npm run build
# repeat for tally, shiprocket, gst-invoice
```
