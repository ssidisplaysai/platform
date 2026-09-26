FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
COPY apps/api/package*.json apps/api/
COPY packages/domain/package*.json packages/domain/
RUN npm install
COPY tsconfig.base.json ./
COPY apps/api apps/api
COPY packages/domain packages/domain
RUN npm run build -w @sports/domain && npm run build -w @sports/api
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/package.json ./apps/api/package.json
COPY --from=build /app/packages/domain/dist ./packages/domain/dist
COPY --from=build /app/packages/domain/package.json ./packages/domain/package.json
EXPOSE 4000
CMD ["node","apps/api/dist/index.js"]
