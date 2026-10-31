const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const certDir = path.join(__dirname, 'certs');
const keyPath = path.join(certDir, 'temp_key.pem');
const certPemPath = path.join(certDir, 'temp_cert.pem');
const p12Path = path.join(certDir, 'certificado.p12');

console.log('=== Generador de Certificado PKCS#12 SIFEN ===');

try {
  // 1. Generar clave privada RSA de 2048 bits
  console.log('1. Generando clave privada RSA 2048...');
  execSync(`openssl genrsa -out "${keyPath}" 2048`, { stdio: 'inherit' });

  // 2. Generar certificado X.509 autofirmado
  console.log('2. Generando certificado X.509 autofirmado...');
  const subj = '/C=PY/ST=Central/L=Asuncion/O=SIFEN Test/OU=Facturacion Electronica/CN=SIFEN Test RSA 2048';
  execSync(`openssl req -new -x509 -key "${keyPath}" -out "${certPemPath}" -days 730 -subj "${subj}"`, { stdio: 'inherit' });

  // 3. Empaquetar a PKCS#12 con AES-256 (evitando RC2/3DES legados)
  console.log('3. Empaquetando contenedor PKCS#12 moderno (AES-256)...');
  execSync(
    `openssl pkcs12 -export -out "${p12Path}" -inkey "${keyPath}" -in "${certPemPath}" -passout pass:test1234 -keypbe AES-256-CBC -certpbe AES-256-CBC -nomaciter`,
    { stdio: 'inherit' }
  );

  console.log('4. Limpiando archivos temporales PEM...');
  if (fs.existsSync(keyPath)) fs.unlinkSync(keyPath);
  if (fs.existsSync(certPemPath)) fs.unlinkSync(certPemPath);

  const stats = fs.statSync(p12Path);
  console.log(`✅ Certificado .p12 generado exitosamente: ${p12Path} (${stats.size} bytes)`);
} catch (err) {
  console.error('Error al generar certificado con OpenSSL:', err.message);
  process.exit(1);
}
