# Paso 1: DEPENDENCIAS
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .

# Paso 2: RUNTIME
FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app .
RUN chown -R node:node /app
USER node
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1
EXPOSE 3000
CMD ["npm", "start"]