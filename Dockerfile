FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY index.html vite.config.js ./
COPY src ./src
COPY styles.css ./styles.css
COPY assets ./assets

RUN npm run build

FROM node:22-alpine

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV DATA_FILE=/data/users.json
ENV COOKIE_SECURE=true

COPY server.js package.json README.md ./
COPY --from=build /app/dist ./dist

RUN mkdir -p /data && chown -R node:node /app /data

USER node

EXPOSE 3000

CMD ["node", "server.js"]
