FROM node:20-alpine AS calculators-builder

WORKDIR /build

# Install root deps (including dev) and build calculators dist/
COPY package*.json ./
COPY tsconfig.json tsdown.config.ts ./
COPY src ./src
RUN npm ci && npm run build


FROM node:20-alpine

ENV NODE_ENV=production

WORKDIR /app

# Install only API dependencies first (leverages npm cache)
COPY grossnet-api/package*.json ./
RUN npm ci --omit=dev

# Install peer dependencies required by @finanzfluss/calculators
RUN npm install --omit=dev bignumber.js@^9.3.1 dinero.js@^1.9.1 zod@^4.1.5

# Vendor the freshly built local @finanzfluss/calculators package into node_modules
RUN mkdir -p node_modules/@finanzfluss/calculators
COPY --from=calculators-builder /build/package.json node_modules/@finanzfluss/calculators/package.json
COPY --from=calculators-builder /build/dist node_modules/@finanzfluss/calculators/dist

# Copy server entry
COPY grossnet-api/server.mjs ./server.mjs

EXPOSE 3000

CMD ["node", "server.mjs"]


