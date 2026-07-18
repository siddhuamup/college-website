# Base node image
FROM node:20-alpine AS base

# Install openssl for Prisma client
RUN apk add --no-cache openssl

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy Prisma schema
COPY prisma ./prisma/

# Generate Prisma Client
RUN npx prisma generate

# Copy source code
COPY src ./src/

# Expose server port
EXPOSE 3000

# Set environment to production
ENV NODE_ENV=production

# Startup command
CMD ["npm", "start"]
