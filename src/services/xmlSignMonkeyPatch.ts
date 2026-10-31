import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { execSync } from 'child_process';

let isPatchApplied = false;

/**
 * Sobrescribe en tiempo de ejecución (Runtime Monkey Patch) los métodos internos de
 * facturacionelectronicapy-xmlsign (PKCS12 y token) para evitar el uso del decodificador
 * ASN.1 de node-forge (que falla con errores de 40 bits y Negative length).
 * 
 * En su lugar, lee directamente los certificados PEM y claves privadas RSA generados
 * con OpenSSL (certs/privada.key y certs/certificado.pem) y firma usando crypto nativo de Node.js.
 */
export function applyXmlSignRuntimePatch(): void {
  if (isPatchApplied) {
    return;
  }

  try {
    // 1. Monkey patch node-forge ByteStringBuffer / ByteBuffer para admitir 40 bits si algo lo invoca
    try {
      const forge = require('node-forge');
      const ByteStringBuffer = forge?.util?.ByteStringBuffer || forge?.util?.ByteBuffer;
      if (ByteStringBuffer && ByteStringBuffer.prototype) {
        const origGetInt = ByteStringBuffer.prototype.getInt;
        ByteStringBuffer.prototype.getInt = function (numOfBits: number) {
          if (numOfBits === 40) {
            const b1 = this.getByte();
            const b2 = this.getByte();
            const b3 = this.getByte();
            const b4 = this.getByte();
            const b5 = this.getByte();
            return (b1 * 0x100000000) + (b2 << 24) + (b3 << 16) + (b4 << 8) + b5;
          }
          return origGetInt.call(this, numOfBits);
        };
      }
    } catch (_) {}

    // 2. Monkey patch a las clases PKCS12 y token de facturacionelectronicapy-xmlsign
    const targetModules = [
      'facturacionelectronicapy-xmlsign/dist/PKCS12',
      'facturacionelectronicapy-xmlsign/dist/token'
    ];

    for (const modName of targetModules) {
      try {
        const mod = require(modName);
        const instance = mod?.default || mod;
        const proto = Object.getPrototypeOf(instance) || instance;

        const objectsToPatch = [instance, proto];

        for (const target of objectsToPatch) {
          if (!target) continue;

          target.openCertificate = function (file: string) {
            this._privateKeyPem = null;
            this._certificateB64 = null;
            this.p12 = undefined;
            this.p12Asn1 = undefined;

            const filePathStr = String(file || '');
            const candidateDirs = [
              path.dirname(filePathStr),
              path.resolve(process.cwd(), 'certs'),
              path.resolve(process.cwd())
            ];

            // A. Buscar archivos PEM y KEY directamente
            for (const dir of candidateDirs) {
              const keyCandidates = [
                path.join(dir, 'privada.key'),
                path.join(dir, 'key.pem'),
                path.join(dir, 'privada.pem'),
                filePathStr.replace(/\.(p12|pfx)$/i, '.key'),
                filePathStr.replace(/\.(p12|pfx)$/i, '.pem')
              ];
              const certCandidates = [
                path.join(dir, 'certificado.pem'),
                path.join(dir, 'cert.pem'),
                filePathStr.replace(/\.(p12|pfx)$/i, '.pem'),
                filePathStr.replace(/\.(p12|pfx)$/i, '.crt')
              ];

              let foundKey: string | null = null;
              let foundCert: string | null = null;

              for (const k of keyCandidates) {
                if (fs.existsSync(k) && fs.statSync(k).isFile()) {
                  try {
                    const content = fs.readFileSync(k, 'utf8');
                    if (content.includes('PRIVATE KEY')) {
                      foundKey = content;
                      break;
                    }
                  } catch (_) {}
                }
              }

              for (const c of certCandidates) {
                if (fs.existsSync(c) && fs.statSync(c).isFile()) {
                  try {
                    const content = fs.readFileSync(c, 'utf8');
                    if (content.includes('CERTIFICATE')) {
                      foundCert = content;
                      break;
                    }
                  } catch (_) {}
                }
              }

              if (foundKey && foundCert) {
                this._privateKeyPem = foundKey;
                const lines = foundCert
                  .split(/\r?\n/)
                  .filter((line: string) => !line.startsWith('-----') && line.trim().length > 0);
                this._certificateB64 = '\n' + lines.join('\n');
                return;
              }
            }

            // B. Si Node soporta crypto.parsePKCS12 nativo
            if (typeof (crypto as any).parsePKCS12 === 'function' && fs.existsSync(filePathStr)) {
              try {
                const buf = fs.readFileSync(filePathStr);
                const parsed = (crypto as any).parsePKCS12(buf, { passphrase: this._passphrase || '' });
                if (parsed.privateKey && parsed.certificate) {
                  this._privateKeyPem = parsed.privateKey.export({ format: 'pem', type: 'pkcs8' });
                  const certPem = parsed.certificate.toString();
                  const lines = certPem
                    .split(/\r?\n/)
                    .filter((line: string) => !line.startsWith('-----') && line.trim().length > 0);
                  this._certificateB64 = '\n' + lines.join('\n');
                  return;
                }
              } catch (_) {}
            }

            // C. Extraer con OpenSSL CLI si está instalado en el contenedor
            if (fs.existsSync(filePathStr)) {
              try {
                const passArg = this._passphrase ? `-passin pass:${this._passphrase}` : '-passin pass:';
                const keyPem = execSync(`openssl pkcs12 -in "${filePathStr}" -nocerts -nodes ${passArg}`, {
                  stdio: ['pipe', 'pipe', 'ignore']
                }).toString('utf8');
                const certPem = execSync(`openssl pkcs12 -in "${filePathStr}" -clcerts -nokeys ${passArg}`, {
                  stdio: ['pipe', 'pipe', 'ignore']
                }).toString('utf8');
                if (keyPem.includes('PRIVATE KEY') && certPem.includes('CERTIFICATE')) {
                  this._privateKeyPem = keyPem;
                  const lines = certPem
                    .split(/\r?\n/)
                    .filter((line: string) => !line.startsWith('-----') && line.trim().length > 0);
                  this._certificateB64 = '\n' + lines.join('\n');
                  return;
                }
              } catch (_) {}
            }
          };

          target.openFile = function (file: string, passphase: string) {
            this._passphrase = passphase;
            this.openCertificate(file);
          };

          target.clean = function () {
            this.p12 = undefined;
            this.p12Asn1 = undefined;
            this._privateKeyPem = null;
            this._certificateB64 = null;
            this._passphrase = undefined;
          };

          target.getPrivateKey = function () {
            return this._privateKeyPem || null;
          };

          target.getCertificate = function () {
            return this._certificateB64 || null;
          };

          target.signature = function (xml: string, privateKey: string) {
            const signer = crypto.createSign('RSA-SHA256');
            signer.update(xml, 'utf8');
            signer.end();
            return signer.sign(privateKey, 'binary' as any);
          };
        }
      } catch (_) {}
    }

    isPatchApplied = true;
    console.log('✅ Monkey patch en runtime para facturacionelectronicapy-xmlsign activado.');
  } catch (err: any) {
    console.warn('⚠️ No se pudo aplicar monkey patch a xmlsign:', err?.message || err);
  }
}

// Ejecutar automáticamente al cargar el módulo
applyXmlSignRuntimePatch();
