# Build stage for web client
FROM oven/bun:1 AS web-builder
WORKDIR /app/client/web
COPY client/web/package.json client/web/bun.lockb* ./
RUN bun install
COPY client/web/ ./
RUN bun run build

# Production stage
FROM oven/bun:1
WORKDIR /app

# Copy backend
COPY package.json bun.lockb* ./
RUN bun install --production
COPY server/ ./server/

# Copy built web client
COPY --from=web-builder /app/client/web/build ./client/web/build

# Create directories for media
RUN mkdir -p /media/inbox /media/tv /media/movies

ENV PORT=3000
EXPOSE 3000

CMD ["bun", "run", "server/server.ts"]
