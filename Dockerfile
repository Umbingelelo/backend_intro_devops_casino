# ---------- Etapa builder ----------
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY src ./src

# ---------- Etapa runtime ----------
FROM node:20-alpine AS runtime
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/src ./src
COPY package.json ./
RUN addgroup -S app && adduser -S app -G app
USER app
EXPOSE 3000
CMD ["node", "src/server.js"]