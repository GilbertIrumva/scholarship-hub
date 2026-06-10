# ScholarshipZone

[![CI](https://github.com/GilbertIrumva/scholarship-hub/actions/workflows/ci.yml/badge.svg)](https://github.com/GilbertIrumva/scholarship-hub/actions/workflows/ci.yml)

A scholarship discovery + application platform. React 19 + Vite SPA on the front
end, Express 5 + Mongoose on the back end, with TOTP 2FA, refresh-token sessions,
pluggable file storage (local disk or S3/R2), structured logging, Core Web Vitals
ingestion, and Docker-ready graceful shutdown.

## Repository layout

```
.                         # React 19 + Vite SPA (root)
├── src/                  #   pages, components, services, i18n, hooks
├── public/               #   static assets, robots.txt, sitemap.xml
├── docker-compose.yml    #   local prod-like stack (mongo + api)
└── project/              # Express 5 + Mongoose API
    ├── index.js          #   single-file app entry
    ├── db/models/        #   Mongoose models
    ├── lib/              #   logger, observability, storage, audit, schemas
    ├── test/             #   vitest + supertest + mongodb-memory-server
    ├── Dockerfile        #   multi-stage node:20-alpine image
    └── .env.example      #   all env vars documented
```

## Quick start (development)

```bash
# 1. Front end
npm install
npm run dev                 # http://localhost:5173

# 2. Back end (in a second terminal)
cd project
cp .env.example .env        # fill in MONGODB_URI + TRAVEL_DOC_SECRET at minimum
npm install
npm run dev                 # http://localhost:3000
```

## Quick start (Docker)

```bash
cp project/.env.example project/.env
docker compose up --build   # mongo + api together
```

The `api` service exposes:

- `GET /healthz` (alias `/api/health`) — liveness; 200 unless the process is dead.
- `GET /readyz` (alias `/api/ready`) — readiness; 200 when Mongo + storage are
  healthy AND the process isn't draining; 503 otherwise. Use this for
  Kubernetes `readinessProbe` and load-balancer health checks.

`docker compose down -v` removes the mongo + uploads volumes.

## Scripts

### Root (front end)

| Script           | What it does                                       |
| ---------------- | -------------------------------------------------- |
| `npm run dev`    | Vite dev server with HMR                           |
| `npm run build`  | Production bundle into `dist/`                     |
| `npm run lint`   | ESLint over the whole `src/` tree                  |
| `npm test`       | vitest run (JSDOM) — components + services         |

### Backend (`project/`)

| Script                | What it does                                              |
| --------------------- | --------------------------------------------------------- |
| `npm run dev`         | `node --watch index.js` — auto-reload on change           |
| `npm start`           | `node index.js`                                           |
| `npm run start:prod`  | `cross-env NODE_ENV=production node index.js`             |
| `npm test`            | vitest run with `mongodb-memory-server`                   |
| `npm run migrate`     | One-shot JSON → Mongo migration                           |
| `npm run set-admin`   | Provision the bootstrap admin account                     |

## Tests

```bash
# Front end (root) — 30 tests, JSDOM
npm test

# Back end — supertest + mongodb-memory-server, ~170 tests
cd project && npm test
```

## CI

Every push and PR to `master`/`main` runs the [CI workflow](.github/workflows/ci.yml):

- **Frontend** — lint, vitest, production build on Node 20 + 22.
- **Backend** — vitest with mongodb-memory-server on Node 20 + 22; the
  MongoDB binary is cached between runs.
- **Docker** — on master pushes only: build the API image and smoke-test
  that `/healthz` responds.

[Dependabot](.github/dependabot.yml) opens grouped weekly PRs for `npm`
(root + `/project`) and GitHub Actions updates.

## Configuration

See [project/.env.example](project/.env.example) for the full list. Key vars:

- `MONGODB_URI`, `MONGODB_DB_NAME`, `PORT`
- `TRAVEL_DOC_SECRET` — REQUIRED in production (AES-256-GCM key derivation).
- `TOTP_ENC_SECRET` — optional; falls back to `TRAVEL_DOC_SECRET` in dev.
- `CORS_ORIGINS`, `APP_BASE_URL`
- `STORAGE_BACKEND` (`local` | `s3`) + `S3_*` for Cloudflare R2 / AWS S3
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_REDIRECT_URI` /
  `OAUTH_STATE_SECRET` — scholar Google sign-in (admin sign-in is
  password + TOTP only, never OAuth).
- `SENTRY_DSN`, `SENTRY_RELEASE`, `SENTRY_TRACES_SAMPLE_RATE`
- `SHUTDOWN_GRACE_MS` — graceful-shutdown drain window (default 25000ms).

## License

ISC

