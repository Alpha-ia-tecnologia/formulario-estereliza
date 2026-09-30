# Formulário de requisitos + servidor que guarda as respostas no PostgreSQL.
# Uma imagem só: o servidor (server/) entrega o dist/index.html e a API.
# Sem estado no container: configure DATABASE_URL (e API_TOKEN) no ambiente.

# ---- build: instala tudo, confere os tipos e gera dist/index.html ----
FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# ---- execução: só dependências de produção, o formulário compilado e o servidor ----
FROM node:24-bookworm-slim
# TRUST_PROXY=1: o Easypanel sempre põe o Traefik na frente, e o IP real vem no fim do X-Forwarded-For.
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=8787 \
    DIST_DIR=/app/dist \
    TRUST_PROXY=1
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
# O servidor reaproveita a validação e a exportação do formulário (src/).
COPY server ./server
COPY src ./src
USER node
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=5s --start-period=90s --retries=3 CMD ["node", "-e", "fetch('http://127.0.0.1:' + (process.env.PORT || 8787) + '/api/saude').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"]
CMD ["node", "--import", "tsx", "server/main.ts"]
