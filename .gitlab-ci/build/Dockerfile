FROM ${IMAGE_NAMESPACE}/server-dashboard-base:latest

WORKDIR /app

COPY .output ./.output

WORKDIR /app/.output/server

RUN apk add --no-cache --virtual .build-deps python3 make g++ \
    && npm install --omit=dev \
    && apk del .build-deps

WORKDIR /app

ENV NUXT_HOST=0.0.0.0
ENV NUXT_PORT=3000
ENV NODE_ENV=production
ENV NITRO_PRESET=node_cluster 

EXPOSE 3000

CMD [ "node", ".output/server/index.mjs" ]
