FROM golang:1.22-alpine AS build
WORKDIR /src

COPY packages/agent /src

RUN go mod download
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o /out/selfyurt-agent ./cmd/agent

FROM alpine:3.20
RUN apk add --no-cache ca-certificates docker-cli docker-cli-compose

COPY --from=build /out/selfyurt-agent /usr/local/bin/selfyurt-agent

EXPOSE 7070

CMD ["/usr/local/bin/selfyurt-agent"]
