FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json* ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/game-data/package.json packages/game-data/package.json
COPY packages/simulator/package.json packages/simulator/package.json
RUN npm install

COPY tsconfig.base.json vitest.config.ts ./
COPY prisma ./prisma
COPY packages ./packages
COPY apps/api ./apps/api
RUN npx prisma generate
RUN npm run build -w packages/game-data && npm run build -w packages/simulator && npm run build -w apps/api
RUN npm prune --omit=dev

FROM node:22-alpine

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3001
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/packages/game-data/package.json ./packages/game-data/package.json
COPY --from=build /app/packages/game-data/data ./packages/game-data/data
COPY --from=build /app/packages/game-data/dist ./packages/game-data/dist
COPY --from=build /app/packages/simulator/package.json ./packages/simulator/package.json
COPY --from=build /app/packages/simulator/dist ./packages/simulator/dist
COPY --from=build /app/apps/api/package.json ./apps/api/package.json
COPY --from=build /app/apps/api/dist ./apps/api/dist

EXPOSE 3001
CMD ["sh", "-c", "npx prisma migrate deploy && node apps/api/dist/server.js"]
