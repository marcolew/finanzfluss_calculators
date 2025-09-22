FROM node:20-alpine

ENV NODE_ENV=production

WORKDIR /app

# Install only API dependencies
COPY grossnet-api/package*.json ./
RUN npm ci --omit=dev

# Install peer dependencies required by @finanzfluss/calculators
RUN npm install --omit=dev bignumber.js@^9.3.1 dinero.js@^1.9.1 zod@^4.1.5

# Vendor the local @finanzfluss/calculators package from repo's prebuilt dist
RUN mkdir -p node_modules/@finanzfluss/calculators
COPY package.json node_modules/@finanzfluss/calculators/package.json
COPY dist node_modules/@finanzfluss/calculators/dist

# Copy server entry
COPY grossnet-api/server.mjs ./server.mjs

EXPOSE 3000

CMD ["node", "server.mjs"]


