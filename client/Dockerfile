# Build stage
FROM node:20-alpine AS build

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

RUN npm run build

# Production stage
FROM nginx:alpine

# Copy static assets
COPY --from=build /app/dist /usr/share/nginx/html

# Copy custom configuration
COPY nginx-custom.conf /etc/nginx/nginx.conf

# Add non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Permissions
# We only need to ensure /usr/share/nginx/html is readable.
# Temp paths are in /tmp so no need to chmod /var/cache/nginx
RUN chown -R appuser:appgroup /usr/share/nginx/html && \
        chmod -R 755 /usr/share/nginx/html

USER appuser

EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]
