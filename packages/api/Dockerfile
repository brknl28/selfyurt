FROM oven/bun:1.3 AS build
WORKDIR /app

COPY package.json /app/package.json
COPY packages /app/packages

RUN bun install

WORKDIR /app/packages/api
RUN bunx prisma generate
RUN bun run build

FROM oven/bun:1.3
WORKDIR /app

COPY --from=build /app /app

WORKDIR /app/packages/api
EXPOSE 8787

CMD ["sh", "-c", "bun run prisma:migrate || echo 'prisma migrate failed, fallback schema bootstrap will run'; bun run start"]
