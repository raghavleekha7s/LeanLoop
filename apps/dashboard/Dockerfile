# Multi-stage build for the Next.js dashboard
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --no-audit --no-fund

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Tell next.config.mjs to emit a standalone output (server.js + minimal
# node_modules) so the runner image stays small. The same config also
# supports Vercel deploys (which need the default output) — this env var
# is the switch.
ENV NEXT_OUTPUT_MODE=standalone
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
# Next 14 standalone output puts server.js + node_modules at .next/standalone/.
# 'public' is optional — create an empty one so the COPY never errors.
RUN mkdir -p /app/public
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
EXPOSE 3000
CMD ["node", "server.js"]
