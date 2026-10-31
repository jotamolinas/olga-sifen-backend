const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const certDir = path.join(__dirname, '..', 'certs');
if (!fs.existsSync(certDir)) {
  fs.mkdirSync(certDir, { recursive: true });
}

const keyPath = path.join(certDir, 'privada.key');
const certPemPath = path.join(certDir, 'certificado.pem');
const p12Path = path.join(certDir, 'certificado.p12');

console.log('=== Generador de Certificados SIFEN (PEM + PKCS#12) ===');

try {
  // 1. Generar clave privada RSA de 2048 bits y certificado X.509
  console.log('1. Generando clave privada RSA 2048 y certificado X.509...');
  const subj = '/C=PY/ST=Central/L=Asuncion/O=SIFEN Test/OU=Facturacion Electronica/CN=SIFEN Test RSA 2048';
  execSync(
    `openssl req -x509 -newkey rsa:2048 -keyout "${keyPath}" -out "${certPemPath}" -days 730 -nodes -subj "${subj}"`,
    { stdio: 'inherit' }
  );

  // 2. Empaquetar a PKCS#12 para compatibilidad si es necesario
  console.log('2. Empaquetando contenedor PKCS#12 compatible (PBE-SHA1-3DES)...');
  execSync(
    `openssl pkcs12 -export -out "${p12Path}" -inkey "${keyPath}" -in "${certPemPath}" -passout pass:test1234 -legacy -keypbe PBE-SHA1-3DES -certpbe PBE-SHA1-3DES -macalg sha1`,
    { stdio: 'inherit' }
  );

  console.log(`✅ Archivos generados exitosamente en ${certDir}:`);
  console.log(`   - Clave privada: ${keyPath} (${fs.statSync(keyPath).size} bytes)`);
  console.log(`   - Certificado PEM: ${certPemPath} (${fs.statSync(certPemPath).size} bytes)`);
  console.log(`   - Contenedor .p12: ${p12Path} (${fs.statSync(p12Path).size} bytes)`);
} catch (err) {
  console.error('Error al generar certificados con OpenSSL:', err.message);
  process.exit(1);
}
