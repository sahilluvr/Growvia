# Growvia on Google Cloud Run — Next.js standalone server + ffmpeg (video conversion).
FROM node:22-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

FROM node:22-slim AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1 BUILD_STANDALONE=1
# Only public, non-secret values are needed at build time (canonical URLs, sitemap). Secrets are set on the service.
ARG SITE_URL=https://usegrowvia.com
ENV SITE_URL=$SITE_URL
RUN npm run build

FROM node:22-slim AS run
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg ca-certificates && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=8080 HOSTNAME=0.0.0.0
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
RUN npm i --no-save --no-audit --no-fund sharp@0.33.5 && chown -R node:node /app
USER node
EXPOSE 8080
CMD ["node", "server.js"]
