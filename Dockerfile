FROM node:18.18.0 as base
WORKDIR /app
COPY . .
RUN npm ci
CMD ["npm", "run", "dev"]