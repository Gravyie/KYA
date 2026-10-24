FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY apps/web/package*.json ./apps/web/
RUN npm ci --prefix apps/web
COPY apps/web ./apps/web
COPY scripts/compress-web.mjs ./scripts/compress-web.mjs
COPY apps/server/src/policy.js ./apps/server/src/policy.js
COPY packages/sdk/src ./packages/sdk/src
RUN npm run build --prefix apps/web

FROM node:24-bookworm-slim AS runtime
ENV NODE_ENV=production PORT=5055 MIHARI_HOST=0.0.0.0 MIHARI_DATA_DIR=/data
WORKDIR /app
COPY --from=build /app/apps/web/dist ./apps/web/dist
COPY apps/server/src ./apps/server/src
COPY packages ./packages
COPY examples ./examples
COPY scripts/recover-owner.mjs ./scripts/recover-owner.mjs
COPY package.json ./package.json
RUN mkdir /data && chown node:node /data
USER node
VOLUME /data
EXPOSE 5055
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD node -e "fetch('http://127.0.0.1:5055/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node", "apps/server/src/index.js"]
