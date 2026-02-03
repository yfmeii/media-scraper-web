# Build stage for frontend
FROM oven/bun:1 AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package.json frontend/bun.lockb* ./
RUN bun install
COPY frontend/ ./
RUN bun run build

# Production stage
FROM oven/bun:1
WORKDIR /app

# Copy backend
COPY package.json bun.lockb* ./
RUN bun install --production
COPY src/ ./src/

# Copy built frontend
COPY --from=frontend-builder /app/frontend/build ./frontend/build

# Create directories for media
RUN mkdir -p /media/inbox /media/tv /media/movies

ENV PORT=3000
EXPOSE 3000

CMD ["bun", "run", "src/server.ts"]
