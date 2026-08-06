FROM node:18 AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --legacy-peer-deps
COPY . .
RUN npm run build
RUN cp -R src/model dist/model || true

FROM node:18
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev --legacy-peer-deps
COPY --from=builder /app/dist ./dist
# Copy model caches for embedding/classification runtime
COPY --from=builder /app/src/model ./src/model
COPY --from=builder /app/dist/model ./dist/model
COPY entrypoint.sh ./
RUN chmod +x entrypoint.sh
EXPOSE 5000
ENTRYPOINT ["./entrypoint.sh"]
