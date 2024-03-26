FROM node:18-alpine

COPY package.json yarn.lock ./
RUN yarn install

# Copy files and compile it to javascript
COPY . .
RUN npx tsc \
    && chmod +x dist/index.js

ENTRYPOINT [ "dist/index.js" ]