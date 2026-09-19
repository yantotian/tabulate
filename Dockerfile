# Stage 1: Build Angular frontend
FROM node:20-alpine AS frontend-build
WORKDIR /build
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm install --ignore-scripts && npm cache clean --force
COPY frontend ./
RUN npm run build

# Stage 2: Production server (backend)
FROM node:20-alpine AS base
WORKDIR /app
# Backend deps
COPY backend/package.json backend/package-lock.json* ./backend/
RUN npm install --prefix backend --omit=dev --ignore-scripts && npm cache clean --force

# Copy backend source
COPY backend ./backend
# Copy built Angular app - backend expects ../frontend/dist relative to backend/server.js
COPY --from=frontend-build /build/dist/frontend/browser ./frontend/dist/frontend/browser
# Also copy backend public fallback is already in backend/public via COPY backend

RUN addgroup -S appgroup && adduser -S appuser -G appgroup \
    && chown -R appuser:appgroup /app \
    && mkdir -p /app/backend/logs /app/backend/data && chown -R appuser:appgroup /app/backend/logs /app/backend/data

USER appuser
EXPOSE 3000
ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1
CMD ["node", "backend/server.js"]
