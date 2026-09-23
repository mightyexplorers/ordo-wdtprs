# Builds the static site and serves it with nginx at http://localhost:8080/ordo-wdtprs/
#   docker compose up --build              # build from the committed data
#   docker compose run --rm refresh        # re-download posts + 1962 calendar into the repo
FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:1.27-alpine
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html/ordo-wdtprs
EXPOSE 80
