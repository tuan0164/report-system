# ---- Frontend: build React (Vite) -> serve bằng nginx ----

# Stage 1: build
FROM node:24-alpine AS build
WORKDIR /app

# VITE_API_URL nhúng lúc BUILD (Vite biến env thành hằng số trong bundle)
# -> phải truyền qua build-arg, không phải runtime
ARG VITE_API_URL=/api
ENV VITE_API_URL=$VITE_API_URL

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build          # ra /app/dist

# Stage 2: serve
FROM nginx:alpine
# Copy static build
COPY --from=build /app/dist /usr/share/nginx/html
# Copy cấu hình nginx (route SPA + proxy /api)
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
