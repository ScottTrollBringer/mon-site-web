# Build stage
FROM node:20-alpine AS build

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

RUN npm run build

# Production stage
FROM nginx:alpine

COPY --from=build /app/dist /usr/share/nginx/html

# Optional: Add a custom nginx config if needed for SPA routing
COPY nginx.conf /etc/nginx/conf.d/default.conf


# Ajout d'un utilisateur non-root
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Permissions pour nginx
RUN chown -R appuser:appgroup /usr/share/nginx/html && \
        chmod -R 755 /usr/share/nginx/html && \
        chown -R appuser:appgroup /var/cache/nginx && \
        chown -R appuser:appgroup /var/log/nginx && \
        chown -R appuser:appgroup /etc/nginx/conf.d
RUN touch /var/run/nginx.pid && \
        chown -R appuser:appgroup /var/run/nginx.pid

USER appuser

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
