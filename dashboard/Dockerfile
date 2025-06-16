ARG NODE_VERSION=20-alpine
ARG PNPM_VERSION=9.7.0

# Base image with security updates and optimizations
FROM node:${NODE_VERSION} AS base

# Install pnpm globally for better dependency management
RUN npm install -g pnpm@${PNPM_VERSION}

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Set optimal Node.js environment variables
ENV NODE_ENV=production
ENV NODE_OPTIONS="--max_old_space_size=1024"
ENV NEXT_TELEMETRY_DISABLED=1

# Create app directory
WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001

# Dependencies stage - separate for better caching
FROM base AS deps

# Copy package files with precise caching
COPY package.json pnpm-lock.yaml* .npmrc* ./

# Install dependencies with optimizations
RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    --mount=type=cache,target=/root/.cache/pnpm \
    pnpm install --frozen-lockfile --prod=false

# Production dependencies only
FROM base AS prod-deps

COPY package.json pnpm-lock.yaml* .npmrc* ./

RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    --mount=type=cache,target=/root/.cache/pnpm \
    pnpm install --frozen-lockfile --prod

# Build stage
FROM base AS builder

# Copy all dependencies
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package.json ./package.json

# Copy source code with .dockerignore optimization
COPY . .

# Generate Next.js build with optimizations
RUN --mount=type=cache,target=/app/.next/cache \
    pnpm run build

# Clean up development dependencies and optimize
RUN pnpm prune --prod && \
    pnpm store prune

# Production stage
FROM base AS runner

# Set production environment
ENV NODE_ENV=production
ENV HOSTNAME="0.0.0.0"
ENV PORT=3000

# Copy only necessary files for production
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Health check for container orchestration
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

# Use non-root user
USER nextjs

# Expose port
EXPOSE 3000

# Use dumb-init for proper signal handling and start the application
CMD ["dumb-init", "node", "server.js"]
