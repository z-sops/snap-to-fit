FROM node:24-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY server ./server
COPY src/core ./src/core
RUN mkdir -p /app/data && chown node:node /app/data
USER node
ENV NODE_ENV=production HOST=0.0.0.0 PORT=8787 DATABASE_PATH=/app/data/accounts.sqlite
EXPOSE 8787
CMD ["node", "--import", "tsx", "server/index.ts"]
