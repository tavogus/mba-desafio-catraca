FROM node:22-bookworm-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN chmod +x docker-entrypoint.sh

ENV NODE_ENV=production

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["serve"]
