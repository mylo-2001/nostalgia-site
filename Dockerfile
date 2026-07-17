# Nostalgia Collection — Node + Express app server.
# PostgreSQL is provided as a separate service via docker-compose.
FROM node:22-alpine

WORKDIR /app

# Install production dependencies first for better layer caching.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy the application source (.dockerignore keeps node_modules/.env/.git out).
COPY . .

# Defaults — override in docker-compose. NODE_ENV is left unset here so the
# app does not force HTTPS redirects/secure cookies when run locally.
ENV PORT=8000
EXPOSE 8000

CMD ["node", "server/server.js"]
