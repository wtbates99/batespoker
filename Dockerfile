# ── Stage 1: Install dependencies ─────────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app

# better-sqlite3 needs build tools on Alpine
RUN apk add --no-cache python3 make g++

COPY package.json package-lock.json ./
RUN npm ci

# ── Stage 2: Build ────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Server-side only — no NEXT_PUBLIC_ vars needed at build time
ARG JWT_SECRET=build-placeholder-secret-32-characters
ENV JWT_SECRET=$JWT_SECRET

# Build Next.js app + compile server.ts → dist/server.js
RUN npm run build

# ── Stage 3: Runtime ──────────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN apk add --no-cache python3 make g++

# Copy compiled server
COPY --from=builder /app/dist ./dist

# Copy Next.js build
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.mjs ./next.config.mjs
COPY --from=builder /app/package.json ./package.json

# Install production deps only
COPY --from=deps /app/node_modules ./node_modules

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

CMD ["node", "dist/server.js"]
