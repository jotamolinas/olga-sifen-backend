FROM node:20-alpine AS builder

WORKDIR /app

RUN apk add --no-cache openssl

COPY package*.json tsconfig.json ./
COPY scripts ./scripts
RUN npm install

COPY src ./src
RUN npm run build

# Generar certificado RSA 2048 bits limpio con AES-256 (evitando RC2/3DES legados de 40 bits)
RUN mkdir -p certs && \
    openssl req -x509 -newkey rsa:2048 -keyout certs/key.pem -out certs/cert.pem -days 730 -nodes \
      -subj "/C=PY/ST=Central/L=Asuncion/O=SIFEN Test/OU=Facturacion Electronica/CN=SIFEN Test RSA 2048" && \
    openssl pkcs12 -export -out certs/certificado.p12 -inkey certs/key.pem -in certs/cert.pem \
      -passout pass:test1234 -keypbe AES-256-CBC -certpbe AES-256-CBC -nomaciter && \
    rm certs/key.pem certs/cert.pem

FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080
ENV CERT_P12_PATH=./certs/certificado.p12
ENV CERT_PASSWORD=test1234
ENV CERT_P12_PASSWORD=test1234
ENV NODE_OPTIONS="--openssl-legacy-provider"

COPY package*.json ./
COPY scripts ./scripts
RUN npm install --only=production

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/certs ./certs

EXPOSE 8080

CMD ["node", "dist/server.js"]


