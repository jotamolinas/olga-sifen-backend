FROM node:20-alpine AS builder

WORKDIR /app

RUN apk add --no-cache openssl

COPY package*.json tsconfig.json ./
RUN npm install

COPY src ./src
RUN npm run build

# Generar clave privada PEM, certificado PEM y contenedor PKCS#12 para compatibilidad total
RUN mkdir -p certs && \
    openssl req -x509 -newkey rsa:2048 -keyout certs/privada.key -out certs/certificado.pem -days 730 -nodes \
      -subj "/C=PY/ST=Central/L=Asuncion/O=SIFEN Test/OU=Facturacion Electronica/CN=SIFEN Test RSA 2048" && \
    openssl pkcs12 -export -out certs/certificado.p12 -inkey certs/privada.key -in certs/certificado.pem \
      -passout pass:test1234 -legacy -keypbe PBE-SHA1-3DES -certpbe PBE-SHA1-3DES -macalg sha1

FROM node:20-alpine AS runner

WORKDIR /app

RUN apk add --no-cache openssl

ENV NODE_ENV=production
ENV PORT=8080
ENV CERT_P12_PATH=./certs/certificado.p12
ENV CERT_PASSWORD=test1234
ENV CERT_P12_PASSWORD=test1234
ENV USE_MOCK_SIFEN_RESPONSE=true
ENV SIFEN_CSC_ID=0001
ENV SIFEN_CSC=ABCD0000000000000000000000000000

COPY package*.json ./
RUN npm install --only=production

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/certs ./certs

EXPOSE 8080

CMD ["node", "dist/server.js"]
