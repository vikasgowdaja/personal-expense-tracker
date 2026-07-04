# Monorepo container for Render Docker deploys
FROM node:20-alpine AS builder

WORKDIR /app

# Install root dependencies for build orchestration
COPY package*.json ./
RUN npm ci

# Install server and client dependencies
COPY server/package*.json ./server/
RUN npm ci --prefix server
COPY client/package*.json ./client/
RUN npm ci --prefix client

# Copy source and build client assets
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
