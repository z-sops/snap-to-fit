# Snap to Fit API. The server only needs Node 24 (built-in node:sqlite) and tsx.
FROM node:24-alpine
WORKDIR /app
RUN npm init -y >/dev/null 2>&1 && npm install --no-audit --no-fund tsx@4.23.15
COPY server ./server
COPY src/core ./src/core
RUN mkdir -p /app/data && chown node:node /app/data
USER node
ENV NODE_ENV=production HOST=0.0.0.0 PORT=8787 DATABASE_PATH=/app/data/accounts.sqlite
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD wget -qO- http://127.0.0.1:8787/health || exit 1
CMD ["node", "--import", "tsx", "server/index.ts"]
