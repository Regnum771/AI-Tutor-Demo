# One service for the public URL: the built pages and /api. Dev tools (Vite, Vitest) stay in the build stage.
FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build
RUN npm prune --omit=dev

FROM node:22-slim
WORKDIR /app
ENV BEYOND_HOSTED=1
COPY --from=build /app .
USER node
CMD ["node", "--import", "tsx", "server/index.ts"]
