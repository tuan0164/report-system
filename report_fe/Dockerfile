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

# Đặt vào /etc/nginx/templates/: entrypoint của ảnh nginx sẽ chạy envsubst,
# thay ${AUTH_RATE} / ${AUTH_BURST} bằng biến môi trường, rồi ghi kết quả ra
# /etc/nginx/conf.d/default.conf lúc container khởi động.
# => đổi ngưỡng rate limit chỉ cần sửa .env + restart, KHÔNG phải build lại.
# (envsubst chỉ thay đúng các biến có trong env, nên $uri/$host/$remote_addr
#  của nginx không bị đụng tới.)
COPY default.conf.template /etc/nginx/templates/default.conf.template

# Giá trị mặc định, để container vẫn chạy được nếu quên đặt trong .env.
ENV AUTH_RATE=60r/m \
    AUTH_BURST=100

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
