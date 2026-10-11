# syntax=docker/dockerfile:1.7
FROM node:20-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

FROM node:20-bookworm-slim AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN ./node_modules/.bin/tsc scripts/staging-runtime-postgres-probe.ts \
      --outDir probe-dist --rootDir . --target ES2022 --module commonjs \
      --moduleResolution node --esModuleInterop --skipLibCheck --strict --types node \
 && npm run build \
 && test -f .next/server/app/api/share-to-grow/woocommerce/webhook/route.js \
 && npm prune --omit=dev

FROM node:20-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
ARG GIT_COMMIT=unknown
ENV GIT_COMMIT=${GIT_COMMIT}
COPY --from=build --chown=node:node /app/package.json ./package.json
COPY --from=build --chown=node:node /app/next.config.ts ./next.config.ts
COPY --from=build --chown=node:node /app/tsconfig.production.json ./tsconfig.production.json
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/.next ./.next
COPY --from=build --chown=node:node /app/resources ./resources
COPY --from=build --chown=node:node /app/public ./public
COPY --from=build --chown=node:node /app/probe-dist ./probe-dist
COPY --chown=node:node infra/staging/certificates/aws-rds-global-bundle.pem /app/certs/rds-global-bundle.pem
RUN echo "fe45bbebf92ad3e27a583bbb2ddd1553c521ed4d49af5514dc0a40372ea5395c  /app/certs/rds-global-bundle.pem" | sha256sum -c -
USER node
EXPOSE 3000
CMD ["node_modules/next/dist/bin/next", "start", "-p", "3000", "-H", "0.0.0.0"]
