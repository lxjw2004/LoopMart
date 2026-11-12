FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY . .
RUN npm ci
ARG API_INTERNAL_URL=http://api:3002
ARG IDENTITY_INTERNAL_URL=http://auth:3001
ENV NEXT_TELEMETRY_DISABLED=1
RUN API_INTERNAL_URL="$API_INTERNAL_URL" AUTH_INTERNAL_URL="$IDENTITY_INTERNAL_URL" npm run build

FROM node:24-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOST=0.0.0.0
COPY --from=build --chown=node:node /app /app
USER node
CMD ["node","dist/apps/api/src/server.js"]
