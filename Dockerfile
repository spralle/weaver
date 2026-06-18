FROM oven/bun:1.2.21-alpine AS deps
WORKDIR /app

COPY package.json bun.lock turbo.json tsconfig.base.json ./
COPY packages ./packages
COPY apps ./apps
RUN bun install --frozen-lockfile

FROM deps AS builder
RUN bun run build

FROM oven/bun:1.2.21-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV WEAVER_PORT=3399

COPY package.json bun.lock ./
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/apps ./apps
RUN bun install --frozen-lockfile --production

EXPOSE 3399
CMD ["bun", "run", "--cwd", "packages/weaver-server", "start"]
