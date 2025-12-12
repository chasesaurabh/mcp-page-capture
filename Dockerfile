# Stage 1: Build TypeScript sources
FROM node:20-slim AS builder
WORKDIR /app

# Build argument for version
ARG VERSION=latest

COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

COPY tsconfig.json ./
COPY src ./src
RUN npm install --only=dev && npm run build && npm prune --production

# Stage 2: Runtime image with Chromium deps for Puppeteer
FROM node:20-slim
WORKDIR /app

# Build argument and labels
ARG VERSION=latest
LABEL org.opencontainers.image.title="mcp-page-capture"
LABEL org.opencontainers.image.description="MCP server for webpage screenshot capture and DOM extraction"
LABEL org.opencontainers.image.version="${VERSION}"
LABEL org.opencontainers.image.source="https://github.com/chasesaurabh/mcp-page-capture"
LABEL org.opencontainers.image.licenses="MIT"

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
       ca-certificates \
       fonts-liberation \
       libasound2 \
       libatk-bridge2.0-0 \
       libatk1.0-0 \
       libatspi2.0-0 \
       libc6 \
       libcairo2 \
       libcups2 \
       libdbus-1-3 \
       libexpat1 \
       libfontconfig1 \
       libgcc1 \
       libgdk-pixbuf2.0-0 \
       libglib2.0-0 \
       libgtk-3-0 \
       libnspr4 \
       libnss3 \
       libpango-1.0-0 \
       libpangocairo-1.0-0 \
       libstdc++6 \
       libx11-6 \
       libx11-xcb1 \
       libxcb1 \
       libxcomposite1 \
       libxcursor1 \
       libxdamage1 \
       libxext6 \
       libxfixes3 \
       libxi6 \
       libxrandr2 \
       libxrender1 \
       libxss1 \
       libxtst6 \
       wget \
       xdg-utils \
    && rm -rf /var/lib/apt/lists/*

# Copy package files and install production dependencies
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist

# Set environment variables
ENV NODE_ENV=production
ENV LOG_LEVEL=info

# Create non-root user for security
RUN groupadd -r mcpuser && useradd -r -g mcpuser mcpuser

# Create captures directory with proper permissions
RUN mkdir -p /app/captures && chown -R mcpuser:mcpuser /app

# Switch to non-root user
USER mcpuser

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "process.exit(0)" || exit 1

# Expose volume for captures
VOLUME ["/app/captures"]

# Start the MCP server
CMD ["node", "dist/cli.js"]
