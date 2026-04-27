# Practice Project Plan — Open Innovation AI Interview

## Overview

A full-stack monorepo project simulating real-world production patterns:
- Resilient HTTP client (circuit breaker + retry) consuming a large external dataset
- NestJS backend with clear module boundaries
- React + Vite frontend with data visualization
- LLM streaming endpoint
- Jest (unit + integration) + Playwright (E2E) tests per step
- GitHub Actions CI/CD

**External API:** [Open-Meteo](https://open-meteo.com/) — free, no API key, large time-series weather datasets. Perfect for charts and realistic resilience testing.

---

## Fit Against Job Requirements

| Job Requirement | Covered |
|---|---|
| React + TypeScript + Vite frontend | Yes |
| Node.js + TypeScript backend | Yes — NestJS |
| Data processing pipelines + large datasets | Yes — core of project |
| Data visualization (ECharts/Recharts) | Yes — Recharts |
| Streaming interfaces for LLMs | Yes — Step 4 |
| RESTful API design | Yes — NestJS controllers |
| Jest + Playwright testing | Yes — per step |
| CI/CD pipelines | Yes — Step 9 |
| Resilient client patterns | Yes — circuit breaker + retry (beyond spec, shows seniority) |

---

## Tech Stack

| Layer | Choice | Reason |
|---|---|---|
| Monorepo | `pnpm workspaces` | Simple, no Nx/Turborepo overhead |
| Backend | NestJS + TypeScript | Clear module boundaries, DI, matches Node.js requirement |
| Frontend | React + TypeScript + Vite | Exactly what the job spec says |
| Visualization | Recharts | Lighter than ECharts, easier to demo |
| External API | Open-Meteo | Free, no API key, large time-series, realistic resilience scenarios |
| Circuit breaker | `opossum` | Industry standard for Node.js |
| Testing | Jest (unit + integration) + Playwright (E2E) | Exact tools in the job spec |
| CI/CD | GitHub Actions | Standard |

---

## Monorepo Structure

```
livecoding/
├── apps/
│   ├── api/          # NestJS backend
│   └── web/          # React + Vite frontend
├── packages/
│   └── shared/       # Shared TypeScript types and DTOs
├── pnpm-workspace.yaml
└── package.json
```

---

## Step-by-Step Plan

### Step 1 — Monorepo Scaffold
- pnpm workspaces setup
- Shared TypeScript base config
- Shared ESLint + Prettier config
- Both apps boot without errors

**Tests:** Smoke — both `api` and `web` start cleanly.

---

### Step 2 — NestJS: Resilient HTTP Client Module

Isolated `HttpClientModule`:
- `opossum` circuit breaker — opens after 5 consecutive failures, half-open after 10s
- Exponential backoff retry — 3 attempts: 200ms → 400ms → 800ms
- Typed error classes: `CircuitOpenError`, `RetryExhaustedError`

**Tests (Jest unit):**
- Circuit opens after N failures
- Retry fires correct number of times with correct delays
- Successful response resets the failure count

---

### Step 3 — NestJS: Weather Data Module

`WeatherModule` with clear boundaries:
- `WeatherService` — fetches + transforms Open-Meteo historical data
- `WeatherController` — `GET /api/weather?location=&start=&end=`
- DTO validation with `class-validator`
- Response pagination for large date ranges

**Tests (Jest integration):**
- Valid params return correctly shaped data
- Invalid params return 400 with validation errors
- Circuit breaker engages when Open-Meteo is unreachable

---

### Step 4 — NestJS: LLM Streaming Endpoint

`LlmModule`:
- `GET /api/llm/stream?prompt=` — SSE endpoint
- Anthropic SDK with `stream: true`
- Client disconnect → abort upstream stream
- Error boundary: writes SSE error frame then closes cleanly

**Tests (Jest unit):**
- SSE headers set correctly
- Abort triggered on client disconnect
- Error frame written on upstream failure

---

### Step 5 — React: Vite App + API Layer

- `apps/web` scaffolded with Vite + React + TypeScript
- Typed API client using `fetch` + types from `packages/shared`
- React Query for data fetching, caching, loading/error states
- Vite dev proxy pointing to NestJS (`/api → localhost:3000`)

**Tests (Jest unit):**
- API client functions return correctly typed responses
- Error states propagate correctly

---

### Step 6 — React: Data Visualization

- Recharts `LineChart` rendering time-series weather data
- Date range picker to control the query window
- Loading skeleton while fetching
- Error boundary for render failures
- Responsive layout

**Tests (Jest + React Testing Library):**
- Chart renders with mock data
- Empty state renders correctly
- Error boundary catches and displays render errors

---

### Step 7 — React: LLM Streaming UI

- `useStream` custom hook consuming SSE via `EventSource`
- Renders tokens as they arrive (append-only)
- Abort button cancels the stream and cleans up
- Connects to Step 4's endpoint

**Tests (Jest unit):**
- Hook accumulates tokens in correct order
- Abort tears down the `EventSource` without memory leaks

---

### Step 8 — E2E Tests (Playwright)

- **Happy path:** load page → select date range → chart renders with data
- **Streaming:** type prompt → tokens appear incrementally
- **Error path:** API down → error state is visible to the user

---

### Step 9 — CI/CD (GitHub Actions)

Pipeline on PR and push to main:
```
lint → unit tests → integration tests → build → E2E tests
```

---

## Session Rules

- No code written until plan is approved
- No git commit until manual review and explicit approval per step
- Tests written alongside feature code, not after
- Each step is a standalone, reviewable unit