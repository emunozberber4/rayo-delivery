# Multi-target Dockerfile for Rayo Delivery independent apps
# Build args:
#   APP_TARGET: 'clientes' | 'repartidores' | 'admin' (default: clientes)

FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy source files
COPY . .

# Build target app
ARG APP_TARGET=clientes
ENV APP_TARGET=${APP_TARGET}
RUN npm run build:${APP_TARGET}

# Production Runner Stage
FROM node:20-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080

# Install production dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Install tsx globally for lightweight TypeScript execution
RUN npm install -g tsx

# Copy server and built bundle with unprivileged node user ownership
COPY --chown=node:node server.ts ./
ARG APP_TARGET=clientes
ENV APP_TARGET=${APP_TARGET}
COPY --chown=node:node --from=builder /app/dist /app/dist

# Set ownership of entire working directory to unprivileged user node
RUN chown -R node:node /app

# Switch to non-privileged user
USER node

EXPOSE 8080

CMD ["tsx", "server.ts"]
