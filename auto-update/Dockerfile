FROM node:20.11.1

ARG CONTAINER_TAG=0.0.0

WORKDIR /nosana

COPY . .
RUN npm ci \
 && npm run build \
 && npm ci --omit=dev
ENV NODE_ENV production
ENV APP_ENV prd

ENTRYPOINT ["node", "dist/src/index.js"]