# syntax=docker/dockerfile:1

# One recipe for the three Node services. `apps/api`, `apps/worker` and
# `apps/integration-worker` are the same shape — a pnpm workspace package
# compiled with tsc and started with `node dist/main.js` — so a build argument
# selects one instead of three near-identical Dockerfiles drifting apart.
#
#   docker compose build api
#   docker build -f infra/docker/Dockerfile.app --build-arg APP=worker -t hims-worker:local .
#
# APP is the directory name under apps/, which is also the published package
# name (`@hims/<APP>`), so the two never have to be kept in step by hand.
#
# No configuration is baked in. `.dockerignore` excludes the filled-in `.env`
# files, and every runtime value arrives through the container environment,
# which docker-compose.yml assembles from the host `.env`.

ARG NODE_VERSION=24

FROM node:${NODE_VERSION}-alpine AS base

# pnpm comes from the root `packageManager` field via corepack, so the image
# cannot resolve the lockfile with a different pnpm than the repository pins.
# The prompt is disabled because a build has no terminal to answer it.
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable
WORKDIR /repo


# ---------------------------------------------------------------------------
# Dependencies
#
# Manifests only, so editing a source file does not invalidate the install
# layer — which is the layer that costs minutes. Every workspace project is
# named explicitly because `COPY apps/*/package.json apps/` would flatten all of
# them onto one basename and the last would silently win. A new workspace
# project means a new COPY line here and in the `packages/` block below.
# ---------------------------------------------------------------------------
FROM base AS deps
ARG APP

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/api/package.json ./apps/api/
COPY apps/clinician-mobile/package.json ./apps/clinician-mobile/
COPY apps/integration-worker/package.json ./apps/integration-worker/
COPY apps/patient-mobile/package.json ./apps/patient-mobile/
COPY apps/web/package.json ./apps/web/
COPY apps/worker/package.json ./apps/worker/
COPY packages/api-client/package.json ./packages/api-client/
COPY packages/auth/package.json ./packages/auth/
COPY packages/clinical-safety/package.json ./packages/clinical-safety/
COPY packages/config/package.json ./packages/config/
COPY packages/database/package.json ./packages/database/
COPY packages/date-time/package.json ./packages/date-time/
COPY packages/domain-types/package.json ./packages/domain-types/
COPY packages/localization/package.json ./packages/localization/
COPY packages/telemetry/package.json ./packages/telemetry/
COPY packages/ui/package.json ./packages/ui/
COPY packages/validation/package.json ./packages/validation/

# The trailing `...` selects the service *and* every workspace package it
# depends on, so the image never installs Expo, Next or the Playwright runner.
# The store is a build cache, not an image layer: it is mounted, so the packages
# are linked into node_modules for the install and nothing is left behind.
RUN --mount=type=cache,id=hims-pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --filter "@hims/${APP}..."


# ---------------------------------------------------------------------------
# Build
#
# `--filter "... run build"` walks the same selection in dependency order, so
# each @hims/* package is compiled before the service that imports its types.
# tsc emits CommonJS-free ESM: `module: NodeNext` plus `"type": "module"` and
# the `.js` specifiers in the sources mean dist/ is directly runnable by node.
# ---------------------------------------------------------------------------
FROM deps AS build
ARG APP

COPY tsconfig.base.json ./
COPY apps ./apps
COPY packages ./packages
RUN pnpm --filter "@hims/${APP}..." run build


# ---------------------------------------------------------------------------
# Deploy
#
# `pnpm deploy` produces a portable directory: the package's own files plus a
# self-contained node_modules holding only its production graph, with the
# @hims/* workspace dependencies injected as real copies. `--prod` drops
# devDependencies, which is only possible because the build already happened.
#
# Since pnpm 12.2 this does not require `injectWorkspacePackages` in
# pnpm-workspace.yaml — a linked workspace dependency is rewritten to a `file:`
# dependency in the deploy lockfile. That matters here: turning injection on
# workspace-wide would replace the monorepo's symlinks with copies, and an
# edited package would stop being visible to the service importing it until
# `pnpm install` ran again.
#
# The compiled output is copied in explicitly rather than trusted to arrive
# with the deploy: deploy honours the package directory's `.gitignore`, and this
# repository ignores `dist/`, so whether the build artefacts travel is decided
# by an ignore rule that has nothing to do with packaging.
# ---------------------------------------------------------------------------
FROM build AS deploy
ARG APP
RUN pnpm --filter "@hims/${APP}" --prod deploy /out
RUN cp -R "/repo/apps/${APP}/dist" /out/dist


# ---------------------------------------------------------------------------
# Runtime
#
# `node:24-alpine` with no pnpm and no compiler: the deploy directory is
# self-contained, so the package manager has no reason to be in the image.
# ---------------------------------------------------------------------------
FROM node:${NODE_VERSION}-alpine AS runtime

# Not set to `production` here on purpose. NODE_ENV selects an environment
# contract the operator owns — `loadEnv` refuses to start a production process
# with AUTH_DEV_FALLBACK set, and a local stack legitimately runs the
# development contract. docker-compose.yml passes it explicitly, so this image
# never decides it on its own.
WORKDIR /app
COPY --from=deploy --chown=node:node /out ./

# Unprivileged. The deploy directory is only ever read, so ownership by `node`
# costs nothing and keeps a container escape from starting as root.
USER node

# No EXPOSE: the same image runs the API and two processes that serve no HTTP
# at all. The port mapping lives in docker-compose.yml, next to the health check
# that depends on it.
#
# `node dist/main.js` for all three services, which is also why there is no
# command override per service. Node is PID 1 and receives SIGTERM directly, so
# the Nest shutdown hooks get to drain the pg pool and the BullMQ connections
# instead of having them severed.
CMD ["node", "dist/main.js"]
