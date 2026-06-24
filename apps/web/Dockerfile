FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json* ./
COPY apps/web/package.json apps/web/package.json
COPY apps/api/package.json apps/api/package.json
COPY packages/game-data/package.json packages/game-data/package.json
COPY packages/simulator/package.json packages/simulator/package.json
RUN npm install

COPY tsconfig.base.json vitest.config.ts ./
COPY packages ./packages
COPY apps/web ./apps/web
RUN npm run build -w packages/game-data && npm run build -w packages/simulator && npm run build -w apps/web

FROM node:22-alpine

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
COPY apps/web/server.mjs apps/web/server.mjs
COPY --from=build /app/apps/web/dist ./apps/web/dist

EXPOSE 3000
CMD ["node", "apps/web/server.mjs"]
