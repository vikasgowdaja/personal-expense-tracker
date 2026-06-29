# Monorepo container for Render Docker deploys
FROM node:20-alpine AS builder

WORKDIR /app

# Install root dependencies for build orchestration
COPY package*.json ./
RUN npm ci

# Install backend and frontend dependencies
COPY backend/package*.json ./backend/
RUN npm ci --prefix backend
COPY frontend/package*.json ./frontend/
RUN npm ci --prefix frontend

# Copy source and build frontend assets
COPY . .
RUN npm run build

# Runtime image
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Copy app and dependency trees produced during build stage
COPY --from=builder /app /app

EXPOSE 5000
CMD ["npm", "run", "start"]
