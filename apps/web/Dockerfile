FROM node:22-slim AS build
WORKDIR /app
COPY package.json ./
RUN corepack enable && (pnpm install --no-frozen-lockfile || npm install)
COPY . .
RUN npm run build

FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
