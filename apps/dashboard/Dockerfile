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
# Next 14 standalone output for a monorepo puts everything under
# apps/dashboard/. node_modules sits at the standalone root and resolves
# upward (parent-of-app) so we copy the whole standalone tree to /app.
COPY --from=builder /app/.next/standalone ./
# Static assets must sit beside server.js inside apps/dashboard.
COPY --from=builder /app/.next/static ./apps/dashboard/.next/static
# 'public' is optional — pre-create then copy if it exists.
RUN mkdir -p /app/apps/dashboard/public
COPY --from=builder /app/public ./apps/dashboard/public

WORKDIR /app/apps/dashboard
EXPOSE 3000
CMD ["node", "server.js"]
