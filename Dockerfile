FROM node:22-alpine AS builder

RUN apk add --no-cache python3 make g++

RUN corepack enable && corepack prepare pnpm@10.17.0 --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json .nvmrc ./
COPY packages packages
COPY apps apps
COPY scripts scripts

RUN pnpm install --frozen-lockfile
RUN pnpm build && pnpm stamp
RUN pnpm deploy --filter sync --prod --legacy /prod/sync

FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /prod/sync /app
COPY --from=builder /app/apps/web/dist /app/apps/web/dist

RUN addgroup -S nodejs && adduser -S nodejs -G nodejs \
  && chown -R nodejs:nodejs /app

USER nodejs

EXPOSE 3000

CMD ["node", "dist/main.js"]
