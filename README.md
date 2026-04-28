# Open Innovation AI Interview Practice Project

A production-style full-stack monorepo built to demonstrate senior full-stack skills for the Open Innovation AI role.

This project includes:

- A resilient NestJS HTTP client with retry + circuit breaker behavior
- Weather data ingestion and pagination from Open-Meteo
- An SSE LLM streaming endpoint
- A React + Vite UI with weather visualization (Recharts) and streaming chat
- Unit, integration, and E2E testing
- A staged GitHub Actions CI pipeline

## Tech Stack

- Monorepo: `pnpm workspaces`
- Backend: `NestJS`, `TypeScript`, `opossum`, `nestjs-pino`
- Frontend: `React`, `Vite`, `TypeScript`, `@tanstack/react-query`, `Recharts`
- Testing: `Jest`, `React Testing Library`, `Playwright`
- CI: `GitHub Actions`

## Monorepo Layout

```text
astraflow/
├── apps/
│   ├── api/                 # NestJS backend
│   └── web/                 # React + Vite frontend
├── packages/
│   └── shared/              # Shared types/contracts
├── e2e/                     # Playwright E2E specs
├── .github/workflows/ci.yml # CI pipeline
└── package.json
```

## What Is Implemented

1. `Step 1` Monorepo scaffold with shared TS + lint setup
2. `Step 2` Resilient HTTP client module (retry/circuit-breaker/error types)
3. `Step 3` Weather module (`GET /api/v1/weather`) with validation + pagination
4. `Step 4` LLM streaming module (`GET /api/v1/llm/stream`) via SSE
5. `Step 5` Typed frontend API layer + React Query
6. `Step 6` Recharts weather visualization + UI error boundary + loading skeleton
7. `Step 7` Streaming UI (`useStream` hook + abort behavior)
8. `Step 8` Playwright E2E coverage for happy/streaming/error paths
9. `Step 9` CI pipeline with ordered stages

## Prerequisites

- Node.js `>= 20` (Node `22` is used in CI)
- `pnpm` `10.x`

## Installation

```bash
pnpm install
```

## Run Locally

Run both apps:

```bash
pnpm dev
```

Run individually:

```bash
pnpm dev:api
pnpm dev:web
```

Default URLs:

- Web: `http://127.0.0.1:5173`
- API: `http://127.0.0.1:3000/api`

Stop servers with `Ctrl + C` in each running terminal.

## API Endpoints

### Health and Root

- `GET /api/v1` returns API welcome payload
- `GET /api/v1/health` returns service health with timestamp

### Weather

- `GET /api/v1/weather`

Query params:

- `location` (required): `"latitude,longitude"` (example: `25.2048,55.2708`)
- `start` (required): `YYYY-MM-DD`
- `end` (required): `YYYY-MM-DD`
- `page` (optional): integer >= 1
- `pageSize` (optional): integer 1..366

Example:

```bash
curl "http://127.0.0.1:3000/api/v1/weather?location=25.2048,55.2708&start=2024-01-01&end=2024-01-07&page=1&pageSize=5"
```

### LLM Streaming (SSE)

- `GET /api/v1/llm/stream?prompt=...`

Notes:

- Uses Anthropic SDK when `ANTHROPIC_API_KEY` is set
- If key is missing, endpoint returns service-unavailable behavior
- Client disconnect aborts upstream stream

## Logging

Structured logging is wired with `nestjs-pino`.

Config location:

- `apps/api/src/logging/pino.config.ts`

Useful env vars:

- `LOG_LEVEL` (for example: `debug`, `info`, `warn`)
- `NODE_ENV` (`production`, `test`, etc.)

## Scripts

### Root scripts

- `pnpm lint` - lint all packages
- `pnpm typecheck` - typecheck all packages
- `pnpm build` - build all packages
- `pnpm test` - run all Jest suites
- `pnpm test:unit` - web unit + API unit suites
- `pnpm test:integration` - API integration suite
- `pnpm e2e` - Playwright E2E
- `pnpm e2e:headed` / `pnpm e2e:ui` - local debugging modes

### API scripts (`apps/api`)

- `pnpm --filter @astraflow/api dev`
- `pnpm --filter @astraflow/api test:unit`
- `pnpm --filter @astraflow/api test:integration`

### Web scripts (`apps/web`)

- `pnpm --filter @astraflow/web dev`
- `pnpm --filter @astraflow/web test`

## Testing Strategy

- Unit tests:
  - API module/service behavior
  - Web API client behavior
  - Streaming hook behavior
  - Chart rendering/empty/error states
- Integration tests:
  - Weather controller full request/validation/service wiring
- E2E tests:
  - Weather happy path UI
  - Token streaming UX
  - User-visible error path when API fails

## CI Pipeline

Workflow file:

- `.github/workflows/ci.yml`

Stages (sequential):

1. `lint`
2. `unit`
3. `integration`
4. `build`
5. `e2e`

Triggered on:

- `pull_request`
- `push` to `main`

## External API Dependency

Weather data source:

- Open-Meteo archive API (`https://archive-api.open-meteo.com`)

The resilient client layer handles transient failures through retry/circuit-breaker controls.
