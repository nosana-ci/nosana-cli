FROM node:20.11.1

# nosana cli
WORKDIR /usr/local/lib/nosana-cli
COPY . .
RUN npm ci \
 && npm run build \
 && npm ci --omit=dev \
 && npm install -g
ENV NODE_ENV production

WORKDIR /nosana
