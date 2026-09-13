FROM oven/bun:1.3 AS build
WORKDIR /app

COPY package.json /app/package.json
COPY packages /app/packages

RUN bun install

WORKDIR /app/packages/web
RUN bun run build

FROM nginx:1.27-alpine

COPY packages/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/packages/web/dist /usr/share/nginx/html

EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]
