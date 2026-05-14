# Etapa 1: instalar deps
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY src ./src

# Etapa 2: runtime mínimo
FROM node:20-alpine AS runtime
WORKDIR /app
# TODO: COPY --from=builder /app/node_modules ./node_modules
# TODO: COPY --from=builder /app/src ./src
# TODO: COPY package.json ./
# TODO: addgroup -S app && adduser -S app -G app
# TODO: USER app
EXPOSE 3000
CMD ["node", "src/server.js"]