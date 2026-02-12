# Build stage
FROM node:20-alpine AS build

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/

RUN npm install

COPY . .

RUN npx prisma generate
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

COPY --from=build /app/package*.json ./
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/config ./config
COPY --from=build /app/docker-entrypoint.sh ./
RUN chmod +x ./docker-entrypoint.sh

# Install su-exec for privilege dropping
RUN apk add --no-cache su-exec

# Ajout d'un utilisateur non-root
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Create uploads directory and set initial permissions
RUN mkdir -p /app/uploads/blog && \
    chown -R appuser:appgroup /app/uploads

EXPOSE 3000

# We use the entrypoint to load secrets before starting
ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["npm", "start"]
