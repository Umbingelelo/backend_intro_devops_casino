FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .


# ETAPA 2: Runtime
FROM node:20-alpine AS runtime
WORKDIR /app
COPY package*.json ./
RUN npm install --only=production
COPY --from=builder /app ./
USER node
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

CMD ["npm", "start"]