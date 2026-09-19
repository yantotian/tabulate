# Stage 1: Build Angular frontend
FROM node:20-alpine AS frontend-build
WORKDIR /build
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm install --ignore-scripts && npm cache clean --force
COPY frontend ./
RUN npm run build

# Stage 2: Production server
FROM node:20-alpine AS base
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --omit=dev --ignore-scripts && npm cache clean --force

# Copy backend
COPY server.js ./
COPY data ./data
# Copy built Angular app (fallback to public if no build)
COPY --from=frontend-build /build/dist/frontend/browser ./frontend/dist/frontend/browser
# Keep legacy public for fallback safety
COPY public ./public

RUN addgroup -S appgroup && adduser -S appuser -G appgroup \
    && chown -R appuser:appgroup /app \
    && mkdir -p /app/logs /app/data && chown -R appuser:appgroup /app/logs /app/data

USER appuser
EXPOSE 3000
ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1
CMD ["node", "server.js"]
