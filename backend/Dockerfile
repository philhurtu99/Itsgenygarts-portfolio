FROM node:20-bookworm-slim@sha256:2cf067cfed83d5ea958367df9f966191a942351a2df77d6f0193e162b5febfc0

WORKDIR /app
ENV NODE_ENV=production

RUN apt-get update \
  && apt-get upgrade -y \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
COPY prisma ./prisma
RUN npm ci \
  && ./node_modules/.bin/prisma generate \
  && npm cache clean --force \
  && rm -rf /usr/local/lib/node_modules/npm \
  && rm -f /usr/local/bin/npm /usr/local/bin/npx

COPY src ./src
RUN mkdir -p uploads/quotes uploads/custom-orders \
  && chown -R node:node /app

EXPOSE 3001
USER node
CMD ["sh", "-c", "./node_modules/.bin/prisma migrate deploy && node src/index.js"]
