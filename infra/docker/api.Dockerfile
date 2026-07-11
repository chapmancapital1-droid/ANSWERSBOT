FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY packages/shared-types/package.json packages/shared-types/
RUN npm ci --omit=optional

FROM node:20-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate --schema apps/api/prisma/schema.prisma
RUN npm run build --workspace=apps/api

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -g 1001 nodejs && adduser -u 1001 -G nodejs -S nestjs \
  && apk add --no-cache wget
COPY --from=build --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=build --chown=nestjs:nodejs /app/package.json ./package.json
COPY --from=build --chown=nestjs:nodejs /app/apps/api/dist ./apps/api/dist
COPY --from=build --chown=nestjs:nodejs /app/apps/api/prisma ./apps/api/prisma
COPY --from=build --chown=nestjs:nodejs /app/apps/api/package.json ./apps/api/package.json
COPY --chown=nestjs:nodejs infra/docker/api-entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
USER nestjs
EXPOSE 4000
HEALTHCHECK --interval=20s --timeout=5s --start-period=40s --retries=5 \
  CMD wget -qO- http://127.0.0.1:4000/api/v1/health/ready || exit 1
ENTRYPOINT ["/entrypoint.sh"]
