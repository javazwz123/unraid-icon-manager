FROM node:20-alpine

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3149
ENV UNRAID_ICON_STORE_DIR=/app/icons

COPY package*.json ./
RUN npm ci --omit=dev

COPY public ./public
COPY src ./src

RUN mkdir -p /app/data /app/icons

EXPOSE 3149

VOLUME ["/app/data", "/app/icons"]

CMD ["node", "src/server.js"]
