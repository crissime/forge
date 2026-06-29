FROM node:22-alpine

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

COPY apps/web/server.mjs apps/web/server.mjs
COPY apps/web/dist ./apps/web/dist

EXPOSE 3000
CMD ["node", "apps/web/server.mjs"]
