FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./

# Si existe package-lock.json -> npm ci (reproducible).
# Si no -> npm install (fallback para que el build no se rompa).
RUN if [ -f package-lock.json ]; then \
      npm ci --omit=dev; \
    else \
      echo ">>> AVISO: sin package-lock.json, usando npm install"; \
      npm install --omit=dev; \
    fi

COPY . .

# ---------- ETAPA 2: runtime ----------
FROM node:20-alpine AS runtime
WORKDIR /app

COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/package*.json ./
COPY --from=builder --chown=node:node /app/src ./src

RUN mkdir -p /data && chown -R node:node /data

USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:3000/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"
CMD ["node", "src/server.js"]