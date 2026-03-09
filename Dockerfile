# Build stage for web client
FROM oven/bun:1 AS web-builder
WORKDIR /app

# Copy all source code first
COPY . .

# Install deps and build with bun
RUN bun install
RUN bun --filter media-scraper-frontend build

# Production stage
FROM oven/bun:1
WORKDIR /app
ENV PORT=3000

# Copy all source code
COPY . .

# Install prod deps (ignore scripts to skip weapp-tw postinstall)
RUN bun install --prod --no-frozen-lockfile --ignore-scripts

# Copy server
COPY server/ ./server/

# Copy built web client to public folder (server expects ./public/index.html)
COPY --from=web-builder /app/client/web/build ./public

# Create directories for media
RUN mkdir -p /media/inbox /media/tv /media/movies

EXPOSE 3000

CMD ["bun", "run", "server/server.ts"]
