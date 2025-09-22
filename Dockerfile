FROM node:20-alpine

ENV NODE_ENV=production

WORKDIR /app

# Install only API dependencies
COPY grossnet-api/package*.json ./
RUN npm ci --omit=dev

# Copy server entry
COPY grossnet-api/server.mjs ./server.mjs

EXPOSE 3000

CMD ["node", "server.mjs"]


