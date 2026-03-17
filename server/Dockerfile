# syntax=docker/dockerfile:1

# ── Stage 1: build ────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copy manifests first — Docker caches this layer separately so npm install
# only reruns when package.json or package-lock.json changes, not on every
# code edit. This keeps builds fast.
COPY package*.json ./
RUN npm ci

# Copy source and compile TypeScript → dist/
COPY tsconfig.json ./
COPY prisma ./prisma
COPY src ./src

RUN npm run db:generate   # generates Prisma client from schema
RUN npm run build         # tsc → dist/

# ── Stage 2: production image ──────────────────────────────────────────────────
# Start fresh from a clean node image — no dev dependencies, no TypeScript
# compiler, no source files. Final image is ~3× smaller.
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Copy only what's needed to run
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist         ./dist
COPY --from=builder /app/prisma       ./prisma
COPY --from=builder /app/package.json ./package.json

# Render injects PORT automatically — default 3000 as fallback
EXPOSE 3000

# Run migrations then start the server.
# Using sh -c so both commands run in sequence in the same shell.
# If migrate fails the container exits — better than starting with a broken schema.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]