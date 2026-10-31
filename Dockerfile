FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json tsconfig.json ./
RUN npm ci

COPY src ./src
RUN npm run build

FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080
ENV CERT_P12_PATH=./certs/certificado.p12
ENV CERT_PASSWORD=test1234
ENV CERT_P12_PASSWORD=test1234

COPY package*.json ./
RUN npm ci --only=production

COPY --from=builder /app/dist ./dist
COPY certs ./certs

EXPOSE 8080

CMD ["node", "dist/server.js"]
