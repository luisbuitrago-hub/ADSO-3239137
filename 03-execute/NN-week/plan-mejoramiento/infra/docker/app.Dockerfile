FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
ENV VITE_API_BASE_URL=/api/v1
RUN npm run build

FROM nginxinc/nginx-unprivileged:stable-alpine AS runtime
COPY --from=build /app/dist /usr/share/nginx/html
# La configuración se copia desde el contexto app/, sin acceso a .env del backend.
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 8080
