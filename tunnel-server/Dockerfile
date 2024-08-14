FROM node:20.11.1

# nosana cli
WORKDIR /usr/src/app
COPY . .
RUN npm ci \
 && npm run build \
 && npm ci --omit=dev
ENV NODE_ENV production

EXPOSE 3000

CMD ["node", "dist/index.js"]