# syntax=docker/dockerfile:1.7
# T4.3 — Production image for the ScholarshipZone API.
#
# Multi-stage:
#   • deps    — installs production-only node_modules (uses npm ci for
#               reproducibility against package-lock.json).
#   • runtime — copies the lean node_modules + source, drops to the non-root
#               `node` user, and runs `node index.js` directly (which picks
#               up the SIGTERM graceful-shutdown handler in index.js).
#
# Build from the repo root with:
#   docker build -f project/Dockerfile -t scholar-api:local project
#
# Or via the docker-compose.yml at the repo root:
#   docker compose up --build

# ---------- Stage 1: install production deps -------------------------------
FROM node:20-alpine AS deps
WORKDIR /app

# Install only what npm ci needs; tini gives us a real PID 1 in the runtime
# stage (handles signal forwarding for graceful shutdown).
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev --no-audit --no-fund

# ---------- Stage 2: runtime ----------------------------------------------
FROM node:20-alpine AS runtime
WORKDIR /app

# tini = tiny init that reaps zombies AND forwards SIGTERM correctly to node.
# Without it, `docker stop` sends SIGTERM to PID 1 (node) which works, but
# tini also handles edge cases like child processes spawned by libraries.
RUN apk add --no-cache tini

ENV NODE_ENV=production \
    PORT=3000 \
    NPM_CONFIG_UPDATE_NOTIFIER=false

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Ensure the uploads directory exists and is writable by the `node` user.
# In production this should be a mounted volume (see docker-compose.yml).
RUN mkdir -p uploads/credentials uploads/travel \
    && chown -R node:node /app

USER node

EXPOSE 3000

# T4.3 — Docker-native health check hits the readiness probe so unhealthy
# containers are restarted by the orchestrator. The probe itself is exempt
# from rate-limiting and access logs.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD wget -qO- http://127.0.0.1:3000/readyz >/dev/null 2>&1 || exit 1

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "index.js"]
