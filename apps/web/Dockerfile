FROM node:22-slim AS build
WORKDIR /app
# npm + lockfile commitado (nao ha pnpm/workspace neste projeto)
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:1.27-alpine
# nginx.conf usa ${API_UPSTREAM}: entra como template, o entrypoint do nginx roda
# envsubst nas vars presentes no ambiente (API_UPSTREAM vem do Cloud Run / Terraform).
ENV API_UPSTREAM=http://127.0.0.1:8081
COPY nginx.conf /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
