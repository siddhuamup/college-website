# Multi-stage Dockerfile for SSCC Junnar ERP API
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package manifests & prisma schema first for layer caching
COPY server/package*.json ./server/
COPY server/prisma ./server/prisma/

WORKDIR /app/server
RUN npm ci

COPY server/ ./

# Generate Prisma Client for Linux Alpine target
RUN npx prisma generate

# ── Production Stage ──
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Copy node_modules and built server code
COPY --from=builder /app/server ./server
COPY --from=builder /app/server/node_modules ./server/node_modules

# Copy static frontend files
COPY index.html login.html reset-password.html 404.html 500.html ./
COPY js/ ./js/
COPY css/ ./css/
COPY assets/ ./assets/
COPY admin/ ./admin/
COPY student/ ./student/
COPY teacher/ ./teacher/
COPY partials/ ./partials/

WORKDIR /app/server

EXPOSE 3000

RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001
USER nodejs

CMD ["node", "src/index.js"]
