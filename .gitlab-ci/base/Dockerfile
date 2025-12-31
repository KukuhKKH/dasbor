FROM node:22-alpine

WORKDIR /app

RUN apk add --no-cache iputils util-linux

ENV NUXT_HOST=0.0.0.0
ENV NUXT_PORT=3000
ENV NODE_ENV=production