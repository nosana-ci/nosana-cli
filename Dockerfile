FROM node:20.11.1

ARG CONTAINER_TAG=0.0.0



# nosana cli
WORKDIR /usr/local/lib/nosana-cli
COPY . .
# TODO - use build args to set the version in the pipeline
# RUN sed -i "s/0.0.0/$(echo $CONTAINER_TAG | sed 's/v//')/" package.json
RUN sed -i "s/0.0.0/0.1.112/" package.json
RUN npm ci \
 && npm run build \
 && npm ci --omit=dev \
 && npm install -g
ENV NODE_ENV production

WORKDIR /nosana
